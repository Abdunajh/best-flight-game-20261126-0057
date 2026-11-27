// Island Hopper — small shared helpers: a seeded random stream so every
// level builds the same islands, rings and clouds on every run, plus the
// clamps and easing the flight code leans on.
'use strict';

function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v, lo, hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Vertical scale: the sky is tall in feet but short on screen, so heights
// are squeezed to 28% — the whole flight band (sea to the highest ring)
// fits in the 720 px frame with the sea line fixed at SEA_SCREEN_Y.
const VSCALE = 0.28;
const SEA_SCREEN_Y = 560;
function worldToScreenY(wy) {
  return SEA_SCREEN_Y + wy * VSCALE;
}

// Pick one entry from a weighted list of [value, weight] pairs.
function pickWeighted(rng, entries) {
  let total = 0;
  for (let i = 0; i < entries.length; i++) total += entries[i][1];
  let roll = rng() * total;
  for (let i = 0; i < entries.length; i++) {
    roll -= entries[i][1];
    if (roll <= 0) return entries[i][0];
  }
  return entries[entries.length - 1][0];
}

// Smooth a value toward a target: rate is the fraction closed per second.
function approach(v, target, rate, dt) {
  const t = 1 - Math.pow(1 - rate, dt * 60);
  return v + (target - v) * t;
}

// Distance from a point to a line segment, for ring-pass and runway checks.
function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
  t = clamp(t, 0, 1);
  const cx = x1 + t * dx, cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}
