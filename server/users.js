// users.js - saving and finding captain accounts in the database.
const db = require("./db");

// Saves a new captain and returns their id number.
// The ? marks are filled in safely by SQLite, which stops SQL injection.
function createUser(username, passwordHash, salt) {
  const result = db
    .prepare("INSERT INTO users (username, password_hash, salt, created_at) VALUES (?, ?, ?, ?)")
    .run(username, passwordHash, salt, new Date().toISOString());
  return Number(result.lastInsertRowid);
}

// Finds a captain by username. Returns undefined if there is none.
function findUserByName(username) {
  return db.prepare("SELECT * FROM users WHERE username = ?").get(username);
}

// Finds a captain by id number.
function findUserById(id) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id);
}

module.exports = { createUser, findUserByName, findUserById };
