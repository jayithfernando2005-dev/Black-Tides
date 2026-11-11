// adminRoutes.js - the admin ("harbour master") page. Admins can see every captain, reset
// a captain's progress, rename a captain with a bad name, or remove an account.
// Other admins cannot be changed from here, and an admin cannot remove themselves.
const express = require("express");
const db = require("./db");
const requireAdmin = require("./requireAdmin");
const { findUserByName } = require("./users");
const { emptyProgress, saveProgressFor } = require("./progress");

const router = express.Router();
const USERNAME_RULE = /^[A-Za-z0-9_]{3,20}$/;

// Finds the captain in the address, and refuses to touch admins.
function targetCaptain(req, res) {
  const user = findUserByName(String(req.params.name));
  if (!user) {
    res.status(404).json({ error: "There is no captain with that name." });
    return null;
  }
  if (user.role === "admin") {
    res.status(403).json({ error: "Admin accounts cannot be changed from the admin page." });
    return null;
  }
  return user;
}

// GET /api/admin/captains - every captain with a short summary.
router.get("/admin/captains", requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT users.username AS username, users.created_at AS createdAt, users.role AS role,
           COUNT(scores.id) AS games, COALESCE(MAX(scores.score), 0) AS bestScore,
           MAX(scores.played_at) AS lastPlayed,
           COALESCE(progress.gold, 0) AS gold, COALESCE(progress.campaign, 1) AS campaign
    FROM users
    LEFT JOIN scores ON scores.user_id = users.id
    LEFT JOIN progress ON progress.user_id = users.id
    GROUP BY users.id
    ORDER BY users.created_at DESC
  `).all();
  res.json({ captains: rows, total: rows.length });
});

// POST /api/admin/captains/:name/reset - { scores: true } also removes their battles.
router.post("/admin/captains/:name/reset", requireAdmin, (req, res) => {
  const user = targetCaptain(req, res);
  if (!user) return;
  saveProgressFor(user.id, emptyProgress());
  if (req.body.scores === true) {
    db.prepare("DELETE FROM scores WHERE user_id = ?").run(user.id);
  }
  res.json({ reset: user.username, scoresRemoved: req.body.scores === true });
});

// POST /api/admin/captains/:name/rename - { newName }
router.post("/admin/captains/:name/rename", requireAdmin, (req, res) => {
  const user = targetCaptain(req, res);
  if (!user) return;
  const newName = String(req.body.newName || "").trim();
  if (!USERNAME_RULE.test(newName)) {
    return res.status(400).json({ error: "The new name must be 3 to 20 letters, numbers or _." });
  }
  const taken = findUserByName(newName);
  if (taken && taken.id !== user.id) {
    return res.status(409).json({ error: "That name is already taken." });
  }
  db.prepare("UPDATE users SET username = ? WHERE id = ?").run(newName, user.id);
  res.json({ renamed: user.username, to: newName });
});

// DELETE /api/admin/captains/:name - removes the account and everything that belongs to it.
router.delete("/admin/captains/:name", requireAdmin, (req, res) => {
  const user = targetCaptain(req, res);
  if (!user) return;
  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM scores WHERE user_id = ?").run(user.id);
    db.prepare("DELETE FROM progress WHERE user_id = ?").run(user.id);
    db.prepare("DELETE FROM daily_results WHERE user_id = ?").run(user.id);
    db.prepare("DELETE FROM rivals WHERE user_id = ? OR rival_id = ?").run(user.id, user.id);
    db.prepare("DELETE FROM quest_progress WHERE user_id = ?").run(user.id);
    db.prepare("DELETE FROM weekly_winners WHERE user_id = ?").run(user.id);
    db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    console.error(error);
    return res.status(500).json({ error: "The captain could not be removed." });
  }
  res.json({ removed: user.username });
});

module.exports = router;
