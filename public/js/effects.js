// effects.js - explosions, sparks, foam and screen shake. Only for looks.
let effects = [];
let shake = 0;

function add(effect) {
  effect.max = effect.life;
  effects.push(effect);
}

// Sparks and a ring of smoke. Bigger for a boss or our own ship.
export function explode(x, y, big) {
  const count = big ? 34 : 16;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 40 + Math.random() * (big ? 220 : 140);
    add({
      kind: "spark", x: x, y: y,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      r: 1.5 + Math.random() * (big ? 4 : 2.5),
      color: Math.random() < 0.5 ? "#dba63f" : "#de6a48",
      life: 0.5 + Math.random() * 0.5
    });
  }
  add({ kind: "ring", x: x, y: y, r: big ? 90 : 46, life: 0.6 });
  addShake(big ? 1 : 0.4);
}

// A small splash where a cannonball hits.
export function splash(x, y) {
  add({ kind: "ring", x: x, y: y, r: 16, life: 0.3 });
}

// Foam left behind a moving ship.
export function foam(x, y) {
  add({ kind: "foam", x: x, y: y, r: 5 + Math.random() * 3, life: 0.9 });
}

export function addShake(amount) {
  shake = Math.min(1, shake + amount);
}

export function updateEffects(seconds) {
  for (const effect of effects) {
    effect.life -= seconds;
    if (effect.kind === "spark") {
      effect.x += effect.vx * seconds;
      effect.y += effect.vy * seconds;
      effect.vx *= 0.94;
      effect.vy *= 0.94;
    }
  }
  effects = effects.filter((effect) => effect.life > 0);
  shake = Math.max(0, shake - seconds * 2.5);
}

export function getEffects() {
  return effects;
}

export function getShake() {
  return shake;
}

export function clearEffects() {
  effects = [];
  shake = 0;
}
