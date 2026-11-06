// Black Tides - the server. It sends the game to the browser and answers the
// game's requests: accounts, sonar puzzles, gold, the Shipyard and scores.
const express = require("express");
const session = require("express-session");
const authRoutes = require("./server/authRoutes");
const puzzleRoutes = require("./server/puzzleRoutes");
const progressRoutes = require("./server/progressRoutes");
const scoreRoutes = require("./server/scoreRoutes");
const campaignRoutes = require("./server/campaignRoutes");
const avatarRoutes = require("./server/avatarRoutes").router;

const app = express();
const PORT = 3000;

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

app.listen(PORT, () => {
  console.log("Black Tides is running at http://localhost:" + PORT);
});
