# Black Tides

A 2D top-down naval shooter for CIS045-3 Distributed Service Architectures (Assignment 1).
Every cannon reload is a sonar puzzle from the Fish Game API: count the fish to reload,
and gamble on the chest count for gold.

## How to run

1. Install Node.js 22.13 or newer (the LTS version from nodejs.org).
2. Open this folder in VS Code and open a terminal (Terminal > New Terminal).
3. Install the packages (only needed once):

       npm install

4. Start the server:

       node server.js

5. Open http://localhost:3000 in Chrome.

A warning saying "SQLite is an experimental feature" is normal.
The database file `blacktides.db` is created by itself the first time the server runs.

## Screens and navigation

Every screen has its own address, so the browser's Back and Forward buttons work.
Escape on any screen goes back to the main menu.

| Screen | Address | Reached from |
|---|---|---|
| Log in | `#/login` | Start, Log out |
| Create account | `#/register` | Log in |
| Main menu | `#/menu` | After log in or Play as guest; every screen's Main menu button |
| Campaign map | `#/map` | Set sail (menu, How to play, Shipyard), end-of-battle panel |
| Battle | `#/game` | Set sail on the map (a stage) or Endless voyage |
| Shipyard | `#/shipyard` | Menu (also opens inside the battle after each wave) |
| Leaderboard | `#/leaderboard` | Menu, end-of-battle panel |
| Captain profile | `#/profile` | Menu, Achievements |
| Achievements | `#/achievements` | Menu, Captain profile |
| How to play | `#/howto` | Menu |
| Settings | `#/settings` | Menu |

Inside the battle: sonar panel (R), pause panel (P or Esc), Shipyard panel between waves,
and the end-of-battle panel (Enter plays again, M returns to the menu).

## The Naval Campaign

Nine stages on the Campaign Map. Each stage is a battle with a goal (win a number of waves)
and a twist: fog, storms, extra or tougher raiders, flagships, double gold.
Winning a stage unlocks the next one and pays gold (more the first time).

The server is in charge, so the browser cannot skip ahead:
- `server/campaign.js` holds the stage list; `GET /api/campaign` sends it with the captain's progress.
- `POST /api/campaign/start` refuses locked stages and remembers in the session which stage started and when.
- `POST /api/campaign/complete` only counts a stage that was started, not won impossibly fast,
  then unlocks the next stage (saved in the `campaign` column of `progress`) and pays the reward.

## Project structure

    server.js                 starts the server and joins the parts together
    server/
      fishApi.js              the only file that talks to the Fish Game API
      puzzleRoutes.js         /api/puzzle and /api/puzzle/answer (answers stay on the server)
      authRoutes.js           register, log in, log out, who am I, stay logged in
      passwords.js            scrypt password hashing with a random salt
      requireLogin.js         blocks routes for people who are not logged in
      progressRoutes.js       gold and the Shipyard
      campaign.js, campaignRoutes.js   the nine stages and the unlock rules
      scoreRoutes.js          scores, profile, achievements, leaderboard
      db.js                   SQLite database and its tables
      users.js, progress.js, scores.js, achievements.js   database helpers
    public/
      index.html              every screen
      style.css               the look
      js/main.js              starts everything
      js/events.js            the event bus (emit / on)
      js/screens.js           screens and navigation
      js/game.js              the battle: game loop, waves, boss, storms, pause
      js/renderer.js          draws the battle on the canvas
      js/hud.js               the instrument strip above the sea
      js/sonar.js             the sonar reload panel
      js/shipyard.js          upgrade cards
      js/shots.js, enemies.js, powerups.js, effects.js   parts of the battle
      js/input.js             keyboard and mouse
      js/settings.js          settings saved in a cookie
      js/sound.js             sounds made with the Web Audio API
      js/api.js               every request to our own server
      js/campaign.js          the Campaign Map (stages, routes, chosen voyage)
      js/mapScene.js          the living underwater scene behind the map
      js/liveScene.js         brings the splash and menu pictures to life
      js/battleArt.js         the painted look of the battle

## The four themes

- **Software design:** each file has one job (high cohesion). Files talk through the event bus
  and through `api.js`, so they do not depend on each other's insides (low coupling).
  Only `fishApi.js` knows the Fish API's address.
- **Event-driven programming:** browser events (keys, mouse, clicks, form submits, hashchange,
  visibilitychange), the game loop (requestAnimationFrame), and our own events such as
  `sonar:reloaded`, `raider:sunk`, `wave:cleared`, `battle:over`. The sound file only listens to events.
