// Black Tides - the server. It sends the game to the browser and answers the
// game's requests: accounts, sonar puzzles, gold, the Shipyard, scores, the Daily
// Challenge, live sea news and the weather. The routes themselves are in server/app.js.
const app = require("./server/app");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Black Tides is running at http://localhost:" + PORT);
});
