// fullscreen.js - the full-screen button (bottom-left corner) and the F key.
// It uses the browser's Fullscreen API; Esc also leaves full screen (the browser does that).
// The button changes its icon and label from the "fullscreenchange" event, so it is right
// however full screen was entered or left.

const button = document.getElementById("fullscreen-button");

// Older Safari uses "webkit" names for the same thing.
function current() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function supported() {
  const root = document.documentElement;
  return Boolean(root.requestFullscreen || root.webkitRequestFullscreen);
}

export async function toggleFullscreen() {
  try {
    if (current()) {
      await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else {
      const root = document.documentElement;
      await (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
    }
  } catch (error) {
    // the browser said no (for example inside a frame); the game carries on as it is
  }
}

function update() {
  const on = Boolean(current());
  button.classList.toggle("is-full", on);
  button.setAttribute("aria-pressed", String(on));
  const label = on ? "Exit full screen (F)" : "Full screen (F)";
  button.title = label;
  button.setAttribute("aria-label", label);
}

if (supported()) {
  button.hidden = false;
  button.addEventListener("click", () => {
    toggleFullscreen();
    button.blur();                          // so Space or Enter does not press it again
  });
  // Event: full screen started or ended (button, F, Esc or the browser's own menu).
  document.addEventListener("fullscreenchange", update);
  document.addEventListener("webkitfullscreenchange", update);
  // The F key, except while typing in a box.
  window.addEventListener("keydown", (event) => {
    if (event.key !== "f" && event.key !== "F") return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const tag = document.activeElement ? document.activeElement.tagName : "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    toggleFullscreen();
  });
  update();
}
