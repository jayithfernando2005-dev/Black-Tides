// authRoutes.js - register, log in, log out, "who am I?" and "stay logged in".
const express = require("express");
const { createUser, findUserByName, findUserById } = require("./users");
const { hashPassword, checkPassword } = require("./passwords");
const requireLogin = require("./requireLogin");

const router = express.Router();

const USERNAME_RULE = /^[A-Za-z0-9_]{3,20}$/;   // 3 to 20 letters, numbers or _
const MIN_PASSWORD_LENGTH = 8;
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;    // in milliseconds

// Gives the captain a brand-new session after they log in or register.
// A new session id stops anyone reusing an old one ("session fixation").
function startSession(req, user, remember) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) {
        return reject(error);
      }
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.remember = remember === true;
      // Remembered: the cookie lasts 30 days. Otherwise it ends when the browser closes.
      req.session.cookie.maxAge = remember === true ? THIRTY_DAYS : null;
      resolve();
    });
  });
}

// POST /api/register - create a new captain account.
router.post("/register", async (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");

  if (!USERNAME_RULE.test(username)) {
    return res.status(400).json({ error: "Username must be 3 to 20 letters, numbers or _." });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }
  if (findUserByName(username)) {
    return res.status(409).json({ error: "That username is already taken." });
  }

  try {
    const { hash, salt } = await hashPassword(password);
    const id = createUser(username, hash, salt);
    await startSession(req, { id: id, username: username }, req.body.remember);
    res.json({ username: username });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not create the account." });
  }
});

// POST /api/login - check the username and password, then start a session.
router.post("/login", async (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");

  try {
    const user = findUserByName(username);
    const passwordOk = user && await checkPassword(password, user.salt, user.password_hash);

    // The same message for a wrong name or a wrong password, so attackers learn nothing.
    if (!passwordOk) {
      return res.status(401).json({ error: "Wrong username or password." });
    }

    await startSession(req, user, req.body.remember);
    res.json({ username: user.username });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not log in." });
  }
});

// POST /api/logout - end the session and remove the cookie.
router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

// GET /api/me - who is logged in (or null for nobody), and since when.
router.get("/me", (req, res) => {
  if (!req.session.userId) {
    return res.json({ username: null });
  }
  const user = findUserById(req.session.userId);
  res.json({
    username: req.session.username,
    memberSince: user ? user.created_at : null,
    remember: req.session.remember === true
  });
});

// POST /api/remember - turn "stay logged in" on or off for this browser.
// A fresh session is started, so the browser receives a cookie with the new lifetime.
router.post("/remember", requireLogin, async (req, res) => {
  try {
    const user = findUserById(req.session.userId);
    await startSession(req, user, req.body.remember);
    res.json({ remember: req.session.remember });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not change the setting." });
  }
});

module.exports = router;
