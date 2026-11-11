// AI note: written with help from Claude (Anthropic), as allowed for this assignment.
// liveFeed.js - "Live sea news". The browser keeps one connection open to the server
// (Server-Sent Events, GET /api/live). Whenever something happens to ANY captain, the
// server pushes an event down that connection; this file turns it into an event on our
// own bus (live:news, live:online) and shows a small pop-up (a "toast").
import { emit, on } from "./events.js";
import { getSettings } from "./settings.js";

let source = null;
let me = null;
let enabled = getSettings().liveNews;

// Words for each kind of news. Names go in with textContent later, never as HTML.
function describe(item) {
  const who = item.username === me ? "You" : "Captain " + item.username;
  switch (item.kind) {
    case "captain:joined": return { icon: "⚓", text: item.username === me ? "Welcome aboard, Captain " + me + "!" : "A new captain joined the fleet: " + item.username };
    case "stage:cleared": return { icon: "🏴", text: who + " conquered Stage " + item.stage + " · " + item.stageName };
    case "score:record": return { icon: "🏆", text: who + " reached #" + item.rank + " on the leaderboard with " + Number(item.score).toLocaleString("en-GB") + " points" };
    case "flagship:sunk": return { icon: "💥", text: who + " sank " + (item.bosses > 1 ? item.bosses + " raider flagships" : "a raider flagship") };
    case "rival:passed":
      // only the two captains involved hear about it
      if (item.rival === me) return { icon: "⚔", text: "Your rival " + item.username + " just beat your best score with " + Number(item.score).toLocaleString("en-GB") + "!" };
      if (item.username === me) return { icon: "⚔", text: "You overtook your rival " + item.rival + "!" };
      return null;
    case "daily:solved": return { icon: "🐟", text: who + " solved today's Daily Challenge in " + Number(item.seconds).toFixed(1) + " s (#" + item.rank + ")" };
    default: return null;
  }
}

// A pop-up for things that happen only in this game (e.g. a quest finished).
export function showToast(icon, text, mine = false) {
  toast({ kind: "local", icon: icon, text: text, username: mine ? me : null });
}

// Shows one pop-up in the corner for a few seconds.
function toast(item) {
  const words = item.kind === "local" ? { icon: item.icon, text: item.text } : describe(item);
  if (!words || (!enabled && item.kind !== "local")) return;
  const box = document.getElementById("toasts");
  const card = document.createElement("div");
  card.className = "toast" + (item.username === me ? " mine" : "");
  card.setAttribute("role", "status");
  const icon = document.createElement("span");
  icon.className = "toast-icon";
  icon.textContent = words.icon;
  const text = document.createElement("span");
  text.className = "toast-text";
  const title = document.createElement("b");
  title.textContent = "Sea news";
  const body = document.createElement("span");
  body.textContent = words.text;
  text.append(title, body);
  card.append(icon, text);
  box.append(card);                                               // newest at the bottom
  while (box.children.length > 3) box.firstChild.remove();      // at most 3 at once
  setTimeout(() => card.classList.add("leaving"), 5200);
  setTimeout(() => card.remove(), 5800);
}

function connect() {
  if (source || typeof EventSource === "undefined") return;
  source = new EventSource("/api/live");
  // Event from the server: some captain did something worth telling.
  source.addEventListener("news", (event) => {
    const item = JSON.parse(event.data);
    emit("live:news", item);
  });
  // Event from the server: the number of games open right now changed.
  source.addEventListener("online", (event) => {
    emit("live:online", JSON.parse(event.data).count);
  });
  // If the server restarts, EventSource reconnects by itself (after "retry: 5000").
}

function disconnect() {
  if (source) source.close();
  source = null;
}

// Our own bus events, so other parts of the game can react to the news too.
on("live:news", toast);
on("live:online", (count) => {
  const label = document.getElementById("menu-online");
  if (!label) return;
  label.hidden = false;
  label.querySelector("b").textContent = count;
  label.querySelector("span").textContent = count === 1 ? "captain at sea" : "captains at sea";
});
on("player:changed", (player) => {
  me = player.username;
  if (player.username || player.guest) connect();
  else disconnect();
});
on("settings:changed", (settings) => {
  enabled = settings.liveNews;
});
