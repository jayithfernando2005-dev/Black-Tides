// liveEvents.js - "Live sea news". When something worth telling happens anywhere on the
// server (a new captain, a stage conquered, a record score, a Daily Challenge solved), the
// route that saw it calls publish(). Every open game gets the news at once through
// Server-Sent Events: one long-lived HTTP response that the server keeps writing to.
//
//   route --publish()--> news (EventEmitter) --"news" event--> each open browser
//
// The routes do not know who is listening, and the listeners do not know which route
// spoke: that is the event-driven part.
const express = require("express");
const { EventEmitter } = require("node:events");

const news = new EventEmitter();
news.setMaxListeners(500);              // one listener per open browser tab

const KINDS = ["captain:joined", "stage:cleared", "score:record", "flagship:sunk", "daily:solved", "rival:passed"];
let nextId = 1;

// Announce something to every open game. data must contain only safe, plain values.
function publish(kind, data) {
  if (!KINDS.includes(kind)) {
    throw new Error("Unknown news kind: " + kind);
  }
  news.emit("news", { id: nextId++, kind: kind, at: Date.now(), ...data });
}

// Writes one Server-Sent Event: an "event:" line, a "data:" line and a blank line.
function send(res, eventName, data) {
  res.write("event: " + eventName + "\n");
  res.write("data: " + JSON.stringify(data) + "\n\n");
}

let online = 0;                          // how many games are listening right now

const router = express.Router();

// GET /api/live - the browser opens this once (new EventSource("/api/live")) and keeps it open.
router.get("/live", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive"
  });
  res.flushHeaders();
  res.write("retry: 5000\n\n");          // if the connection drops, the browser retries after 5 s

  online += 1;
  const onNews = (item) => send(res, "news", item);
  const onOnline = (count) => send(res, "online", { count: count });
  news.on("news", onNews);
  news.on("online", onOnline);
  news.emit("online", online);           // everyone sees the new number of captains at sea

  // A comment line every 25 s keeps the connection from being closed as idle.
  const keepAlive = setInterval(() => res.write(": still here\n\n"), 25000);

  // Event: the tab was closed or the player left - stop sending to it.
  req.on("close", () => {
    clearInterval(keepAlive);
    news.off("news", onNews);
    news.off("online", onOnline);
    online -= 1;
    news.emit("online", online);
  });
});

module.exports = { router, publish, news };
