// liveScene.js - brings a still painting to life on a canvas: the sea moves, ships rock,
// rain falls, smoke drifts, fires flicker, fireballs streak across the sky, cannons flash
// and lightning strikes. Used by the splash/login screen and by the main menu, each with
// its own picture. The picture-specific details (where the ships and fires are) come in
// an "art" description, so this file never needs to know which picture it is showing.

const TAU = Math.PI * 2;
const EDGE = 24;               // spare picture (screen pixels) on the left and right for the waves
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const random = (min, max) => min + Math.random() * (max - min);

// A soft grey puff, drawn once and reused for every bit of smoke.
function makeSmokeSprite() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const puff = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  puff.addColorStop(0, "rgba(38,34,36,0.9)");
  puff.addColorStop(0.5, "rgba(30,28,30,0.45)");
  puff.addColorStop(1, "rgba(20,20,22,0)");
  g.fillStyle = puff;
  g.fillRect(0, 0, 128, 128);
  return c;
}

// Cuts a ship out of the picture with soft edges, so it can rock on the waves by itself.
function makeShipSprite(image, ship) {
  const c = document.createElement("canvas");
  c.width = ship.w;
  c.height = ship.h;
  const g = c.getContext("2d");
  g.drawImage(image, ship.x, ship.y, ship.w, ship.h, 0, 0, ship.w, ship.h);
  g.globalCompositeOperation = "destination-in";
  g.save();
  g.translate(ship.w / 2, ship.h * 0.5);
  g.scale(1, ship.h / ship.w);
  const mask = g.createRadialGradient(0, 0, ship.w * 0.3, 0, 0, ship.w * 0.5);
  mask.addColorStop(0, "rgba(0,0,0,1)");
  mask.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = mask;
  g.fillRect(-ship.w / 2, -ship.w / 2, ship.w, ship.w);
  g.restore();
  return c;
}

// Keeps only the bright metal letters of a title painted in the picture.
function makeTitleMask(image, title) {
  try {
    const c = document.createElement("canvas");
    c.width = title.w;
    c.height = title.h;
    const g = c.getContext("2d");
    g.drawImage(image, title.x, title.y, title.w, title.h, 0, 0, title.w, title.h);
    const pixels = g.getImageData(0, 0, title.w, title.h);
    const d = pixels.data;
    for (let i = 0; i < d.length; i += 4) {
      const light = (0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]) / 255;
      d[i] = 255; d[i + 1] = 240; d[i + 2] = 200;
      d[i + 3] = Math.max(0, Math.min(255, (light - 0.42) * 900));
    }
    g.putImageData(pixels, 0, 0);
    return c;
  } catch (error) {
    return null;
  }
}

