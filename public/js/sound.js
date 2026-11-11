// AI note: written with help from Claude (Anthropic), as allowed for this assignment.
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

// ----- Sounds of each stage (scheduled by stageSounds.js) -----
// They play through the ambience volume, so the "Sea ambience" slider controls them.

function envelope(node, start, attack, hold, release, peak) {
  node.gain.setValueAtTime(0.0001, start);
  node.gain.exponentialRampToValueAtTime(peak, start + attack);
  node.gain.setValueAtTime(peak, start + attack + hold);
  node.gain.exponentialRampToValueAtTime(0.0001, start + attack + hold + release);
}

export const stageSounds = {
  // a seagull: a falling, wobbling cry, two or three times
  gull() {
    if (!audio) return;
    const calls = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < calls; i++) {
      const start = audio.currentTime + i * 0.32;
      const osc = audio.createOscillator();
      const wobble = audio.createOscillator();
      const wobbleDepth = audio.createGain();
      const gain = audio.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(1900 + Math.random() * 300, start);
      osc.frequency.exponentialRampToValueAtTime(1150, start + 0.26);
      wobble.frequency.value = 28;
      wobbleDepth.gain.value = 70;
      wobble.connect(wobbleDepth).connect(osc.frequency);
      envelope(gain, start, 0.02, 0.12, 0.14, 0.09);
      osc.connect(gain).connect(ambienceVolume);
      osc.start(start); wobble.start(start);
      osc.stop(start + 0.32); wobble.stop(start + 0.32);
    }
  },
  // thunder: a crack, then a long low rumble
  thunder() {
    if (!audio) return;
    const start = audio.currentTime;
    const source = audio.createBufferSource();
    const filter = audio.createBiquadFilter();
    const gain = audio.createGain();
    source.buffer = noiseBuffer;
    source.loop = true;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(900, start);
    filter.frequency.exponentialRampToValueAtTime(120, start + 2.5);
    envelope(gain, start, 0.03, 0.25, 2.6, 0.9);
    source.connect(filter).connect(gain).connect(ambienceVolume);
    source.start(start);
    source.stop(start + 3);
  },
  // old timbers creaking: a slow, rough, sliding tone
  creak() {
    if (!audio) return;
    const start = audio.currentTime;
    const osc = audio.createOscillator();
    const filter = audio.createBiquadFilter();
    const gain = audio.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(70 + Math.random() * 30, start);
    osc.frequency.linearRampToValueAtTime(110 + Math.random() * 40, start + 0.9);
    filter.type = "bandpass";
    filter.frequency.value = 600;
    filter.Q.value = 6;
    envelope(gain, start, 0.15, 0.5, 0.4, 0.12);
    osc.connect(filter).connect(gain).connect(ambienceVolume);
    osc.start(start);
    osc.stop(start + 1.1);
  },
  // a ship's bell: two clear strokes
  bell() {
    if (!audio) return;
    for (const delay of [0, 0.55]) {
      for (const [hz, vol] of [[880, 0.12], [2210, 0.05], [1320, 0.04]]) {
        const start = audio.currentTime + delay;
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.frequency.value = hz;
        envelope(gain, start, 0.005, 0, 1.4, vol);
        osc.connect(gain).connect(ambienceVolume);
        osc.start(start);
        osc.stop(start + 1.5);
      }
    }
  },
  // the kraken's roar: a deep growl that rises and falls, with a breathy hiss
  roar() {
    if (!audio) return;
    const start = audio.currentTime;
    const osc = audio.createOscillator();
    const growl = audio.createOscillator();
    const growlDepth = audio.createGain();
    const filter = audio.createBiquadFilter();
    const gain = audio.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(55, start);
    osc.frequency.linearRampToValueAtTime(85, start + 0.8);
    osc.frequency.linearRampToValueAtTime(40, start + 2.2);
    growl.frequency.value = 18;
    growlDepth.gain.value = 12;
    growl.connect(growlDepth).connect(osc.frequency);
    filter.type = "lowpass";
    filter.frequency.value = 500;
    envelope(gain, start, 0.25, 1.2, 0.9, 0.55);
    osc.connect(filter).connect(gain).connect(effectsVolume);
    osc.start(start); growl.start(start);
    osc.stop(start + 2.5); growl.stop(start + 2.5);
    noise(1.6, 0.25, 700);
  },
  // the whirlpool: a deep swirling rush
  rumble() {
    if (!audio) return;
    const start = audio.currentTime;
    const source = audio.createBufferSource();
    const filter = audio.createBiquadFilter();
    const sweep = audio.createOscillator();
    const sweepDepth = audio.createGain();
    const gain = audio.createGain();
    source.buffer = noiseBuffer;
    source.loop = true;
    filter.type = "bandpass";
    filter.frequency.value = 300;
    filter.Q.value = 2;
    sweep.frequency.value = 0.6;
    sweepDepth.gain.value = 180;
    sweep.connect(sweepDepth).connect(filter.frequency);
    envelope(gain, start, 1, 10, 2.5, 0.5);
    source.connect(filter).connect(gain).connect(ambienceVolume);
    source.start(start); sweep.start(start);
    source.stop(start + 14); sweep.stop(start + 14);
  }
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
