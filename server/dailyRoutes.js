// AI note: written with help from Claude (Anthropic), as allowed for this assignment.
// dailyRoutes.js - the web addresses for the Daily Challenge.
// The answers never leave the server, the clock is kept on the server, and each captain
// can finish the challenge only once a day.
const express = require("express");
const requireLogin = require("./requireLogin");
const daily = require("./daily");
const { loadProgress, saveProgress } = require("./progress");
const { publish } = require("./liveEvents");
const { recordQuestStats } = require("./quests");

const router = express.Router();

// What the browser may know about a captain's attempt (never the answers).
function describe(result) {
  if (!result) return { status: "new" };
  if (result.seconds === null) return { status: "started", wrong: result.wrong };
  return { status: "finished", seconds: result.seconds, wrong: result.wrong, chestRight: result.chest_right === 1 };
}

// GET /api/daily - today's date, today's board, and how this captain is doing.
// It does NOT include the picture, so nobody can look before their clock starts.
router.get("/daily", (req, res) => {
  const day = daily.today();
  const mine = req.session.userId ? daily.getResult(day, req.session.userId) : null;
  res.json({
    day: day,
    rules: { wrongPenalty: daily.WRONG_PENALTY, chestBonus: daily.CHEST_BONUS, gold: daily.DAILY_GOLD },
    me: req.session.userId ? describe(mine) : { status: "guest" },
    board: daily.getDailyBoard(day)
  });
});

// POST /api/daily/start - starts (or continues) the clock and sends the picture.
router.post("/daily/start", requireLogin, async (req, res) => {
  const day = daily.today();
  const before = daily.getResult(day, req.session.userId);
  if (before && before.seconds !== null) {
    return res.status(409).json({ error: "You have already finished today's challenge. Come back tomorrow!" });
  }
  try {
    const puzzle = await daily.getDailyPuzzle(day);
    const attempt = daily.startAttempt(day, req.session.userId);
    res.json({
      image: puzzle.image,
      wrong: attempt.wrong,
      elapsed: (Date.now() - attempt.started_at) / 1000   // the browser shows a matching clock
    });
  } catch (error) {
    console.error(error);
    res.status(502).json({ error: "The Fish API could not be reached for today's puzzle." });
  }
});

// POST /api/daily/answer - checks the counts; a right fish count finishes the challenge.
router.post("/daily/answer", requireLogin, (req, res) => {
  const day = daily.today();
  const attempt = daily.getResult(day, req.session.userId);
  if (!attempt) {
    return res.status(400).json({ error: "Open today's puzzle first." });
  }
  if (attempt.seconds !== null) {
    return res.status(409).json({ error: "You have already finished today's challenge." });
  }
  const puzzle = daily.getSavedPuzzle(day);
  if (!puzzle) {
    return res.status(400).json({ error: "Open today's puzzle first." });
  }

  if (Number(req.body.fish) !== puzzle.fish || String(req.body.fish).trim() === "") {
    const wrong = daily.addWrong(day, req.session.userId);
    return res.json({ correct: false, wrong: wrong, penalty: daily.WRONG_PENALTY });
  }

  const chestGiven = req.body.chest !== undefined && req.body.chest !== null && String(req.body.chest).trim() !== "";
  const chestRight = chestGiven && Number(req.body.chest) === puzzle.chest;
  const seconds = daily.finishAttempt(day, req.session.userId, chestRight);

  const progress = loadProgress(req);
  progress.gold += daily.DAILY_GOLD;
  saveProgress(req, progress);

  const rank = daily.getDailyRank(day, seconds);
  recordQuestStats(req.session.userId, { daily: 1 });          // daily quests
  publish("daily:solved", { username: req.session.username, seconds: seconds, rank: rank });
  res.json({
    correct: true,
    seconds: seconds,
    wrong: attempt.wrong,
    chestRight: chestRight,
    chests: puzzle.chest,
    rank: rank,
    gold: daily.DAILY_GOLD
  });
});

module.exports = router;
