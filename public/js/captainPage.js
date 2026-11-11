// AI note: written with help from Claude (Anthropic), as allowed for this assignment.
// captainPage.js - a captain's public page (#/captain/Name), and the Rivals panel on
// your own profile. Everything shown comes from the server's public record.
import * as api from "./api.js";
import { renderPortrait } from "./portraits.js";
import { renderMedals } from "./medals.js";
import { renderRank } from "./rankView.js";
import { emit } from "./events.js";
import { drawFlag, SAILS } from "./shipLook.js";

const $ = (id) => document.getElementById(id);
let shown = null;            // the captain on screen

function formatDate(iso) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "-";
}

// Opens the public page of the captain called name. me: the logged-in name (or null).
export async function showCaptain(name, me) {
  $("cap-message").textContent = "";
  $("cap-body").hidden = true;
  $("cap-name").textContent = name;
  try {
    const c = await api.getCaptain(name);
    shown = c;
    $("cap-body").hidden = false;
    $("cap-name").textContent = c.username;
    renderPortrait($("cap-portrait"), c.username, c.avatar, c.avatarVersion);
    renderRank($("cap-rank"), c.rank);
    // the captain's ship: flag, name and sail colour
    const flag = $("cap-flag").getContext("2d");
    flag.clearRect(0, 0, 44, 34);
    drawFlag(flag, c.ship.flag, 6, 4, 30, 0.3);
    $("cap-ship-name").textContent = (c.ship.name || "An unnamed ship") + " · " + SAILS[c.ship.sail].label + " sails";
    $("cap-since").textContent = "Member since " + formatDate(c.memberSince);
    $("cap-place").textContent = c.leaderboardPlace ? "#" + c.leaderboardPlace : "Unranked";
    $("cap-games").textContent = c.games;
    $("cap-score").textContent = c.bestScore.toLocaleString("en-GB");
    $("cap-wave").textContent = c.bestWave;
    $("cap-sunk").textContent = c.sunk;
    $("cap-stages").textContent = c.stagesWon + " / 9";
    $("cap-daily").textContent = c.daily.best === null ? "-" : c.daily.best.toFixed(1) + " s";
    const unlocked = c.achievements.filter((a) => a.unlocked).length;
    $("cap-badge-count").textContent = unlocked + " of " + c.achievements.length + " unlocked";
    renderMedals($("cap-badges"), c.achievements);
    // The rival button: only for logged-in captains looking at someone else.
    const button = $("cap-rival");
    button.hidden = !me || c.isMe;
    button.textContent = c.isRival ? "Remove rival" : "Mark as rival";
    button.classList.toggle("save-plaque", !c.isRival);
    $("cap-me-note").hidden = !c.isMe;
    // weekly tournament wins
    $("cap-crown").hidden = c.weeksWon.length === 0;
    $("cap-crown").textContent = "👑 Weekly champion" + (c.weeksWon.length > 1 ? " ×" + c.weeksWon.length : "") +
      (c.weeksWon.length ? " (latest " + c.weeksWon[0].week.replace("-W", ", week ") + ")" : "");
  } catch (error) {
    $("cap-message").textContent = error.message;
  }
}

// Event: "Mark as rival" / "Remove rival".
$("cap-rival").addEventListener("click", async () => {
  if (!shown) return;
  $("cap-rival").disabled = true;
  try {
    if (shown.isRival) await api.removeRival(shown.username);
    else await api.addRival(shown.username);
    shown.isRival = !shown.isRival;
    $("cap-rival").textContent = shown.isRival ? "Remove rival" : "Mark as rival";
    $("cap-rival").classList.toggle("save-plaque", !shown.isRival);
    $("cap-message").textContent = shown.isRival
      ? shown.username + " is now your rival. You will hear when one of you overtakes the other."
      : shown.username + " is no longer your rival.";
    emit("rivals:changed");
  } catch (error) {
    $("cap-message").textContent = error.message;
  } finally {
    $("cap-rival").disabled = false;
  }
});

// ----- The Rivals panel on your own profile -----

