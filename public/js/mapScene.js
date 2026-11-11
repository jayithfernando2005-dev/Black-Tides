// AI note: written with help from Claude (Anthropic), as allowed for this assignment.
// mapScene.js - the living captain's cabin behind the Campaign Map (img/map-cabin.jpg).
//   - outside the windows the storm goes on: the sea rolls, the clouds drift, rain runs down
//     the glass and lightning flashes now and then
//   - the oil lamp's flame flickers and its warm light breathes over the desk and walls
// Only the window GLASS moves: img/map-cabin-glass.png is a mask of the panes (made once
// from the picture), so the wooden frames and bars stay perfectly still.
// It runs only while the map is on screen, and is still when "Reduce motion" is on.
import { on } from "./events.js";
import { getSettings } from "./settings.js";

const canvas = document.getElementById("map-bg");
const ctx = canvas.getContext("2d");
const image = new Image();
image.src = "img/map-cabin.jpg";
const glassMask = new Image();
glassMask.src = "img/map-cabin-glass.png";

// Places in the picture (its own pixels, 1376 x 768).
const IMG_W = 1376;
const IMG_H = 768;
const WINDOWS = { x: 0, y: 60, w: 672, h: 320 };   // the area the glass mask covers
const SEA_LINE = 258;                               // below this, the view is sea
const FLAME = { x: 1153, y: 414 };                  // the lamp's flame
const TAU = Math.PI * 2;

// The view through the windows is drawn here first, then cut to the shape of the glass.
const view = document.createElement("canvas");
view.width = WINDOWS.w;
view.height = WINDOWS.h;
const vctx = view.getContext("2d");

let running = false;
let width = 0;
let height = 0;
let time = 0;
let last = 0;
let flash = 0;
let nextFlash = 5;
let drops = [];

function resize() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.imageSmoothingQuality = "high";
  // rain drops on the window view (in picture pixels)
  drops = Array.from({ length: 110 }, () => ({
    x: Math.random() * WINDOWS.w, y: Math.random() * WINDOWS.h,
    length: 8 + Math.random() * 14, speed: 260 + Math.random() * 220
  }));
}

// The storm outside, drawn into the small "view" canvas and then cut to the glass.
function drawView(seconds, still) {
  vctx.globalCompositeOperation = "source-over";
  vctx.clearRect(0, 0, WINDOWS.w, WINDOWS.h);
  const top = WINDOWS.y;
  // clouds: the sky drifts slowly sideways
  const drift = Math.sin(time * 0.07) * 7;
  vctx.drawImage(image, WINDOWS.x, top, WINDOWS.w, SEA_LINE - top, drift - 8, 0, WINDOWS.w + 16, SEA_LINE - top);
  // the sea: thin rows moved a tiny, smoothly changing amount, so the waves roll
  for (let y = SEA_LINE; y < top + WINDOWS.h; y += 2) {
    const depth = (y - SEA_LINE) / (top + WINDOWS.h - SEA_LINE);
    const roll = Math.sin(y * 0.05 - time * 1.6) * (1 + 3 * depth) + Math.sin(y * 0.021 + time * 0.9) * 1.5 * depth;
    const lift = Math.sin(y * 0.03 - time * 1.2) * 1.5 * depth;
    vctx.drawImage(image, WINDOWS.x, y, WINDOWS.w, 3, roll - 6, y - top + lift, WINDOWS.w + 12, 3);
  }
  // rain running down the glass
  vctx.strokeStyle = "rgba(210,225,240,0.35)";
  vctx.lineWidth = 1;
  vctx.beginPath();
  for (const drop of drops) {
    if (!still) {
      drop.y += drop.speed * seconds;
      drop.x += drop.speed * 0.18 * seconds;
      if (drop.y > WINDOWS.h) { drop.y = -drop.length; drop.x = Math.random() * WINDOWS.w; }
    }
    vctx.moveTo(drop.x, drop.y);
    vctx.lineTo(drop.x - drop.length * 0.18, drop.y - drop.length);
  }
  vctx.stroke();
  // lightning lights up the whole view
  if (flash > 0) {
    vctx.fillStyle = "rgba(225,235,255," + 0.55 * flash + ")";
    vctx.fillRect(0, 0, WINDOWS.w, WINDOWS.h);
  }
  // keep only the glass
  vctx.globalCompositeOperation = "destination-in";
  vctx.drawImage(glassMask, 0, 0);
}

