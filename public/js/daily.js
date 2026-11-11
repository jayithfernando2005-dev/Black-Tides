// daily.js - the Daily Challenge screen. Every captain counts the same Fish API picture
// today. The clock and the answers live on the server (server/daily.js); this file only
// shows the picture, a matching clock and today's fastest captains.
import * as api from "./api.js";
import { emit } from "./events.js";
import { renderPortrait } from "./portraits.js";
import { sounds } from "./sound.js";
import { shareDaily } from "./shareCard.js";

let lastResult = null;       // the finished result, for the share card

const $ = (id) => document.getElementById(id);
let clockTimer = null;
let clockStart = 0;          // performance.now() when the server's clock was at 0
let penalty = 0;             // seconds already added for wrong counts
let rules = { wrongPenalty: 10, chestBonus: 5, gold: 30 };
let me = null;               // the logged-in captain's name

function show(part) {
  for (const id of ["daily-intro", "daily-play", "daily-done", "daily-guest"]) {
    $(id).hidden = id !== part;
  }
}

function formatSeconds(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  return (minutes > 0 ? minutes + ":" + rest.toFixed(1).padStart(4, "0") : rest.toFixed(1)) + " s";
}

function stopClock() {
  clearInterval(clockTimer);
  clockTimer = null;
}

function startClock(elapsed) {
  stopClock();
  clockStart = performance.now() - elapsed * 1000;
  const tick = () => {
    const seconds = (performance.now() - clockStart) / 1000 + penalty;
    $("daily-clock").textContent = formatSeconds(seconds);
  };
  tick();
  clockTimer = setInterval(tick, 100);
}

function make(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;   // textContent: names can never inject HTML
  return element;
}

// Today's fastest captains.
function renderBoard(board) {
  const list = $("daily-board");
  list.replaceChildren(...board.map((row, index) => {
    const item = make("li", "daily-row" + (row.username === me ? " me" : "") + (index < 3 ? " top" + (index + 1) : ""));
    item.append(make("span", "daily-rank", String(index + 1)));
    const portrait = make("span", "portrait");
    renderPortrait(portrait, row.username, row.avatar, row.avatarVersion);
    const name = make("span", "daily-name");
    name.append(make("b", "", row.username));
    name.append(make("small", "", (row.wrong ? row.wrong + " wrong" : "No mistakes") + (row.chestRight ? " · chests right" : "")));
    item.append(portrait, name, make("span", "daily-time", formatSeconds(row.seconds)));
    return item;
  }));
  $("daily-empty").hidden = board.length > 0;
}

// Opens the screen: shows the rules, the captain's own result, and today's board.
export async function showDaily(username) {
  me = username;
  stopClock();
  $("daily-message").textContent = "";
  $("daily-date").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  try {
    const data = await api.getDaily();
    rules = data.rules;
    $("daily-rules").textContent = "Count the fish as fast as you can. Each wrong count adds " + rules.wrongPenalty +
      " s. Count the chests right too and " + rules.chestBonus + " s come off. Finish to earn " + rules.gold + " gold.";
    renderBoard(data.board);
    if (data.me.status === "guest") show("daily-guest");
    else if (data.me.status === "finished") showDone(data.me.seconds, null, data.me.wrong, data.me.chestRight);
    else {
      show("daily-intro");
      $("daily-start").textContent = data.me.status === "started" ? "Carry on - the clock is still running" : "Start the clock";
    }
  } catch (error) {
    show("daily-intro");
    $("daily-message").textContent = error.message;
  }
}

export function leaveDaily() {
  stopClock();
}

function showDone(seconds, rank, wrong, chestRight) {
  lastResult = { seconds: seconds, rank: rank, wrong: wrong, chestRight: chestRight };
  stopClock();
  show("daily-done");
  $("daily-result-time").textContent = formatSeconds(seconds);
  $("daily-result-rank").textContent = rank ? "#" + rank + " today" : "Finished";
  $("daily-result-note").textContent = (wrong ? wrong + " wrong count" + (wrong === 1 ? "" : "s") : "No mistakes") +
    (chestRight ? " · chests counted right (-" + rules.chestBonus + " s)" : "") + ". Come back tomorrow for a new picture.";
}

// Event: "Start the clock" - the server starts timing and sends the picture.
$("daily-start").addEventListener("click", async () => {
  $("daily-start").disabled = true;
  $("daily-message").textContent = "Fetching today's sonar picture...";
  try {
    const puzzle = await api.startDaily();
    penalty = puzzle.wrong * rules.wrongPenalty;
    $("daily-picture").src = puzzle.image;
    $("daily-fish").value = "";
    $("daily-chest").value = "";
    $("daily-message").textContent = puzzle.wrong ? "You already have " + puzzle.wrong + " wrong count(s) today." : "";
    show("daily-play");
    startClock(puzzle.elapsed);
    $("daily-fish").focus();
  } catch (error) {
    $("daily-message").textContent = error.message;
  } finally {
    $("daily-start").disabled = false;
  }
});

// Event: the counts were sent.
$("daily-play").addEventListener("submit", async (event) => {
  event.preventDefault();
  if ($("daily-fish").value.trim() === "") {
    $("daily-play-message").textContent = "Type how many fish you see.";
    return;
  }
  $("daily-submit").disabled = true;
  try {
    const result = await api.answerDaily($("daily-fish").value, $("daily-chest").value);
    if (!result.correct) {
      penalty = result.wrong * rules.wrongPenalty;
      sounds.click();
      $("daily-play-message").textContent = "Wrong count! +" + result.penalty + " s. Look again.";
      $("daily-fish").select();
      emit("daily:wrong", result);
      return;
    }
    $("daily-play-message").textContent = "";
    showDone(result.seconds, result.rank, result.wrong, result.chestRight);
    emit("daily:solved", result);
    renderBoard((await api.getDaily()).board);
  } catch (error) {
    $("daily-play-message").textContent = error.message;
  } finally {
    $("daily-submit").disabled = false;
  }
});

// Event: "Download share card" after finishing.
$("daily-share").addEventListener("click", async () => {
  if (!lastResult) return;
  $("daily-share").disabled = true;
  await shareDaily(lastResult);
  $("daily-share").disabled = false;
});
