// achievementsView.js - draws every achievement as a wooden card with a picture,
// a star (unlocked) or a padlock (locked). screens.js fetches the data from the
// server (GET /api/achievements); this file only turns it into HTML (looks only).

// A picture for each achievement. Most come from the Black Tides achievements artwork;
// a few reuse pictures from the shipyard and how-to-play screens.
const ART = {
  first_blood: "img/ach-first_blood.png",
  sharp_ears: "img/ach-sharp_ears.png",
  perfect_ping: "img/ach-perfect_ping.png",
  treasure_hunter: "img/ach-treasure_hunter.png",
  under_fire: "img/howto-cannon.png",
  wave_breaker: "img/ach-wave_breaker.png",
  boss_slayer: "img/ach-boss_slayer.png",
  deep_pockets: "img/ach-deep_pockets.png",
  full_refit: "img/yard-sonar.png",
  untouched: "img/yard-hull.png",
  old_salt: "img/ach-old_salt.png",
  top_ten: "img/ach-top_ten.png"
};

const LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3h1.5c.8 0 1.5.7 1.5 1.5v8c0 .8-.7 1.5-1.5 1.5h-13C4.7 21 4 20.3 4 19.5v-8c0-.8.7-1.5 1.5-1.5H7Zm2 0h6V7a3 3 0 0 0-6 0v3Zm3 4a1.6 1.6 0 0 0-.8 3V19h1.6v-2a1.6 1.6 0 0 0-.8-3Z" fill="currentColor"/></svg>';
const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 16.8l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" fill="currentColor"/></svg>';

function make(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

// Fills container with one card per achievement.
export function renderAchievementCards(container, badges) {
  const cards = badges.map((badge, index) => {
    const card = make("article", "ach-card ach-" + badge.key + (badge.unlocked ? " unlocked" : " locked"));
    card.style.animationDelay = (0.04 * index) + "s";
    card.tabIndex = 0;
    card.setAttribute("aria-label", badge.name + ": " + badge.text + (badge.unlocked ? ". Unlocked" : ". Locked"));

    const art = make("img", "ach-art");
    art.src = ART[badge.key] || "img/howto-coins.png";
    art.alt = "";

    const title = make("h3", "ach-title", badge.name);
    const icon = make("span", "ach-icon");
    icon.innerHTML = badge.unlocked ? STAR : LOCK;            // fixed SVG shapes only
    const text = make("p", "ach-text", badge.text);
    const state = make("span", "ach-state", badge.unlocked ? "Unlocked" : "Locked");

    card.append(art, title, icon, text, state);
    if (!badge.unlocked) {
      const padlock = make("span", "ach-padlock");
      padlock.innerHTML = LOCK;
      card.append(padlock);
    }
    return card;
  });
  container.replaceChildren(...cards);
}
