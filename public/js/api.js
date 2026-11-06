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
    untouched: summary.untouched
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
