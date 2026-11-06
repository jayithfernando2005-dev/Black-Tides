// splash.js - the loading screen shown when the game starts, like a real game.
// The key art (img/splash.jpg) is brought to life by liveScene.js while the game loads.
// After "press any key" the same living scene stays behind the login and register pages.

import { on } from "./events.js";
import { createLiveScene } from "./liveScene.js";
import { unlockAudio } from "./sound.js";
import { startMusic } from "./music.js";

// Where things are in the splash picture (in the picture's own pixels, 1376 x 768).
const SPLASH_ART = {
  url: "img/splash.jpg",
  width: 1376,
  height: 768,
  horizon: 372,
  title: { x: 450, y: 44, w: 482, h: 98 },
  ships: [{ x: 520, y: 100, w: 450, h: 475, pivotX: 745, pivotY: 545 }],
  fires: [
    { x: 222, y: 366, size: 1.0 }, { x: 512, y: 346, size: 1.1 },
    { x: 936, y: 326, size: 0.8 }, { x: 1032, y: 320, size: 1.1 }
  ],
  smoke: [
    { x: 196, y: 330, rate: 0.16, size: 1.0 }, { x: 508, y: 330, rate: 0.22, size: 0.8 },
    { x: 960, y: 290, rate: 0.12, size: 1.2 }, { x: 1060, y: 275, rate: 0.1, size: 1.5 }
  ],
  cannons: [
    { x: 606, y: 466, dir: -1, ship: 0 }, { x: 584, y: 458, dir: -1, ship: 0 }, { x: 640, y: 482, dir: -1, ship: 0 },
    { x: 816, y: 420, dir: 1, ship: 0 }, { x: 880, y: 446, dir: 1, ship: 0 }
  ]
};

const splash = document.getElementById("splash");
const barFill = document.getElementById("splash-bar-fill");
const statusLabel = document.getElementById("splash-status");
const percentLabel = document.getElementById("splash-percent");
const continueLabel = document.getElementById("splash-continue");

// On the login page the camera zooms in a little and moves the ship to the right,
// and the left side is darkened so the login panel is easy to read.
const scene = createLiveScene(document.getElementById("splash-art"), SPLASH_ART, {
  framing: { zoom: 0.16, focusX: 745, at: 0.68 },
  overlay(ctx, width, height, framing) {
    if (framing < 0.01) return;
    const shade = ctx.createLinearGradient(0, 0, width * 0.62, 0);
    shade.addColorStop(0, "rgba(3,7,10," + (0.82 * framing) + ")");
    shade.addColorStop(0.55, "rgba(3,7,10," + (0.45 * framing) + ")");
    shade.addColorStop(1, "rgba(3,7,10,0)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, width, height);
  }
});

let backdropMode = false;     // true once the splash has become the login background

// Event: a screen was shown (see screens.js). The living scene stays behind the
// login and register pages; on other screens it fades out and stops drawing.
on("screen:shown", (name) => {
  if (!backdropMode) return;
  if (name === "login" || name === "register") {
    splash.classList.remove("backdrop-off");
    scene.start();
  } else {
    splash.classList.add("backdrop-off");
    setTimeout(() => {
      if (splash.classList.contains("backdrop-off")) scene.stop();   // save the computer's effort
    }, 1100);
  }
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function withTimeout(promise, ms) {
  return Promise.race([Promise.resolve(promise).catch(() => {}), wait(ms)]);
}

// Shows the loading screen, gets the game ready, then waits for a key or click.
// extraLoading: other things to load while the bar fills (e.g. the menu picture).
export function runSplash(extraLoading = []) {
  return new Promise((resolve) => {
    scene.start();

    // The first visit in this tab loads slowly enough to enjoy the scene; a reload loads faster.
    // Either way the game waits on this screen until the player presses a key or clicks.
    let seenBefore = false;
    try {
      seenBefore = sessionStorage.getItem("bt_intro_seen") === "yes";
      sessionStorage.setItem("bt_intro_seen", "yes");
    } catch (error) {
      // Storage blocked: show the full intro.
    }
    const minimumTime = seenBefore ? 1200 : 4500;
    const started = performance.now();

    let target = 0;
    let shown = 0;
    let ready = false;
    let finished = false;
    let lastBarTime = started;

    function setStep(value, text) {
      target = value;
      statusLabel.textContent = text;
    }

    // The bar moves smoothly and never faster than the minimum intro time.
    function updateBar(now) {
      if (ready && shown >= 0.999) return;
      const seconds = Math.max(0, Math.min(0.1, (now - lastBarTime) / 1000));
      lastBarTime = now;
      const goal = Math.min(target, Math.min(1, (now - started) / minimumTime));
      shown += (goal - shown) * Math.min(1, seconds * 8);
      if (goal - shown < 0.01) shown = goal;
      barFill.style.width = (shown * 100).toFixed(1) + "%";
      percentLabel.textContent = Math.round(shown * 100) + "%";
      if (ready && shown >= 0.999) {
        loaded();
      } else {
        requestAnimationFrame(updateBar);
      }
    }
    requestAnimationFrame(updateBar);

    // Loading done: wait for a key press or click, like a real game.
    function loaded() {
      statusLabel.textContent = "Ready";
      splash.classList.add("ready");
      continueLabel.hidden = false;
    }

    function finish() {
      if (finished) return;
      finished = true;
      window.removeEventListener("keydown", onInput);
      splash.removeEventListener("pointerdown", onInput);
      unlockAudio();                              // a key press lets the browser play sound
      startMusic();
      // The loading text fades away, but the scene keeps playing behind the login page.
      splash.classList.add("backdrop");
      splash.removeAttribute("role");
      splash.setAttribute("aria-hidden", "true");
      backdropMode = true;
      scene.setFraming(1);
      resolve();                                  // screens.js now shows the login page
      setTimeout(() => {
        for (const part of splash.querySelectorAll(".splash-load, .splash-status, .splash-shade")) part.remove();
      }, 900);
    }

    function onInput() {
      if (splash.classList.contains("ready")) finish();
    }
    window.addEventListener("keydown", onInput);
    splash.addEventListener("pointerdown", onInput);

    // The real loading steps.
    (async () => {
      setStep(0.1, "Loading the key art");
      await scene.load();

      setStep(0.3, "Loading the harbour");
      await withTimeout(Promise.all(extraLoading.map((load) => load())), 5000);

      setStep(0.5, "Loading fonts");
      await withTimeout(Promise.all([
        document.fonts.load("40px Staatliches"),
        document.fonts.load("16px Barlow"),
        document.fonts.load("20px 'Lilita One'"),
        document.fonts.load("16px 'Share Tech Mono'")
      ]), 2500);

      setStep(0.75, "Contacting the harbour server");
      let serverOk = false;
      await withTimeout(fetch("/api/me").then((r) => { serverOk = r.ok; }), 4000);

      setStep(0.9, serverOk ? "Calibrating the sonar" : "Server is slow to answer");
      await wait(250);

      setStep(1, "Raising the sails");
      ready = true;
    })();
  });
}
