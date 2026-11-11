// AI note: written with help from Claude (Anthropic), as allowed for this assignment.
// renderer.js - draws the battle on the canvas. It only draws; it never
// changes the game. Visual style based on the Black Tides prototype.
import { drawKraken } from "./krakenArt.js";
import { drawSlamWarnings, drawSlamTentacles } from "./hazards.js";
import { drawEventBelow, drawEventAbove } from "./seaEvents.js";
import * as art from "./battleArt.js";

const TAU = Math.PI * 2;
let lastTime = 0;
export const COLOURS = {
  sea1: "#0f3948", sea2: "#0a2732", storm1: "#0b2a35", storm2: "#061a21",
  bone: "#ece4cf", deck: "#b9ae90", rust: "#de6a48", rustDeck: "#8f3d27",
  brass: "#dba63f", sonar: "#6fe0a8", dark: "#06141a"
};

// Long, gentle swell lines that drift on the sea.
const swells = [];
for (let i = 0; i < 26; i++) {
  swells.push({ x: Math.random() * 960, y: Math.random() * 600, w: 40 + Math.random() * 60, phase: Math.random() * TAU });
}

// Rain drops for storm waves.
const rain = [];
for (let i = 0; i < 140; i++) {
  rain.push({ x: Math.random() * 1100, y: Math.random() * 600, speed: 500 + Math.random() * 300 });
}

export function drawSea(ctx, width, height, time, storm) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, storm ? COLOURS.storm1 : COLOURS.sea1);
  gradient.addColorStop(1, storm ? COLOURS.storm2 : COLOURS.sea2);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = storm ? "rgba(207,227,230,0.2)" : "rgba(207,227,230,0.13)";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  for (const swell of swells) {
    const x = (swell.x + Math.sin(time * 0.6 + swell.phase) * (storm ? 16 : 8)) * (width / 960);
    const y = swell.y * (height / 600);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + swell.w / 2, y - (storm ? 8 : 5), x + swell.w, y);
    ctx.stroke();
  }
}

// One ship, seen from above: hull, deck, four cannons and a mast.
export function drawShip(ctx, x, y, angle, scale, hull, deck, flash) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.fillStyle = flash ? "#ffffff" : hull;
  ctx.beginPath();
  ctx.moveTo(24, 0); ctx.lineTo(8, -10); ctx.lineTo(-17, -9); ctx.lineTo(-21, 0);
  ctx.lineTo(-17, 9); ctx.lineTo(8, 10); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = deck;
  ctx.beginPath();
  ctx.moveTo(15, 0); ctx.lineTo(6, -5.5); ctx.lineTo(-14, -5); ctx.lineTo(-14, 5); ctx.lineTo(6, 5.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COLOURS.dark;
  ctx.fillRect(-8, -12, 4, 5); ctx.fillRect(2, -12, 4, 5);
  ctx.fillRect(-8, 7, 4, 5); ctx.fillRect(2, 7, 4, 5);
  ctx.beginPath(); ctx.arc(-2, 0, 3, 0, TAU); ctx.fill();
  ctx.restore();
}

function drawCrosshair(ctx, x, y) {
  ctx.strokeStyle = COLOURS.brass;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 12, 0, TAU);
  ctx.moveTo(x - 19, y); ctx.lineTo(x - 7, y);
  ctx.moveTo(x + 7, y); ctx.lineTo(x + 19, y);
  ctx.moveTo(x, y - 19); ctx.lineTo(x, y - 7);
  ctx.moveTo(x, y + 7); ctx.lineTo(x, y + 19);
  ctx.stroke();
}

