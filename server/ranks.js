// AI note: written with help from Claude (Anthropic), as allowed for this assignment.
// ranks.js - captain ranks. Everything a captain does earns XP (experience), and enough XP
// raises their rank from Deckhand up to Admiral. XP is always worked out on the server
// from saved records, so it cannot be faked.
const db = require("./db");
const { getRecord } = require("./scores");
const { loadProgressFor } = require("./progress");

const RANKS = [
  { title: "Deckhand", xp: 0 },
  { title: "Powder Monkey", xp: 300 },
  { title: "Gunner", xp: 800 },
  { title: "Bosun", xp: 1800 },
  { title: "Quartermaster", xp: 3500 },
  { title: "Captain", xp: 6000 },
  { title: "Commodore", xp: 10000 },
  { title: "Admiral", xp: 16000 }
];

// How XP is earned (also shown on the captain page).
const XP_RULES = {
  perScorePoints: 20,       // 1 XP for every 20 points scored in all battles
  perShipSunk: 5,
  perBossSunk: 50,
  perPuzzleSolved: 10,
  perStageWon: 150,
  perDailyFinished: 50
};

function totalScore(userId) {
  return db.prepare("SELECT COALESCE(SUM(score), 0) AS total FROM scores WHERE user_id = ?").get(userId).total;
}

function dailyFinished(userId) {
  return db.prepare("SELECT COUNT(*) AS count FROM daily_results WHERE user_id = ? AND seconds IS NOT NULL").get(userId).count;
}

// A captain's XP from their saved records.
function xpFor(userId) {
  const record = getRecord(userId);
  const progress = loadProgressFor(userId);
  return Math.floor(totalScore(userId) / XP_RULES.perScorePoints) +
    record.sunk * XP_RULES.perShipSunk +
    record.bosses * XP_RULES.perBossSunk +
    progress.puzzlesSolved * XP_RULES.perPuzzleSolved +
    (progress.campaign - 1) * XP_RULES.perStageWon +
    dailyFinished(userId) * XP_RULES.perDailyFinished;
}

// The rank for an amount of XP: { title, level (1-8), xp, next, nextTitle, progress (0-1) }.
function rankFor(xp) {
  let level = 0;
  while (level + 1 < RANKS.length && xp >= RANKS[level + 1].xp) level += 1;
  const here = RANKS[level];
  const next = RANKS[level + 1] || null;
  return {
    title: here.title,
    level: level + 1,
    xp: xp,
    next: next ? next.xp : null,
    nextTitle: next ? next.title : null,
    progress: next ? (xp - here.xp) / (next.xp - here.xp) : 1
  };
}

function rankOf(userId) {
  return rankFor(xpFor(userId));
}

module.exports = { RANKS, XP_RULES, xpFor, rankFor, rankOf };
