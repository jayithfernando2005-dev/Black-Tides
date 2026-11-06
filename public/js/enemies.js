// enemies.js - raider ships and the boss flagship: where they appear,
// how they sail, when they fire, and when our cannonballs hit them.
import { fireEnemyShot, removeShot } from "./shots.js";
import { emit } from "./events.js";

const EDGE = 30;                  // raiders stay this far inside the sea once they arrive
let raiders = [];

// Picks a point just outside a random edge of the sea.
function edgePoint(width, height) {
  const side = Math.floor(Math.random() * 4);
  if (side === 0) return { x: Math.random() * width, y: -40 };
  if (side === 1) return { x: width + 40, y: Math.random() * height };
  if (side === 2) return { x: Math.random() * width, y: height + 40 };
  return { x: -40, y: Math.random() * height };
}

// A raider gets tougher and faster in later waves.
export function spawnRaider(width, height, wave) {
  const start = edgePoint(width, height);
  const hp = 2 + Math.floor(wave / 3);
  raiders.push({
    x: start.x, y: start.y, angle: 0,
    hp: hp, maxHp: hp,
    speed: Math.min(80 + 3 * wave, 115),
    size: 18, scale: 1,
    keepAway: 170 + Math.random() * 60,       // likes to sail at this distance
    side: Math.random() < 0.5 ? 1 : -1,       // circles left or right
    cooldown: 1 + Math.random() * 1.5,
    reload: 2.2, damage: 10, spread: 1,
    flash: 0, entered: false, boss: false
  });
}

// The boss flagship: twice the size, many more hit points, fires three cannonballs at once.
export function spawnBoss(width, height, wave) {
  const hp = 12 + 2 * wave;
  raiders.push({
    x: width / 2, y: -60, angle: Math.PI / 2,
    hp: hp, maxHp: hp,
    speed: 60, size: 34, scale: 1.9,
    keepAway: 240, side: 1,
    cooldown: 2, reload: 1.6, damage: 12, spread: 3,
    flash: 0, entered: false, boss: true
  });
}

// Sails every raider towards our ship, circles at a distance, and fires.
export function updateRaiders(seconds, ship, width, height) {
  for (const raider of raiders) {
    const dx = ship.x - raider.x;
    const dy = ship.y - raider.y;
    const distance = Math.hypot(dx, dy) || 1;

    // Far away (or not yet in the sea): sail closer. Close enough: circle around the player.
    let moveX = dx / distance;
    let moveY = dy / distance;
    if (raider.entered && distance < raider.keepAway) {
      moveX = (-dy / distance) * raider.side;
      moveY = (dx / distance) * raider.side;
    }
    raider.x += moveX * raider.speed * seconds;
    raider.y += moveY * raider.speed * seconds;
    raider.angle = Math.atan2(dy, dx);              // always faces our ship

    // Once inside the sea, a raider stays inside it.
    if (raider.x > EDGE && raider.x < width - EDGE && raider.y > EDGE && raider.y < height - EDGE) {
      raider.entered = true;
    }
    if (raider.entered) {
      raider.x = Math.max(EDGE, Math.min(width - EDGE, raider.x));
      raider.y = Math.max(EDGE, Math.min(height - EDGE, raider.y));
    }

    raider.flash = Math.max(0, raider.flash - seconds);
    raider.cooldown -= seconds;
    if (raider.entered && raider.cooldown <= 0 && distance < 460) {
      const aim = raider.angle + (Math.random() - 0.5) * 0.25;   // not perfectly accurate
      for (let i = 0; i < raider.spread; i++) {
        const angle = aim + (i - (raider.spread - 1) / 2) * 0.22;
        fireEnemyShot(raider.x + Math.cos(angle) * raider.size, raider.y + Math.sin(angle) * raider.size,
          angle, raider.damage);
      }
      raider.cooldown = raider.reload + Math.random() * 0.8;
      emit("raider:fired");
    }
  }
}

// Checks our cannonballs against every raider.
// Returns how many hits there were and which raiders sank, and where.
export function checkHits(shots) {
  let hits = 0;
  const sunk = [];
  for (const shot of shots) {
    for (const raider of raiders) {
      if (raider.hp > 0 && Math.hypot(shot.x - raider.x, shot.y - raider.y) < raider.size + 7) {
        raider.hp -= shot.damage;
        raider.flash = 0.12;
        removeShot(shot);
        hits += 1;
        if (raider.hp <= 0) {
          sunk.push({ x: raider.x, y: raider.y, boss: raider.boss });
        }
        break;
      }
    }
  }
  raiders = raiders.filter((raider) => raider.hp > 0);
  return { hits: hits, sunk: sunk };
}

export function getRaiders() {
  return raiders;
}

export function getBoss() {
  return raiders.find((raider) => raider.boss) || null;
}

export function clearRaiders() {
  raiders = [];
}
