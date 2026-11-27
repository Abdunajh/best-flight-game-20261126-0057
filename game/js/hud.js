// Island Hopper — the cockpit readouts, drawn on the canvas so they are in
// every screenshot: altitude, speed and heading on the top bar, a fuel
// gauge, an attitude indicator, a compass strip and a throttle lever.
'use strict';

function compassLabel(heading) {
  const points = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return points[Math.round((((heading % 360) + 360) % 360) / 22.5) % 16];
}

function drawTopBar(ctx, game) {
  const p = game.plane;
  ctx.fillStyle = 'rgba(8, 24, 40, 0.94)';
  ctx.fillRect(0, 0, 1280, 54);
  ctx.fillStyle = '#ffd75e';
  ctx.fillRect(0, 54, 1280, 3);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  function readout(x, label, value, color) {
    ctx.font = 'bold 12px "Trebuchet MS", Verdana, sans-serif';
    ctx.fillStyle = '#9fc6e2';
    ctx.fillText(label, x, 18);
    ctx.font = 'bold 24px "Trebuchet MS", Verdana, sans-serif';
    ctx.fillStyle = color || '#ffffff';
    ctx.fillText(value, x, 46);
  }
  const alt = Math.max(0, Math.round(-p.y));
  readout(18, 'ALTITUDE  ft', String(alt), alt < 120 ? '#ffb14e' : '#ffffff');
  readout(168, 'AIRSPEED  kt', String(Math.round(p.speed)));
  const hdg = Math.round(((p.heading % 360) + 360) % 360);
  readout(318, 'HEADING', String(hdg).padStart(3, '0') + '° ' + compassLabel(p.heading));
  readout(478, 'RINGS', game.ringsGot + ' / ' + game.ringsTotal);
  readout(598, 'SCORE', String(game.score));
  readout(748, 'LIVES', String(game.lives));
  readout(888, 'LEVEL', String(game.level));

  // Fuel gauge on the right of the top bar.
  const fx = 1030, fw = 210;
  ctx.font = 'bold 12px "Trebuchet MS", Verdana, sans-serif';
  ctx.fillStyle = '#9fc6e2';
  ctx.fillText('FUEL', fx, 18);
  ctx.fillStyle = '#12283a';
  ctx.fillRect(fx, 26, fw, 16);
  const fuelFrac = clamp(p.fuel / 100, 0, 1);
  ctx.fillStyle = fuelFrac > 0.5 ? '#5fd97a' : (fuelFrac > 0.25 ? '#ffd75e' : '#ff5a4e');
  ctx.fillRect(fx, 26, fw * fuelFrac, 16);
  ctx.strokeStyle = '#eaf4ff';
  ctx.lineWidth = 1;
  ctx.strokeRect(fx, 26, fw, 16);
  ctx.font = 'bold 13px "Trebuchet MS", Verdana, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(Math.round(p.fuel) + '%', fx + fw + 8, 40);
  if (p.damage >= 1) {
    ctx.fillStyle = p.damage > 60 ? '#ff8a7a' : '#ffb14e';
    ctx.font = 'bold 11px "Trebuchet MS", Verdana, sans-serif';
    ctx.fillText('DMG ' + Math.round(p.damage) + '%', fx, 50);
  }
}

// Attitude indicator: a little artificial horizon, bottom left.
function drawAttitude(ctx, game) {
  const p = game.plane;
  const cx = 78, cy = 640, r = 52;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-p.turning * 0.22);
  const pitchPx = clamp(p.pitch, -36, 36) * 1.1;
  // Sky above the horizon line, ground below it; climbing drops the line.
  ctx.fillStyle = '#7ec8ee';
  ctx.fillRect(-r, -r, r * 2, r + pitchPx);
  ctx.fillStyle = '#8a6b42';
  ctx.fillRect(-r, pitchPx, r * 2, r - pitchPx);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r, pitchPx);
  ctx.lineTo(r, pitchPx);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = '#eaf4ff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  // Fixed wings marker and pitch ladder ticks.
  ctx.fillStyle = '#ffd75e';
  ctx.fillRect(cx - 26, cy - 2, 18, 4);
  ctx.fillRect(cx + 8, cy - 2, 18, 4);
  ctx.beginPath();
  ctx.moveTo(cx, cy - 12);
  ctx.lineTo(cx - 5, cy - 2);
  ctx.lineTo(cx + 5, cy - 2);
  ctx.closePath();
  ctx.fill();
  ctx.font = 'bold 11px "Trebuchet MS", Verdana, sans-serif';
  ctx.fillStyle = '#eaf4ff';
  ctx.textAlign = 'center';
  ctx.fillText('ATTITUDE', cx, cy + r + 16);
}

