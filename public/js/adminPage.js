// AI note: written with help from Claude (Anthropic), as allowed for this assignment.
// adminPage.js - the harbour master (admin) page: every captain, with buttons to rename,
// reset progress or remove an account. The server checks the admin role on every request;
// this page only hides the buttons from everyone else.
import * as api from "./api.js";

const $ = (id) => document.getElementById(id);

function make(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;     // textContent: names can never inject HTML
  return element;
}

function day(iso) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "-";
}

function say(text) {
  $("admin-message").textContent = text;
}

// A button that asks "Sure?" on the first click and only acts on the second.
function confirmButton(label, action) {
  const button = make("button", "admin-action", label);
  button.type = "button";
  let armed = false;
  let timer = null;
  button.addEventListener("click", async () => {
    if (!armed) {
      armed = true;
      button.textContent = "Sure? Click again";
      button.classList.add("armed");
      timer = setTimeout(() => { armed = false; button.textContent = label; button.classList.remove("armed"); }, 4000);
      return;
    }
    clearTimeout(timer);
    button.disabled = true;
    try {
      await action();
    } catch (error) {
      say(error.message);
      button.disabled = false;
    }
  });
  return button;
}

function row(captain) {
  const tr = make("tr");
  const nameCell = make("td");
  const link = make("button", "link", captain.username);
  link.type = "button";
  link.dataset.nav = "captain/" + encodeURIComponent(captain.username);
  nameCell.append(link);
  if (captain.role === "admin") nameCell.append(make("span", "admin-tag", "admin"));
  tr.append(nameCell,
    make("td", "", day(captain.createdAt)),
    make("td", "num", String(captain.games)),
    make("td", "num", captain.bestScore.toLocaleString("en-GB")),
    make("td", "num", String(captain.gold)),
    make("td", "num", Math.min(9, captain.campaign - 1) + "/9"),
    make("td", "", day(captain.lastPlayed)));
  const actions = make("td", "admin-actions");
  if (captain.role === "admin") {
    actions.append(make("span", "admin-protected", "Protected"));
  } else {
    const rename = make("button", "admin-action", "Rename");
    rename.type = "button";
    rename.addEventListener("click", () => {
      const form = make("form", "admin-rename");
      const input = make("input");
      input.value = captain.username;
      input.maxLength = 20;
      input.setAttribute("aria-label", "New name for " + captain.username);
      const save = make("button", "admin-action", "Save");
      form.append(input, save);
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
          const result = await api.adminRename(captain.username, input.value.trim());
          say(result.renamed + " is now called " + result.to + ".");
          showAdmin();
        } catch (error) {
          say(error.message);
        }
      });
      actions.replaceChildren(form);
      input.select();
    });
    actions.append(
      rename,
      confirmButton("Reset progress", async () => {
        await api.adminReset(captain.username, false);
        say(captain.username + "'s gold, upgrades and campaign were reset.");
        showAdmin();
      }),
      confirmButton("Remove", async () => {
        await api.adminRemove(captain.username);
        say(captain.username + " was removed.");
        showAdmin();
      })
    );
  }
  tr.append(actions);
  return tr;
}

export async function showAdmin() {
  try {
    const data = await api.adminCaptains();
    $("admin-total").textContent = data.total + (data.total === 1 ? " captain" : " captains");
    $("admin-rows").replaceChildren(...data.captains.map(row));
    $("admin-body").hidden = false;
    $("admin-denied").hidden = true;
  } catch (error) {
    $("admin-body").hidden = true;
    $("admin-denied").hidden = false;
    $("admin-denied").textContent = error.message;
  }
}
