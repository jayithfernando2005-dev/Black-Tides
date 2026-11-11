// AI note: written with help from Claude (Anthropic), as allowed for this assignment.
// shipLook.js - your ship's name, sail colour and flag: the choices, how each flag is drawn,
// and the look of the logged-in captain's ship (the battle reads it from here).
import { on, emit } from "./events.js";
import * as api from "./api.js";

const TAU = Math.PI * 2;

export const SAILS = {
  white: { label: "Classic white", colour: "#f1ead8" },
  crimson: { label: "Crimson", colour: "#c0392b" },
  black: { label: "Black", colour: "#3a3a3a" },
  royal: { label: "Royal blue", colour: "#2f5fb8" },
  emerald: { label: "Emerald", colour: "#2c9a5f" },
  gold: { label: "Gold", colour: "#e0aa3e" }
};
export const FLAGS = { skull: "Skull", swords: "Crossed swords", anchor: "Anchor", kraken: "Kraken", star: "Compass star", fish: "Fish" };

let mine = { name: "", sail: "white", flag: "skull" };

export function getMyShip() {
  return mine;
}

export function setMyShip(look) {
  mine = { name: look.name || "", sail: SAILS[look.sail] ? look.sail : "white", flag: FLAGS[look.flag] ? look.flag : "skull" };
  emit("ship:changed", mine);
}

// When a captain logs in, fetch their ship's look; guests sail the classic ship.
on("player:changed", async (player) => {
  if (!player.username) {
    setMyShip({});
    return;
  }
  try {
    const profile = await api.getProfile();
    setMyShip(profile.ship || {});
  } catch (error) {
    setMyShip({});
  }
});

// Draws a flag on a pole top at (x, y). size: the flag's width. wave: time for the flutter.
export function drawFlag(ctx, flag, x, y, size, time, facing = 1) {
  const h = size * 0.68;
  const flutter = (k) => Math.sin(time * 6 + k * 3) * size * 0.06 * k;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  // pole
  ctx.strokeStyle = "#3d2614"; ctx.lineWidth = Math.max(1.5, size * 0.07);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, h * 1.6); ctx.stroke();
  // cloth (a wavy black rectangle)
  ctx.fillStyle = "#141414";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(size * 0.5, flutter(0.5) - h * 0.05, size, flutter(1));
  ctx.lineTo(size, h + flutter(1));
  ctx.quadraticCurveTo(size * 0.5, h + flutter(0.5) + h * 0.05, 0, h);
  ctx.closePath(); ctx.fill();
  // the emblem in bone white
  const cx = size * 0.52, cy = h * 0.5 + flutter(0.5), s = size * 0.2;
  ctx.fillStyle = "#efe6cf"; ctx.strokeStyle = "#efe6cf"; ctx.lineWidth = Math.max(1, size * 0.06); ctx.lineCap = "round";
  if (flag === "skull") {
    ctx.beginPath(); ctx.arc(cx, cy - s * 0.2, s * 0.75, 0, TAU); ctx.fill();
    ctx.fillRect(cx - s * 0.4, cy + s * 0.3, s * 0.8, s * 0.45);
    ctx.fillStyle = "#141414";
    ctx.beginPath(); ctx.arc(cx - s * 0.3, cy - s * 0.25, s * 0.2, 0, TAU); ctx.arc(cx + s * 0.3, cy - s * 0.25, s * 0.2, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#efe6cf";
    ctx.beginPath(); ctx.moveTo(cx - s * 1.2, cy + s * 1.2); ctx.lineTo(cx + s * 1.2, cy - s * 1.0);
    ctx.moveTo(cx + s * 1.2, cy + s * 1.2); ctx.lineTo(cx - s * 1.2, cy - s * 1.0); ctx.stroke();
  } else if (flag === "swords") {
    ctx.beginPath(); ctx.moveTo(cx - s * 1.1, cy - s * 1.1); ctx.lineTo(cx + s * 1.1, cy + s * 1.1);
    ctx.moveTo(cx + s * 1.1, cy - s * 1.1); ctx.lineTo(cx - s * 1.1, cy + s * 1.1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - s * 0.9, cy + s * 0.5); ctx.lineTo(cx - s * 0.5, cy + s * 0.9);
    ctx.moveTo(cx + s * 0.9, cy + s * 0.5); ctx.lineTo(cx + s * 0.5, cy + s * 0.9); ctx.stroke();
  } else if (flag === "anchor") {
    ctx.beginPath(); ctx.arc(cx, cy - s * 0.95, s * 0.25, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.7); ctx.lineTo(cx, cy + s); ctx.moveTo(cx - s * 0.5, cy - s * 0.4); ctx.lineTo(cx + s * 0.5, cy - s * 0.4);
    ctx.moveTo(cx - s * 0.9, cy + s * 0.3); ctx.quadraticCurveTo(cx, cy + s * 1.5, cx + s * 0.9, cy + s * 0.3); ctx.stroke();
  } else if (flag === "kraken") {
    ctx.beginPath(); ctx.ellipse(cx, cy - s * 0.4, s * 0.6, s * 0.55, 0, 0, TAU); ctx.fill();
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath(); ctx.moveTo(cx + i * s * 0.2, cy); ctx.quadraticCurveTo(cx + i * s * 0.5, cy + s * 0.7, cx + i * s * 0.35 + s * 0.2, cy + s * 1.1); ctx.stroke();
    }
  } else if (flag === "star") {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 4;
      const r = i % 2 === 0 ? s * 1.2 : s * 0.35;
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill();
  } else {
    ctx.beginPath(); ctx.ellipse(cx - s * 0.15, cy, s * 0.85, s * 0.45, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + s * 0.6, cy); ctx.lineTo(cx + s * 1.2, cy - s * 0.5); ctx.lineTo(cx + s * 1.2, cy + s * 0.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#141414"; ctx.beginPath(); ctx.arc(cx - s * 0.6, cy - s * 0.1, s * 0.12, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
