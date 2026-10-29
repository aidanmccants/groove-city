/* ---------------- the fleet: voxel cars as instanced parts ---------------- */
// [size, centre (car-local: +x driver's side, +z forward), colour ('body' | 'roof' | hex), material, only ('cop'), copies (x-mirror / 4 corners), shadow]
const CAR_PARTS = [
  [[1.8, .6, 4.3], [0, .66, 0], 'body', 'lam', null, 1, true],
  [[1.56, .58, 2.2], [0, 1.25, -.25], 'roof', 'lam', null, 1, true],
  [[1.62, .42, 2.32], [0, 1.2, -.25], '#26323c', 'glass'],
  [[1.86, .2, 4.46], [0, .45, 0], '#1d1f22', 'lam'],
  [[.26, .64, .64], [.8, .32, 1.38], '#151515', 'lam', null, 4],
  [[.28, .26, .26], [.8, .32, 1.38], '#9aa0a6', 'lam', null, 4],
  [[.38, .16, .06], [.58, .8, 2.16], '#fff4cf', 'basic', null, 2],
  [[.36, .14, .06], [.6, .82, -2.16], '#5e0a0c', 'basic', null, 2],
  [[1.5, .14, .45], [0, .99, .8], '#3a3d42', 'lam'],
  [[.34, .24, .04], [.4, 1.02, .5], '#111111', 'lam'],
  [[1.84, .34, 1.9], [0, .74, -.1], '#f2f2f2', 'lam', 'cop'],
  [[1.1, .12, .32], [0, 1.6, -.25], '#222222', 'lam', 'cop'],
  [[.46, .14, .3], [.3, 1.69, -.25], '#5a1010', 'basic', 'cop'],   // red (driver's side)
  [[.46, .14, .3], [-.3, 1.69, -.25], '#10205a', 'basic', 'cop'],  // blue
];
const RED_PART = 12, BLUE_PART = 13, LIGHT_ON = [new THREE.Color(0xff2020), new THREE.Color(0x2a5bff)], LIGHT_OFF = [new THREE.Color(0x5a1010), new THREE.Color(0x10205a)];
const TAIL_PART = 7, TAIL_ON = new THREE.Color(0xff2a1a), TAIL_OFF = new THREE.Color(0x5e0a0c);
const Vehicles = {
  list: [], parked: 0, player: null, parts: [], frozen: null, cam: 'cab', lookCar: null, pending: null, rental: null,
  lights: false, siren: false, pull: null, offenders: [], camBase: 0, prevPos: null,
  init(parked) {
    const cops = [];
    for (const k of parked) this.add({ x: k.x, z: k.z, h: k.r + Math.PI / 2, col: k.col, cop: false });
    for (const q of [[-600, -250], [-560, -320], [-640, -170], [-60, -90], [120, 60]]) {   // police cars parked downtown and on campus
      let b = null, bd = 1e9; for (const c of this.list) { const d = Math.hypot(c.x - q[0], c.z - q[1]); if (!c.cop && d < bd) { bd = d; b = c; } }
      if (b) { b.cop = true; b.col = '#141619'; b.roof = '#f2f2f2'; }
    }
    this.parked = this.list.length;
    Roads.build();
    if (Roads.main.length) for (let i = 0; i < 19; i++) {
      const cop = i < 5, c = this.add({ x: 0, z: 0, h: 0, col: cop ? '#141619' : ['#e8e8e8', '#9b1c24', '#24406e', '#c9c9c4', '#3b4a3b', '#d9a43b', '#6b6e72'][i % 7], cop, kind: 'npc' });
      c.npc = { seed: 1000 + i, ph: i / 19 * NPC_SLOT, cop, k: null, legs: [], ov: null, sched: {} };
      if (cop) cops.push(c);
    }
    this.buildMeshes(); for (const c of this.list) if (c.cop) this.addDecals(c);
    for (const c of this.list) { if (c.kind !== 'npc') this.pose(c, true); this.place(c); }
    for (const c of cops) Cops.add(c);
  },
  add(o) { const c = Object.assign({ id: this.list.length, y: 0, v: 0, pt: 0, rl: 0, kind: 'parked', roof: null, flash: false, steer: 0 }, o); if (!c.roof) c.roof = c.col; this.list.push(c); return c; },
  addDecals(car) {   // GROOVE CITY POLICE on both front doors (the white door panel); placed in place()
    if (!this._decalMat) {
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96; const g = cv.getContext('2d');
      g.fillStyle = '#0f1f4a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '800 44px "Barlow Semi Condensed", Arial, sans-serif';
      g.fillText('GROOVE CITY POLICE', 256, 38); g.fillRect(60, 68, 392, 4);
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
      this._decalMat = new THREE.MeshLambertMaterial({ map: t, transparent: true, depthWrite: false }); this._decalGeo = new THREE.PlaneGeometry(1.9, .36);
    }
    car.decals = [[.93, Math.PI / 2], [-.93, -Math.PI / 2]].map(([x, ry]) => {   // driver's side faces +x, passenger's -x
      const d = new THREE.Mesh(this._decalGeo, this._decalMat); d.matrixAutoUpdate = false; d.matrixWorldNeedsUpdate = true;
      d.userData.local = new THREE.Matrix4().compose(new THREE.Vector3(x, .76, -.1), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, 1, 1));
      scene.add(d); return d;
    });
  },
  buildMeshes() {
    const mats ={ lam: new THREE.MeshLambertMaterial({ color: 0xffffff }), basic: new THREE.MeshBasicMaterial({ color: 0xffffff }), glass: new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x0a0f14 }) };
    const col = new THREE.Color();
    CAR_PARTS.forEach(([s, p, cl, mat, only, copies = 1, shadow = false], i) => {
      const loc = [];
      for (let j = 0; j < copies; j++) {
        const x = copies === 1 ? p[0] : (j % 2 ? -p[0] : p[0]), z = copies === 4 && j >= 2 ? -p[2] : p[2];
        loc.push(new THREE.Matrix4().compose(new THREE.Vector3(x, p[1], z), new THREE.Quaternion(), new THREE.Vector3(...s)));
      }
      const owners = this.list.filter(c => !only || c.cop), mesh = new THREE.InstancedMesh(cboxGeo, mats[mat], Math.max(1, owners.length * copies));
      mesh.count = owners.length * copies; mesh.castShadow = shadow; mesh.receiveShadow = mat === 'lam'; mesh.frustumCulled = false;
      const part = { i, loc, mesh, dirty: true, cdirty: true, full: true };
      owners.forEach((c, n) => { (c.slot || (c.slot = []))[i] = n * copies; for (let j = 0; j < copies; j++) mesh.setColorAt(n * copies + j, col.set(cl === 'body' ? c.col : cl === 'roof' ? c.roof : cl)); });
      scene.add(mesh); this.parts.push(part);
    });
  },
  place(car) {
    const e = this._e || (this._e = new THREE.Euler(0, 0, 0, 'YXZ')), q = this._q || (this._q = new THREE.Quaternion()), m = this._m || (this._m = new THREE.Matrix4()), l = this._l || (this._l = new THREE.Matrix4()), v = this._v || (this._v = new THREE.Vector3()), one = this._one || (this._one = new THREE.Vector3(1, 1, 1));
    e.set(-car.pt, car.h, car.rl); q.setFromEuler(e); m.compose(v.set(car.x, car.y, car.z), q, one);
    if (car.decals) for (const d of car.decals) { d.matrix.multiplyMatrices(m, d.userData.local); d.matrixWorldNeedsUpdate = true; }
    for (const P of this.parts) { const b = car.slot[P.i]; if (b == null) continue; for (let j = 0; j < P.loc.length; j++) { l.multiplyMatrices(m, P.loc[j]); P.mesh.setMatrixAt(b + j, l); } P.dirty = true; (P.ranges || (P.ranges = [])).push(b, P.loc.length); }
  },
  // upload only the instances that moved this frame (merged into runs), not the whole fleet
  flushRanges(P) {
    const A = P.mesh.instanceMatrix, r = P.ranges || [], runs = []; P.ranges = [];
    if (!A.addUpdateRange || P.full) { P.full = false; A.needsUpdate = true; return; }
    const idx = []; for (let i = 0; i < r.length; i += 2) idx.push([r[i], r[i + 1]]); idx.sort((a, b) => a[0] - b[0]);
    for (const [s0, n] of idx) { const L = runs[runs.length - 1]; if (L && s0 <= L[0] + L[1] + 8) L[1] = Math.max(L[1], s0 + n - L[0]); else runs.push([s0, n]); }
    A.clearUpdateRanges(); for (const [s0, n] of runs) A.addUpdateRange(s0 * 16, n * 16); A.needsUpdate = true;
  },
  setFlash(car, on, ph) {   // light bar: alternate red / blue
    if (!car.cop) return; const key = on ? (ph ? 1 : 2) : 0; if (car.flashKey === key) return; car.flashKey = key;
    this.parts[RED_PART].mesh.setColorAt(car.slot[RED_PART], on && ph ? LIGHT_ON[0] : LIGHT_OFF[0]);
    this.parts[BLUE_PART].mesh.setColorAt(car.slot[BLUE_PART], on && !ph ? LIGHT_ON[1] : LIGHT_OFF[1]);
    this.parts[RED_PART].cdirty = this.parts[BLUE_PART].cdirty = true;
  },
  setBrake(car, on) {   // tail lights: bright while braking, dim otherwise (both copies)
    const key = on ? 1 : 0; if (car.brakeKey === key || car.slot == null) return; car.brakeKey = key;
    const T = this.parts[TAIL_PART], col = on ? TAIL_ON : TAIL_OFF;
    T.mesh.setColorAt(car.slot[TAIL_PART], col); T.mesh.setColorAt(car.slot[TAIL_PART] + 1, col); T.cdirty = true;
  },
  // sit the car on the ground (bridges included), tilted to the slope
  pose(car, snap) {
    const fx = Math.sin(car.h), fz = Math.cos(car.h), lx = fz, lz = -fx, ref = car.br ? undefined : car.y + 1;
    const g = (x, z) => snap && !car.br ? groundAt(x, z, terrainY(x, z) + .5) : groundAt(x, z, ref);
    const yf = g(car.x + fx * 1.5, car.z + fz * 1.5), yb = g(car.x - fx * 1.5, car.z - fz * 1.5), yl = g(car.x + lx * .8, car.z + lz * .8), yr = g(car.x - lx * .8, car.z - lz * .8);
    const y = (yf + yb + yl + yr) / 4, pt = Math.atan2(yf - yb, 3), rl = Math.atan2(yl - yr, 1.6), k = snap ? 1 : .35;
    car.y += (y - car.y) * k; car.pt += (pt - car.pt) * k; car.rl += (rl - car.rl) * k;
  },
  // circle-vs-oriented-box against car o; returns the push [x, z] or null
  boxPush(o, x, z, r) {
    const fx = Math.sin(o.h), fz = Math.cos(o.h), dx = x - o.x, dz = z - o.z, a = dx * fx + dz * fz, b = dx * fz - dz * fx, ha = 2.25, hb = .93;
    if (Math.abs(a) > ha + r || Math.abs(b) > hb + r) return null;
    const ca = Math.max(-ha, Math.min(ha, a)), cb = Math.max(-hb, Math.min(hb, b)), ea = a - ca, eb = b - cb, d = Math.hypot(ea, eb);
    let na, nb, pen;
    if (d > 1e-4) { if (d >= r) return null; na = ea / d; nb = eb / d; pen = r - d; }
    else if (ha - Math.abs(a) < hb - Math.abs(b)) { na = Math.sign(a) || 1; nb = 0; pen = ha - Math.abs(a) + r; } else { na = 0; nb = Math.sign(b) || 1; pen = hb - Math.abs(b) + r; }
    return [(na * fx + nb * fz) * pen, (na * fz - nb * fx) * pen];
  },
  // what a car at its current spot overlaps: buildings, trunks/poles, other cars, people's avatars, the train
  hits(car) {
    const fx = Math.sin(car.h), fz = Math.cos(car.h), R2 = .92; let px = 0, pz = 0, train = false, n = 0;
    for (const off of [-1.45, 0, 1.45]) {
      const cx = car.x + fx * off, cz = car.z + fz * off, k = Math.floor(cx / CELL) + ',' + Math.floor(cz / CELL);
      for (const c of cgrid.get(k) || []) {
        if (car.y + .3 > c.top || (c.bot !== undefined && car.y + 1.5 < c.bot)) continue;
        const inside = pip(cx, cz, c.rings[0]) && !c.rings.slice(1).some(h => pip(cx, cz, h)); let best = null;
        for (const ring of c.rings) for (let i = 0; i < ring.length; i++) { const [qx, qz] = closestOnSeg(cx, cz, ring[i], ring[(i + 1) % ring.length]); const d = Math.hypot(cx - qx, cz - qz); if (!best || d < best[0]) best = [d, qx, qz]; }
        if (!best) continue; const [d, qx, qz] = best;
        if (inside) { const L = d || 1; px += (qx - cx) / L * (d + R2); pz += (qz - cz) / L * (d + R2); n++; }
        else if (d < R2) { const L = d || 1; px += (cx - qx) / L * (R2 - d); pz += (cz - qz) / L * (R2 - d); n++; }
      }
      for (const t of tgrid.get(k) || []) { const dx = cx - t[0], dz = cz - t[1], d = Math.hypot(dx, dz), m = R2 + t[2]; if (d < m && d > 1e-4) { px += dx / d * (m - d); pz += dz / d * (m - d); n++; } }
      for (const o of this.list) if (o !== car && Math.abs(o.x - cx) < 6 && Math.abs(o.z - cz) < 6) { const p = this.boxPush(o, cx, cz, R2); if (p) { px += p[0]; pz += p[1]; n++; } }
      for (const r of remotes.values()) if (r.seen && r.v < 0) { const dx = cx - r.x, dz = cz - r.z, d = Math.hypot(dx, dz); if (d < R2 + .4 && d > 1e-4) { px += dx / d * (R2 + .4 - d); pz += dz / d * (R2 + .4 - d); n++; } }
      if (Rail.hit(cx, cz, R2)) train = true;
    }
    return n || train ? { px: px / Math.max(1, n) * Math.min(n, 2), pz: pz / Math.max(1, n) * Math.min(n, 2), train } : null;
  },
  // move a car by its velocity and resolve hits (bounce off what it hit, stop dead against the train)
  drive(car, dt) {
    const fx = Math.sin(car.h), fz = Math.cos(car.h);
    car.x += fx * car.v * dt; car.z += fz * car.v * dt;
    const hit = this.hits(car);
    if (hit) {
      car.x += hit.px; car.z += hit.pz;
      if (hit.train) { car.x -= fx * Math.sign(car.v) * .3; car.z -= fz * Math.sign(car.v) * .3; car.v = -Math.sign(car.v) * Math.min(2, Math.abs(car.v)); if (car === this.player && performance.now() - (this.trainT || 0) > 3000) { this.trainT = performance.now(); toast('You cannot drive through a train!', 'bad'); } }
      else if ((fx * hit.px + fz * hit.pz) * car.v < -1e-4) car.v = Math.abs(car.v) > 2 ? -car.v * .3 : 0;
    }
    car.x = Math.max(-W / 2 + 3, Math.min(W / 2 - 3, car.x)); car.z = Math.max(-H / 2 + 3, Math.min(H / 2 - 3, car.z));
    this.pose(car); return hit;
  },
  /* ---- getting in and out ---- */
  look() {   // the parked car in front of the crosshair, within a few metres
    if (this.player || flying) return null;
    const f = this._f || (this._f = new THREE.Vector3()); camera.getWorldDirection(f); let best = null, bs = 0.86;
    for (const c of this.list) {
      if (c.kind !== 'parked' || Math.abs(c.x - P.x) > 7 || Math.abs(c.z - P.z) > 7) continue;
      const dx = c.x - camera.position.x, dy = c.y + .8 - camera.position.y, dz = c.z - camera.position.z, d = Math.hypot(dx, dy, dz);
      if (Math.hypot(c.x - P.x, c.z - P.z) > 5.5) continue;
      const s = (dx * f.x + dy * f.y + dz * f.z) / d; if (s > bs) { bs = s; best = c; }
    }
    return best;
  },
  tryEnter() {
    const c = this.lookCar; if (!c || this.pending) return false;
    if (!c.cop && !Profile.canAfford(5)) { toast('Renting costs $5 a minute. Earn some at the Chick-fil-A counter first.', 'bad'); return true; }
    if (netSock && netSock.readyState === 1) { this.pending = { car: c, t: performance.now() }; netSock.send(JSON.stringify({ t: 'take', id: c.id })); }
    else this.enter(c);
    return true;
  },
  onTake(m) {
    const p = this.pending; if (!p || p.car.id !== m.id) return; this.pending = null;
    if (m.t === 'took') this.enter(p.car); else toast('Someone else just took that car', 'bad');
  },
  enter(c) {
    if (flying) toggleFly();
    c.kind = 'player'; c.v = 0; this.player = c; this.frozen = null; this.prevPos = [c.x, c.z]; this.cam = 'cab';
    yaw = c.h + Math.PI; pitch = -.05; this.camBase = yaw; this.lights = this.siren = false;
    if (c.cop) { this.rental = null; toast('🚓 On patrol. You are a cop now: H siren, L lights. Pull speeders over for $5.', 'info'); }
    else { Profile.charge(5, 'car rental', { quiet: true }); this.rental = { t0: Date.now(), paid: 1 }; toast('Car rented: $5 now, then $5 for every started minute', 'info'); }
    $('drive').hidden = false; $('mode').textContent = c.cop ? 'POLICE' : 'DRIVE'; $('tFly').textContent = 'EXIT';
  },
  exit(quiet) {
    const c = this.player; if (!c) return;
    if (this.frozen && !quiet) { toast('Wait for the officer to finish', 'info'); return; }
    this.player = null; this.frozen = null; c.kind = 'parked'; c.v = 0; this.setFlash(c, false); this.setBrake(c, false); Siren.stop(); this.lights = this.siren = false; this.pull = null;
    if (this.rental) { const mins = this.rental.paid; if (!quiet) toast(`Rental ended: ${mins} min, ${money(mins * 5)}`, 'info'); this.rental = null; }
    if (netSock && netSock.readyState === 1) netSock.send(JSON.stringify({ t: 'park', id: c.id, x: +c.x.toFixed(2), z: +c.z.toFixed(2), h: +c.h.toFixed(3) }));
    // step out of the driver's door
    const lx = Math.cos(c.h), lz = -Math.sin(c.h); P.set(c.x + lx * 1.9, 0, c.z + lz * 1.9); P.y = groundAt(P.x, P.z, c.y + 1) + .05; V.set(0, 0, 0);
    for (let i = 0; i < 20; i++) collide();
    $('drive').hidden = true; $('mode').textContent = 'WALK'; $('tFly').textContent = 'FLY';
  },
  /* ---- the player's car ---- */
  updatePlayer(dt) {
    const c = this.player, frozen = !!this.frozen;
    const f = frozen ? 0 : Math.max(-1, Math.min(1, (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) + joy.y + Pad.y));
    const s = frozen ? 0 : Math.max(-1, Math.min(1, (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + joy.x + Pad.x));
    const vmax = c.cop ? 36 : 30, brake = frozen || keys.has('Space');
    if (brake) c.v -= Math.sign(c.v) * Math.min(Math.abs(c.v), 14 * dt);
    else if (f > 0.1) c.v += c.v < -.2 ? 12 * dt * f : 6.5 * f * (1 - Math.max(0, c.v) / vmax) * dt;
    else if (f < -0.1) c.v += c.v > .2 ? 11 * dt * f : 4 * f * (1 + Math.min(0, c.v) / 7) * dt;
    else c.v -= Math.sign(c.v) * Math.min(Math.abs(c.v), (1.6 + .015 * c.v * c.v) * dt);
    c.steer += (Math.max(-1, Math.min(1, s)) * .6 / (1 + Math.abs(c.v) / 11) - c.steer) * Math.min(1, dt * 8);
    c.h -= c.v / 2.7 * Math.tan(c.steer) * dt;
    const px = c.x, pz = c.z; this.drive(c, dt);
    const heading = Math.atan2(c.x - px, c.z - pz), moved = Math.hypot(c.x - px, c.z - pz) > 1e-3;
    this.ranRed = moved && c.v > 1 ? Traffic.ranRed([px, pz], [c.x, c.z], heading) : null;
    if (this.ranRed) this.redT = performance.now();
    if (this.rental) {   // $5 for every started minute
      const due = Math.floor((Date.now() - this.rental.t0) / 60000) + 1;
      if (due > this.rental.paid) { this.rental.paid = due; Profile.charge(5, 'car rental', { quiet: true }); }
    }
    this.braking = brake || (f * c.v < 0 && Math.abs(c.v) > .5); this.setBrake(c, this.braking);
    this.place(c); c.flash = c.cop && this.lights; if (c.cop) this.setFlash(c, this.lights, Math.floor(performance.now() / 180) % 2);
    P.set(c.x, c.y, c.z); V.set(0, 0, 0);
    // camera: from the driver's seat (look around with the mouse; it eases back to the road) or a chase view from above
    const carYaw = c.h + Math.PI; let off = wrapA(yaw - this.camBase); this.camBase = carYaw;
    if (Math.abs(c.v) > 3) off *= 1 - Math.min(1, dt * .6); off = Math.max(-2.4, Math.min(2.4, off)); yaw = carYaw + off;
    if (this.cam === 'cab') {
      const lx = Math.cos(c.h), lz = -Math.sin(c.h), fx = Math.sin(c.h), fz = Math.cos(c.h);
      camera.position.set(c.x + lx * .4 - fx * .12, c.y + 1.33 + Math.sin(c.pt) * -.1, c.z + lz * .4 - fz * .12);
      camera.rotation.set(pitch + c.pt, yaw, 0);
    } else {
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw), want = new THREE.Vector3(c.x - fx * 9, c.y + 6.5 - pitch * 6, c.z - fz * 9);
      camera.position.lerp(want, Math.min(1, dt * 6)); camera.lookAt(c.x + fx * 3, c.y + 1, c.z + fz * 3);
    }
  },
  hud() {
    const c = this.player; if (!c) return;
    const sp = mph(c.v), over = sp > 25;
    let line = c.cop ? `🚓 POLICE · lights ${this.lights ? 'ON' : 'off'} · siren ${this.siren ? 'ON' : 'off'}` : '';
    if (this.rental) { const s = Math.floor((Date.now() - this.rental.t0) / 1000); line = `RENTAL ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} · ${money(this.rental.paid * 5)} · $5 per started minute`; }
    $('dspd').textContent = sp; $('dspd').classList.toggle('over', over && !c.cop);
    $('dinfo').textContent = this.frozen ? 'PULLED OVER · ' + this.frozen : line;
    $('dkeys').innerHTML = isTouch ? '' : `${KB('E', 'B')}exit ${KB('V', 'Y')}${this.cam === 'cab' ? 'top view' : 'driver view'}${c.cop ? ` ${KB('H', 'RB')}siren ${KB('L', 'LB')}lights` : ''} ${KB('Space', 'A')}brake${usingPad ? ` ${XB('RT')}gas ${XB('LT')}brake/reverse` : ''}`;
  },
  toggleCam() { this.cam = this.cam === 'cab' ? 'chase' : 'cab'; pitch = this.cam === 'cab' ? -.05 : .1; },
  /* ---- per frame: NPCs, walkers in the way, prompts, pull-overs by a player cop ---- */
  update(dt, now) {
    if (this.pending && now - this.pending.t > 3000) { const p = this.pending; this.pending = null; if (p.car.kind === 'parked') this.enter(p.car); }   // server silent: drive anyway
    const t = Rail.now(), o = this._o || (this._o = {});
    const fr = this._fr || (this._fr = new THREE.Frustum()), pm = this._pm || (this._pm = new THREE.Matrix4());
    camera.updateMatrixWorld(); pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); fr.setFromProjectionMatrix(pm);
    const ph = Math.floor(now / 180) % 2;
    for (const c of this.list) {
      if (c.kind !== 'npc') continue;
      const N = c.npc, px = c.x, pz = c.z;
      if (!N.ov) {
        if (!npcAt(c, t, o)) continue;
        c.x = o.x; c.z = o.z; c.v = o.v; c.br = o.br;
        const dh = wrapA(o.h - c.h); c.h = Math.abs(dh) > 2.5 || !N.seen ? o.h : c.h + dh * Math.min(1, dt * 6);
        if (o.rr && c.v > 1) N.redT = now;
        N.seen = true;
      } else if (N.ov.fn) N.ov.fn(c, dt, now, t);
      this.setBrake(c, Math.abs(c.v) < .3 || (c.pv ?? c.v) - c.v > .5 * dt); c.pv = c.v;   // braking: slowing hard, or stopped
      const far = Math.abs(c.x - P.x) > 300 || Math.abs(c.z - P.z) > 300;
      if (far) { c.y = terrainY(c.x, c.z); c.pt = c.rl = 0; } else this.pose(c, Math.hypot(c.x - px, c.z - pz) > 8);
      this.place(c);
      if (c.cop) this.setFlash(c, c.flash, ph);
    }
    for (const c of this.list) if (c.kind === 'remote' && c.cop) this.setFlash(c, c.flash, ph);
    for (const P2 of this.parts) { if (P2.dirty) { this.flushRanges(P2); P2.dirty = false; } if (P2.cdirty) { P2.mesh.instanceColor.needsUpdate = true; P2.cdirty = false; } }
    this.knockWalkers();
    if (!this.player) this.pushPlayer();
    // prompt
    this.lookCar = started ? this.look() : null; const lc = this.lookCar;
    carHint = lc ? (lc.cop ? `Police car · ${USE()} to drive it on patrol (free)` : Profile.canAfford(5) ? `${USE()}: Rent for $5/min (charged per started minute)` : `Rent for $5/min · you need at least $5`) : '';
    if (this.player && this.player.cop) this.copWork(dt, now, t);
    else if (this.offenders.length) { for (const s of this.offenders) s.visible = false; }
    this.updateGoal();
    if (this.player) Siren.update(this.player.cop && this.siren);
  },
  pushPlayer() {   // cars are solid; a moving one gives you a small shove
    for (const c of this.list) {
      if (Math.abs(c.x - P.x) > 5 || Math.abs(c.z - P.z) > 5 || P.y > c.y + 1.55 || P.y + 1.7 < c.y) continue;
      const p = this.boxPush(c, P.x, P.z, R); if (!p) continue;
      P.x += p[0]; P.z += p[1];
      if (Math.abs(c.v) > 2) { const L = Math.hypot(p[0], p[1]) || 1; V.x += p[0] / L * 3; V.z += p[1] / L * 3; V.y = Math.max(V.y, 2); if (performance.now() - (this.bumpT || 0) > 2500) { this.bumpT = performance.now(); toast('Watch out for cars!', 'bad'); } }
    }
  },
  knockWalkers() {
    for (const c of this.list) {
      if (Math.abs(c.v) < 1.5 || (c.kind === 'npc' && (Math.abs(c.x - P.x) > 200 || Math.abs(c.z - P.z) > 200))) continue;
      for (const pp of people) {
        if (pp.knock || pp.cfa || Math.abs(pp.x - c.x) > 3.5 || Math.abs(pp.z - c.z) > 3.5) continue;
        if (!this.boxPush(c, pp.x, pp.z, .4)) continue;
        const k = Math.sign(c.v) * Math.min(9, Math.abs(c.v) * .7), vx = Math.sin(c.h) * k, vz = Math.cos(c.h) * k;
        knockWalker(pp, vx, vz);
        if (c === this.player && netSock && netSock.readyState === 1) netSock.send(JSON.stringify({ t: 'evt', k: 'knock', a: [+pp.x.toFixed(1), +pp.z.toFixed(1), +vx.toFixed(1), +vz.toFixed(1)] }));
      }
    }
  },
  /* ---- player cop: flag offenders, pull them over with the siren on ---- */
  copWork(dt, now, t) {
    const me = this.player, fx = Math.sin(me.h), fz = Math.cos(me.h); let shown = 0, cand = null;
    for (const c of this.list) {
      if (c.kind !== 'npc' || c.cop) continue;
      const N = c.npc, d = Math.hypot(c.x - me.x, c.z - me.z); if (d > 45) continue;
      const speeding = c.v > LIMIT + .5, red = N.redT && now - N.redT < 15000;
      if (speeding || red) N.flagT = now;
      if (N.flagT && now - N.flagT < 10000 && !N.ov && shown < 4) {
        offenderTag(shown++, c, speeding ? mph(c.v) + ' MPH' : 'RAN RED');
        const ahead = ((c.x - me.x) * fx + (c.z - me.z) * fz) / (d || 1);
        if (d < 10 && ahead > .3) cand = c;
      }
    }
    for (let i = shown; i < this.offenders.length; i++) this.offenders[i].visible = false;
    const pl = this.pull;
    if (!pl) {
      if (cand && this.siren) { this.pullCand = this.pullCand === cand ? cand : (this.pullT = 0, cand); this.pullT += dt; carHint = `Stay behind them with the siren on… ${Math.max(0, 3 - this.pullT).toFixed(1)}s`; if (this.pullT >= 3) this.startPull(cand, true); }
      else if (cand) { carHint = `Offender ahead · turn on the siren (${KB('H', 'RB')}) and stay behind them to pull them over`; this.pullT = 0; }
      else this.pullT = 0;
    } else {
      const c = pl.car, d = Math.hypot(c.x - me.x, c.z - me.z);
      if (c.npc.ov && c.npc.ov.s === 'pulled' && c.v < .3) {
        if (d < 12) { pl.t += dt; carHint = `Writing the ticket… ${Math.max(0, 2 - pl.t).toFixed(1)}s`; if (pl.t >= 2) { Profile.earn(5, 'pull-over'); toast('Ticket issued. Nice police work!', ''); this.releasePull(c, true); this.pull = null; } }
        else carHint = 'Pull up behind the stopped car to write the ticket';
      }
    }
  },
  startPull(c, local) {
    const N = c.npc; N.ov = { s: 'pulled', t: 0, fn: civPulled };
    if (local) { this.pull = { car: c, t: 0 }; this.pullT = 0; toast('They are pulling over…', 'info'); sendEvt('pulled', [c.id, +c.x.toFixed(1), +c.z.toFixed(1), +c.h.toFixed(2)]); }
  },
  releasePull(c, local) { c.npc.ov = { s: 'leave', t: 0, fn: npcLeave }; if (local) sendEvt('free', [c.id]); },
  /* ---- while in debt: point the way to the Chick-fil-A counter ---- */
  updateGoal() {
    const show = started && Profile.inDebt() && CFA.door;
    if (!this.beam && CFA.door) { this.beam = new THREE.Mesh(new THREE.BoxGeometry(1.2, 60, 1.2), new THREE.MeshBasicMaterial({ color: 0xffcf3a, transparent: true, opacity: .45, depthWrite: false })); this.beam.position.set(CFA.door[0], terrainY(...CFA.door) + 30, CFA.door[1]); scene.add(this.beam); }
    if (this.beam) this.beam.visible = !!show;
    $('goal').hidden = !show; if (!show) return;
    const dx = CFA.door[0] - P.x, dz = CFA.door[1] - P.z, d = Math.hypot(dx, dz);
    const rel = wrapA(Math.atan2(-dx, -dz) - yaw);   // 0 = straight ahead
    $('garrow').style.transform = `rotate(${-rel}rad)`;
    $('gdist').textContent = d < 15 ? 'Chick-fil-A is here: step behind the counter' : `Chick-fil-A (Breen) · ${Math.round(d)} m`;
  },
  /* ---- multiplayer ---- */
  applyServer(list) {   // [[id, x, z, h, driver]] from the Worker
    for (const [id, x, z, h, d] of list) {
      const c = this.list[id]; if (!c || id >= this.parked || c === this.player) continue;
      if (x != null && !d) { c.x = x; c.z = z; c.h = h; c.kind = 'parked'; c.v = 0; this.pose(c, true); this.place(c); }
      if (d && d !== myId) c.kind = 'remote';
    }
  },
  onCar(m) {
    const c = this.list[m.id]; if (!c || m.id >= this.parked || c === this.player) return;
    if (m.d) { if (m.d !== myId) c.kind = 'remote'; return; }
    c.kind = 'parked'; c.v = 0; c.flash = false; this.setFlash(c, false); this.setBrake(c, false);
    if (m.x != null) { c.x = m.x; c.z = m.z; c.h = m.h; this.pose(c, true); this.place(c); }
  },
  onEvt(m) {
    const a = m.a || [];
    if (m.k === 'knock') { let b = null, bd = 4; for (const pp of people) { const d = Math.hypot(pp.x - a[0], pp.z - a[1]); if (!pp.knock && !pp.cfa && d < bd) { bd = d; b = pp; } } if (b) knockWalker(b, a[2], a[3]); }
    else if (m.k === 'po') { const cop = Cops.list[a[0]]; if (cop && cop.state === 'patrol') Cops.pullOver(cop, { x: a[1], z: a[2], h: a[3] }, null); }
    else if (m.k === 'pulled') { const c = this.list[a[0]]; if (c && c.npc && !c.npc.ov) { c.x = a[1]; c.z = a[2]; c.h = a[3]; this.startPull(c, false); } }
    else if (m.k === 'free') { const c = this.list[a[0]]; if (c && c.npc && c.npc.ov && c.npc.ov.s === 'pulled') this.releasePull(c, false); }
    else if (m.k === 'chase' || m.k === 'caught' || m.k === 'calm') Bank.onEvt(m);
  },
};
let carHint = '';
const sendEvt = (k, a) => { if (netSock && netSock.readyState === 1) netSock.send(JSON.stringify({ t: 'evt', k, a })); };
// a pulled-over civilian: brake to a stop where it is and wait
function civPulled(c, dt) { const ov = c.npc.ov; ov.t += dt; c.v = Math.max(0, c.v - 6 * dt); Vehicles.drive(c, dt); if (ov.t > 90) Vehicles.releasePull(c, false); }
// back onto the schedule: pull away for a few seconds, then snap to the scheduled spot once nobody is looking (or after 12 s)
function npcLeave(c, dt, now, t) {
  const ov = c.npc.ov; ov.t += dt; c.v = Math.min(9, c.v + 3 * dt); c.flash = false;
  if (ov.t < 4) { Vehicles.drive(c, dt); return; }
  const o = npcAt(c, t, {}); if (!o) { c.npc.ov = null; return; }
  const seen = s => Vehicles._fr.intersectsSphere(new THREE.Sphere(new THREE.Vector3(s.x, terrainY(s.x, s.z) + 1, s.z), 3));
  if (Math.hypot(o.x - c.x, o.z - c.z) < 4 || ov.t > 12 || (!seen(c) && !seen(o))) { c.npc.ov = null; c.npc.seen = false; }
  else Vehicles.drive(c, dt);
}
const offenderTex = {};
function offenderTag(i, c, text) {
  let s = Vehicles.offenders[i];
  if (!s) { s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false, fog: false })); s.scale.set(2.6, .65, 1); scene.add(s); Vehicles.offenders[i] = s; }
  if (!offenderTex[text]) { const t = nameTag(text).material.map; offenderTex[text] = t; }
  if (s.material.map !== offenderTex[text]) { s.material.map = offenderTex[text]; s.material.color.set(0xffb0b0); s.material.needsUpdate = true; }
  s.position.set(c.x, c.y + 2.6, c.z); s.visible = true;
}
// a walker hit by a car tips over, slides, lies there a few seconds and gets back up (updatePeople runs it)
function knockWalker(pp, vx, vz) {
  pp.knock = { t: 0, vx, vz, h: Math.atan2(vx, vz) }; pp.g.rotation.order = 'YXZ'; pp.bubble.visible = false;
}
function updateKnock(pp, dt) {
  const K = pp.knock; K.t += dt; const t = K.t;
  if (t < 1.2) { const k = Math.exp(-t * 3); pp.x += K.vx * k * dt; pp.z += K.vz * k * dt; }
  const fall = t < .5 ? t / .5 : t < 4.5 ? 1 : t < 5.3 ? 1 - (t - 4.5) / .8 : 0;
  pp.g.rotation.set(Math.PI / 2 * Math.sin(fall * Math.PI / 2), K.h, 0);
  pp.g.position.set(pp.x, groundAt(pp.x, pp.z) + .15 * fall, pp.z);
  pp.legL.rotation.x = pp.legR.rotation.x = 0; pp.armL.rotation.x = pp.armR.rotation.x = -fall * 2.6;
  if (t > 5.3) { pp.knock = null; pp.g.rotation.set(0, K.h, 0); pp.g.rotation.order = 'XYZ'; }
}