function drawCrate(ctx, crate, colour) {
  const bob = Math.sin(crate.bob * 3) * 3;
  const fading = crate.life < 3 && Math.floor(crate.life * 6) % 2 === 0;
  ctx.globalAlpha = fading ? 0.4 : 1;
  ctx.strokeStyle = colour;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(crate.x, crate.y + bob, 20, 0, TAU); ctx.stroke();
  ctx.fillStyle = "#6b4a22";
  ctx.fillRect(crate.x - 11, crate.y - 11 + bob, 22, 22);
  ctx.strokeStyle = colour;
  ctx.strokeRect(crate.x - 11, crate.y - 11 + bob, 22, 22);
  ctx.beginPath();
  ctx.moveTo(crate.x - 11, crate.y + bob); ctx.lineTo(crate.x + 11, crate.y + bob);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// The radar in the bottom-left corner: our ship in the middle, raiders as dots.
function drawRadar(ctx, scene) {
  const cx = 74, cy = scene.height - 74, radius = 58;
  ctx.fillStyle = "rgba(6,20,26,0.78)";
  ctx.beginPath(); ctx.arc(cx, cy, radius, 0, TAU); ctx.fill();
  ctx.strokeStyle = "rgba(111,224,168,0.45)";
  ctx.lineWidth = 1;
  for (const r of [radius, radius * 0.66, radius * 0.33]) {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
  }
  // The sweeping line.
  const sweep = scene.time * 2.2;
  ctx.strokeStyle = "rgba(111,224,168,0.8)";
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(sweep) * radius, cy + Math.sin(sweep) * radius); ctx.stroke();

  const range = 520;                          // pixels of sea shown on the radar
  for (const raider of scene.raiders) {
    const dx = (raider.x - scene.ship.x) / range;
    const dy = (raider.y - scene.ship.y) / range;
    const d = Math.hypot(dx, dy);
    const k = d > 1 ? 1 / d : 1;              // raiders out of range sit on the rim
    ctx.fillStyle = COLOURS.rust;
    ctx.beginPath(); ctx.arc(cx + dx * k * radius, cy + dy * k * radius, raider.boss ? 5 : 3, 0, TAU); ctx.fill();
  }
  for (const crate of scene.crates) {
    const dx = (crate.x - scene.ship.x) / range;
    const dy = (crate.y - scene.ship.y) / range;
    const d = Math.hypot(dx, dy);
    const k = d > 1 ? 1 / d : 1;
    ctx.fillStyle = COLOURS.brass;
    ctx.fillRect(cx + dx * k * radius - 2, cy + dy * k * radius - 2, 4, 4);
  }
  ctx.fillStyle = COLOURS.bone;
  ctx.beginPath(); ctx.arc(cx, cy, 3, 0, TAU); ctx.fill();
  ctx.fillStyle = "rgba(111,224,168,0.9)";
  ctx.font = "11px 'Share Tech Mono', monospace";
  ctx.textAlign = "center";
  ctx.fillText("RADAR", cx, cy - radius - 6);
}

function drawRain(ctx, width, height, time) {
  ctx.strokeStyle = "rgba(200,220,230,0.28)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const drop of rain) {
    const y = (drop.y + time * drop.speed) % height;
    const x = (drop.x - time * drop.speed * 0.3) % 1100;
    const px = x < -100 ? x + 1100 : x;
    ctx.moveTo(px, y);
    ctx.lineTo(px - 5, y + 16);
  }
  ctx.stroke();
}

function drawBossBar(ctx, boss, width) {
  const barWidth = 320;
  const x = (width - barWidth) / 2;
  ctx.fillStyle = "rgba(6,20,26,0.8)";
  ctx.fillRect(x - 8, 10, barWidth + 16, 36);
  ctx.fillStyle = COLOURS.rust;
  ctx.font = "15px Staatliches, Impact, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("RAIDER FLAGSHIP", width / 2, 26);
  ctx.fillStyle = COLOURS.dark;
  ctx.fillRect(x, 32, barWidth, 8);
  ctx.fillStyle = COLOURS.rust;
  ctx.fillRect(x, 32, barWidth * Math.max(0, boss.hp / boss.maxHp), 8);
}

