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
