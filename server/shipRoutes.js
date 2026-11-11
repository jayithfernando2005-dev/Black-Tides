// shipRoutes.js - ship customisation: a name, a sail colour and a flag.
//   POST /api/profile/ship  { name, sail, flag }
// Only the choices below are accepted, so nothing odd can reach other players' screens.
const express = require("express");
const db = require("./db");
const requireLogin = require("./requireLogin");

const SAILS = ["white", "crimson", "black", "royal", "emerald", "gold"];
const FLAGS = ["skull", "swords", "anchor", "kraken", "star", "fish"];
const NAME_RULE = /^[A-Za-z0-9 '\-]{0,24}$/;

// The public look of a captain's ship (used by the profile and captain pages).
function shipInfo(user) {
  return {
    ship: {
      name: user.ship_name || "",
      sail: SAILS.includes(user.sail_colour) ? user.sail_colour : "white",
      flag: FLAGS.includes(user.flag) ? user.flag : "skull"
    }
  };
}

const router = express.Router();

router.post("/profile/ship", requireLogin, (req, res) => {
  const name = String(req.body.name || "").replace(/\s+/g, " ").trim();
  if (!NAME_RULE.test(name)) {
    return res.status(400).json({ error: "A ship's name can be up to 24 letters, numbers, spaces, ' or -." });
  }
  if (!SAILS.includes(req.body.sail) || !FLAGS.includes(req.body.flag)) {
    return res.status(400).json({ error: "Please choose one of the sail colours and flags." });
  }
  db.prepare("UPDATE users SET ship_name = ?, sail_colour = ?, flag = ? WHERE id = ?")
    .run(name || null, req.body.sail, req.body.flag, req.session.userId);
  res.json({ ship: { name: name, sail: req.body.sail, flag: req.body.flag } });
});

module.exports = { router, shipInfo, SAILS, FLAGS };
