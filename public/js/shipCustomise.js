// AI note: written with help from Claude (Anthropic), as allowed for this assignment.
// shipCustomise.js - the "Your ship's colours" panel in the Shipyard: a name, six sail
// colours and six flags, with a live preview of the ship. Saving sends the choice to the
// server (POST /api/profile/ship); the battle then shows it (shipLook.js, battleArt.js).
import * as api from "./api.js";
import { on } from "./events.js";
import { SAILS, FLAGS, drawFlag, getMyShip, setMyShip } from "./shipLook.js";
import { drawShipPreview } from "./battleArt.js";

const $ = (id) => document.getElementById(id);
let draft = { ...getMyShip() };
let loggedIn = false;
let animating = false;

function buildChoices() {
  $("sail-swatches").replaceChildren(...Object.entries(SAILS).map(([key, sail]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sail-swatch";
    button.style.setProperty("--sail", sail.colour);
    button.title = sail.label;
    button.setAttribute("aria-label", sail.label + " sails");
    button.dataset.sail = key;
    button.addEventListener("click", () => { draft.sail = key; refresh(); });
    return button;
  }));
  $("flag-tiles").replaceChildren(...Object.entries(FLAGS).map(([key, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "flag-tile";
    button.title = label;
    button.setAttribute("aria-label", label + " flag");
    button.dataset.flag = key;
    const canvas = document.createElement("canvas");
    canvas.width = 56; canvas.height = 44;
    drawFlag(canvas.getContext("2d"), key, 8, 6, 40, 0.3);
    button.append(canvas);
    button.addEventListener("click", () => { draft.flag = key; refresh(); });
    return button;
  }));
}

function refresh() {
  for (const b of document.querySelectorAll(".sail-swatch")) b.setAttribute("aria-pressed", String(b.dataset.sail === draft.sail));
  for (const b of document.querySelectorAll(".flag-tile")) b.setAttribute("aria-pressed", String(b.dataset.flag === draft.flag));
}

// The preview keeps moving (the ship bobs, the flag flutters) while the panel is open.
function animate(now) {
  if (!$("ship-custom").open || document.body.dataset.screen !== "shipyard") {
    animating = false;
    return;
  }
  draft.name = $("ship-name").value.replace(/\s+/g, " ").trim();
  const canvas = $("ship-preview");
  drawShipPreview(canvas.getContext("2d"), draft, canvas.width, canvas.height, now / 1000);
  requestAnimationFrame(animate);
}

function startPreview() {
  if (animating) return;
  animating = true;
  requestAnimationFrame(animate);
}

$("ship-custom").addEventListener("toggle", () => {
  if ($("ship-custom").open) startPreview();
});

$("ship-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!loggedIn) {
    $("ship-message").textContent = "Log in to save your ship.";
    return;
  }
  $("ship-save").disabled = true;
  try {
    const result = await api.saveShip({ name: $("ship-name").value, sail: draft.sail, flag: draft.flag });
    setMyShip(result.ship);
    $("ship-message").textContent = "Saved! Your ship will sail like this in battle.";
  } catch (error) {
    $("ship-message").textContent = error.message;
  } finally {
    $("ship-save").disabled = false;
  }
});

// Called each time the Shipyard opens.
export function showShipCustomise(isCaptain) {
  loggedIn = isCaptain;
  draft = { ...getMyShip() };
  $("ship-name").value = draft.name;
  $("ship-name").disabled = !isCaptain;
  $("ship-save").disabled = !isCaptain;
  $("ship-custom-hint").textContent = isCaptain ? "Name your ship, dye the sails, choose a flag" : "Log in to name and paint your ship";
  $("ship-message").textContent = "";
  refresh();
  if ($("ship-custom").open) startPreview();
}

on("ship:changed", (look) => { draft = { ...look }; refresh(); });
buildChoices();
