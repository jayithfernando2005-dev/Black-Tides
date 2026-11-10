// AI note: written with help from Claude (Anthropic), as allowed for this assignment.
// screens.js - every screen and the navigation between them.
// Each screen has its own address (#/menu, #/leaderboard, ...), so the
// browser's Back and Forward buttons work, and Escape returns to the menu.
import * as api from "./api.js";
import { emit, on } from "./events.js";
import { getSettings, saveSettings, resetSettings } from "./settings.js";
import { showShipyard } from "./shipyard.js";
import { unlockAudio, sounds } from "./sound.js";
import { renderLeaderboard, captainPortrait } from "./leaderboardView.js";
import { renderMedals } from "./medals.js";
import { renderPortrait, openPortraitPicker } from "./portraits.js";

let myPortrait = { avatar: null, avatarVersion: 0 };
import { renderAchievementCards } from "./achievementsView.js";
import { showDaily, leaveDaily } from "./daily.js";
import { showMap, getVoyage, advanceTo, chooseStage, chooseEndless } from "./campaign.js";

let lastVoyage = null;     // the voyage that just ended, for "Play again"

const SCREENS = {
  login: "Log in",
  register: "Create account",
  menu: "Main menu",
  howto: "How to play",
  shipyard: "Shipyard",
  leaderboard: "Leaderboard",
  profile: "Captain profile",
  achievements: "Achievements",
  settings: "Settings",
  map: "Campaign map",
  daily: "Daily Challenge",
  game: "Battle"
};
const OPEN_SCREENS = ["login", "register"];      // screens for people not signed in

// Who is playing: a captain with a username, a guest, or nobody yet.
const player = { username: null, guest: false, memberSince: null, remember: false };
let current = null;

const $ = (id) => document.getElementById(id);

function signedIn() {
  return player.username !== null || player.guest;
}

function setPlayer(details) {
  player.username = details.username || null;
  player.guest = details.guest === true;
  player.memberSince = details.memberSince || null;
  player.remember = details.remember === true;
  emit("player:changed", { ...player });
}

// ----- Navigation -----

// Opens a screen by changing the address; route() then shows it.
export function go(name) {
  if (location.hash === "#/" + name) {
    route();
  } else {
    location.hash = "#/" + name;
  }
}

// Replaces the address without adding a Back step (used for redirects).
function redirect(name) {
  history.replaceState(null, "", "#/" + name);
  route();
}

function route() {
  let name = location.hash.replace("#/", "");
  if (!SCREENS[name]) {
    return redirect(signedIn() ? "menu" : "login");
  }
  if (!signedIn() && !OPEN_SCREENS.includes(name)) {
    return redirect("login");
  }
  if (signedIn() && OPEN_SCREENS.includes(name)) {
    return redirect("menu");
  }

  // Leaving the battle (menu button, Back button, or Escape on the end panel) stops it.
  if (current === "game" && name !== "game") {
    emit("battle:stop");
  }
  if (current === "daily" && name !== "daily") {
    leaveDaily();                                 // stop the on-screen clock (the server keeps the real one)
  }
  current = name;

  for (const section of document.querySelectorAll(".screen")) {
    section.hidden = section.id !== "screen-" + name;
  }
  document.body.dataset.screen = name;
  document.title = SCREENS[name] + " · Black Tides";
  $("brand-captain").textContent = player.username ? "Captain " + player.username : "Guest";

  const loader = loaders[name];
  if (loader) {
    loader();
  }
  // Move keyboard focus to the new screen's heading, for keyboard and screen-reader users.
  const heading = document.querySelector("#screen-" + name + " h1, #screen-" + name + " h2");
  if (heading && name !== "game") {
    heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
  }
  window.scrollTo(0, 0);
  emit("screen:shown", name);
}

// Event: any button with data-nav="screen" opens that screen.
document.addEventListener("click", (event) => {
  unlockAudio();
  const button = event.target.closest("[data-nav]");
  if (button) {
    event.preventDefault();
    sounds.click();
    go(button.dataset.nav);
  }
});

// Event: Escape on any screen except the battle goes back to the main menu.
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && current !== "game" && signedIn() && current !== "menu") {
    go("menu");
  }
});

window.addEventListener("hashchange", route);

