/* ---------------- doorways ----------------
   D.doors are footway ends that touch a brick, stone or commercial wall. Each one is snapped onto its wall, kept clear of
   the corners, faced outward and stood on the ground in front of it (a stoop, plus steps where the ground falls away).
   Every other building gets one door (two if large) on the wall that faces the nearest path or road.
   Breen's doorways are real openings in the wall (interiorWall), so they get the frame and steps but no panel. */
let doorList = [];
const DOOR_KIND = {   // width, height, casing, leaves, glass
  campus: { w: 1.9, h: 2.45, trim: '#efe9dc', leaves: 2 },
  commercial: { w: 1.9, h: 2.3, trim: '#3b3e42', leaves: 2, store: true },
  house: { w: 0.95, h: 2.1, trim: '#f2efe8', leaves: 1 },
};
const HOUSE_DOORS = ['#7a2420', '#24324f', '#2f4a32', '#1d1f22', '#6b4a2e', '#e9e4d8', '#4a5a66'];
function planDoors() {
  const G = 24, bgrid = new Map(), lgrid = new Map(), pgrid = new Map();
  const put = (grid, x, z, v) => { const k = Math.floor(x / G) + ',' + Math.floor(z / G); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(v); };
  const near = (grid, x, z, r = 1) => { const out = [], gx = Math.floor(x / G), gz = Math.floor(z / G); for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) for (const v of grid.get((gx + i) + ',' + (gz + j)) || []) out.push(v); return out; };
  for (const b of D.buildings) {
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const q of b.p) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); z0 = Math.min(z0, q[1]); z1 = Math.max(z1, q[1]); }
    b.bb = [x0, x1, z0, z1]; const seen = new Set();
    for (let i = Math.floor(x0 / G); i <= Math.floor(x1 / G); i++) for (let j = Math.floor(z0 / G); j <= Math.floor(z1 / G); j++) { const k = i + ',' + j; if (seen.has(k)) continue; seen.add(k); if (!bgrid.has(k)) bgrid.set(k, []); bgrid.get(k).push(b); }
  }
  const walkable = ['footway', 'path', 'pedestrian', 'steps', 'service', 'residential', 'unclassified', 'tertiary', 'secondary', 'primary'];
  for (const l of D.lines) if (walkable.includes(l.k)) for (let i = 0; i < l.p.length - 1; i++) {
    const a = l.p[i], c = l.p[i + 1], L = Math.hypot(c[0] - a[0], c[1] - a[1]), n = Math.max(1, Math.ceil(L / G));
    for (let j = 0; j <= n; j++) put(lgrid, a[0] + (c[0] - a[0]) * j / n, a[1] + (c[1] - a[1]) * j / n, [a, c, l.k === 'footway' || l.k === 'path' || l.k === 'steps' ? 0 : 3]);
  }
  for (const t of D.trees) put(pgrid, t[0], t[1], [t[0], t[1]]);
  for (const l of D.lamps) put(pgrid, l[0], l[1], [l[0], l[1]]);
  const inOther = (x, z, self) => near(bgrid, x, z, 0).some(o => o !== self && x > o.bb[0] && x < o.bb[1] && z > o.bb[2] && z < o.bb[3] && pip(x, z, o.p));
  const blocked = (x, z) => near(pgrid, x, z).some(t => Math.hypot(t[0] - x, t[1] - z) < 1.4);
  const kindOf = b => b.k === 'brick' || b.k === 'stone' ? 'campus' : b.k === 'commercial' ? 'commercial' : 'house';
  // a door on edge i of building b, t metres along it; returns null if it cannot stand there
  const make = (b, i, t, spec) => {
    const a = b.p[i], c = b.p[(i + 1) % b.p.length], L = Math.hypot(c[0] - a[0], c[1] - a[1]), half = spec.w / 2 + 0.45;
    if (L < spec.w + 0.9) return null;
    t = Math.max(half, Math.min(L - half, t));
    const dx = (c[0] - a[0]) / L, dz = (c[1] - a[1]) / L; let nx = dz, nz = -dx;
    const x = a[0] + dx * t, z = a[1] + dz * t;
    if (pip(x + nx * 0.3, z + nz * 0.3, b.p)) { nx = -nx; nz = -nz; }   // rings are CCW, but be safe
    if (inOther(x + nx * 1.5, z + nz * 1.5, b)) return null;            // the wall is shared with a neighbour
    const t0 = terrainY(x + nx * 0.2, z + nz * 0.2), t1 = terrainY(x + nx * 1.3, z + nz * 1.3);
    const base = Math.max(t0, t1) + 0.15;
    let h = Math.min(spec.h, b.t - base - 0.35); if (h < 1.9) return null;
    return { x, z, ang: Math.atan2(dz, dx), nx, nz, w: spec.w, h, base, b, spec };
  };
  const out = [];
  for (const d of D.doors) {   // mapped entrances: snap onto the closest wall of the building they touch
    let best = null;
    for (const b of near(bgrid, d[0], d[1], 0)) {
      if (d[0] < b.bb[0] - 3 || d[0] > b.bb[1] + 3 || d[1] < b.bb[2] - 3 || d[1] > b.bb[3] + 3) continue;
      for (let i = 0; i < b.p.length; i++) { const [px, pz, t] = closestOnSeg(d[0], d[1], b.p[i], b.p[(i + 1) % b.p.length]); const dd = Math.hypot(px - d[0], pz - d[1]); if (!best || dd < best[0]) best = [dd, b, i, t]; }
    }
    if (!best || best[0] > 1.5 || best[1].interior || best[1].bank) continue;   // Breen's mapped doors are openings already
    const [, b, i, t] = best, L = Math.hypot(b.p[(i + 1) % b.p.length][0] - b.p[i][0], b.p[(i + 1) % b.p.length][1] - b.p[i][1]);
    const dr = make(b, i, t * L, DOOR_KIND[kindOf(b)]);
    if (dr && !out.some(o => o.b === b && Math.hypot(o.x - dr.x, o.z - dr.z) < 5)) { dr.mapped = true; out.push(dr); }
  }
  const has = new Set(out.map(o => o.b));
  for (const b of D.buildings) {   // everything else: the wall that faces a path or road, door opposite the nearest point
    if (has.has(b) || b.interior || b.bank) continue;
    const A = Math.abs(area(b.p)); if (A < 30) continue;
    const spec = DOOR_KIND[kindOf(b)], cands = [];
    for (let i = 0; i < b.p.length; i++) {
      const a = b.p[i], c = b.p[(i + 1) % b.p.length], L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L < spec.w + 0.9) continue;
      const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2;
      let nx = (c[1] - a[1]) / L, nz = -(c[0] - a[0]) / L; if (pip(mx + nx * 0.3, mz + nz * 0.3, b.p)) { nx = -nx; nz = -nz; }
      let bd = 1e9, bt = L / 2;
      for (const [p, q, pen] of near(lgrid, mx + nx * 6, mz + nz * 6, 2)) {
        const [px, pz] = closestOnSeg(mx, mz, p, q);
        if ((px - mx) * nx + (pz - mz) * nz < 0.5) continue;   // behind this wall
        const [ex, ez, et] = closestOnSeg(px, pz, a, c), dd = Math.hypot(px - ex, pz - ez) + pen;
        if (dd < bd) { bd = dd; bt = et * L; }
      }
      cands.push([bd - Math.min(L, 20) * 0.15, i, bt]);
    }
    cands.sort((p, q) => p[0] - q[0]);
    let n = 0;
    for (const [, i, t] of cands) {
      const dr = make(b, i, t, spec); if (!dr || blocked(dr.x + dr.nx * 1.2, dr.z + dr.nz * 1.2)) continue;
      if (out.some(o => o.b === b && Math.hypot(o.x - dr.x, o.z - dr.z) < 15)) continue;
      out.push(dr); if (++n >= (A > 1500 ? 2 : 1)) break;
    }
  }
  for (const g of (breen && breen.gaps) || []) out.push({ ...g, spec: { trim: '#efe9dc' } });
  for (const g of (bank && bank.gaps) || []) out.push({ ...g, spec: { trim: '#2b2f36' } });
  doorList = out;
  // each doorway is a child node of its building, id '<building id>/door<n>', standing at the ground in front of it
  const perBuilding = new Map(); let skipped = 0;
  for (const d of out) {
    if (!d.b || !d.b.id) { skipped++; continue; }
    const n = perBuilding.get(d.b.id) || 0; perBuilding.set(d.b.id, n + 1);
    World.add({ id: d.b.id + '/door' + n, kind: 'door', parent: d.b.id, x: d.x, y: d.base, z: d.z, c: { door: { ref: d } } });
  }
  if (skipped) console.info(`${skipped} doorways have no building reference, so they are not nodes`);
  return doorList;
}
// stoop flush with the wall and as wide as the frame; steps down to the ground where it falls away in front
function doorSteps(d, put) {
  const ty = terrainY(d.x + d.nx * 1.3, d.z + d.nz * 1.3), far = terrainY(d.x + d.nx * 2.6, d.z + d.nz * 2.6), low = Math.min(ty, far, terrainY(d.x, d.z));
  const sw = d.w + 0.9, deep = d.open ? 1.6 : 1.3;
  put(0, deep / 2, low - 0.4, sw, d.base - low + 0.4, deep);
  const drop = d.base - far, n = Math.min(6, Math.round(drop / 0.18));
  for (let i = 1; i <= n; i++) put(0, deep + (i - 0.5) * 0.3, low - 0.4, sw, d.base - i * drop / (n + 1) - low + 0.4, 0.3);
}
function buildDoors() {
  const trim = [], leaf = [], glass = [], stoop = [];
  for (const d of doorList) {
    const ux = Math.cos(d.ang), uz = Math.sin(d.ang), r = -d.ang;
    // u along the wall, v outward from it; boxes stand on their base
    const at = list => (u, v, y, su, sy, sv, col) => list.push({ x: d.x + ux * u + d.nx * v, z: d.z + uz * u + d.nz * v, y, su, sy, sv, r, col: col || '#ffffff' });
    const T = at(trim), F = at(leaf), Gl = at(glass), st = at(stoop), w = d.w, h = d.h, y = d.base, tc = d.spec.trim;
    doorSteps(d, (u, v, yy, su, sy, sv) => st(u, v, yy, su, sy, sv, '#b8b2a6'));
    T(-w / 2 - 0.08, 0.08, y, 0.16, h, 0.16, tc); T(w / 2 + 0.08, 0.08, y, 0.16, h, 0.16, tc); T(0, 0.08, y + h, w + 0.32, 0.22, 0.16, tc);
    if (d.open) {   // Breen and the bank: a real opening; the bank's glass doors stand open inside it
      if (d.bank) for (const s of [-1, 1]) {
        const u = s * (w / 2 - .04), lw = w / 2 - .05, al = '#2b2f36';
        F(u, -lw / 2 - .02, y, .06, .1, lw, al); F(u, -lw / 2 - .02, y + h - .1, .06, .1, lw, al); F(u, -lw - .02, y, .06, h, .06, al);
        Gl(u, -lw / 2 - .02, y + .1, .03, h - .2, lw - .06); T(u - s * .06, -lw * .6, y + h * .4, .04, .6, .04, '#c9a74a');   // push bar
      }
      continue;
    }
    const leaves = d.spec.leaves, lw = w / leaves;
    for (let k = 0; k < leaves; k++) {
      const u = -w / 2 + lw * (k + 0.5);
      if (d.spec.store) { F(u, 0.05, y, lw - 0.03, h, 0.06, '#3b3e42'); Gl(u, 0.085, y + 0.25, lw - 0.22, h - 0.45, 0.02); }
      else if (leaves === 2) { F(u, 0.05, y, lw - 0.03, h, 0.06, '#4a2a1c'); Gl(u, 0.085, y + h * 0.52, lw - 0.36, h * 0.34, 0.02); }
      else { F(u, 0.05, y, lw, h, 0.06, HOUSE_DOORS[Math.floor(hash(d.x * 3.7 + d.z) * HOUSE_DOORS.length)]); Gl(u, 0.085, y + h * 0.7, lw - 0.4, h * 0.18, 0.02); }
      T(u + (leaves === 2 ? (k ? -1 : 1) * (lw / 2 - 0.12) : lw / 2 - 0.14), 0.09, y + h * 0.45, 0.05, 0.05, 0.08, '#c9a74a');   // handle
    }
    if (leaves === 2) T(0, 0.08, y, 0.06, h, 0.1, tc);   // mullion between the leaves
  }
  const set = (k, o, c) => { o.position.set(k.x, k.y, k.z); o.scale.set(k.su, k.sy, k.sv); o.rotation.set(0, k.r, 0); c.set(k.col); };
  instanced(boxGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), trim, set);
  instanced(boxGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), leaf, set);
  instanced(boxGeo, new THREE.MeshLambertMaterial({ color: 0x9fb6c4, emissive: 0x0d1418 }), glass, set, false);
  instanced(boxGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), stoop, set);
}
function buildCars() {
  const cars = [], palette = ['#e8e8e8', '#202225', '#8a8d91', '#9b1c24', '#24406e', '#c9c9c4', '#3b4a3b', '#6b6e72', '#f2f2f2', '#14161a'];
  seed = 4242;
  for (const a of D.areas) if (a.k === 'parking') {
    const r = minRect(a.p), c = Math.cos(r.th), s = Math.sin(r.th);
    if (r.lv < 10 || r.lu < 8) continue;
    const pat = [2.75, 8.25, 13.5]; // stall centers across a 19 m module (two stall rows + aisle)
    for (let v0 = -r.lv / 2; v0 < r.lv / 2 - 5; v0 += 19) for (const off of [2.75, 8.25]) {
      const v = v0 + off; if (v > r.lv / 2 - 2.5) continue;
      for (let u = -r.lu / 2 + 1.6; u < r.lu / 2 - 1.4; u += 2.7) {
        if (rnd() > 0.62) continue;
        const X = r.cx + u * c - v * s, Z = r.cz + u * s + v * c;
        if (!pip(X, Z, a.p) || doorList.some(d => Math.hypot(d.x + d.nx * 2 - X, d.z + d.nz * 2 - Z) < 3.5)) continue;
        cars.push({ x: X, z: Z, y: terrainY(X, Z), r: -(r.th + Math.PI / 2) + (rnd() - .5) * .06, col: palette[Math.floor(rnd() * palette.length)] });
      }
    }
  }
  return cars;   // Vehicles.init turns these into rentable cars (after the rail and traffic plans exist)
}
function buildClouds() {
  const cl = []; const n = 70, cs = 28;
  const val = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), f = (a, b) => hash(a * 57.1 + b * 113.7), fx = x - xi, fy = y - yi; const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy); return (f(xi, yi) * (1 - sx) + f(xi + 1, yi) * sx) * (1 - sy) + (f(xi, yi + 1) * (1 - sx) + f(xi + 1, yi + 1) * sx) * sy; };
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (val(i / 4, j / 4) * .7 + val(i / 1.7, j / 1.7) * .3 > 0.62) cl.push({ x: (i - n / 2) * cs, z: (j - n / 2) * cs });
  const m = instanced(boxGeo, new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: .82, emissive: 0x777777 }), cl, (k, o) => { o.position.set(k.x, 330, k.z); o.scale.set(cs, 6, cs); o.rotation.set(0, 0, 0); }, false);
  m.receiveShadow = false; return m;
}

