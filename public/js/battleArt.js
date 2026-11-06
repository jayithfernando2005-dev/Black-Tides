// battleArt.js - the painted look of the battle: the stormy sea, the painted ships and
// crates (cut from the Black Tides battle artwork), fiery cannonballs, falling fireballs,
// the brass compass radar and the flagship plaque. Only drawing - it never changes the game.
// If a picture has not loaded yet, renderer.js falls back to its simple shapes.

const TAU = Math.PI * 2;

// facing: which way the bow points in the picture (1 = right, -1 = left).
const SPRITES = {
  sea: { url: "img/battle-sea.jpg" },
  player: { url: "img/battle-player.png", facing: 1 },
  boss: { url: "img/battle-boss.png", facing: 1 },
  raider1: { url: "img/battle-raider1.png", facing: 1 },
  raider2: { url: "img/battle-raider2.png", facing: -1 },
  crate: { url: "img/battle-crate.png" },
  radar: { url: "img/battle-radar.png" }
};
for (const key in SPRITES) {
  const image = new Image();
  image.src = SPRITES[key].url;
  SPRITES[key].image = image;
}

export function ready(key) {
  const image = SPRITES[key].image;
  return image.complete && image.naturalWidth > 0;
}

// ---------- the sea ----------
// The painted sea is made to move in three ways:
//  1. it slowly flows across the screen (the picture repeats without a seam),
//  2. every thin row is pushed sideways by rolling sine waves, so the swells ripple,
//  3. white foam crests appear, travel with the wind and fade away.
let seaTile = null;            // the sea picture repeated 2 x 2 (it has no seams)
let tileW = 0;
let tileH = 0;
const crests = [];

// The sea picture is made to repeat without a seam, so a 2 x 2 copy can scroll for ever.
function buildSeaTile(width, height) {
  const image = SPRITES.sea.image;
  tileW = width; tileH = height;
  seaTile = document.createElement("canvas");
  seaTile.width = width * 2;
  seaTile.height = height * 2;
  const g = seaTile.getContext("2d");
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) g.drawImage(image, i * width, j * height, width, height);
  }
}

export function drawPaintedSea(ctx, width, height, time, storm) {
  if (!seaTile || tileW !== width || tileH !== height) buildSeaTile(width, height);
  const speed = storm ? 1.8 : 1;
  // how far the whole sea has flowed (with the wind, towards the bottom-left)
  const flowX = (time * 14 * speed) % (tileW * 2);
  const flowY = (time * 9 * speed) % (tileH * 2);
  const strip = 4;                       // thinner rows look smoother but cost more effort
  const amp = storm ? 9 : 5;
  for (let y = 0; y < height; y += strip) {
    // two rolling waves of different sizes make the rows sway like swells
    const shift = Math.sin(y * 0.035 + time * 1.4 * speed) * amp + Math.sin(y * 0.11 - time * 2.3 * speed) * amp * 0.4;
    const lift = Math.sin(y * 0.02 + time * 0.9 * speed) * 2;
    let sx = (tileW * 2 - flowX + shift + 20) % tileW;
    if (sx < 0) sx += tileW;
    let sy = (tileH * 2 - flowY + y + lift) % (tileH * 2 - strip);
    if (sy < 0) sy += tileH;
    ctx.drawImage(seaTile, sx, sy, width, strip, 0, y, width, strip + 1);
  }

  // light rolling over the waves
  const p = (Math.sin(time * 0.3) + 1) / 2;
  const shine = ctx.createLinearGradient(0, 0, width, height);
  shine.addColorStop(Math.max(0, p - 0.2), "rgba(160,200,220,0)");
  shine.addColorStop(p, "rgba(160,200,220,0.07)");
  shine.addColorStop(Math.min(1, p + 0.2), "rgba(160,200,220,0)");
  ctx.fillStyle = shine;
  ctx.fillRect(0, 0, width, height);

  // foam crests: born on the swells, drift with the wind, then fade
  const wanted = storm ? 34 : 20;
  while (crests.length < wanted) {
    crests.push({ x: Math.random() * width, y: Math.random() * height, w: 18 + Math.random() * 40, age: 0, life: 1.5 + Math.random() * 2.5 });
  }
  ctx.save();
  ctx.lineCap = "round";
  for (let i = crests.length - 1; i >= 0; i--) {
    const c = crests[i];
    c.age += 1 / 60;
    c.x -= 14 * speed / 60;
    c.y += 9 * speed / 60;
    const k = c.age / c.life;
    if (k >= 1) { crests.splice(i, 1); continue; }
    const alpha = Math.sin(k * Math.PI) * (storm ? 0.55 : 0.4);
    const sway = Math.sin(c.y * 0.035 + time * 1.4 * speed) * amp;
    const x = c.x + sway;
    ctx.strokeStyle = "rgba(225,238,242," + alpha + ")";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x, c.y);
    ctx.quadraticCurveTo(x + c.w / 2, c.y - 4 - k * 3, x + c.w, c.y);
    ctx.stroke();
    ctx.strokeStyle = "rgba(225,238,242," + alpha * 0.4 + ")";
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(x + c.w * 0.2, c.y + 2);
    ctx.quadraticCurveTo(x + c.w / 2, c.y - 1, x + c.w * 0.8, c.y + 2);
    ctx.stroke();
  }
  ctx.restore();

  // dark storm clouds at the top, darker in storm waves
  const sky = ctx.createLinearGradient(0, 0, 0, height * 0.35);
  sky.addColorStop(0, storm ? "rgba(4,8,14,0.75)" : "rgba(4,8,14,0.55)");
  sky.addColorStop(1, "rgba(4,8,14,0)");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height * 0.35);
  if (storm) {
    ctx.fillStyle = "rgba(2,8,14,0.25)";
    ctx.fillRect(0, 0, width, height);
  }
}

