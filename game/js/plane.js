// Island Hopper — the Kestrel mail seaplane: arcade flight physics and the
// drawing of the aircraft. Speeds are knots, altitudes feet, 1 ft = 1 px.
// The plane can pitch, throttle, boost and bank around to fly either way.
'use strict';

function newPlane(level) {
  const rw = level.startRunway;
  return {
    x: rw.x,
    y: -26,               // parked on the home strip, 26 ft up
    speed: 0,             // knots
    pitch: 0,             // degrees, + climbs
    heading: 90,          // degrees, 90 = east, 270 = west
    throttle: 0,          // 0..1
    fuel: 100,
    damage: 0,
    grounded: true,
    turning: 0,           // -1 / 0 / +1 while banking
    propAngle: 0,
    vy: 0,                // last vertical speed, ft/s, for landing checks
  };
}

// One fixed step. Returns 'landed', 'crashed' or null, with detail in out.
function stepPlane(plane, input, level, dt, out) {
  // Throttle: W/S keys, clamped 0..1.
  if (input.throttleUp) plane.throttle = clamp(plane.throttle + 0.7 * dt, 0, 1);
  if (input.throttleDown) plane.throttle = clamp(plane.throttle - 0.7 * dt, 0, 1);
  const boost = input.boost && plane.fuel > 0;
  const throttle = boost ? Math.min(1, plane.throttle + 0.35) : plane.throttle;

  // Pitch: Up climbs, Down dives; hands off and the nose eases level.
  if (input.pitchUp) plane.pitch = clamp(plane.pitch + 40 * dt, -24, 36);
  else if (input.pitchDown) plane.pitch = clamp(plane.pitch - 30 * dt, -24, 30);
  else plane.pitch = approach(plane.pitch, 0, 0.10, dt);

  // Banking: Left/Right swing the heading around at 55 deg/s.
  plane.turning = 0;
  if (input.turnLeft) { plane.heading -= 55 * dt; plane.turning = -1; }
  if (input.turnRight) { plane.heading += 55 * dt; plane.turning = 1; }
  plane.heading = ((plane.heading % 360) + 360) % 360;

  // Speed chases the throttle's target; boost pushes past it.
  const targetSpeed = 55 + throttle * 185;
  const accel = boost ? 95 : 55;
  plane.speed = approach(plane.speed, targetSpeed, accel / 120, dt);
  if (plane.grounded) plane.speed = Math.min(plane.speed, 165);

  // Velocity along the nose, plus a stall sink and a low-throttle sink.
  // Heading is a compass bearing (90 = east), so east is heading - 90.
  const pitchRad = plane.pitch * Math.PI / 180;
  const headRad = (plane.heading - 90) * Math.PI / 180;
  const k = 1.6; // ft/s per knot
  let vx = plane.speed * Math.cos(pitchRad) * Math.cos(headRad) * k;
  let vy = -plane.speed * Math.sin(pitchRad) * k;
  if (plane.speed < 70) vy += (70 - plane.speed) * 1.1;
  if (throttle < 0.3 && !plane.grounded) vy += (0.3 - throttle) * 130;
  plane.vy = vy;

  plane.x += vx * dt;
  plane.y += vy * dt;
  plane.propAngle += (2 + plane.speed * 0.35) * dt;

  // Ceiling: the air thins out above 2050 ft, so the nose is pushed down.
  if (-plane.y > 2050) {
    plane.y = -2050;
    if (plane.pitch > 0) plane.pitch = 0;
  }

  // Fuel burns with the throttle; boost burns double.
  if (!plane.grounded || plane.speed > 5) {
    plane.fuel -= (0.22 + throttle * 0.5) * (boost ? 2 : 1) * dt;
    if (plane.fuel < 0) plane.fuel = 0;
  }
  if (plane.fuel <= 0) plane.throttle = 0;

  // World edges: the sea runs out, so the plane is turned back gently.
  if (plane.x < 120) { plane.x = 120; plane.heading = 90; }
  if (plane.x > level.width - 120) { plane.x = level.width - 120; plane.heading = 270; }

  // Takeoff: enough speed and a raised nose lifts off the strip. The
  // small lift clears the ground band so the same step cannot re-land.
  if (plane.grounded && plane.speed > 92 && plane.pitch > 4) {
    plane.grounded = false;
    plane.y -= 8;
    out.event = 'takeoff';
  }

  // Ground contact.
  const groundH = groundHeightAt(level, plane.x);
  const alt = -plane.y;
  if (!plane.grounded && alt <= groundH + 2) {
    plane.y = -groundH;
    const rw = runwayAt(level, plane.x);
    if (rw && Math.abs(vy) < 95 && plane.speed < 175) {
      plane.grounded = true;
      plane.pitch = 0;
      plane.speed = Math.min(plane.speed, 60);
      out.event = 'landed';
      out.runway = rw;
      out.perfect = Math.abs(vy) < 48 && plane.speed < 140;
      out.vy = vy;
    } else {
      out.event = 'crashed';
      out.reason = groundH > 40 ? 'mountain' : 'sea';
    }
  }

  // Storm clouds: turbulence shakes the plane and damage climbs.
  for (const st of level.storms) {
    const d = Math.hypot(plane.x - st.x, plane.y - st.y);
    if (d < st.r) {
      plane.damage += 22 * dt;
      plane.pitch += (Math.random() - 0.5) * 26 * dt;
      plane.y += (Math.random() - 0.5) * 60 * dt;
      if (plane.damage >= 100) {
        out.event = 'crashed';
        out.reason = 'storm';
      }
    }
  }
  if (plane.damage >= 100 && !out.event) {
    out.event = 'crashed';
    out.reason = 'storm';
  }
  return out.event || null;
}

