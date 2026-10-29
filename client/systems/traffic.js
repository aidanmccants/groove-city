/* ---------------- traffic lights ----------------
   Traffic.plan() finds real intersections of car roads in D.lines (three or more arms, at least two roads), scores them
   (Main / Broad and downtown first) and keeps the top dozen. Each intersection: { id, name, x, z, r (stop-line radius),
   arms: [{ u: [ux, uz] pointing out from the centre, w, axis, name }] }. Phases run off Date.now() with a per-intersection
   offset, so all clients agree. Headings are Math.atan2(dx, dz) of the direction of travel (as model rotation.y). */
const Traffic = {
  lights: [], G: [28, 20], Y: 4, AR: 2,
  plan() {
    if (this.planned) return; this.planned = true;
    const RANK = { primary: 4, secondary: 3, tertiary: 2, unclassified: 2, residential: 1 }, nodes = new Map(), key = q => q[0].toFixed(1) + ',' + q[1].toFixed(1);
    for (const l of D.lines) if (CAR_KINDS.includes(l.k) && !l.br && !l.tu) l.p.forEach((q, i) => {
      if (!nodes.has(key(q))) nodes.set(key(q), { q, arms: [] }); const N = nodes.get(key(q));
      for (const dir of [-1, 1]) if (i + dir >= 0 && i + dir < l.p.length) N.arms.push({ l, i, dir });
    });
    const cand = [];
    for (const N of nodes.values()) {
      const [x, z] = N.q; if (N.arms.length < 3 || Math.abs(x) > W / 2 - 30 || Math.abs(z) > H / 2 - 30) continue;
      const arms = [];
      for (const a of N.arms) {   // aim each arm at a point ~12 m out along its road
        let j = a.i, left = 12, px = x, pz = z;
        while (left > 0 && j + a.dir >= 0 && j + a.dir < a.l.p.length) { const q = a.l.p[j + a.dir], L = Math.hypot(q[0] - px, q[1] - pz); if (L >= left) { px += (q[0] - px) * left / L; pz += (q[1] - pz) * left / L; left = 0; } else { px = q[0]; pz = q[1]; left -= L; j += a.dir; } }
        const L = Math.hypot(px - x, pz - z); if (L < 2) continue;
        const arm = { u: [(px - x) / L, (pz - z) / L], w: a.l.w, rank: RANK[a.l.k] || 1, name: a.l.n || '' };
        const dup = arms.find(o => o.u[0] * arm.u[0] + o.u[1] * arm.u[1] > Math.cos(25 * Math.PI / 180));
        if (dup) { if (arm.rank > dup.rank) Object.assign(dup, arm); } else arms.push(arm);
      }
      const names = new Set(arms.map(a => a.name)), maxR = Math.max(...arms.map(a => a.rank));
      if (arms.length < 3 || names.size < 2 || (maxR < 2 && arms.length < 4)) continue;
      if (Rail.crossings.some(c => Math.hypot(c.x - x, c.z - z) < 45)) continue;
      let score = arms.reduce((s, a) => s + a.rank, 0) + (arms.length >= 4 ? 4 : 0) + ([...names].some(n => /Broad|Main/.test(n)) ? 3 : 0) + (x < -480 ? 2 : 0);
      cand.push({ x, z, arms, score, name: [...names].filter(Boolean).join(' & ') });
    }
    cand.sort((a, b) => b.score - a.score);
    for (const c of cand) {
      if (this.lights.length >= 12) break;
      if (this.lights.some(o => Math.hypot(o.x - c.x, o.z - c.z) < 60)) continue;
      const A = c.arms.reduce((b, a) => a.rank > b.rank ? a : b, c.arms[0]);
      for (const a of c.arms) a.axis = Math.abs(a.u[0] * A.u[0] + a.u[1] * A.u[1]) > Math.cos(45 * Math.PI / 180) ? 0 : 1;
      c.r = Math.max(...c.arms.map(a => a.w)) / 2 + 2.2; c.id = this.lights.length; c.off = hash(c.x * 0.37 + c.z * 1.91) * 100;
      this.lights.push(c);
    }
  },
  paint(g) {   // stop lines across each approach lane
    this.plan(); g.strokeStyle = '#ecebe4'; g.lineWidth = 0.55 * SS; g.lineCap = 'butt';
    for (const I of this.lights) for (const a of I.arms) {
      const cx = I.x + a.u[0] * (I.r + .3), cz = I.z + a.u[1] * (I.r + .3), rx = a.u[1], rz = -a.u[0];   // right of a car arriving along -u
      g.beginPath(); g.moveTo(gx(cx + rx * .3), gz(cz + rz * .3)); g.lineTo(gx(cx + rx * (a.w / 2 - .3)), gz(cz + rz * (a.w / 2 - .3))); g.stroke();
    }
    g.lineCap = 'round';
  },
  cycle() { return this.G[0] + this.G[1] + 2 * (this.Y + this.AR); },
  axisState(I, axis, t = Rail.now()) {
    const C = this.cycle(), u = ((t + I.off) % C + C) % C, g0 = this.G[0], b0 = g0 + this.Y + this.AR;
    if (axis === 0) return u < g0 ? 'green' : u < g0 + this.Y ? 'yellow' : 'red';
    return u >= b0 && u < b0 + this.G[1] ? 'green' : u >= b0 + this.G[1] && u < b0 + this.G[1] + this.Y ? 'yellow' : 'red';
  },
  armFor(I, heading) { const vx = -Math.sin(heading), vz = -Math.cos(heading); let b = null, bd = -2; for (const a of I.arms) { const d = a.u[0] * vx + a.u[1] * vz; if (d > bd) { bd = d; b = a; } } return b; },
  // signal facing a vehicle heading `heading` into intersection I (object or id)
  stateFor(I, heading, t) { if (typeof I === 'number') I = this.lights[I]; const a = this.armFor(I, heading); return a ? this.axisState(I, a.axis, t) : 'green'; },
  nearest(x, z, maxD = 1e9) { let b = null, bd = maxD; for (const I of this.lights) { const d = Math.hypot(I.x - x, I.z - z); if (d < bd) { bd = d; b = I; } } return b; },
  // crossed a stop line on red between prev and pos? returns the intersection or null. Points as [x, z] or {x, z}
  ranRed(prev, pos, heading) {
    const px = prev.x ?? prev[0], pz = prev.z ?? prev[1], x = pos.x ?? pos[0], z = pos.z ?? pos[1];
    for (const I of this.lights) {
      const d1 = Math.hypot(x - I.x, z - I.z); if (d1 > I.r) continue;
      if (Math.hypot(px - I.x, pz - I.z) > I.r && this.stateFor(I, heading) === 'red') return I;
    }
    return null;
  },
  build() {
    this.plan();
    const parts = [], lamps = [];
    for (const I of this.lights) for (const a of I.arms) {
      // far-side mast: on the right of traffic arriving along -u, beyond the intersection, facing back at it
      const d = [-a.u[0], -a.u[1]], right = [-d[1], d[0]], face = Math.atan2(a.u[0], a.u[1]);
      const lat = a.w / 2 + 1.2, px = I.x + d[0] * I.r + right[0] * lat, pz = I.z + d[1] * I.r + right[1] * lat, gy = terrainY(px, pz);
      const reach = lat - a.w / 4, hx = px - right[0] * reach, hz = pz - right[1] * reach;
      parts.push({ p: [px, gy + 3.2, pz], s: [.24, 6.4, .24], col: '#55595c' });
      parts.push({ p: [(px + hx) / 2, gy + 6.1, (pz + hz) / 2], s: [reach + .3, .14, .14], r: [0, face, 0], col: '#55595c' });
      parts.push({ p: [hx, gy + 5.2, hz], s: [.46, 1.3, .32], r: [0, face, 0], col: '#2d2e22' });
      parts.push({ p: [hx - a.u[0] * .04, gy + 5.2, hz - a.u[1] * .04], s: [.8, 1.6, .04], r: [0, face, 0], col: '#1a1b1c' });   // backplate
      const lz = [Math.sin(face), Math.cos(face)];
      ['red', 'yellow', 'green'].forEach((col, k) => lamps.push({ p: [hx + lz[0] * .17, gy + 5.6 - k * .4, hz + lz[1] * .17], s: [.26, .26, .05], r: [0, face, 0], col: '#222', I, a, col }));
      a.pole = [px, pz]; addTrunk(px, pz, 0.2);
    }
    instancedBoxes(new THREE.MeshLambertMaterial({ color: 0xffffff }), parts);
    this.lampList = lamps; this.lampMesh = lamps.length ? instancedBoxes(new THREE.MeshBasicMaterial({ color: 0xffffff }), lamps, false) : null;
    this.ON = { red: new THREE.Color(0xff2418), yellow: new THREE.Color(0xffb316), green: new THREE.Color(0x2bff6a) };
    this.OFF = { red: new THREE.Color(0x3a1210), yellow: new THREE.Color(0x3a2a0c), green: new THREE.Color(0x0f2a18) };
  },
  update() {
    if (!this.lampMesh) return;
    const t = Rail.now(); let dirty = false;
    this.lampList.forEach((l, i) => { const lit = this.axisState(l.I, l.a.axis, t) === l.col; if (lit !== l.lit) { l.lit = lit; dirty = true; this.lampMesh.setColorAt(i, (lit ? this.ON : this.OFF)[l.col]); } });
    if (dirty) this.lampMesh.instanceColor.needsUpdate = true;
  },
};