// ----- Screen loaders: fill a screen with fresh data when it opens -----

function formatDate(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

const loaders = {
  game() {
    emit("battle:start", getVoyage());          // a campaign stage or an endless voyage
  },

  map() {
    showMap();
  },

  daily() {
    showDaily(player.username);
  },

  async menu() {
    $("menu-captain").textContent = player.username ? player.username : "Guest";
    $("menu-login").hidden = !player.guest;
    $("menu-logout").hidden = player.guest;
    $("menu-guest-note").hidden = !player.guest;
    try {
      const progress = await api.getProgress();
      $("menu-gold").textContent = progress.gold;
    } catch (error) {
      $("menu-gold").textContent = "-";
    }
  },

  shipyard() {
    showShipyard($("shipyard-list"), $("shipyard-gold"), $("shipyard-message"));
  },

  leaderboard() {
    loadLeaderboard(document.querySelector(".board-tabs [aria-selected='true']").dataset.period);
  },

  async profile() {
    $("profile-guest").hidden = !player.guest;
    $("profile-body").hidden = player.guest;
    document.querySelector("#screen-profile [data-nav=achievements]").hidden = player.guest;
    if (player.guest) return;
    try {
      const [profile, badges] = await Promise.all([api.getProfile(), api.getAchievements()]);
      $("profile-name").textContent = profile.username;
      myPortrait = { avatar: profile.avatar, avatarVersion: profile.avatarVersion };
      renderPortrait($("profile-portrait"), profile.username, profile.avatar, profile.avatarVersion);
      $("profile-since").textContent = "Member since " + formatDate(profile.memberSince);
      $("profile-rank").textContent = profile.rank ? "#" + profile.rank : "Unranked";
      $("profile-gold").textContent = profile.gold;
      $("stat-games").textContent = profile.games;
      $("stat-wave").textContent = profile.bestWave;
      $("stat-score").textContent = profile.bestScore;
      $("stat-sunk").textContent = profile.sunk;
      $("stat-solved").textContent = profile.puzzlesSolved;
      $("stat-accuracy").textContent = profile.accuracy === null ? "-" : profile.accuracy + "%";
      const unlocked = badges.filter((badge) => badge.unlocked).length;
      $("profile-badge-count").textContent = unlocked + " of " + badges.length + " unlocked";
      renderMedals($("profile-badges"), badges);                            // all 12 as medals
    } catch (error) {
      $("profile-since").textContent = error.message;
    }
  },

  async achievements() {
    $("achievements-guest").hidden = !player.guest;
    $("achievements-grid").hidden = player.guest;
    $("achievements-progress").hidden = player.guest;
    document.querySelector("#screen-achievements [data-nav=profile]").hidden = player.guest;
    if (player.guest) return;
    try {
      const badges = await api.getAchievements();
      const unlocked = badges.filter((badge) => badge.unlocked).length;
      $("achievements-count").textContent = unlocked + " of " + badges.length + " unlocked";
      $("achievements-fill").style.width = (100 * unlocked / badges.length) + "%";
      renderAchievementCards($("achievements-grid"), badges);         // achievementsView.js
    } catch (error) {
      $("achievements-count").textContent = error.message;
    }
  },

  async settings() {
    const settings = getSettings();
    $("set-sfx").value = settings.sfx;
    $("set-music").value = settings.music;
    $("set-ambience").value = settings.ambience;
    $("set-mute").checked = settings.mute;
    $("set-shake").checked = settings.shake;
    $("set-keys").value = settings.keys;
    $("set-news").checked = settings.liveNews;
    $("set-weather").value = settings.weatherCity;
    showVolumes();
    $("settings-message").textContent = "";
    $("set-stay").disabled = player.guest;
    $("set-stay").checked = player.remember;
    $("set-stay-note").textContent = player.guest
      ? "Log in to use this. Guests are never remembered."
      : "Keeps you logged in for 30 days on this device.";
  }
};

// ----- Changing the captain's portrait -----
function openPicker() {
  if (!player.username) return;
  openPortraitPicker(player.username, myPortrait.avatar, myPortrait.avatarVersion);
}
$("change-portrait").addEventListener("click", openPicker);
$("profile-porthole").addEventListener("click", openPicker);
// Event: the portrait was saved - show it straight away.
on("avatar:changed", (result) => {
  myPortrait = result;
  renderPortrait($("profile-portrait"), player.username, result.avatar, result.avatarVersion);
});

// ----- Leaderboard -----

async function loadLeaderboard(period) {
  const body = $("leaderboard-body");
  const empty = $("leaderboard-empty");
  body.replaceChildren();
  empty.hidden = true;
  try {
    const rows = await api.getLeaderboard(period);
    renderLeaderboard(body, rows, player.username);     // leaderboardView.js draws the rows
    empty.textContent = period === "week"
      ? "No battles saved this week yet. Set sail and take the top spot."
      : "No battles saved yet. Be the first captain on the board.";
    empty.hidden = rows.length > 0;
  } catch (error) {
    empty.hidden = false;
    empty.textContent = error.message;
  }
}

for (const tab of document.querySelectorAll(".board-tabs button")) {
  tab.addEventListener("click", () => {
    for (const other of document.querySelectorAll(".board-tabs button")) {
      other.setAttribute("aria-selected", String(other === tab));
    }
    loadLeaderboard(tab.dataset.period);
  });
}

// ----- Log in, register, guest, log out -----

function showFormError(element, text) {
  element.textContent = text;
  element.hidden = text === "";
}

$("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = $("login-message");
  showFormError(message, "");
  const username = $("login-username").value.trim();
  const password = $("login-password").value;
  if (username === "" || password === "") {
    return showFormError(message, "Enter your username and password.");
  }
  try {
    const result = await api.login(username, password, $("login-remember").checked);
    $("login-form").reset();
    const me = await api.whoAmI();
    setPlayer({ username: result.username, memberSince: me.memberSince, remember: me.remember });
    go("menu");
  } catch (error) {
    showFormError(message, error.message);
  }
});

