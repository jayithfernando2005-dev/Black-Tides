// AI note: written with help from Claude (Anthropic), as allowed for this assignment.
// captainRoutes.js - public captain pages and rivals.
//   GET    /api/captains/:name    - anyone can see a captain's public record
//   GET    /api/rivals            - my rivals, with their best score next to mine
//   POST   /api/rivals            - { username } marks a captain as my rival (up to 5)
//   DELETE /api/rivals/:name      - stop following a rival
// Only public things are shown: never passwords, gold or session details.
const express = require("express");
const db = require("./db");
const requireLogin = require("./requireLogin");
const { findUserByName, findUserById } = require("./users");
const { getRecord, getRank } = require("./scores");
const { loadProgressFor } = require("./progress");
const { listAchievements } = require("./achievements");
const { rankOf, XP_RULES } = require("./ranks");
const { avatarInfo } = require("./avatarRoutes");
const { shipInfo } = require("./shipRoutes");
const { weeksWon, settleLastWeek } = require("./weekly");

const router = express.Router();
const MAX_RIVALS = 5;

function isRival(userId, rivalId) {
  return Boolean(db.prepare("SELECT 1 FROM rivals WHERE user_id = ? AND rival_id = ?").get(userId, rivalId));
}

function bestDaily(userId) {
  const row = db.prepare("SELECT MIN(seconds) AS best, COUNT(seconds) AS count FROM daily_results WHERE user_id = ?").get(userId);
  return { best: row.best, finished: row.count };
}

// GET /api/captains/:name - a captain's public page.
router.get("/captains/:name", (req, res) => {
  settleLastWeek();
  const user = findUserByName(String(req.params.name));
  if (!user) {
    return res.status(404).json({ error: "There is no captain with that name." });
  }
  const record = getRecord(user.id);
  const progress = loadProgressFor(user.id);
  const me = req.session.userId || null;
  res.json({
    username: user.username,
    memberSince: user.created_at,
    ...avatarInfo(user),
    ...shipInfo(user),
    rank: rankOf(user.id),
    weeksWon: weeksWon(user.id),
    xpRules: XP_RULES,
    leaderboardPlace: getRank(user.id),
    games: record.games,
    bestScore: record.bestScore,
    bestWave: record.bestWave,
    sunk: record.sunk,
    bosses: record.bosses,
    stagesWon: Math.max(0, Math.min(9, progress.campaign - 1)),
    puzzlesSolved: progress.puzzlesSolved,
    daily: bestDaily(user.id),
    achievements: listAchievements(user.id, progress),
    isMe: me === user.id,
    isRival: me ? isRival(me, user.id) : false
  });
});

// GET /api/rivals - my rivals and how I compare.
router.get("/rivals", requireLogin, (req, res) => {
  const mine = getRecord(req.session.userId).bestScore;
  const rows = db.prepare(`
    SELECT users.id AS id, users.username AS username, users.avatar AS avatar, users.avatar_updated AS avatarVersion
    FROM rivals JOIN users ON users.id = rivals.rival_id
    WHERE rivals.user_id = ? ORDER BY rivals.added_at
  `).all(req.session.userId);
  res.json({
    myBest: mine,
    max: MAX_RIVALS,
    rivals: rows.map((row) => {
      const best = getRecord(row.id).bestScore;
      return { username: row.username, avatar: row.avatar, avatarVersion: row.avatarVersion,
        bestScore: best, rank: rankOf(row.id).title, difference: mine - best };
    })
  });
});

// POST /api/rivals - { username }
router.post("/rivals", requireLogin, (req, res) => {
  const rival = findUserByName(String(req.body.username || ""));
  if (!rival) {
    return res.status(404).json({ error: "There is no captain with that name." });
  }
  if (rival.id === req.session.userId) {
    return res.status(400).json({ error: "You cannot be your own rival." });
  }
  if (isRival(req.session.userId, rival.id)) {
    return res.status(409).json({ error: rival.username + " is already your rival." });
  }
  const count = db.prepare("SELECT COUNT(*) AS count FROM rivals WHERE user_id = ?").get(req.session.userId).count;
  if (count >= MAX_RIVALS) {
    return res.status(400).json({ error: "You can have up to " + MAX_RIVALS + " rivals. Remove one first." });
  }
  db.prepare("INSERT INTO rivals (user_id, rival_id, added_at) VALUES (?, ?, ?)").run(req.session.userId, rival.id, new Date().toISOString());
  res.json({ added: rival.username });
});

// DELETE /api/rivals/:name
router.delete("/rivals/:name", requireLogin, (req, res) => {
  const rival = findUserByName(String(req.params.name));
  if (!rival || !isRival(req.session.userId, rival.id)) {
    return res.status(404).json({ error: "That captain is not your rival." });
  }
  db.prepare("DELETE FROM rivals WHERE user_id = ? AND rival_id = ?").run(req.session.userId, rival.id);
  res.json({ removed: rival.username });
});

// Captains whose best score was just overtaken by this captain, where either of them
// follows the other as a rival. Used for live news after a new personal best.
function rivalsPassed(userId, oldBest, newBest) {
  return db.prepare(`
    SELECT DISTINCT users.id AS id, users.username AS username
    FROM users
    JOIN rivals ON (rivals.user_id = ? AND rivals.rival_id = users.id) OR (rivals.rival_id = ? AND rivals.user_id = users.id)
  `).all(userId, userId).filter((other) => {
    const best = getRecord(other.id).bestScore;
    return best > 0 && best >= oldBest && best < newBest;
  }).map((other) => other.username);
}

module.exports = { router, rivalsPassed, findUserById };
