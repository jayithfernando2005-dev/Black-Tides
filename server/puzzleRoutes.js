// puzzleRoutes.js - the web addresses the game calls for sonar puzzles.
const express = require("express");
const { recordQuestStats } = require("./quests");
const { getFishPuzzle } = require("./fishApi");
const { loadProgress, saveProgress } = require("./progress");

const router = express.Router();

// GET /api/puzzle - the game asks for a new sonar puzzle.
router.get("/puzzle", async (req, res) => {
  try {
    const puzzle = await getFishPuzzle();

    // Keep the two answers on the server, inside this player's session.
    req.session.puzzle = { fish: puzzle.fish, chest: puzzle.chest };

    // Send the browser only the picture, never the answers.
    res.json({ image: puzzle.image });
  } catch (error) {
    console.error(error);
    res.status(502).json({ error: "The Fish API could not be reached." });
  }
});

// POST /api/puzzle/answer - the game sends the player's counts to be checked.
router.post("/puzzle/answer", (req, res) => {
  const puzzle = req.session.puzzle;
  if (!puzzle) {
    return res.status(400).json({ error: "No sonar puzzle is open." });
  }

  const fishCorrect = Number(req.body.fish) === puzzle.fish;

  // The chest count is optional, and only checked when the fish count is right.
  // null means the player skipped the chest gamble.
  let chestCorrect = null;
  const chestGiven = req.body.chest !== undefined && req.body.chest !== null && req.body.chest !== "";
  if (fishCorrect && chestGiven) {
    chestCorrect = Number(req.body.chest) === puzzle.chest;
  }

  // Keep the sonar record on the server, where the player cannot change it.
  const progress = loadProgress(req);
  progress.puzzlesTried += 1;
  if (fishCorrect) {
    progress.puzzlesSolved += 1;
    if (req.session.userId) recordQuestStats(req.session.userId, { puzzles: 1 });   // daily quests
    progress.streak += 1;
    progress.bestStreak = Math.max(progress.bestStreak, progress.streak);
  } else {
    progress.streak = 0;
  }
  if (chestCorrect === true) {
    progress.chestsRight += 1;
  }
  saveProgress(req, progress);

  const result = { fishCorrect: fishCorrect, chestCorrect: chestCorrect };
  if (fishCorrect) {
    result.chests = puzzle.chest;      // reveal the real chest count afterwards
    delete req.session.puzzle;         // each puzzle can only be used once
  }
  res.json(result);
});

module.exports = router;
