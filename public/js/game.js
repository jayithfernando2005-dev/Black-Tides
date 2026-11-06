// game.js - the battle itself: the game loop, the player's ship, waves,
// bosses, storms, power-ups, pausing, and the end of the battle.
// It talks to the screens only through events (battle:start, battle:over, ...).
import { drawBattle } from "./renderer.js";
import { isDown, getMouse, watchMouse, isTyping } from "./input.js";
import { fireShot, updateShots, checkPlayerHit, clearShots, getShots, getEnemyShots } from "./shots.js";
import { spawnRaider, spawnBoss, updateRaiders, checkHits, clearRaiders, getRaiders, getBoss } from "./enemies.js";
import { POWERUPS, updatePowerups, getCrates, clearPowerups } from "./powerups.js";
import { explode, foam, addShake, updateEffects, getEffects, getShake, clearEffects } from "./effects.js";
import { openSonar, closeSonar, isSonarOpen } from "./sonar.js";
import { showShipyard } from "./shipyard.js";
import { updateHud, resetHud } from "./hud.js";
import { getProgress, depositGold, startStage, completeStage } from "./api.js";
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
const POINTS = { raider: 100, boss: 600, reload: 50 };
const GOLD = { raider: 10, boss: 60, chest: 25 };
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
    storm: false, wind: 0, shield: 0, rapid: 0, flash: 0, banner: null
  };
  say("Preparing your ship...");
  let progress = { gold: 0 };
  try {
    // A Campaign stage must be unlocked: the server checks before the battle begins.
    if (voyage && voyage.mode === "stage" && voyage.stage) {
      run.stage = (await startStage(voyage.stage.id)).stage;
    }
    progress = await getProgress();
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
  clearShots();
  clearPowerups();
  clearEffects();
  resetHud();
  startWave(1);
  state = "playing";
  startAmbience();
  say("Steer, aim with the mouse, click to fire. Press R for the sonar when you run low.");
  canvas.focus();
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
  if (stage && stage.storm === "always") run.storm = true;
  else if (stage && stage.storm === "never") run.storm = false;
  else run.storm = number >= 6 && number % 2 === 0;
  run.fog = stage ? stage.fog : false;
  run.wind = run.storm ? (Math.random() < 0.5 ? -1 : 1) * WIND_SPEED : 0;

  // Stage rules: which waves bring the flagship, extra raiders, tougher raiders.
  const bossWave = stage ? stage.bossWaves.includes(number) : number % 5 === 0;
  const extra = stage ? stage.extra : 0;
  const raiders = (bossWave ? 2 : Math.min(2 + number, 8)) + extra;
  run.toughness = number + (stage ? stage.harder : 0);
  run.spawnQueue = [];
  if (bossWave) {
    spawnBoss(W, H, run.toughness);
  }
  for (let i = 0; i < raiders; i++) {
    run.spawnQueue.push("raider");
  }
  run.spawnTimer = 0.4;

  let text = "";
  let colour = null;
  if (bossWave) {
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
  const title = stage ? "WAVE " + number + " / " + stage.waves : "WAVE " + number;
  run.banner = { title: title, text: text, colour: colour, time: 2.6 };
  emit("wave:started", { wave: number, boss: bossWave, storm: run.storm });
}

// All raiders sunk: repair, bank the gold, then open the Shipyard.
async function clearWave() {
  state = "clearing";
  closeSonar();
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
  const key = event.key.toLowerCase();

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
  }
});

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

  if (moveX !== 0 || moveY !== 0) {
    const length = Math.hypot(moveX, moveY);
    ship.x += (moveX / length) * SHIP_SPEED * seconds;
    ship.y += (moveY / length) * SHIP_SPEED * seconds;
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
    fireShot(ship, stats.damage);
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
      run.spawnQueue.shift();
      spawnRaider(W, H, run.toughness);
      run.spawnTimer = 0.6;
    }
  }

  updatePlayer(seconds);
  updateShots(seconds);
  updateRaiders(seconds, ship, W, H);

  // Our cannonballs hitting raiders.
  const result = checkHits(getShots());
  for (let i = 0; i < result.hits; i++) emit("raider:hit");
  for (const wreck of result.sunk) {
    explode(wreck.x, wreck.y, wreck.boss);
    run.sunk += 1;
    if (wreck.boss) {
      run.bosses += 1;
      run.score += POINTS.boss;
      addGold(GOLD.boss);
      say("The flagship is sunk! +" + POINTS.boss + " points, +" + GOLD.boss + " gold.", "good");
    } else {
      run.score += POINTS.raider;
      addGold(GOLD.raider);
    }
    emit("raider:sunk", wreck);
  }

  // Raider cannonballs hitting us.
  const damage = checkPlayerHit(ship);
  if (damage > 0) {
    if (run.shield > 0) {
      emit("shield:blocked");
    } else {
      ship.hull = Math.max(0, ship.hull - damage);
      run.damagedThisWave = true;
      run.flash = 0.15;
      if (getSettings().shake) addShake(0.5);
      emit("player:hit", damage);
    }
  }

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
    shake: getSettings().shake ? getShake() : 0
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
window.blackTides = { getState: () => state, getShip: () => ship, getRun: () => run };
