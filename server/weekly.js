// weekly.js - the weekly tournament. Each week (Monday 00:00 to Sunday 23:59, server time)
// has its own leaderboard. When a week is over, its winner is written into weekly_winners
// the next time anyone asks, and wears the champion's crown on their captain page.
const db = require("./db");

// Monday 00:00 of the week containing date.
function weekStart(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);
  return start;
}

// A label for the week, like "2026-W46" (ISO week number).
function weekLabel(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return d.getUTCFullYear() + "-W" + String(week).padStart(2, "0");
}

// The best battle of each captain between two moments.
function boardBetween(from, to, limit) {
  return db.prepare(`
    SELECT users.id AS userId, users.username AS username, MAX(scores.score) AS bestScore, COUNT(*) AS games
    FROM scores JOIN users ON users.id = scores.user_id
    WHERE scores.played_at >= ? AND scores.played_at < ?
    GROUP BY scores.user_id
    ORDER BY bestScore DESC, MIN(scores.played_at) ASC
    LIMIT ?
  `).all(from.toISOString(), to.toISOString(), limit);
}

// Writes down last week's winner if the week is over and nobody has done it yet.
function settleLastWeek(now = new Date()) {
  const thisWeek = weekStart(now);
  const lastWeek = new Date(thisWeek);
  lastWeek.setDate(lastWeek.getDate() - 7);
  const label = weekLabel(lastWeek);
  if (db.prepare("SELECT 1 FROM weekly_winners WHERE week = ?").get(label)) return;
  const [winner] = boardBetween(lastWeek, thisWeek, 1);
  if (winner) {
    db.prepare("INSERT OR IGNORE INTO weekly_winners (week, user_id, score) VALUES (?, ?, ?)").run(label, winner.userId, winner.bestScore);
  }
}

function lastChampion() {
  return db.prepare(`
    SELECT weekly_winners.week AS week, weekly_winners.score AS score, users.username AS username
    FROM weekly_winners JOIN users ON users.id = weekly_winners.user_id
    ORDER BY weekly_winners.week DESC LIMIT 1
  `).get() || null;
}

// The weeks a captain has won, newest first.
function weeksWon(userId) {
  return db.prepare("SELECT week, score FROM weekly_winners WHERE user_id = ? ORDER BY week DESC").all(userId);
}

// Everything the tournament banner needs.
function tournament(now = new Date()) {
  settleLastWeek(now);
  const start = weekStart(now);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return {
    week: weekLabel(now),
    startsAt: start.toISOString(),
    endsIn: Math.round((end - now) / 1000),
    lastChampion: lastChampion()
  };
}

module.exports = { weekStart, weekLabel, boardBetween, settleLastWeek, weeksWon, tournament };
