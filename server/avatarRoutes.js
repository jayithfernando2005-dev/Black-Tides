// avatarRoutes.js - the captain's portrait. A captain can pick one of 12 ready-made
// portraits or upload a small picture. Uploaded pictures are checked carefully:
// only real JPEG, PNG or WebP files, at most 70 KB, and only for the logged-in captain.
const express = require("express");
const db = require("./db");
const requireLogin = require("./requireLogin");
const { findUserByName } = require("./users");

const router = express.Router();

const PRESETS = 12;                     // portraits preset:0 to preset:11
const MAX_BYTES = 70 * 1024;            // the browser shrinks pictures to 256 x 256 first

// The first bytes of each allowed picture type ("magic numbers").
// Checking them stops someone uploading another kind of file with a picture's name.
const SIGNATURES = [
  { type: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: "image/png", test: (b) => b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { type: "image/webp", test: (b) => b.slice(0, 4).toString("ascii") === "RIFF" && b.slice(8, 12).toString("ascii") === "WEBP" }
];

// What a captain's portrait is, for the profile and the leaderboard.
function avatarInfo(user) {
  if (!user || !user.avatar) return { avatar: null, avatarVersion: 0 };
  return { avatar: user.avatar, avatarVersion: user.avatar_updated };
}

function save(userId, avatar, image, type) {
  db.prepare("UPDATE users SET avatar = ?, avatar_image = ?, avatar_type = ?, avatar_updated = ? WHERE id = ?")
    .run(avatar, image, type, Date.now(), userId);
}

// POST /api/profile/avatar - { preset: 0-11 } or { image: "data:image/jpeg;base64,..." } or { reset: true }
router.post("/profile/avatar", requireLogin, (req, res) => {
  const userId = req.session.userId;

  if (req.body.reset === true) {
    save(userId, null, null, null);
    return res.json({ avatar: null, avatarVersion: Date.now() });
  }

  if (req.body.preset !== undefined) {
    const preset = Number(req.body.preset);
    if (!Number.isInteger(preset) || preset < 0 || preset >= PRESETS) {
      return res.status(400).json({ error: "There is no portrait like that." });
    }
    save(userId, "preset:" + preset, null, null);
    return res.json({ avatar: "preset:" + preset, avatarVersion: Date.now() });
  }

  const dataUrl = String(req.body.image || "");
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) {
    return res.status(400).json({ error: "Please choose a JPEG, PNG or WebP picture." });
  }
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0 || bytes.length > MAX_BYTES) {
    return res.status(400).json({ error: "That picture is too big. Please choose a smaller one." });
  }
  const kind = SIGNATURES.find((s) => s.test(bytes));
  if (!kind) {
    return res.status(400).json({ error: "That file is not a real picture." });
  }
  save(userId, "custom", bytes, kind.type);
  res.json({ avatar: "custom", avatarVersion: Date.now() });
});

// GET /api/avatar/:username - an uploaded portrait picture (404 if the captain has none).
router.get("/avatar/:username", (req, res) => {
  const user = findUserByName(String(req.params.username));
  if (!user || user.avatar !== "custom" || !user.avatar_image) {
    return res.status(404).json({ error: "No uploaded portrait." });
  }
  res.set("Content-Type", user.avatar_type);
  res.set("X-Content-Type-Options", "nosniff");        // the browser must treat it only as a picture
  res.set("Cache-Control", "public, max-age=86400");    // the ?v= number changes when the picture does
  res.send(Buffer.from(user.avatar_image));
});

module.exports = { router, avatarInfo };
