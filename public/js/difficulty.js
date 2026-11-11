// AI note: written with help from Claude (Anthropic), as allowed for this assignment.
// difficulty.js - Easy, Normal and Hard in one place. Every number that changes with the
// difficulty is here, so the rest of the game just asks for "the current difficulty".
import { getSettings } from "./settings.js";

export const DIFFICULTY = {
  easy: { label: "Easy", enemyDamage: 0.6, enemySpeed: 0.85, enemyHp: 0.8, gold: 0.8, score: 0.75 },
  normal: { label: "Normal", enemyDamage: 1, enemySpeed: 1, enemyHp: 1, gold: 1, score: 1 },
  hard: { label: "Hard", enemyDamage: 1.35, enemySpeed: 1.15, enemyHp: 1.25, gold: 1.25, score: 1.3 }
};

export function difficultyKey() {
  return DIFFICULTY[getSettings().difficulty] ? getSettings().difficulty : "normal";
}

export function getDifficulty() {
  return DIFFICULTY[difficultyKey()];
}

// Makes a newly spawned ship match the difficulty (tougher and faster on Hard).
export function applyDifficulty(raider) {
  if (!raider || raider.tuned) return;
  const d = getDifficulty();
  raider.hp = Math.max(1, Math.round(raider.hp * d.enemyHp));
  raider.maxHp = raider.hp;
  if (raider.speed) raider.speed *= d.enemySpeed;
  if (raider.damage) raider.damage = Math.round(raider.damage * d.enemyDamage);
  raider.tuned = true;
}
