// game.js - the battle itself: the game loop, the player's ship, waves,
// bosses, storms, power-ups, pausing, and the end of the battle.
// It talks to the screens only through events (battle:start, battle:over, ...).
import { drawBattle } from "./renderer.js";
import { isDown, getMouse, watchMouse, isTyping, getVirtualMove } from "./input.js";
import { fireShot, updateShots, checkPlayerHit, clearShots, getShots, getEnemyShots } from "./shots.js";
import { spawnRaider, spawnBoss, spawnKraken, updateRaiders, checkHits, removeWrecks, clearRaiders, getRaiders, getBoss, REWARDS } from "./enemies.js";
import { updateSlams, clearSlams } from "./hazards.js";
import { getDifficulty, difficultyKey, applyDifficulty } from "./difficulty.js";
import { getMyShip } from "./shipLook.js";
import { planEvent, updateEvent, clearEvent, forceEvent, EVENT_INFO } from "./seaEvents.js";
import { POWERUPS, updatePowerups, getCrates, clearPowerups } from "./powerups.js";
import { explode, foam, addShake, updateEffects, getEffects, getShake, clearEffects } from "./effects.js";
import { openSonar, closeSonar, isSonarOpen } from "./sonar.js";
import { showShipyard } from "./shipyard.js";
import { updateHud, resetHud } from "./hud.js";
import { getProgress, depositGold, startStage, completeStage, getWeather } from "./api.js";
import { getSettings } from "./settings.js";
import { startAmbience, stopAmbience, unlockAudio } from "./sound.js";
import { on, emit } from "./events.js";

const canvas = document.getElementById("sea");
const ctx = canvas.getContext("2d");
const W = canvas.width;
const H = canvas.height;

const sonarButton = document.getElementById("sonar-button");
const pausePanel = document.getElementById("pause-panel");
const yardPanel = document.getElementById("yard-panel");
const yardTitle = document.getElementById("yard-title");
const sailButton = document.getElementById("sail-button");
const messageLine = document.getElementById("battle-message");

// ----- Rules of the battle -----
const SHIP_SPEED = 210;            // pixels per second
const EDGE = 25;
const FIRE_DELAY = 0.28;           // seconds between shots
const WAVE_REPAIR = 20;            // hull repaired after each wave
const WIND_SPEED = 26;             // storm wind pushes the ship sideways
const POINTS = { reload: 50 };          // points and gold for each ship type are in enemies.js (REWARDS)
const GOLD = { chest: 25 };
const COMBO_SECONDS = 3;                // sink the next ship within 3 s to keep the combo going
const SEA_EVENT_CHANCE = 0.4;           // chance of a sea event in a wave (from wave 2)
// Special cannon shots, earned by solving sonar puzzles (keys 1-4 or Q to choose).
export const SHOT_KINDS = ["iron", "chain", "fire", "broadside"];
const SHOT_NAMES = { iron: "Iron shot", chain: "Chain shot", fire: "Fire shot", broadside: "Broadside" };
const CHEST_PENALTY = 10;          // hull lost for a wrong chest count

// state is one of: idle, loading, playing, paused, clearing, shipyard, over
let state = "idle";
let captain = "Guest";
let time = 0;
const ship = {};
let stats;                         // ship numbers that come from Shipyard upgrades
let run;                           // everything about this one battle

// Turns the upgrade levels saved on the server into ship numbers.
function applyUpgrades(progress) {
  const level = (key) => (progress.upgrades && progress.upgrades[key] ? progress.upgrades[key].level : 0);
  stats = {
    maxHull: 100 + 25 * level("hull"),
    damage: 1 + 0.5 * level("power"),
    cap: 10 + 3 * level("hold"),
    jamSeconds: Math.max(0.5, 3 - 0.5 * level("scope"))
  };
  run.bankedGold = progress.gold || 0;
}

function say(text, tone) {
  messageLine.textContent = text;
  messageLine.className = "msg" + (tone ? " " + tone : "");
}

function hidePanels() {
  pausePanel.hidden = true;
  yardPanel.hidden = true;
  closeSonar();
}

// ----- Starting and stopping -----

