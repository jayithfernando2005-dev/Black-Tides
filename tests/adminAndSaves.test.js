// AI note: written with help from Claude (Anthropic), as allowed for this assignment.
// adminAndSaves.test.js - the admin page's permissions, and signed save files.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startGame, Captain, newName } = require("./helpers");

let game;
before(async () => { game = await startGame(); });
after(() => game.close());

async function newCaptain() {
  const captain = new Captain(game.base);
  const name = newName("cap");
  await captain.register(name);
  return { captain, name };
}

function makeAdmin(name) {
  require("../server/db").prepare("UPDATE users SET role = 'admin' WHERE username = ?").run(name);
}

test("normal captains and guests cannot use the admin page", async () => {
  const { captain } = await newCaptain();
  assert.equal((await captain.get("/api/admin/captains")).status, 403);
  assert.equal((await new Captain(game.base).get("/api/admin/captains")).status, 401);
});

test("an admin can see captains, rename, reset and remove them", async () => {
  const admin = await newCaptain();
  makeAdmin(admin.name);
  const target = await newCaptain();
  await target.captain.post("/api/scores", { score: 500, wave: 2, sunk: 3, bosses: 0, goldEarned: 30 });

  const list = await admin.captain.get("/api/admin/captains");
  assert.equal(list.status, 200);
  assert.ok(list.body.captains.some((c) => c.username === target.name));

  const newName2 = newName("ren");
  assert.equal((await admin.captain.post("/api/admin/captains/" + target.name + "/rename", { newName: "<b>bad</b>" })).status, 400);
  assert.equal((await admin.captain.post("/api/admin/captains/" + target.name + "/rename", { newName: newName2 })).status, 200);
  assert.equal((await admin.captain.get("/api/captains/" + newName2)).status, 200);

  assert.equal((await admin.captain.post("/api/admin/captains/" + newName2 + "/reset", { scores: true })).status, 200);
  assert.equal((await admin.captain.get("/api/captains/" + newName2)).body.bestScore, 0);

  assert.equal((await admin.captain.request("DELETE", "/api/admin/captains/" + newName2)).status, 200);
  assert.equal((await admin.captain.get("/api/captains/" + newName2)).status, 404);
});

test("admin accounts are protected from the admin page", async () => {
  const admin = await newCaptain();
  const other = await newCaptain();
  makeAdmin(admin.name);
  makeAdmin(other.name);
  assert.equal((await admin.captain.request("DELETE", "/api/admin/captains/" + other.name)).status, 403);
  assert.equal((await admin.captain.request("DELETE", "/api/admin/captains/" + admin.name)).status, 403);
});

test("a save file downloads and loads back", async () => {
  const { captain, name } = await newCaptain();
  await captain.post("/api/progress/gold", { earned: 50 });
  const save = (await captain.get("/api/save")).body;
  assert.equal(save.format, "black-tides-save");
  assert.equal(save.captain, name);
  assert.equal(save.progress.gold, 50);
  assert.match(save.signature, /^[0-9a-f]{64}$/);
  // spend the gold, then load the save to get it back
  await captain.post("/api/shipyard/buy", { upgrade: "hull" });
  const loaded = await captain.post("/api/save/import", { save: save });
  assert.equal(loaded.status, 200);
  assert.equal((await captain.get("/api/progress")).body.gold, 50);
});

test("an edited save file is refused", async () => {
  const { captain } = await newCaptain();
  const save = (await captain.get("/api/save")).body;
  save.progress.gold = 999999;                                   // cheating
  const reply = await captain.post("/api/save/import", { save: save });
  assert.equal(reply.status, 400);
  assert.match(reply.body.error, /changed/);
});

test("another captain's save cannot be loaded, but a guest's save can", async () => {
  const first = await newCaptain();
  const second = await newCaptain();
  const firstSave = (await first.captain.get("/api/save")).body;
  assert.equal((await second.captain.post("/api/save/import", { save: firstSave })).status, 403);

  const guest = new Captain(game.base);
  await guest.post("/api/progress/gold", { earned: 20 });
  const guestSave = (await guest.get("/api/save")).body;
  assert.equal(guestSave.captain, null);
  assert.equal((await second.captain.post("/api/save/import", { save: guestSave })).status, 200);
});

test("junk is not a save file", async () => {
  const { captain } = await newCaptain();
  assert.equal((await captain.post("/api/save/import", { save: { hello: "world" } })).status, 400);
  assert.equal((await captain.post("/api/save/import", {})).status, 400);
});
