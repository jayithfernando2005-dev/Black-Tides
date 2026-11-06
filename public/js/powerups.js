// powerups.js - supply crates that float up during battle.
// Sail over one to pick it up: Shield, Rapid fire or Repair.
export const POWERUPS = {
  shield: { label: "Shield", text: "Blocks cannonballs for 6 s", color: "#6fe0a8", seconds: 6 },
  rapid: { label: "Rapid fire", text: "Fire twice as fast for 8 s", color: "#dba63f", seconds: 8 },
  repair: { label: "Repair", text: "+25 hull", color: "#ece4cf", seconds: 0 }
};

const MAX_CRATES = 2;
const CRATE_LIFE = 14;            // seconds before a crate sinks
const PICK_DISTANCE = 30;

let crates = [];
let nextCrate = 12;

function randomType() {
  const types = Object.keys(POWERUPS);
  return types[Math.floor(Math.random() * types.length)];
}

// Moves the timers, drops new crates, and returns the type picked up this frame (or null).
export function updatePowerups(seconds, ship, width, height) {
  nextCrate -= seconds;
  if (nextCrate <= 0) {
    nextCrate = 12 + Math.random() * 6;
    if (crates.length < MAX_CRATES) {
      crates.push({
        x: 80 + Math.random() * (width - 160),
        y: 80 + Math.random() * (height - 160),
        type: randomType(),
        life: CRATE_LIFE,
        bob: Math.random() * 6
      });
    }
  }

  let picked = null;
  for (const crate of crates) {
    crate.life -= seconds;
    crate.bob += seconds;
    if (!picked && Math.hypot(crate.x - ship.x, crate.y - ship.y) < PICK_DISTANCE) {
      picked = crate.type;
      crate.life = 0;
    }
  }
  crates = crates.filter((crate) => crate.life > 0);
  return picked;
}

export function getCrates() {
  return crates;
}

export function clearPowerups() {
  crates = [];
  nextCrate = 12;
}
