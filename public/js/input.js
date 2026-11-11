// AI note: written with help from Claude (Anthropic), as allowed for this assignment.
// input.js - keeps track of which keys are held and where the mouse is.
const keysDown = new Set();
const mouse = { x: 480, y: 300, down: false };

// True when the player is typing in a box, such as the sonar counts.
export function isTyping(event) {
  const tag = event.target && event.target.tagName;
  return tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA";
}

// Event: a key went down. Steering keys are ignored while typing.
window.addEventListener("keydown", (event) => {
  if (isTyping(event)) {
    return;
  }
  const key = event.key.toLowerCase();
  keysDown.add(key);
  // Stop the arrow keys and space from scrolling the page during play.
  if (key.startsWith("arrow") || key === " ") {
    event.preventDefault();
  }
});

// Event: a key came back up.
window.addEventListener("keyup", (event) => {
  keysDown.delete(event.key.toLowerCase());
});

// Event: the window lost focus. Let go of everything so the ship does not drift.
window.addEventListener("blur", () => {
  keysDown.clear();
  mouse.down = false;
});

// The on-screen joystick (touch.js) steers through this: x and y from -1 to 1.
const virtualMove = { x: 0, y: 0 };

export function setVirtualMove(x, y) {
  virtualMove.x = x;
  virtualMove.y = y;
}

export function getVirtualMove() {
  return virtualMove;
}

export function isDown(key) {
  return keysDown.has(key);
}

export function getMouse() {
  return mouse;
}

// Follows the mouse over the canvas, in canvas pixels (the canvas may be scaled by CSS).
export function watchMouse(canvas) {
  function place(event) {
    const box = canvas.getBoundingClientRect();
    mouse.x = (event.clientX - box.left) * (canvas.width / box.width);
    mouse.y = (event.clientY - box.top) * (canvas.height / box.height);
  }
  canvas.addEventListener("mousemove", place);
  canvas.addEventListener("mousedown", (event) => {
    if (event.button === 0) {
      place(event);
      mouse.down = true;
    }
  });
  window.addEventListener("mouseup", () => {
    mouse.down = false;
  });
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  // Touch: a finger on the sea aims and fires while it stays down.
  canvas.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "touch") return;
    place(event);
    mouse.down = true;
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch (error) {
      // capture is only a nicety: the controls still work without it
    }
  });
  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch" && mouse.down) place(event);
  });
  for (const name of ["pointerup", "pointercancel"]) {
    canvas.addEventListener(name, (event) => {
      if (event.pointerType === "touch") mouse.down = false;
    });
  }
}
