// krakenArt.js - draws the kraken boss: a huge body rising from the water, glowing eyes
// and six waving tentacles. Drawn with canvas shapes (no picture file needed).
import { drawTentacle } from "./hazards.js";

const TAU = Math.PI * 2;

export function drawKraken(ctx, kraken, time) {
  const { x, y } = kraken;
  const rise = Math.min(1, kraken.age / 2);                  // rises out of the sea over 2 s
  const hurt = kraken.flash > 0;
  ctx.save();
  // dark water ring
  const pool = ctx.createRadialGradient(x, y + 30, 10, x, y + 30, 150);
  pool.addColorStop(0, "rgba(0,0,10,0.55)");
  pool.addColorStop(1, "rgba(0,0,10,0)");
  ctx.fillStyle = pool;
  ctx.beginPath(); ctx.ellipse(x, y + 30, 150, 55, 0, 0, TAU); ctx.fill();

  // tentacles behind and around the body
  for (let i = 0; i < 6; i++) {
    const side = i < 3 ? -1 : 1;
    const k = i % 3;
    const tx = x + side * (55 + k * 38);
    const ty = y + 30 + k * 8;
    drawTentacle(ctx, tx, ty, (90 - k * 15) * rise + Math.sin(time * 2 + i) * 10, time * 1.2 + i * 1.7, 22 - k * 3);
  }

  // the body (a dome) rising from the water
  const top = y - 85 * rise;
  const body = ctx.createRadialGradient(x - 20, top + 30, 10, x, y, 120);
  body.addColorStop(0, hurt ? "#ff9a8a" : "#8c3f88");
  body.addColorStop(0.6, hurt ? "#c0504a" : "#4d1d52");
  body.addColorStop(1, "#1d0821");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(x - 80, y + 30);
  ctx.bezierCurveTo(x - 90, top - 20, x + 90, top - 20, x + 80, y + 30);
  ctx.closePath(); ctx.fill();
  // spots
  ctx.fillStyle = "rgba(255,200,230,0.15)";
  for (let i = 0; i < 7; i++) {
    ctx.beginPath(); ctx.arc(x - 50 + i * 16, top + 25 + (i % 3) * 14, 4 + (i % 2) * 3, 0, TAU); ctx.fill();
  }
  // glowing eyes that blink now and then
  const blink = Math.sin(time * 0.9) > 0.97 ? 0.15 : 1;
  for (const side of [-1, 1]) {
    const ex = x + side * 30, ey = top + 48;
    const glow = ctx.createRadialGradient(ex, ey, 0, ex, ey, 22);
    glow.addColorStop(0, "rgba(255,230,90,0.9)");
    glow.addColorStop(1, "rgba(255,150,20,0)");
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(ex, ey, 22, 0, TAU); ctx.fill();
    ctx.fillStyle = "#ffe25a";
    ctx.beginPath(); ctx.ellipse(ex, ey, 10, 8 * blink, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#1a0500";
    ctx.beginPath(); ctx.ellipse(ex, ey, 2.5, 7 * blink, 0, 0, TAU); ctx.fill();
  }
  // foam where body meets the water
  ctx.strokeStyle = "rgba(220,240,250,0.55)";
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(x, y + 30, 86 + Math.sin(time * 3) * 4, 16, 0, 0, TAU); ctx.stroke();
  ctx.restore();
}