// ---------- ships ----------
const raiderLook = new WeakMap();          // each raider keeps the same picture all battle

// Draws a painted ship centred on (x, y), facing left or right, rocking on the waves.
function paintedShip(ctx, key, x, y, faceRight, width, time, flash, seed) {
  const sprite = SPRITES[key];
  const image = sprite.image;
  const height = width * image.naturalHeight / image.naturalWidth;
  const rock = Math.sin(time * 1.6 + seed) * 0.05;
  const bob = Math.sin(time * 2.1 + seed) * 2;
  // a dark wake under the hull
  ctx.fillStyle = "rgba(0,10,16,0.35)";
  ctx.beginPath(); ctx.ellipse(x, y + height * 0.34 + bob, width * 0.48, height * 0.12, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = "rgba(220,235,240,0.18)";
  ctx.beginPath(); ctx.ellipse(x + (faceRight ? 1 : -1) * width * 0.3, y + height * 0.36 + bob, width * 0.16, height * 0.05, 0, 0, TAU); ctx.fill();

  ctx.save();
  ctx.translate(x, y + bob);
  ctx.rotate(rock);
  if ((faceRight ? 1 : -1) !== sprite.facing) ctx.scale(-1, 1);
  if (flash) ctx.filter = "brightness(2.2) saturate(0.4)";
  else if (key === "player") ctx.filter = "brightness(1.3) contrast(1.05)";   // your ship stands out a little
  ctx.drawImage(image, -width / 2, -height / 2, width, height);
  ctx.restore();
}

export function drawPaintedPlayer(ctx, ship, time, flash) {
  const faceRight = Math.cos(ship.angle) >= 0;
  // a soft gold ring on the water marks your own ship
  ctx.save();
  ctx.strokeStyle = "rgba(243,212,138," + (0.35 + 0.15 * Math.sin(time * 3)) + ")";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(ship.x, ship.y + 24, 50, 15, 0, 0, TAU); ctx.stroke();
  ctx.restore();
  paintedShip(ctx, "player", ship.x, ship.y - 14, faceRight, 96, time, flash, 0);
}

export function drawPaintedRaider(ctx, raider, time) {
  if (!raiderLook.has(raider)) raiderLook.set(raider, { key: Math.random() < 0.5 ? "raider1" : "raider2", seed: Math.random() * 10 });
  const look = raiderLook.get(raider);
  const faceRight = Math.cos(raider.angle) >= 0;
  if (raider.boss) {
    paintedShip(ctx, "boss", raider.x, raider.y - 10, faceRight, 200, time, raider.flash > 0, look.seed);
  } else {
    paintedShip(ctx, look.key, raider.x, raider.y - 10, faceRight, 78, time, raider.flash > 0, look.seed);
    if (raider.hp < raider.maxHp) {
      ctx.fillStyle = "rgba(10,6,4,0.8)";
      ctx.fillRect(raider.x - 18, raider.y - 44, 36, 5);
      ctx.fillStyle = "#e0422e";
      ctx.fillRect(raider.x - 18, raider.y - 44, 36 * (raider.hp / raider.maxHp), 5);
    }
  }
}

// ---------- crates ----------
export function drawPaintedCrate(ctx, crate, colour, time) {
  const image = SPRITES.crate.image;
  const bob = Math.sin(crate.bob * 3) * 3;
  const fading = crate.life < 3 && Math.floor(crate.life * 6) % 2 === 0;
  ctx.save();
  ctx.globalAlpha = fading ? 0.45 : 1;
  const glow = ctx.createRadialGradient(crate.x, crate.y + bob, 4, crate.x, crate.y + bob, 34);
  glow.addColorStop(0, colour + "88");
  glow.addColorStop(1, colour + "00");
  ctx.fillStyle = glow;
  ctx.fillRect(crate.x - 34, crate.y - 34 + bob, 68, 68);
  ctx.strokeStyle = colour;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.lineDashOffset = -time * 20;
  ctx.beginPath(); ctx.arc(crate.x, crate.y + bob, 26, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);
  const w = 44;
  const h = w * image.naturalHeight / image.naturalWidth;
  ctx.drawImage(image, crate.x - w / 2, crate.y - h / 2 + bob, w, h);
  ctx.restore();
}

// ---------- cannonballs ----------
export function drawIronShot(ctx, shot) {
  // smoke trail, then a dark iron ball with a hot edge
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const tail = ctx.createLinearGradient(shot.x, shot.y, shot.x - shot.vx * 0.06, shot.y - shot.vy * 0.06);
  tail.addColorStop(0, "rgba(255,190,90,0.7)");
  tail.addColorStop(1, "rgba(255,120,40,0)");
  ctx.strokeStyle = tail;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(shot.x, shot.y); ctx.lineTo(shot.x - shot.vx * 0.06, shot.y - shot.vy * 0.06); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = "#1c1a18";
  ctx.beginPath(); ctx.arc(shot.x, shot.y, 5, 0, TAU); ctx.fill();
  ctx.strokeStyle = "rgba(255,200,120,0.8)";
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

export function drawFireShot(ctx, shot) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const len = 0.12;
  const tail = ctx.createLinearGradient(shot.x, shot.y, shot.x - shot.vx * len, shot.y - shot.vy * len);
  tail.addColorStop(0, "rgba(255,170,60,0.9)");
  tail.addColorStop(1, "rgba(200,60,20,0)");
  ctx.strokeStyle = tail;
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(shot.x, shot.y); ctx.lineTo(shot.x - shot.vx * len, shot.y - shot.vy * len); ctx.stroke();
  const glow = ctx.createRadialGradient(shot.x, shot.y, 0, shot.x, shot.y, 14);
  glow.addColorStop(0, "rgba(255,240,200,1)");
  glow.addColorStop(0.35, "rgba(255,160,60,0.85)");
  glow.addColorStop(1, "rgba(255,80,20,0)");
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(shot.x, shot.y, 14, 0, TAU); ctx.fill();
  ctx.restore();
}

// ---------- fireballs falling from the sky (only for looks) ----------
const meteors = [];
let nextMeteor = 1;
export function drawMeteors(ctx, width, height, seconds) {
  nextMeteor -= seconds;
  if (nextMeteor <= 0) {
    nextMeteor = 1.2 + Math.random() * 2.5;
    const fromLeft = Math.random() < 0.5;
    meteors.push({ x: fromLeft ? Math.random() * width * 0.5 : width * 0.5 + Math.random() * width * 0.5, y: -20,
      vx: (fromLeft ? 1 : -1) * (90 + Math.random() * 80), vy: 220 + Math.random() * 120, life: 0.6 + Math.random() * 0.8 });
  }
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const m of meteors) {
    m.x += m.vx * seconds; m.y += m.vy * seconds; m.life -= seconds;
    const fade = Math.min(1, m.life * 2);
    const tail = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * 0.35, m.y - m.vy * 0.35);
    tail.addColorStop(0, "rgba(255,190,90," + 0.8 * fade + ")");
    tail.addColorStop(1, "rgba(255,90,20,0)");
    ctx.strokeStyle = tail; ctx.lineWidth = 5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x - m.vx * 0.35, m.y - m.vy * 0.35); ctx.stroke();
    ctx.fillStyle = "rgba(255,230,170," + fade + ")";
    ctx.beginPath(); ctx.arc(m.x, m.y, 4, 0, TAU); ctx.fill();
    if (m.life <= 0) {                                   // a small splash where it hits the water
      ctx.strokeStyle = "rgba(220,235,240,0.5)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(m.x, m.y, 12, 4, 0, 0, TAU); ctx.stroke();
    }
  }
  ctx.restore();
  for (let i = meteors.length - 1; i >= 0; i--) if (meteors[i].life <= 0) meteors.splice(i, 1);
}

