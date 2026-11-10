// AI note: written with help from Claude (Anthropic), as allowed for this assignment.
// main.js - starts Black Tides. Each file looks after one job; they talk through events.
import "./game.js";
import { startScreens } from "./screens.js";
import { runSplash } from "./splash.js";
import "./authForms.js";
import "./uiSounds.js";
import "./helm.js";
import "./mapScene.js";
import "./music.js";
import "./portraits.js";
import "./liveFeed.js";
import "./saveFile.js";
import { loadMenuScene } from "./menuScene.js";

await runSplash([loadMenuScene]);   // the loading screen first, like a real game
startScreens();         // then the login page (or the menu if already logged in)