// Compass strip across the bottom centre, sliding with the heading.
function drawCompass(ctx, game) {
  const p = game.plane;
  const cx = 640, cy = 692, w = 420;
  ctx.fillStyle = 'rgba(8, 24, 40, 0.66)';
  ctx.fillRect(cx - w / 2, cy - 20, w, 34);
  const heading = ((p.heading % 360) + 360) % 360;
  const pxPerDeg = w / 120; // 120 degrees visible across the strip
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - w / 2, cy - 20, w, 34);
  ctx.clip();
  const base = Math.floor(heading / 15) * 15;
  for (let T = base - 90; T <= base + 90; T += 15) {
    const deg = ((T % 360) + 360) % 360;
    let off = deg - heading;
    if (off > 180) off -= 360;
    if (off < -180) off += 360;
    const x = cx + off * pxPerDeg;
    const major = deg % 45 === 0;
    ctx.strokeStyle = major ? '#ffd75e' : '#9fc6e2';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x, cy - 16);
    ctx.lineTo(x, major ? cy + 2 : cy - 6);
    ctx.stroke();
    if (major) {
      ctx.font = 'bold 12px "Trebuchet MS", Verdana, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(compassLabel(deg), x, cy + 12);
    }
  }
  ctx.restore();
  ctx.fillStyle = '#ffd75e';
  ctx.beginPath();
  ctx.moveTo(cx, cy - 20);
  ctx.lineTo(cx - 6, cy - 30);
  ctx.lineTo(cx + 6, cy - 30);
  ctx.closePath();
  ctx.fill();
}

// Throttle lever, bottom right.
function drawThrottle(ctx, game) {
  const p = game.plane;
  const x = 1196, y0 = 600, h = 96;
  ctx.fillStyle = 'rgba(8, 24, 40, 0.66)';
  ctx.fillRect(x - 26, y0 - 16, 76, h + 32);
  ctx.fillStyle = '#12283a';
  ctx.fillRect(x, y0, 14, h);
  const th = clamp(p.throttle, 0, 1);
  ctx.fillStyle = '#5fd97a';
  ctx.fillRect(x, y0 + h * (1 - th), 14, h * th);
  ctx.fillStyle = '#ffd75e';
  ctx.fillRect(x - 8, y0 + h * (1 - th) - 4, 30, 8);
  ctx.font = 'bold 11px "Trebuchet MS", Verdana, sans-serif';
  ctx.fillStyle = '#eaf4ff';
  ctx.textAlign = 'center';
  ctx.fillText('THR', x + 7, y0 - 4);
  ctx.fillText(Math.round(th * 100) + '%', x + 7, y0 + h + 14);
}

// Centre banner messages and floating score popups.
function drawBanner(ctx, game) {
  if (!game.banner || game.bannerT <= 0) return;
  const a = clamp(game.bannerT / 0.5, 0, 1);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.font = 'bold 44px "Trebuchet MS", Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(8, 24, 40, 0.8)';
  ctx.strokeText(game.banner, 640, 170);
  ctx.fillStyle = game.bannerColor || '#ffd75e';
  ctx.fillText(game.banner, 640, 170);
  if (game.bannerSub) {
    ctx.font = 'bold 20px "Trebuchet MS", Verdana, sans-serif';
    ctx.lineWidth = 4;
    ctx.strokeText(game.bannerSub, 640, 204);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(game.bannerSub, 640, 204);
  }
  ctx.restore();
}

function drawPopups(ctx, game) {
  ctx.font = 'bold 22px "Trebuchet MS", Verdana, sans-serif';
  ctx.textAlign = 'center';
  for (const pop of game.popups) {
    const a = clamp(pop.life / pop.max, 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(8, 24, 40, 0.8)';
    ctx.strokeText(pop.text, pop.x - game.cam.x, worldToScreenY(pop.y));
    ctx.fillStyle = pop.color || '#ffd75e';
    ctx.fillText(pop.text, pop.x - game.cam.x, worldToScreenY(pop.y));
    ctx.restore();
  }
}

function drawWarnings(ctx, game) {
  const p = game.plane;
  const warns = [];
  if (p.fuel > 0 && p.fuel < 22) warns.push('LOW FUEL — land or find a green ring');
  if (p.speed < 70 && !p.grounded) warns.push('STALL — throttle up!');
  if (p.damage > 55) warns.push('HEAVY DAMAGE — land soon');
  if (game.ringsGot === game.ringsTotal && game.ringsTotal > 0) warns.push('ALL RINGS — land on the blue delivery strip!');
  if (warns.length === 0) return;
  ctx.font = 'bold 19px "Trebuchet MS", Verdana, sans-serif';
  ctx.textAlign = 'center';
  warns.forEach((w, i) => {
    const y = 96 + i * 28;
    const blink = Math.floor(performance.now() / 400) % 2 === 0;
    ctx.fillStyle = blink ? '#ff8a7a' : '#ffd75e';
    ctx.fillText('! ' + w, 640, y);
  });
}

function drawHUD(ctx, game) {
  drawTopBar(ctx, game);
  drawAttitude(ctx, game);
  drawCompass(ctx, game);
  drawThrottle(ctx, game);
  drawBanner(ctx, game);
  drawPopups(ctx, game);
  drawWarnings(ctx, game);
}
