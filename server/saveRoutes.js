// AI note: written with help from Claude (Anthropic), as allowed for this assignment.
// saveRoutes.js - save files. A captain can download their progress (gold, ship upgrades,
// campaign and sonar record) as a JSON file, and load it again later, for example after
// moving the game to a new computer with a fresh database.
//
// The file is signed with an HMAC (a secret-keyed fingerprint). If anyone edits the file,
// for example to give themselves more gold, the fingerprint no longer matches and the
// server refuses it. Scores are not in the file, so the leaderboard stays honest.
const express = require("express");
const crypto = require("node:crypto");
const { loadProgress, saveProgress, publicProgress, MAX_LEVEL } = require("./progress");

const router = express.Router();
const FORMAT = "black-tides-save";
const VERSION = 1;

function secret() {
  return process.env.SAVE_SECRET || process.env.SESSION_SECRET || "black-tides-development-secret";
}

// The signed part, always in the same order so the fingerprint is repeatable.
function signedText(save) {
  return JSON.stringify([save.format, save.version, save.captain, save.exportedAt, save.progress]);
}

function sign(save) {
  return crypto.createHmac("sha256", secret()).update(signedText(save)).digest("hex");
}

// GET /api/save - download a save file.
router.get("/save", (req, res) => {
  const p = loadProgress(req);
  const save = {
    format: FORMAT,
    version: VERSION,
    game: "Black Tides",
    captain: req.session.username || null,          // null = a guest's save
    exportedAt: new Date().toISOString(),
    progress: {
      gold: p.gold,
      upgrades: { hull: p.hull, power: p.power, hold: p.hold, scope: p.scope },
      campaign: p.campaign,
      sonar: { tried: p.puzzlesTried, solved: p.puzzlesSolved, chestsRight: p.chestsRight, bestStreak: p.bestStreak }
    }
  };
  save.signature = sign(save);
  const day = save.exportedAt.slice(0, 10);
  res.set("Content-Disposition", "attachment; filename=\"black-tides-" + (save.captain || "guest") + "-" + day + ".json\"");
  res.json(save);
});

const whole = (value, max) => Number.isInteger(value) && value >= 0 && value <= max;

// Checks the file is a real, unedited Black Tides save. Returns an error message or null.
function checkSave(save) {
  if (!save || typeof save !== "object" || save.format !== FORMAT) return "That is not a Black Tides save file.";
  if (save.version !== VERSION) return "That save file is from a different version of the game.";
  const p = save.progress;
  if (!p || typeof p !== "object" || !p.upgrades || !p.sonar) return "That save file is damaged.";
  const ok = whole(p.gold, 10000000) && whole(p.campaign, 10) && p.campaign >= 1 &&
    ["hull", "power", "hold", "scope"].every((key) => whole(p.upgrades[key], MAX_LEVEL)) &&
    whole(p.sonar.tried, 1000000) && whole(p.sonar.solved, 1000000) && whole(p.sonar.chestsRight, 1000000) && whole(p.sonar.bestStreak, 1000000);
  if (!ok) return "That save file is damaged.";
  const expected = Buffer.from(sign(save), "hex");
  const given = Buffer.from(String(save.signature || ""), "hex");
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return "That save file has been changed, so it cannot be loaded.";
  }
  return null;
}

// POST /api/save/import - { save } loads a save file into this captain's (or guest's) game.
router.post("/save/import", (req, res) => {
  const save = req.body.save;
  const problem = checkSave(save);
  if (problem) {
    return res.status(400).json({ error: problem });
  }
  // A captain's save only loads into the same captain. A guest's save can be loaded anywhere,
  // so a guest can keep their progress after creating an account.
  const me = req.session.username || null;
  if (save.captain !== null && (me === null || save.captain.toLowerCase() !== me.toLowerCase())) {
    return res.status(403).json({ error: "This save belongs to Captain " + save.captain + ". Log in as that captain to load it." });
  }
  const current = loadProgress(req);
  const p = save.progress;
  const loaded = {
    ...current,
    gold: p.gold, hull: p.upgrades.hull, power: p.upgrades.power, hold: p.upgrades.hold, scope: p.upgrades.scope,
    campaign: p.campaign,
    puzzlesTried: p.sonar.tried, puzzlesSolved: p.sonar.solved, chestsRight: p.sonar.chestsRight, bestStreak: p.sonar.bestStreak
  };
  saveProgress(req, loaded);
  res.json({ loaded: true, from: save.exportedAt, progress: publicProgress(loaded), campaign: loaded.campaign });
});

module.exports = router;
