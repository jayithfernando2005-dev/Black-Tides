// AI note: written with help from Claude (Anthropic), as allowed for this assignment.
// campaignRoutes.js - the Naval Campaign. The server decides which stages a captain
// may play and when a stage counts as won, so the browser cannot skip ahead.
const express = require("express");
const { publish } = require("./liveEvents");
const { STAGES, SECONDS_PER_WAVE, getStage, rewardFor } = require("./campaign");
const { loadProgress, saveProgress } = require("./progress");

const router = express.Router();

// GET /api/campaign - every stage, and how far this captain (or guest) has got.
router.get("/campaign", (req, res) => {
  const progress = loadProgress(req);
  res.json({ unlocked: progress.campaign, total: STAGES.length, stages: STAGES });
});

// POST /api/campaign/start - a stage battle begins. Only unlocked stages may be played.
router.post("/campaign/start", (req, res) => {
  const stage = getStage(Number(req.body.stage));
  if (!stage) {
    return res.status(400).json({ error: "There is no stage like that." });
  }
  const progress = loadProgress(req);
  if (stage.id > progress.campaign) {
    return res.status(403).json({ error: "That stage is still locked. Win stage " + progress.campaign + " first." });
  }
  // Remember on the server which stage is being played, and when it started.
  req.session.campaignRun = { stage: stage.id, started: Date.now() };
  res.json({ stage: stage });
});

// POST /api/campaign/complete - the stage goal was reached.
router.post("/campaign/complete", (req, res) => {
  const run = req.session.campaignRun;
  const id = Number(req.body.stage);
  if (!run || run.stage !== id) {
    return res.status(400).json({ error: "That stage was not started." });
  }
  const stage = getStage(id);
  const seconds = (Date.now() - run.started) / 1000;
  if (seconds < stage.waves * SECONDS_PER_WAVE) {
    return res.status(400).json({ error: "That victory came too fast to be real." });
  }
  delete req.session.campaignRun;               // each stage run can only be won once

  const progress = loadProgress(req);
  const firstClear = id === progress.campaign;
  if (firstClear && progress.campaign <= STAGES.length) {
    progress.campaign += 1;                     // the next stage is unlocked
  }
  const reward = rewardFor(stage, firstClear);
  progress.gold += reward;
  saveProgress(req, progress);

  if (firstClear) {
    publish("stage:cleared", { username: req.session.username, stage: stage.id, stageName: stage.name });
  }

  const next = getStage(id + 1);
  res.json({
    firstClear: firstClear,
    reward: reward,
    gold: progress.gold,
    unlocked: progress.campaign,
    nextStage: next && next.id <= progress.campaign ? next : null,
    campaignWon: progress.campaign > STAGES.length
  });
});

module.exports = router;
