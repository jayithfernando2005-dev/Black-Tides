// achievements.js - the 12 badges and the rule for unlocking each one.
// Badges are worked out from the captain's saved record, so they can never get out of step.
const { getRecord, getRank } = require("./scores");

const ACHIEVEMENTS = [
  { key: "first_blood", name: "First Blood", text: "Sink your first raider", test: (s) => s.sunk >= 1 },
  { key: "sharp_ears", name: "Sharp Ears", text: "10 correct sonar counts", test: (s) => s.puzzlesSolved >= 10 },
  { key: "perfect_ping", name: "Perfect Ping", text: "5 correct counts in a row", test: (s) => s.bestStreak >= 5 },
  { key: "treasure_hunter", name: "Treasure Hunter", text: "10 correct chest counts", test: (s) => s.chestsRight >= 10 },
  { key: "under_fire", name: "Under Fire", text: "Reload with hull below 20", test: (s) => s.underFire === 1 },
  { key: "wave_breaker", name: "Wave Breaker", text: "Clear wave 5", test: (s) => s.bestWave >= 6 },
  { key: "boss_slayer", name: "Boss Slayer", text: "Sink a boss ship", test: (s) => s.bosses >= 1 },
  { key: "deep_pockets", name: "Deep Pockets", text: "Hold 500 gold at once", test: (s) => s.gold >= 500 },
  { key: "full_refit", name: "Full Refit", text: "Max out one upgrade", test: (s) => s.topUpgrade >= 5 },
  { key: "untouched", name: "Untouched", text: "Clear a wave with no damage", test: (s) => s.untouched === 1 },
  { key: "old_salt", name: "Old Salt", text: "Play 25 battles", test: (s) => s.games >= 25 },
  { key: "top_ten", name: "Top Ten", text: "Reach the leaderboard top 10", test: (s) => s.rank !== null && s.rank <= 10 }
];

// Every badge, each marked as unlocked or not, for one captain.
function listAchievements(userId, progress) {
  const stats = {
    ...getRecord(userId),
    rank: getRank(userId),
    puzzlesSolved: progress.puzzlesSolved,
    chestsRight: progress.chestsRight,
    bestStreak: progress.bestStreak,
    gold: progress.gold,
    topUpgrade: Math.max(progress.hull, progress.power, progress.hold, progress.scope)
  };
  return ACHIEVEMENTS.map((a) => ({ key: a.key, name: a.name, text: a.text, unlocked: a.test(stats) }));
}

module.exports = { listAchievements };