$("register-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = $("register-message");
  showFormError(message, "");
  const username = $("register-username").value.trim();
  const password = $("register-password").value;
  if (password !== $("register-confirm").value) {
    return showFormError(message, "The two passwords do not match.");
  }
  try {
    const result = await api.register(username, password, $("register-remember").checked);
    $("register-form").reset();
    const me = await api.whoAmI();
    setPlayer({ username: result.username, memberSince: me.memberSince, remember: me.remember });
    go("menu");
  } catch (error) {
    showFormError(message, error.message);
  }
});

$("guest-button").addEventListener("click", () => {
  setPlayer({ guest: true });
  go("menu");
});

async function logOut() {
  try {
    await api.logout();
  } catch (error) {
    console.error(error);
  }
  setPlayer({});
  go("login");
}
$("menu-logout").addEventListener("click", logOut);
$("menu-login").addEventListener("click", () => {
  setPlayer({});                                  // a guest who wants to log in
  go("login");
});

// ----- Settings -----

function showVolumes() {
  $("set-sfx-value").textContent = $("set-sfx").value;
  $("set-music-value").textContent = $("set-music").value;
  $("set-ambience-value").textContent = $("set-ambience").value;
  // the brass part of each slider rail follows the knob
  for (const id of ["set-sfx", "set-music", "set-ambience"]) {
    $(id).style.setProperty("--fill", $(id).value + "%");
  }
}
$("set-sfx").addEventListener("input", showVolumes);
$("set-music").addEventListener("input", showVolumes);
$("set-ambience").addEventListener("input", showVolumes);

$("settings-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  saveSettings({
    sfx: $("set-sfx").value,
    music: $("set-music").value,
    ambience: $("set-ambience").value,
    mute: $("set-mute").checked,
    shake: $("set-shake").checked,
    keys: $("set-keys").value,
    liveNews: $("set-news").checked,
    weatherCity: $("set-weather").value
  });
  let text = "Settings saved on this device.";
  if (!player.guest && $("set-stay").checked !== player.remember) {
    try {
      const reply = await api.setRemember($("set-stay").checked);
      player.remember = reply.remember;
      text += reply.remember ? " You will stay logged in for 30 days." : " You will be logged out when the browser closes.";
    } catch (error) {
      text = error.message;
    }
  }
  $("settings-message").textContent = text;
  sounds.coin();
});

