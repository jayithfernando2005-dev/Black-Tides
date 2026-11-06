// menuArt.js - the moving picture on the main menu: our ship sailing in a
// circle, a raider following it, and sonar rings. Only for looks.
import { drawSea, drawShip, COLOURS } from "./renderer.js";

const canvas = document.getElementById("menu-sea");
const ctx = canvas.getContext("2d");
let time = 0;
let last = performance.now();

function frame(now) {
  const seconds = Math.max(0, Math.min(0.1, (now - last) / 1000));
  last = now;
  // Only draw while the menu is on screen.
  if (canvas.offsetParent !== null) {
    time += seconds;
    const w = canvas.width;
    const h = canvas.height;
    drawSea(ctx, w, h, time, false);

    // Sonar rings spreading from the middle.
    for (let i = 0; i < 3; i++) {
      const r = ((time * 40 + i * 70) % 210);
      ctx.strokeStyle = "rgba(111,224,168," + (0.35 * (1 - r / 210)) + ")";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2); ctx.stroke();
    }

    const a = time * 0.5;
    const shipX = w / 2 + Math.cos(a) * 130;
    const shipY = h / 2 + Math.sin(a) * 110;
    const raiderX = w / 2 + Math.cos(a - 0.9) * 150;
    const raiderY = h / 2 + Math.sin(a - 0.9) * 130;
    // Foam behind the ship.
    for (let i = 1; i < 7; i++) {
      const fa = a - i * 0.06;
      ctx.fillStyle = "rgba(207,227,230," + (0.25 - i * 0.03) + ")";
      ctx.beginPath();
      ctx.arc(w / 2 + Math.cos(fa) * 130, h / 2 + Math.sin(fa) * 110, 4 + i, 0, Math.PI * 2);
      ctx.fill();
    }
    drawShip(ctx, raiderX, raiderY, Math.atan2(shipY - raiderY, shipX - raiderX), 1.2, COLOURS.rust, COLOURS.rustDeck, false);
    drawShip(ctx, shipX, shipY, a + Math.PI / 2, 1.5, COLOURS.bone, COLOURS.deck, false);
  }
  requestAnimationFrame(frame);
}

export function startMenuArt() {
  requestAnimationFrame(frame);
}
