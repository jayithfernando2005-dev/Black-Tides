// guestKeeper.js - guests keep their progress. A guest's gold, upgrades and campaign live in
// the server session, which ends when the browser is closed. So after each battle, purchase
// or loaded save, this file keeps a copy of the guest's signed save file in the browser.
// Next visit it is loaded back; and when the guest creates an account, it moves with them.
// (The save is signed by the server, so editing the copy in the browser does not work.)
import * as api from "./api.js";
import { on, emit } from "./events.js";
import { showToast } from "./liveFeed.js";

const KEY = "bt_guest_save";
let isGuest = false;

function readCopy() {
  try {
    const text = localStorage.getItem(KEY);
    return text ? JSON.parse(text) : null;
  } catch (error) {
    return null;
  }
}

function writeCopy(save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch (error) {
    // storage blocked or full: the guest simply does not keep progress
  }
}

function clearCopy() {
  try {
    localStorage.removeItem(KEY);
  } catch (error) {
    // nothing to do
  }
}

// Something useful in a save (not a brand-new game)?
function worthKeeping(save) {
  const p = save && save.progress;
  if (!p) return false;
  return p.gold > 0 || p.campaign > 1 || p.sonar.solved > 0 || Object.values(p.upgrades).some((level) => level > 0);
}

async function keepCopy() {
  if (!isGuest) return;
  try {
    const save = await api.downloadSave();
    if (worthKeeping(save)) writeCopy(save);
  } catch (error) {
    // try again after the next battle
  }
}

on("player:changed", async (player) => {
  const wasGuest = isGuest;
  isGuest = player.guest === true;
  const copy = readCopy();
  if (isGuest && copy && copy.captain === null) {
    // a returning guest: bring their progress back if this session is new
    try {
      const current = await api.downloadSave();
      if (!worthKeeping(current)) {
        await api.importSave(copy);
        emit("save:loaded", { from: copy.exportedAt });
        showToast("⚓", "Welcome back! Your guest progress was restored.", true);
      }
    } catch (error) {
      // the copy could not be loaded (for example an old version): start fresh
    }
  }
  void wasGuest;
});

// Event: a brand-new account was made. If this browser has guest progress, it comes along.
on("captain:registered", async () => {
  const copy = readCopy();
  if (!copy || copy.captain !== null || !worthKeeping(copy)) return;
  try {
    const result = await api.importSave(copy);
    clearCopy();
    emit("save:loaded", result);
    showToast("⚓", "Your guest progress came with you: " + result.progress.gold + " gold and your ship upgrades.", true);
  } catch (error) {
    // keep the copy; nothing is lost
  }
});

for (const name of ["battle:over", "shipyard:bought", "save:loaded", "progress:changed"]) {
  on(name, () => setTimeout(keepCopy, 800));     // after the server has saved
}
