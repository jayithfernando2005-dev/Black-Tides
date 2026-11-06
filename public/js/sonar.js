// sonar.js - the sonar reload panel. Shows the Fish API picture, sends the
// player's counts to our server to be checked, and jams after a wrong count.
// The battle keeps running while the panel is open.
import { getPuzzle, sendAnswer } from "./api.js";
import { emit } from "./events.js";

const panel = document.getElementById("sonar");
const picture = document.getElementById("sonar-picture");
const fishInput = document.getElementById("fish-count");
const chestInput = document.getElementById("chest-count");
const reloadButton = document.getElementById("reload-button");
const closeButton = document.getElementById("sonar-close");
const message = document.getElementById("sonar-message");

let open = false;
let jammed = false;
let jamSeconds = 3;
let jamTimer = null;

function setMessage(text, tone) {
  message.textContent = text;
  message.className = "jam" + (tone ? " " + tone : "");
}

function setEnabled(enabled) {
  fishInput.disabled = !enabled;
  chestInput.disabled = !enabled;
  reloadButton.disabled = !enabled;
}

export function isSonarOpen() {
  return open;
}

// Opens the panel and loads a new puzzle picture from our server.
// options.jamSeconds comes from the Sonar scope upgrade.
export async function openSonar(options) {
  if (open) {
    return;
  }
  jamSeconds = options.jamSeconds;
  open = true;
  panel.hidden = false;
  fishInput.value = "";
  chestInput.value = "";
  picture.removeAttribute("src");
  picture.alt = "Loading the sonar picture";
  setEnabled(false);
  setMessage("Scanning the water...");
  emit("sonar:opened");

  try {
    const puzzle = await getPuzzle();
    if (!open) {
      return;                                   // closed while it was loading
    }
    picture.src = puzzle.image;
    picture.alt = "Sonar picture with fish and treasure chests to count";
    if (!jammed) {
      setEnabled(true);
      fishInput.focus();
      setMessage("Count the fish to reload.");
    }
  } catch (error) {
    console.error(error);
    setMessage("The sonar could not reach the Fish API. Close and try again.", "warn");
  }
}

export function closeSonar() {
  open = false;
  panel.hidden = true;
  if (document.activeElement && panel.contains(document.activeElement)) {
    document.activeElement.blur();
  }
}

// After a wrong count, the cannons jam: the panel is locked for a few seconds.
function jam() {
  jammed = true;
  let secondsLeft = jamSeconds;
  setMessage("Wrong count. Cannons jammed for " + secondsLeft.toFixed(1) + " s", "warn");
  clearInterval(jamTimer);
  jamTimer = setInterval(() => {
    secondsLeft -= 0.1;
    if (secondsLeft > 0.05) {
      setMessage("Wrong count. Cannons jammed for " + secondsLeft.toFixed(1) + " s", "warn");
      return;
    }
    clearInterval(jamTimer);
    jammed = false;
    if (open) {
      setEnabled(true);
      fishInput.select();
      setMessage("Cannons clear. Count again.");
    }
  }, 100);
}

// Event: Reload pressed (or Enter in a box). Our server checks the counts.
panel.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (jammed) {
    return;
  }
  if (fishInput.value === "") {
    setMessage("Type how many fish you see.", "warn");
    fishInput.focus();
    return;
  }
  setEnabled(false);
  try {
    const result = await sendAnswer(fishInput.value, chestInput.value);
    if (result.fishCorrect) {
      closeSonar();
      emit("sonar:reloaded", result);
    } else {
      emit("sonar:wrong");
      jam();
    }
  } catch (error) {
    console.error(error);
    setMessage(error.message, "warn");
    setEnabled(true);
  }
});

closeButton.addEventListener("click", closeSonar);
