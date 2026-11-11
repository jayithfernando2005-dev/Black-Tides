// make-admin.js - gives a captain the admin ("harbour master") role, or takes it away.
//   npm run make-admin -- Jayith          (make Jayith an admin)
//   npm run make-admin -- Jayith remove   (back to a normal captain)
// Run it in the project folder. The captain must already have an account.
const db = require("../server/db");

const [name, action] = process.argv.slice(2);
if (!name) {
  console.log("Usage: npm run make-admin -- <username> [remove]");
  process.exit(1);
}
const user = db.prepare("SELECT id, username, role FROM users WHERE username = ?").get(name);
if (!user) {
  console.log("There is no captain called " + name + ". Create the account in the game first.");
  process.exit(1);
}
const role = action === "remove" ? "captain" : "admin";
db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, user.id);
console.log(user.username + " is now " + (role === "admin" ? "an admin (harbour master)." : "a normal captain."));
