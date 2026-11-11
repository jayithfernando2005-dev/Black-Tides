// AI note: written with help from Claude (Anthropic), as allowed for this assignment.
// shots.js - cannonballs: ours (bone) and the raiders' (rust).
const SHOT_SPEED = 540;           // pixels per second
const ENEMY_SHOT_SPEED = 250;
const SHOT_LIFE = 1.4;            // seconds before a cannonball sinks
const SHIP_RADIUS = 18;           // how close a cannonball must be to hit our ship

let shots = [];
let enemyShots = [];

// Fires from the front of the ship, in the direction it faces.
// kind: "iron" (normal), "chain" (slows the ship it hits), "fire" (sets it burning and
// splashes the ships nearby) or "broadside" (five cannonballs in a fan).
export function fireShot(ship, damage, kind = "iron") {
  const angles = kind === "broadside" ? [-0.3, -0.15, 0, 0.15, 0.3] : [0];
  for (const turn of angles) {
    const angle = ship.angle + turn;
    shots.push({
      x: ship.x + Math.cos(angle) * 26,
      y: ship.y + Math.sin(angle) * 26,
      vx: Math.cos(angle) * SHOT_SPEED,
      vy: Math.sin(angle) * SHOT_SPEED,
      life: SHOT_LIFE,
      damage: damage,
      kind: kind === "broadside" ? "iron" : kind
    });
  }
}

// A raider fires a cannonball at an angle.
// kind: "fire" (a cannonball) or "ink" (the kraken's ink blob, a little slower).
export function fireEnemyShot(x, y, angle, damage, kind = "fire") {
  const speed = kind === "ink" ? ENEMY_SHOT_SPEED * 0.8 : ENEMY_SHOT_SPEED;
  enemyShots.push({
    x: x, y: y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: 3,
    damage: damage,
    kind: kind
  });
}

// Moves every cannonball and removes the old ones.
export function updateShots(seconds) {
  for (const list of [shots, enemyShots]) {
    for (const shot of list) {
      shot.x += shot.vx * seconds;
      shot.y += shot.vy * seconds;
      shot.life -= seconds;
    }
  }
  shots = shots.filter((shot) => shot.life > 0);
  enemyShots = enemyShots.filter((shot) => shot.life > 0);
}

// Removes raider cannonballs that hit our ship and returns the total damage.
export function checkPlayerHit(ship) {
  let damage = 0;
  enemyShots = enemyShots.filter((shot) => {
    if (Math.hypot(shot.x - ship.x, shot.y - ship.y) < SHIP_RADIUS) {
      damage += shot.damage;
      return false;
    }
    return true;
  });
  return damage;
}

export function removeShot(shot) {
  shot.life = 0;
}

export function clearShots() {
  shots = [];
  enemyShots = [];
}

export function getShots() {
  return shots.filter((shot) => shot.life > 0);
}

export function getEnemyShots() {
  return enemyShots;
}
