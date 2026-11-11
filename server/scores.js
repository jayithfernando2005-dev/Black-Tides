// scores.js - saving battle results and reading records and the leaderboard.
const db = require("./db");

// Saves the result of one battle for a captain.
function saveScore(userId, r) {
  db.prepare(`
    INSERT INTO scores (user_id, score, wave, sunk, bosses, gold_earned, under_fire, untouched, stage, difficulty, best_combo, played_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userId, r.score, r.wave, r.sunk, r.bosses, r.goldEarned,
    r.underFire ? 1 : 0, r.untouched ? 1 : 0, r.stage || 0, r.difficulty || "normal", r.bestCombo || 0, new Date().toISOString());
}

// One captain's record across every battle they have finished.
function getRecord(userId) {
  return db.prepare(`
    SELECT COUNT(*) AS games,
           COALESCE(MAX(score), 0) AS bestScore,
           COALESCE(MAX(wave), 0) AS bestWave,
           COALESCE(SUM(sunk), 0) AS sunk,
           COALESCE(SUM(bosses), 0) AS bosses,
           COALESCE(MAX(under_fire), 0) AS underFire,
           COALESCE(MAX(untouched), 0) AS untouched
    FROM scores
    WHERE user_id = ?
  `).get(userId);
}

// The top captains: each captain's best score and best wave, highest score first,
// plus how many ships and flagships they have sunk (for the achievement column).
// period "week" is the weekly tournament: only battles since Monday 00:00 count.
function getLeaderboard(period, limit) {
  const since = period === "week" ? require("./weekly").weekStart().toISOString() : "";
  return db.prepare(`
    SELECT users.username AS username,
           users.id AS userId,
           MAX(scores.score) AS bestScore,
           MAX(scores.wave) AS bestWave,
           SUM(scores.sunk) AS sunk,
           SUM(scores.bosses) AS bosses,
           COUNT(*) AS games,
           users.avatar AS avatar,
           users.avatar_updated AS avatarVersion
    FROM scores
    JOIN users ON users.id = scores.user_id
    WHERE scores.played_at >= ?
    GROUP BY scores.user_id
    ORDER BY bestScore DESC
    LIMIT ?
  `).all(since, limit);
}

// A captain's place on the all-time leaderboard (1 = top), or null with no battles.
function getRank(userId) {
  const mine = getRecord(userId);
  if (mine.games === 0) {
    return null;
  }
  const better = db.prepare(`
    SELECT COUNT(*) AS count FROM (
      SELECT MAX(score) AS best FROM scores GROUP BY user_id
    ) WHERE best > ?
  `).get(mine.bestScore);
  return better.count + 1;
}

module.exports = { saveScore, getRecord, getLeaderboard, getRank };
