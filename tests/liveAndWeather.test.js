// AI note: written with help from Claude (Anthropic), as allowed for this assignment.
// liveAndWeather.test.js - live sea news (Server-Sent Events) and the real-weather rules.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startGame, Captain, newName, weather } = require("./helpers");
const { weatherEffects } = require("../server/weather");

let game;
before(async () => { game = await startGame(); });
after(() => game.close());

// Opens the live news stream and waits until a message containing `wanted` arrives.
async function waitForNews(wanted, action) {
  const controller = new AbortController();
  const response = await fetch(game.base + "/api/live", { signal: controller.signal });
  assert.match(response.headers.get("content-type"), /^text\/event-stream/);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  await action();
  const deadline = Date.now() + 3000;
  while (!text.includes(wanted) && Date.now() < deadline) {
    const { value, done } = await reader.read();
    if (done) break;
    text += decoder.decode(value);
  }
  controller.abort();
  return text;
}

test("every open game hears when a new captain joins", async () => {
  const name = newName("news");
  const text = await waitForNews(name, () => new Captain(game.base).register(name));
  assert.match(text, /event: news/);
  assert.match(text, /"kind":"captain:joined"/);
  assert.ok(text.includes(name));
});

test("the live stream also tells how many captains are at sea", async () => {
  const text = await waitForNews("online", async () => {});
  assert.match(text, /event: online\ndata: \{"count":\d+\}/);
});

test("weather codes turn into the right battle effects", () => {
  assert.equal(weatherEffects(0, 5).storm, "normal");             // clear and calm
  assert.equal(weatherEffects(0, 5).label, "Clear skies");
  assert.equal(weatherEffects(95, 10).storm, "always");           // thunderstorm
  assert.equal(weatherEffects(63, 10).storm, "often");            // rain
  assert.equal(weatherEffects(45, 5).fog, true);                  // fog
  assert.equal(weatherEffects(2, 45).storm, "often");             // strong wind
  assert.equal(weatherEffects(2, 200).windPush, 1.8);             // a gale pushes, but not too hard
  assert.equal(weatherEffects(2, 5).windPush, 1);
});

test("the weather route reads the pretend weather service and keeps it for a while", async () => {
  const captain = new Captain(game.base);
  const callsBefore = weather.calls;
  const first = await captain.get("/api/weather?city=galle");
  assert.equal(first.status, 200);
  assert.equal(first.body.cityName, "Galle");
  assert.equal(first.body.label, "Thunderstorm");
  assert.equal(first.body.storm, "always");
  await captain.get("/api/weather?city=galle");
  assert.equal(weather.calls - callsBefore, 1, "the second ask comes from the cache");
});

test("an unknown city falls back to Colombo instead of fetching any address", async () => {
  const reply = await new Captain(game.base).get("/api/weather?city=http://evil.example");
  assert.equal(reply.status, 200);
  assert.equal(reply.body.city, "colombo");
});
