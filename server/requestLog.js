// requestLog.js - prints one line in the terminal for every request to our API, e.g.
//   21:50:12  POST /api/puzzle/answer   200   14 ms   Jayith
// It only READS the request after it is answered, so it never changes what the game does.
// It never prints what was sent (no passwords, no answers), and it skips pictures, CSS
// and JS files so only the meaningful calls show. Turn it off with LOG_REQUESTS=0.

// Colours for the status code in the terminal: green OK, yellow refused, red error.
const COLOURS = { ok: "\x1b[32m", warn: "\x1b[33m", error: "\x1b[31m", dim: "\x1b[2m", reset: "\x1b[0m" };

function colourFor(status) {
  if (status >= 500) return COLOURS.error;
  if (status >= 400) return COLOURS.warn;
  return COLOURS.ok;
}

function requestLog(req, res, next) {
  // Only the API: the browser also asks for many pictures and scripts, which would flood the log.
  if (!req.path.startsWith("/api/")) {
    return next();
  }
  const started = process.hrtime.bigint();

  // The live news stream stays open for a long time, so it is logged when it opens.
  if (req.path === "/api/live") {
    console.log(COLOURS.dim + time() + "  live news stream opened" + who(req) + COLOURS.reset);
    req.on("close", () => console.log(COLOURS.dim + time() + "  live news stream closed" + who(req) + COLOURS.reset));
    return next();
  }

  // Event: the answer has been sent - now print the line.
  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    const line = time() + "  " + req.method.padEnd(6) + " " + req.originalUrl.slice(0, 60).padEnd(34) +
      " " + colourFor(res.statusCode) + res.statusCode + COLOURS.reset + "  " + ms.toFixed(0).padStart(4) + " ms" + who(req);
    console.log(line);
  });
  next();
}

function time() {
  return new Date().toTimeString().slice(0, 8);
}

// Who made the request (the logged-in captain's name, or "guest").
function who(req) {
  return "   " + (req.session && req.session.username ? req.session.username : "guest");
}

module.exports = requestLog;
