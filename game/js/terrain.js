// Island Hopper — the world: one seeded level is a chain of tropical islands
// across a wide sea, with mountain peaks, flat runway strips, golden rings to
// fly through, drifting storm clouds and decorative clouds. The same seed
// always builds the same level, so screenshots and replays match.
'use strict';

// World units are feet: 1 px on the canvas is 1 ft of altitude or distance.
const WORLD = {
  seaLevel: 0,
  skyTop: -2800,
};

function buildLevel(level) {
  const rng = makeRng(20261127 + level * 7919);
  const width = 11500 + level * 1200;
  const islands = [];
  const islandCount = 6 + Math.min(level, 3);
  const gap = width / islandCount;
  const names = ['Palm Cay', 'Turtle Bay', 'Coral Point', 'Mango Isle', 'Heron Rock', 'Sandy Hook', 'Lagoon Key', 'Breeze Atoll', 'Sunset Rock'];

  for (let i = 0; i < islandCount; i++) {
    const cx = gap * (i + 0.5) + (rng() - 0.5) * gap * 0.35;
    const half = 420 + rng() * 480;
    const peaks = [];
    const peakCount = 1 + Math.floor(rng() * 3);
    for (let p = 0; p < peakCount; p++) {
      peaks.push({
        x: cx + (rng() - 0.5) * half * 1.3,
        h: 260 + rng() * (level >= 2 ? 520 : 140),
        w: 150 + rng() * 220,
      });
    }
    islands.push({
      name: names[i % names.length],
      x0: cx - half,
      x1: cx + half,
      peaks: peaks,
      runway: null,
    });
  }

  // Runways: the start strip on the first island, the destination strip on
  // the last island, and one emergency strip in the middle. A runway sits on
  // a flattened shelf of its island, clear of the peaks — with clear
  // corridors both ways, west for landing and east for takeoff, so no
  // strip ends in a mountainside.
  function placeRunway(island, kind) {
    let bestX = (island.x0 + island.x1) / 2;
    let bestScore = -1e9;
    for (let x = island.x0 + 190; x < island.x1 - 190; x += 40) {
      let clear = 1e9;
      for (const pk of island.peaks) {
        clear = Math.min(clear, Math.abs(x - pk.x) - pk.w);
      }
      let approachMax = 0;
      for (let t = x - 1100; t <= x; t += 40) {
        approachMax = Math.max(approachMax, groundHeightAt({ islands: islands }, t));
      }
      let takeoffMax = 0;
      for (let t = x; t <= x + 1100; t += 40) {
        takeoffMax = Math.max(takeoffMax, groundHeightAt({ islands: islands }, t));
      }
      const score = clear - approachMax - takeoffMax;
      if (score > bestScore) { bestScore = score; bestX = x; }
    }
    island.runway = { x: bestX, w: 340, kind: kind };
    return island.runway;
  }
  const startRunway = placeRunway(islands[0], 'start');
  const destRunway = placeRunway(islands[islands.length - 1], 'dest');
  const midRunway = placeRunway(islands[Math.floor(islands.length / 2)], 'mid');

  // Rings: golden scoring rings strung between the islands, plus green fuel
  // rings tucked low over the sea. Altitudes vary so the pilot must climb
  // and dive.
  const rings = [];
  const ringCount = 6 + level * 2;
  for (let i = 0; i < ringCount; i++) {
    const x = 900 + (width - 1800) * ((i + 0.5) / ringCount) + (rng() - 0.5) * 320;
    const y = -(280 + rng() * (level >= 2 ? 1500 : 1150));
    rings.push({ x: x, y: y, r: 58, kind: 'gold', got: false, phase: rng() * 6.28 });
  }
  for (let i = 0; i < 2 + Math.floor(level / 2); i++) {
    const x = 1600 + rng() * (width - 3200);
    rings.push({ x: x, y: -(160 + rng() * 420), r: 52, kind: 'fuel', got: false, phase: rng() * 6.28 });
  }

  // Storm clouds: dark, drifting hazards. Brushing one shakes the plane and
  // hurts it; the count grows with the level.
  const storms = [];
  const stormCount = 3 + level;
  for (let i = 0; i < stormCount; i++) {
    storms.push({
      x: 1400 + rng() * (width - 2800),
      y: -(500 + rng() * 1300),
      r: 95 + rng() * 55,
      drift: (rng() - 0.5) * 26,
      seed: rng() * 6.28,
    });
  }

  // Soft decorative clouds for the sky, and a far ridge line for depth.
  const decoClouds = [];
  for (let i = 0; i < 26; i++) {
    decoClouds.push({
      x: rng() * width,
      y: -(300 + rng() * 2200),
      s: 60 + rng() * 130,
      speed: 6 + rng() * 14,
    });
  }
  const ridge = [];
  for (let x = 0; x <= width; x += 260) {
    ridge.push(180 + rng() * 320);
  }

  return {
    level: level,
    width: width,
    islands: islands,
    rings: rings,
    storms: storms,
    decoClouds: decoClouds,
    ridge: ridge,
    startRunway: startRunway,
    destRunway: destRunway,
    midRunway: midRunway,
  };
}

