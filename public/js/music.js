// music.js - background music. "The Buccaneer's Haul" plays on the menus and the map,
// "Pirates!" plays in battle, with a smooth fade between them. The volume comes from
// Settings (Music volume, Mute all sound). Browsers only allow music after the player has
// pressed a key or clicked, so it starts after "Press any key to continue".
//
// Music credits (both CC-BY 4.0):
//   "The Buccaneer's Haul" by Shane Ivers - https://www.silvermansound.com
//   "Pirates!" by Eric Matyas - Soundimage.org
import { on } from "./events.js";
import { getSettings } from "./settings.js";

const TRACKS = {
  theme: new Audio("audio/the-buccaneers-haul.mp3"),
  battle: new Audio("audio/pirates.mp3")
};
for (const track of Object.values(TRACKS)) {
  track.loop = true;
  track.preload = "auto";
  track.volume = 0;
}

let current = null;          // the track that should be playing ("theme" or "battle")
let allowed = false;         // true after the player's first key press or click
let fade = 0;                // how far the fade has got (0 to 1)
let fading = null;

// The loudest the music may be, from Settings (0 to 1).
function maxVolume() {
  const settings = getSettings();
  if (settings.mute) return 0;
  return (settings.music === undefined ? 60 : settings.music) / 100;
}

// Asks the browser to play the current track. Browsers sometimes refuse (the player has not
// interacted "enough" yet, or the file is still loading), so a refusal is not the end:
// ensurePlaying() asks again on the next click or key press, and when the file has loaded.
function tryPlay() {
  if (!allowed || !current) return;
  const track = TRACKS[current];
  if (!track.paused) return;
  track.play().catch((error) => {
    console.info("Music is waiting for the next click or key press (" + error.name + ").");
  });
}

function ensurePlaying() {
  if (document.hidden) return;
  tryPlay();
}
// Events: any click, tap or key press is a new chance to start the music.
for (const type of ["pointerdown", "keydown", "click", "touchend"]) {
  document.addEventListener(type, ensurePlaying, true);
}
// Event: a track finished loading - try again in case it was too early before.
for (const track of Object.values(TRACKS)) {
  track.addEventListener("canplaythrough", ensurePlaying);
}

// Fades the new track in and every other track out over about 1.5 seconds.
function play(name) {
  if (!allowed || name === current) return;
  current = name;
  tryPlay();
  cancelAnimationFrame(fading);
  const start = performance.now();
  const startVolumes = Object.fromEntries(Object.entries(TRACKS).map(([key, track]) => [key, track.volume]));
  function step(now) {
    fade = Math.max(0, Math.min(1, (now - start) / 1500));
    for (const [key, track] of Object.entries(TRACKS)) {
      const target = key === current ? maxVolume() : 0;
      track.volume = Math.max(0, Math.min(1, startVolumes[key] + (target - startVolumes[key]) * fade));
      if (key !== current && fade >= 1) track.pause();
    }
    if (fade < 1) fading = requestAnimationFrame(step);
  }
  fading = requestAnimationFrame(step);
}

function trackFor(screen) {
  return screen === "game" ? "battle" : "theme";
}

let lastScreen = "login";

// Event: the player pressed a key on the splash screen (sound is now allowed).
export function startMusic() {
  if (allowed) return;
  allowed = true;
  play(trackFor(lastScreen));
  // After the player's key press the browser allows sound for the rest of the visit,
  // so if the very first attempt was refused, a few quick retries start the music by itself.
  for (const delay of [400, 1200, 2500, 5000]) setTimeout(ensurePlaying, delay);
}

// Event: a screen was shown - battle music in the battle, the theme everywhere else.
on("screen:shown", (name) => {
  lastScreen = name;
  play(trackFor(name));
});

// Event: the settings changed - apply the new music volume straight away.
on("settings:changed", () => {
  if (current && fade >= 1) TRACKS[current].volume = Math.min(1, maxVolume());
});

// Quieter while the battle is paused.
on("battle:paused", () => { if (current === "battle") TRACKS.battle.volume = maxVolume() * 0.35; });
on("battle:resumed", () => { if (current === "battle") TRACKS.battle.volume = maxVolume(); });

// Leaving the tab pauses the music; coming back carries on.
document.addEventListener("visibilitychange", () => {
  if (!current) return;
  if (document.hidden) TRACKS[current].pause();
  else tryPlay();
});