// story.js - comic-style story panels: the intro before Stage 1 (shown once, can be watched
// again from How to play) and the ending after the kraken falls in the Galleon Graveyard.
// Each panel is one of the game's paintings, slowly zooming, with words typed out below.
import { emit } from "./events.js";

const STORIES = {
  intro: {
    finish: "Set sail",
    next: "game",                     // where "Set sail" goes
    panels: [
      { image: "img/splash.jpg", focus: "60% 40%", title: "The Black Tides",
        text: "For a hundred years the raider fleets have ruled these waters. Ports burn. Ships vanish in the night." },
      { image: "img/menu.jpg", focus: "30% 60%", title: "The last free harbour",
        text: "One harbour still stands. Its cannons are silent: the powder stores are almost empty." },
      { image: "img/story-sonar.jpg", focus: "50% 45%", title: "The sonar",
        text: "But your ship carries a sonar. Count the fish beneath the waves, and your crew can reload in the heat of battle." },
      { image: "img/story-kraken.jpg", focus: "50% 35%", title: "Something waits below",
        text: "Far out, past the Galleon Graveyard, the raiders' master stirs. Something old. Something with tentacles. Sail, Captain." }
    ]
  },
  ending: {
    finish: "Back to the harbour",
    next: "menu",
    panels: [
      { image: "img/story-kraken-falls.jpg", focus: "50% 55%", title: "The kraken falls",
        text: "With a last roar the kraken sinks into the deep, and the raider fleets scatter like gulls." },
      { image: "img/story-harbour.jpg", focus: "50% 50%", title: "Lanterns in the harbour",
        text: "That night every lantern in the harbour is lit. The powder stores are full again. Ships come home." },
      { image: "img/story-tides.jpg", focus: "50% 40%", title: "The tides are yours",
        text: "The Black Tides are calm at last. But the sea is wide, Captain, and the Endless voyage still calls." }
    ]
  }
};

const $ = (id) => document.getElementById(id);
let story = null;
let index = 0;
let typing = null;

export function storySeen() {
  try {
    return localStorage.getItem("bt_story_intro") === "seen";
  } catch (error) {
    return true;                       // storage blocked: do not force the intro every time
  }
}

function markSeen() {
  try {
    localStorage.setItem("bt_story_intro", "seen");
  } catch (error) {
    // nothing to do
  }
}

function typeOut(text) {
  clearInterval(typing);
  const box = $("story-text");
  box.textContent = "";
  let shown = 0;
  typing = setInterval(() => {
    shown += 2;
    box.textContent = text.slice(0, shown);
    if (shown >= text.length) clearInterval(typing);
  }, 24);
}

function render() {
  const panel = story.panels[index];
  const picture = $("story-picture");
  picture.classList.remove("zoom");
  void picture.offsetWidth;                         // restart the slow zoom
  picture.style.setProperty("--story-image", "url('" + panel.image + "')");
  picture.style.setProperty("--story-focus", panel.focus);
  picture.classList.add("zoom");
  $("story-title").textContent = panel.title;
  typeOut(panel.text);
  const last = index === story.panels.length - 1;
  $("story-next").textContent = last ? story.finish : "Next";
  $("story-dots").replaceChildren(...story.panels.map((_, i) => {
    const dot = document.createElement("i");
    if (i === index) dot.className = "on";
    return dot;
  }));
}

// Opens a story ("intro" or "ending").
export function showStory(name) {
  story = STORIES[name] || STORIES.intro;
  index = 0;
  if (name === "intro") markSeen();
  render();
  $("story-next").focus();
}

function finish() {
  clearInterval(typing);
  emit("nav:to", story.next);
}

function next() {
  const full = story.panels[index].text;
  if ($("story-text").textContent.length < full.length) {
    clearInterval(typing);                         // first press shows the whole text
    $("story-text").textContent = full;
    return;
  }
  if (index < story.panels.length - 1) {
    index += 1;
    render();
  } else {
    finish();
  }
}

$("story-next").addEventListener("click", next);
$("story-skip").addEventListener("click", finish);
$("screen-story").addEventListener("keydown", (event) => {
  if (event.key === "Escape") finish();
});
