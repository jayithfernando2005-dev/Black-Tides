// stageSounds.js - every stage sounds different. While a battle runs, this file plays the
// sounds of the place now and then: gulls over the harbours, thunder in storms, creaking
// timbers among the wrecks. It also reacts to battle events: the kraken roars, a whirlpool
// rushes, a merchant rings its bell. It only listens to events - game.js never calls it.
import { on } from "./events.js";
import { stageSounds } from "./sound.js";

// Which background sounds each campaign stage has (by stage id). 0 = the Endless voyage.
const PLACES = {
  0: ["gull"],
  1: ["creak"],                 // Volcano Isle
  2: ["gull", "bell"],          // Harbour Fort
  3: ["gull"],                  // Castle Siege
  4: ["bell"],                  // Foggy Strait: a bell in the fog
  5: ["creak", "gull"],         // Smugglers' Reef
  6: [],                        // Kraken's Deep: only the storm
  7: ["gull", "bell"],          // Northern Bastion
  8: ["bell", "creak"],         // Raider Port
  9: ["creak", "creak"]         // Galleon Graveyard: old wrecks groaning
};

let timer = null;
let stageId = 0;
let storm = false;
let running = false;

function schedule() {
  clearTimeout(timer);
  if (!running) return;
  timer = setTimeout(() => {
    if (!running) return;
    const list = PLACES[stageId] || [];
    // in a storm, thunder takes over half of the time
    if (storm && Math.random() < 0.5) stageSounds.thunder();
    else if (list.length) stageSounds[list[Math.floor(Math.random() * list.length)]]();
    schedule();
  }, 5000 + Math.random() * 7000);           // something every 5 to 12 seconds
}

on("battle:start", (voyage) => {
  stageId = voyage && voyage.mode === "stage" && voyage.stage ? voyage.stage.id : 0;
  storm = false;
  running = true;
  schedule();
});
on("wave:started", (wave) => {
  storm = Boolean(wave && wave.storm);
  if (storm && running) setTimeout(() => stageSounds.thunder(), 600);   // the storm arrives with thunder
});
on("battle:paused", () => { running = false; clearTimeout(timer); });
on("battle:resumed", () => { running = true; schedule(); });
for (const name of ["battle:over", "battle:stop"]) {
  on(name, () => { running = false; clearTimeout(timer); });
}

// Battle events with their own sounds.
on("sea:event", (kind) => {
  if (kind === "whirlpool") stageSounds.rumble();
  else if (kind === "merchant") stageSounds.bell();
  else if (kind === "tentacles") stageSounds.roar();
});
on("kraken:rose", () => stageSounds.roar());
on("raider:sunk", (wreck) => {
  if (wreck && wreck.type === "kraken") stageSounds.roar();
});
