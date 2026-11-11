// accounts.test.js - captain accounts, logging in, and who may do what.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startGame, Captain, newName } = require("./helpers");

let game;
before(async () => { game = await startGame(); });
after(() => game.close());

test("a new captain can register and is logged in straight away", async () => {
  const captain = new Captain(game.base);
  const name = newName();
  const reply = await captain.register(name);
  assert.equal(reply.status, 200);
  const me = await captain.get("/api/me");
  assert.equal(me.body.username, name);
});

test("passwords are stored as a hash, never as the password itself", async () => {
  const name = newName();
  await new Captain(game.base).register(name, "my-secret-pass");
  const db = require("../server/db");
  const row = db.prepare("SELECT password_hash, salt FROM users WHERE username = ?").get(name);
  assert.ok(row.password_hash.length > 20);
  assert.ok(!row.password_hash.includes("my-secret-pass"));
  assert.ok(row.salt.length > 0);
});

test("the same username cannot be taken twice", async () => {
  const name = newName();
  await new Captain(game.base).register(name);
  const second = await new Captain(game.base).register(name);
  assert.equal(second.status, 409);
});

test("bad usernames and short passwords are refused", async () => {
  assert.equal((await new Captain(game.base).register("a")).status, 400);
  assert.equal((await new Captain(game.base).register("<script>")).status, 400);
  assert.equal((await new Captain(game.base).register(newName(), "short")).status, 400);
});

test("a wrong password does not log in", async () => {
  const name = newName();
  await new Captain(game.base).register(name);
  const reply = await new Captain(game.base).post("/api/login", { username: name, password: "not-the-password" });
  assert.equal(reply.status, 401);
});

test("guests cannot save scores or change a portrait", async () => {
  const guest = new Captain(game.base);
  assert.equal((await guest.post("/api/scores", { score: 10, wave: 1, sunk: 0, bosses: 0, goldEarned: 0 })).status, 401);
  assert.equal((await guest.post("/api/profile/avatar", { preset: 1 })).status, 401);
});

test("a fake picture pretending to be a PNG is refused", async () => {
  const captain = new Captain(game.base);
  await captain.register(newName());
  const fake = "data:image/png;base64," + Buffer.from("<script>alert(1)</script>").toString("base64");
  assert.equal((await captain.post("/api/profile/avatar", { image: fake })).status, 400);
  assert.equal((await captain.post("/api/profile/avatar", { preset: 99 })).status, 400);
  assert.equal((await captain.post("/api/profile/avatar", { preset: 3 })).status, 200);
});

test("a silly score is refused", async () => {
  const captain = new Captain(game.base);
  await captain.register(newName());
  const reply = await captain.post("/api/scores", { score: -5, wave: 1, sunk: 0, bosses: 0, goldEarned: 0 });
  assert.equal(reply.status, 400);
});
