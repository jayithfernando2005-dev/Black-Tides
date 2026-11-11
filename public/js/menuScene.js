// menuScene.js - the living harbour battle behind the main menu (img/menu.jpg).
// liveScene.js does the animation; this file only says where things are in the
// picture, and starts or stops the scene when the menu is shown or hidden.
import { on } from "./events.js";
import { createLiveScene } from "./liveScene.js";

// Where things are in the menu picture (in the picture's own pixels, 1376 x 768).
const MENU_ART = {
  url: "img/menu.jpg",
  width: 1376,
  height: 768,
  horizon: 445,
  title: null,
  ships: [
    { x: 140, y: 135, w: 410, h: 430, pivotX: 330, pivotY: 545, rock: 1 },     // the big ship on the left
    { x: 690, y: 290, w: 165, h: 180, pivotX: 765, pivotY: 460, rock: 0.6 }    // the ship by the sunset
  ],
  fires: [
    { x: 75, y: 445, size: 1.0 }, { x: 270, y: 470, size: 1.1 }, { x: 240, y: 440, size: 0.7 },
    { x: 1040, y: 452, size: 0.7 }, { x: 1120, y: 362, size: 0.8 }, { x: 1180, y: 330, size: 0.8 },
    { x: 1278, y: 300, size: 0.9 }, { x: 1325, y: 352, size: 1.0 }
  ],
  smoke: [
    { x: 60, y: 360, rate: 0.14, size: 1.4 }, { x: 230, y: 420, rate: 0.16, size: 1.0 },
    { x: 1110, y: 330, rate: 0.2, size: 0.8 }, { x: 1250, y: 250, rate: 0.12, size: 1.2 },
    { x: 1330, y: 280, rate: 0.14, size: 1.0 }
  ],
  cannons: [
    { x: 718, y: 430, dir: -1, ship: 1 }, { x: 805, y: 422, dir: 1, ship: 1 },
    { x: 485, y: 470, dir: 1, ship: 0 }, { x: 1030, y: 445, dir: -1 }
  ]
};

const canvas = document.getElementById("menu-bg");

// Darker at the top and bottom so the title and the buttons stand out.
const scene = createLiveScene(canvas, MENU_ART, {
  overlay(ctx, width, height) {
    const top = ctx.createLinearGradient(0, 0, 0, height * 0.32);
    top.addColorStop(0, "rgba(3,6,9,0.75)");
    top.addColorStop(1, "rgba(3,6,9,0)");
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, width, height * 0.32);
    const bottom = ctx.createLinearGradient(0, height * 0.45, 0, height);
    bottom.addColorStop(0, "rgba(3,6,9,0)");
    bottom.addColorStop(1, "rgba(3,6,9,0.8)");
    ctx.fillStyle = bottom;
    ctx.fillRect(0, height * 0.45, width, height * 0.55);
  }
});

// Loads the picture (called during the splash, so the menu appears instantly).
export function loadMenuScene() {
  return scene.load();
}

// Event: a screen was shown. The scene plays behind the main menu and the screens opened from it.
const SCENE_SCREENS = ["menu", "daily", "captain", "admin", "stats", "howto", "shipyard", "leaderboard", "profile", "achievements", "settings"];
on("screen:shown", (name) => {
  if (SCENE_SCREENS.includes(name)) {
    canvas.classList.add("on");
    scene.start();
  } else if (canvas.classList.contains("on")) {
    canvas.classList.remove("on");
    setTimeout(() => {
      if (!canvas.classList.contains("on")) scene.stop();
    }, 700);
  }
});
