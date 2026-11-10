// AI note: written with help from Claude (Anthropic), as allowed for this assignment.
// progress.js - a captain's gold, ship upgrades and sonar record.
// Logged-in captains keep theirs in the database.
// Guests keep theirs in the session, so it is lost when they leave.
const db = require("./db");

// The four ship upgrades sold in the Shipyard.
const UPGRADES = {
  hull: { name: "Hull armour", text: "+25 hull points" },
  power: { name: "Cannon power", text: "Each shot hits harder" },
  hold: { name: "Ammo hold", text: "+3 shots per reload" },
  scope: { name: "Sonar scope", text: "Shorter jam after a wrong count" }
};
const MAX_LEVEL = 5;

// Each level costs more than the last: 40, 80, 120, 160, 200 gold.
function upgradeCost(level) {
  return 40 * (level + 1);
}

function emptyProgress() {
  return {
    gold: 0, hull: 0, power: 0, hold: 0, scope: 0,
    puzzlesTried: 0, puzzlesSolved: 0, chestsRight: 0, streak: 0, bestStreak: 0,
    campaign: 1
  };
}

// Reads the progress of whoever made this request.
function loadProgress(req) {
  if (!req.session.userId) {
    return req.session.guest || emptyProgress();
  }
  return loadProgressFor(req.session.userId);
}

// Reads any captain's progress by their id (for public pages, the admin page and save files).
function loadProgressFor(userId) {
  const row = db.prepare("SELECT * FROM progress WHERE user_id = ?").get(userId);
  if (!row) {
    return emptyProgress();
  }
  return {
    gold: row.gold, hull: row.hull, power: row.power, hold: row.hold, scope: row.scope,
    puzzlesTried: row.puzzles_tried, puzzlesSolved: row.puzzles_solved,
    chestsRight: row.chests_right, streak: row.streak, bestStreak: row.best_streak,
    campaign: row.campaign || 1
  };
}

// Saves the progress of whoever made this request.
function saveProgress(req, p) {
  if (!req.session.userId) {
    req.session.guest = p;
    return;
  }
  saveProgressFor(req.session.userId, p);
}

function saveProgressFor(userId, p) {
  db.prepare(`
    INSERT INTO progress (user_id, gold, hull, power, hold, scope,
                          puzzles_tried, puzzles_solved, chests_right, streak, best_streak, campaign)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      gold = excluded.gold, hull = excluded.hull, power = excluded.power,
      hold = excluded.hold, scope = excluded.scope,
      puzzles_tried = excluded.puzzles_tried, puzzles_solved = excluded.puzzles_solved,
      chests_right = excluded.chests_right, streak = excluded.streak,
      best_streak = excluded.best_streak, campaign = excluded.campaign
  `).run(userId, p.gold, p.hull, p.power, p.hold, p.scope,
    p.puzzlesTried, p.puzzlesSolved, p.chestsRight, p.streak, p.bestStreak, p.campaign || 1);
}

// The part of the progress the browser needs: gold, and each upgrade with its level and price.
function publicProgress(p) {
  const upgrades = {};
  for (const key in UPGRADES) {
    upgrades[key] = {
      name: UPGRADES[key].name,
      text: UPGRADES[key].text,
      level: p[key],
      cost: p[key] >= MAX_LEVEL ? null : upgradeCost(p[key])
    };
  }
  return { gold: p.gold, maxLevel: MAX_LEVEL, upgrades: upgrades };
}

module.exports = { UPGRADES, MAX_LEVEL, upgradeCost, emptyProgress, loadProgress, loadProgressFor, saveProgress, saveProgressFor, publicProgress };
