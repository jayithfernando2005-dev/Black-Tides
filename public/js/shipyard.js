// AI note: written with help from Claude (Anthropic), as allowed for this assignment.
// shipyard.js - shows the four upgrades as wooden cards (picture, stars, level bar and
// price tag) and buys them through our server (the server checks the gold).
// Used in two places: the Shipyard screen and the panel between waves in battle.
import { getProgress, buyUpgrade } from "./api.js";
import { emit } from "./events.js";

// A picture for each upgrade (cut from the Black Tides shipyard artwork).
const ART = {
  hull: "img/yard-hull.png",
  power: "img/yard-cannon.png",
  hold: "img/yard-ammo.png",
  scope: "img/yard-sonar.png"
};

// Draws the upgrade cards into list, the gold into goldLabel, news into message.
export async function showShipyard(list, goldLabel, message) {
  message.textContent = "";
  try {
    render(await getProgress(), list, goldLabel, message, null);
  } catch (error) {
    message.textContent = error.message;
  }
}

function make(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

// justBought: the upgrade that was just bought, so its newest star can sparkle.
function render(progress, list, goldLabel, message, justBought) {
  goldLabel.textContent = progress.gold;
  list.replaceChildren();

  Object.keys(progress.upgrades).forEach((key, index) => {
    const upgrade = progress.upgrades[key];
    const maxed = upgrade.cost === null;
    const affordable = !maxed && progress.gold >= upgrade.cost;

    const card = make("article", "upgrade-card up-" + key + (affordable ? " affordable" : "") + (maxed ? " maxed" : "") + (key === justBought ? " bought" : ""));
    card.style.animationDelay = (0.08 * index) + "s";

    const art = make("img", "up-art");
    art.src = ART[key];
    art.alt = "";                                   // the picture is decoration; the title says what it is

    const title = make("h3", "up-title", upgrade.name);
    const text = make("p", "up-text", upgrade.text);

    // Five stars and a five-part bar show the level (0 to 5).
    const stars = make("div", "up-stars");
    stars.setAttribute("aria-label", "Level " + upgrade.level + " of " + progress.maxLevel);
    for (let i = 0; i < progress.maxLevel; i++) {
      const star = make("i", i < upgrade.level ? "on" : "", "★");
      if (key === justBought && i === upgrade.level - 1) star.className = "on new";
      stars.appendChild(star);
    }
    const bar = make("div", "up-bar");
    bar.setAttribute("aria-hidden", "true");
    for (let i = 0; i < progress.maxLevel; i++) {
      bar.appendChild(make("i", i < upgrade.level ? "on" : ""));
    }

    // The price tag is the buy button.
    const price = make("button", "price-tag");
    price.type = "button";
    if (maxed) {
      price.textContent = "Max level";
      price.disabled = true;
    } else {
      price.append(make("span", "price-amount", upgrade.cost + " gold"), make("span", "price-buy", "Buy"));
      price.disabled = !affordable;
      price.setAttribute("aria-label", "Buy " + upgrade.name + " level " + (upgrade.level + 1) + " for " + upgrade.cost + " gold");
      price.title = affordable ? "Buy the next level" : "Not enough gold yet";
    }

    // Event: the price tag was pressed. The server checks the price and saves the new level.
    price.addEventListener("click", async () => {
      price.disabled = true;
      try {
        const updated = await buyUpgrade(key);
        message.textContent = upgrade.name + " upgraded to level " + (upgrade.level + 1) + ".";
        render(updated, list, goldLabel, message, key);
        emit("shipyard:bought", updated);
      } catch (error) {
        message.textContent = error.message;
        price.disabled = false;
      }
    });

    card.append(art, title, price, text, stars, bar);
    list.appendChild(card);
  });
}
