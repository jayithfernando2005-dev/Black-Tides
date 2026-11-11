// daily.js - the Daily Challenge. The first time anyone asks on a new day, the server
// gets ONE puzzle from the Fish API and keeps it in the database. Every captain then
// counts the same picture that day, and the fastest correct answers make "Today's" board.
const db = require("./db");
const { getFishPuzzle } = require("./fishApi");

const WRONG_PENALTY = 10;      // seconds added for each wrong count
const CHEST_BONUS = 5;         // seconds taken off for also counting the chests right
const DAILY_GOLD = 30;         // gold for finishing the challenge (once a day)

// Today's date as "2026-11-10", in the server's own time zone.
function today() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());
}

let fetching = null;           // while the day's puzzle is being fetched, others wait for it

// Returns today's puzzle { day, image, fish, chest }, fetching it from the Fish API once.
async function getDailyPuzzle(day = today()) {
  const saved = db.prepare("SELECT * FROM daily_puzzles WHERE day = ?").get(day);
  if (saved) {
    return saved;
  }
  if (!fetching) {
    fetching = getFishPuzzle()
      .then((puzzle) => {
        db.prepare("INSERT OR IGNORE INTO daily_puzzles (day, image, fish, chest) VALUES (?, ?, ?, ?)")
          .run(day, puzzle.image, puzzle.fish, puzzle.chest);
      })
      .finally(() => { fetching = null; });
  }
  await fetching;
  return db.prepare("SELECT * FROM daily_puzzles WHERE day = ?").get(day);
}

// The puzzle already saved for that day, or null (never fetches).
function getSavedPuzzle(day) {
  return db.prepare("SELECT * FROM daily_puzzles WHERE day = ?").get(day) || null;
}

function getResult(day, userId) {
  return db.prepare("SELECT * FROM daily_results WHERE day = ? AND user_id = ?").get(day, userId) || null;
}

// The clock starts the first time a captain opens the puzzle and is kept in the
// database, so reloading the page or logging in again does not restart it.
function startAttempt(day, userId) {
  db.prepare("INSERT OR IGNORE INTO daily_results (day, user_id, started_at) VALUES (?, ?, ?)")
    .run(day, userId, Date.now());
  return getResult(day, userId);
}

function addWrong(day, userId) {
  db.prepare("UPDATE daily_results SET wrong = wrong + 1 WHERE day = ? AND user_id = ?").run(day, userId);
  return getResult(day, userId).wrong;
}

// Works out the final time and saves it. Returns the seconds.
function finishAttempt(day, userId, chestRight) {
  const row = getResult(day, userId);
  let seconds = (Date.now() - row.started_at) / 1000 + row.wrong * WRONG_PENALTY;
  if (chestRight) {
    seconds = Math.max(1, seconds - CHEST_BONUS);
  }
  seconds = Math.round(seconds * 10) / 10;
  db.prepare("UPDATE daily_results SET seconds = ?, chest_right = ? WHERE day = ? AND user_id = ?")
    .run(seconds, chestRight ? 1 : 0, day, userId);
  return seconds;
}

// The fastest captains today (only finished attempts).
function getDailyBoard(day, limit = 10) {
  return db.prepare(`
    SELECT users.username AS username, users.avatar AS avatar, users.avatar_updated AS avatarVersion,
           daily_results.seconds AS seconds, daily_results.wrong AS wrong, daily_results.chest_right AS chestRight
    FROM daily_results JOIN users ON users.id = daily_results.user_id
    WHERE daily_results.day = ? AND daily_results.seconds IS NOT NULL
    ORDER BY daily_results.seconds ASC, daily_results.started_at ASC
    LIMIT ?
  `).all(day, limit).map((row) => ({ ...row, chestRight: row.chestRight === 1 }));
}

// 1 = fastest today.
function getDailyRank(day, seconds) {
  const faster = db.prepare("SELECT COUNT(*) AS count FROM daily_results WHERE day = ? AND seconds IS NOT NULL AND seconds < ?")
    .get(day, seconds);
  return faster.count + 1;
}

module.exports = {
  WRONG_PENALTY, CHEST_BONUS, DAILY_GOLD,
  today, getDailyPuzzle, getSavedPuzzle, getResult, startAttempt, addWrong, finishAttempt, getDailyBoard, getDailyRank
};