// voyage: { mode: "stage", stage } for a Campaign stage, or { mode: "endless" } (see campaign.js).
async function startBattle(voyage) {
  unlockAudio();
  hidePanels();
  state = "loading";
  run = {
    stage: null,                               // the Campaign stage rules, or null for endless waves
    score: 0, wave: 0, sunk: 0, bosses: 0, puzzlesSolved: 0,
    battleGold: 0, goldEarned: 0, bankedGold: 0,
    damagedThisWave: false, untouched: false, underFire: false,
    clearTimer: 0, spawnQueue: [], spawnTimer: 0,
    storm: false, wind: 0, shield: 0, rapid: 0, flash: 0, banner: null,
    weather: null,                             // real weather for the Endless voyage (Open-Meteo)
    combo: { count: 0, timer: 0, multiplier: 1, pop: 0 }, bestCombo: 0,
    popups: [],                                // floating "+150" texts
    seaEvents: 0, escorts: 0,
    specials: { chain: 0, fire: 0, broadside: 0 }, selected: "iron", specialsUsed: 0,
    typeSunk: { cutter: 0, ironclad: 0 },
    difficulty: difficultyKey()               // fixed for the whole battle
  };
  say("Preparing your ship...");
  let progress = { gold: 0 };
  try {
    // A Campaign stage must be unlocked: the server checks before the battle begins.
    if (voyage && voyage.mode === "stage" && voyage.stage) {
      run.stage = (await startStage(voyage.stage.id)).stage;
    }
    progress = await getProgress();
    // The Endless voyage sails in the real weather of the captain's chosen city.
    // If the weather cannot be read within 3 seconds, the battle starts in normal weather.
    if (!voyage || voyage.mode !== "stage") {
      run.weather = await loadWeather();
    }
  } catch (error) {
    console.error(error);
    if (voyage && voyage.mode === "stage") {
      state = "idle";
      emit("nav:to", "map");                   // back to the map (the stage is locked)
      return;
    }
  }
  if (state !== "loading") {
    return;                                    // the player left while loading
  }
  applyUpgrades(progress);
  Object.assign(ship, { x: W / 2, y: H * 0.62, angle: -Math.PI / 2, hull: stats.maxHull, ammo: stats.cap, cooldown: 0, foamTimer: 0 });
  clearRaiders();
  clearSlams();
  clearEvent();
  clearShots();
  clearPowerups();
  clearEffects();
  resetHud();
  startWave(1);
  state = "playing";
  startAmbience();
  say(document.body.classList.contains("touch-play")
    ? "Steer with the joystick, touch the sea to aim and fire. Pull the sonar lever when you run low."
    : "Steer, aim with the mouse, click to fire. Press R for the sonar when you run low.");
  canvas.focus();
}

// Asks our server for the real weather (it asks Open-Meteo). Never throws.
async function loadWeather() {
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 3000));
  const weather = await Promise.race([getWeather(getSettings().weatherCity).catch(() => null), timeout]);
  if (weather) emit("weather:loaded", weather);
  return weather;
}

function stopBattle() {
  state = "idle";
  hidePanels();
  stopAmbience();
}

function pause() {
  if (state !== "playing") return;
  state = "paused";
  closeSonar();
  pausePanel.hidden = false;
  document.getElementById("resume-button").focus();
  emit("battle:paused");
}

function resume() {
  if (state !== "paused") return;
  state = "playing";
  pausePanel.hidden = true;
  canvas.focus();
  emit("battle:resumed");
}

// ----- Waves -----