function draw(seconds, still) {
  ctx.fillStyle = "#120c08";
  ctx.fillRect(0, 0, width, height);
  if (!image.complete || !image.naturalWidth) return;

  // the cabin picture covers the screen
  const scale = Math.max(width / IMG_W, height / IMG_H);
  const ox = (width - IMG_W * scale) / 2;
  const oy = (height - IMG_H * scale) / 2;
  const sx = (x) => ox + x * scale;
  const sy = (y) => oy + y * scale;
  ctx.drawImage(image, ox, oy, IMG_W * scale, IMG_H * scale);

  // lightning comes and goes
  if (!still) {
    nextFlash -= seconds;
    if (nextFlash <= 0) { flash = 1; nextFlash = 6 + Math.random() * 9; }
    flash = Math.max(0, flash - seconds * 2.4);
  }
  const flicker = flash * (0.55 + 0.45 * Math.abs(Math.sin(time * 47)));

  // the storm through the windows
  if (glassMask.complete && glassMask.naturalWidth) {
    drawView(seconds, still);
    ctx.drawImage(view, sx(WINDOWS.x), sy(WINDOWS.y), WINDOWS.w * scale, WINDOWS.h * scale);
  }

  // the lamp: a flickering flame and warm light that breathes around the room
  const breathe = still ? 0.85 : 0.78 + 0.12 * Math.sin(time * 9.7) + 0.07 * Math.sin(time * 23.1 + 1.3) + 0.05 * Math.sin(time * 3.1);
  const fx = sx(FLAME.x), fy = sy(FLAME.y);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const room = ctx.createRadialGradient(fx, fy, 0, fx, fy, 560 * scale);
  room.addColorStop(0, "rgba(255,170,80," + 0.16 * breathe + ")");
  room.addColorStop(0.4, "rgba(255,140,60," + 0.06 * breathe + ")");
  room.addColorStop(1, "rgba(255,140,60,0)");
  ctx.fillStyle = room;
  ctx.fillRect(0, 0, width, height);
  const halo = ctx.createRadialGradient(fx, fy, 0, fx, fy, 70 * scale);
  halo.addColorStop(0, "rgba(255,230,160," + 0.55 * breathe + ")");
  halo.addColorStop(1, "rgba(255,190,90,0)");
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(fx, fy, 70 * scale, 0, TAU); ctx.fill();
  // the flame itself: a small teardrop that sways and stretches
  const sway = still ? 0 : Math.sin(time * 6.3) * 1.2 * scale + Math.sin(time * 15.7) * 0.6 * scale;
  const tall = (12 + 4 * breathe) * scale;
  const flame = ctx.createRadialGradient(fx, fy + 2 * scale, 0, fx, fy, tall);
  flame.addColorStop(0, "rgba(255,255,235,0.95)");
  flame.addColorStop(0.5, "rgba(255,200,90,0.75)");
  flame.addColorStop(1, "rgba(255,120,30,0)");
  ctx.fillStyle = flame;
  ctx.beginPath();
  ctx.moveTo(fx + sway, fy - tall);
  ctx.quadraticCurveTo(fx + 5 * scale, fy, fx, fy + 4 * scale);
  ctx.quadraticCurveTo(fx - 5 * scale, fy, fx + sway, fy - tall);
  ctx.fill();
  ctx.restore();

  // the lightning also lights the room for a moment, coming in from the windows
  if (flicker > 0) {
    const light = ctx.createLinearGradient(0, 0, width * 0.7, 0);
    light.addColorStop(0, "rgba(170,195,255," + 0.22 * flicker + ")");
    light.addColorStop(1, "rgba(170,195,255,0)");
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, width, height);
  }

  // darker edges and middle, so the map board stands out
  const shade = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.25, width / 2, height / 2, Math.hypot(width, height) * 0.62);
  shade.addColorStop(0, "rgba(6,4,2,0.45)");
  shade.addColorStop(0.6, "rgba(6,4,2,0.15)");
  shade.addColorStop(1, "rgba(6,4,2,0.4)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, width, height);
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

// Event: a screen was shown. The cabin lives only behind the Campaign Map.
on("screen:shown", (name) => {
  if (name === "map") {
    canvas.classList.add("on");
    start();
  } else {
    canvas.classList.remove("on");
    setTimeout(() => { if (!canvas.classList.contains("on")) stop(); }, 800);
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) stop();
  else if (canvas.classList.contains("on")) start();
});
