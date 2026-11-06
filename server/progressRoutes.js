// progressRoutes.js - gold and the Shipyard. Works for captains and guests.
const express = require("express");
const { UPGRADES, MAX_LEVEL, upgradeCost, loadProgress, saveProgress, publicProgress } = require("./progress");

const router = express.Router();

const MAX_GOLD_PER_DEPOSIT = 2000;      // more than this in one go is not possible in a battle

// GET /api/progress - gold, upgrade levels and prices.
router.get("/progress", (req, res) => {
  res.json(publicProgress(loadProgress(req)));
});

// POST /api/progress/gold - add the gold earned in battle.
router.post("/progress/gold", (req, res) => {
  const earned = Number(req.body.earned);
  if (!Number.isInteger(earned) || earned < 0 || earned > MAX_GOLD_PER_DEPOSIT) {
    return res.status(400).json({ error: "That amount of gold does not look right." });
  }
  const progress = loadProgress(req);
  progress.gold += earned;
  saveProgress(req, progress);
  res.json(publicProgress(progress));
});

// POST /api/shipyard/buy - buy one level of an upgrade.
// The server checks the price and the gold, so the browser cannot get upgrades for free.
router.post("/shipyard/buy", (req, res) => {
  const key = String(req.body.upgrade || "");
  if (!UPGRADES[key]) {
    return res.status(400).json({ error: "There is no upgrade called that." });
  }
  const progress = loadProgress(req);
  if (progress[key] >= MAX_LEVEL) {
    return res.status(400).json({ error: UPGRADES[key].name + " is already at the top level." });
  }
  const cost = upgradeCost(progress[key]);
  if (progress.gold < cost) {
    return res.status(400).json({ error: "Not enough gold for " + UPGRADES[key].name + "." });
  }
  progress.gold -= cost;
  progress[key] += 1;
  saveProgress(req, progress);
  res.json(publicProgress(progress));
});

module.exports = router;
