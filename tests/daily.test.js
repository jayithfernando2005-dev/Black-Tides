// AI note: written with help from Claude (Anthropic), as allowed for this assignment.
// daily.test.js - the Daily Challenge.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startGame, Captain, newName, fish } = require("./helpers");

let game;
before(async () => { game = await startGame(); });
after(() => game.close());

test("the daily page never shows the picture before the clock starts", async () => {
  const captain = new Captain(game.base);
  await captain.register(newName());
  const reply = await captain.get("/api/daily");
  assert.equal(reply.status, 200);
  assert.equal(reply.body.me.status, "new");
  assert.equal(reply.body.image, undefined);
});

test("guests cannot start the Daily Challenge", async () => {
  assert.equal((await new Captain(game.base).post("/api/daily/start")).status, 401);
});

test("every captain gets the same picture today, fetched from the Fish API only once", async () => {
  const first = new Captain(game.base);
  const second = new Captain(game.base);
  await first.register(newName());
  await second.register(newName());
  const callsBefore = fish.calls;
  const a = await first.post("/api/daily/start");
  const b = await second.post("/api/daily/start");
  assert.equal(a.body.image, b.body.image);
  assert.ok(fish.calls - callsBefore <= 1);
});

test("a wrong count adds a penalty, a right count finishes and pays gold", async () => {
  const captain = new Captain(game.base);
  await captain.register(newName());
  await captain.post("/api/daily/start");
  const wrong = await captain.post("/api/daily/answer", { fish: fish.count + 3 });
  assert.equal(wrong.body.correct, false);
  assert.equal(wrong.body.wrong, 1);
  const right = await captain.post("/api/daily/answer", { fish: fish.count });
  assert.equal(right.body.correct, true);
  assert.ok(right.body.seconds >= 10, "the 10 second penalty is included");
  assert.equal(right.body.gold, 30);
  const progress = await captain.get("/api/progress");
  assert.equal(progress.body.gold, 30);
});

test("the challenge can only be finished once a day", async () => {
  const captain = new Captain(game.base);
  await captain.register(newName());
  await captain.post("/api/daily/start");
  await captain.post("/api/daily/answer", { fish: fish.count });
  assert.equal((await captain.post("/api/daily/start")).status, 409);
  assert.equal((await captain.post("/api/daily/answer", { fish: fish.count })).status, 409);
});

test("starting again does not restart the clock", async () => {
  const captain = new Captain(game.base);
  await captain.register(newName());
  await captain.post("/api/daily/start");
  await new Promise((resolve) => setTimeout(resolve, 300));
  const again = await captain.post("/api/daily/start");
  assert.ok(again.body.elapsed >= 0.25);
});

test("finished captains appear on today's board, fastest first", async () => {
  const board = (await new Captain(game.base).get("/api/daily")).body.board;
  assert.ok(board.length >= 2);
  for (let i = 1; i < board.length; i++) {
    assert.ok(board[i - 1].seconds <= board[i].seconds);
  }
});
