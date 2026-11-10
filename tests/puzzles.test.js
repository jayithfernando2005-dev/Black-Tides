// AI note: written with help from Claude (Anthropic), as allowed for this assignment.
// puzzles.test.js - the sonar puzzles and the Naval Campaign rules.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startGame, Captain, newName, fish } = require("./helpers");

let game;
before(async () => { game = await startGame(); });
after(() => game.close());

test("the browser gets the picture but never the answers", async () => {
  const captain = new Captain(game.base);
  const reply = await captain.get("/api/puzzle");
  assert.equal(reply.status, 200);
  assert.ok(reply.body.image.startsWith("https://"));
  assert.equal(reply.body.fish, undefined);
  assert.equal(reply.body.chest, undefined);
});

test("a wrong count is refused and a right count reloads", async () => {
  const captain = new Captain(game.base);
  await captain.get("/api/puzzle");
  const wrong = await captain.post("/api/puzzle/answer", { fish: fish.count + 1 });
  assert.equal(wrong.body.fishCorrect, false);
  const right = await captain.post("/api/puzzle/answer", { fish: fish.count, chest: fish.chests });
  assert.equal(right.body.fishCorrect, true);
  assert.equal(right.body.chestCorrect, true);
});

test("each puzzle can only be used once", async () => {
  const captain = new Captain(game.base);
  await captain.get("/api/puzzle");
  await captain.post("/api/puzzle/answer", { fish: fish.count });
  const again = await captain.post("/api/puzzle/answer", { fish: fish.count });
  assert.equal(again.status, 400);
});

test("a locked campaign stage cannot be started", async () => {
  const captain = new Captain(game.base);
  await captain.register(newName());
  assert.equal((await captain.post("/api/campaign/start", { stage: 1 })).status, 200);
  assert.equal((await captain.post("/api/campaign/start", { stage: 5 })).status, 403);
});

test("a stage won impossibly fast does not count", async () => {
  const captain = new Captain(game.base);
  await captain.register(newName());
  await captain.post("/api/campaign/start", { stage: 1 });
  const reply = await captain.post("/api/campaign/complete", { stage: 1 });
  assert.equal(reply.status, 400);
  const campaign = await captain.get("/api/campaign");
  assert.equal(campaign.body.unlocked, 1);                      // stage 2 is still locked
});

test("a stage that was never started cannot be completed", async () => {
  const captain = new Captain(game.base);
  await captain.register(newName());
  assert.equal((await captain.post("/api/campaign/complete", { stage: 1 })).status, 400);
});