- **Interoperability:** the browser talks to our server in JSON over HTTP; our server talks to
  the Fish Game API (PHP) over HTTP and reads its JSON. The answers never reach the browser.
- **Virtual identity:** accounts with scrypt-hashed, salted passwords; a signed, httpOnly,
  SameSite session cookie; a new session id on log in; "stay logged in" for 30 days;
  guests; settings in a separate readable cookie.

## Music credits

- "The Buccaneer's Haul" by Shane Ivers – https://www.silvermansound.com (CC-BY 4.0) – menus and map
- "Pirates!" by Eric Matyas – Soundimage.org (CC-BY 4.0) – battle

Put the files in `public/audio/` as `the-buccaneers-haul.mp3` and `pirates.mp3`.

## Use of AI

Parts of this code were written with help from Claude (Anthropic), as allowed for this
assignment. Each file says what it does; I can explain every part of it.

## Captain portraits

Captains can change their portrait on the Captain Profile screen (the **Change portrait** button, or click the porthole).

- **Pick a pirate**: 12 ready-made portraits, saved as `preset:0` to `preset:11`.
- **Upload a picture**: the browser crops it to a square and shrinks it to a 256 x 256 JPEG before sending it.
- **Use my default portrait**: goes back to the portrait made from the captain's name.

Server side (`server/avatarRoutes.js`):
- `POST /api/profile/avatar` (logged in only) takes `{ preset }`, `{ image }` or `{ reset: true }`.
- An upload must be at most 70 KB, and its first bytes must really be a JPEG, PNG or WebP. Anything else gets 400.
- The picture is stored in the `users` table (`avatar_image`), not as a file, so nothing can be written to the server's folders.
- `GET /api/avatar/:username` sends the picture back with the right content type and `nosniff`.
- The profile and leaderboard include `avatar` and `avatarVersion`, so a changed picture shows straight away.

## Daily Challenge

One sonar picture per day, the same for every captain (menu → **Daily challenge**).

- The first request of the day makes the server fetch ONE puzzle from the Fish API and store it in the `daily_puzzles` table; everyone counts that picture all day.
- `GET /api/daily` shows today's board but never the picture, so nobody can look before their clock starts.
- `POST /api/daily/start` starts the clock **on the server** (stored in `daily_results`), so reloading or logging in again does not restart it.
- `POST /api/daily/answer`: a wrong fish count adds 10 s; a right count finishes. Counting the chests right too takes 5 s off. Finishing pays 30 gold, once a day.

## Live sea news (Server-Sent Events)

- `GET /api/live` is a long-lived Server-Sent Events stream (`server/liveEvents.js`).
- Routes call `publish()` when something happens: a captain joins, a stage is conquered for the first time, a top-10 personal best, a flagship sunk, or the Daily Challenge solved. Every open game receives it at once.
- The browser (`public/js/liveFeed.js`) turns each message into a `live:news` event on the game's event bus and shows a pop-up. The menu shows how many captains are online right now.
- Pop-ups can be turned off in **Settings → Live sea news pop-ups**.

## Real weather (Open-Meteo)

- The **Endless voyage** sails in the real weather of a city chosen in Settings (Colombo, Kandy, Galle, Jaffna, Trincomalee, Luton or London).
- `GET /api/weather?city=colombo` asks the free Open-Meteo API (no key needed) and keeps the answer for 10 minutes. Only the cities in the list can be asked for.
- Thunderstorm → storm every wave; rain or strong wind → storms often; fog → fog; a strong wind pushes the ship harder.
- If the weather cannot be read, the voyage simply sails in normal weather.

## Automated tests

```
npm test
```

Runs 26 tests with Node's built-in test runner (`node --test`), from the `tests` folder. Each test file starts the real server on a spare port with a throwaway in-memory database and a pretend Fish API and weather service, so the tests need no internet and never touch `blacktides.db`. They check accounts and password hashing, guest limits, fake pictures, that puzzle answers never reach the browser, campaign anti-cheat, the Daily Challenge rules, the live news stream, and the weather rules.

`server.js` only starts the server; the routes live in `server/app.js`, so the tests can start the same app. The Fish API and weather addresses can be changed with the `FISH_API_URL` and `WEATHER_API_URL` environment variables (the tests use this).

## Battle upgrades

