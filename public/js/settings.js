// settings.js - the player's settings, kept in a cookie on this device.
// This cookie is readable by our page scripts on purpose (it holds nothing secret).
// The login cookie (connect.sid) is different: it is httpOnly, so scripts cannot read it.
import { emit } from "./events.js";

const COOKIE_NAME = "bt_settings";
const ONE_YEAR = 365 * 24 * 60 * 60;          // in seconds

export const DEFAULTS = { sfx: 80, music: 60, ambience: 50, mute: false, shake: true, keys: "wasd", liveNews: true, weatherCity: "colombo", difficulty: "normal",
  colourBlind: false, bigText: false, reduceMotion: false, highContrast: false };
// The places the server can read the weather for (server/weather.js has the same list).
export const WEATHER_CITIES = ["colombo", "kandy", "galle", "jaffna", "trincomalee", "luton", "london"];

// Keeps a number between 0 and 100.
function percent(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : fallback;
}

// Checks every value, so a damaged or edited cookie cannot break the game.
function clean(raw) {
  return {
    sfx: percent(raw.sfx, DEFAULTS.sfx),
    music: percent(raw.music, DEFAULTS.music),
    ambience: percent(raw.ambience, DEFAULTS.ambience),
    mute: raw.mute === true,
    shake: raw.shake !== false,
    keys: raw.keys === "arrows" ? "arrows" : "wasd",
    liveNews: raw.liveNews !== false,
    weatherCity: WEATHER_CITIES.includes(raw.weatherCity) ? raw.weatherCity : DEFAULTS.weatherCity,
    difficulty: ["easy", "normal", "hard"].includes(raw.difficulty) ? raw.difficulty : "normal",
    colourBlind: raw.colourBlind === true,
    bigText: raw.bigText === true,
    reduceMotion: raw.reduceMotion === true,
    highContrast: raw.highContrast === true
  };
}

// Reads the settings cookie, or the defaults if there is none.
function readCookie() {
  const part = document.cookie.split("; ").find((item) => item.startsWith(COOKIE_NAME + "="));
  if (!part) {
    return { ...DEFAULTS };
  }
  try {
    return clean(JSON.parse(decodeURIComponent(part.slice(COOKIE_NAME.length + 1))));
  } catch (error) {
    return { ...DEFAULTS };
  }
}

let current = readCookie();

export function getSettings() {
  return { ...current };
}

// Saves the settings for one year and tells the rest of the game.
export function saveSettings(next) {
  current = clean({ ...current, ...next });
  document.cookie = COOKIE_NAME + "=" + encodeURIComponent(JSON.stringify(current)) +
    "; max-age=" + ONE_YEAR + "; path=/; SameSite=Lax";
  emit("settings:changed", getSettings());
}

export function resetSettings() {
  saveSettings(DEFAULTS);
}
