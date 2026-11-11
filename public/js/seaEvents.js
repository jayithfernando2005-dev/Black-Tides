// seaEvents.js - surprises in the middle of a wave. A few seconds into some waves the sea
// throws something at the captain:
//   whirlpool       - drags ships towards its centre; raiders caught in it are torn apart
//   merchant        - a merchant ship needs an escort: stay close to it to earn a reward
//   tentacle attack - tentacles burst out of the water; watch for the red ripples
// game.js starts them and passes the results on as events (sea:event, sea:reward).
import { addSlam } from "./hazards.js";
import { drawTentacle } from "./hazards.js";
import { drawPaintedMerchant } from "./battleArt.js";

const TAU = Math.PI * 2;
const KINDS = ["whirlpool", "merchant", "tentacles"];
export const EVENT_INFO = {
  whirlpool: { title: "WHIRLPOOL", text: "Steer clear of the centre - raiders caught in it sink", colour: "#7fd6ff" },
  merchant: { title: "MERCHANT IN DANGER", text: "Sail close to the merchant ship to escort it for a reward", colour: "#ffd36b" },
  tentacles: { title: "TENTACLE ATTACK", text: "Something stirs below - dodge the red ripples", colour: "#e07ad8" }
};

let current = null;          // the event happening now, or null
let waiting = 0;             // seconds until a chosen event begins

// Called at the start of each wave. chance: 0 to 1. Returns the kind chosen, or null.
export function planEvent(wave, chance, bossWave) {
  current = null;
  waiting = 0;
  if (wave < 2 || bossWave || Math.random() > chance) return null;
  const kind = KINDS[Math.floor(Math.random() * KINDS.length)];
  current = { kind: kind, started: false };
  waiting = 4 + Math.random() * 3;
  return kind;
}

// For testing in the browser console: start an event straight away.
export function forceEvent(kind) {
  current = { kind: kind, started: false };
  waiting = 0;
}

function begin(width, height, ship) {
  const e = current;
  e.started = true;
  if (e.kind === "whirlpool") {
    // somewhere not right on top of the player
    let x, y;
    do {
      x = 160 + Math.random() * (width - 320);
      y = 140 + Math.random() * (height - 280);
    } while (Math.hypot(x - ship.x, y - ship.y) < 260);
    Object.assign(e, { x: x, y: y, radius: 230, life: 14, spin: 0 });
  } else if (e.kind === "merchant") {
    const fromLeft = Math.random() < 0.5;
    Object.assign(e, {
      x: fromLeft ? -70 : width + 70, y: 110 + Math.random() * (height - 260),
      vx: fromLeft ? 42 : -42, escort: 0, need: 6, done: false, width: width
    });
  } else {
    Object.assign(e, { life: 11, next: 0.6 });
  }
}

// Moves the event on. Returns { damage, reward, ended, message } for game.js to act on.
export function updateEvent(seconds, ship, raiders, width, height) {
  const out = { damage: 0, reward: null, ended: false, message: null };
  if (!current) return out;
  if (!current.started) {
    waiting -= seconds;
    if (waiting <= 0) {
      begin(width, height, ship);
      out.message = current.kind;                 // game.js shows the banner
    }
    return out;
  }
  const e = current;

  if (e.kind === "whirlpool") {
    e.life -= seconds;
    e.spin += seconds;
    // pull everything inside the radius towards the centre
    const pull = (thing, strength) => {
      const dx = e.x - thing.x, dy = e.y - thing.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > e.radius) return d;
      const force = strength * (1 - d / e.radius) + 20;
      thing.x += (dx / d) * force * seconds + (-dy / d) * force * 0.6 * seconds;   // inwards and round
      thing.y += (dy / d) * force * seconds + (dx / d) * force * 0.6 * seconds;
      return d;
    };
    if (pull(ship, 120) < 50) out.damage += 10 * seconds;     // the centre hurts
    for (const raider of raiders) {
      if (raider.kraken) continue;
      if (pull(raider, 140) < 45) raider.hp -= 1.6 * seconds;   // raiders are torn apart
    }
    if (e.life <= 0) out.ended = true;
  } else if (e.kind === "merchant") {
    e.x += e.vx * seconds;
    const close = Math.hypot(ship.x - e.x, ship.y - e.y) < 150;
    if (close && !e.done) {
      e.escort += seconds;
      if (e.escort >= e.need) {
        e.done = true;
        out.reward = { gold: 60, points: 250 };
      }
    }
    if (e.x < -120 || e.x > e.width + 120) out.ended = true;
  } else {
    e.life -= seconds;
    e.next -= seconds;
    if (e.next <= 0) {
      // half the strikes aim near the ship, half land anywhere
      const near = Math.random() < 0.55;
      const x = near ? ship.x + (Math.random() - 0.5) * 120 : 60 + Math.random() * (width - 120);
      const y = near ? ship.y + (Math.random() - 0.5) * 80 : 80 + Math.random() * (height - 160);
      addSlam(x, y, { damage: 14, warn: 1.25 });
      e.next = 1.1 + Math.random() * 0.6;
    }
    if (e.life <= 0) out.ended = true;
  }
  if (out.ended) current = null;
  return out;
}