function startWave(number) {
  run.wave = number;
  run.damagedThisWave = false;
  const stage = run.stage;
  const weather = stage ? null : run.weather;          // real weather only on the Endless voyage
  if (stage && stage.storm === "always") run.storm = true;
  else if (stage && stage.storm === "never") run.storm = false;
  else if (weather && weather.storm === "always") run.storm = true;          // a real thunderstorm
  else if (weather && weather.storm === "often") run.storm = number >= 2 && number % 2 === 0;   // rain or strong wind
  else run.storm = number >= 6 && number % 2 === 0;
  run.fog = stage ? stage.fog : weather ? weather.fog : false;
  const windPush = weather ? weather.windPush : 1;     // a real gale pushes harder
  run.wind = run.storm ? (Math.random() < 0.5 ? -1 : 1) * WIND_SPEED * windPush : 0;

  // Stage rules: which waves bring the flagship or the kraken, extra raiders, tougher raiders.
  // Endless voyage: the kraken every 10th wave, the flagship every other 5th wave.
  const krakenWave = stage ? (stage.kraken || []).includes(number) : number % 10 === 0;
  const bossWave = krakenWave || (stage ? stage.bossWaves.includes(number) : number % 5 === 0);
  const extra = stage ? stage.extra : 0;
  const raiders = (bossWave ? 2 : Math.min(2 + number, 8)) + extra;
  run.toughness = number + (stage ? stage.harder : 0);
  run.spawnQueue = [];
  if (krakenWave) {
    spawnKraken(W, H, run.toughness);
    setTimeout(() => emit("kraken:rose"), 900);
  } else if (bossWave) {
    spawnBoss(W, H, run.toughness);
  }
  // The mix of ships gets harder: cutters from wave 3, ironclads from wave 5.
  for (let i = 0; i < raiders; i++) {
    let type = "raider";
    if (run.toughness >= 5 && i % 4 === 3) type = "ironclad";
    else if (run.toughness >= 3 && i % 3 === 1) type = "cutter";
    run.spawnQueue.push(type);
  }
  run.spawnTimer = 0.4;
  clearSlams();
  if (planEvent(number, SEA_EVENT_CHANCE, bossWave)) run.seaEvents += 1;

  let text = "";
  let colour = null;
  if (krakenWave) {
    text = "The kraken rises from the deep - dodge its tentacles";
    colour = "#e07ad8";
  } else if (bossWave) {
    text = "The raider flagship is coming";
    colour = "#de6a48";
  } else if (run.storm) {
    text = "Storm: the wind pushes your ship";
    colour = "#6fe0a8";
  }
  if (run.fog && !bossWave) {
    text = "Fog: watch your radar";
    colour = "#b9c9d6";
  }
  if (stage && number === 1) {
    text = "Stage " + stage.id + " · " + stage.name + " - win " + stage.waves + " waves";
    colour = "#f3d48a";
  }
  if (weather && number === 1) {
    text = "Live weather in " + weather.cityName + ": " + weather.label + ", " + weather.temperature + "°C";
    colour = "#8fd3ff";
  }
  const title = stage ? "WAVE " + number + " / " + stage.waves : "WAVE " + number;
  run.banner = { title: title, text: text, colour: colour, time: 2.6 };
  emit("wave:started", { wave: number, boss: bossWave, storm: run.storm });
}

// All raiders sunk: repair, bank the gold, then open the Shipyard.
async function clearWave() {
  state = "clearing";
  closeSonar();
  clearEvent();
  clearSlams();
  if (!run.damagedThisWave) {
    run.untouched = true;
  }
  ship.hull = Math.min(stats.maxHull, ship.hull + WAVE_REPAIR);
  // The last wave of a Campaign stage: the stage is won.
  if (run.stage && run.wave >= run.stage.waves) {
    winStage();
    return;
  }
  await bankGold();
  if (state !== "clearing") {
    return;
  }
  state = "shipyard";
  yardTitle.textContent = "Wave " + run.wave + " cleared";
  sailButton.textContent = "Sail to wave " + (run.wave + 1);
  yardPanel.hidden = false;
  emit("wave:cleared", { wave: run.wave });
  await showShipyard(document.getElementById("yard-list"), document.getElementById("yard-gold"),
    document.getElementById("yard-message"));
  sailButton.focus();
}

// Sends the gold earned since the last wave to the server, which keeps it safe.
async function bankGold() {
  if (run.battleGold === 0) {
    return;
  }
  const amount = run.battleGold;
  run.battleGold = 0;
  try {
    const progress = await depositGold(amount);
    run.bankedGold = progress.gold;
  } catch (error) {
    console.error(error);
    run.battleGold += amount;                 // try again later
  }
}

function sail() {
  if (state !== "shipyard") return;
  yardPanel.hidden = true;
  startWave(run.wave + 1);
  state = "playing";
  canvas.focus();
}

// The battle's result, for the end panel and for saving the score.
function summary() {
  return {
    score: run.score,
    wave: run.wave,
    sunk: run.sunk,
    bosses: run.bosses,
    goldEarned: run.goldEarned,
    puzzlesSolved: run.puzzlesSolved,
    underFire: run.underFire,
    untouched: run.untouched,
    bestCombo: run.bestCombo,
    difficulty: run.difficulty,
    specialsUsed: run.specialsUsed,
    cutters: run.typeSunk.cutter,
    ironclads: run.typeSunk.ironclad,
    seaEvents: run.seaEvents,
    escorts: run.escorts,
    stage: run.stage
  };
}

