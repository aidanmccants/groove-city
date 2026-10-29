/* ---------------- railroad: graded track, a freight train on a shared clock, crossing gates ----------------
   Rail.tracks are the OSM rail lines chained, smoothed and resampled every metre; each sample has a graded rail-top height.
   The train runs on Rail.main from a schedule keyed off Date.now(), so every client sees the same train at the same spot.
   Rail.crossings: { x, z, s, kind: 'road'|'foot', name, w, r, closed, gate (0 up .. 1 down) }; Rail.crossingBlocked(x, z)
   returns the closed crossing whose zone contains (x, z), so walkers (and cars) can hold short of it. */
const CAR_KINDS = ['primary', 'secondary', 'tertiary', 'residential', 'unclassified'];
const cboxGeo = new THREE.BoxGeometry(1, 1, 1), rdummy = new THREE.Object3D();
// boxes with full rotation: items { p: [x, y, z] (centre), s: [sx, sy, sz], r: [rx, ry, rz] ('YXZ'), col }
function instancedBoxes(mat, list, shadow = true) {
  const m = new THREE.InstancedMesh(cboxGeo, mat, Math.max(1, list.length)); m.count = list.length; const c = new THREE.Color();
  list.forEach((k, i) => { rdummy.position.set(...k.p); rdummy.scale.set(...k.s); rdummy.rotation.set(...(k.r || [0, 0, 0]), 'YXZ'); rdummy.updateMatrix(); m.setMatrixAt(i, rdummy.matrix); m.setColorAt(i, c.set(k.col || '#ffffff')); });
  m.castShadow = shadow; m.receiveShadow = true; scene.add(m); return m;
}
function cylBuf(B, axis, cx, cy, cz, r, len, segs, col) {   // prism of `segs` sides along x or z, centred on (cx, cy, cz)
  const P = (a, t) => axis === 'x' ? [cx + t, cy + Math.sin(a) * r, cz + Math.cos(a) * r] : [cx + Math.cos(a) * r, cy + Math.sin(a) * r, cz + t];
  const ax = axis === 'x' ? [1, 0, 0] : [0, 0, 1];
  for (let i = 0; i < segs; i++) {
    const a0 = i / segs * Math.PI * 2, a1 = (i + 1) / segs * Math.PI * 2, am = (a0 + a1) / 2;
    const hint = axis === 'x' ? [0, Math.sin(am), Math.cos(am)] : [Math.cos(am), Math.sin(am), 0];
    B.quad(P(a0, -len / 2), P(a1, -len / 2), P(a1, len / 2), P(a0, len / 2), [0, 0], [1, 0], [1, 1], [0, 1], col, hint);
    for (const e of [-1, 1]) B.tri(P(a0, e * len / 2), P(a1, e * len / 2), axis === 'x' ? [cx + e * len / 2, cy, cz] : [cx, cy, cz + e * len / 2], [0, 0], [1, 0], [.5, .5], col, ax.map(v => v * e));
  }
}
const Rail = {
  tracks: [], main: null, crossings: [], units: [], timeShift: 0, SLOT: 330,
  now() { return netNow() / 1000 + this.timeShift; },
  plan() {
    if (this.tracks.length) return;
    const eq = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.5, pcs = D.lines.filter(l => l.k === 'rail').map(l => l.p.map(q => q.slice()));
    for (let joined = true; joined;) {   // chain pieces end to end; whatever is left over is a spur
      joined = false;
      for (let i = 0; i < pcs.length && !joined; i++) for (let j = 0; j < pcs.length && !joined; j++) {
        if (i === j) continue; const A = pcs[i], B = pcs[j];
        if (eq(A[A.length - 1], B[0])) pcs[i] = A.concat(B.slice(1)); else if (eq(A[A.length - 1], B[B.length - 1])) pcs[i] = A.concat(B.slice(0, -1).reverse()); else continue;
        pcs.splice(j, 1); joined = true;
      }
    }
    const len = p => p.reduce((s, q, i) => i ? s + Math.hypot(q[0] - p[i - 1][0], q[1] - p[i - 1][1]) : 0, 0);
    pcs.sort((a, b) => len(b) - len(a));
    for (const p of pcs) this.tracks.push(this.makeTrack(p, this.tracks.length === 0));
    this.main = this.tracks[0];
    for (const T of this.tracks.slice(1)) for (const e of [0, T.n - 1]) {   // snap spur ends onto the smoothed main line
      const m = this.nearest(this.main, T.x[e], T.z[e]); if (m && m.d < 3) { T.x[e] = this.main.x[m.i]; T.z[e] = this.main.z[m.i]; }
    }
    for (const T of this.tracks) this.findCrossings(T);
    for (const T of this.tracks) this.grade(T);
  },
  makeTrack(p, main) {
    const pts = [p[0]];   // resample every metre
    for (let i = 1, carry = 0; i < p.length; i++) {
      const a = p[i - 1], b = p[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]); let t = 1 - carry;
      for (; t <= L; t += 1) pts.push([a[0] + (b[0] - a[0]) * t / L, a[1] + (b[1] - a[1]) * t / L]);
      carry = L - (t - 1);
    }
    const end = p[p.length - 1]; if (Math.hypot(end[0] - pts[pts.length - 1][0], end[1] - pts[pts.length - 1][1]) > .3) pts.push(end); else pts[pts.length - 1] = end;
    const n = pts.length, K = 12, x = new Float64Array(n), z = new Float64Array(n);
    for (let i = 0; i < n; i++) {   // moving average with the ends pinned rounds off OSM's corners into curves
      const h = Math.min(K, i, n - 1 - i); let sx = 0, sz = 0;
      for (let j = i - h; j <= i + h; j++) { sx += pts[j][0]; sz += pts[j][1]; }
      x[i] = sx / (2 * h + 1); z[i] = sz / (2 * h + 1);
    }
    const T = { main, n, x, z, s: new Float64Array(n), nx: new Float32Array(n), nz: new Float32Array(n), top: new Float32Array(n), tmax: new Float32Array(n), wx: new Float32Array(n), core: new Int8Array(n), inside: new Uint8Array(n), i0: -1, i1: -1, crossings: [] };
    for (let i = 1; i < n; i++) T.s[i] = T.s[i - 1] + Math.hypot(x[i] - x[i - 1], z[i] - z[i - 1]);
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1), tx = x[b] - x[a], tz = z[b] - z[a], L = Math.hypot(tx, tz) || 1;
      T.nx[i] = -tz / L; T.nz[i] = tx / L;
      T.inside[i] = Math.abs(x[i]) < W / 2 - 1 && Math.abs(z[i]) < H / 2 - 1 ? 1 : 0;
      if (T.inside[i]) { if (T.i0 < 0) T.i0 = i; T.i1 = i; }
    }
    return T;
  },
  nearest(T, px, pz) {
    let b = null; for (let i = 0; i < T.n; i += 1) { const d = Math.hypot(T.x[i] - px, T.z[i] - pz); if (!b || d < b.d) b = { i, d }; } return b;
  },
  findCrossings(T) {
    if (T.i0 < 0) return;
    let bx0 = 1e9, bx1 = -1e9, bz0 = 1e9, bz1 = -1e9;
    for (let i = T.i0; i <= T.i1; i++) { bx0 = Math.min(bx0, T.x[i]); bx1 = Math.max(bx1, T.x[i]); bz0 = Math.min(bz0, T.z[i]); bz1 = Math.max(bz1, T.z[i]); }
    const found = [];
    for (const l of D.lines) {
      const road = CAR_KINDS.includes(l.k) || l.k === 'service', foot = ['footway', 'path', 'pedestrian', 'steps', 'cycleway'].includes(l.k);
      if ((!road && !foot) || l.br || l.tu) continue;
      if (!l.p.some(q => q[0] > bx0 - 20 && q[0] < bx1 + 20 && q[1] > bz0 - 20 && q[1] < bz1 + 20)) continue;
      for (let j = 0; j < l.p.length - 1; j++) {
        const c = l.p[j], d = l.p[j + 1];
        for (let i = T.i0; i < T.i1; i++) {
          const ax = T.x[i], az = T.z[i], bx = T.x[i + 1], bz = T.z[i + 1];
          if (Math.max(ax, bx) < Math.min(c[0], d[0]) || Math.min(ax, bx) > Math.max(c[0], d[0]) || Math.max(az, bz) < Math.min(c[1], d[1]) || Math.min(az, bz) > Math.max(c[1], d[1])) continue;
          const den = (bx - ax) * (d[1] - c[1]) - (bz - az) * (d[0] - c[0]); if (Math.abs(den) < 1e-9) continue;
          const u = ((c[0] - ax) * (d[1] - c[1]) - (c[1] - az) * (d[0] - c[0])) / den, v = ((c[0] - ax) * (bz - az) - (c[1] - az) * (bx - ax)) / den;
          if (u < 0 || u > 1 || v < 0 || v > 1) continue;
          const rl = Math.hypot(d[0] - c[0], d[1] - c[1]) || 1, ru = [(d[0] - c[0]) / rl, (d[1] - c[1]) / rl], sin = Math.abs(ru[0] * T.nx[i] + ru[1] * T.nz[i]);
          found.push({ x: ax + (bx - ax) * u, z: az + (bz - az) * u, s: T.s[i] + (T.s[i + 1] - T.s[i]) * u, kind: road ? 'road' : 'foot', name: l.n || '', w: l.w, ru, sin, track: T, i, closed: false, gate: 0, light: 0 });
        }
      }
    }
    found.sort((a, b) => (a.kind === 'road' ? 0 : 1) - (b.kind === 'road' ? 0 : 1) || b.w - a.w);
    for (const c of found) {
      c.hl = Math.min(14, (c.w / 2) / Math.max(0.3, c.sin) + 1.2);
      const near = T.crossings.find(o => Math.abs(o.s - c.s) < o.hl + 6);
      if (near) { near.hl = Math.max(near.hl, Math.abs(c.s - near.s) + c.hl); continue; }   // a sidewalk beside the road joins its crossing
      c.r = Math.max(5, c.w / 2 + 4); T.crossings.push(c); this.crossings.push(c);
    }
  },
  grade(T) {
    const n = T.n, sm = (a, k) => { const ps = new Float64Array(n + 1), o = new Float32Array(n); for (let i = 0; i < n; i++) ps[i + 1] = ps[i] + a[i]; for (let i = 0; i < n; i++) { const lo = Math.max(0, i - k), hi = Math.min(n - 1, i + k); o[i] = (ps[hi + 1] - ps[lo]) / (hi - lo + 1); } return o; };
    for (let i = 0; i < n; i++) { const x = T.x[i], z = T.z[i], nx = T.nx[i] * 1.7, nz = T.nz[i] * 1.7; T.tmax[i] = Math.max(terrainY(x, z), terrainY(x + nx, z + nz), terrainY(x - nx, z - nz)); }
    let g = sm(T.tmax, 15); for (let i = 0; i < n; i++) g[i] = Math.max(g[i], T.tmax[i] + 0.04);
    g = sm(g, 4); for (let i = 0; i < n; i++) g[i] = Math.max(g[i], T.tmax[i] + 0.04);   // a graded bed that never dips into the hillside
    for (const c of T.crossings) for (let i = 0; i < n; i++) {
      const ds = Math.abs(T.s[i] - c.s); if (ds > c.hl + 12) continue;
      if (ds <= c.hl) { T.core[i] = c.kind === 'road' ? 1 : 2; T.wx[i] = 1; } else T.wx[i] = Math.max(T.wx[i], 1 - (ds - c.hl) / 12);
    }
    // rail head 0.33 m above the bed grade; at a crossing it eases down until it sits flush in the road
    const lift = T.main ? 0 : -0.03;   // spurs sit a hair lower so their bed never fights the main line's
    for (let i = 0; i < n; i++) { const w = T.wx[i]; T.top[i] = (g[i] + 0.33) * (1 - w) + (T.tmax[i] + 0.08) * w + lift; }
  },
  at(T, s, out) {   // position, rail-top height and heading at arc length s
    const S = T.s; s = Math.max(0, Math.min(S[T.n - 1], s)); let lo = 0, hi = T.n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] <= s) lo = m; else hi = m; }
    const f = (s - S[lo]) / ((S[hi] - S[lo]) || 1);
    out.x = T.x[lo] + (T.x[hi] - T.x[lo]) * f; out.z = T.z[lo] + (T.z[hi] - T.z[lo]) * f; out.y = T.top[lo] + (T.top[hi] - T.top[lo]) * f;
    out.inside = T.inside[lo] && T.inside[hi]; return out;
  },
  paint(g) {   // gravel shoulder under the 3D bed
    this.plan();
    for (const T of this.tracks) { g.beginPath(); for (let i = 0; i < T.n; i++) i ? g.lineTo(gx(T.x[i]), gz(T.z[i])) : g.moveTo(gx(T.x[i]), gz(T.z[i])); g.strokeStyle = '#7a7166'; g.lineWidth = 6.2 * SS; g.stroke(); g.strokeStyle = '#6b6258'; g.lineWidth = 4.6 * SS; g.stroke(); }
  },

  build() {
    this.plan();
    const ballast = new Buf(), steel = new Buf(), panel = new Buf(), ties = [], GA = 0.7175 + 0.036, HW = 0.036;
    const gravelTex = pix(16, 16, (g, w, h) => { const d = g.createImageData(w, h); for (let i = 0; i < d.data.length; i += 4) { const k = 95 + Math.random() * 90; d.data[i] = k * 1.02; d.data[i + 1] = k * .97; d.data[i + 2] = k * .9; d.data[i + 3] = 255; } g.putImageData(d, 0, 0); });
    const bcol = col3('#9a938a'), side = col3('#5d5a57'), head = col3('#c9c6c0'), road = col3('#4a4b4e'), plank = col3('#7d5f40'), edge = col3('#3a3b3d');
    seed = 7171;
    for (const T of this.tracks) {
      if (T.i0 < 0) continue;
      const V = (i, off, dy) => [T.x[i] + T.nx[i] * off, T.top[i] + dy, T.z[i] + T.nz[i] * off];
      const toe = (i, off) => { const x = T.x[i] + T.nx[i] * off, z = T.z[i] + T.nz[i] * off; return [x, terrainY(x, z) - 0.25, z]; };
      for (let i = T.i0; i < T.i1; i++) {
        const j = i + 1, ua = T.s[i] / 2, ub = T.s[j] / 2;
        if (!(T.core[i] && T.core[j])) {
          ballast.quad(V(i, -1.5, -.21), V(j, -1.5, -.21), V(j, 1.5, -.21), V(i, 1.5, -.21), [ua, 0], [ub, 0], [ub, 1.5], [ua, 1.5], bcol, [0, 1, 0]);
          for (const sg of [-1, 1]) ballast.quad(V(i, 1.5 * sg, -.21), V(j, 1.5 * sg, -.21), toe(j, 2.8 * sg), toe(i, 2.8 * sg), [ua, 0], [ub, 0], [ub, .6], [ua, .6], bcol, [T.nx[i] * sg, 1, T.nz[i] * sg]);
        } else {
          const c = T.core[i] === 1 ? road : plank, y = -.012;
          for (const [o0, o1] of [[-GA + HW + .02, GA - HW - .02], [GA + HW + .02, 1.7], [-1.7, -GA - HW - .02]]) panel.quad(V(i, o0, y), V(j, o0, y), V(j, o1, y), V(i, o1, y), [0, 0], [1, 0], [1, 1], [0, 1], c, [0, 1, 0]);
          for (const sg of [-1, 1]) panel.quad(V(i, 1.7 * sg, y), V(j, 1.7 * sg, y), [T.x[j] + T.nx[j] * 1.7 * sg, T.tmax[j] - .1, T.z[j] + T.nz[j] * 1.7 * sg], [T.x[i] + T.nx[i] * 1.7 * sg, T.tmax[i] - .1, T.z[i] + T.nz[i] * 1.7 * sg], [0, 0], [1, 0], [1, 1], [0, 1], edge, [T.nx[i] * sg, 0, T.nz[i] * sg]);
        }
        for (const sg of [-1, 1]) {   // two rails at 1435 mm gauge
          const o = GA * sg;
          steel.quad(V(i, o - HW, 0), V(j, o - HW, 0), V(j, o + HW, 0), V(i, o + HW, 0), [0, 0], [1, 0], [1, 1], [0, 1], head, [0, 1, 0]);
          for (const e of [-1, 1]) steel.quad(V(i, o + HW * e, 0), V(j, o + HW * e, 0), V(j, o + HW * e * 1.6, -.14), V(i, o + HW * e * 1.6, -.14), [0, 0], [1, 0], [1, 1], [0, 1], side, [T.nx[i] * e, 0, T.nz[i] * e]);
        }
      }
      const out = {};
      for (let s = T.s[T.i0]; s < T.s[T.i1]; s += 0.6) {   // ties every 60 cm, skipped where the crossing panels lie
        let i = Math.min(T.n - 1, Math.round(s)); while (i > 0 && T.s[i] > s) i--; while (i < T.n - 1 && T.s[i + 1] <= s) i++;
        if (T.core[i]) continue; this.at(T, s, out);
        const shade = 0.75 + rnd() * 0.35;
        ties.push({ p: [out.x, out.y - 0.21, out.z], s: [2.6, 0.16, 0.23], r: [0, Math.atan2(-T.nz[i], T.nx[i]) + (rnd() - .5) * .04, 0], col: new THREE.Color(0x5b4634).multiplyScalar(shade) });
      }
    }
    const bm = ballast.mesh(lambert(gravelTex)); bm.castShadow = false; scene.add(bm);
    scene.add(steel.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })));
    const pm = panel.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })); pm.castShadow = false; scene.add(pm);
    instancedBoxes(new THREE.MeshLambertMaterial({ color: 0xffffff }), ties, false);
    this.buildFloors(); this.buildGuards(); this.buildTrain();
  },
  buildFloors() {   // walk on the ties / crossing panels instead of sinking into the bed
    const grid = new Map(), C = 8;
    for (const T of this.tracks) for (let i = Math.max(0, T.i0); i <= T.i1; i++) { const k = Math.floor(T.x[i] / C) + ',' + Math.floor(T.z[i] / C); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(T, i); }
    floors.push((x, z) => {
      const L = grid.get(Math.floor(x / C) + ',' + Math.floor(z / C)); if (!L) return null;
      let bd = 2.2, by = null;
      for (let k = 0; k < L.length; k += 2) { const T = L[k], i = L[k + 1], d = Math.hypot(T.x[i] - x, T.z[i] - z); if (d < bd) { bd = d; by = T.core[i] ? T.top[i] - .012 : T.top[i] - .13; } }
      return bd < 1.6 ? by : null;
    });
  },
  buildGuards() {
    const parts = [], lamps = [], gateArm = new Buf(), red = col3('#c8202a'), white = col3('#f2f0ea');
    for (let x = 0.15, k = 0; x < 9; x += 0.9, k++) gateArm.box(x + .45, -.06, 0, .9, .12, .12, 0, k % 2 ? white : red);
    gateArm.box(-.55, -.18, 0, .7, .36, .26, 0, col3('#26282a'));
    const gateGeo = gateArm.mesh(null).geometry, gateMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    for (const c of this.crossings) {
      if (c.kind !== 'road') continue;
      const T = c.track, tn = [T.nx[c.i], T.nz[c.i]];
      let u = c.ru; if (u[0] * tn[0] + u[1] * tn[1] < 0) u = [-u[0], -u[1]];   // u points from the -n side to the +n side
      c.posts = [];
      for (const sg of [-1, 1]) {
        const d = [u[0] * -sg, u[1] * -sg];   // direction of travel for traffic arriving from the sg side
        const right = [-d[1], d[0]], back = Math.min(9, 3.8 / Math.max(.35, c.sin));
        const px = c.x - d[0] * back + right[0] * (c.w / 2 + .9), pz = c.z - d[1] * back + right[1] * (c.w / 2 + .9), gy = terrainY(px, pz);
        const face = Math.atan2(-d[0], -d[1]), lx = [Math.cos(face), -Math.sin(face)], lz = [Math.sin(face), Math.cos(face)];
        parts.push({ p: [px, gy + 2.1, pz], s: [.16, 4.2, .16], r: [0, face, 0], col: '#d9d9d4' });
        parts.push({ p: [px, gy + .25, pz], s: [.5, .5, .5], r: [0, face, 0], col: '#8a8a86' });
        for (const a of [Math.PI / 4, -Math.PI / 4]) parts.push({ p: [px + lz[0] * .1, gy + 3.75, pz + lz[1] * .1], s: [1.35, .22, .03], r: [0, face, a], col: '#f4f4ef' });
        parts.push({ p: [px + lz[0] * .06, gy + 2.75, pz + lz[1] * .06], s: [1.7, .12, .12], r: [0, face, 0], col: '#1d1e20' });
        const L = [];
        for (const e of [-1, 1]) {
          const hx = px + lx[0] * .62 * e + lz[0] * .13, hz = pz + lx[1] * .62 * e + lz[1] * .13;
          parts.push({ p: [hx - lz[0] * .05, gy + 2.75, hz - lz[1] * .05], s: [.5, .5, .1], r: [0, face, 0], col: '#141516' });   // black target disc
          L.push(lamps.length); lamps.push({ p: [hx + lz[0] * .02, gy + 2.75, hz + lz[1] * .02], s: [.3, .3, .06], r: [0, face, 0], col: '#3a0d0d', c, e });
        }
        // gate: pivots about the road axis next to the post; arm reaches across the approach lane
        const piv = new THREE.Group(); piv.position.set(px + right[0] * -.35, gy + 1.05, pz + right[1] * -.35);
        piv.rotation.set(0, Math.atan2(d[0], d[1]), Math.PI / 2 * .96, 'YXZ');
        const arm = new THREE.Mesh(gateGeo, gateMat); arm.scale.x = (c.w / 2 + .6) / 9; arm.castShadow = true; piv.add(arm); scene.add(piv);
        parts.push({ p: [piv.position.x, gy + .55, piv.position.z], s: [.32, 1.1, .32], r: [0, face, 0], col: '#2b2d2f' });
        c.posts.push({ piv, lamps: L, x: px, z: pz });
      }
    }
    instancedBoxes(new THREE.MeshLambertMaterial({ color: 0xffffff }), parts);
    this.lampMesh = lamps.length ? instancedBoxes(new THREE.MeshBasicMaterial({ color: 0xffffff }), lamps, false) : null; this.lampList = lamps;
  },

  /* ---- the train ---- */
  TYPES: {
    loco: { L: 21.5, bog: 3, cols: ['#1e3d6b', '#202022', '#b8502a', '#2c4f2c', '#8b1a1a', '#c9a227'] },
    box: { L: 15.6, bog: 2, cols: ['#7b2f22', '#8a3a1c', '#3d5a7a', '#2f5a3a', '#b08a2a', '#5a2a2a', '#9b9184', '#6d2b1c', '#c46a2a'] },
    hopper: { L: 15, bog: 2, cols: ['#c9c4b8', '#9a9590', '#b9a27c', '#5e6a77', '#d8d2c4', '#7c3a2a'] },
    tank: { L: 17, bog: 2, cols: ['#1f2022', '#d9d9d4', '#2a2c30', '#8d9095', '#e3e0d6', '#2f4a6a'] },
    flat: { L: 18, bog: 2, cols: ['#4a3a30', '#5a2a22', '#2f3338', '#3e4a3a'] },
    gondola: { L: 16, bog: 2, cols: ['#3e3a36', '#5b3524', '#2f3b4a', '#6b5a2a', '#4d2a24'] },
  },
  carGeo(type) {
    const B = new Buf(), Wt = col3('#ffffff'), dk = col3('#2a2a2a', 1), gl = col3('#5a6570'), mid = col3('#cfcfcf'), L = this.TYPES[type].L;
    const box = (x, y, z, sx, sy, sz, c) => B.box(x, y, z, sx, sy, sz, 0, c);
    if (type === 'loco') {
      box(0, .95, 0, 3.1, .35, L, dk); box(0, .35, 0, 2.4, .6, 7, dk);                      // frame, fuel tank
      box(0, 1.3, -2.3, 2.3, 2.9, 12.6, Wt); box(0, 1.3, 6.4, 3.05, 3.25, 3.4, Wt);          // long hood, cab
      box(0, 4.55, 6.4, 3.15, .15, 3.6, dk); box(0, 1.3, 9.3, 2.3, 1.6, 2.2, Wt);           // cab roof, short nose
      box(0, 3.15, 8.11, 2.7, .85, .02, gl); for (const e of [-1, 1]) box(e * 1.53, 3.1, 6.6, .02, .8, 1.8, gl);
      box(0, 4.2, -6.5, 2, .15, 3.5, dk); box(0, 4.2, -1.5, .5, .5, .8, dk);                  // fans, exhaust stack
      box(0, .1, 10.5, 3, .8, .35, dk); box(0, .1, -10.5, 3, .8, .35, dk);                     // pilots
      for (const e of [-1, 1]) { box(e * 1.5, 2.1, 0, .05, .05, L - 1.5, mid); for (let z = -9.5; z < 5; z += 2.4) box(e * 1.5, 1.3, z, .05, .8, .05, mid); }
    } else if (type === 'box') {
      box(0, .95, 0, 2.9, .3, L, dk); box(0, 1.25, 0, 3.1, 3.3, L - .4, Wt); box(0, 4.55, 0, 3.2, .12, L - .3, mid);
      for (const e of [-1, 1]) { box(e * 1.56, 1.35, 0, .05, 3.0, 3.0, mid); for (let z = -L / 2 + 1; z < L / 2 - .5; z += 1.3) if (Math.abs(z) > 1.8) box(e * 1.56, 1.25, z, .04, 3.3, .1, mid); }
    } else if (type === 'hopper') {
      box(0, 1.5, 0, 3.1, 2.9, L - 1, Wt); box(0, 4.4, 0, 2.9, .08, L - 1.3, mid); box(0, 4.48, 0, .6, .06, L - .6, dk);
      for (const z of [-4.6, 0, 4.6]) box(0, .45, z, 2.2, 1.1, 2.8, Wt);
      for (const e of [-1, 1]) { box(0, .95, e * (L / 2 - .4), 2.9, .5, .8, dk); for (let z = -L / 2 + 1.5; z < L / 2 - 1; z += 1.5) box(e * 1.56, 1.5, z, .05, 2.9, .12, mid); }
    } else if (type === 'tank') {
      box(0, .95, 0, 2.2, .3, L, dk); cylBuf(B, 'z', 0, 2.65, 0, 1.45, L - 1.6, 12, Wt);
      box(0, 4.0, 0, 1.0, .35, 1.0, Wt); box(0, 3.9, 0, 2.2, .06, 1.6, dk); for (const e of [-1, 1]) box(0, 1.25, e * (L / 2 - .9), 2.6, 1.0, .25, dk);
    } else if (type === 'flat') {
      box(0, .85, 0, 2.9, .4, L, Wt); box(0, .55, 0, .6, .3, L - 2, dk);
    } else if (type === 'gondola') {
      box(0, .9, 0, 2.9, .35, L, dk); for (const e of [-1, 1]) { box(e * 1.45, 1.25, 0, .1, 1.5, L, Wt); box(0, 1.25, e * (L / 2 - .05), 2.9, 1.5, .1, Wt); }
      for (let z = -L / 2 + 1; z < L / 2; z += 1.6) for (const e of [-1, 1]) box(e * 1.51, 1.25, z, .04, 1.5, .1, mid);
      box(0, 1.25, 0, 2.7, 1.1, L - .3, col3('#3b342e'));
    }
    return B.mesh(null).geometry;
  },
  bogieGeo(axles) {
    const B = new Buf(), dk = col3('#202122'), wh = col3('#3a3836'), sp = axles === 3 ? 1.75 : 1.8, len = sp * (axles - 1) + 1.4;
    for (const e of [-1, 1]) B.box(e * .85, .25, 0, .18, .5, len, 0, dk);
    B.box(0, .55, 0, 1.9, .3, .7, 0, dk);
    for (let a = 0; a < axles; a++) { const z = (a - (axles - 1) / 2) * sp; for (const e of [-1, 1]) cylBuf(B, 'x', e * .72, .45, z, .45, .14, 10, wh); B.box(0, .4, z, 1.5, .1, .1, 0, dk); }
    return B.mesh(null).geometry;
  },
  buildTrain() {
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true }), N = 34;
    const mk = (geo, cap, m = mat) => { const im = new THREE.InstancedMesh(geo, m, cap); im.count = 0; im.frustumCulled = false; im.castShadow = true; im.receiveShadow = true; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); for (let i = 0; i < cap; i++) im.setColorAt(i, new THREE.Color(0xffffff)); scene.add(im); return im; };
    this.meshes = {}; for (const t in this.TYPES) this.meshes[t] = mk(this.carGeo(t), t === 'loco' ? 3 : N);
    this.bogies = { 2: mk(this.bogieGeo(2), N * 2), 3: mk(this.bogieGeo(3), 6) };
    this.loads = mk(boxGeo, N, new THREE.MeshLambertMaterial({ color: 0xffffff }));
    this.heads = mk(cboxGeo, 9, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    this.spot = new THREE.SpotLight(0xfff2cc, 0, 140, 0.32, 0.6, 1.4); this.spot.castShadow = false; scene.add(this.spot, this.spot.target);
  },
  // the run in time slot k: composition, speed and timing all derive from k, so every client agrees
  runFor(k) {
    const runs = this.runs || (this.runs = new Map()); if (runs.has(k)) return runs.get(k);
    if (runs.size > 6) runs.delete(runs.keys().next().value);
    let h = (k * 2654435761) >>> 0; const r = () => { h = (h + 0x6D2B79F5) >>> 0; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const pick = a => a[Math.floor(r() * a.length)], T = this.main, units = [];
    const nl = r() < 0.35 ? 2 : 1, ncar = 15 + Math.floor(r() * 12), lcol = pick(this.TYPES.loco.cols);
    for (let i = 0; i < nl; i++) units.push({ type: 'loco', col: lcol });
    const mix = ['box', 'box', 'box', 'hopper', 'hopper', 'tank', 'tank', 'flat', 'gondola', 'gondola'];
    for (let i = 0, prev = null, run = 0; i < ncar; i++) {   // freight comes in blocks of like cars
      const type = prev && run < 2 + r() * 4 ? prev : pick(mix); run = type === prev ? run + 1 : 0; prev = type;
      const u = { type, col: pick(this.TYPES[type].cols) };
      if (type === 'flat') u.load = r() < .45 ? { col: '#c4a06a', h: 2.0, l: 15 } : r() < .8 ? { col: pick(['#b5452f', '#2f5d8a', '#d6a63a', '#3f7a4a', '#7a7f86']), h: 2.6, l: 12.2 } : null;
      units.push(u);
    }
    let d = 0; for (const u of units) { u.L = this.TYPES[u.type].L; u.d = d + u.L / 2; d += u.L + 1.1; }
    const len = d, v = 7.5 + r() * 3.5, dir = r() < 0.5 ? 1 : -1;   // 17-25 mph
    const sIn = T.s[Math.max(0, T.i0)] - 5, sOut = T.s[T.i1] + 5, dur = (sOut - sIn + len) / v;
    const off = r() * Math.max(0, this.SLOT - dur - 25);
    const run = { k, units, len, v, dir, t0: k * this.SLOT + off, dur, s0: dir > 0 ? sIn : sOut, sIn, sOut, horns: new Set(), toasted: false, painted: false }; runs.set(k, run); return run;
  },
  active(t = this.now()) { const R = this.runFor(Math.floor(t / this.SLOT)); return t >= R.t0 && t <= R.t0 + R.dur ? R : null; },
  next(t = this.now()) {   // seconds until the next train enters (0 while one is running)
    if (this.active(t)) return 0; const k = Math.floor(t / this.SLOT), R = this.runFor(k);
    if (t < R.t0) return R.t0 - t; return this.runFor(k + 1).t0 - t;
  },
  summon(lead = 0) { const t = netNow() / 1000, R = this.runFor(Math.floor(t / this.SLOT)); this.timeShift = R.t0 - t + lead; return R; },   // debug: local only, jumps to this slot's train
  ahead(R, c, t) { return R.dir * (c.s - (R.s0 + R.dir * R.v * (t - R.t0))); },   // metres from the lead unit's nose to crossing c (negative once past)
  update(now) {
    if (!this.main) return;
    const t = this.now(), R = this.active(t), out = this._o || (this._o = {}), o2 = this._o2 || (this._o2 = {});
    let counts = { loco: 0, box: 0, hopper: 0, tank: 0, flat: 0, gondola: 0, b2: 0, b3: 0, load: 0, head: 0 };
    this.units.length = 0;
    if (R) {
      if (!R.painted) {
        // paint colours depend only on the run, so set them once per run
        const c = new THREE.Color(), idx = R.counts = { loco: 0, box: 0, hopper: 0, tank: 0, flat: 0, gondola: 0, b2: 0, b3: 0, load: 0, head: 0 }; let li = 0;
        for (const u of R.units) { u.slot = idx[u.type]++; const bk = 'b' + this.TYPES[u.type].bog; u.bslot = idx[bk]; idx[bk] += 2; if (u.load) idx.load++; this.meshes[u.type].setColorAt(u.slot, c.set(u.col)); if (u.load) { u.lslot = li++; this.loads.setColorAt(u.lslot, c.set(u.load.col)); } }
        for (const t2 in this.meshes) if (this.meshes[t2].instanceColor) this.meshes[t2].instanceColor.needsUpdate = true;
        if (this.loads.instanceColor) this.loads.instanceColor.needsUpdate = true;
        for (let i = 0; i < 9; i++) this.heads.setColorAt(i, c.set(0xfff4d0)); this.heads.instanceColor.needsUpdate = true;
        R.painted = true;
      }
      counts = Object.assign({}, R.counts, { head: 0 });
      const head = R.s0 + R.dir * R.v * (t - R.t0), T = this.main;
      const put = (im, i, x, y, z, yaw, pt, sx = 1, sy = 1, sz = 1) => { rdummy.position.set(x, y, z); rdummy.rotation.set(-pt, yaw, 0, 'YXZ'); rdummy.scale.set(sx, sy, sz); rdummy.updateMatrix(); im.setMatrixAt(i, rdummy.matrix); };
      let lead = true;
      for (const u of R.units) {
        const sc = head - R.dir * u.d, b = u.L / 2 - 2.4;
        this.at(T, sc + R.dir * b, out); const fx = out.x, fy = out.y, fz = out.z, fin = out.inside;
        this.at(T, sc - R.dir * b, o2);
        if (!(fin && o2.inside)) { put(this.meshes[u.type], u.slot, 0, -99, 0, 0, 0, 0, 0, 0); for (const k of [0, 1]) put(this.bogies[this.TYPES[u.type].bog], u.bslot + k, 0, -99, 0, 0, 0, 0, 0, 0); if (u.load) put(this.loads, u.lslot, 0, -99, 0, 0, 0, 0, 0, 0); lead = false; continue; }
        const dx = fx - o2.x, dz = fz - o2.z, hl = Math.hypot(dx, dz) || 1, yaw = Math.atan2(dx, dz), pt = Math.atan2(fy - o2.y, hl);
        const cx = (fx + o2.x) / 2, cy = (fy + o2.y) / 2, cz = (fz + o2.z) / 2;
        put(this.meshes[u.type], u.slot, cx, cy, cz, yaw, pt);
        const bm = this.bogies[this.TYPES[u.type].bog];
        put(bm, u.bslot, fx, fy, fz, yaw, pt); put(bm, u.bslot + 1, o2.x, o2.y, o2.z, yaw, pt);
        if (u.load) put(this.loads, u.lslot, cx, cy + 1.05, cz, yaw, pt, 2.5, u.load.h, u.load.l);
        const fwd = [dx / hl, dz / hl];
        if (u.type === 'loco' && lead) {
          const nx = cx + fwd[0] * 10.42, nz = cz + fwd[1] * 10.42;
          put(this.heads, counts.head++, cx + fwd[0] * 10.42, cy + 2.55, cz + fwd[1] * 10.42, yaw, pt, .55, .28, .05);
          for (const e of [-1, 1]) put(this.heads, counts.head++, nx + fwd[1] * e * 1.15, cy + .95, nz - fwd[0] * e * 1.15, yaw, pt, .26, .26, .05);
          this.spot.position.set(nx, cy + 2.6, nz); this.spot.target.position.set(nx + fwd[0] * 40, cy - 1, nz + fwd[1] * 40); this.spot.intensity = timeIdx === 2 ? 900 : 250;
        }
        this.units.push({ x: cx, z: cz, y: cy, fx: fwd[0], fz: fwd[1], hl: u.L / 2, lead, R });
        lead = false;
      }
      if (!R.toasted && started) { R.toasted = true; if (this.distTo(P.x, P.z) < 500) toast(`🚂 A freight train is rolling through: ${R.units.length} cars`, 'info'); }
    }
    if (!this.units.some(u => u.lead) || !R) this.spot.intensity = 0;
    for (const t2 in this.meshes) { this.meshes[t2].count = counts[t2]; this.meshes[t2].instanceMatrix.needsUpdate = true; }
    this.bogies[2].count = counts.b2; this.bogies[3].count = counts.b3; this.loads.count = counts.load; this.heads.count = counts.head;
    for (const m of [this.bogies[2], this.bogies[3], this.loads, this.heads]) m.instanceMatrix.needsUpdate = true;
    // crossings: lights at 20 s out, gates down from 16 s to 11 s out, up again 2-7 s after the tail clears
    let bellNear = 1e9;
    for (const c of this.crossings) {
      let light = false, gate = 0;
      if (R && c.track === this.main) {
        const a = this.ahead(R, c, t), eta = a / R.v, past = (-a - R.len) / R.v;
        light = eta < 20 && past < 7;
        gate = eta >= 0 ? Math.max(0, Math.min(1, (16 - eta) / 5)) : past < 2 ? 1 : Math.max(0, 1 - (past - 2) / 5);
        if (c.kind === 'road' && eta > 0 && eta < 13 && !R.horns.has(c)) { R.horns.add(c); this.horn(); }
      }
      c.closed = light; c.gate = gate;
      if (c.posts) for (const p of c.posts) p.piv.rotation.z = Math.PI / 2 * .96 * (1 - gate);
      if (light) bellNear = Math.min(bellNear, Math.hypot(c.x - P.x, c.z - P.z));
    }
    if (this.lampMesh) {
      const on = Math.floor(now / 500) % 2, c = this._c || (this._c = new THREE.Color());
      this.lampList.forEach((l, i) => this.lampMesh.setColorAt(i, c.set(l.c.closed && ((l.e > 0) === !!on) ? 0xff2a1a : 0x3a0d0d)));
      this.lampMesh.instanceColor.needsUpdate = true;
    }
    if (bellNear < 90 && now - (this.bellT || 0) > 520) { this.bellT = now; this.bell(1 - bellNear / 90); }
  },
  distTo(x, z) { let b = 1e9; const T = this.main; for (let i = Math.max(0, T.i0); i <= T.i1; i += 4) b = Math.min(b, Math.hypot(T.x[i] - x, T.z[i] - z)); return b; },
  closedAt(c, t) {   // is crossing c closed at time t (Rail.now() seconds)? Same rule as update(), from the schedule alone
    const R = this.active(t); if (!R || c.track !== this.main) return false;
    const a = this.ahead(R, c, t), eta = a / R.v, past = (-a - R.len) / R.v; return eta < 20 && past < 7;
  },
  crossingBlocked(x, z, pad = 0) { for (const c of this.crossings) if (c.closed && Math.hypot(x - c.x, z - c.z) < c.r + pad) return c; return null; },
  // oriented-box test against every visible car; returns the unit or null
  hit(x, z, r = 0) { for (const u of this.units) { const dx = x - u.x, dz = z - u.z, a = dx * u.fx + dz * u.fz, b = dx * u.fz - dz * u.fx; if (Math.abs(a) < u.hl + r && Math.abs(b) < 1.6 + r) return u; } return null; },
  pushPlayer() {
    for (const u of this.units) {
      if (Math.abs(P.x - u.x) > 16 || Math.abs(P.z - u.z) > 16 || P.y > u.y + 4.7 || P.y + 1.7 < u.y) continue;
      const dx = P.x - u.x, dz = P.z - u.z, a = dx * u.fx + dz * u.fz, b = dx * u.fz - dz * u.fx, ha = u.hl + R, hb = 1.6 + R;
      if (Math.abs(a) >= ha || Math.abs(b) >= hb) continue;
      const sb = b >= 0 ? 1 : -1;
      if (u.lead || hb - Math.abs(b) < ha - Math.abs(a)) {   // out to the side (the lead unit always throws you clear)
        const nb = sb * hb; P.x = u.x + u.fx * a + u.fz * nb; P.z = u.z + u.fz * a - u.fx * nb;
        if (u.lead && Math.abs(a) > u.hl - 3) {
          V.x = u.fz * sb * 7; V.z = -u.fx * sb * 7; V.y = 4;
          if (performance.now() - (this.hitT || 0) > 4000) { this.hitT = performance.now(); toast('Whoa! That train nearly flattened you. Stay off the tracks!', 'bad'); }
        }
      } else { const na = (a >= 0 ? 1 : -1) * ha; P.x = u.x + u.fx * na + u.fz * b; P.z = u.z + u.fz * na - u.fx * b; }
    }
  },
  /* ---- sound ---- */
  initAudio() { if (this.ac) { this.ac.resume && this.ac.resume(); return; } try { this.ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ac = null; } },
  horn() {
    const ac = this.ac; if (!ac || ac.state !== 'running' || !this.units.length) return;
    const L = this.units[0], d = Math.hypot(L.x - P.x, L.z - P.z); if (d > 600) return;
    const vol = 0.16 * Math.max(0.15, 1 - d / 600), t0 = ac.currentTime + 0.05;
    const out = ac.createGain(); out.gain.value = vol; const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1600 - d; lp.connect(out); out.connect(ac.destination);
    // long, short, long on a three-chime horn
    for (const [s, len] of [[0, .9], [1.1, .35], [1.65, 1.1]]) {
      const g = ac.createGain(); g.gain.setValueAtTime(0, t0 + s); g.gain.linearRampToValueAtTime(1, t0 + s + .05); g.gain.setValueAtTime(1, t0 + s + len - .1); g.gain.linearRampToValueAtTime(0, t0 + s + len); g.connect(lp);
      for (const f of [311, 370, 494]) { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(g); o.start(t0 + s); o.stop(t0 + s + len + .05); }
    }
  },
  bell(k) {
    const ac = this.ac; if (!ac || ac.state !== 'running') return; const t0 = ac.currentTime;
    const g = ac.createGain(); g.gain.setValueAtTime(0.05 * k, t0); g.gain.exponentialRampToValueAtTime(0.0005, t0 + .35); g.connect(ac.destination);
    for (const f of [1320, 2640, 3960]) { const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.connect(g); o.start(t0); o.stop(t0 + .4); }
  },
};

