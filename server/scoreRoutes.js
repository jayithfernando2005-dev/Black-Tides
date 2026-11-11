// scoreRoutes.js - saving battle results, a captain's profile, achievements and the leaderboard.
const express = require("express");
const { publish } = require("./liveEvents");
const { rankOf } = require("./ranks");
const { recordQuestStats } = require("./quests");
const { tournament } = require("./weekly");
const { rivalsPassed } = require("./captainRoutes");
const requireLogin = require("./requireLogin");
const { saveScore, getRecord, getLeaderboard, getRank } = require("./scores");
const { listAchievements } = require("./achievements");
const { loadProgress } = require("./progress");
const { findUserById } = require("./users");
const { avatarInfo } = require("./avatarRoutes");
const { shipInfo } = require("./shipRoutes");

const router = express.Router();

// True if the value is a whole number between 0 and max.
function isWholeNumber(value, max) {
  return Number.isInteger(value) && value >= 0 && value <= max;
}

// The keys of the badges a captain has unlocked right now.
function unlockedKeys(req) {
  return listAchievements(req.session.userId, loadProgress(req))
    .filter((a) => a.unlocked)
    .map((a) => a.key);
}

// POST /api/scores - save the result of a finished battle. Captains only.
router.post("/scores", requireLogin, (req, res) => {
  const result = {
    score: Number(req.body.score),
    wave: Number(req.body.wave),
    sunk: Number(req.body.sunk),
    bosses: Number(req.body.bosses),
    goldEarned: Number(req.body.goldEarned),
    underFire: req.body.underFire === true,
    untouched: req.body.untouched === true,
    stage: Number(req.body.stage || 0),
    difficulty: ["easy", "normal", "hard"].includes(req.body.difficulty) ? req.body.difficulty : "normal",
    bestCombo: Number(req.body.bestCombo || 0)
  };
  const valid = isWholeNumber(result.score, 1000000) && isWholeNumber(result.wave, 1000) &&
    isWholeNumber(result.sunk, 10000) && isWholeNumber(result.bosses, 1000) &&
    isWholeNumber(result.goldEarned, 1000000) && isWholeNumber(result.stage, 9) && isWholeNumber(result.bestCombo, 10000);
  if (!valid) {
    return res.status(400).json({ error: "That score does not look right." });
  }

  const before = unlockedKeys(req);
  const previousBest = getRecord(req.session.userId).bestScore;

  // The captain comes from the session, never from the browser,
  // so nobody can save a score under someone else's name.
  saveScore(req.session.userId, result);

  // Live sea news: a top-10 personal best, or a flagship sunk.
  const personalBest = result.score > previousBest;
  const rank = getRank(req.session.userId);
  if (personalBest && result.score > 0 && rank !== null && rank <= 10) {
    publish("score:record", { username: req.session.username, score: result.score, rank: rank });
  } else if (result.bosses > 0) {
    publish("flagship:sunk", { username: req.session.username, bosses: result.bosses });
  }

  // Live sea news for rivals whose best score was just overtaken.
  if (personalBest) {
    for (const rival of rivalsPassed(req.session.userId, previousBest, result.score)) {
      publish("rival:passed", { username: req.session.username, rival: rival, score: result.score });
    }
  }

  // Daily quests: this battle's numbers count towards today's quests.
  const extra = req.body.questStats && typeof req.body.questStats === "object" ? req.body.questStats : {};
  const small = (value) => (isWholeNumber(Number(value), 10000) ? Number(value) : 0);
  const questsCompleted = recordQuestStats(req.session.userId, {
    sunk: result.sunk, bosses: result.bosses, wave: result.wave, score: result.score, bestCombo: result.bestCombo,
    cutters: small(extra.cutters), ironclads: small(extra.ironclads), escorts: small(extra.escorts), specialsUsed: small(extra.specialsUsed)
  });

  const all = listAchievements(req.session.userId, loadProgress(req));
  const newlyUnlocked = all.filter((a) => a.unlocked && !before.includes(a.key)).map((a) => a.name);
  res.json({
    saved: true,
    personalBest: personalBest,
    questsCompleted: questsCompleted,
    newAchievements: newlyUnlocked
  });
});

// GET /api/profile - the logged-in captain's record for the profile page.
router.get("/profile", requireLogin, (req, res) => {
  const record = getRecord(req.session.userId);
  const progress = loadProgress(req);
  const user = findUserById(req.session.userId);
  const accuracy = progress.puzzlesTried === 0
    ? null
    : Math.round((progress.puzzlesSolved / progress.puzzlesTried) * 100);
  res.json({
    username: req.session.username,
    memberSince: user ? user.created_at : null,
    games: record.games,
    bestScore: record.bestScore,
    bestWave: record.bestWave,
    sunk: record.sunk,
    puzzlesSolved: progress.puzzlesSolved,
    accuracy: accuracy,
    gold: progress.gold,
    rank: getRank(req.session.userId),
    captainRank: rankOf(req.session.userId),
    ...avatarInfo(user),
    ...shipInfo(user)
  });
});

// GET /api/achievements - every badge, unlocked or not.
router.get("/achievements", requireLogin, (req, res) => {
  res.json(listAchievements(req.session.userId, loadProgress(req)));
});

// GET /api/leaderboard?period=all or ?period=week - the top 10 captains. Anyone may look.
router.get("/leaderboard", (req, res) => {
  const period = req.query.period === "week" ? "week" : "all";
  res.json(getLeaderboard(period, 10).map((row) => ({ ...row, title: rankOf(row.userId).title, userId: undefined })));
});

// GET /api/tournament - this week's tournament: its name, time left and last week's champion.
router.get("/tournament", (req, res) => {
  res.json(tournament());
});

module.exports = router;
