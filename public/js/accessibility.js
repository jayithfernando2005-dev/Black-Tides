// AI note: written with help from Claude (Anthropic), as allowed for this assignment.
// accessibility.js - turns the accessibility settings into classes on <body>, so the CSS
// can change colours, text size and motion; the battle reads the same settings for its
// canvas drawing (palette() below).
import { getSettings } from "./settings.js";
import { on } from "./events.js";

function apply(settings) {
  const body = document.body.classList;
  body.toggle("a11y-colourblind", settings.colourBlind);
  body.toggle("a11y-bigtext", settings.bigText);
  body.toggle("a11y-reduce-motion", settings.reduceMotion);
  body.toggle("a11y-contrast", settings.highContrast);
}

// Colours for the battle canvas: blue and orange instead of green and red when asked.
export function palette() {
  const s = getSettings();
  return {
    danger: s.colourBlind ? "#ff9f1c" : "#e0422e",
    safe: s.colourBlind ? "#3a86ff" : "#5fd39b",
    contrast: s.highContrast
  };
}

apply(getSettings());
on("settings:changed", apply);
