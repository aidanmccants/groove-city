/* ---------------- player ---------------- */
const P = new THREE.Vector3(), V = new THREE.Vector3(); let yaw = 0, pitch = 0, flying = false, onGround = false;
const keys = new Set(); const EYE = 1.68, R = 0.35;
function groundAt(x, z, y) {
  let g = terrainY(x, z);
  for (const f of floors) { const fy = f(x, z); if (fy !== null && (y === undefined || y > fy - 1.2)) g = Math.max(g, fy); }
  for (const br of bridges) {
    const [cx, cz, t] = closestOnSeg(x, z, br.a, br.b);
    if (Math.hypot(x - cx, z - cz) < br.w / 2 + .1) { const dy = br.ya + (br.yb - br.ya) * t; if (y === undefined || y > dy - 1.2) g = Math.max(g, dy); }
  }
  return g;
}
function collide() {
  const k = Math.floor(P.x / CELL) + ',' + Math.floor(P.z / CELL);
  for (const c of cgrid.get(k) || []) {
    if (P.y > c.top || (c.bot !== undefined && P.y + 1.7 < c.bot)) continue;
    const inside = pip(P.x, P.z, c.rings[0]) && !c.rings.slice(1).some(h => pip(P.x, P.z, h));
    let best = null;
    for (const ring of c.rings) for (let i = 0; i < ring.length; i++) {
      const [qx, qz] = closestOnSeg(P.x, P.z, ring[i], ring[(i + 1) % ring.length]); const d = Math.hypot(P.x - qx, P.z - qz);
      if (!best || d < best[0]) best = [d, qx, qz];
    }
    if (!best) continue;
    const [d, qx, qz] = best;
    if (inside) { const dx = qx - P.x, dz = qz - P.z, L = Math.hypot(dx, dz) || 1; P.x = qx + dx / L * R; P.z = qz + dz / L * R; }
    else if (d < R) { const dx = P.x - qx, dz = P.z - qz, L = d || 1; P.x = qx + dx / L * R; P.z = qz + dz / L * R; }
  }
  if (!flying || P.y < groundAt(P.x, P.z) + 8) for (const t of tgrid.get(k) || []) {
    const dx = P.x - t[0], dz = P.z - t[1], d = Math.hypot(dx, dz), m = R + t[2];
    if (d < m && d > 1e-4) { P.x = t[0] + dx / d * m; P.z = t[1] + dz / d * m; }
  }
  P.x = Math.max(-W / 2 + 2, Math.min(W / 2 - 2, P.x)); P.z = Math.max(-H / 2 + 2, Math.min(H / 2 - 2, P.z));
}
function teleport(x, z) {
  if (Vehicles.player) Vehicles.exit(true);
  P.set(x, 0, z); P.y = groundAt(x, z) + 0.05; V.set(0, 0, 0);
  for (let i = 0; i < 40; i++) { const before = P.clone(); collide(); if (before.distanceTo(P) < 1e-3) break; }
  P.y = groundAt(P.x, P.z) + 0.05;
}
function update(dt) {
  if (Vehicles.player) return Vehicles.updatePlayer(dt);
  const f = Math.max(-1, Math.min(1, (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) + joy.y + Pad.y));
  const s = Math.max(-1, Math.min(1, (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + joy.x + Pad.x));
  const run = keys.has('ShiftLeft') || keys.has('ShiftRight');
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  let mx = fx * f + rx * s, mz = fz * f + rz * s; const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
  if (flying) {
    const sp = run ? 70 : 22; P.x += mx * sp * dt; P.z += mz * sp * dt;
    const up = (keys.has('Space') || touchUp ? 1 : 0) - (keys.has('KeyC') || keys.has('ControlLeft') ? 1 : 0); P.y += up * sp * dt;
    P.y = Math.max(P.y, groundAt(P.x, P.z) + 0.05); P.y = Math.min(P.y, 600);
  } else {
    const sp = run ? 9.5 : 4.4; const accel = onGround ? 14 : 3;
    V.x += (mx * sp - V.x) * Math.min(1, accel * dt); V.z += (mz * sp - V.z) * Math.min(1, accel * dt);
    if ((keys.has('Space') || touchUp) && onGround) { V.y = 6.2; onGround = false; }
    V.y -= 22 * dt; P.x += V.x * dt; P.z += V.z * dt; P.y += V.y * dt;
    const g = groundAt(P.x, P.z, P.y);
    if (P.y <= g) { P.y = g; V.y = 0; onGround = true; } else if (P.y - g < 0.25 && V.y <= 0) { P.y = g; V.y = 0; onGround = true; } else onGround = false;
  }
  collide(); Rail.pushPlayer();
  camera.position.set(P.x, P.y + EYE, P.z); camera.rotation.set(pitch, yaw, 0);
}