// Height of the ground above sea level at world x (0 over open sea).
// Peaks overlap as a ridge: the tallest gaussian wins, so no mountain
// stacks into a cliff.
function groundHeightAt(level, x) {
  let h = 0;
  for (const isl of level.islands) {
    if (x < isl.x0 || x > isl.x1) continue;
    for (const pk of isl.peaks) {
      const d = (x - pk.x) / pk.w;
      h = Math.max(h, pk.h * Math.exp(-d * d * 1.6));
    }
    // A runway flattens its shelf to a gentle 26 ft.
    if (isl.runway && Math.abs(x - isl.runway.x) < isl.runway.w / 2 + 60) {
      const t = clamp(1 - Math.abs(x - isl.runway.x) / (isl.runway.w / 2 + 60), 0, 1);
      h = lerp(h, 26, t * t);
    }
  }
  return h;
}

function runwayAt(level, x) {
  for (const isl of level.islands) {
    if (isl.runway && Math.abs(x - isl.runway.x) < isl.runway.w / 2) return isl.runway;
  }
  return null;
}

// ---- Drawing ----

function drawSky(ctx, cam, level, time) {
  const w = 1280, h = 720;
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#3d8fd1');
  grad.addColorStop(0.55, '#7ec8ee');
  grad.addColorStop(0.8, '#bfe6f7');
  grad.addColorStop(1, '#dff3fb');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Sun with a soft halo, fixed in the sky.
  const sunX = 1050, sunY = 92;
  const halo = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 130);
  halo.addColorStop(0, 'rgba(255, 244, 180, 0.9)');
  halo.addColorStop(0.4, 'rgba(255, 226, 120, 0.35)');
  halo.addColorStop(1, 'rgba(255, 226, 120, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(sunX - 140, sunY - 140, 280, 280);
  ctx.fillStyle = '#fff3b0';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 34, 0, Math.PI * 2);
  ctx.fill();

  // Far ridge line along the sea, slow parallax, hazy blue.
  ctx.fillStyle = 'rgba(94, 138, 178, 0.55)';
  ctx.beginPath();
  ctx.moveTo(0, SEA_SCREEN_Y);
  const ridge = level.ridge;
  for (let i = 0; i < ridge.length; i++) {
    const rx = i * 260 - (cam.x * 0.25) % 260 - 260;
    const ry = SEA_SCREEN_Y - ridge[i] * VSCALE;
    ctx.lineTo(rx, ry);
  }
  ctx.lineTo(w, SEA_SCREEN_Y);
  ctx.closePath();
  ctx.fill();
}

function drawSeaAndIslands(ctx, cam, level, time) {
  const w = 1280, h = 720;
  const seaY = SEA_SCREEN_Y; // screen y of sea level (world y = 0)
  // Sea with slow animated sparkle.
  const sea = ctx.createLinearGradient(0, seaY, 0, h);
  sea.addColorStop(0, '#2a9db8');
  sea.addColorStop(0.25, '#1e7fa8');
  sea.addColorStop(1, '#0d5a80');
  ctx.fillStyle = sea;
  ctx.fillRect(0, seaY, w, h - seaY);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 26; i++) {
    const wx = ((i * 397 + time * 22) % (level.width + 600)) - 300;
    const sx = wx - cam.x;
    if (sx < -80 || sx > w + 80) continue;
    const sy = seaY + 8 + ((i * 53) % 46);
    const len = 26 + ((i * 31) % 40);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + len, sy);
    ctx.stroke();
  }

  // Islands: sand fringe, grass body, rock peaks, palm dots.
  for (const isl of level.islands) {
    const x0 = isl.x0 - cam.x, x1 = isl.x1 - cam.x;
    if (x1 < -50 || x0 > w + 50) continue;
    ctx.beginPath();
    ctx.moveTo(x0, seaY + 4);
    for (let x = isl.x0; x <= isl.x1; x += 24) {
      const gh = groundHeightAt(level, x);
      ctx.lineTo(x - cam.x, worldToScreenY(-gh));
    }
    ctx.lineTo(x1, seaY + 4);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, worldToScreenY(-700), 0, seaY + 4);
    g.addColorStop(0, '#8a7a5c');
    g.addColorStop(0.45, '#5d9b4a');
    g.addColorStop(0.8, '#3f7d33');
    g.addColorStop(1, '#e8d39a');
    ctx.fillStyle = g;
    ctx.fill();
    // Sand fringe along the waterline.
    ctx.strokeStyle = '#efe0ae';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(x0, seaY + 2);
    ctx.lineTo(x1, seaY + 2);
    ctx.stroke();
    // Island name tag floating over its middle.
    const midX = (isl.x0 + isl.x1) / 2 - cam.x;
    const topY = worldToScreenY(-Math.max.apply(null, isl.peaks.map(p => p.h))) - 34;
    ctx.font = 'bold 15px "Trebuchet MS", Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText(isl.name, midX, topY);
  }
}