// The Campaign stage goal was reached. The server checks the win, unlocks the next
// stage and pays the reward.
async function winStage() {
  state = "over";
  closeSonar();
  stopAmbience();
  await bankGold();
  const result = summary();
  result.victory = true;
  try {
    result.campaign = await completeStage(run.stage.id);
    run.bankedGold = result.campaign.gold;
  } catch (error) {
    result.campaignError = error.message;
  }
  emit("stage:won", result);
  emit("battle:over", result);
}

async function sinkPlayer() {
  state = "over";
  closeSonar();
  explode(ship.x, ship.y, true);
  stopAmbience();
  await bankGold();
  emit("battle:over", summary());
}

// A raider, flagship or kraken has sunk: points (times the combo), gold and a floating text.
function sinkRaider(wreck, cause) {
  const reward = REWARDS[wreck.type] || REWARDS.raider;
  const level = getDifficulty();
  explode(wreck.x, wreck.y, wreck.boss);
  run.sunk += 1;
  if (run.typeSunk[wreck.type] !== undefined) run.typeSunk[wreck.type] += 1;

  // Combo: each ship sunk within COMBO_SECONDS of the last one adds to the chain.
  const combo = run.combo;
  combo.count = combo.timer > 0 ? combo.count + 1 : 1;
  combo.timer = COMBO_SECONDS;
  combo.pop = 0.3;
  combo.multiplier = Math.min(3, 1 + 0.5 * Math.floor((combo.count - 1) / 2));   // x1, x1.5, x2 ... x3
  run.bestCombo = Math.max(run.bestCombo, combo.count);
  if (combo.count >= 2) emit("combo:changed", { count: combo.count, multiplier: combo.multiplier });

  const points = Math.round(reward.points * combo.multiplier * level.score);
  const gold = Math.round(reward.gold * level.gold);
  run.score += points;
  addGold(gold);
  popup(wreck.x, wreck.y - 30, "+" + points + (combo.multiplier > 1 ? "  x" + combo.multiplier : ""), combo.multiplier > 1 ? "#ff9a4d" : "#ffe9a8", wreck.boss);

  if (wreck.type === "kraken") {
    run.bosses += 1;
    say("The kraken sinks back into the deep! +" + points + " points, +" + gold + " gold.", "good");
  } else if (wreck.boss) {
    run.bosses += 1;
    say("The flagship is sunk! +" + points + " points, +" + gold + " gold.", "good");
  } else if (cause === "whirlpool") {
    say("A raider was swallowed by the whirlpool! +" + points + " points.", "good");
  }
  emit("raider:sunk", wreck);
}

function updateCombo(seconds) {
  const combo = run.combo;
  combo.pop = Math.max(0, combo.pop - seconds);
  if (combo.timer > 0) {
    combo.timer -= seconds;
    if (combo.timer <= 0) {
      if (combo.count >= 2) emit("combo:ended", { count: combo.count });
      combo.count = 0;
      combo.multiplier = 1;
    }
  }
}

// Damage to our ship from anything. steady: small damage every frame (the whirlpool).
function hurtShip(damage, steady = false) {
  if (damage <= 0) return;
  damage *= getDifficulty().enemyDamage;
  if (run.shield > 0) {
    if (!steady) emit("shield:blocked");
    return;
  }
  ship.hull = Math.max(0, ship.hull - damage);
  run.damagedThisWave = true;
  if (steady) return;
  run.flash = 0.15;
  if (getSettings().shake && !getSettings().reduceMotion) addShake(0.5);
  // Being hit breaks the combo.
  if (run.combo.count >= 2) emit("combo:ended", { count: run.combo.count });
  run.combo.count = 0;
  run.combo.timer = 0;
  run.combo.multiplier = 1;
  emit("player:hit", damage);
}

function popup(x, y, text, colour, big) {
  run.popups.push({ x: x, y: y, text: text, colour: colour, big: big === true, life: 1.2 });
}

function addGold(amount) {
  if (run.stage && run.stage.goldBonus > 1 && amount !== GOLD.chest) amount *= run.stage.goldBonus;
  run.battleGold += amount;
  run.goldEarned += amount;
  emit("gold:gained", amount);
}

