// shareCard.js - makes a picture (1200 x 630, the usual size for sharing links) of a victory
// or a Daily Challenge result, with the captain's portrait, rank and score, and downloads it.
// Everything is drawn on a canvas in the browser; nothing is uploaded anywhere.
import * as api from "./api.js";
import { portraitSource } from "./portraits.js";

const W = 1200;
const H = 630;

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);            // a missing picture just leaves a gap
    img.src = src;
  });
}

// Draws img to fill the box, cropping the edges (like CSS background-size: cover).
function cover(ctx, img, x, y, w, h) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / scale, sh = h / scale;
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
}

function goldText(ctx, text, x, y, size) {
  ctx.font = "900 " + size + "px Cinzel, Georgia, serif";
  ctx.lineWidth = Math.max(4, size / 10);
  ctx.strokeStyle = "rgba(20,10,4,0.9)";
  ctx.strokeText(text, x, y);
  const g = ctx.createLinearGradient(0, y - size, 0, y);
  g.addColorStop(0, "#fff0b8"); g.addColorStop(0.55, "#e2b85e"); g.addColorStop(1, "#a8742a");
  ctx.fillStyle = g;
  ctx.fillText(text, x, y);
}

// card: { headline, big, bigLabel, lines: [...], stamp }
async function drawCard(card) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // who is sharing: portrait and rank from the server (guests get a portrait from "Guest")
  let me = { username: "Guest", avatar: null, avatarVersion: 0, rankTitle: "Guest captain" };
  try {
    const profile = await api.getProfile();
    me = { username: profile.username, avatar: profile.avatar, avatarVersion: profile.avatarVersion, rankTitle: profile.captainRank.title };
  } catch (error) {
    // a guest: keep the defaults
  }
  const [background, logo, portrait] = await Promise.all([
    loadImage("img/menu.jpg"), loadImage("img/logo.png"),
    loadImage(portraitSource(me.username, me.avatar, me.avatarVersion))
  ]);
  await document.fonts.load("900 40px Cinzel").catch(() => {});

  // background picture, darker on the left where the words go
  ctx.fillStyle = "#0b1a22";
  ctx.fillRect(0, 0, W, H);
  if (background) cover(ctx, background, 0, 0, W, H);
  const shade = ctx.createLinearGradient(0, 0, W, 0);
  shade.addColorStop(0, "rgba(5,8,12,0.92)"); shade.addColorStop(0.6, "rgba(5,8,12,0.7)"); shade.addColorStop(1, "rgba(5,8,12,0.25)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);
  // brass frame
  ctx.strokeStyle = "#c9a65e"; ctx.lineWidth = 6; ctx.strokeRect(14, 14, W - 28, H - 28);
  ctx.strokeStyle = "rgba(20,12,6,0.9)"; ctx.lineWidth = 2; ctx.strokeRect(24, 24, W - 48, H - 48);

  if (logo) ctx.drawImage(logo, 60, 48, 380, 380 * logo.naturalHeight / logo.naturalWidth);

  // the porthole portrait on the right
  const px = 930, py = 250, r = 120;
  ctx.save();
  ctx.beginPath(); ctx.arc(px, py, r + 18, 0, Math.PI * 2);
  const brass = ctx.createLinearGradient(px - r, py - r, px + r, py + r);
  brass.addColorStop(0, "#f6dc94"); brass.addColorStop(0.5, "#b3802c"); brass.addColorStop(1, "#6b4512");
  ctx.fillStyle = brass; ctx.fill();
  ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = "#1d2f3a"; ctx.fillRect(px - r, py - r, 2 * r, 2 * r);
  if (portrait) ctx.drawImage(portrait, px - r, py - r, 2 * r, 2 * r);
  ctx.restore();
  ctx.textAlign = "center";
  goldText(ctx, me.username, px, py + r + 62, 34);
  ctx.font = "700 22px Cinzel, Georgia, serif";
  ctx.fillStyle = "#e8dcbc";
  ctx.fillText(me.rankTitle, px, py + r + 94);

  // the result
  ctx.textAlign = "left";
  ctx.font = "700 26px Cinzel, Georgia, serif";
  ctx.fillStyle = "#8ff0c4";
  ctx.fillText(card.headline.toUpperCase(), 64, 250);
  goldText(ctx, card.big, 60, 360, 104);
  ctx.font = "700 24px Cinzel, Georgia, serif";
  ctx.fillStyle = "#f3e6c8";
  ctx.fillText(card.bigLabel, 64, 400);
  ctx.font = "500 24px Georgia, serif";
  ctx.fillStyle = "#d9c8a4";
  card.lines.forEach((line, i) => ctx.fillText(line, 64, 460 + i * 36));
  ctx.font = "italic 18px Georgia, serif";
  ctx.fillStyle = "rgba(232,220,188,0.75)";
  ctx.fillText(card.stamp, 64, H - 52);
  return canvas;
}

function download(canvas, name) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = name;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 2000);
      resolve();
    }, "image/png");
  });
}

const today = () => new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });

// A finished battle (the end panel's summary).
export async function shareBattle(summary) {
  const where = summary.stage ? "Stage " + summary.stage.id + " · " + summary.stage.name : "Endless voyage";
  const canvas = await drawCard({
    headline: summary.victory ? "Victory! " + where : where,
    big: Number(summary.score).toLocaleString("en-GB"),
    bigLabel: "points",
    lines: [
      "Wave " + summary.wave + " · " + summary.sunk + " ships sunk" + (summary.bosses ? " · " + summary.bosses + " boss" + (summary.bosses > 1 ? "es" : "") : ""),
      (summary.bestCombo >= 2 ? "Best combo: " + summary.bestCombo + " in a row · " : "") + summary.puzzlesSolved + " sonar puzzles solved"
    ],
    stamp: "Black Tides · " + today()
  });
  await download(canvas, "black-tides-" + (summary.victory ? "victory" : "battle") + "-" + Date.now() + ".png");
}

// A finished Daily Challenge.
export async function shareDaily(result) {
  const canvas = await drawCard({
    headline: "Daily Challenge",
    big: result.seconds.toFixed(1) + " s",
    bigLabel: result.rank ? "#" + result.rank + " today" : "challenge complete",
    lines: [
      (result.wrong ? result.wrong + " wrong count" + (result.wrong === 1 ? "" : "s") : "No mistakes") + (result.chestRight ? " · chests counted right" : ""),
      "Every captain counted the same Fish API picture today"
    ],
    stamp: "Black Tides · " + today()
  });
  await download(canvas, "black-tides-daily-" + Date.now() + ".png");
}
