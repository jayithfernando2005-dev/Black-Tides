// quests.js - daily quests. Each day three quests are picked from the list below (the same
// three for every captain), and finishing one pays gold. Progress comes from what the server
// already sees: saved battles, solved sonar puzzles, the Daily Challenge and campaign wins.
const db = require("./db");
const { today } = require("./daily");

// mode "sum": add up over the day.  mode "best": the best single battle counts.
const QUESTS = [
  { key: "sink25", text: "Sink 25 ships", stat: "sunk", goal: 25, mode: "sum", gold: 50 },
  { key: "cutters8", text: "Sink 8 cutters", stat: "cutters", goal: 8, mode: "sum", gold: 50 },
  { key: "ironclads3", text: "Sink 3 ironclads", stat: "ironclads", goal: 3, mode: "sum", gold: 60 },
  { key: "boss1", text: "Sink a flagship or the kraken", stat: "bosses", goal: 1, mode: "sum", gold: 70 },
  { key: "wave6", text: "Reach wave 6 in one battle", stat: "wave", goal: 6, mode: "best", gold: 60 },
  { key: "score5k", text: "Score 5,000 points in one battle", stat: "score", goal: 5000, mode: "best", gold: 60 },
  { key: "puzzles5", text: "Solve 5 sonar puzzles", stat: "puzzles", goal: 5, mode: "sum", gold: 40 },
  { key: "escort1", text: "Escort a merchant ship to safety", stat: "escorts", goal: 1, mode: "sum", gold: 50 },
  { key: "combo5", text: "Sink 5 ships in one combo", stat: "bestCombo", goal: 5, mode: "best", gold: 60 },
  { key: "specials3", text: "Fire 3 special cannon shots", stat: "specialsUsed", goal: 3, mode: "sum", gold: 40 },
  { key: "daily1", text: "Finish today's Daily Challenge", stat: "daily", goal: 1, mode: "sum", gold: 40 },
  { key: "stage1", text: "Win a campaign stage", stat: "stage", goal: 1, mode: "sum", gold: 70 }
];

// A number made from the date, so every captain gets the same quests on the same day.
function seedFrom(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// The three quests for a day.
function questsFor(day = today()) {
  const list = QUESTS.slice();
  let seed = seedFrom(day);
  const chosen = [];
  while (chosen.length < 3) {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    chosen.push(list.splice(seed % list.length, 1)[0]);
  }
  return chosen;
}

// Adds to today's quests. stats: { sunk: 4, wave: 3, ... }; unknown stats are ignored.
// Returns the texts of quests that became complete just now.
function recordQuestStats(userId, stats) {
  const day = today();
  const finished = [];
  for (const quest of questsFor(day)) {
    const value = Number(stats[quest.stat]);
    if (!Number.isFinite(value) || value <= 0) continue;
    const row = db.prepare("SELECT progress FROM quest_progress WHERE day = ? AND user_id = ? AND quest_key = ?").get(day, userId, quest.key);
    const before = row ? row.progress : 0;
    const after = Math.min(quest.goal, quest.mode === "best" ? Math.max(before, value) : before + value);
    if (after === before) continue;
    db.prepare(`
      INSERT INTO quest_progress (day, user_id, quest_key, progress) VALUES (?, ?, ?, ?)
      ON CONFLICT (day, user_id, quest_key) DO UPDATE SET progress = excluded.progress
    `).run(day, userId, quest.key, after);
    if (before < quest.goal && after >= quest.goal) finished.push(quest.text);
  }
  return finished;
}

// Today's quests for one captain, with progress.
function listQuests(userId) {
  const day = today();
  return questsFor(day).map((quest) => {
    const row = db.prepare("SELECT progress, claimed FROM quest_progress WHERE day = ? AND user_id = ? AND quest_key = ?").get(day, userId, quest.key);
    const progress = row ? row.progress : 0;
    return { key: quest.key, text: quest.text, goal: quest.goal, gold: quest.gold, progress: progress,
      done: progress >= quest.goal, claimed: Boolean(row && row.claimed) };
  });
}

// Marks a finished quest as claimed. Returns the gold, or an error message.
function claimQuest(userId, key) {
  const quest = listQuests(userId).find((q) => q.key === key);
  if (!quest) return { error: "That is not one of today's quests." };
  if (!quest.done) return { error: "That quest is not finished yet." };
  if (quest.claimed) return { error: "You already claimed that reward." };
  db.prepare("UPDATE quest_progress SET claimed = 1 WHERE day = ? AND user_id = ? AND quest_key = ?").run(today(), userId, key);
  return { gold: quest.gold };
}

module.exports = { QUESTS, questsFor, recordQuestStats, listQuests, claimQuest };
