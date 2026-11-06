// events.js - a small event bus. One part of the game announces that something
// happened (emit), and any other part that cares reacts to it (on).
// The parts never call each other directly, which keeps them loosely coupled.
const bus = new EventTarget();

// Announce an event, with optional extra information (detail).
export function emit(name, detail) {
  bus.dispatchEvent(new CustomEvent(name, { detail: detail }));
}

// Run handler every time the named event happens.
export function on(name, handler) {
  bus.addEventListener(name, (event) => handler(event.detail));
}
