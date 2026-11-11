// captains.test.js - ranks, public captain pages and rivals.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startGame, Captain, newName } = require("./helpers");

let game;
before(async () => { game = await startGame(); });
after(() => game.close());

async function captainWithScore(score) {
  const captain = new Captain(game.base);
  const name = newName("cap");
  await captain.register(name);
  if (score > 0) await captain.post("/api/scores", { score: score, wave: 3, sunk: 4, bosses: 0, goldEarned: 20 });
  return { captain, name };
}

test("ranks rise with XP, from Deckhand to Admiral", () => {
  const { rankFor } = require("../server/ranks");
  assert.equal(rankFor(0).title, "Deckhand");
  assert.equal(rankFor(299).title, "Deckhand");
  assert.equal(rankFor(300).title, "Powder Monkey");
  assert.equal(rankFor(1800).title, "Bosun");
  assert.equal(rankFor(999999).title, "Admiral");
  assert.equal(rankFor(999999).next, null);
  assert.equal(rankFor(550).progress, 0.5);       // half way from 300 to 800
});

test("playing battles earns XP", async () => {
  const { captain, name } = await captainWithScore(4000);
  const page = await captain.get("/api/captains/" + name);
  assert.equal(page.body.rank.xp, 4000 / 20 + 4 * 5);    // points/20 + 5 per ship
  assert.equal(page.body.rank.title, "Deckhand");
});

test("a public captain page shows the record but nothing private", async () => {
  const { name } = await captainWithScore(1200);
  const page = await new Captain(game.base).get("/api/captains/" + name);    // a guest looking
  assert.equal(page.status, 200);
  assert.equal(page.body.bestScore, 1200);
  assert.ok(Array.isArray(page.body.achievements));
  for (const secret of ["gold", "password_hash", "salt", "id", "role"]) {
    assert.equal(page.body[secret], undefined, secret + " must not be public");
  }
});

test("an unknown captain gives 404", async () => {
  assert.equal((await new Captain(game.base).get("/api/captains/nobody_at_all")).status, 404);
});

test("rivals: add, compare, refuse silly ones, remove", async () => {
  const me = await captainWithScore(900);
  const other = await captainWithScore(1500);
  assert.equal((await me.captain.post("/api/rivals", { username: me.name })).status, 400);        // not yourself
  assert.equal((await me.captain.post("/api/rivals", { username: "nobody_at_all" })).status, 404);
  assert.equal((await me.captain.post("/api/rivals", { username: other.name })).status, 200);
  assert.equal((await me.captain.post("/api/rivals", { username: other.name })).status, 409);     // already
  const list = await me.captain.get("/api/rivals");
  assert.equal(list.body.rivals.length, 1);
  assert.equal(list.body.rivals[0].difference, 900 - 1500);
  const page = await me.captain.get("/api/captains/" + other.name);
  assert.equal(page.body.isRival, true);
  assert.equal((await me.captain.request("DELETE", "/api/rivals/" + other.name)).status, 200);
  assert.equal((await me.captain.get("/api/rivals")).body.rivals.length, 0);
});

test("no more than 5 rivals", async () => {
  const me = await captainWithScore(0);
  for (let i = 0; i < 5; i++) {
    const other = await captainWithScore(0);
    assert.equal((await me.captain.post("/api/rivals", { username: other.name })).status, 200);
  }
  const sixth = await captainWithScore(0);
  assert.equal((await me.captain.post("/api/rivals", { username: sixth.name })).status, 400);
});

test("guests cannot have rivals", async () => {
  assert.equal((await new Captain(game.base).get("/api/rivals")).status, 401);
});

test("the leaderboard shows each captain's rank title", async () => {
  await captainWithScore(777);
  const board = await new Captain(game.base).get("/api/leaderboard?period=all");
  assert.ok(board.body.length > 0);
  assert.equal(typeof board.body[0].title, "string");
  assert.equal(board.body[0].userId, undefined);
});

test("the rival picker can search captains, marking yourself and your rivals", async () => {
  const me = await captainWithScore(100);
  const other = await captainWithScore(900);
  await me.captain.post("/api/rivals", { username: other.name });
  const found = (await me.captain.get("/api/captains?search=" + other.name)).body.captains;
  assert.equal(found.length, 1);
  assert.equal(found[0].username, other.name);
  assert.equal(found[0].isRival, true);
  const self = (await me.captain.get("/api/captains?search=" + me.name)).body.captains[0];
  assert.equal(self.isMe, true);
  // % and _ are searched as plain characters, not wildcards
  assert.equal((await me.captain.get("/api/captains?search=%25%25%25")).body.captains.length, 0);
  assert.ok((await me.captain.get("/api/captains")).body.captains.length <= 20);
  assert.equal(found[0].password_hash, undefined);
});
