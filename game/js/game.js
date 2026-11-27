// Island Hopper — the game itself: states, input, the fixed-step loop,
// rings and landings, lives and levels, and the scene presets the
// screenshot runs use (the same spawn code normal play uses).
'use strict';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const game = {
  state: 'title',      // title | playing | paused | leveldone | gameover
  level: 1,
  levelData: null,
  plane: null,
  cam: { x: 0, y: -400 },
  score: 0,
  lives: 3,
  ringsGot: 0,
  ringsTotal: 0,
  banner: '',
  bannerSub: '',
  bannerColor: '#ffd75e',
  bannerT: 0,
  popups: [],
  shake: 0,
  time: 0,
  levelDoneT: 0,
  crashT: 0,
};

const input = {
  pitchUp: false, pitchDown: false,
  turnLeft: false, turnRight: false,
  throttleUp: false, throttleDown: false,
  boost: false,
};

function showBanner(text, sub, color, dur) {
  game.banner = text;
  game.bannerSub = sub || '';
  game.bannerColor = color || '#ffd75e';
  game.bannerT = dur || 2.2;
}

function addPopup(x, y, text, color) {
  game.popups.push({ x: x, y: y, text: text, color: color || '#ffd75e', life: 1.4, max: 1.4 });
}

function startLevel(levelNum, keepScore) {
  game.level = levelNum;
  game.levelData = buildLevel(levelNum);
  game.plane = newPlane(game.levelData);
  game.ringsGot = 0;
  game.ringsTotal = game.levelData.rings.filter(r => r.kind === 'gold').length;
  game.popups = [];
  game.cam.x = 0;
  if (!keepScore) { game.score = 0; game.lives = 3; }
  game.plane.fuel = 100;
  game.plane.damage = 0;
}

// Scene presets for screenshots: the same state a pilot reaches by
// playing, set up directly. ?scene=takeoff|cruise|landing|score
// Storms are nudged WEST, behind the plane's eastward flight path, so a
// shoved storm cannot land on the route ahead.
function clearStormsNear(L, x, y, radius) {
  for (const st of L.storms) {
    if (Math.abs(st.x - x) < radius && Math.abs(st.y - y) < radius) st.x -= radius + 260;
  }
}

function applyScene(name) {
  const L = game.levelData;
  const p = game.plane;
  if (name === 'takeoff') {
    p.throttle = 0.62;
    p.speed = 62;
    showBanner('LEVEL 1 — ' + L.islands[0].name + ' to ' + L.islands[L.islands.length - 1].name, 'Full throttle, lift off, chase the rings!', '#ffd75e', 3.5);
  } else if (name === 'cruise') {
    p.x = 5200;
    p.y = -980;
    p.speed = 178;
    p.throttle = 0.72;
    p.pitch = 3;
    p.grounded = false;
    p.fuel = 78;
    game.score = 500;
    game.ringsGot = 5;
    for (const r of L.rings) if (r.kind === 'gold' && r.x < 5200) r.got = true;
    const next = L.rings.find(r => r.kind === 'gold' && !r.got);
    // Parked well ahead so it is still in frame (and uncollected) at shot time.
    if (next) { next.x = p.x + 900; next.y = p.y - 40; }
    clearStormsNear(L, p.x, p.y, 1100);
    showBanner('', '', '#ffd75e', 0);
  } else if (name === 'landing') {
    const dest = L.destRunway;
    // Approach from the west, high enough to clear the ground between the
    // plane and the strip, so the blue runway sits in frame ahead. The
    // banner is short so it has faded by the time the shot is taken.
    const px = dest.x - 520;
    let maxG = 0;
    for (let x = px; x <= dest.x; x += 40) maxG = Math.max(maxG, groundHeightAt(L, x));
    p.x = px;
    p.y = -(maxG + 150);
    p.speed = 118;
    p.throttle = 0.34;
    p.pitch = -5;
    p.grounded = false;
    p.fuel = 41;
    game.score = 1400;
    game.ringsGot = game.ringsTotal;
    for (const r of L.rings) if (r.kind === 'gold') r.got = true;
    clearStormsNear(L, p.x, p.y, 900);
    showBanner('FINAL APPROACH', 'Gear down, throttle back, kiss the strip', '#bcd8ff', 1.2);
  } else if (name === 'score') {
    p.x = 6100;
    p.y = -1150;
    p.speed = 192;
    p.throttle = 0.8;
    p.pitch = 6;
    p.grounded = false;
    p.fuel = 64;
    game.score = 2400;
    game.ringsGot = 8;
    for (const r of L.rings) if (r.kind === 'gold' && r.x < 6100) r.got = true;
    clearStormsNear(L, p.x, p.y, 900);
    showBanner('RING +100', 'Eight rings down — keep hopping!', '#ffd75e', 2.4);
  }
  game.state = 'playing';
  document.getElementById('overlay').classList.add('hidden');
}