// ---------- the brass compass radar ----------
export function drawCompassRadar(ctx, scene) {
  const image = SPRITES.radar.image;
  const w = 170;
  const h = w * image.naturalHeight / image.naturalWidth;
  const left = 6;
  const top = scene.height - h - 4;
  ctx.drawImage(image, left, top, w, h);
  // the compass face in the picture
  const cx = left + w * 0.443;
  const cy = top + h * 0.575;
  const radius = w * 0.235;
  // green sonar sweep over the glass
  const sweep = scene.time * 2.2;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, radius, 0, TAU); ctx.clip();
  ctx.fillStyle = "rgba(10,40,30,0.35)";
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  g.addColorStop(0, "rgba(111,224,168,0.0)");
  g.addColorStop(1, "rgba(111,224,168,0.25)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, radius, sweep - 0.6, sweep); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "rgba(111,224,168,0.9)"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(sweep) * radius, cy + Math.sin(sweep) * radius); ctx.stroke();
  const range = 520;
  const place = (x, y) => {
    const dx = (x - scene.ship.x) / range;
    const dy = (y - scene.ship.y) / range;
    const d = Math.hypot(dx, dy);
    const k = d > 0.92 ? 0.92 / d : 1;
    return [cx + dx * k * radius, cy + dy * k * radius];
  };
  for (const crate of scene.crates) {
    const [x, y] = place(crate.x, crate.y);
    ctx.fillStyle = "#ffd36b"; ctx.fillRect(x - 2.5, y - 2.5, 5, 5);
  }
  for (const raider of scene.raiders) {
    const [x, y] = place(raider.x, raider.y);
    ctx.fillStyle = "#ff5a3c"; ctx.shadowColor = "#ff5a3c"; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.arc(x, y, raider.boss ? 5 : 3.2, 0, TAU); ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#f6efe0";
  ctx.beginPath(); ctx.arc(cx, cy, 3, 0, TAU); ctx.fill();
  ctx.restore();
}

// ---------- the flagship plaque ----------
export function drawFlagshipPlaque(ctx, boss, width) {
  const w = 380, h = 54, x = (width - w) / 2, y = 8;
  ctx.save();
  // brass frame with pointed ends
  ctx.beginPath();
  ctx.moveTo(x - 14, y + h / 2); ctx.lineTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w + 14, y + h / 2); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath();
  const brass = ctx.createLinearGradient(0, y, 0, y + h);
  brass.addColorStop(0, "#f2d38a"); brass.addColorStop(0.5, "#a8772c"); brass.addColorStop(1, "#5e3f12");
  ctx.fillStyle = brass; ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 12; ctx.fill(); ctx.shadowBlur = 0;
  // patina name plate
  const plate = ctx.createLinearGradient(0, y + 5, 0, y + 27);
  plate.addColorStop(0, "#5f7d70"); plate.addColorStop(1, "#33483f");
  ctx.fillStyle = plate; ctx.fillRect(x + 8, y + 5, w - 16, 22);
  ctx.fillStyle = "#e9f1dc"; ctx.font = "700 14px Cinzel, Georgia, serif"; ctx.textAlign = "center";
  ctx.fillText("RAIDER FLAGSHIP", width / 2, y + 21);
  // health bar
  ctx.fillStyle = "#1a0c08"; ctx.fillRect(x + 8, y + 32, w - 16, 14);
  const hp = Math.max(0, boss.hp / boss.maxHp);
  const red = ctx.createLinearGradient(0, y + 32, 0, y + 46);
  red.addColorStop(0, "#ff6b55"); red.addColorStop(1, "#a01810");
  ctx.fillStyle = red; ctx.fillRect(x + 10, y + 34, (w - 20) * hp, 10);
  ctx.restore();
}

// ---------- the gold crosshair ----------
export function drawGoldCrosshair(ctx, x, y, time) {
  const r = 22 + Math.sin(time * 4) * 1.2;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.7)"; ctx.shadowBlur = 4;
  ctx.strokeStyle = "#e8c372"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  ctx.lineWidth = 2.5;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    ctx.beginPath(); ctx.moveTo(x + dx * (r - 8), y + dy * (r - 8)); ctx.lineTo(x + dx * (r + 9), y + dy * (r + 9)); ctx.stroke();
  }
  ctx.fillStyle = "#e8c372";
  ctx.beginPath(); ctx.arc(x, y, 2.5, 0, TAU); ctx.fill();
  ctx.restore();
}
