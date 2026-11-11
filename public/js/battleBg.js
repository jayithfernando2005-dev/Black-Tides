// AI note: written with help from Claude (Anthropic), as allowed for this assignment.
// battleBg.js - the living storm behind the battle (img/battle-backdrop.jpg).
//   - the clouds drift slowly and soft dark cloud banks roll across the sky
//   - the sea swells gently: each thin row of the sea is moved a tiny amount, changing
//     smoothly from row to row, so the water moves without any lines or streaks
//   - the lighthouse sweeps its beam, the glow at the rocks pulses, lightning flashes now and then
// Only for looks. It runs only while the battle is on screen, and it is still (no motion)
// when "Reduce motion" is on in Settings.
import { on } from "./events.js";
import { getSettings } from "./settings.js";

const canvas = document.getElementById("battle-bg");
const ctx = canvas.getContext("2d");
const image = new Image();
image.src = "img/battle-backdrop.jpg";

// Places in the picture (its own pixels, 1368 x 768).
const IMG_W = 1368;
const IMG_H = 768;
const HORIZON = 322;                       // where the sky meets the sea
const LIGHTHOUSE = { x: 191, y: 284 };     // the lamp at the top of the lighthouse
const ROCK_GLOW = { x: 718, y: 352 };      // the teal glow at the foot of the rocks
const TAU = Math.PI * 2;

let running = false;
let width = 0;
let height = 0;
let time = 0;
let last = 0;
let flash = 0;                             // lightning brightness, fades from 1 to 0
let nextFlash = 6;
let clouds = [];

function resize() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.imageSmoothingQuality = "high";
  clouds = Array.from({ length: 6 }, (_, i) => ({
    x: Math.random() * width, y: 0.04 + Math.random() * 0.28, size: 0.18 + Math.random() * 0.2,
    speed: 4 + Math.random() * 6, dark: i % 2 === 0
  }));
}

function frame(now) {
  if (!running) return;
  const seconds = Math.max(0, Math.min(0.05, (now - last) / 1000));
  last = now;
  const still = getSettings().reduceMotion;
  if (!still) time += seconds;
  draw(seconds, still);
  requestAnimationFrame(frame);
}

