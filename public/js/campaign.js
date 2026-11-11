// campaign.js - the Naval Campaign Map. Shows the nine stages on the parchment map:
// won stages get a green tick, the next stage is the "current target", later ones are
// locked. The server (GET /api/campaign) says how far the captain has got; this file
// only draws the map and remembers which voyage was chosen for the next battle.
import * as api from "./api.js";
import { getSettings } from "./settings.js";

// Where each stage sits on the parchment picture (770 x 486 pixels).
const SPOTS = {
  1: [216, 273], 2: [380, 135], 3: [435, 263], 4: [304, 400], 5: [513, 398],
  6: [567, 265], 7: [517, 128], 8: [691, 160], 9: [693, 325]
};
const ICONS = {
  volcano: "img/map-icon-volcano.png", fort: "img/map-icon-fort.png", castle: "img/map-icon-castle.png",
  whirlpool: "img/map-icon-whirlpool.png", chest: "img/map-icon-chest.png", raider: "img/map-icon-raider.png",
  bastion: "img/map-icon-bastion.png", port: "img/map-icon-port.png", galleon: "img/map-icon-galleon.png"
};
const MAP_W = 770;
const MAP_H = 486;

let campaign = { unlocked: 1, total: 9, stages: [] };
let selected = 1;
let voyage = { mode: "endless", stage: null };      // what the next "Set sail" plays

const $ = (id) => document.getElementById(id);

// The voyage for the next battle: a campaign stage, or endless waves.
export function getVoyage() {
  return voyage;
}
export function chooseStage(stage) {
  voyage = { mode: "stage", stage: stage };
}
export function chooseEndless() {
  voyage = { mode: "endless", stage: null };
}
export function stageById(id) {
  return campaign.stages.find((s) => s.id === id) || null;
}

// The stage's twists, in words.
function twists(stage) {
  const list = [];
  if (stage.bossWaves.length) list.push("Flagship in wave " + stage.bossWaves.join(" and "));
  if (stage.kraken && stage.kraken.length) list.push("Kraken in wave " + stage.kraken.join(" and "));
  if (stage.storm === "always") list.push("Storm all battle");
  if (stage.fog) list.push("Fog");
  if (stage.extra) list.push("+" + stage.extra + " raider" + (stage.extra > 1 ? "s" : "") + " per wave");
  if (stage.goldBonus > 1) list.push("Double gold");
  return list;
}

function stateOf(stage) {
  if (stage.id < campaign.unlocked) return "won";
  if (stage.id === campaign.unlocked) return "current";
  return "locked";
}

