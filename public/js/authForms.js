// authForms.js - small helpers for the log in and register forms (looks only):
// show/hide password buttons, and live hints that turn green when a rule is met.
// The server still checks everything again; these hints only help the player.

const USERNAME_RULE = /^[A-Za-z0-9_]{3,20}$/;     // the same rule as the server

// Event: the eye button shows or hides the password in its box.
for (const button of document.querySelectorAll(".reveal")) {
  button.addEventListener("click", () => {
    const input = document.getElementById(button.dataset.reveal);
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    button.setAttribute("aria-pressed", String(show));
    button.setAttribute("aria-label", show ? "Hide password" : "Show password");
    input.focus();
  });
}

const username = document.getElementById("register-username");
const password = document.getElementById("register-password");
const confirm = document.getElementById("register-confirm");
const strengthBar = document.getElementById("strength-bar");

// Marks a hint as met (green), not met (red), or neutral when the box is empty.
function setHint(id, state, text) {
  const hint = document.getElementById(id);
  hint.className = "hint" + (state ? " " + state : "");
  hint.textContent = text;
}

// A rough password strength from 0 to 4: length, mixed case, numbers, symbols.
function strengthOf(value) {
  let points = 0;
  if (value.length >= 8) points++;
  if (value.length >= 12) points++;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) points++;
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) points++;
  else if (/\d/.test(value) || /[^A-Za-z0-9]/.test(value)) points += 0.5;
  return Math.min(4, Math.floor(points));
}

function updateHints() {
  const name = username.value.trim();
  if (name === "") setHint("hint-username", "", "3 to 20 letters, numbers or _");
  else if (USERNAME_RULE.test(name)) setHint("hint-username", "ok", "Good captain name");
  else setHint("hint-username", "bad", "Use 3 to 20 letters, numbers or _ only");

  const pass = password.value;
  const level = pass.length < 8 ? 0 : Math.max(1, strengthOf(pass));
  const names = ["Too short", "Weak", "Fair", "Good", "Strong"];
  strengthBar.style.width = pass === "" ? "0" : Math.max(10, level * 25) + "%";
  strengthBar.dataset.level = level;
  if (pass === "") setHint("hint-password", "", "At least 8 characters");
  else setHint("hint-password", pass.length < 8 ? "bad" : "ok", "Strength: " + names[level]);

  if (confirm.value === "") setHint("hint-confirm", "", "Both passwords must match");
  else if (confirm.value === pass) setHint("hint-confirm", "ok", "Passwords match");
  else setHint("hint-confirm", "bad", "Passwords do not match yet");
}

for (const input of [username, password, confirm]) {
  input.addEventListener("input", updateHints);
}
// After a successful sign-up the form is cleared, so the hints go back to normal too.
document.getElementById("register-form").addEventListener("reset", () => setTimeout(updateHints, 0));