// ----- Events from other parts of the game -----

on("battle:start", startBattle);
on("battle:stop", stopBattle);
on("battle:resume", resume);
on("player:changed", (player) => {
  captain = player.username || "Guest";
});

// The sonar puzzle was solved: refill the cannons and settle the chest gamble.
on("sonar:reloaded", (result) => {
  if (state !== "playing" && state !== "paused") return;
  ship.ammo = stats.cap;
  run.score += POINTS.reload;
  run.puzzlesSolved += 1;
  if (ship.hull < 20) {
    run.underFire = true;                     // badge: reload with hull below 20
  }
  // Every solved puzzle loads one special shot; counting the chests right too adds a broadside.
  const prize = Math.random() < 0.5 ? "chain" : "fire";
  run.specials[prize] += 1;
  if (result.chestCorrect === true) run.specials.broadside += 1;
  emit("special:earned", { kind: prize, broadside: result.chestCorrect === true });
  if (result.chestCorrect === true) {
    addGold(GOLD.chest);
    say("Reloaded. " + result.chests + " chests - right! +" + GOLD.chest + " gold.", "good");
  } else if (result.chestCorrect === false) {
    ship.hull = Math.max(1, ship.hull - CHEST_PENALTY);
    run.flash = 0.2;
    say("Reloaded. Chest count wrong, there were " + result.chests + ". -" + CHEST_PENALTY + " hull.", "warn");
  } else {
    say("Reloaded. +" + POINTS.reload + " points.", "good");
  }
  canvas.focus();
});

// An upgrade was bought between waves: the ship gets better straight away.
on("shipyard:bought", (progress) => {
  if (state !== "shipyard") return;
  const oldMax = stats.maxHull;
  applyUpgrades(progress);
  ship.hull += stats.maxHull - oldMax;        // new armour comes ready to use
});

sailButton.addEventListener("click", sail);
document.getElementById("resume-button").addEventListener("click", resume);
sonarButton.addEventListener("click", () => {
  if (state === "playing" && ship.ammo < stats.cap) {
    openSonar({ jamSeconds: stats.jamSeconds });
  }
});

// Event: keys that do one thing per press.
window.addEventListener("keydown", (event) => {
  if (state === "idle") return;
  const key = String(event.key || "").toLowerCase();      // some browser events (e.g. autofill) have no key

  if (key === "escape") {
    if (isSonarOpen()) {
      closeSonar();
      canvas.focus();
    } else if (state === "playing") {
      pause();
    } else if (state === "paused") {
      resume();
    }
    return;
  }
  if (isTyping(event)) return;

  if (key === "p") {
    if (state === "playing") pause();
    else if (state === "paused") resume();
  } else if (key === "r" && state === "playing" && ship.ammo < stats.cap && !isSonarOpen()) {
    openSonar({ jamSeconds: stats.jamSeconds });
  } else if (["1", "2", "3", "4"].includes(key) && (state === "playing" || state === "paused")) {
    chooseShot(SHOT_KINDS[Number(key) - 1]);
  } else if (key === "q" && (state === "playing" || state === "paused")) {
    cycleShot();
  }
});

// Chooses which shot the cannons fire next (a special needs at least one left).
export function chooseShot(kind) {
  if (!run || !SHOT_KINDS.includes(kind)) return;
  if (kind !== "iron" && run.specials[kind] === 0) {
    say("No " + SHOT_NAMES[kind].toLowerCase() + "s loaded. Solve sonar puzzles to earn them.", "warn");
    return;
  }
  run.selected = kind;
  emit("special:chosen", kind);
}

// Q (or the touch button): the next shot type that has ammunition.
export function cycleShot() {
  if (!run) return;
  let index = SHOT_KINDS.indexOf(run.selected);
  for (let i = 0; i < SHOT_KINDS.length; i++) {
    index = (index + 1) % SHOT_KINDS.length;
    const kind = SHOT_KINDS[index];
    if (kind === "iron" || run.specials[kind] > 0) {
      run.selected = kind;
      emit("special:chosen", kind);
      return;
    }
  }
}

// Leaving the tab pauses the battle, so nobody loses their ship while away.
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause();
});

// ----- Every frame -----