function make(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

export async function showRivals() {
  const list = $("rivals-list");
  try {
    const data = await api.getRivals();
    $("rivals-count").textContent = data.rivals.length + " of " + data.max;
    list.replaceChildren(...data.rivals.map((rival) => {
      const item = make("li", "rival-row");
      const portrait = make("span", "portrait");
      renderPortrait(portrait, rival.username, rival.avatar, rival.avatarVersion);
      const name = make("button", "rival-name link");
      name.type = "button";
      name.dataset.nav = "captain/" + encodeURIComponent(rival.username);
      name.append(make("b", "", rival.username), make("small", "", rival.rank + " · best " + rival.bestScore.toLocaleString("en-GB")));
      const diff = rival.difference;
      const verdict = make("span", "rival-diff " + (diff > 0 ? "ahead" : diff < 0 ? "behind" : "level"),
        diff > 0 ? "You lead by " + diff.toLocaleString("en-GB") : diff < 0 ? "Behind by " + (-diff).toLocaleString("en-GB") : "Level");
      item.append(portrait, name, verdict);
      return item;
    }));
    $("rivals-empty").hidden = data.rivals.length > 0;
  } catch (error) {
    $("rivals-count").textContent = error.message;
  }
}

// ----- The rival picker: a brass dropdown of captains with a search box -----
const picker = {
  button: $("rival-choose"), scroll: $("rival-scroll"), search: $("rival-search"),
  list: $("rival-options"), chosen: null, timer: null
};

function pickerItems() {
  return [...picker.list.querySelectorAll("li[role=option]:not([aria-disabled=true])")];
}

async function loadCaptains() {
  try {
    const data = await api.searchCaptains(picker.search.value.trim());
    picker.list.replaceChildren(...data.captains.map((c) => {
      const item = make("li", "rival-option");
      item.setAttribute("role", "option");
      item.tabIndex = -1;
      item.dataset.name = c.username;
      const portrait = make("span", "portrait");
      renderPortrait(portrait, c.username, c.avatar, c.avatarVersion);
      const text = make("span", "brass-drop-text");
      text.append(make("b", "", c.username), make("small", "", c.rank + " · best " + c.bestScore.toLocaleString("en-GB")));
      item.append(portrait, text);
      if (c.isMe || c.isRival) {
        item.setAttribute("aria-disabled", "true");
        item.append(make("span", "rival-tag", c.isMe ? "You" : "Rival"));
      } else {
        item.addEventListener("click", () => choose(c.username));
      }
      item.setAttribute("aria-selected", String(c.username === picker.chosen));
      return item;
    }));
    $("rival-none").hidden = data.captains.length > 0;
  } catch (error) {
    $("rival-none").hidden = false;
    $("rival-none").textContent = error.message;
  }
}

function openPicker() {
  picker.scroll.hidden = false;
  picker.button.setAttribute("aria-expanded", "true");
  loadCaptains();
  picker.search.focus();
}

function closePicker(focusButton) {
  if (picker.scroll.hidden) return;
  picker.scroll.hidden = true;
  picker.button.setAttribute("aria-expanded", "false");
  if (focusButton) picker.button.focus();
}

function choose(name) {
  picker.chosen = name;
  $("rival-choice").textContent = name;
  $("rival-add").disabled = false;
  closePicker(false);
  $("rival-add").focus();
}

picker.button.addEventListener("click", () => (picker.scroll.hidden ? openPicker() : closePicker(true)));
// typing in the search box narrows the list (after a short pause)
picker.search.addEventListener("input", () => {
  clearTimeout(picker.timer);
  picker.timer = setTimeout(loadCaptains, 200);
});
// Keyboard: arrows move through the captains, Enter or Space picks, Escape closes.
picker.scroll.addEventListener("keydown", (event) => {
  const items = pickerItems();
  const index = items.indexOf(document.activeElement);
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    if (!items.length) return;
    if (index === -1) { items[event.key === "ArrowDown" ? 0 : items.length - 1].focus(); return; }
    const next = index + (event.key === "ArrowDown" ? 1 : -1);
    if (next < 0) picker.search.focus();
    else items[Math.min(next, items.length - 1)].focus();
  } else if ((event.key === "Enter" || event.key === " ") && index !== -1) {
    event.preventDefault();
    choose(items[index].dataset.name);
  } else if (event.key === "Enter" && items.length === 1) {
    event.preventDefault();
    choose(items[0].dataset.name);                 // Enter in the search box picks the only match
  } else if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    closePicker(true);
  }
});
document.addEventListener("pointerdown", (event) => {
  if (!$("rival-picker").contains(event.target)) closePicker(false);
});

// Event: "Add rival".
$("rival-add").addEventListener("click", async () => {
  if (!picker.chosen) return;
  const name = picker.chosen;
  $("rival-add").disabled = true;
  try {
    await api.addRival(name);
    $("rival-message").textContent = name + " added as a rival.";
    picker.chosen = null;
    $("rival-choice").textContent = "Choose a captain";
    picker.search.value = "";
    showRivals();
  } catch (error) {
    $("rival-message").textContent = error.message;
    $("rival-add").disabled = false;
  }
});
