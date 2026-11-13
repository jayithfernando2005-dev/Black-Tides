// AI note: written with help from Claude (Anthropic), as allowed for this assignment.
// touch.js - on-screen controls for phones and tablets. A joystick on the left steers the
// ship, a finger on the sea aims and fires (input.js), and buttons change the shot type and
// pause. The controls only appear on touch screens.
import { setVirtualMove } from "./input.js";
import { cycleShot } from "./game.js";

const $ = (id) => document.getElementById(id);
const controls = $("touch-controls");
const stick = $("joystick");
const knob = $("joystick-knob");
const RADIUS = 46;                // how far the knob can move, in CSS pixels

// Phones and tablets only: their main pointer is a finger ("coarse"). Laptops that merely
// support touch still use a mouse, so they keep the normal controls (and the radar).
function isTouchScreen() {
  return window.matchMedia("(pointer: coarse)").matches && !window.matchMedia("(any-pointer: fine)").matches;
}

function show() {
  controls.hidden = false;
  document.body.classList.add("touch-play");
}

// Back to keyboard and mouse: the buttons go away and the brass radar comes back.
function hide() {
  controls.hidden = true;
  document.body.classList.remove("touch-play");
  release();
}

// On an upright phone the controls sit under the sea (outside the battle area, so the sonar
// lever stays on the sea); otherwise they float over the sea.
const stage = controls.parentElement;
const upright = window.matchMedia("(max-width: 760px) and (orientation: portrait)");
function place() {
  if (upright.matches && controls.parentElement === stage) stage.after(controls);
  else if (!upright.matches && controls.parentElement !== stage) stage.append(controls);
  // the joystick only covers the radar when the controls float over the sea
  document.body.classList.toggle("touch-overlay", controls.parentElement === stage);
}
place();
upright.addEventListener("change", place);

if (isTouchScreen()) show();

// Laptops with a touch screen: the controls follow whatever the player is really using.
// A finger on the screen turns them on; moving the mouse or pressing a key turns them off,
// so one accidental touch no longer leaves the Shot button and joystick on screen.
window.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "touch") show();
}, { passive: true });
let mouseTravel = 0;
window.addEventListener("pointermove", (event) => {
  if (event.pointerType !== "mouse" || isTouchScreen() || controls.hidden) return;
  mouseTravel += Math.abs(event.movementX || 0) + Math.abs(event.movementY || 0);
  if (mouseTravel > 40) { mouseTravel = 0; hide(); }   // a real mouse move, not a tiny jiggle
});
window.addEventListener("keydown", (event) => {
  // event.isTrusted is false for the pretend "P" key sent by the touch pause button
  if (event.isTrusted && !isTouchScreen() && !controls.hidden) hide();
});

let activePointer = null;
let centre = { x: 0, y: 0 };

function moveKnob(event) {
  let dx = event.clientX - centre.x;
  let dy = event.clientY - centre.y;
  const distance = Math.hypot(dx, dy);
  if (distance > RADIUS) {
    dx = dx / distance * RADIUS;
    dy = dy / distance * RADIUS;
  }
  knob.style.transform = "translate(" + dx + "px, " + dy + "px)";
  setVirtualMove(dx / RADIUS, dy / RADIUS);
}

function release() {
  activePointer = null;
  knob.style.transform = "";
  setVirtualMove(0, 0);
}

stick.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  const box = stick.getBoundingClientRect();
  centre = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  activePointer = event.pointerId;
  try {
    stick.setPointerCapture(event.pointerId);
  } catch (error) {
    // capture is only a nicety: the controls still work without it
  }
  moveKnob(event);
});
stick.addEventListener("pointermove", (event) => {
  if (event.pointerId === activePointer) moveKnob(event);
});
stick.addEventListener("pointerup", release);
stick.addEventListener("pointercancel", release);

$("touch-shot").addEventListener("click", () => cycleShot());
$("touch-pause").addEventListener("click", () => {
  // the same as pressing P
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "p" }));
});

// Fade the hint after the first few seconds of play.
setTimeout(() => $("touch-hint").classList.add("faded"), 12000);