// ---- Drawing the Kestrel ----

function drawPlane(ctx, cam, plane, level, time) {
  const sx = plane.x - cam.x;
  const sy = worldToScreenY(plane.y);
  if (sx < -160 || sx > 1440 || sy < -160 || sy > 880) return;

  // Soft shadow on the ground or sea below.
  const groundH = groundHeightAt(level, plane.x);
  const alt = -plane.y - groundH;
  if (alt < 900) {
    const shY = worldToScreenY(-groundH);
    const shScale = clamp(1 - alt / 900, 0.15, 0.9);
    ctx.fillStyle = 'rgba(10, 40, 60, ' + (0.28 * shScale).toFixed(3) + ')';
    ctx.beginPath();
    ctx.ellipse(sx, shY, 52 * shScale + 14, 7 * shScale + 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const facing = Math.cos((plane.heading - 90) * Math.PI / 180) >= 0 ? 1 : -1;
  const pitchRad = plane.pitch * Math.PI / 180;
  ctx.save();
  ctx.translate(sx, sy);
  if (plane.turning !== 0) ctx.rotate(plane.turning * 0.12 * facing);
  ctx.scale(facing, 1);
  ctx.rotate(-pitchRad * facing);

  // Pontoons (she is a seaplane) and their struts.
  ctx.fillStyle = '#c8442c';
  roundRect(ctx, -28, 16, 74, 9, 4); ctx.fill();
  roundRect(ctx, -28, 16, 74, 9, 4); ctx.fill();
  ctx.fillStyle = '#8f2f1e';
  ctx.fillRect(-14, 8, 5, 9);
  ctx.fillRect(26, 8, 5, 9);
  ctx.fillStyle = '#f7f3e8';
  ctx.fillRect(-28, 16, 74, 3);

  // Fuselage: cream top, red belly stripe, rounded nose.
  ctx.beginPath();
  ctx.moveTo(-52, -2);
  ctx.quadraticCurveTo(-58, -12, -38, -14);
  ctx.lineTo(28, -14);
  ctx.quadraticCurveTo(52, -13, 56, -4);
  ctx.quadraticCurveTo(58, 4, 44, 7);
  ctx.lineTo(-40, 8);
  ctx.quadraticCurveTo(-54, 6, -52, -2);
  ctx.closePath();
  ctx.fillStyle = '#f7f3e8';
  ctx.fill();
  ctx.strokeStyle = '#c8442c';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = '#c8442c';
  ctx.beginPath();
  ctx.moveTo(-50, 2);
  ctx.lineTo(50, 2);
  ctx.lineTo(44, 7);
  ctx.lineTo(-40, 8);
  ctx.closePath();
  ctx.fill();

  // Cabin windows and the mail-roundel.
  ctx.fillStyle = '#9fd8ef';
  ctx.strokeStyle = '#5a4632';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    roundRect(ctx, -6 + i * 14, -11, 10, 8, 3);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = '#ffd75e';
  ctx.beginPath();
  ctx.arc(-38, -4, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c8442c';
  ctx.font = 'bold 8px "Trebuchet MS", Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('K', -38, -1);

  // Top wing and tail.
  ctx.fillStyle = '#c8442c';
  ctx.beginPath();
  ctx.moveTo(-18, -14);
  ctx.lineTo(6, -34);
  ctx.lineTo(22, -34);
  ctx.lineTo(10, -14);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-52, -4);
  ctx.lineTo(-64, -26);
  ctx.lineTo(-56, -26);
  ctx.lineTo(-44, -8);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-52, 2);
  ctx.lineTo(-68, -4);
  ctx.lineTo(-66, 2);
  ctx.lineTo(-50, 7);
  ctx.closePath();
  ctx.fill();

  // Propeller: a blurred disc and two blades spinning with the engine.
  ctx.save();
  ctx.translate(57, -4);
  ctx.fillStyle = 'rgba(40, 40, 46, 0.18)';
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(plane.propAngle);
  ctx.fillStyle = '#3a3a40';
  roundRect(ctx, -3, -26, 6, 52, 3); ctx.fill();
  ctx.rotate(Math.PI / 2);
  roundRect(ctx, -3, -26, 6, 52, 3); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#ffd75e';
  ctx.beginPath();
  ctx.arc(57, -4, 4, 0, Math.PI * 2);
  ctx.fill();

  // Navigation lights: green nose-right, red tail, white strobe blinking.
  ctx.fillStyle = '#37e08a';
  ctx.beginPath(); ctx.arc(52, -12, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ff5a4e';
  ctx.beginPath(); ctx.arc(-56, -2, 3, 0, Math.PI * 2); ctx.fill();
  if (Math.floor(time * 2) % 2 === 0) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(-64, -26, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
