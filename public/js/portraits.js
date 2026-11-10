// AI note: written with help from Claude (Anthropic), as allowed for this assignment.
// portraits.js - shows a captain's portrait anywhere in the game, and the window for
// changing it. A portrait is one of: made from the name (default), one of 12 ready-made
// pirates ("preset:0" to "preset:11"), or a picture the captain uploaded ("custom").
import { captainPortrait } from "./leaderboardView.js";
import * as api from "./api.js";
import { emit } from "./events.js";

export const PRESET_COUNT = 12;
// Names that give 12 different-looking pirates from the portrait drawer.
const PRESET_SEEDS = ["Anne", "Blackbeard", "Calico", "Drake", "Edward", "Flint", "Grace", "Henry", "Ivy", "Jack", "Kidd", "Morgan"];

// Puts the right portrait into element.
export function renderPortrait(element, username, avatar, version) {
  element.replaceChildren();
  if (avatar === "custom") {
    const img = document.createElement("img");
    img.className = "portrait-img";
    img.alt = "";
    img.src = "/api/avatar/" + encodeURIComponent(username) + "?v=" + encodeURIComponent(version || 0);
    // if the picture cannot load, fall back to the drawn portrait
    img.addEventListener("error", () => { element.innerHTML = captainPortrait(username); }, { once: true });
    element.append(img);
  } else if (typeof avatar === "string" && avatar.startsWith("preset:")) {
    const n = Number(avatar.slice(7));
    element.innerHTML = captainPortrait(PRESET_SEEDS[n] || username);     // fixed SVG shapes only
  } else {
    element.innerHTML = captainPortrait(username);
  }
}

// The address of a picture of the portrait (for drawing it on a canvas, e.g. the share card).
export function portraitSource(username, avatar, version) {
  if (avatar === "custom") {
    return "/api/avatar/" + encodeURIComponent(username) + "?v=" + encodeURIComponent(version || 0);
  }
  let seed = username;
  if (typeof avatar === "string" && avatar.startsWith("preset:")) seed = PRESET_SEEDS[Number(avatar.slice(7))] || username;
  const svg = captainPortrait(seed).replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" ');
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

// ---------- the "Change portrait" window ----------
const $ = (id) => document.getElementById(id);
let choice = null;          // { preset: n } or { image: dataUrl } or { reset: true }
let captainName = "";

// Shrinks any picture to a 256 x 256 square (cropped from the middle) and returns a JPEG
// data URL under about 60 KB, so uploads are small and quick.
function shrinkPicture(file) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(jpeg|png|webp|gif|bmp)$/.test(file.type)) {
      reject(new Error("Please choose a picture file (JPEG, PNG or WebP)."));
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      reject(new Error("That file is very large. Please choose a picture under 15 MB."));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 256;
      canvas.getContext("2d").drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, 256, 256);
      URL.revokeObjectURL(url);
      let quality = 0.85;
      let data = canvas.toDataURL("image/jpeg", quality);
      while (data.length > 80000 && quality > 0.4) {          // about 60 KB of real picture
        quality -= 0.1;
        data = canvas.toDataURL("image/jpeg", quality);
      }
      resolve(data);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That picture could not be opened.")); };
    img.src = url;
  });
}

function preview() {
  const box = $("avatar-preview");
  if (!choice || choice.reset) renderPortrait(box, captainName, null, 0);
  else if (choice.preset !== undefined) renderPortrait(box, captainName, "preset:" + choice.preset, 0);
  else if (choice.image) {
    box.replaceChildren();
    const img = document.createElement("img");
    img.className = "portrait-img";
    img.alt = "";
    img.src = choice.image;
    box.append(img);
  }
  for (const tile of document.querySelectorAll(".avatar-tile")) {
    tile.setAttribute("aria-pressed", String(choice && choice.preset === Number(tile.dataset.preset)));
  }
}

export function openPortraitPicker(username, currentAvatar, version) {
  captainName = username;
  choice = null;
  $("avatar-message").textContent = "";
  $("avatar-file").value = "";
  const grid = $("avatar-grid");
  grid.replaceChildren();
  for (let n = 0; n < PRESET_COUNT; n++) {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "avatar-tile";
    tile.dataset.preset = n;
    tile.setAttribute("aria-label", "Portrait " + (n + 1));
    renderPortrait(tile, username, "preset:" + n, 0);
    tile.addEventListener("click", () => { choice = { preset: n }; preview(); });
    grid.append(tile);
  }
  renderPortrait($("avatar-preview"), username, currentAvatar, version);
  $("avatar-picker").hidden = false;
  $("avatar-save").focus();
}

function closePicker() {
  $("avatar-picker").hidden = true;
}

$("avatar-file").addEventListener("change", async () => {
  const file = $("avatar-file").files[0];
  if (!file) return;
  $("avatar-message").textContent = "Preparing your picture...";
  try {
    choice = { image: await shrinkPicture(file) };
    $("avatar-message").textContent = "Looks good! Press Save to use it.";
    preview();
  } catch (error) {
    $("avatar-message").textContent = error.message;
  }
});
$("avatar-reset").addEventListener("click", () => { choice = { reset: true }; preview(); $("avatar-message").textContent = "Back to the portrait made from your name."; });
$("avatar-cancel").addEventListener("click", closePicker);
$("avatar-picker").addEventListener("keydown", (event) => {
  if (event.key === "Escape") { event.stopPropagation(); closePicker(); }
});
$("avatar-save").addEventListener("click", async () => {
  if (!choice) { closePicker(); return; }
  $("avatar-save").disabled = true;
  $("avatar-message").textContent = "Saving...";
  try {
    const result = await api.saveAvatar(choice);        // the server checks the picture again
    closePicker();
    emit("avatar:changed", result);
  } catch (error) {
    $("avatar-message").textContent = error.message;
  } finally {
    $("avatar-save").disabled = false;
  }
});