- **Combo system**: sink ships within 3 seconds of each other to build a combo. Points are multiplied (x1.5 from 3 in a row, x2 from 5, up to x3). Being hit breaks the combo. The best combo is shown at the end of the battle.
- **New enemies**: cutters (small, fast, weak) from wave 3 and ironclads (slow, armoured, heavy double shot) from wave 5. Points and gold for each type are in `public/js/enemies.js` (`REWARDS`).
- **The kraken**: a boss that drifts across the top of the sea, sprays fans of ink and slams tentacles where your ship is (red ripples warn you first). It appears in the last wave of Kraken's Deep (stage 6) and Galleon Graveyard (stage 9), and every 10th wave of the Endless voyage.
- **Random sea events** (`public/js/seaEvents.js`): from wave 2, a 40% chance per wave of a whirlpool (pulls ships in, tears raiders apart), a merchant to escort (stay close for 6 s: +60 gold, +250 points) or a tentacle attack. To try one in the browser console: `blackTides.seaEvent("whirlpool")`.

## Ranks, captain pages and rivals

- **Ranks**: XP comes from saved records only (`server/ranks.js`): 1 XP per 20 points, 5 per ship, 50 per boss, 10 per sonar puzzle, 150 per campaign stage, 50 per Daily Challenge. Eight ranks from Deckhand to Admiral, shown on the menu, profile, leaderboard and captain pages.
- **Public captain pages**: click a name on the leaderboard (`#/captain/Name`). `GET /api/captains/:name` returns only public facts (never gold, passwords or ids).
- **Rivals**: mark up to 5 captains as rivals (captain page or profile). The profile compares your best score with theirs, and live sea news tells both captains when one overtakes the other.

## Extras

- **Share cards**: "Download share card" on the end-of-battle panel and after the Daily Challenge makes a 1200 x 630 PNG with your portrait, rank and result (drawn in the browser, nothing uploaded).
- **Admin page (Harbour master)**: `npm run make-admin -- <username>` gives a captain the admin role (`npm run make-admin -- <username> remove` takes it away). Admins see every captain and can rename, reset progress or remove accounts. The role is checked on the server for every request; admin accounts cannot be changed from the page.
- **Save files**: Settings → Save file → Download gives a JSON file with gold, upgrades, campaign and sonar record, signed with HMAC-SHA256. Load refuses edited files and other captains' saves (a guest's save can be loaded into a new account). Scores are never in save files.

## Gameplay upgrades (step 29)

- **Difficulty** (Settings → Play): Easy, Normal or Hard. All the numbers live in one object in `public/js/difficulty.js` (enemy damage, speed and toughness, gold and score multipliers). The difficulty is saved with each battle.
- **Special cannon shots**: every solved sonar puzzle loads a chain shot (slows a ship for 4 s) or a fire shot (burns and splashes nearby ships); counting the chests right too adds a broadside (5 shots in a fan). Keys 1–4 choose, Q cycles; the tray at the bottom of the battle shows what is loaded.
- **Daily quests** (`server/quests.js`): three quests a day, the same for everyone (picked from 12 using the date). Progress comes from saved battles, solved puzzles, the Daily Challenge and stage wins. Finished quests are claimed for gold on the Daily Challenge screen; a pop-up says when one is done.

## Look and feel

- **Ship customisation** (Shipyard → Your ship's colours): a ship name, six sail colours (dyed on the canvas with a "multiply" blend) and six flags, shown in battle and on your captain page. `POST /api/profile/ship` only accepts the listed choices.
- **Story**: comic-style panels before Stage 1 (once per device, or from How to play) and an ending after winning the Galleon Graveyard.
- **Stage sounds** (`public/js/stageSounds.js`): gulls, bells, creaking timbers, thunder in storms, the kraken's roar and the whirlpool's rush, all made with the Web Audio API and played through the ambience volume.
- **Touch controls**: on phones and tablets a joystick steers and a finger on the sea aims and fires. They sit under the sea on an upright phone and over it in landscape.

## Extras

- **Guest progress kept** (`public/js/guestKeeper.js`): the guest's signed save file is copied into the browser after each battle, restored next visit, and carried into a new account on sign-up.
- **Weekly tournament** (`server/weekly.js`): the leaderboard's "Weekly tournament" tab counts battles since Monday 00:00. When a week ends its winner is stored and wears a champion's crown on their captain page.
- **Accessibility** (Settings → Accessibility): colour-blind friendly colours, bigger text, reduced motion (no shake, calmer animations) and a high-contrast battle display.
- **Statistics** (Profile → Statistics): SVG charts drawn by hand: score over the last 30 battles, battles per day, favourite waters and sonar accuracy (`GET /api/stats`).

Tests: `npm test` now runs 49 tests (new: quests, ship customisation, the weekly tournament and statistics).
