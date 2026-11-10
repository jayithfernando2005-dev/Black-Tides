// AI note: written with help from Claude (Anthropic), as allowed for this assignment.
// leaderboardView.js - draws the rows of the leaderboard board: rank plates, a captain
// portrait made from the captain's name, an achievement crest with stars, and the score.
// screens.js fetches the data; this file only turns it into HTML (looks only).

// ---------- captain portraits ----------
// Every name always gives the same portrait: the name is turned into a number,
// and that number picks the skin, coat, hat, beard and whether there is an eye patch.
function hashName(name) {
  let hash = 2166136261;
  for (let i = 0; i < name.length; i++) {
    hash ^= name.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const SKIN = ["#f1c9a5", "#e0b088", "#c98e5e", "#a86b3c", "#7a4a2a"];
const COAT = ["#1f3358", "#5a1f22", "#24402f", "#3d2a55", "#2b2b2b"];
const HAT = ["#1a2238", "#2a1712", "#1b2a22", "#2c1d36", "#141414"];
const BEARD = ["none", "#3b2a1a", "#8a4a1f", "#cfcfcf", "#1a1a1a", "#b0612a"];
const SKY = [["#4a6a7a", "#1d2f3a"], ["#7a5a3a", "#2e2218"], ["#4f5a7a", "#1e2438"], ["#5a6e5a", "#1f2a20"]];

// Returns an SVG picture of a captain. Only colours chosen from the lists above go into
// it (never the name itself), so it is safe to put into the page.
export function captainPortrait(name) {
  const h = hashName(name);
  const pick = (list, shift) => list[(h >>> shift) % list.length];
  const skin = pick(SKIN, 0);
  const coat = pick(COAT, 3);
  const hat = pick(HAT, 6);
  const beard = pick(BEARD, 9);
  const sky = pick(SKY, 12);
  const patch = ((h >>> 15) & 3) === 0;
  const feather = ((h >>> 17) & 1) === 1;
  return `<svg viewBox="0 0 64 64" aria-hidden="true">
    <defs><linearGradient id="sky${h}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient></defs>
    <rect width="64" height="64" fill="url(#sky${h})"/>
    <path d="M6 64c2-12 12-17 26-17s24 5 26 17Z" fill="${coat}"/>
    <path d="M24 49l8 9 8-9-3-3h-10Z" fill="#e9dcc0"/>
    <path d="M14 58l4-6M50 58l-4-6" stroke="#d6a84a" stroke-width="2.5" stroke-linecap="round"/>
    <rect x="27" y="40" width="10" height="9" rx="3" fill="${skin}"/>
    <ellipse cx="32" cy="32" rx="12" ry="13.5" fill="${skin}"/>
    ${beard !== "none" ? `<path d="M20 33c1 10 6 15 12 15s11-5 12-15c-3 4-7 5-12 5s-9-1-12-5Z" fill="${beard}"/><path d="M26 39c2 1.5 4 2 6 2s4-.5 6-2" stroke="${beard}" stroke-width="2.5" fill="none" stroke-linecap="round"/>` : ""}
    <circle cx="27" cy="31" r="1.7" fill="#1b1410"/>
    ${patch ? `<path d="M19 25l26 4" stroke="#111" stroke-width="1.5"/><ellipse cx="37" cy="31" rx="4" ry="3.3" fill="#111"/>` : `<circle cx="37" cy="31" r="1.7" fill="#1b1410"/>`}
    <path d="M24 26.5h6M34 26.5h6" stroke="${beard === "none" ? "#5a3a22" : beard}" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M30 35.5q2 1.6 4 0" stroke="#7a4a32" stroke-width="1.3" fill="none" stroke-linecap="round"/>
    <path d="M8 23c6-3 14-4 24-4s18 1 24 4c-3-9-12-15-24-15S11 14 8 23Z" fill="${hat}"/>
    <path d="M8 23c6-3 14-4 24-4s18 1 24 4" stroke="#d6a84a" stroke-width="1.8" fill="none"/>
    <path d="M14 21c2-7 9-12 18-12s16 5 18 12c-6-1.6-12-2.3-18-2.3S20 19.4 14 21Z" fill="${hat}" stroke="rgba(255,255,255,0.08)"/>
    <circle cx="32" cy="15" r="2.6" fill="#e9dcc0"/>
    ${feather ? `<path d="M44 16c6-6 12-6 15-4-5 0-9 3-13 7Z" fill="#c9433a"/>` : ""}
  </svg>`;
}

// ---------- achievement crests ----------
const CRESTS = {
  ship: `<path d="M12 30h40l-6 10H18Z" fill="currentColor"/><path d="M31 8v21M33 10l12 15H33ZM29 12L19 25h10Z" fill="currentColor"/>`,
  storm: `<path d="M18 22a8 8 0 0 1 15-4 7 7 0 0 1 13 4 6 6 0 0 1-1 12H20a6 6 0 0 1-2-12Z" fill="currentColor"/><path d="M30 36l-4 8h5l-3 8 9-11h-5l3-5Z" fill="#ffd36b"/>`,
  target: `<circle cx="32" cy="28" r="16" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="32" cy="28" r="9" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="32" cy="28" r="3" fill="currentColor"/><path d="M32 6v10M32 40v10M10 28h10M44 28h10" stroke="currentColor" stroke-width="3"/>`,
  castle: `<path d="M14 44V22h6v5h5v-5h6v5h5v-5h6v5h5v-5h6v22Z" fill="currentColor"/><path d="M28 44v-8a4 4 0 0 1 8 0v8Z" fill="#2a1f14"/>`,
  anchor: `<circle cx="32" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="3"/><path d="M32 16v30M24 22h16M14 34c2 9 9 14 18 14s16-5 18-14l-5 3M14 34l5 3" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round"/>`
};

// Picks the proudest thing a captain has done, and 1 to 3 stars for how far they got.
export function captainFeat(row) {
  const sunk = row.sunk || 0;
  const bosses = row.bosses || 0;
  let feat;
  if (bosses >= 3) feat = { title: "Fleet Breaker", icon: "ship" };
  else if (bosses >= 1) feat = { title: "Flagship Sunk", icon: "ship" };
  else if (row.bestWave >= 6) feat = { title: "Storm Rider", icon: "storm" };
  else if (sunk >= 25) feat = { title: "Sharpshooter", icon: "target" };
  else if (row.bestWave >= 3) feat = { title: "Harbour Guard", icon: "castle" };
  else feat = { title: "Fresh Recruit", icon: "anchor" };
  feat.stars = row.bestWave >= 10 ? 3 : row.bestWave >= 5 ? 2 : 1;
  return feat;
}

function crestSvg(icon) {
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 2l26 9v18c0 17-11 27-26 33C17 56 6 46 6 29V11Z" class="shield"/><g transform="translate(9 8) scale(.72)">${CRESTS[icon]}</g></svg>`;
}

function make(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;   // textContent: names can never inject HTML
  return element;
}

// Builds one plank of the board for one captain.
function boardRow(row, index, me) {
  const isMe = row.username === me;
  const line = make("div", "board-row" + (isMe ? " me" : "") + (index < 3 ? " top" + (index + 1) : ""));
  line.setAttribute("role", "row");
  line.style.animationDelay = (0.08 * index + 0.2) + "s";

  const rank = make("div", "cell rank");
  rank.setAttribute("role", "cell");
  rank.append(make("span", "rank-plate", String(index + 1)));

  const captain = make("div", "cell captain");
  captain.setAttribute("role", "cell");
  const portrait = make("span", "portrait");
  renderPortraitLater(portrait, row);                      // drawn by portraits.js (chosen or uploaded)
  // the name opens the captain's public page (#/captain/Name)
  const nameBox = make("button", "captain-name captain-link");
  nameBox.type = "button";
  nameBox.dataset.nav = "captain/" + encodeURIComponent(row.username);
  nameBox.title = "See " + row.username + "'s captain page";
  nameBox.append(make("b", "", row.username));
  nameBox.append(make("small", "", (row.title ? row.title + " · " : "") + row.games + (row.games === 1 ? " battle" : " battles")));
  captain.append(portrait, nameBox);
  if (isMe) captain.append(make("span", "you-tag", "You"));

  const feat = captainFeat(row);
  const achievement = make("div", "cell feat");
  achievement.setAttribute("role", "cell");
  const crest = make("span", "crest crest-" + feat.icon);
  crest.innerHTML = crestSvg(feat.icon);
  const featText = make("span", "feat-text");
  featText.append(make("b", "", feat.title));
  featText.append(make("small", "", "Wave " + row.bestWave + " · " + (row.sunk || 0) + " sunk"));
  const stars = make("span", "stars", "★".repeat(feat.stars) + "☆".repeat(3 - feat.stars));
  stars.setAttribute("aria-label", feat.stars + " of 3 stars");
  featText.append(stars);
  achievement.append(crest, featText);

  const score = make("div", "cell score");
  score.setAttribute("role", "cell");
  score.append(make("b", "", Number(row.bestScore).toLocaleString("en-GB")), make("span", "", " pts"));

  line.append(rank, captain, achievement, score);
  return line;
}

// Fills the board with rows. me = the logged-in captain's name (or null).
export function renderLeaderboard(container, rows, me) {
  container.replaceChildren(...rows.map((row, index) => boardRow(row, index, me)));
}

// portraits.js imports this file, so it is loaded lazily here to avoid a loop.
function renderPortraitLater(element, row) {
  element.innerHTML = captainPortrait(row.username);
  import("./portraits.js").then((m) => m.renderPortrait(element, row.username, row.avatar, row.avatarVersion));
}