function make(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

// Gold sea-routes between the stages; dashed and dark where the way is still locked.
function drawRoutes() {
  const svg = $("map-routes");
  const parts = [];
  for (let id = 1; id < campaign.stages.length; id++) {
    const [x1, y1] = SPOTS[id];
    const [x2, y2] = SPOTS[id + 1];
    const mx = (x1 + x2) / 2 + (y2 - y1) * 0.18;
    const my = (y1 + y2) / 2 - (x2 - x1) * 0.18;
    const open = id + 1 <= campaign.unlocked;
    parts.push(`<path class="route ${open ? "open" : "closed"}" d="M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}"/>`);
  }
  svg.innerHTML = parts.join("");          // fixed shapes only, no user text
}

function drawNodes() {
  const box = $("map-nodes");
  box.replaceChildren();
  for (const stage of campaign.stages) {
    const [x, y] = SPOTS[stage.id];
    const state = stateOf(stage);
    const node = make("button", "map-node " + state + (stage.id === selected ? " selected" : ""));
    node.type = "button";
    node.style.left = (100 * x / MAP_W) + "%";
    node.style.top = (100 * y / MAP_H) + "%";
    node.setAttribute("aria-label", "Stage " + stage.id + ": " + stage.name + (state === "won" ? ", won" : state === "current" ? ", current target" : ", locked"));

    const ring = make("span", "node-ring");
    const icon = make("img", "node-icon");
    icon.src = ICONS[stage.icon];
    icon.alt = "";
    ring.append(icon);
    if (state === "locked") ring.append(make("span", "node-lock", "?"));
    ring.append(make("span", "node-level", "L" + stage.id));
    if (state === "won") ring.append(make("span", "node-tick", "✓"));
    node.append(ring, make("span", "node-ribbon", stage.name));
    if (state === "current") node.append(make("span", "node-target", "Current target"));

    node.addEventListener("click", () => select(stage.id));
    node.addEventListener("dblclick", () => { if (stateOf(stage) !== "locked") $("map-sail").click(); });
    box.appendChild(node);
  }
  // the player's ship waits next to the stage that is selected
  const [sx, sy] = SPOTS[selected];
  const ship = $("map-ship");
  ship.style.left = (100 * (sx - 52) / MAP_W) + "%";
  ship.style.top = (100 * (sy + 10) / MAP_H) + "%";
}

function select(id) {
  const stage = stageById(id);
  if (!stage) return;
  const orders = $("map-orders");
  if (stateOf(stage) === "locked") {
    orders.textContent = "Stage " + id + " · " + stage.name + " is locked. Win stage " + campaign.unlocked + " to unlock the next waters.";
    orders.className = "map-orders locked";
    return;
  }
  selected = id;
  chooseStage(stage);
  orders.className = "map-orders";
  orders.replaceChildren(
    make("b", "", "Stage " + stage.id + " · " + stage.name),
    make("span", "", " — Win " + stage.waves + " waves. " + stage.text),
    make("em", "", "  " + [...twists(stage), "Reward " + (stateOf(stage) === "won" ? 10 * stage.id : 40 * stage.id) + " gold"].join(" · "))
  );
  drawNodes();
}

function drawProgressPanel() {
  const list = $("map-progress-list");
  list.replaceChildren();
  for (const stage of campaign.stages) {
    const state = stateOf(stage);
    const row = make("li", state);
    row.append(make("span", "", stage.id + ". " + stage.name), make("b", "", state === "won" ? "Won ✓" : state === "current" ? "Current target" : "Locked"));
    list.appendChild(row);
  }
}

// Fetches the campaign from the server and draws the whole map.
// The forecast line under "Endless voyage": the real weather the voyage will sail in.
async function showForecast() {
  const line = $("map-weather");
  try {
    const weather = await api.getWeather(getSettings().weatherCity);
    const effect = weather.storm === "always" ? "storm all voyage" : weather.storm === "often" ? "storms come often" : weather.fog ? "fog on the water" : "calm seas";
    line.replaceChildren();
    const strong = document.createElement("b");
    strong.textContent = weather.cityName + ": ";
    line.append(strong, weather.label + ", " + weather.temperature + "°C");
    line.title = "The Endless voyage sails in the real weather: " + weather.label + ", wind " + weather.wind + " km/h - " + effect;
    line.hidden = false;
  } catch (error) {
    line.hidden = true;                         // no weather: the voyage simply sails in normal weather
  }
}

export async function showMap() {
  showForecast();
  try {
    campaign = await api.getCampaign();
  } catch (error) {
    $("map-orders").textContent = error.message;
    return;
  }
  const won = Math.min(campaign.unlocked - 1, campaign.total);
  $("map-count").textContent = "Campaign progress: " + won + " of " + campaign.total + " victories";
  const done = campaign.unlocked > campaign.total;
  if (voyage.mode !== "stage" || !voyage.stage || voyage.stage.id > campaign.unlocked) {
    selected = done ? campaign.total : campaign.unlocked;
  } else {
    selected = voyage.stage.id;
  }
  drawRoutes();
  drawProgressPanel();
  select(selected);
  $("map-legend").hidden = true;
  $("map-progress").hidden = true;
}

// After a won stage: the next stage becomes the voyage for "Next stage".
export function advanceTo(stage) {
  if (stage) {
    selected = stage.id;
    chooseStage(stage);
  }
}

// ----- buttons on the map -----
$("map-legend-button").addEventListener("click", () => {
  $("map-progress").hidden = true;
  $("map-legend").hidden = !$("map-legend").hidden;
});
$("map-progress-button").addEventListener("click", () => {
  $("map-legend").hidden = true;
  $("map-progress").hidden = !$("map-progress").hidden;
});
$("endless-button").addEventListener("click", () => chooseEndless());
$("map-sail").addEventListener("click", () => {
  const stage = stageById(selected);
  if (stage) chooseStage(stage);
});
