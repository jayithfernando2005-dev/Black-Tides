// mapScene.js - the living underwater scene behind the Campaign Map: the water wobbles,
// light rays sway down from the surface, bubbles rise from the vent, fish swim past and
// tiny specks drift. Only for looks; it runs only while the map is on screen.
import { on } from "./events.js";

const canvas = document.getElementById("map-bg");
const ctx = canvas.getContext("2d");
const image = new Image();
image.src = "img/map-underwater.jpg";
const IMG_W = 1376;
const IMG_H = 768;
const TAU = Math.PI * 2;
const random = (a, b) => a + Math.random() * (b - a);

let running = false;
let width = 0;
let height = 0;
let time = 0;
let last = 0;
let bubbles = [];
let fish = [];
let specks = [];

function resize() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  specks = Array.from({ length: 90 }, () => ({ x: Math.random() * width, y: Math.random() * height, r: random(0.6, 1.8), v: random(4, 12) }));
}

function newFish(startAnywhere) {
  const dir = Math.random() < 0.5 ? 1 : -1;
  const size = random(10, 30);
  return {
    dir: dir, size: size, y: random(height * 0.15, height * 0.85),
    x: startAnywhere ? Math.random() * width : (dir > 0 ? -60 : width + 60),
    speed: random(25, 60) * (size / 20), phase: random(0, TAU),
    shade: Math.random() < 0.25 ? "rgba(255,190,90,0.55)" : "rgba(4,18,26,0.55)"
  };
}

function drawFish(f) {
  const wiggle = Math.sin(time * 8 + f.phase) * f.size * 0.18;
  ctx.save();
  ctx.translate(f.x, f.y + Math.sin(time * 1.2 + f.phase) * 6);
  ctx.scale(f.dir, 1);
  ctx.fillStyle = f.shade;
  ctx.beginPath(); ctx.ellipse(0, 0, f.size, f.size * 0.42, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-f.size * 0.85, 0); ctx.lineTo(-f.size * 1.6, -f.size * 0.5 + wiggle); ctx.lineTo(-f.size * 1.6, f.size * 0.5 + wiggle); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function frame(now) {
  if (!running) return;
  const seconds = Math.max(0, Math.min(0.1, (now - last) / 1000));
  last = now;
  time += seconds;

  // the picture fills the screen, every thin row wobbling like seen through moving water
  const scale = Math.max(width / IMG_W, height / IMG_H) * 1.04;
  const dw = IMG_W * scale;
  const ox = (width - dw) / 2;
  const oy = (height - IMG_H * scale) / 2;
  ctx.fillStyle = "#06222e";
  ctx.fillRect(0, 0, width, height);
  if (image.complete && image.naturalWidth) {
    const strip = 4;
    for (let sy = 0; sy < IMG_H; sy += strip) {
      const shift = Math.sin(sy * 0.03 + time * 1.3) * 5 + Math.sin(sy * 0.09 - time * 2.1) * 2;
      ctx.drawImage(image, 0, sy, IMG_W, strip + 1, ox + shift, oy + sy * scale, dw, (strip + 1) * scale);
    }
  }

  // light rays from the surface
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 8; i++) {
    const x = width * (0.05 + i * 0.13) + Math.sin(time * 0.3 + i) * 40;
    const alpha = 0.05 + 0.04 * Math.sin(time * 0.6 + i * 1.7) ** 2;
    const ray = ctx.createLinearGradient(0, 0, 0, height * 0.9);
    ray.addColorStop(0, "rgba(140,220,230," + alpha + ")");
    ray.addColorStop(1, "rgba(140,220,230,0)");
    ctx.fillStyle = ray;
    ctx.beginPath();
    ctx.moveTo(x - 30, 0); ctx.lineTo(x + 30, 0);
    ctx.lineTo(x + 110 + Math.sin(time * 0.4 + i) * 40, height * 0.9);
    ctx.lineTo(x - 10 + Math.sin(time * 0.4 + i) * 40, height * 0.9);
    ctx.closePath(); ctx.fill();
  }
  // shimmering caustics near the surface
  for (let i = 0; i < 14; i++) {
    const cx = (i * 173 + time * 18) % (width + 200) - 100;
    const cy = 20 + (i % 4) * 30 + Math.sin(time + i) * 10;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 70);
    g.addColorStop(0, "rgba(170,240,240,0.06)");
    g.addColorStop(1, "rgba(170,240,240,0)");
    ctx.fillStyle = g;
    ctx.fillRect(cx - 70, cy - 70, 140, 140);
  }
  ctx.restore();


  // bubbles rising from the vent on the left, and a few everywhere
  if (Math.random() < seconds * 14) {
    bubbles.push({ x: ox + 150 * scale + random(-12, 12), y: oy + 560 * scale, r: random(1.5, 5), v: random(40, 90), p: random(0, TAU) });
  }
  if (Math.random() < seconds * 4) {
    bubbles.push({ x: Math.random() * width, y: height + 10, r: random(1, 3.5), v: random(30, 70), p: random(0, TAU) });
  }
  ctx.strokeStyle = "rgba(210,245,250,0.55)";
  ctx.lineWidth = 1;
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];
    b.y -= b.v * seconds;
    const x = b.x + Math.sin(time * 3 + b.p) * 4;
    ctx.beginPath(); ctx.arc(x, b.y, b.r, 0, TAU); ctx.stroke();
    if (b.y < -10) bubbles.splice(i, 1);
  }

  // drifting specks
  ctx.fillStyle = "rgba(200,235,240,0.3)";
  for (const s of specks) {
    s.y -= s.v * seconds * 0.3;
    s.x += Math.sin(time * 0.5 + s.y * 0.01) * 0.2;
    if (s.y < 0) s.y = height;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
  }

  // dark edges, like looking into the deep
  const v = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.3, width / 2, height / 2, Math.hypot(width, height) * 0.62);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,8,14,0.6)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, width, height);
  requestAnimationFrame(frame);
}

// Event: plays only while the map screen is showing.
on("screen:shown", (name) => {
  if (name === "map") {
    canvas.classList.add("on");
    if (!running) {
      running = true;
      resize();
      window.addEventListener("resize", resize);
      last = performance.now();
      requestAnimationFrame(frame);
    }
  } else if (running) {
    canvas.classList.remove("on");
    setTimeout(() => {
      if (!canvas.classList.contains("on")) {
        running = false;
        window.removeEventListener("resize", resize);
      }
    }, 700);
  }
});
