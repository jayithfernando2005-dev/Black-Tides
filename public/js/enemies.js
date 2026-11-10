// AI note: written with help from Claude (Anthropic), as allowed for this assignment.
// enemies.js - raider ships and the bosses: where they appear,
// how they sail, when they fire, and when our cannonballs hit them.
// Raider types: "raider" (normal), "cutter" (small and fast), "ironclad" (slow and armoured).
// Bosses: the raider flagship, and the kraken (a sea monster that slams tentacles).
import { fireEnemyShot, removeShot } from "./shots.js";
import { addSlam } from "./hazards.js";
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

// Points and gold for sinking each kind of ship (game.js uses these).
export const REWARDS = {
  raider: { points: 100, gold: 10 },
  cutter: { points: 120, gold: 12 },
  ironclad: { points: 250, gold: 25 },
  flagship: { points: 600, gold: 60 },
  kraken: { points: 1500, gold: 150 }
};

// A raider gets tougher and faster in later waves. type: "raider", "cutter" or "ironclad".
export function spawnRaider(width, height, wave, type = "raider") {
  const start = edgePoint(width, height);
  const base = {
    x: start.x, y: start.y, angle: 0, type: type,
    side: Math.random() < 0.5 ? 1 : -1,       // circles left or right
    cooldown: 1 + Math.random() * 1.5,
    flash: 0, entered: false, boss: false
  };
  let hp;
  if (type === "cutter") {
    // small, quick, darts in close, but sinks fast
    hp = 1 + Math.floor(wave / 4);
    Object.assign(base, { speed: Math.min(150 + 3 * wave, 185), size: 15, scale: 0.8, keepAway: 110 + Math.random() * 40, reload: 1.5, damage: 6, spread: 1 });
  } else if (type === "ironclad") {
    // slow and heavily armoured, fires a heavy double shot
    hp = 6 + Math.floor(wave / 2);
    Object.assign(base, { speed: 48, size: 24, scale: 1.25, keepAway: 240 + Math.random() * 40, reload: 3, damage: 16, spread: 2 });
  } else {
    hp = 2 + Math.floor(wave / 3);
    Object.assign(base, { speed: Math.min(80 + 3 * wave, 115), size: 18, scale: 1, keepAway: 170 + Math.random() * 60, reload: 2.2, damage: 10, spread: 1 });
  }
  base.hp = hp;
  base.maxHp = hp;
  raiders.push(base);
}

// The kraken: rises in the upper sea, sprays ink and slams tentacles where the ship is.
export function spawnKraken(width, height, wave) {
  const hp = 50 + 5 * wave;
  raiders.push({
    x: width / 2, y: height * 0.3, homeX: width / 2, angle: Math.PI / 2, type: "kraken",
    hp: hp, maxHp: hp, size: 72, hitOffset: -35, scale: 1,
    cooldown: 2.5, slamTimer: 3, age: 0, speed: 0,
    flash: 0, entered: true, boss: true, kraken: true
  });
}

function updateKraken(kraken, seconds, ship, width) {
  kraken.age += seconds;
  kraken.x = kraken.homeX + Math.sin(kraken.age * 0.35) * width * 0.25;   // drifts slowly side to side
  kraken.angle = Math.atan2(ship.y - kraken.y, ship.x - kraken.x);
  kraken.flash = Math.max(0, kraken.flash - seconds);
  if (kraken.age < 2) return;                                 // still rising
  kraken.cooldown -= seconds;
  if (kraken.cooldown <= 0) {
    // a fan of five ink blobs
    for (let i = 0; i < 5; i++) {
      const angle = kraken.angle + (i - 2) * 0.18;
      fireEnemyShot(kraken.x + Math.cos(angle) * 60, kraken.y + Math.sin(angle) * 40, angle, 9, "ink");
    }
    kraken.cooldown = 2.4 + Math.random() * 0.8;
    emit("raider:fired");
  }
  kraken.slamTimer -= seconds;
  if (kraken.slamTimer <= 0) {
    addSlam(ship.x, ship.y, { damage: 18, warn: 1.2, radius: 52 });   // a tentacle where the ship is now
    kraken.slamTimer = kraken.hp < kraken.maxHp / 2 ? 2.2 : 3.4;       // angrier when hurt
  }
}

// The boss flagship: twice the size, many more hit points, fires three cannonballs at once.
export function spawnBoss(width, height, wave) {
  const hp = 12 + 2 * wave;
  raiders.push({
    x: width / 2, y: -60, angle: Math.PI / 2, type: "flagship",
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
    if (raider.kraken) {
      updateKraken(raider, seconds, ship, width);
      continue;
    }
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
      if (raider.hp > 0 && Math.hypot(shot.x - raider.x, shot.y - (raider.y + (raider.hitOffset || 0))) < raider.size + 7) {
        raider.hp -= shot.damage;
        raider.flash = 0.12;
        removeShot(shot);
        hits += 1;
        if (raider.hp <= 0) {
          sunk.push({ x: raider.x, y: raider.y, boss: raider.boss, type: raider.type });
        }
        break;
      }
    }
  }
  raiders = raiders.filter((raider) => raider.hp > 0);
  return { hits: hits, sunk: sunk };
}

// Raiders sunk by something other than cannonballs (e.g. a whirlpool).
export function removeWrecks() {
  const sunk = raiders.filter((raider) => raider.hp <= 0).map((raider) => ({ x: raider.x, y: raider.y, boss: raider.boss, type: raider.type }));
  raiders = raiders.filter((raider) => raider.hp > 0);
  return sunk;
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
