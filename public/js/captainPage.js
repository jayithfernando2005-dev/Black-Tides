// AI note: written with help from Claude (Anthropic), as allowed for this assignment.
// captainPage.js - a captain's public page (#/captain/Name), and the Rivals panel on
// your own profile. Everything shown comes from the server's public record.
import * as api from "./api.js";
import { renderPortrait } from "./portraits.js";
import { renderMedals } from "./medals.js";
import { renderRank } from "./rankView.js";
import { emit } from "./events.js";

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

$("rival-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = $("rival-name").value.trim();
  if (!name) return;
  try {
    await api.addRival(name);
    $("rival-name").value = "";
    $("rival-message").textContent = name + " added as a rival.";
    showRivals();
  } catch (error) {
    $("rival-message").textContent = error.message;
  }
});
