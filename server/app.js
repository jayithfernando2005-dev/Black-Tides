// AI note: written with help from Claude (Anthropic), as allowed for this assignment.
// app.js - builds the Black Tides web application (all the routes), without starting it.
// server.js starts it on port 3000; the automated tests start it on a spare port.
const express = require("express");
const session = require("express-session");
const authRoutes = require("./authRoutes");
const puzzleRoutes = require("./puzzleRoutes");
const progressRoutes = require("./progressRoutes");
const scoreRoutes = require("./scoreRoutes");
const campaignRoutes = require("./campaignRoutes");
const avatarRoutes = require("./avatarRoutes").router;
const dailyRoutes = require("./dailyRoutes");
const liveRoutes = require("./liveEvents").router;
const weatherRoutes = require("./weatherRoutes");
const captainRoutes = require("./captainRoutes").router;
const adminRoutes = require("./adminRoutes");
const saveRoutes = require("./saveRoutes");
const questRoutes = require("./questRoutes");
const shipRoutes = require("./shipRoutes").router;
const statsRoutes = require("./statsRoutes");

const app = express();

// Read JSON that the browser sends to us.
app.use(express.json());

// Give each player a session, remembered with a cookie.
// The secret signs the cookie so it cannot be faked. It can be set from outside
// the code with the SESSION_SECRET environment variable.
app.use(session({
  secret: process.env.SESSION_SECRET || "black-tides-development-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,                    // page scripts cannot read the cookie
    sameSite: "lax"                    // other websites cannot send it for us
  }
}));

// Send any file inside the "public" folder to the browser.
app.use(express.static("public"));

// Every address starting with /api is handled by our own routes.
app.use("/api", authRoutes);
app.use("/api", puzzleRoutes);
app.use("/api", progressRoutes);
app.use("/api", scoreRoutes);
app.use("/api", campaignRoutes);
app.use("/api", avatarRoutes);
app.use("/api", dailyRoutes);
app.use("/api", liveRoutes);
app.use("/api", weatherRoutes);
app.use("/api", captainRoutes);
app.use("/api", adminRoutes);
app.use("/api", saveRoutes);
app.use("/api", questRoutes);
app.use("/api", shipRoutes);
app.use("/api", statsRoutes);

module.exports = app;
