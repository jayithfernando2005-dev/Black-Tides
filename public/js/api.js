// api.js - every request from the browser to OUR server goes through this file.
// The browser never talks to the Fish API directly; the server does that,
// so the answers to a sonar puzzle never reach the browser.

// Sends a request and returns the JSON reply.
// If the server says something went wrong, its error message is thrown.
async function request(url, options) {
  const response = await fetch(url, options);
  let reply = {};
  try {
    reply = await response.json();
  } catch (error) {
    // The reply had no JSON body; keep the empty object.
  }
  if (!response.ok) {
    throw new Error(reply.error || "Request failed: " + response.status);
  }
  return reply;
}

function getJson(url) {
  return request(url);
}

function postJson(url, data) {
  return request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
}

// ----- Captain accounts -----

export function register(username, password, remember) {
  return postJson("/api/register", { username: username, password: password, remember: remember });
}

export function login(username, password, remember) {
  return postJson("/api/login", { username: username, password: password, remember: remember });
}

export function logout() {
  return postJson("/api/logout", {});
}

// Who is logged in: { username, memberSince, remember } or { username: null }.
export function whoAmI() {
  return getJson("/api/me");
}

// Turns "stay logged in" on or off.
export function setRemember(remember) {
  return postJson("/api/remember", { remember: remember });
}

// ----- Sonar puzzles -----

// A new sonar puzzle. Returns { image } only.
export function getPuzzle() {
  return getJson("/api/puzzle");
}

// Sends the player's counts. Returns { fishCorrect, chestCorrect, chests }.
export function sendAnswer(fish, chest) {
  return postJson("/api/puzzle/answer", { fish: fish, chest: chest });
}

// ----- Gold and the Shipyard -----

// { gold, maxLevel, upgrades: { hull: { name, text, level, cost }, ... } }
export function getProgress() {
  return getJson("/api/progress");
}

export function depositGold(earned) {
  return postJson("/api/progress/gold", { earned: earned });
}

export function buyUpgrade(key) {
  return postJson("/api/shipyard/buy", { upgrade: key });
}

// ----- Scores, profile, achievements, leaderboard -----

// Saves a finished battle. Returns { saved, personalBest, newAchievements }.
export function saveScore(summary) {
  return postJson("/api/scores", {
    score: summary.score,
    wave: summary.wave,
    sunk: summary.sunk,
    bosses: summary.bosses,
    goldEarned: summary.goldEarned,
    underFire: summary.underFire,
    untouched: summary.untouched,
    stage: summary.stage ? summary.stage.id : 0,
    difficulty: summary.difficulty,
    bestCombo: summary.bestCombo,
    // extra numbers for the daily quests
    questStats: { cutters: summary.cutters, ironclads: summary.ironclads, escorts: summary.escorts, specialsUsed: summary.specialsUsed }
  });
}

export function getProfile() {
  return getJson("/api/profile");
}

export function getAchievements() {
  return getJson("/api/achievements");
}

// period is "all" or "week".
export function getLeaderboard(period) {
  return getJson("/api/leaderboard?period=" + encodeURIComponent(period));
}

// ----- The Naval Campaign -----

// { unlocked, total, stages: [...] }
export function getCampaign() {
  return getJson("/api/campaign");
}

// The server checks the stage is unlocked. Returns { stage }.
export function startStage(id) {
  return postJson("/api/campaign/start", { stage: id });
}

// Returns { firstClear, reward, gold, unlocked, nextStage, campaignWon }.
export function completeStage(id) {
  return postJson("/api/campaign/complete", { stage: id });
}

// ----- Captain portrait -----

// choice: { preset: 0-11 } or { image: dataUrl } or { reset: true }. Returns { avatar, avatarVersion }.
export function saveAvatar(choice) {
  return postJson("/api/profile/avatar", choice);
}

// ----- The Daily Challenge -----

// { day, rules, me: { status, seconds, wrong }, board: [...] } - never the picture.
export function getDaily() {
  return getJson("/api/daily");
}

// Starts (or continues) the clock. Returns { image, wrong, elapsed }.
export function startDaily() {
  return postJson("/api/daily/start", {});
}

// Returns { correct: false, wrong } or { correct: true, seconds, rank, gold, chestRight, chests }.
export function answerDaily(fish, chest) {
  return postJson("/api/daily/answer", { fish: fish, chest: chest });
}

// ----- Real weather (Open-Meteo, through our server) -----

// { cityName, temperature, wind, label, storm, fog, windPush }
export function getWeather(city) {
  return getJson("/api/weather?city=" + encodeURIComponent(city));
}

// ----- Captain pages, rivals, ranks -----

// A captain's public page: { username, rank, bestScore, achievements, isRival, ... }.
export function getCaptain(name) {
  return getJson("/api/captains/" + encodeURIComponent(name));
}

export function getRivals() {
  return getJson("/api/rivals");
}

export function addRival(name) {
  return postJson("/api/rivals", { username: name });
}

export function removeRival(name) {
  return request("/api/rivals/" + encodeURIComponent(name), { method: "DELETE" });
}

// ----- Admin (harbour master) -----

export function adminCaptains() {
  return getJson("/api/admin/captains");
}

export function adminReset(name, scores) {
  return postJson("/api/admin/captains/" + encodeURIComponent(name) + "/reset", { scores: scores === true });
}

export function adminRename(name, newName) {
  return postJson("/api/admin/captains/" + encodeURIComponent(name) + "/rename", { newName: newName });
}

export function adminRemove(name) {
  return request("/api/admin/captains/" + encodeURIComponent(name), { method: "DELETE" });
}

// ----- Save files -----

// The save file itself is downloaded straight from /api/save (a normal link).
export function importSave(save) {
  return postJson("/api/save/import", { save: save });
}

// ----- Daily quests -----

export function getQuests() {
  return getJson("/api/quests");
}

export function claimQuest(key) {
  return postJson("/api/quests/" + encodeURIComponent(key) + "/claim", {});
}

// ----- Ship customisation -----

export function saveShip(look) {
  return postJson("/api/profile/ship", look);
}

// The save file as data (the same file Settings downloads).
export function downloadSave() {
  return getJson("/api/save");
}

// ----- Weekly tournament and statistics -----

export function getTournament() {
  return getJson("/api/tournament");
}

export function getStats() {
  return getJson("/api/stats");
}

// Captains to choose a rival from: { captains: [{ username, rank, bestScore, isMe, isRival, ... }] }
export function searchCaptains(text) {
  return getJson("/api/captains?search=" + encodeURIComponent(text || ""));
}
