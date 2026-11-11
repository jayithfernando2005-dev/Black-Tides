// requireAdmin.js - a guard for the admin page's routes. The role is read from the database
// on every request (not from the session), so taking away admin rights works at once.
const { isAdmin } = require("./users");

function requireAdmin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Please log in first." });
  }
  if (!isAdmin(req.session.userId)) {
    return res.status(403).json({ error: "Only harbour masters (admins) may do that." });
  }
  next();
}

module.exports = requireAdmin;
