// The real password is never stored anywhere.
const crypto = require("node:crypto");
const { promisify } = require("node:util");

const scrypt = promisify(crypto.scrypt);   // a slow hashing method, built into Node.js
const KEY_LENGTH = 64;

// Makes a hash of the password, using a new random "salt" for every captain.
// The salt means two captains with the same password still get different hashes.
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, KEY_LENGTH);
  return { hash: hash.toString("hex"), salt: salt };
}

// Hashes the typed password with the same salt and compares the two hashes.
async function checkPassword(password, salt, storedHash) {
  const hash = await scrypt(password, salt, KEY_LENGTH);
  const stored = Buffer.from(storedHash, "hex");
  // timingSafeEqual takes the same time whether the hashes match or not,
  // so an attacker cannot learn anything from how long the check takes.
  return stored.length === hash.length && crypto.timingSafeEqual(hash, stored);
}

module.exports = { hashPassword, checkPassword };