$("settings-reset").addEventListener("click", () => {
  resetSettings();
  loaders.settings();
  $("settings-message").textContent = "Settings reset to the defaults.";
});

// ----- Battle panels: pause and game over -----

$("quit-button").addEventListener("click", () => go("menu"));

on("battle:over", async (summary) => {
  $("over-wave").textContent = summary.wave;
  $("over-sunk").textContent = summary.sunk;
  $("over-bosses").textContent = summary.bosses;
  $("over-solved").textContent = summary.puzzlesSolved;
  $("over-gold").textContent = summary.goldEarned;
  $("over-score").textContent = summary.score;
  $("over-best").hidden = true;
  $("over-badges").hidden = true;
  $("over-note").textContent = "";

  // A campaign stage: victory or defeat, with the next stage when one was unlocked.
  const stage = summary.stage;
  const result = summary.campaign;
  lastVoyage = stage ? { mode: "stage", stage: stage } : { mode: "endless", stage: null };
  $("over-title").textContent = summary.victory ? "Victory!" : "Ship sunk";
  $("over-panel").classList.toggle("victory", summary.victory === true);
  $("next-stage-button").hidden = true;
  $("again-button").textContent = summary.victory ? "Play stage again" : "Play again (Enter)";
  if (stage && summary.victory && result) {
    let text = "Stage " + stage.id + " · " + stage.name + " won! +" + result.reward + " gold.";
    if (result.campaignWon && result.firstClear) text += " You have conquered the Black Tides!";
    else if (result.firstClear && result.nextStage) text += " Stage " + result.nextStage.id + " · " + result.nextStage.name + " is unlocked.";
    $("over-victory").textContent = text;
    if (result.nextStage) {
      advanceTo(result.nextStage);              // "Next stage" plays the stage just unlocked
      $("next-stage-button").hidden = false;
    }
  } else if (stage && summary.victory) {
    $("over-victory").textContent = "Stage won, but the harbour could not record it: " + (summary.campaignError || "try again.");
  } else if (stage) {
    $("over-victory").textContent = "Stage " + stage.id + " · " + stage.name + " lost. Win " + stage.waves + " waves to unlock the next stage.";
  }
  $("over-victory").hidden = !stage;
  $("over-panel").hidden = false;
  ($("next-stage-button").hidden ? $("again-button") : $("next-stage-button")).focus();

  if (player.guest) {
    $("over-note").textContent = "Guest scores are not saved. Log in to join the leaderboard.";
    return;
  }
  $("over-note").textContent = "Saving your score...";
  try {
    const result = await api.saveScore(summary);
    $("over-note").textContent = "Score saved to your captain's record.";
    $("over-best").hidden = !result.personalBest;
    if (result.newAchievements.length > 0) {
      $("over-badges").textContent = "New achievement: " + result.newAchievements.join(", ");
      $("over-badges").hidden = false;
    }
  } catch (error) {
    $("over-note").textContent = error.message;
  }
});

on("battle:start", () => {
  $("over-panel").hidden = true;
});

// "Play again" replays the voyage that just ended (even after a new stage was unlocked).
function playAgain() {
  if (lastVoyage && lastVoyage.stage) chooseStage(lastVoyage.stage);
  else if (lastVoyage) chooseEndless();
  emit("battle:start", getVoyage());
}
$("again-button").addEventListener("click", playAgain);
$("next-stage-button").addEventListener("click", () => emit("battle:start", getVoyage()));
// Event: another part of the game asks to open a screen (e.g. back to the map).
on("nav:to", (name) => go(name));

// Enter on the end panel plays again, M goes to the menu.
window.addEventListener("keydown", (event) => {
  if (current !== "game" || $("over-panel").hidden) return;
  if (event.key === "Enter" && document.activeElement.tagName !== "BUTTON") {
    playAgain();
  } else if (event.key.toLowerCase() === "m") {
    go("menu");
  }
});

// ----- Start-up: ask the server if this browser is already logged in -----

export async function startScreens() {
  if (location.hash === "#/game") {
    history.replaceState(null, "", "#/menu");     // never jump straight into a battle on reload
  }
  try {
    const me = await api.whoAmI();
    if (me.username) {
      setPlayer(me);
    }
  } catch (error) {
    console.error(error);
  }
  route();
}
