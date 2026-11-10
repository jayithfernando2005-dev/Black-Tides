// AI note: written with help from Claude (Anthropic), as allowed for this assignment.
// campaign.js - the nine stages of the Naval Campaign. Each stage is a battle with a goal
// (survive a number of waves) and its own twist. Clearing a stage unlocks the next one.
// The stage list lives only here on the server; the browser receives it from GET /api/campaign.

// waves:   waves to clear to win the stage
// harder:  added to the wave number when raiders are made (tougher, faster raiders)
// extra:   extra raiders in every wave
// bossWaves: waves where the raider flagship attacks
// storm:   "always", "never" or "normal" (normal = the usual storms from wave 6)
// fog:     true = the sea is hidden in fog except close to your ship
// goldBonus: gold from sunk ships is multiplied by this
const STAGES = [
  { id: 1, name: "Volcano Isle", icon: "volcano", waves: 2, harder: 0, extra: 0, bossWaves: [], storm: "never", fog: false, goldBonus: 1,
    text: "Ash falls on calm water. Learn to aim, fire and reload." },
  { id: 2, name: "Harbour Fort", icon: "fort", waves: 3, harder: 0, extra: 0, bossWaves: [], storm: "never", fog: false, goldBonus: 1,
    text: "Raiders test the harbour defences. Hold them off." },
  { id: 3, name: "Castle Siege", icon: "castle", waves: 3, harder: 1, extra: 0, bossWaves: [3], storm: "never", fog: false, goldBonus: 1,
    text: "The raider flagship leads the siege in the last wave." },
  { id: 4, name: "Foggy Strait", icon: "whirlpool", waves: 4, harder: 1, extra: 0, bossWaves: [], storm: "never", fog: true, goldBonus: 1,
    text: "Thick fog. Trust your radar - raiders appear out of nowhere." },
  { id: 5, name: "Smugglers' Reef", icon: "chest", waves: 4, harder: 2, extra: 1, bossWaves: [], storm: "never", fog: false, goldBonus: 2,
    text: "More raiders, but every ship sunk pays double gold." },
  { id: 6, name: "Kraken's Deep", icon: "raider", waves: 5, harder: 2, extra: 1, bossWaves: [], kraken: [5], storm: "always", fog: false, goldBonus: 1,
    text: "A storm that never ends, and something huge waits below. The kraken rises in the last wave." },
  { id: 7, name: "Northern Bastion", icon: "bastion", waves: 5, harder: 3, extra: 1, bossWaves: [5], storm: "never", fog: false, goldBonus: 1,
    text: "Break the northern fortress. Its flagship waits at the end." },
  { id: 8, name: "Raider Port", icon: "port", waves: 6, harder: 4, extra: 1, bossWaves: [3, 6], storm: "always", fog: true, goldBonus: 1,
    text: "Storm and fog over the raiders' home port, with two flagships." },
  { id: 9, name: "Galleon Graveyard", icon: "galleon", waves: 7, harder: 5, extra: 2, bossWaves: [4], kraken: [7], storm: "always", fog: false, goldBonus: 2,
    text: "The final battle among the wrecks: a flagship, then the kraken itself. Win it to rule the Black Tides." }
];

const SECONDS_PER_WAVE = 4;     // a stage cannot honestly be won faster than this per wave

function getStage(id) {
  return STAGES.find((stage) => stage.id === id) || null;
}

// Gold for winning a stage: more the first time.
function rewardFor(stage, firstClear) {
  return firstClear ? 40 * stage.id : 10 * stage.id;
}

module.exports = { STAGES, SECONDS_PER_WAVE, getStage, rewardFor };
