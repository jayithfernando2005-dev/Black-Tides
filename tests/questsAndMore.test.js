// AI note: written with help from Claude (Anthropic), as allowed for this assignment.
// questsAndMore.test.js - daily quests, ship customisation, the weekly tournament and statistics.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startGame, Captain, newName, fish } = require("./helpers");

let game;
before(async () => { game = await startGame(); });
after(() => game.close());

async function newCaptain() {
  const captain = new Captain(game.base);
  const name = newName("cap");
  await captain.register(name);
  return { captain, name };
}

test("every captain gets the same three quests today", async () => {
  const a = await newCaptain();
  const b = await newCaptain();
  const qa = (await a.captain.get("/api/quests")).body.quests.map((q) => q.key);
  const qb = (await b.captain.get("/api/quests")).body.quests.map((q) => q.key);
  assert.equal(qa.length, 3);
  assert.deepEqual(qa, qb);
  assert.equal(new Set(qa).size, 3);
});

test("the quest choice is the same for a date and changes between days", () => {
  const { questsFor } = require("../server/quests");
  assert.deepEqual(questsFor("2026-11-10").map((q) => q.key), questsFor("2026-11-10").map((q) => q.key));
  const days = new Set();
  for (let d = 1; d <= 10; d++) days.add(questsFor("2026-12-" + String(d).padStart(2, "0")).map((q) => q.key).join());
  assert.ok(days.size > 1);
});

test("battles move quests on, and a finished quest pays once", async () => {
  const { captain } = await newCaptain();
  // a huge battle finishes almost any battle quest
  const big = { score: 9000, wave: 9, sunk: 40, bosses: 2, goldEarned: 0, bestCombo: 9,
    questStats: { cutters: 20, ironclads: 5, escorts: 2, specialsUsed: 6 } };
  const saved = await captain.post("/api/scores", big);
  assert.equal(saved.status, 200);
  const quests = (await captain.get("/api/quests")).body.quests;
  const done = quests.filter((q) => q.done);
  for (const q of done) assert.ok(saved.body.questsCompleted.includes(q.text));
  if (done.length > 0) {
    const goldBefore = (await captain.get("/api/progress")).body.gold;
    const claim = await captain.post("/api/quests/" + done[0].key + "/claim");
    assert.equal(claim.status, 200);
    assert.equal((await captain.get("/api/progress")).body.gold, goldBefore + done[0].gold);
    assert.equal((await captain.post("/api/quests/" + done[0].key + "/claim")).status, 400);    // only once
  }
  const unfinished = quests.find((q) => !q.done);
  if (unfinished) assert.equal((await captain.post("/api/quests/" + unfinished.key + "/claim")).status, 400);
});

test("solving a sonar puzzle counts for a puzzle quest", () => {
  const { recordQuestStats, questsFor } = require("../server/quests");
  const db = require("../server/db");
  const id = db.prepare("SELECT id FROM users LIMIT 1").get().id;
  const hasPuzzleQuest = questsFor().some((q) => q.stat === "puzzles");
  const finished = recordQuestStats(id, { puzzles: 5 });
  assert.equal(finished.length > 0, hasPuzzleQuest);
  void fish;
});

test("silly quest numbers are ignored and bad scores refused", async () => {
  const { captain } = await newCaptain();
  const reply = await captain.post("/api/scores", { score: 10, wave: 1, sunk: 0, bosses: 0, goldEarned: 0, questStats: { cutters: -5, escorts: "lots" } });
  assert.equal(reply.status, 200);
  assert.equal((await captain.post("/api/scores", { score: 10, wave: 1, sunk: 0, bosses: 0, goldEarned: 0, stage: 42 })).status, 400);
});

test("ship customisation is saved and shown on the captain page", async () => {
  const { captain, name } = await newCaptain();
  assert.equal((await captain.post("/api/profile/ship", { name: "Sea Serpent", sail: "crimson", flag: "kraken" })).status, 200);
  const page = await captain.get("/api/captains/" + name);
  assert.deepEqual(page.body.ship, { name: "Sea Serpent", sail: "crimson", flag: "kraken" });
  assert.equal((await captain.post("/api/profile/ship", { name: "<script>", sail: "crimson", flag: "kraken" })).status, 400);
  assert.equal((await captain.post("/api/profile/ship", { name: "Ok", sail: "purple", flag: "kraken" })).status, 400);
  assert.equal((await new Captain(game.base).post("/api/profile/ship", { name: "x", sail: "white", flag: "skull" })).status, 401);
});

test("the weekly tournament crowns last week's best captain", async () => {
  const db = require("../server/db");
  const weekly = require("../server/weekly");
  const { captain, name } = await newCaptain();
  const id = db.prepare("SELECT id FROM users WHERE username = ?").get(name).id;
  // a battle from last week, put straight into the database
  const lastWeek = weekly.weekStart();
  lastWeek.setDate(lastWeek.getDate() - 3);
  db.prepare("INSERT INTO scores (user_id, score, wave, played_at) VALUES (?, ?, ?, ?)").run(id, 999999, 20, lastWeek.toISOString());
  const t = await captain.get("/api/tournament");
  assert.equal(t.status, 200);
  assert.match(t.body.week, /^\d{4}-W\d{2}$/);
  assert.ok(t.body.endsIn > 0 && t.body.endsIn <= 7 * 86400);
  assert.equal(t.body.lastChampion.username, name);
  const page = await captain.get("/api/captains/" + name);
  assert.equal(page.body.weeksWon.length, 1);
  // last week's battle is not on this week's board
  const board = (await captain.get("/api/leaderboard?period=week")).body;
  assert.ok(!board.some((row) => row.bestScore === 999999));
});

test("statistics add up", async () => {
  const { captain } = await newCaptain();
  for (const score of [100, 300, 500]) {
    await captain.post("/api/scores", { score: score, wave: 2, sunk: 2, bosses: 0, goldEarned: 0, stage: 0, difficulty: "hard" });
  }
  const s = (await captain.get("/api/stats")).body;
  assert.equal(s.totals.games, 3);
  assert.equal(s.totals.averageScore, 300);
  assert.deepEqual(s.recent.map((r) => r.score), [100, 300, 500]);
  assert.equal(s.perDay.length, 14);
  assert.equal(s.perDay[13].battles, 3);
  assert.equal(s.byDifficulty[0].difficulty, "hard");
  assert.equal((await new Captain(game.base).get("/api/stats")).status, 401);
});
