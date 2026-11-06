// shots.js - cannonballs: ours (bone) and the raiders' (rust).
const SHOT_SPEED = 540;           // pixels per second
const ENEMY_SHOT_SPEED = 250;
const SHOT_LIFE = 1.4;            // seconds before a cannonball sinks
const SHIP_RADIUS = 18;           // how close a cannonball must be to hit our ship

let shots = [];
let enemyShots = [];

// Fires one cannonball from the front of the ship, in the direction it faces.
export function fireShot(ship, damage) {
  shots.push({
    x: ship.x + Math.cos(ship.angle) * 26,
    y: ship.y + Math.sin(ship.angle) * 26,
    vx: Math.cos(ship.angle) * SHOT_SPEED,
    vy: Math.sin(ship.angle) * SHOT_SPEED,
    life: SHOT_LIFE,
    damage: damage
  });
}

// A raider fires a cannonball at an angle.
export function fireEnemyShot(x, y, angle, damage) {
  enemyShots.push({
    x: x, y: y,
    vx: Math.cos(angle) * ENEMY_SHOT_SPEED,
    vy: Math.sin(angle) * ENEMY_SHOT_SPEED,
    life: 3,
    damage: damage
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
