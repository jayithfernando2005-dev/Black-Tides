// AI note: written with help from Claude (Anthropic), as allowed for this assignment.
// rankView.js - shows a captain's rank title and XP bar (the numbers come from the server).
export function renderRank(container, rank) {
  container.replaceChildren();
  const title = document.createElement("span");
  title.className = "xp-title";
  title.textContent = rank.title;
  const level = document.createElement("small");
  level.className = "xp-level";
  level.textContent = "Rank " + rank.level + " of 8";
  const track = document.createElement("div");
  track.className = "xp-track";
  const fill = document.createElement("i");
  fill.style.width = Math.round(rank.progress * 100) + "%";
  track.append(fill);
  const text = document.createElement("small");
  text.className = "xp-text";
  text.textContent = rank.next === null
    ? rank.xp.toLocaleString("en-GB") + " XP · highest rank"
    : rank.xp.toLocaleString("en-GB") + " / " + rank.next.toLocaleString("en-GB") + " XP to " + rank.nextTitle;
  container.append(title, level, track, text);
}
