// stats.js - the Statistics page: charts drawn as SVG by hand (no chart library).
//   - score of each of the last 30 battles (line)
//   - battles per day for the last 14 days (bars)
//   - favourite stages (horizontal bars)
//   - sonar accuracy (a ring)
import * as api from "./api.js";

const $ = (id) => document.getElementById(id);
const SVG = "http://www.w3.org/2000/svg";

function svg(tag, attributes, text) {
  const element = document.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  if (text !== undefined) element.textContent = text;
  return element;
}

function niceMax(value) {
  if (value <= 0) return 1;
  const power = Math.pow(10, Math.floor(Math.log10(value)));
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (step * power >= value) return step * power;
  }
  return 10 * power;
}

// Line chart of scores.
function lineChart(box, points) {
  const W = 1000, H = 250, L = 60, R = 16, T = 14, B = 30;
  const chart = svg("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Score of each recent battle" });
  const max = niceMax(Math.max(...points.map((p) => p.score), 100));     // at least 0-100 on the axis
  for (let i = 0; i <= 4; i++) {
    const y = T + (H - T - B) * (1 - i / 4);
    chart.append(svg("line", { x1: L, x2: W - R, y1: y, y2: y, class: "grid" }));
    chart.append(svg("text", { x: L - 8, y: y + 4, class: "axis", "text-anchor": "end" }, Math.round(max * i / 4).toLocaleString("en-GB")));
  }
  const x = (i) => L + (points.length === 1 ? (W - L - R) / 2 : (W - L - R) * i / (points.length - 1));
  const y = (v) => T + (H - T - B) * (1 - v / max);
  if (points.length > 1) {
    const d = points.map((p, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(p.score).toFixed(1)).join(" ");
    chart.append(svg("path", { d: d + " L" + x(points.length - 1) + " " + y(0) + " L" + x(0) + " " + y(0) + "Z", class: "area" }));
    chart.append(svg("path", { d: d, class: "line" }));
  }
  points.forEach((p, i) => {
    const dot = svg("circle", { cx: x(i), cy: y(p.score), r: 4, class: "dot" });
    dot.append(svg("title", {}, new Date(p.playedAt).toLocaleDateString() + ": " + p.score.toLocaleString("en-GB") + " points, wave " + p.wave));
    chart.append(dot);
  });
  chart.append(svg("text", { x: L, y: H - 8, class: "axis" }, "Oldest"));
  chart.append(svg("text", { x: W - R, y: H - 8, class: "axis", "text-anchor": "end" }, "Latest"));
  box.replaceChildren(chart);
}

// Bars: battles per day.
function barChart(box, days) {
  const W = 340, H = 210, L = 26, R = 6, T = 12, B = 30;
  const chart = svg("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Battles per day for the last 14 days" });
  const max = Math.max(1, ...days.map((d) => d.battles));
  const slot = (W - L - R) / days.length;
  for (let i = 0; i <= max; i += Math.max(1, Math.ceil(max / 4))) {
    const y = T + (H - T - B) * (1 - i / max);
    chart.append(svg("line", { x1: L, x2: W - R, y1: y, y2: y, class: "grid" }));
    chart.append(svg("text", { x: L - 6, y: y + 4, class: "axis", "text-anchor": "end" }, String(i)));
  }
  days.forEach((d, i) => {
    const h = (H - T - B) * d.battles / max;
    const bar = svg("rect", { x: L + i * slot + slot * 0.18, y: H - B - h, width: slot * 0.64, height: Math.max(h, d.battles ? 2 : 0), rx: 3, class: "bar" });
    bar.append(svg("title", {}, d.day + ": " + d.battles + " battle" + (d.battles === 1 ? "" : "s")));
    chart.append(bar);
    if (i % 3 === 1 || i === days.length - 1) {
      const label = new Date(d.day + "T12:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" });
      chart.append(svg("text", { x: L + i * slot + slot / 2, y: H - 10, class: "axis", "text-anchor": "middle" }, label));
    }
  });
  box.replaceChildren(chart);
}

// Horizontal bars: favourite stages.
function stageBars(box, stages) {
  const list = stages.slice(0, 6);
  const max = Math.max(1, ...list.map((s) => s.battles));
  box.replaceChildren(...list.map((s) => {
    const row = document.createElement("div");
    row.className = "stat-hbar";
    const name = document.createElement("span");
    name.textContent = s.name;
    const track = document.createElement("span");
    track.className = "stat-hbar-track";
    const fill = document.createElement("i");
    fill.style.width = (100 * s.battles / max) + "%";
    track.append(fill);
    const count = document.createElement("b");
    count.textContent = s.battles;
    row.append(name, track, count);
    return row;
  }));
  if (!list.length) box.textContent = "No battles yet.";
}

// Ring: sonar accuracy.
function ring(box, percent) {
  const r = 52, c = 2 * Math.PI * r;
  const chart = svg("svg", { viewBox: "0 0 140 140", role: "img", "aria-label": "Sonar accuracy " + (percent === null ? "not known yet" : percent + " percent") });
  chart.append(svg("circle", { cx: 70, cy: 70, r: r, class: "ring-track" }));
  if (percent !== null) {
    chart.append(svg("circle", { cx: 70, cy: 70, r: r, class: "ring-fill", "stroke-dasharray": (c * percent / 100) + " " + c, transform: "rotate(-90 70 70)" }));
  }
  chart.append(svg("text", { x: 70, y: 78, class: "ring-text", "text-anchor": "middle" }, percent === null ? "-" : percent + "%"));
  box.replaceChildren(chart);
}

export async function showStats() {
  $("stats-message").textContent = "";
  try {
    const s = await api.getStats();
    $("st-games").textContent = s.totals.games;
    $("st-average").textContent = s.totals.averageScore.toLocaleString("en-GB");
    $("st-best").textContent = s.totals.bestScore.toLocaleString("en-GB");
    $("st-total").textContent = s.totals.totalScore.toLocaleString("en-GB");
    $("st-sunk").textContent = s.totals.sunk;
    $("st-combo").textContent = s.totals.bestCombo || "-";
    lineChart($("chart-scores"), s.recent);
    barChart($("chart-days"), s.perDay);
    stageBars($("chart-stages"), s.byStage);
    ring($("chart-sonar"), s.sonar.accuracy);
    $("st-sonar").textContent = s.sonar.solved + " of " + s.sonar.tried + " puzzles solved · " + s.sonar.chestsRight + " chest counts right · best streak " + s.sonar.bestStreak;
    const diff = { easy: 0, normal: 0, hard: 0 };
    for (const d of s.byDifficulty) diff[d.difficulty] = d.battles;
    $("st-difficulty").textContent = "Easy " + diff.easy + " · Normal " + diff.normal + " · Hard " + diff.hard;
    $("stats-empty").hidden = s.totals.games > 0;
  } catch (error) {
    $("stats-message").textContent = error.message;
  }
}