export function getEvent() {
  return current && current.started ? current : null;
}

export function clearEvent() {
  current = null;
  waiting = 0;
}

// Drawn under the ships.
export function drawEventBelow(ctx, time) {
  const e = getEvent();
  if (!e || e.kind !== "whirlpool") return;
  const fade = Math.min(1, e.life / 1.5, e.spin / 1.2);
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.scale(1, 0.55);
  const dark = ctx.createRadialGradient(0, 0, 0, 0, 0, e.radius);
  dark.addColorStop(0, "rgba(0,10,20," + 0.75 * fade + ")");
  dark.addColorStop(0.5, "rgba(5,40,60," + 0.35 * fade + ")");
  dark.addColorStop(1, "rgba(5,40,60,0)");
  ctx.fillStyle = dark;
  ctx.beginPath(); ctx.arc(0, 0, e.radius, 0, TAU); ctx.fill();
  // spiral foam arms
  ctx.lineWidth = 3;
  for (let arm = 0; arm < 5; arm++) {
    ctx.strokeStyle = "rgba(200,235,245," + 0.45 * fade + ")";
    ctx.beginPath();
    for (let k = 0; k <= 40; k++) {
      const r = e.radius * (1 - k / 40) * 0.95;
      const a = arm * (TAU / 5) - time * 2.2 + k * 0.16;
      const px = Math.cos(a) * r, py = Math.sin(a) * r;
      k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// Drawn over the ships.
export function drawEventAbove(ctx, time) {
  const e = getEvent();
  if (!e) return;
  if (e.kind === "merchant") {
    drawMerchant(ctx, e, time);
  } else if (e.kind === "tentacles") {
    // a few idle tentacles waving at the edges while the attack lasts
    for (let i = 0; i < 3; i++) {
      const x = 80 + i * 380 + Math.sin(time * 0.4 + i) * 30;
      drawTentacle(ctx, x, 560 + (i % 2) * 20, 60 + Math.sin(time * 2 + i) * 15, time + i, 14);
    }
  }
}

function drawMerchant(ctx, e, time) {
  const right = e.vx > 0;
  ctx.save();
  ctx.translate(e.x, e.y + Math.sin(time * 2) * 2);
  // escort ring: fills as the captain stays close
  ctx.strokeStyle = "rgba(255,211,107,0.35)";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.beginPath(); ctx.ellipse(0, 20, 150, 60, 0, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);
  if (!e.done) {
    ctx.strokeStyle = "#ffd36b"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(0, -58, 16, -Math.PI / 2, -Math.PI / 2 + TAU * (e.escort / e.need)); ctx.stroke();
    ctx.fillStyle = "#ffd36b"; ctx.font = "700 13px Cinzel, Georgia, serif"; ctx.textAlign = "center";
    ctx.fillText("ESCORT", 0, -80);
  } else {
    ctx.fillStyle = "#8ff0c4"; ctx.font = "700 14px Cinzel, Georgia, serif"; ctx.textAlign = "center";
    ctx.fillText("SAFE! THANK YOU, CAPTAIN", 0, -60);
  }
  ctx.restore();
  if (drawPaintedMerchant(ctx, e.x, e.y + 14, right, time)) return;
  // fallback drawing while the pictures load
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.scale(right ? 1 : -1, 1);
  // hull
  ctx.fillStyle = "#6b4423";
  ctx.beginPath(); ctx.moveTo(-46, 4); ctx.lineTo(50, 4); ctx.lineTo(36, 24); ctx.lineTo(-38, 24); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#3d2614"; ctx.fillRect(-40, 8, 82, 4);
  // mast and white sails with a gold stripe
  ctx.fillStyle = "#3d2614"; ctx.fillRect(-2, -46, 4, 52);
  ctx.fillStyle = "#efe6cf";
  ctx.beginPath(); ctx.moveTo(2, -44); ctx.quadraticCurveTo(30, -26, 2, -4); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-2, -40); ctx.quadraticCurveTo(-26, -24, -2, -8); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#d9a441"; ctx.fillRect(2, -28, 16, 3);
  ctx.restore();
}
