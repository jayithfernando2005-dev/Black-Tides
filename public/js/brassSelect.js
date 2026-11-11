// AI note: written with help from Claude (Anthropic), as allowed for this assignment.
// brassSelect.js - the brass dropdowns in Settings (Difficulty and the weather city), in the
// same style as the Steering keys wheel: a brass button that unrolls a parchment scroll.
// The real value stays in the hidden <select> (screens.js reads it when settings are saved),
// so this file only gives that select a nicer face. Each option may have a small note
// (data-note) shown under its name.
import { on } from "./events.js";

const dropdowns = [];

function make(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function enhance(select) {
  const wrap = make("div", "brass-drop");
  const button = make("button", "helm-button brass-drop-button");
  button.type = "button";
  button.setAttribute("aria-haspopup", "listbox");
  button.setAttribute("aria-expanded", "false");
  const label = document.querySelector("label[for='" + select.id + "']");
  if (label) {
    // the label now names the button, and clicking the label opens the list
    const labelId = select.id + "-label";
    label.id = labelId;
    label.removeAttribute("for");
    button.setAttribute("aria-labelledby", labelId + " " + select.id + "-value");
    label.addEventListener("click", () => button.click());
  }
  const value = make("span", "brass-drop-value");
  value.id = select.id + "-value";
  button.append(value, make("i"));

  const list = make("ul", "helm-scroll brass-drop-list");
  list.setAttribute("role", "listbox");
  list.hidden = true;
  const options = [...select.options].map((option) => {
    const item = make("li");
    item.setAttribute("role", "option");
    item.tabIndex = -1;
    item.dataset.value = option.value;
    const text = make("span", "brass-drop-text");
    text.append(make("b", "", option.textContent));
    if (option.dataset.note) text.append(make("small", "", option.dataset.note));
    item.append(text);
    return item;
  });
  list.append(...options);
  wrap.append(button, list);

  // hide the real select but keep it in the page for screens.js
  select.classList.remove("brass-select");
  select.classList.add("sr-only");
  select.tabIndex = -1;
  select.setAttribute("aria-hidden", "true");
  select.after(wrap);

  function show() {
    const chosen = select.options[select.selectedIndex];
    value.textContent = chosen ? chosen.textContent : "";
    for (const item of options) item.setAttribute("aria-selected", String(item.dataset.value === select.value));
  }
  function open() {
    for (const other of dropdowns) if (other !== api) other.close(false);
    list.hidden = false;
    button.setAttribute("aria-expanded", "true");
    (options.find((o) => o.dataset.value === select.value) || options[0]).focus();
  }
  function close(focusButton) {
    if (list.hidden) return;
    list.hidden = true;
    button.setAttribute("aria-expanded", "false");
    if (focusButton) button.focus();
  }
  function choose(choice) {
    if (choice !== select.value) {
      select.value = choice;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
    show();
    close(true);
  }

  button.addEventListener("click", () => (list.hidden ? open() : close(true)));
  for (const item of options) item.addEventListener("click", () => choose(item.dataset.value));
  // Keyboard: arrows move, Enter or Space picks, Escape closes (like the Steering keys wheel).
  list.addEventListener("keydown", (event) => {
    const index = options.indexOf(document.activeElement);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      options[(index + (event.key === "ArrowDown" ? 1 : options.length - 1)) % options.length].focus();
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(document.activeElement.dataset.value);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    }
  });
  document.addEventListener("pointerdown", (event) => {
    if (!wrap.contains(event.target) && !(label && label.contains(event.target))) close(false);
  });

  const api = { show, close };
  dropdowns.push(api);
  show();
}

for (const select of document.querySelectorAll("select.brass-select")) enhance(select);

// screens.js fills the selects when Settings opens, and again after "Reset to defaults".
on("screen:shown", (name) => { if (name === "settings") for (const d of dropdowns) d.show(); });
on("settings:changed", () => setTimeout(() => { for (const d of dropdowns) d.show(); }, 0));
