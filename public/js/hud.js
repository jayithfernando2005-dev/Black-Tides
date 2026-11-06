// hud.js - the ship's instruments above the sea (HTML, not canvas):
// hull, shots, wave, gold and score. Only changes what is different.
const parts = {
  captain: document.getElementById("hud-captain"),
  hull: document.getElementById("hud-hull"),
  hullFill: document.getElementById("hud-hull-fill"),
  hullNumber: document.getElementById("hud-hull-number"),
  ammo: document.getElementById("hud-ammo"),
  pips: document.getElementById("hud-pips"),
  wave: document.getElementById("hud-wave"),
  storm: document.getElementById("hud-storm"),
  gold: document.getElementById("hud-gold"),
  score: document.getElementById("hud-score"),
  power: document.getElementById("power-tag")
};
let last = {};

function changed(key, value) {
  if (last[key] === value) {
    return false;
  }
  last[key] = value;
  return true;
}

export function resetHud() {
  last = {};
}

export function updateHud(data) {
  if (changed("captain", data.captain)) {
    parts.captain.textContent = data.captain;
  }
  const hull = Math.ceil(data.hull);
  if (changed("hull", hull + "/" + data.maxHull)) {
    parts.hullFill.style.width = (100 * hull / data.maxHull) + "%";
    parts.hullNumber.textContent = hull;
    parts.hull.classList.toggle("low", hull < data.maxHull * 0.3);
  }
  if (changed("cap", data.cap)) {
    parts.pips.replaceChildren();
    for (let i = 0; i < data.cap; i++) {
      parts.pips.appendChild(document.createElement("i"));
    }
    last.ammo = undefined;
  }
  if (changed("ammo", data.ammo)) {
    [...parts.pips.children].forEach((pip, i) => pip.classList.toggle("on", i < data.ammo));
    parts.ammo.classList.toggle("empty", data.ammo === 0);
  }
  if (changed("wave", data.wave)) {
    parts.wave.textContent = data.wave;
  }
  if (changed("storm", data.storm)) {
    parts.storm.hidden = !data.storm;
  }
  if (changed("gold", data.gold)) {
    parts.gold.textContent = data.gold;
  }
  if (changed("score", data.score)) {
    parts.score.textContent = data.score;
  }
  if (changed("power", data.power)) {
    parts.power.hidden = data.power === "";
    parts.power.textContent = data.power;
  }
}