// ---- Input ----

const KEYMAP = {
  ArrowUp: 'pitchUp', ArrowDown: 'pitchDown',
  ArrowLeft: 'throttleDown', ArrowRight: 'throttleUp',
  KeyA: 'turnLeft', KeyD: 'turnRight',
  KeyW: 'throttleUp', KeyS: 'throttleDown',
  Space: 'boost',
};

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') e.preventDefault();
  if (e.code === 'KeyP' && (game.state === 'playing' || game.state === 'paused')) {
    togglePause();
    return;
  }
  if (e.code === 'KeyM') { AudioEngine.toggleMute(); return; }
  if (e.code === 'KeyR' && game.state !== 'title') { restartRun(); return; }
  const name = KEYMAP[e.code];
  if (name) { input[name] = true; AudioEngine.start(); }
});
window.addEventListener('keyup', (e) => {
  const name = KEYMAP[e.code];
  if (name) input[name] = false;
});
canvas.addEventListener('mousedown', () => { input.boost = true; AudioEngine.start(); });
window.addEventListener('mouseup', () => { input.boost = false; });

document.getElementById('startBtn').addEventListener('click', () => {
  AudioEngine.start();
  document.getElementById('overlay').classList.add('hidden');
  game.state = 'playing';
  showBanner('LEVEL 1 — ' + game.levelData.islands[0].name, 'Fly the rings, land the mail!', '#ffd75e', 2.6);
});
document.getElementById('resumeBtn').addEventListener('click', togglePause);
document.getElementById('againBtn').addEventListener('click', restartRun);

function togglePause() {
  if (game.state === 'playing') {
    game.state = 'paused';
    document.getElementById('pauseOverlay').classList.remove('hidden');
  } else if (game.state === 'paused') {
    game.state = 'playing';
    document.getElementById('pauseOverlay').classList.add('hidden');
  }
}

function restartRun() {
  document.getElementById('overOverlay').classList.add('hidden');
  document.getElementById('pauseOverlay').classList.add('hidden');
  startLevel(1, false);
  game.state = 'playing';
  showBanner('LEVEL 1', 'Fly the rings, land the mail!', '#ffd75e', 2.2);
}

// ---- Update ----

function collectRings() {
  const p = game.plane;
  const L = game.levelData;
  for (const ring of L.rings) {
    if (ring.got) continue;
    const d = Math.hypot(p.x - ring.x, p.y - ring.y);
    if (d < ring.r - 6) {
      ring.got = true;
      if (ring.kind === 'gold') {
        game.score += 100;
        game.ringsGot++;
        AudioEngine.ringChime();
        addPopup(ring.x, ring.y - 70, '+100', '#ffd75e');
        if (game.ringsGot === game.ringsTotal) {
          showBanner('ALL RINGS!', 'Now land on the blue delivery strip', '#bcd8ff', 2.6);
        }
      } else {
        p.fuel = clamp(p.fuel + 30, 0, 100);
        game.score += 25;
        AudioEngine.ringChime();
        addPopup(ring.x, ring.y - 70, '+30 FUEL', '#5fd97a');
      }
    }
  }
}

function onLanded(out) {
  const p = game.plane;
  const rw = out.runway;
  p.fuel = 100;
  p.damage = 0;
  AudioEngine.landThud();
  if (rw.kind === 'dest' && game.ringsGot === game.ringsTotal) {
    const bonus = 500 + (out.perfect ? 200 : 0) + Math.round(p.fuel * 0) + game.lives * 50;
    game.score += bonus;
    showBanner('LEVEL COMPLETE!', (out.perfect ? 'Perfect landing! ' : '') + '+' + bonus + ' — mail delivered', '#5fd97a', 2.6);
    game.state = 'leveldone';
    game.levelDoneT = 2.6;
  } else if (rw.kind === 'dest') {
    const left = game.ringsTotal - game.ringsGot;
    showBanner('DELIVERY STRIP', left + ' ring' + (left === 1 ? '' : 's') + ' still out there — take off again!', '#bcd8ff', 2.6);
    game.score += out.perfect ? 200 : 100;
  } else {
    showBanner('LANDED — REFUELLED', rw.kind === 'start' ? 'Home strip. Full tank, go get the rings!' : 'Fuel strip. Full tank, keep hopping!', '#5fd97a', 2.2);
    game.score += out.perfect ? 200 : 100;
  }
}