function draw(seconds, still) {
  ctx.fillStyle = "#05090c";
  ctx.fillRect(0, 0, width, height);
  if (!image.complete || !image.naturalWidth) return;

  // fit the picture to cover the screen (a little larger, so the drift never shows an edge)
  const scale = Math.max(width / IMG_W, height / IMG_H) * 1.06;
  const dw = IMG_W * scale;
  const dh = IMG_H * scale;
  const ox = (width - dw) / 2;
  const oy = (height - dh) / 2;
  const sx = (x) => ox + x * scale;
  const sy = (y) => oy + y * scale;

  // --- the sky: drifts slowly sideways ---
  const drift = Math.sin(time * 0.05) * 14;
  ctx.drawImage(image, 0, 0, IMG_W, HORIZON, ox + drift, oy, dw, HORIZON * scale);

  // rolling cloud banks (soft dark shapes) moving across the sky
  for (const cloud of clouds) {
    if (!still) cloud.x += cloud.speed * seconds;
    const w = width * cloud.size;
    if (cloud.x - w > width) cloud.x = -w;
    const cy = oy + HORIZON * scale * cloud.y;
    const shade = ctx.createRadialGradient(cloud.x, cy, 0, cloud.x, cy, w);
    shade.addColorStop(0, cloud.dark ? "rgba(8,12,18,0.42)" : "rgba(70,80,96,0.16)");
    shade.addColorStop(1, "rgba(8,12,18,0)");
    ctx.fillStyle = shade;
    ctx.save();
    ctx.translate(cloud.x, cy);
    ctx.scale(1, 0.32);
    ctx.beginPath(); ctx.arc(0, 0, w, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // --- the sea: thin rows, each moved a tiny, smoothly changing amount (no lines) ---
  const step = 2;                          // rows of 2 picture pixels
  for (let y = HORIZON; y < IMG_H; y += step) {
    const depth = (y - HORIZON) / (IMG_H - HORIZON);          // 0 at the horizon, 1 at the bottom
    const swell = Math.sin(y * 0.016 - time * 0.8) * (0.6 + 2.2 * depth) + Math.sin(y * 0.007 + time * 0.45) * 1.2 * depth;
    const lift = Math.sin(y * 0.011 - time * 0.6) * 1.2 * depth;   // waves rise and fall a little
    ctx.drawImage(image, 0, y, IMG_W, step + 1, ox + swell * scale * 0.6, sy(y) + lift, dw, (step + 1) * scale);
  }

  // the teal glow at the rocks breathes
  const glow = 0.25 + 0.2 * Math.sin(time * 1.3);
  const gx = sx(ROCK_GLOW.x), gy = sy(ROCK_GLOW.y);
  const teal = ctx.createRadialGradient(gx, gy, 0, gx, gy, 170 * scale);
  teal.addColorStop(0, "rgba(60,220,200," + glow + ")");
  teal.addColorStop(1, "rgba(60,220,200,0)");
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = teal;
  ctx.beginPath(); ctx.ellipse(gx, gy, 170 * scale, 50 * scale, 0, 0, TAU); ctx.fill();

  // the lighthouse: a lamp and a beam that sweeps round
  const lx = sx(LIGHTHOUSE.x) + drift, ly = sy(LIGHTHOUSE.y);
  const angle = time * 0.9;
  const facing = Math.cos(angle);                              // brightest when it points at us
  const beamLength = 260 * scale * (0.35 + 0.65 * Math.abs(Math.sin(angle)));
  const dir = Math.sin(angle) >= 0 ? 1 : -1;
  const beam = ctx.createLinearGradient(lx, ly, lx + dir * beamLength, ly);
  beam.addColorStop(0, "rgba(255,236,170,0.5)");
  beam.addColorStop(1, "rgba(255,236,170,0)");
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(lx, ly);
  ctx.lineTo(lx + dir * beamLength, ly - 26 * scale);
  ctx.lineTo(lx + dir * beamLength, ly + 22 * scale);
  ctx.closePath(); ctx.fill();
  const lamp = ctx.createRadialGradient(lx, ly, 0, lx, ly, 26 * scale);
  lamp.addColorStop(0, "rgba(255,244,200," + (0.55 + 0.4 * Math.max(0, facing)) + ")");
  lamp.addColorStop(1, "rgba(255,220,140,0)");
  ctx.fillStyle = lamp;
  ctx.beginPath(); ctx.arc(lx, ly, 26 * scale, 0, TAU); ctx.fill();
  ctx.restore();

  // lightning now and then: the sky lights up, then fades
  if (!still) {
    nextFlash -= seconds;
    if (nextFlash <= 0) {
      flash = 1;
      nextFlash = 7 + Math.random() * 9;
    }
    flash = Math.max(0, flash - seconds * 2.2);
  }
  if (flash > 0) {
    const flicker = flash * (0.6 + 0.4 * Math.sin(time * 60));
    const light = ctx.createLinearGradient(0, oy, 0, sy(HORIZON + 40));
    light.addColorStop(0, "rgba(200,215,255," + 0.35 * flicker + ")");
    light.addColorStop(1, "rgba(200,215,255,0)");
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, width, sy(HORIZON + 40));
  }

  // darker edges and a darker middle, so the battle board stands out
  const shade = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.2, width / 2, height / 2, Math.hypot(width, height) * 0.6);
  shade.addColorStop(0, "rgba(3,6,9,0.5)");
  shade.addColorStop(0.55, "rgba(3,6,9,0.15)");
  shade.addColorStop(1, "rgba(3,6,9,0.45)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, width, height);
}

function start() {
  if (running) return;
  running = true;
  resize();
  window.addEventListener("resize", resize);
  last = performance.now();
  requestAnimationFrame(frame);
}

function stop() {
  running = false;
  window.removeEventListener("resize", resize);
}

// Event: a screen was shown. The storm runs only behind the battle.
on("screen:shown", (name) => {
  if (name === "game") {
    canvas.classList.add("on");
    start();
  } else {
    canvas.classList.remove("on");
    setTimeout(() => { if (!canvas.classList.contains("on")) stop(); }, 800);
  }
});

// Leaving the tab stops the drawing; coming back starts it again.
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stop();
  else if (canvas.classList.contains("on")) start();
});