function drawRunways(ctx, cam, level) {
  for (const isl of level.islands) {
    const rw = isl.runway;
    if (!rw) continue;
    const sx = rw.x - rw.w / 2 - cam.x;
    const sy = worldToScreenY(-26);
    if (sx + rw.w < -20 || sx > 1300) continue;
    ctx.fillStyle = rw.kind === 'dest' ? '#3f6fb5' : '#4a4a52';
    ctx.fillRect(sx, sy - 4, rw.w, 8);
    ctx.fillStyle = '#f4f4f4';
    for (let i = 0; i < 7; i++) {
      ctx.fillRect(sx + 18 + i * (rw.w - 36) / 6, sy - 1, 16, 2);
    }
    ctx.font = 'bold 13px "Trebuchet MS", Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = rw.kind === 'dest' ? '#bcd8ff' : '#d8d8d8';
    const label = rw.kind === 'start' ? 'HOME STRIP' : (rw.kind === 'dest' ? 'DELIVERY STRIP' : 'FUEL STRIP');
    ctx.fillText(label, rw.x - cam.x, sy - 14);
  }
}

function drawRings(ctx, cam, level, time) {
  for (const ring of level.rings) {
    if (ring.got) continue;
    const sx = ring.x - cam.x, sy = worldToScreenY(ring.y);
    if (sx < -120 || sx > 1400 || sy < -120 || sy > 840) continue;
    const pulse = 1 + Math.sin(time * 3 + ring.phase) * 0.06;
    const r = ring.r * pulse;
    const gold = ring.kind === 'gold';
    const glow = ctx.createRadialGradient(sx, sy, r * 0.4, sx, sy, r * 1.5);
    glow.addColorStop(0, gold ? 'rgba(255, 215, 94, 0.28)' : 'rgba(110, 231, 140, 0.28)');
    glow.addColorStop(1, 'rgba(255, 215, 94, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sx, sy, r * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 9;
    ctx.strokeStyle = gold ? '#ffd75e' : '#5fd97a';
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = gold ? '#fff3c4' : '#d6ffe2';
    ctx.beginPath();
    ctx.arc(sx, sy, r - 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = 'bold 13px "Trebuchet MS", Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = gold ? '#8a6d00' : '#0d5c22';
    ctx.fillText(gold ? '+100' : 'FUEL', sx, sy + 4);
  }
}

function drawStorms(ctx, cam, level, time) {
  for (const st of level.storms) {
    const sx = st.x - cam.x, sy = worldToScreenY(st.y);
    if (sx < -220 || sx > 1500 || sy < -220 || sy > 940) continue;
    for (let i = 0; i < 5; i++) {
      const a = st.seed + i * 1.25;
      const ox = Math.cos(a) * st.r * 0.55;
      const oy = Math.sin(a * 1.7) * st.r * 0.28;
      const rr = st.r * (0.42 + (i % 3) * 0.13);
      const g = ctx.createRadialGradient(sx + ox, sy + oy, rr * 0.2, sx + ox, sy + oy, rr);
      g.addColorStop(0, 'rgba(58, 62, 84, 0.92)');
      g.addColorStop(1, 'rgba(58, 62, 84, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sx + ox, sy + oy, rr, 0, Math.PI * 2);
      ctx.fill();
    }
    // Lightning flicker inside the cloud.
    if (Math.sin(time * 7 + st.seed * 9) > 0.86) {
      ctx.strokeStyle = 'rgba(255, 246, 150, 0.95)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(sx - 8, sy + 6);
      ctx.lineTo(sx + 4, sy + 34);
      ctx.lineTo(sx - 4, sy + 34);
      ctx.lineTo(sx + 10, sy + 62);
      ctx.stroke();
    }
    if (sx > -20 && sx < 1300) {
      ctx.font = 'bold 13px "Trebuchet MS", Verdana, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd75e';
      ctx.fillText('STORM', sx, sy - st.r - 10);
    }
  }
}

function drawDecoClouds(ctx, cam, level, time) {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  for (const c of level.decoClouds) {
    const sx = ((c.x + time * c.speed) % (level.width + 400)) - 200 - cam.x * 0.5;
    const sy = worldToScreenY(c.y);
    if (sx < -260 || sx > 1540 || sy < -160 || sy > 880) continue;
    ctx.beginPath();
    ctx.ellipse(sx, sy, c.s, c.s * 0.36, 0, 0, Math.PI * 2);
    ctx.ellipse(sx + c.s * 0.5, sy + 6, c.s * 0.6, c.s * 0.3, 0, 0, Math.PI * 2);
    ctx.ellipse(sx - c.s * 0.5, sy + 8, c.s * 0.55, c.s * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