function onCrashed(out) {
  const p = game.plane;
  AudioEngine.crashNoise();
  game.shake = 0.5;
  game.lives--;
  const why = out.reason === 'mountain' ? 'into a mountain'
    : out.reason === 'storm' ? 'in a storm cloud' : 'into the sea';
  if (game.lives > 0) {
    showBanner('CRASHED ' + why.toUpperCase(), game.lives + (game.lives === 1 ? ' life' : ' lives') + ' left — back to the home strip', '#ff8a7a', 2.4);
    game.state = 'leveldone';
    game.levelDoneT = 2.2;
    game.crashT = 1;
  } else {
    game.state = 'gameover';
    document.getElementById('overTitle').textContent = 'Run over';
    document.getElementById('overText').textContent =
      'The Kestrel went down ' + why + ' on level ' + game.level +
      '. Final score: ' + game.score + ' — ' + game.ringsGot + ' rings flown.';
    document.getElementById('overOverlay').classList.remove('hidden');
  }
}

// ---- Fixed-step loop and rendering ----

let lastT = 0;
let acc = 0;
const STEP = 1 / 60;

function update(dt) {
  game.time += dt;
  if (game.bannerT > 0) game.bannerT -= dt;
  if (game.shake > 0) game.shake -= dt;
  for (let i = game.popups.length - 1; i >= 0; i--) {
    const pop = game.popups[i];
    pop.life -= dt;
    pop.y -= 26 * dt;
    if (pop.life <= 0) game.popups.splice(i, 1);
  }
  const L = game.levelData;
  for (const st of L.storms) {
    st.x += st.drift * dt;
    if (st.x < 300) { st.x = 300; st.drift = Math.abs(st.drift); }
    if (st.x > L.width - 300) { st.x = L.width - 300; st.drift = -Math.abs(st.drift); }
  }
  if (game.state === 'leveldone') {
    game.levelDoneT -= dt;
    if (game.levelDoneT <= 0) {
      if (game.crashT === 1) {
        game.crashT = 0;
        startLevel(game.level, true);
        game.state = 'playing';
        showBanner('BACK IN THE AIR', 'Rings kept. Mind the mountains!', '#ffd75e', 2.2);
      } else {
        startLevel(game.level + 1, true);
        game.state = 'playing';
        showBanner('LEVEL ' + game.level, game.levelData.islands[0].name + ' to ' + game.levelData.islands[game.levelData.islands.length - 1].name, '#ffd75e', 2.6);
      }
    }
    return;
  }
  if (game.state !== 'playing') return;

  const out = {};
  const ev = stepPlane(game.plane, input, L, dt, out);
  collectRings();
  AudioEngine.update(game.plane.throttle, game.plane.speed, !game.plane.grounded);

  // Camera follows the plane horizontally only: the vertical scale keeps
  // the whole flight band in frame, sea line fixed at SEA_SCREEN_Y.
  const p = game.plane;
  game.cam.x = clamp(p.x - 470, 0, L.width - 1280);
  if (game.shake > 0) {
    game.cam.x += (Math.random() - 0.5) * 14 * game.shake;
  }

  if (ev === 'landed') onLanded(out);
  else if (ev === 'crashed') onCrashed(out);
  else if (ev === 'takeoff') addPopup(p.x + 30, p.y - 80, 'AIRBORNE!', '#ffffff');
}

function render() {
  const L = game.levelData;
  ctx.clearRect(0, 0, 1280, 720);
  drawSky(ctx, game.cam, L, game.time);
  drawDecoClouds(ctx, game.cam, L, game.time);
  drawSeaAndIslands(ctx, game.cam, L, game.time);
  drawRunways(ctx, game.cam, L);
  drawRings(ctx, game.cam, L, game.time);
  drawStorms(ctx, game.cam, L, game.time);
  drawPlane(ctx, game.cam, game.plane, L, game.time);
  if (game.state !== 'title') drawHUD(ctx, game);
}

function frame(t) {
  requestAnimationFrame(frame);
  const now = t / 1000;
  if (!lastT) lastT = now;
  let elapsed = Math.min(now - lastT, 0.25);
  lastT = now;
  acc += elapsed;
  while (acc >= STEP) {
    update(STEP);
    acc -= STEP;
  }
  render();
}

// ---- Boot ----
window.__game = game;
startLevel(1, false);
const scene = new URLSearchParams(location.search).get('scene');
if (scene) {
  applyScene(scene);
} else {
  render();
}
requestAnimationFrame(frame);
