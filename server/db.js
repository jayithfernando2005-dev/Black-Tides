// db.js - opens the game's own database and makes sure every table exists.
// It is one file, blacktides.db, next to server.js. SQLite is built into Node.js.
const { DatabaseSync } = require("node:sqlite");

// The automated tests set BLACKTIDES_DB to ":memory:" so they never touch the real database.
const db = new DatabaseSync(process.env.BLACKTIDES_DB || "blacktides.db");

// Captains: one row per account. Passwords are stored as hashes, never as text.
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    salt          TEXT NOT NULL,
    created_at    TEXT NOT NULL
  )
`);

// Scores: one row for every battle a captain finishes.
db.exec(`
  CREATE TABLE IF NOT EXISTS scores (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id   INTEGER NOT NULL REFERENCES users(id),
    score     INTEGER NOT NULL,
    wave      INTEGER NOT NULL,
    played_at TEXT NOT NULL
  )
`);

// Progress: each captain's gold, ship upgrades and sonar record.
db.exec(`
  CREATE TABLE IF NOT EXISTS progress (
    user_id        INTEGER PRIMARY KEY REFERENCES users(id),
    gold           INTEGER NOT NULL DEFAULT 0,
    hull           INTEGER NOT NULL DEFAULT 0,
    power          INTEGER NOT NULL DEFAULT 0,
    hold           INTEGER NOT NULL DEFAULT 0,
    scope          INTEGER NOT NULL DEFAULT 0,
    puzzles_tried  INTEGER NOT NULL DEFAULT 0,
    puzzles_solved INTEGER NOT NULL DEFAULT 0,
    chests_right   INTEGER NOT NULL DEFAULT 0,
    streak         INTEGER NOT NULL DEFAULT 0,
    best_streak    INTEGER NOT NULL DEFAULT 0
  )
`);

// Adds a column to a database made by an older version of the game,
// so an existing blacktides.db keeps working after an update.
function addColumnIfMissing(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((info) => info.name);
  if (!columns.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

addColumnIfMissing("scores", "sunk", "INTEGER NOT NULL DEFAULT 0");
addColumnIfMissing("scores", "bosses", "INTEGER NOT NULL DEFAULT 0");
addColumnIfMissing("scores", "gold_earned", "INTEGER NOT NULL DEFAULT 0");
addColumnIfMissing("scores", "under_fire", "INTEGER NOT NULL DEFAULT 0");
addColumnIfMissing("scores", "untouched", "INTEGER NOT NULL DEFAULT 0");
// Added later: which stage (0 = Endless voyage), the difficulty, and the best combo.
addColumnIfMissing("scores", "stage", "INTEGER NOT NULL DEFAULT 0");
addColumnIfMissing("scores", "difficulty", "TEXT NOT NULL DEFAULT 'normal'");
addColumnIfMissing("scores", "best_combo", "INTEGER NOT NULL DEFAULT 0");
// The campaign: the highest stage a captain may play (1 = only the first stage).
addColumnIfMissing("progress", "campaign", "INTEGER NOT NULL DEFAULT 1");
// The captain's portrait: NULL (made from the name), "preset:3", or an uploaded picture.
addColumnIfMissing("users", "avatar", "TEXT");
addColumnIfMissing("users", "avatar_image", "BLOB");
addColumnIfMissing("users", "avatar_type", "TEXT");
addColumnIfMissing("users", "avatar_updated", "INTEGER NOT NULL DEFAULT 0");

// The Daily Challenge: one Fish API puzzle per day, the same for every captain.
db.exec(`
  CREATE TABLE IF NOT EXISTS daily_puzzles (
    day   TEXT PRIMARY KEY,
    image TEXT NOT NULL,
    fish  INTEGER NOT NULL,
    chest INTEGER NOT NULL
  )
`);
// One row per captain per day: when they opened the puzzle and how long it took.
db.exec(`
  CREATE TABLE IF NOT EXISTS daily_results (
    day         TEXT NOT NULL,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    started_at  INTEGER NOT NULL,
    wrong       INTEGER NOT NULL DEFAULT 0,
    chest_right INTEGER NOT NULL DEFAULT 0,
    seconds     REAL,
    PRIMARY KEY (day, user_id)
  )
`);

// Daily quests: how far each captain has got with each of today's quests.
db.exec(`
  CREATE TABLE IF NOT EXISTS quest_progress (
    day       TEXT NOT NULL,
    user_id   INTEGER NOT NULL REFERENCES users(id),
    quest_key TEXT NOT NULL,
    progress  INTEGER NOT NULL DEFAULT 0,
    claimed   INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (day, user_id, quest_key)
  )
`);

// Weekly tournament winners, worked out once each week has ended.
db.exec(`
  CREATE TABLE IF NOT EXISTS weekly_winners (
    week    TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    score   INTEGER NOT NULL
  )
`);

// Ship customisation: name, sail colour and flag.
addColumnIfMissing("users", "ship_name", "TEXT");
addColumnIfMissing("users", "sail_colour", "TEXT NOT NULL DEFAULT 'white'");
addColumnIfMissing("users", "flag", "TEXT NOT NULL DEFAULT 'skull'");

// Rivals: captains a player has chosen to keep an eye on.
db.exec(`
  CREATE TABLE IF NOT EXISTS rivals (
    user_id  INTEGER NOT NULL REFERENCES users(id),
    rival_id INTEGER NOT NULL REFERENCES users(id),
    added_at TEXT NOT NULL,
    PRIMARY KEY (user_id, rival_id)
  )
`);
// Roles: "captain" for everyone, "admin" for the people who look after the game
// (made with: npm run make-admin -- <username>).
addColumnIfMissing("users", "role", "TEXT NOT NULL DEFAULT 'captain'");

module.exports = db;
