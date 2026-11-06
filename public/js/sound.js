// sound.js - every sound in the game, made in code with the Web Audio API
// (no sound files needed). Sounds play in reaction to game events,
// so the battle code never has to know that sound exists.
import { getSettings } from "./settings.js";
import { on } from "./events.js";

let audio = null;           // the AudioContext, created on the first click
let effectsVolume;          // gain node for sound effects
let ambienceVolume;         // gain node for the sea
let noiseBuffer;            // one second of white noise, reused
let ambience = null;        // the looping sea sound while it plays

// Browsers only allow sound after the player has clicked or pressed a key.
export function unlockAudio() {
  if (!audio) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }
    audio = new AudioContextClass();
    effectsVolume = audio.createGain();
    ambienceVolume = audio.createGain();
    effectsVolume.connect(audio.destination);
    ambienceVolume.connect(audio.destination);

    noiseBuffer = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    updateVolumes();
  }
  if (audio.state === "suspended") {
    audio.resume();
  }
}

// Reads the volume settings (0 to 100) and applies them.
export function updateVolumes() {
  if (!audio) {
    return;
  }
  const settings = getSettings();
  effectsVolume.gain.value = settings.mute ? 0 : settings.sfx / 100;
  ambienceVolume.gain.value = settings.mute ? 0 : (settings.ambience / 100) * 0.6;
}

// A tone that slides from one pitch to another and fades out.
function tone(fromHz, toHz, seconds, wave, volume, delay = 0) {
  if (!audio) return;
  const start = audio.currentTime + delay;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = wave;
  oscillator.frequency.setValueAtTime(fromHz, start);
  oscillator.frequency.exponentialRampToValueAtTime(toHz, start + seconds);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + seconds);
  oscillator.connect(gain).connect(effectsVolume);
  oscillator.start(start);
  oscillator.stop(start + seconds);
}

// A burst of filtered noise: cannon blasts, explosions, splashes.
function noise(seconds, volume, filterHz) {
  if (!audio) return;
  const source = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const gain = audio.createGain();
  source.buffer = noiseBuffer;
  filter.type = "lowpass";
  filter.frequency.value = filterHz;
  gain.gain.setValueAtTime(volume, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + seconds);
  source.connect(filter).connect(gain).connect(effectsVolume);
  source.start();
  source.stop(audio.currentTime + seconds);
}

export const sounds = {
  fire() { noise(0.18, 0.45, 1100); tone(150, 55, 0.16, "triangle", 0.35); },
  enemyFire() { noise(0.14, 0.18, 700); },
  hit() { tone(320, 110, 0.1, "square", 0.08); },
  explosion() { noise(0.7, 0.8, 450); tone(95, 30, 0.6, "sine", 0.5); },
  damage() { noise(0.3, 0.55, 1600); tone(110, 60, 0.2, "sawtooth", 0.15); },
  ping() { tone(1250, 1180, 0.6, "sine", 0.2); tone(1250, 1180, 0.4, "sine", 0.07, 0.35); },
  reload() { tone(420, 840, 0.1, "square", 0.08); tone(620, 1240, 0.14, "square", 0.08, 0.1); },
  wrong() { tone(190, 120, 0.4, "sawtooth", 0.15); },
  coin() { tone(950, 950, 0.08, "square", 0.08); tone(1420, 1420, 0.18, "square", 0.08, 0.08); },
  powerup() { tone(380, 1300, 0.35, "triangle", 0.22); },
  click() { tone(700, 500, 0.05, "triangle", 0.08); noise(0.06, 0.12, 900); },
  hover() { tone(1180, 1560, 0.09, "sine", 0.05); tone(1760, 1760, 0.12, "triangle", 0.025, 0.04); }
};

// The sea: looping noise, softened, rising and falling like waves.
export function startAmbience() {
  if (!audio || ambience) return;
  const source = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const swell = audio.createGain();
  const wave = audio.createOscillator();
  const waveDepth = audio.createGain();
  source.buffer = noiseBuffer;
  source.loop = true;
  filter.type = "lowpass";
  filter.frequency.value = 420;
  swell.gain.value = 0.35;
  wave.frequency.value = 0.12;          // one swell about every 8 seconds
  waveDepth.gain.value = 0.25;
  wave.connect(waveDepth).connect(swell.gain);
  source.connect(filter).connect(swell).connect(ambienceVolume);
  source.start();
  wave.start();
  ambience = { source: source, wave: wave };
}

export function stopAmbience() {
  if (!ambience) return;
  ambience.source.stop();
  ambience.wave.stop();
  ambience = null;
}

// Events: the game announces what happens, and this file plays the matching sound.
on("settings:changed", updateVolumes);
on("shot:fired", () => sounds.fire());
on("raider:fired", () => sounds.enemyFire());
on("raider:hit", () => sounds.hit());
on("raider:sunk", () => sounds.explosion());
on("player:hit", () => sounds.damage());
on("sonar:opened", () => sounds.ping());
on("sonar:reloaded", () => sounds.reload());
on("sonar:wrong", () => sounds.wrong());
on("gold:gained", () => sounds.coin());
on("powerup:picked", () => sounds.powerup());
on("shipyard:bought", () => sounds.coin());
