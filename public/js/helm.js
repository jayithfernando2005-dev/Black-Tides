// helm.js - the ship's wheel on the Settings page for choosing the steering keys.
// It is only a nicer way to change the hidden <select id="set-keys">, which screens.js
// reads when the settings are saved. The wheel turns when the choice changes.
import { on } from "./events.js";

const select = document.getElementById("set-keys");
const helm = document.getElementById("helm");
const button = document.getElementById("helm-button");
const valueLabel = document.getElementById("helm-value");
const list = document.getElementById("helm-list");
const options = [...list.querySelectorAll("[role=option]")];
const LABELS = { wasd: "WASD", arrows: "Arrow keys" };
let turns = 0;

// Shows the select's current value on the wheel.
function showValue() {
  valueLabel.textContent = LABELS[select.value] || "WASD";
  for (const option of options) option.setAttribute("aria-selected", String(option.dataset.value === select.value));
}

function openList() {
  list.hidden = false;
  button.setAttribute("aria-expanded", "true");
  const current = options.find((o) => o.dataset.value === select.value) || options[0];
  current.focus();
}

function closeList(focusButton) {
  list.hidden = true;
  button.setAttribute("aria-expanded", "false");
  if (focusButton) button.focus();
}

function choose(value) {
  if (value !== select.value) {
    select.value = value;
    turns += value === "arrows" ? 1 : -1;
    helm.style.setProperty("--turn", turns * 90 + "deg");     // spin the wheel a quarter turn
  }
  showValue();
  closeList(true);
}

button.addEventListener("click", () => (list.hidden ? openList() : closeList(true)));
for (const option of options) {
  option.addEventListener("click", () => choose(option.dataset.value));
}
// Keyboard: arrows move between choices, Enter or Space picks, Escape closes.
list.addEventListener("keydown", (event) => {
  const index = options.indexOf(document.activeElement);
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    options[(index + (event.key === "ArrowDown" ? 1 : options.length - 1)) % options.length].focus();
  } else if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    choose(document.activeElement.dataset.value);
  } else if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();                                    // close the list, not the whole page
    closeList(true);
  }
});
// A click anywhere else closes the list.
document.addEventListener("pointerdown", (event) => {
  if (!list.hidden && !helm.contains(event.target)) closeList(false);
});

// The settings page loads its values when it opens, and again after "Reset to defaults".
on("screen:shown", (name) => { if (name === "settings") showValue(); });
on("settings:changed", () => setTimeout(showValue, 0));
showValue();
