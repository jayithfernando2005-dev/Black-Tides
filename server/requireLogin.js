// requireLogin.js - a guard for routes that need a captain account.
// Express runs it before the route. Guests are stopped here with a 401 error.
function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Please log in first." });
  }
  next();                              // logged in: carry on to the route
}

module.exports = requireLogin;
