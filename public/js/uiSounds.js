// uiSounds.js - sounds for the menu buttons: a soft chime when the pointer moves onto
// a button (or keyboard focus reaches it), and a click when it is pressed.
import { sounds } from "./sound.js";

const BUTTONS = ".pill, .map-node, .plaque-button";

// Event: the pointer moved onto a button (not just between its inner parts).
document.addEventListener("pointerover", (event) => {
  const button = event.target.closest(BUTTONS);
  if (!button || button.disabled || button.contains(event.relatedTarget)) return;
  sounds.hover();
});

// Event: keyboard focus moved onto a button with Tab.
document.addEventListener("focusin", (event) => {
  const button = event.target.closest && event.target.closest(BUTTONS);
  if (button && button.matches(":focus-visible")) sounds.hover();
});

// Event: a button without its own navigation sound was pressed.
document.addEventListener("click", (event) => {
  const button = event.target.closest(BUTTONS);
  if (button && !button.dataset.nav) sounds.click();
});