// art: { url, width, height, horizon, ships[], title?, fires[], smoke[], cannons[] }
// options.overlay(ctx, width, height, framing): draws extra shading on top (optional).
// options.framing: { zoom, focusX, at } - where to move the camera when framing is 1.
export function createLiveScene(canvas, art, options = {}) {
  const ctx = canvas.getContext("2d");
  const smokeSprite = makeSmokeSprite();

  let width = 0;
  let height = 0;
  let view = { scale: 1, x: 0, y: 0 };
  let picture = null;
  let shipSprites = [];
  let titleMask = null;
  let running = false;
  let time = random(0, 50);
  let framing = 0;
  let framingTarget = 0;
  let lastFrame = performance.now();

  let drops = [];
  let ripples = [];
  let smoke = [];
  let embers = [];
  let fireballs = [];
  let flashes = [];
  const lightning = { flash: 0, bolt: null, next: random(3, 6) };
  let nextFireball = 1;
  let nextCannon = 1.5;
  const smokeTimers = art.smoke.map(() => Math.random() * 0.2);

  // ---------- fitting the picture to the screen ----------

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = canvas.clientWidth || window.innerWidth;
    height = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const count = Math.round((width * height) / 4200);
    drops = Array.from({ length: count }, () => ({
      x: Math.random() * width, y: Math.random() * height,
      speed: random(700, 1200), length: random(10, 26), near: Math.random() < 0.25
    }));
  }

  // Fill the screen with the picture. Extra height is cut mostly from the bottom (the sea),
  // never from a title painted at the top. With framing, the camera zooms and moves sideways.
  function updateView() {
    const f = options.framing || { zoom: 0, focusX: art.width / 2, at: 0.5 };
    const breathe = reduceMotion ? 0 : Math.sin(time * 0.15) * 0.006;
    const zoom = 1 + f.zoom * framing;
    const scale = Math.max((width + EDGE * 2) / art.width, height / art.height) * (1 + breathe) * zoom;
    const extraWidth = art.width * scale - width;
    const extraHeight = art.height * scale - height;
    const keepTop = art.title ? Math.max(0, art.title.y * scale - 12) : extraHeight * 0.3;
    const centredX = -extraWidth / 2;
    const focusedX = width * (width < 760 ? 0.5 : f.at) - f.focusX * scale;
    view = {
      scale: scale,
      x: centredX + (focusedX - centredX) * framing + (reduceMotion ? 0 : Math.sin(time * 0.11) * 6),
      y: -Math.min(extraHeight * 0.15, keepTop) + (reduceMotion ? 0 : Math.cos(time * 0.09) * 3)
    };
    view.y = Math.min(0, Math.max(height - art.height * scale, view.y));
    view.x = Math.min(0, Math.max(width - art.width * scale, view.x));
  }
  const sx = (x) => view.x + x * view.scale;     // picture x -> screen x
  const sy = (y) => view.y + y * view.scale;     // picture y -> screen y

  // ---------- the picture: sky still, sea moving in strips, ships rocking ----------

  function drawPicture() {
    ctx.drawImage(picture, 0, 0, art.width, art.horizon, view.x, view.y, art.width * view.scale, art.horizon * view.scale);
    const strip = 3;
    for (let y = art.horizon; y < art.height; y += strip) {
      const depth = (y - art.horizon) / (art.height - art.horizon);
      const amp = (0.6 + depth * 5) * view.scale;
      const shift = reduceMotion ? 0 : Math.sin(y * 0.05 + time * 1.7) * amp + Math.sin(y * 0.13 - time * 2.6) * amp * 0.35;
      const lift = reduceMotion ? 0 : Math.sin(time * 1.2 + depth * 4) * depth * 2.5 * view.scale;
      ctx.drawImage(picture, 0, y, art.width, strip + 1,
        view.x + shift, view.y + y * view.scale + lift, art.width * view.scale, (strip + 1) * view.scale);
    }
  }

  // Draws each ship rocking; returns how far each one bobbed (for its cannon flashes).
  function drawShips() {
    const bobs = [];
    art.ships.forEach((ship, i) => {
      const phase = i * 1.7;
      const bob = reduceMotion ? 0 : Math.sin(time * 1.1 + phase) * 4 * view.scale * (ship.rock || 1);
      const roll = reduceMotion ? 0 : Math.sin(time * 0.9 + phase) * 0.014 * (ship.rock || 1);
      bobs.push(bob);
      ctx.save();
      ctx.translate(sx(ship.pivotX), sy(ship.pivotY) + bob);
      ctx.rotate(roll);
      ctx.drawImage(shipSprites[i],
        (ship.x - ship.pivotX) * view.scale, (ship.y - ship.pivotY) * view.scale,
        ship.w * view.scale, ship.h * view.scale);
      ctx.restore();

      // Foam churning around the hull.
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const span = ship.w * 0.35;
      for (let k = 0; k < 6; k++) {
        const fx = sx(ship.pivotX + Math.sin(time * 2 + k + phase) * span * 0.4 + (k - 3) * span * 0.15);
        const fy = sy(ship.pivotY + Math.sin(time * 3 + k * 2) * 4) + bob;
        ctx.fillStyle = "rgba(200,220,225," + (0.05 + 0.04 * Math.sin(time * 4 + k)) + ")";
        ctx.beginPath();
        ctx.ellipse(fx, fy, span * 0.18 * view.scale, 7 * view.scale, 0, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    });
    return bobs;
  }

  function drawTitleShine() {
    if (!titleMask) return;
    const t = art.title;
    const cycle = (time % 5.5) / 1.6;
    if (cycle > 1) return;
    const c = drawTitleShine.canvas || (drawTitleShine.canvas = document.createElement("canvas"));
    c.width = t.w;
    c.height = t.h;
    const g = c.getContext("2d");
    g.drawImage(titleMask, 0, 0);
    g.globalCompositeOperation = "source-in";
    const x = -120 + cycle * (t.w + 240);
    const band = g.createLinearGradient(x - 70, 0, x + 70, t.h);
    band.addColorStop(0, "rgba(255,240,200,0)");
    band.addColorStop(0.5, "rgba(255,240,200,0.75)");
    band.addColorStop(1, "rgba(255,240,200,0)");
    g.fillStyle = band;
    g.fillRect(0, 0, t.w, t.h);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(c, sx(t.x), sy(t.y), t.w * view.scale, t.h * view.scale);
    ctx.restore();
  }

  // ---------- rain ----------

  function updateRain(seconds) {
    for (const drop of drops) {
      drop.y += drop.speed * seconds * (drop.near ? 1.3 : 1);
      drop.x -= drop.speed * 0.28 * seconds;
      if (drop.y > height || drop.x < -30) {
        if (drop.y > sy(art.horizon + 40) && ripples.length < 140 && Math.random() < 0.3) {
          ripples.push({ x: drop.x, y: Math.min(drop.y, height - 4), life: 0.5 });
        }
        drop.y = random(-60, 0);
        drop.x = random(0, width + 200);
      }
    }
    for (const ripple of ripples) ripple.life -= seconds;
    ripples = ripples.filter((ripple) => ripple.life > 0);
  }

  function drawRain() {
    ctx.lineCap = "round";
    for (const near of [false, true]) {
      ctx.strokeStyle = near ? "rgba(200,215,225,0.42)" : "rgba(180,200,215,0.22)";
      ctx.lineWidth = near ? 1.6 : 1;
      ctx.beginPath();
      for (const drop of drops) {
        if (drop.near !== near) continue;
        const length = drop.length * (near ? 1.6 : 1);
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x + length * 0.28, drop.y - length);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(200,215,225,0.25)";
    ctx.lineWidth = 1;
    for (const ripple of ripples) {
      const r = (0.5 - ripple.life) * 16 + 1;
      ctx.globalAlpha = ripple.life * 2;
      ctx.beginPath();
      ctx.ellipse(ripple.x, ripple.y, r, r * 0.3, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ---------- smoke, fire and embers ----------

  function updateSmoke(seconds) {
    art.smoke.forEach((source, i) => {
      smokeTimers[i] -= seconds;
      if (smokeTimers[i] <= 0) {
        smokeTimers[i] = source.rate;
        smoke.push({
          x: source.x + random(-8, 8), y: source.y + random(-4, 4),
          vx: random(10, 22), vy: random(-26, -16),
          size: random(18, 30) * source.size, grow: random(14, 22) * source.size,
          life: random(5, 8), age: 0
        });
      }
    });
    for (const puff of smoke) {
      puff.age += seconds;
      puff.x += puff.vx * seconds;
      puff.y += puff.vy * seconds;
      puff.vx += 3 * seconds;
      puff.size += puff.grow * seconds;
    }
    smoke = smoke.filter((puff) => puff.age < puff.life);
  }

  function drawSmoke() {
    for (const puff of smoke) {
      const fadeIn = Math.min(1, puff.age / 0.8);
      const fadeOut = 1 - puff.age / puff.life;
      ctx.globalAlpha = 0.55 * fadeIn * fadeOut;
      const size = puff.size * view.scale;
      ctx.drawImage(smokeSprite, sx(puff.x) - size / 2, sy(puff.y) - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  function drawFires(seconds) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const fire of art.fires) {
      const flicker = 0.55 + 0.25 * Math.sin(time * 13 + fire.x) + 0.2 * Math.sin(time * 7.3 + fire.y);
      const r = 46 * fire.size * view.scale * (0.9 + flicker * 0.2);
      const glow = ctx.createRadialGradient(sx(fire.x), sy(fire.y), 0, sx(fire.x), sy(fire.y), r);
      glow.addColorStop(0, "rgba(255,170,60," + (0.32 * flicker) + ")");
      glow.addColorStop(1, "rgba(255,90,20,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(sx(fire.x) - r, sy(fire.y) - r, r * 2, r * 2);
      if (Math.random() < seconds * 9 * fire.size) {
        embers.push({ x: fire.x + random(-10, 10), y: fire.y, vx: random(-6, 16), vy: random(-50, -25), life: random(1, 2.2), age: 0 });
      }
    }
    for (const ember of embers) {
      ember.age += seconds;
      ember.x += (ember.vx + Math.sin(time * 4 + ember.y) * 8) * seconds;
      ember.y += ember.vy * seconds;
      ctx.globalAlpha = Math.max(0, 1 - ember.age / ember.life);
      ctx.fillStyle = "#ffb84d";
      ctx.beginPath();
      ctx.arc(sx(ember.x), sy(ember.y), 1.3 * Math.max(1, view.scale), 0, TAU);
      ctx.fill();
    }
    embers = embers.filter((ember) => ember.age < ember.life);
    ctx.restore();
  }

  // ---------- fireballs, cannons and lightning ----------

  function updateFireballs(seconds) {
    nextFireball -= seconds;
    if (nextFireball <= 0) {
      nextFireball = random(0.8, 2.4);
      const fromRight = Math.random() < 0.6;
      fireballs.push({
        x: fromRight ? random(art.width * 0.5, art.width) : random(-40, art.width * 0.36), y: random(-30, 80),
        vx: fromRight ? random(-260, -170) : random(170, 260), vy: random(150, 230),
        age: 0, life: random(1.1, 1.8), trail: []
      });
    }
    for (const ball of fireballs) {
      ball.age += seconds;
      ball.x += ball.vx * seconds;
      ball.y += ball.vy * seconds;
      ball.trail.unshift({ x: ball.x, y: ball.y });
      if (ball.trail.length > 14) ball.trail.pop();
    }
    fireballs = fireballs.filter((ball) => ball.age < ball.life && ball.y < art.horizon - 10);
  }

  function drawFireballs() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const ball of fireballs) {
      const fade = Math.min(1, (ball.life - ball.age) * 2);
      for (let i = ball.trail.length - 1; i >= 0; i--) {
        const p = ball.trail[i];
        const k = 1 - i / ball.trail.length;
        ctx.globalAlpha = 0.5 * k * fade;
        ctx.fillStyle = i < 3 ? "#ffe2a0" : "#ff7a2a";
        ctx.beginPath();
        ctx.arc(sx(p.x), sy(p.y), (1.5 + 4 * k) * view.scale, 0, TAU);
        ctx.fill();
      }
      const glow = ctx.createRadialGradient(sx(ball.x), sy(ball.y), 0, sx(ball.x), sy(ball.y), 26 * view.scale);
      glow.addColorStop(0, "rgba(255,200,120," + (0.6 * fade) + ")");
      glow.addColorStop(1, "rgba(255,100,30,0)");
      ctx.globalAlpha = 1;
      ctx.fillStyle = glow;
      ctx.fillRect(sx(ball.x) - 26 * view.scale, sy(ball.y) - 26 * view.scale, 52 * view.scale, 52 * view.scale);
    }
    ctx.restore();
  }

  function updateCannons(seconds) {
    if (art.cannons.length === 0) return;
    nextCannon -= seconds;
    if (nextCannon <= 0) {
      nextCannon = random(0.7, 2.2);
      const gun = art.cannons[Math.floor(Math.random() * art.cannons.length)];
      flashes.push({ x: gun.x, y: gun.y, dir: gun.dir, ship: gun.ship, age: 0 });
      for (let i = 0; i < 4; i++) {
        smoke.push({ x: gun.x + gun.dir * random(4, 20), y: gun.y + random(-6, 4), vx: gun.dir * random(12, 30), vy: random(-12, -4),
          size: random(10, 16), grow: random(16, 26), life: random(1.6, 2.6), age: 0 });
      }
    }
    for (const flash of flashes) flash.age += seconds;
    flashes = flashes.filter((flash) => flash.age < 0.35);
  }

  function drawCannonFlashes(bobs) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const flash of flashes) {
      const k = 1 - flash.age / 0.35;
      const x = sx(flash.x);
      const y = sy(flash.y) + (flash.ship === undefined ? 0 : bobs[flash.ship] || 0);
      const r = 70 * view.scale * (0.6 + k * 0.6);
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
      glow.addColorStop(0, "rgba(255,240,190," + (0.9 * k) + ")");
      glow.addColorStop(0.3, "rgba(255,170,60," + (0.5 * k) + ")");
      glow.addColorStop(1, "rgba(255,90,20,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.strokeStyle = "rgba(255,230,160," + k + ")";
      ctx.lineWidth = 3 * view.scale;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + flash.dir * 46 * view.scale * (1.2 - k * 0.5), y - 6 * view.scale);
      ctx.stroke();
    }
    ctx.restore();
  }

  function updateLightning(seconds) {
    lightning.next -= seconds;
    lightning.flash = Math.max(0, lightning.flash - seconds * 3.2);
    if (lightning.bolt) {
      lightning.bolt.age += seconds;
      if (lightning.bolt.age > 0.22) lightning.bolt = null;
    }
    if (lightning.next <= 0) {
      lightning.next = random(5, 10);
      lightning.flash = 1;
      const points = [];
      let x = random(150, art.width - 150);
      let y = -10;
      const end = random(180, art.horizon - 80);
      while (y < end) {
        points.push({ x: x, y: y });
        x += random(-28, 28);
        y += random(18, 34);
      }
      lightning.bolt = { points: points, age: 0 };
    }
  }

  function drawLightning() {
    if (lightning.flash > 0) {
      const flicker = lightning.flash * (0.7 + 0.3 * Math.sin(time * 60));
      const sky = ctx.createLinearGradient(0, 0, 0, sy(art.horizon + 80));
      sky.addColorStop(0, "rgba(200,220,255," + (0.35 * flicker) + ")");
      sky.addColorStop(1, "rgba(200,220,255," + (0.08 * flicker) + ")");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);
    }
    if (lightning.bolt) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.shadowColor = "rgba(180,210,255,1)";
      ctx.shadowBlur = 18;
      ctx.strokeStyle = "rgba(235,245,255,0.95)";
      ctx.lineWidth = 2.2 * Math.max(1, view.scale);
      ctx.beginPath();
      lightning.bolt.points.forEach((p, i) => (i === 0 ? ctx.moveTo(sx(p.x), sy(p.y)) : ctx.lineTo(sx(p.x), sy(p.y))));
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawAtmosphere() {
    const mistY = sy(art.horizon - 20);
    const mist = ctx.createLinearGradient(0, mistY, 0, mistY + 90 * view.scale);
    mist.addColorStop(0, "rgba(160,170,175,0)");
    mist.addColorStop(0.5, "rgba(160,170,175," + (0.07 + 0.03 * Math.sin(time * 0.5)) + ")");
    mist.addColorStop(1, "rgba(160,170,175,0)");
    ctx.fillStyle = mist;
    ctx.fillRect(0, mistY, width, 90 * view.scale);

    if (options.overlay) options.overlay(ctx, width, height, framing);

    const vignette = ctx.createRadialGradient(width / 2, height * 0.45, Math.min(width, height) * 0.35, width / 2, height / 2, Math.hypot(width, height) * 0.62);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  }

  // ---------- the animation loop ----------

  function frame(now) {
    if (!running) return;
    const seconds = reduceMotion ? 0 : Math.max(0, Math.min(0.1, (now - lastFrame) / 1000));
    lastFrame = now;
    time += seconds;
    framing += (framingTarget - framing) * Math.min(1, reduceMotion ? 1 : seconds * 1.6);
    updateView();

    ctx.fillStyle = "#05090c";
    ctx.fillRect(0, 0, width, height);
    if (picture) {
      updateSmoke(seconds);
      updateFireballs(seconds);
      updateCannons(seconds);
      updateLightning(seconds);
      updateRain(seconds);

      drawPicture();
      drawFires(seconds);
      drawFireballs();
      drawSmoke();
      const bobs = drawShips();
      drawCannonFlashes(bobs);
      drawTitleShine();
      drawAtmosphere();
      drawLightning();
      drawRain();
    }
    requestAnimationFrame(frame);
  }

  return {
    // Loads the picture. Resolves true when it is ready, false if it could not be loaded.
    load() {
      return new Promise((resolve) => {
        const image = new Image();
        image.onload = () => {
          picture = image;
          shipSprites = art.ships.map((ship) => makeShipSprite(image, ship));
          titleMask = art.title ? makeTitleMask(image, art.title) : null;
          resolve(true);
        };
        image.onerror = () => resolve(false);
        image.src = art.url;
      });
    },
    start() {
      if (running) return;
      running = true;
      resize();
      window.addEventListener("resize", resize);
      lastFrame = performance.now();
      requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      window.removeEventListener("resize", resize);
    },
    isRunning() {
      return running;
    },
    // 0 = the normal view, 1 = the camera moved by options.framing.
    setFraming(value) {
      framingTarget = value;
    }
  };
}