// Draws one whole frame of the battle from a description of the scene.
export function drawBattle(ctx, scene) {
  const { width, height, ship } = scene;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingQuality = "high";
  const seconds = Math.max(0, Math.min(0.1, scene.time - lastTime));
  lastTime = scene.time;
  // The painted look (battleArt.js) is used once its pictures have loaded.
  const painted = art.ready("sea") && art.ready("player") && art.ready("raider1") && art.ready("raider2") && art.ready("boss");
  if (art.ready("sea")) art.drawPaintedSea(ctx, width, height, scene.time, scene.storm);
  else drawSea(ctx, width, height, scene.time, scene.storm);
  art.drawMeteors(ctx, width, height, seconds);

  // Screen shake moves everything below except the instruments.
  if (scene.shake > 0) {
    ctx.translate((Math.random() * 2 - 1) * 7 * scene.shake, (Math.random() * 2 - 1) * 7 * scene.shake);
  }

  for (const effect of scene.effects) {
    if (effect.kind === "foam") {
      ctx.fillStyle = "rgba(207,227,230," + (0.3 * effect.life / effect.max) + ")";
      ctx.beginPath(); ctx.arc(effect.x, effect.y, effect.r * (1.6 - effect.life / effect.max), 0, TAU); ctx.fill();
    }
  }

  for (const crate of scene.crates) {
    if (art.ready("crate")) art.drawPaintedCrate(ctx, crate, scene.crateColours[crate.type], scene.time);
    else drawCrate(ctx, crate, scene.crateColours[crate.type]);
  }

  // Sea events and tentacle warnings sit on the water, under the ships.
  drawEventBelow(ctx, scene.time);
  drawSlamWarnings(ctx, scene.time);

  // Dashed aiming line from the ship to the mouse.
  if (scene.aiming) {
    ctx.strokeStyle = "rgba(232,195,114,0.55)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 8]);
    ctx.beginPath(); ctx.moveTo(ship.x, ship.y); ctx.lineTo(scene.mouse.x, scene.mouse.y); ctx.stroke();
    ctx.setLineDash([]);
  }

  // Painted ships are drawn before the cannonballs so the fire shows on top.
  if (painted) {
    const fleet = [...scene.raiders].sort((a, b) => a.y - b.y);   // ships further up are behind
    for (const raider of fleet) {
      if (raider.kraken) drawKraken(ctx, raider, scene.time);
      else art.drawPaintedRaider(ctx, raider, scene.time);
    }
    if (scene.shipAfloat) art.drawPaintedPlayer(ctx, ship, scene.time, scene.shipFlash, scene.look);
    for (const shot of scene.enemyShots) art.drawFireShot(ctx, shot);
    for (const shot of scene.shots) art.drawIronShot(ctx, shot);
  }

  ctx.fillStyle = COLOURS.rust;
  for (const shot of painted ? [] : scene.enemyShots) {
    ctx.beginPath(); ctx.arc(shot.x, shot.y, 5, 0, TAU); ctx.fill();
  }
  for (const shot of painted ? [] : scene.shots) {
    ctx.strokeStyle = "rgba(219,166,63,0.5)";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(shot.x, shot.y); ctx.lineTo(shot.x - shot.vx * 0.035, shot.y - shot.vy * 0.035); ctx.stroke();
    ctx.fillStyle = COLOURS.bone;
    ctx.beginPath(); ctx.arc(shot.x, shot.y, 4.5, 0, TAU); ctx.fill();
  }

  for (const raider of painted ? [] : scene.raiders) {
    if (raider.kraken) { drawKraken(ctx, raider, scene.time); continue; }
    drawShip(ctx, raider.x, raider.y, raider.angle, raider.scale, COLOURS.rust, COLOURS.rustDeck, raider.flash > 0);
    if (!raider.boss && raider.hp < raider.maxHp) {
      ctx.fillStyle = COLOURS.dark;
      ctx.fillRect(raider.x - 15, raider.y - raider.size - 14, 30, 4);
      ctx.fillStyle = COLOURS.rust;
      ctx.fillRect(raider.x - 15, raider.y - raider.size - 14, 30 * (raider.hp / raider.maxHp), 4);
    }
  }

  if (scene.shipAfloat) {
    if (!painted) drawShip(ctx, ship.x, ship.y, ship.angle, 1.15, COLOURS.bone, COLOURS.deck, scene.shipFlash);
    if (scene.shield) {
      ctx.strokeStyle = "rgba(111,224,168," + (0.55 + 0.3 * Math.sin(scene.time * 8)) + ")";
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(ship.x, ship.y - 10, painted ? 56 : 34, 0, TAU); ctx.stroke();
    }
  }

  for (const effect of scene.effects) {
    if (effect.kind === "spark") {
      ctx.globalAlpha = Math.max(0, effect.life / effect.max);
      ctx.fillStyle = effect.color;
      ctx.beginPath(); ctx.arc(effect.x, effect.y, effect.r, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    } else if (effect.kind === "ring") {
      ctx.strokeStyle = "rgba(236,228,207," + Math.max(0, effect.life / effect.max) + ")";
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(effect.x, effect.y, effect.r * (1 - effect.life / effect.max) + 6, 0, TAU); ctx.stroke();
    }
  }

  // Tentacles, the merchant ship, and floating points go over the ships.
  drawSlamTentacles(ctx, scene.time);
  drawEventAbove(ctx, scene.time);
  for (const popup of scene.popups || []) {
    ctx.globalAlpha = Math.max(0, Math.min(1, popup.life / 0.4));
    ctx.textAlign = "center";
    ctx.font = "700 " + (popup.big ? 24 : 18) + "px Cinzel, Georgia, serif";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(10,6,4,0.85)";
    ctx.strokeText(popup.text, popup.x, popup.y);
    ctx.fillStyle = popup.colour;
    ctx.fillText(popup.text, popup.x, popup.y);
    ctx.globalAlpha = 1;
  }

  if (scene.aiming) {
    if (painted) art.drawGoldCrosshair(ctx, scene.mouse.x, scene.mouse.y, scene.time);
    else drawCrosshair(ctx, scene.mouse.x, scene.mouse.y);
  }

  // Everything from here on is fixed to the screen (no shake).
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (scene.storm) {
    drawRain(ctx, width, height, scene.time);
  }
  // Fog (Campaign stages): the sea is hidden except close to your ship. The radar still sees.
  if (scene.fog) {
    const fx = ship.x, fy = ship.y - 10;
    const fog = ctx.createRadialGradient(fx, fy, 120, fx, fy, 330);
    fog.addColorStop(0, "rgba(150,165,175,0)");
    fog.addColorStop(0.6, "rgba(120,138,150,0.75)");
    fog.addColorStop(1, "rgba(100,118,130,0.95)");
    ctx.fillStyle = fog;
    ctx.fillRect(0, 0, width, height);
    // drifting patches of mist
    for (let i = 0; i < 7; i++) {
      const px = (i * 190 + scene.time * (14 + i * 3)) % (width + 300) - 150;
      const py = 60 + ((i * 97) % (height - 120)) + Math.sin(scene.time * 0.4 + i) * 20;
      const patch = ctx.createRadialGradient(px, py, 0, px, py, 150);
      patch.addColorStop(0, "rgba(190,205,212,0.22)");
      patch.addColorStop(1, "rgba(190,205,212,0)");
      ctx.fillStyle = patch;
      ctx.fillRect(px - 150, py - 150, 300, 300);
    }
  }
  if (scene.hullRatio < 0.3 && scene.shipAfloat) {
    const vignette = ctx.createRadialGradient(width / 2, height / 2, height * 0.4, width / 2, height / 2, width * 0.72);
    vignette.addColorStop(0, "rgba(222,106,72,0)");
    vignette.addColorStop(1, "rgba(222,106,72,0.34)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  }
  if (scene.boss) {
    if (painted) art.drawFlagshipPlaque(ctx, scene.boss, width);
    else drawBossBar(ctx, scene.boss, width);
  }
  if (scene.outOfShots) {
    ctx.globalAlpha = 0.65 + 0.35 * Math.sin(scene.time * 7);
    ctx.fillStyle = COLOURS.rust;
    ctx.textAlign = "center";
    ctx.font = "600 22px Barlow, system-ui, sans-serif";
    ctx.fillText("OUT OF SHOTS. PRESS R FOR SONAR", width / 2, scene.boss ? 90 : 40);
    ctx.globalAlpha = 1;
  }
  if (scene.banner && scene.banner.time > 0) {
    ctx.globalAlpha = Math.min(1, scene.banner.time);
    ctx.textAlign = "center";
    ctx.fillStyle = COLOURS.bone;
    ctx.font = "64px Staatliches, Impact, sans-serif";
    ctx.fillText(scene.banner.title, width / 2, height / 2 - 30);
    if (scene.banner.text) {
      ctx.fillStyle = scene.banner.colour || COLOURS.brass;
      ctx.font = "600 20px Barlow, system-ui, sans-serif";
      ctx.fillText(scene.banner.text, width / 2, height / 2 + 4);
    }
    ctx.globalAlpha = 1;
  }
  if (scene.specials) drawShotTray(ctx, scene.specials, width, height);
  if (scene.combo && scene.combo.count >= 2) drawCombo(ctx, scene.combo, width, scene.boss ? 72 : 16);
  // the radar is hidden only when the touch joystick is sitting on top of it
  const body = document.body.classList;
  if (!(body.contains("touch-play") && body.contains("touch-overlay"))) {
    if (art.ready("radar")) art.drawCompassRadar(ctx, scene);
    else drawRadar(ctx, scene);
  }
}

// The combo counter in the top-right corner, with a bar that empties as time runs out.
function drawCombo(ctx, combo, width, top) {
  const x = width - 20;
  ctx.save();
  ctx.textAlign = "right";
  const pulse = 1 + Math.max(0, combo.pop) * 0.6;            // grows for a moment on each new hit
  ctx.font = "900 " + Math.round(30 * pulse) + "px Cinzel, Georgia, serif";
  ctx.lineWidth = 5;
  ctx.strokeStyle = "rgba(20,8,4,0.85)";
  const label = "COMBO x" + combo.multiplier;
  ctx.strokeText(label, x, top + 30);
  const gold = ctx.createLinearGradient(0, top, 0, top + 32);
  gold.addColorStop(0, "#fff0b0"); gold.addColorStop(1, combo.multiplier >= 2 ? "#ff8a3d" : "#e2b13e");
  ctx.fillStyle = gold;
  ctx.fillText(label, x, top + 30);
  ctx.font = "700 13px Cinzel, Georgia, serif";
  ctx.fillStyle = "#f3e6c8";
  ctx.strokeText(combo.count + " sunk in a row", x, top + 50);
  ctx.fillText(combo.count + " sunk in a row", x, top + 50);
  ctx.fillStyle = "rgba(10,6,4,0.7)";
  ctx.fillRect(x - 150, top + 58, 150, 6);
  ctx.fillStyle = "#ffd36b";
  ctx.fillRect(x - 150 * combo.timeLeft, top + 58, 150 * combo.timeLeft, 6);
  ctx.restore();
}

// The shot tray at the bottom middle: iron (always), chain, fire and broadside with how many
// are loaded. The chosen one glows. Keys 1-4 choose, Q cycles.
const TRAY = [
  { kind: "iron", key: "1", label: "Iron", colour: "#cfd6dc" },
  { kind: "chain", key: "2", label: "Chain", colour: "#9fc8ff" },
  { kind: "fire", key: "3", label: "Fire", colour: "#ffab3d" },
  { kind: "broadside", key: "4", label: "Broadside", colour: "#ffe08a" }
];
function drawShotTray(ctx, specials, width, height) {
  const slot = 84, gap = 8;
  const total = TRAY.length * slot + (TRAY.length - 1) * gap;
  let x = (width - total) / 2;
  const y = height - 50;
  ctx.save();
  ctx.textAlign = "center";
  for (const item of TRAY) {
    const count = item.kind === "iron" ? "∞" : String(specials[item.kind]);
    const empty = item.kind !== "iron" && specials[item.kind] === 0;
    const chosen = specials.selected === item.kind;
    ctx.globalAlpha = empty ? 0.4 : 1;
    ctx.fillStyle = chosen ? "rgba(60,40,12,0.92)" : "rgba(14,10,6,0.72)";
    ctx.strokeStyle = chosen ? item.colour : "rgba(201,166,94,0.6)";
    ctx.lineWidth = chosen ? 3 : 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, slot, 38, 6);
    ctx.fill(); ctx.stroke();
    ctx.font = "700 11px Cinzel, Georgia, serif";
    ctx.fillStyle = "rgba(243,230,200,0.7)";
    ctx.fillText(item.key, x + 10, y + 14);
    ctx.font = "700 13px Cinzel, Georgia, serif";
    ctx.fillStyle = item.colour;
    ctx.fillText(item.label, x + slot / 2, y + 16);
    ctx.font = "700 14px 'Share Tech Mono', monospace";
    ctx.fillStyle = "#f3e6c8";
    ctx.fillText(count, x + slot / 2, y + 32);
    x += slot + gap;
  }
  ctx.restore();
}
