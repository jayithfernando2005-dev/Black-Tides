// quests.js - the Daily quests panel on the Daily Challenge screen: three goals a day,
// the same for every captain. The server tracks the progress (server/quests.js); this
// file shows it and sends the "claim" when a quest is done.
import * as api from "./api.js";
import { emit } from "./events.js";

const $ = (id) => document.getElementById(id);

function make(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function hoursLeft(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? h + " h " + m + " min" : m + " min";
}

export async function showQuests(loggedIn) {
  $("quests-guest").hidden = loggedIn;
  $("quest-list").hidden = !loggedIn;
  $("quests-reset").hidden = !loggedIn;
  if (!loggedIn) return;
  try {
    const data = await api.getQuests();
    $("quests-reset").textContent = "New quests in " + hoursLeft(data.resetsIn);
    $("quest-list").replaceChildren(...data.quests.map((quest) => {
      const item = make("li", "quest" + (quest.done ? " done" : "") + (quest.claimed ? " claimed" : ""));
      const text = make("div", "quest-text");
      text.append(make("b", "", quest.text));
      const bar = make("div", "quest-bar");
      const fill = make("i");
      fill.style.width = Math.round(100 * quest.progress / quest.goal) + "%";
      bar.append(fill);
      text.append(bar, make("small", "", quest.progress.toLocaleString("en-GB") + " / " + quest.goal.toLocaleString("en-GB")));
      item.append(text);
      if (quest.claimed) {
        item.append(make("span", "quest-claimed", "Claimed"));
      } else if (quest.done) {
        const claim = make("button", "plaque-button header-plaque save-plaque quest-claim", "Claim " + quest.gold + " gold");
        claim.type = "button";
        claim.addEventListener("click", async () => {
          claim.disabled = true;
          try {
            const result = await api.claimQuest(quest.key);
            emit("progress:changed", result.progress);
            showQuests(true);
          } catch (error) {
            claim.disabled = false;
            claim.textContent = error.message;
          }
        });
        item.append(claim);
      } else {
        item.append(make("span", "quest-gold", quest.gold + " gold"));
      }
      return item;
    }));
  } catch (error) {
    $("quests-reset").textContent = error.message;
  }
}
