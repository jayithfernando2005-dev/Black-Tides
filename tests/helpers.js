// helpers.js - shared set-up for the automated tests (run them with: npm test).
// Each test file starts the real game server on a spare port, with:
//   - a throwaway database in memory (the real blacktides.db is never touched),
//   - a pretend Fish API and a pretend weather service, so no internet is needed
//     and the tests always know the right answers.
const http = require("node:http");

// The answers the pretend Fish API gives. Tests can change them.
const fish = { count: 7, chests: 2, calls: 0 };
const weather = { code: 95, wind: 41, temperature: 28, calls: 0 };

function listen(server) {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));
}

// Starts the pretend services and the game. Returns { base, close }.
async function startGame() {
  const pretend = http.createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.url.startsWith("/fish")) {
      fish.calls += 1;
      res.end(JSON.stringify({ question: "https://example.com/puzzle" + fish.calls + ".png", fish: String(fish.count), chest: String(fish.chests) }));
    } else {
      weather.calls += 1;
      res.end(JSON.stringify({ current: { temperature_2m: weather.temperature, weather_code: weather.code, wind_speed_10m: weather.wind, is_day: 1 } }));
    }
  });
  const pretendPort = await listen(pretend);

  // These must be set before the game's files are loaded.
  process.env.BLACKTIDES_DB = ":memory:";
  process.env.LOG_REQUESTS = "0";                 // keep the test output clean
  process.env.FISH_API_URL = "http://127.0.0.1:" + pretendPort + "/fish";
  process.env.WEATHER_API_URL = "http://127.0.0.1:" + pretendPort + "/weather";

  const app = require("../server/app");
  const server = http.createServer(app);
  const port = await listen(server);
  return {
    base: "http://127.0.0.1:" + port,
    close() {
      server.closeAllConnections();
      server.close();
      pretend.close();
    }
  };
}

// A pretend browser for one captain: it remembers the login cookie between requests.
class Captain {
  constructor(base) {
    this.base = base;
    this.cookie = "";
  }

  async request(method, path, body) {
    const response = await fetch(this.base + path, {
      method: method,
      headers: { "Content-Type": "application/json", Cookie: this.cookie },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) this.cookie = setCookie.split(";")[0];
    let data = null;
    try { data = await response.json(); } catch (error) { data = null; }
    return { status: response.status, body: data };
  }

  get(path) { return this.request("GET", path); }
  post(path, body = {}) { return this.request("POST", path, body); }

  async register(username, password = "seacaptain1") {
    return this.post("/api/register", { username: username, password: password });
  }
}

let counter = 0;
// A fresh, unique captain name for each test.
function newName(prefix = "cap") {
  counter += 1;
  return (prefix + counter + "_" + Math.floor(Math.random() * 1000)).slice(0, 20);
}

module.exports = { startGame, Captain, newName, fish, weather };
