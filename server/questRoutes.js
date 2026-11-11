// questRoutes.js - GET /api/quests (today's three quests) and POST /api/quests/:key/claim.
const express = require("express");
const requireLogin = require("./requireLogin");
const { listQuests, claimQuest } = require("./quests");
const { loadProgress, saveProgress, publicProgress } = require("./progress");

const router = express.Router();

// Seconds until midnight (server time), when new quests arrive.
function secondsToMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return Math.round((midnight - now) / 1000);
}

router.get("/quests", requireLogin, (req, res) => {
  res.json({ quests: listQuests(req.session.userId), resetsIn: secondsToMidnight() });
});

router.post("/quests/:key/claim", requireLogin, (req, res) => {
  const result = claimQuest(req.session.userId, String(req.params.key));
  if (result.error) {
    return res.status(400).json({ error: result.error });
  }
  const progress = loadProgress(req);
  progress.gold += result.gold;
  saveProgress(req, progress);
  res.json({ gold: result.gold, progress: publicProgress(progress) });
});

module.exports = router;
