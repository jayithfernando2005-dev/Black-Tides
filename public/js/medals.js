// medals.js - draws achievements as compass-star medals (looks only).
// Unlocked medals are gold, silver or bronze with their own icon; locked ones are dark iron with "?".
// The data comes from the server (GET /api/achievements) through screens.js.

// A small icon for each achievement, drawn in a 24 x 24 box.
const ICONS = {
  first_blood: '<path d="M5 19L19 5M19 19L5 5" stroke-width="2.6"/><path d="M3 21l3-1-2-2zM21 21l-3-1 2-2z" fill="currentColor"/>',
  sharp_ears: '<path d="M8 13a4 4 0 0 1 8 0M5 13a7 7 0 0 1 14 0M2.5 13a9.5 9.5 0 0 1 19 0" stroke-width="2"/><circle cx="12" cy="14" r="1.8" fill="currentColor"/>',
  perfect_ping: '<circle cx="12" cy="12" r="8" stroke-width="2"/><circle cx="12" cy="12" r="4" stroke-width="2"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>',
  treasure_hunter: '<path d="M4 11h16v8H4z" stroke-width="2"/><path d="M4 11c0-4 3.5-6 8-6s8 2 8 6" stroke-width="2"/><path d="M11 13h2v3h-2z" fill="currentColor"/>',
  under_fire: '<path d="M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 2-7 2 1 3 3 3 5 1-2 1-6 1-9z" fill="currentColor" stroke="none"/>',
  wave_breaker: '<path d="M2 14c3-4 6-4 9 0s6 4 9 0M2 19c3-4 6-4 9 0s6 4 9 0M5 9c2-3 5-4 8-2" stroke-width="2"/>',
  boss_slayer: '<path d="M3 15h18l-3 5H6z" fill="currentColor" stroke="none"/><path d="M11 3v11M12 4l7 9h-7zM10 6l-5 7h5z" fill="currentColor" stroke="none"/>',
  deep_pockets: '<ellipse cx="12" cy="17" rx="7" ry="2.5" stroke-width="2"/><ellipse cx="12" cy="12" rx="7" ry="2.5" stroke-width="2"/><ellipse cx="12" cy="7" rx="7" ry="2.5" stroke-width="2"/>',
  full_refit: '<path d="M14.5 4a4.5 4.5 0 0 0-4.3 5.8L3.5 16.5 7.5 20.5l6.7-6.7A4.5 4.5 0 0 0 20 9.5l-3 3-3-3 3-3a4.5 4.5 0 0 0-2.5-.5z" fill="currentColor" stroke="none"/>',
  untouched: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" stroke-width="2"/><path d="M8.5 12l2.5 2.5 4.5-5" stroke-width="2"/>',
  old_salt: '<circle cx="12" cy="5" r="2" stroke-width="2"/><path d="M12 7v13M8 10h8M4 14c1 4 4 6 8 6s7-2 8-6" stroke-width="2"/>',
  top_ten: '<path d="M3 18h18l-1.5-10-5 4.5L12 5l-2.5 7.5-5-4.5z" fill="currentColor" stroke="none"/>'
};

// Metal colours: [light, mid, dark, icon colour].
const METALS = {
  gold: ["#fff0b0", "#e2b13e", "#8a5f12", "#4a3006"],
  silver: ["#ffffff", "#c3c8cc", "#6f767c", "#2c3236"],
  bronze: ["#ffd2a8", "#c27a42", "#6a3a17", "#3a1d08"],
  iron: ["#7b7a76", "#4c4b48", "#2b2a28", "#9a978f"]
};

// A 16-point compass star centred in a 64 x 64 box.
function starPoints() {
  const points = [];
  for (let i = 0; i < 16; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 8;
    const radius = i % 2 === 0 ? 30 : 23.5;
    points.push((32 + Math.cos(angle) * radius).toFixed(1) + "," + (32 + Math.sin(angle) * radius).toFixed(1));
  }
  return points.join(" ");
}
const STAR = starPoints();

let gradientId = 0;
function medalSvg(key, metalName, unlocked) {
  const m = METALS[metalName];
  const id = "medal" + (gradientId++);
  const inside = unlocked
    ? `<g transform="translate(20 20)" fill="none" stroke="${m[3]}" stroke-linecap="round" stroke-linejoin="round" color="${m[3]}">${ICONS[key] || ICONS.old_salt}</g>`
    : `<text x="32" y="40" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-weight="900" font-size="22" fill="#a9a59b">?</text>`;
  return `<svg viewBox="0 0 64 64" aria-hidden="true">
    <defs>
      <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${m[0]}"/><stop offset=".5" stop-color="${m[1]}"/><stop offset="1" stop-color="${m[2]}"/></linearGradient>
      <radialGradient id="${id}c" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="${m[0]}"/><stop offset=".7" stop-color="${m[1]}"/><stop offset="1" stop-color="${m[2]}"/></radialGradient>
    </defs>
    <polygon points="${STAR}" fill="url(#${id})" stroke="${m[2]}" stroke-width="1.5"/>
    <circle cx="32" cy="32" r="17" fill="url(#${id}c)" stroke="${m[2]}" stroke-width="2"/>
    <circle cx="32" cy="32" r="13.5" fill="none" stroke="${m[0]}" stroke-opacity=".5" stroke-width="1"/>
    ${inside}
  </svg>`;
}

// Fills container with one medal per achievement.
export function renderMedals(container, badges) {
  const metals = ["gold", "silver", "bronze"];
  let unlockedCount = 0;
  const medals = badges.map((badge, index) => {
    const metal = badge.unlocked ? metals[unlockedCount++ % metals.length] : "iron";
    const medal = document.createElement("div");
    medal.className = "medal" + (badge.unlocked ? " unlocked" : "");
    medal.style.animationDelay = (0.2 + index * 0.05) + "s";      // medals pop in one after another
    medal.setAttribute("role", "img");
    medal.setAttribute("aria-label", badge.name + ": " + badge.text + (badge.unlocked ? " (unlocked)" : " (locked)"));
    medal.innerHTML = medalSvg(badge.key, metal, badge.unlocked);   // SVG built only from fixed shapes
    const tip = document.createElement("span");
    tip.className = "medal-tip";
    const name = document.createElement("b");
    name.textContent = badge.name;
    const text = document.createElement("small");
    text.textContent = badge.unlocked ? badge.text : "Locked: " + badge.text;
    tip.append(name, text);
    medal.append(tip);
    medal.tabIndex = 0;                                            // keyboard users can read the tip too
    return medal;
  });
  container.replaceChildren(...medals);
}
