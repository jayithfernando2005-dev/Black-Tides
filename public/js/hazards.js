// hazards.js - tentacle slams. A ripple on the water warns where a tentacle will strike;
// a moment later it crashes down, and a ship still inside the ring is hurt.
// Used by the kraken boss and by the "tentacle attack" sea event.
const TAU = Math.PI * 2;
let slams = [];

// warn: seconds of warning before the strike.
export function addSlam(x, y, options = {}) {
  slams.push({
    x: x, y: y,
    radius: options.radius || 46,
    warn: options.warn || 1.3,
    damage: options.damage || 15,
    timer: 0, struck: false, life: 0.7
  });
}

// Moves every slam on. Returns the damage done to the ship this frame.
export function updateSlams(seconds, ship) {
  let damage = 0;
  for (const slam of slams) {
    slam.timer += seconds;
    if (!slam.struck && slam.timer >= slam.warn) {
      slam.struck = true;
      if (Math.hypot(ship.x - slam.x, ship.y - slam.y) < slam.radius + 18) damage += slam.damage;
    }
    if (slam.struck) slam.life -= seconds;
  }
  slams = slams.filter((slam) => slam.life > 0);
  return damage;
}

// The warning ripples (under the ships).
export function drawSlamWarnings(ctx, time) {
  for (const slam of slams) {
    if (slam.struck) continue;
    const t = slam.timer / slam.warn;                     // 0 -> 1 while warning
    ctx.save();
    ctx.strokeStyle = "rgba(255,90,70," + (0.35 + 0.45 * t) + ")";
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -time * 40;
    ctx.beginPath(); ctx.ellipse(slam.x, slam.y, slam.radius, slam.radius * 0.45, 0, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(20,0,20," + 0.25 * t + ")";
    ctx.beginPath(); ctx.ellipse(slam.x, slam.y, slam.radius * t, slam.radius * 0.45 * t, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

// The tentacles themselves (over the ships).
export function drawSlamTentacles(ctx, time) {
  for (const slam of slams) {
    if (!slam.struck) continue;
    const up = Math.sin(Math.max(0, slam.life / 0.7) * Math.PI);   // rises and sinks again
    drawTentacle(ctx, slam.x, slam.y, 110 * up, time + slam.x);
    ctx.strokeStyle = "rgba(220,240,255," + 0.6 * up + ")";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(slam.x, slam.y, slam.radius * (1.4 - up * 0.4), slam.radius * 0.5, 0, 0, TAU); ctx.stroke();
  }
}

// One curling tentacle rising out of the water at (x, y).
export function drawTentacle(ctx, x, y, height, time, thickness = 18) {
  if (height < 2) return;
  ctx.save();
  const segments = 14;
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const k = i / segments;
    points.push({
      x: x + Math.sin(time * 3 + k * 4) * 14 * k + k * k * 22,
      y: y - height * k,
      w: thickness * (1 - k * 0.85)
    });
  }
  const skin = ctx.createLinearGradient(x - 20, 0, x + 30, 0);
  skin.addColorStop(0, "#3a1640"); skin.addColorStop(0.5, "#6e2d6c"); skin.addColorStop(1, "#2a0f30");
  ctx.fillStyle = skin;
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x - p.w / 2, p.y) : ctx.lineTo(p.x - p.w / 2, p.y)));
  for (let i = points.length - 1; i >= 0; i--) ctx.lineTo(points[i].x + points[i].w / 2, points[i].y);
  ctx.closePath(); ctx.fill();
  // suckers
  ctx.fillStyle = "rgba(240,190,210,0.75)";
  for (let i = 2; i < segments - 2; i += 2) {
    const p = points[i];
    ctx.beginPath(); ctx.arc(p.x + p.w * 0.25, p.y, Math.max(1.5, p.w * 0.16), 0, TAU); ctx.fill();
  }
  ctx.restore();
}

export function clearSlams() {
  slams = [];
}
