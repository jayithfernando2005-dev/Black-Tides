// AI note: written with help from Claude (Anthropic), as allowed for this assignment.
// statsRoutes.js - GET /api/stats: the numbers behind a captain's Statistics page
// (scores over time, battles per day, favourite stages, difficulty and sonar accuracy).
const express = require("express");
const db = require("./db");
const requireLogin = require("./requireLogin");
const { loadProgress } = require("./progress");
const { getRecord } = require("./scores");

const router = express.Router();
const STAGE_NAMES = ["Endless voyage", "Volcano Isle", "Harbour Fort", "Castle Siege", "Foggy Strait",
  "Smugglers' Reef", "Kraken's Deep", "Northern Bastion", "Raider Port", "Galleon Graveyard"];

function localDay(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

router.get("/stats", requireLogin, (req, res) => {
  const userId = req.session.userId;

  // the last 30 battles, oldest first (for the line chart)
  const recent = db.prepare(`
    SELECT score, wave, stage, difficulty, best_combo AS bestCombo, played_at AS playedAt
    FROM scores WHERE user_id = ? ORDER BY played_at DESC LIMIT 30
  `).all(userId).reverse();

  // battles and best score for each of the last 14 days (days with no battles show 0)
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - 13);
  const rows = db.prepare("SELECT score, played_at AS playedAt FROM scores WHERE user_id = ? AND played_at >= ?").all(userId, since.toISOString());
  const perDay = [];
  for (let i = 0; i < 14; i++) {
    const day = new Date(since);
    day.setDate(day.getDate() + i);
    perDay.push({ day: localDay(day.toISOString()), battles: 0, bestScore: 0 });
  }
  for (const row of rows) {
    const entry = perDay.find((d) => d.day === localDay(row.playedAt));
    if (entry) {
      entry.battles += 1;
      entry.bestScore = Math.max(entry.bestScore, row.score);
    }
  }

  // which stages the captain plays most
  const byStage = db.prepare(`
    SELECT stage, COUNT(*) AS battles, MAX(score) AS bestScore
    FROM scores WHERE user_id = ? GROUP BY stage ORDER BY battles DESC
  `).all(userId).map((row) => ({ ...row, name: STAGE_NAMES[row.stage] || "Stage " + row.stage }));

  const byDifficulty = db.prepare("SELECT difficulty, COUNT(*) AS battles FROM scores WHERE user_id = ? GROUP BY difficulty").all(userId);
  const totals = db.prepare(`
    SELECT COUNT(*) AS games, COALESCE(SUM(score), 0) AS totalScore, COALESCE(MAX(best_combo), 0) AS bestCombo
    FROM scores WHERE user_id = ?
  `).get(userId);
  const record = getRecord(userId);
  const progress = loadProgress(req);

  res.json({
    totals: {
      games: totals.games,
      totalScore: totals.totalScore,
      averageScore: totals.games ? Math.round(totals.totalScore / totals.games) : 0,
      bestScore: record.bestScore,
      sunk: record.sunk,
      bosses: record.bosses,
      bestCombo: totals.bestCombo
    },
    sonar: {
      tried: progress.puzzlesTried,
      solved: progress.puzzlesSolved,
      chestsRight: progress.chestsRight,
      bestStreak: progress.bestStreak,
      accuracy: progress.puzzlesTried ? Math.round(100 * progress.puzzlesSolved / progress.puzzlesTried) : null
    },
    recent: recent,
    perDay: perDay,
    byStage: byStage,
    byDifficulty: byDifficulty
  });
});

module.exports = router;