function updatePlayer(seconds) {
  const arrows = getSettings().keys === "arrows";
  let moveX = 0;
  let moveY = 0;
  if (isDown(arrows ? "arrowleft" : "a")) moveX -= 1;
  if (isDown(arrows ? "arrowright" : "d")) moveX += 1;
  if (isDown(arrows ? "arrowup" : "w")) moveY -= 1;
  if (isDown(arrows ? "arrowdown" : "s")) moveY += 1;
  const stick = getVirtualMove();                // the touch joystick, if used
  moveX += stick.x;
  moveY += stick.y;

  if (moveX !== 0 || moveY !== 0) {
    const length = Math.hypot(moveX, moveY);
    const power = Math.min(1, length);            // a half-pushed joystick sails at half speed
    ship.x += (moveX / length) * SHIP_SPEED * power * seconds;
    ship.y += (moveY / length) * SHIP_SPEED * power * seconds;
    ship.foamTimer -= seconds;
    if (ship.foamTimer <= 0) {
      foam(ship.x - Math.cos(ship.angle) * 20, ship.y - Math.sin(ship.angle) * 20);
      ship.foamTimer = 0.06;
    }
  }
  ship.x += run.wind * seconds;                         // storm wind
  // Keep the whole ship picture on screen (it is taller than it is wide).
  ship.x = Math.max(EDGE + 25, Math.min(W - EDGE - 25, ship.x));
  ship.y = Math.max(EDGE + 45, Math.min(H - EDGE - 20, ship.y));

  const mouse = getMouse();
  ship.angle = Math.atan2(mouse.y - ship.y, mouse.x - ship.x);

  ship.cooldown -= seconds;
  if (mouse.down && ship.cooldown <= 0 && ship.ammo > 0) {
    // a special shot if one is chosen and left, otherwise plain iron
    let kind = run.selected;
    if (kind !== "iron" && run.specials[kind] > 0) {
      run.specials[kind] -= 1;
      run.specialsUsed += 1;
      emit("special:fired", kind);
      if (run.specials[kind] === 0) run.selected = "iron";
    } else {
      kind = "iron";
    }
    fireShot(ship, stats.damage, kind);
    ship.ammo -= 1;
    ship.cooldown = run.rapid > 0 ? FIRE_DELAY / 2 : FIRE_DELAY;
    emit("shot:fired");
    if (ship.ammo === 0) {
      say("Out of shots. Press R or the Sonar button to reload.", "warn");
    }
  }
}

function update(seconds) {
  time += seconds;
  updateEffects(seconds);
  if (run && run.banner) run.banner.time -= seconds;
  if (state !== "playing") {
    return;
  }

  run.shield = Math.max(0, run.shield - seconds);
  run.rapid = Math.max(0, run.rapid - seconds);
  run.flash = Math.max(0, run.flash - seconds);

  // Raiders join the wave one by one.
  if (run.spawnQueue.length > 0) {
    run.spawnTimer -= seconds;
    if (run.spawnTimer <= 0) {
      const type = run.spawnQueue.shift();
      spawnRaider(W, H, run.toughness, type);
      run.spawnTimer = 0.6;
    }
  }

  updatePlayer(seconds);
  updateShots(seconds);
  updateRaiders(seconds, ship, W, H);

  for (const raider of getRaiders()) applyDifficulty(raider);   // Easy / Normal / Hard

  // Our cannonballs hitting raiders.
  const result = checkHits(getShots());
  for (let i = 0; i < result.hits; i++) emit("raider:hit");
  for (const wreck of result.sunk) sinkRaider(wreck, "cannon");

  // Raider cannonballs and kraken ink hitting us.
  hurtShip(checkPlayerHit(ship));
  // Tentacle slams (the kraken, or a tentacle attack).
  hurtShip(updateSlams(seconds, ship));

  // Sea events: whirlpool, merchant escort, tentacle attack.
  const sea = updateEvent(seconds, ship, getRaiders(), W, H);
  if (sea.message) {
    const info = EVENT_INFO[sea.message];
    run.banner = { title: info.title, text: info.text, colour: info.colour, time: 2.6 };
    say(info.text + ".", "warn");
    emit("sea:event", sea.message);
  }
  if (sea.damage > 0) hurtShip(sea.damage, true);
  if (sea.reward) {
    run.score += sea.reward.points;
    addGold(sea.reward.gold);
    run.escorts += 1;
    popup(ship.x, ship.y - 70, "+" + sea.reward.gold + " gold", "#ffd36b", true);
    say("The merchant is safe! +" + sea.reward.points + " points, +" + sea.reward.gold + " gold.", "good");
    emit("sea:reward", sea.reward);
  }
  for (const wreck of removeWrecks()) sinkRaider(wreck, "whirlpool");   // torn apart by the whirlpool

  // The combo runs out if no ship is sunk in time.
  updateCombo(seconds);
  for (const p of run.popups) { p.life -= seconds; p.y -= 40 * seconds; }
  run.popups = run.popups.filter((p) => p.life > 0);

  // Supply crates.
  const picked = updatePowerups(seconds, ship, W, H);
  if (picked) {
    if (picked === "shield") run.shield = POWERUPS.shield.seconds;
    if (picked === "rapid") run.rapid = POWERUPS.rapid.seconds;
    if (picked === "repair") ship.hull = Math.min(stats.maxHull, ship.hull + 25);
    say(POWERUPS[picked].label + ": " + POWERUPS[picked].text + ".", "good");
    emit("powerup:picked", picked);
  }

  if (ship.hull <= 0) {
    sinkPlayer();
    return;
  }

  // Wave cleared when every raider is sunk and no more are waiting.
  if (getRaiders().length === 0 && run.spawnQueue.length === 0) {
    run.clearTimer += seconds;
    if (run.clearTimer > 1.2) {
      run.clearTimer = 0;
      clearWave();
    }
  } else {
    run.clearTimer = 0;
  }
}

function powerLabel() {
  if (run.shield > 0) return "SHIELD " + Math.ceil(run.shield) + "s";
  if (run.rapid > 0) return "RAPID FIRE " + Math.ceil(run.rapid) + "s";
  return "";
}

function draw() {
  if (state === "idle" || state === "loading" || !run) {
    return;
  }
  const colours = {};
  for (const key in POWERUPS) colours[key] = POWERUPS[key].color;

  drawBattle(ctx, {
    width: W, height: H, time: time, ship: ship,
    raiders: getRaiders(), shots: getShots(), enemyShots: getEnemyShots(),
    crates: getCrates(), crateColours: colours, effects: getEffects(),
    mouse: getMouse(), aiming: state === "playing",
    storm: run.storm, fog: run.fog, shield: run.shield > 0,
    shipAfloat: state !== "over", shipFlash: run.flash > 0,
    hullRatio: ship.hull / stats.maxHull,
    boss: getBoss(),
    outOfShots: state === "playing" && ship.ammo === 0 && !isSonarOpen(),
    banner: run.banner,
    combo: { count: run.combo.count, multiplier: run.combo.multiplier, pop: run.combo.pop, timeLeft: Math.max(0, run.combo.timer / COMBO_SECONDS) },
    popups: run.popups,
    look: getMyShip(),
    specials: { selected: run.selected, chain: run.specials.chain, fire: run.specials.fire, broadside: run.specials.broadside },
    shake: getSettings().shake && !getSettings().reduceMotion ? getShake() : 0
  });

  updateHud({
    captain: captain,
    hull: ship.hull, maxHull: stats.maxHull,
    ammo: ship.ammo, cap: stats.cap,
    wave: run.stage ? run.wave + "/" + run.stage.waves : run.wave, storm: run.storm,
    gold: run.bankedGold + run.battleGold,
    score: run.score,
    power: powerLabel()
  });

  sonarButton.disabled = state !== "playing" || ship.ammo >= stats.cap;
  sonarButton.classList.toggle("hot", state === "playing" && ship.ammo === 0 && !isSonarOpen());
}

// The game loop: work out how much time passed, update, then draw.
let lastTime = performance.now();
function gameLoop(now) {
  const seconds = Math.max(0, Math.min(0.1, (now - lastTime) / 1000));   // never jump too far, never go back
  lastTime = now;
  update(seconds);
  draw();
  requestAnimationFrame(gameLoop);
}

watchMouse(canvas);
requestAnimationFrame(gameLoop);

// For testing in the browser console only: lets a test check the state.
window.blackTides = {
  getState: () => state, getShip: () => ship, getRun: () => run,
  seaEvent: (kind) => forceEvent(kind),                     // e.g. blackTides.seaEvent("whirlpool")
  kraken: () => spawnKraken(W, H, run ? run.toughness : 1)
};
