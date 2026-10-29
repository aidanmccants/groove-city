/* ---------------- buildings ---------------- */
const BRICK_COL = '#9b4a36';
const labels = [];
// corrections checked against Street View
const NAME_FIX = {
  'Crawford Hall': { r: 'flat', c: '#5b5850' },
  'Hall of Arts and Letters': { c: '#45464c', pi: 42 },
  'J. Howard Pew Fine Arts Center': { k: 'modern' },
  'Breen Student Union': { c: '#4a4c52', pi: 45, interior: true },
  "Dunkin'": { k: 'commercial', w: '#d9c3a0', c: '#6a4a33', r: 'flat' },
  "McDonald's": { k: 'commercial', w: '#5a4636', c: '#3a3a3a' },
  'Rite Aid': { w: '#a8623f', c: '#3f3f3f' },
  'Little Caesars': { k: 'commercial', w: '#cdb995', c: '#3f6a45', r: 'hip', pi: 25 },
  'Marathon': { k: 'commercial', w: '#cdb995', c: '#3f6a45', pi: 25 },
  'Country Fair': { w: '#b9a07e', c: '#4a4a4f', r: 'hip', pi: 22 },
};
// colours read off Street View / Google Maps photos: [sign text, sign ground, letters, awning band]
const BRAND = {
  "Dunkin'": ["DUNKIN' DONUTS", '#f3e6cf', '#e8641b', '#d6267e'], "McDonald's": ["McDonald's", '#ffbc0d', '#db0007', '#ffbc0d'],
  'Rite Aid': ['RITE AID', '#6e2a26', '#ffffff', '#6e2a26'], 'Little Caesars': ['Little Caesars', '#f4f0e6', '#ff6a13', '#ff6a13'],
  'Marathon': ['MARATHON', '#ffffff', '#0b3b8c', '#0b3b8c'], 'Country Fair': ['COUNTRY FAIR', '#ffffff', '#c8102e', '#c8102e'],
  'Grace United Methodist Church': ['GRACE UNITED METHODIST', '#efe2c0', '#5a2a1c', '#a2502f'],
};
const signs = [], floors = [], interiorLights = [];
// the four churches, matched to the place_of_worship points; photos: Street View from several sides
const CHURCH = {
  'East Main Church': { k: 'brick', w: '#9d4e38', c: '#8a3324', r: 'hip', pi: 36, tower: { su: 1, sv: 1, size: 6.5, h: 16, cap: 'crenel', mat: 'brick' } },
  'Covenant Church': { k: 'siding', w: '#f2f2ee', c: '#5f6266', r: 'gable', pi: 40, steeple: true },
  'Tower Presbyterian Church': { k: 'stone', w: '#cdb88f', c: '#4f4a42', r: 'hip', pi: 36, tower: { su: 1, sv: -1, size: 7.5, h: 22, cap: 'crenel', mat: 'stone' } },
  'Grace United Methodist Church': { k: 'stone', w: '#e2d2a8', c: '#b4532f', r: 'hip', pi: 26, tower: { su: 1, sv: -1, size: 5.5, h: 13, cap: 'flat', mat: 'stone', roof: '#b4532f' } },
};
function buildBuildings() {
  const B = { plaster: new Buf(), brick: new Buf(), stone: new Buf(), modern: new Buf(), siding: new Buf(), commercial: new Buf(), plain: new Buf(), roof: new Buf(), flat: new Buf() };
  for (const p of D.pois || []) {
    const spec = CHURCH[p.n]; if (!spec) continue;
    let pick = null, bd = 1e9;
    for (const b of D.buildings) {
      if (b.church) continue;
      const cx = b.p.reduce((t, q) => t + q[0], 0) / b.p.length, cz = b.p.reduce((t, q) => t + q[1], 0) / b.p.length;
      const dd = pip(p.x, p.z, b.p) ? 0 : Math.hypot(cx - p.x, cz - p.z);
      if (dd < bd && dd < 25) { bd = dd; pick = b; }
    }
    if (pick) { pick.church = spec; Object.assign(pick, { k: spec.k, w: spec.w, c: spec.c, r: spec.r, pi: spec.pi }); }
  }
  const pnc = (D.pois || []).find(p => p.n === 'PNC Bank'), pb = pnc && D.buildings.find(b => pip(pnc.x, pnc.z, b.p));
  if (pb) { Object.assign(pb, { bank: true, n: pb.n || 'PNC Bank', k: 'stone', r: 'flat', c: '#8f8a80' }); pb.t = Math.max(pb.t, bankFrame(pb).fy + 7.2); }
  // every building is a node: id from makeId, type (bank, church, union, house or building) and footprint area; houses can be bought
  for (const b of D.buildings) {
    const cx = b.p.reduce((t, q) => t + q[0], 0) / b.p.length, cz = b.p.reduce((t, q) => t + q[1], 0) / b.p.length, sqm = Math.abs(area(b.p));
    const type = b.bank ? 'bank' : b.church ? 'church' : /Breen/.test(b.n || '') ? 'union' : b.k === 'siding' && sqm < 400 ? 'house' : 'building';
    b.id = World.makeId(b);
    World.add({ id: b.id, kind: 'building', x: cx, y: b.b, z: cz, c: { building: { name: b.n || '', type, mat: b.k, base: b.b, top: b.t, area: sqm, ref: b }, ...(type === 'house' ? { ownable: { price: Math.round(sqm * 900) * 100, owner: null } } : {}) } });
  }
  for (const id in BUILDING_OVERRIDES) if (World.get(id)) World.patch(id, BUILDING_OVERRIDES[id]); else console.warn('override for unknown building', id);
  for (const b of D.buildings) {
    const fix = NAME_FIX[b.n]; if (fix) Object.assign(b, fix);
    const rings = [b.p, ...(b.h || [])];
    const kind = b.k, wb = B[kind] || B.plain;
    const floorH = kind === 'siding' || kind === 'plain' ? 3.0 : 3.8;
    const wallTint = (kind === 'brick') ? (b.w === BRICK_COL ? [1, 1, 1] : [1, 0.88, 0.76]) : (kind === 'stone' || kind === 'modern') ? [1, 1, 1] : col3(b.w);
    const top = b.t, bot = b.b, gref = b.b + 0.6;
    const flat = b.r === 'flat';
    const wallTop = flat ? top + 0.7 : top;
    // walls
    for (const ring of rings) {
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], c = ring[(i + 1) % ring.length], dx = c[0] - a[0], dz = c[1] - a[1], len = Math.hypot(dx, dz);
        if (len < 0.05) continue;
        const bays = Math.max(1, Math.round(len / 3.2)), uw = bays / len;
        const n = [dz / len, 0, -dx / len];
        const v0 = (bot - gref) / floorH, v1 = (wallTop - gref) / floorH;
        if (b.bank) break;   // bankBuild puts up its own walls
        if (b.interior) { interiorWall(B, b, a, c, len, n, bot, wallTop, wallTint, floorH, gref); continue; }
        wb.quad([a[0], bot, a[1]], [c[0], bot, c[1]], [c[0], wallTop, c[1]], [a[0], wallTop, a[1]], [0, v0], [len * uw, v0], [len * uw, v1], [0, v1], wallTint, n);
      }
    }
    const roofCol = col3(b.c, 1.35);
    if (flat) {
      capRings(B.flat, rings, top, roofCol);
      const A = Math.abs(area(b.p));
      if (A > 500) { // rooftop mechanical units
        seed = Math.floor(A * 7) + 3; const r = minRect(b.p);
        for (let k = 0; k < Math.min(6, A / 400); k++) {
          const u = (rnd() - .5) * r.lu * 0.6, v = (rnd() - .5) * r.lv * 0.6, X = r.cx + u * Math.cos(r.th) - v * Math.sin(r.th), Z = r.cz + u * Math.sin(r.th) + v * Math.cos(r.th);
          if (pip(X, Z, b.p)) B.plain.box(X, top, Z, 2 + rnd() * 3, 1.2 + rnd() * 1.2, 2 + rnd() * 2, r.th, col3('#b9bcbf'));
        }
      }
    } else if (gableFits(b)) gableRoof(B, wb, b, top, b.pi || 38, roofCol, kind === 'siding' || kind === 'plain' ? 0.45 : 0.6, wallTint);
    else hipRoof(B.roof, rings, top, b.pi || 30, roofCol, kind === 'siding' || kind === 'plain' ? 0.45 : 0.6, b.n === 'Harbison Chapel' ? 14 : (kind === 'siding' ? 6 : 7));
    if (b.interior) breenInside(B, b); else if (b.bank) bankBuild(B, b); else { addCollider(rings, flat ? top + 0.7 : top + 2); if (b.church) churchExtras(B, b, top, b.pi || 38); }
    if (BRAND[b.n]) signs.push(b);
    if (b.n) {
      let cx = 0, cz = 0; b.p.forEach(q => { cx += q[0]; cz += q[1]; }); cx /= b.p.length; cz /= b.p.length;
      if (!pip(cx, cz, b.p)) { const r = minRect(b.p); cx = r.cx; cz = r.cz; }
      labels.push({ name: b.n, x: cx, z: cz, y: top + 4, poly: b.p });
    }
  }
  specials(B);
  const mats = {
    plaster: lambert(TEX.plaster, { side: THREE.DoubleSide }),
    brick: lambert(TEX.brick, { side: THREE.DoubleSide }), stone: lambert(TEX.stone, { side: THREE.DoubleSide }), siding: lambert(TEX.siding, { side: THREE.DoubleSide }),
    modern: lambert(TEX.modern, { side: THREE.DoubleSide }), ashlar: lambert(TEX.ashlar, { side: THREE.DoubleSide }), commercial: lambert(TEX.commercial, { side: THREE.DoubleSide }), plain: lambert(TEX.plain, { side: THREE.DoubleSide }), roof: lambert(TEX.roof, { side: THREE.DoubleSide }), flat: lambert(TEX.flat)
  };
  mats.lantern = lanternMat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x332211 });
  for (const k in B) if (B[k].p.length) scene.add(B[k].mesh(mats[k]));
}
// gable roofs: ridge along the long side of the footprint, gable ends in the wall material
function gableFits(b) {
  if (b.h || b.r !== 'gable') return false;
  const r = minRect(b.p);
  return Math.abs(area(b.p)) / (r.lu * r.lv) >= 0.82 && r.lv >= 3.2;
}
function gableRoof(B, wb, b, top, pitch, col, eave, tint) {
  const r = minRect(b.p), ang = Math.atan(Math.tan(pitch * Math.PI / 180)), tp = Math.tan(ang), ca = Math.cos(ang), sa = Math.sin(ang);
  const c = Math.cos(r.th), s = Math.sin(r.th), hu = r.lu / 2 + eave, hv = r.lv / 2 + eave, H = hv * tp, ev = eave * tp, Ls = hv / ca;
  const P = (u, v, y) => [r.cx + u * c - v * s, y, r.cz + u * s + v * c];
  const hA = [sa * s, ca, -sa * c], hB = [-sa * s, ca, sa * c];
  B.roof.quad(P(-hu, -hv, top), P(hu, -hv, top), P(hu, 0, top + H), P(-hu, 0, top + H), [0, 0], [hu, 0], [hu, Ls / 2], [0, Ls / 2], col, hA);
  B.roof.quad(P(-hu, hv, top), P(hu, hv, top), P(hu, 0, top + H), P(-hu, 0, top + H), [0, 0], [hu, 0], [hu, Ls / 2], [0, Ls / 2], col, hB);
  for (const sg of [1, -1]) {
    const u = sg * r.lu / 2, nrm = [sg * c, 0, sg * s];
    const p0 = P(u, -r.lv / 2, top), p1 = P(u, r.lv / 2, top), p2 = P(u, r.lv / 2, top + ev), p3 = P(u, -r.lv / 2, top + ev), pa = P(u, 0, top + H);
    wb.quad(p0, p1, p2, p3, [0, 0], [1, 0], [1, 1], [0, 1], tint, nrm);
    wb.tri(p3, p2, pa, [0, 1], [1, 1], [0.5, 2], tint, nrm);
  }
}
function churchExtras(B, b, top, pitch) {
  const sp = b.church, r = minRect(b.p), c = Math.cos(r.th), s = Math.sin(r.th);
  const P = (u, v) => [r.cx + u * c - v * s, r.cz + u * s + v * c];
  if (sp.tower) {
    const t = sp.tower, hs = t.size / 2, [x, z] = P(t.su * (r.lu / 2 - hs * 0.8), t.sv * (r.lv / 2 - hs * 0.8));
    const mat = t.mat === 'brick' ? B.brick : t.mat === 'stone' ? B.stone : B.plain, col = [1, 1, 1], yt = top + t.h;
    mat.box(x, b.b, z, t.size, yt - b.b, t.size, r.th, col);
    if (t.cap === 'crenel') for (const [du, dv] of [[1, 1], [1, -1], [-1, 1], [-1, -1], [0, 1], [0, -1], [1, 0], [-1, 0]]) {
      mat.box(x + du * hs * c - dv * hs * s, yt, z + du * hs * s + dv * hs * c, 1.1, 1.6, 1.1, r.th, col);
    }
    if (t.cap === 'flat') B.roof.pyramid(x, yt, z, hs * 0.95, 3.4, r.th, col3(t.roof || '#8c4a2c'));
  }
  if (sp.steeple) {
    const ry = top + (r.lv / 2 + 0.4) * Math.tan(pitch * Math.PI / 180), [x, z] = P(0, 0);
    B.plain.box(x, ry - 1.5, z, 3.4, 6.5, 3.4, r.th, col3('#f2f2ee'));
    B.plain.pyramid(x, ry + 5, z, 2.5, 8, r.th, col3('#f2f2ee'));
  }
}
function capRings(buf, rings, y, col) {
  const contour = rings[0].map(q => new THREE.Vector2(q[0], q[1])), holes = rings.slice(1).map(h => h.map(q => new THREE.Vector2(q[0], q[1])));
  let faces; try { faces = THREE.ShapeUtils.triangulateShape(contour, holes); } catch (e) { return; }
  const all = [...contour, ...holes.flat()];
  for (const f of faces) {
    const [a, b, c] = f.map(i => all[i]);
    buf.tri([a.x, y, a.y], [b.x, y, b.y], [c.x, y, c.y], [a.x / 2, a.y / 2], [b.x / 2, b.y / 2], [c.x / 2, c.y / 2], col, [0, 1, 0]);
  }
}
function hipRoof(buf, rings, top, pitch, col, eave, maxRise) {
  const tp = Math.tan(pitch * Math.PI / 180);
  let r0 = insetRings(rings, -eave); if (!validInset(rings, r0)) { r0 = rings; eave = 0; }
  // binary search the deepest valid inset
  let lo = 0, hi = maxRise / tp, best = null;
  const t1 = insetRings(rings, hi); if (validInset(rings, t1)) { lo = hi; best = t1; }
  else for (let it = 0; it < 14; it++) { const mid = (lo + hi) / 2, t = insetRings(rings, mid); if (validInset(rings, t)) { lo = mid; best = t; } else hi = mid; }
  if (!best || lo < 0.3) { capRings(buf, rings, top, col); return; }
  const d = lo, y0 = top - eave * tp, y1 = top + d * tp, slope = (d + eave) * Math.sqrt(1 + tp * tp);
  for (let k = 0; k < rings.length; k++) {
    const A = r0[k], Bq = best[k], n = A.length;
    for (let i = 0; i < n; i++) {
      const a = A[i], b = A[(i + 1) % n], a1 = Bq[i], b1 = Bq[(i + 1) % n];
      const ex = b[0] - a[0], ez = b[1] - a[1], el = Math.hypot(ex, ez) || 1e-9, ux = ex / el, uz = ez / el;
      const U = q => ((q[0] - a[0]) * ux + (q[1] - a[1]) * uz) / 2;
      const hint = [ez / el, 1 / tp, -ex / el];
      buf.quad([a[0], y0, a[1]], [b[0], y0, b[1]], [b1[0], y1, b1[1]], [a1[0], y1, a1[1]], [U(a), 0], [U(b), 0], [U(b1), slope / 2], [U(a1), slope / 2], col, hint);
      // eave underside / fascia
      if (eave > 0) { const w0 = rings[k][i], w1 = rings[k][(i + 1) % n]; buf.quad([a[0], y0, a[1]], [b[0], y0, b[1]], [w1[0], top, w1[1]], [w0[0], top, w0[1]], [0, 0], [el / 2, 0], [el / 2, .3], [0, .3], col.map(v => v * .6), [0, -1, 0]); }
    }
  }
  if (Math.abs(area(best[0])) > 0.5) capRings(buf, best, y1, col);
}

/* Rainbow Bridge (1931, rebuilt 2002): buff stone, three arches with a wide centre span,
   humped paver deck, black iron railings, lamp posts with red banners */
function rainbowBridge(B, l) {
  const a = l.p[0], b = l.p[l.p.length - 1], dx = b[0] - a[0], dz = b[1] - a[1];
  const ext = 4, L0 = Math.hypot(dx, dz), ux = dx / L0, uz = dz / L0;
  const A = [a[0] - ux * ext, a[1] - uz * ext], L = L0 + 2 * ext, th = Math.atan2(dz, dx);
  const y0 = terrainY(...A), y1 = terrainY(A[0] + ux * L, A[1] + uz * L);
  const W = 4.2, stone = col3('#d9caa6'), paver = col3('#9a7d68'), iron = col3('#1d1f1f');
  const deckY = t => y0 + (y1 - y0) * t + 0.25 + 1.5 * Math.sin(Math.PI * t);
  const arches = [[0.17, 0.33], [0.36, 0.64], [0.67, 0.83]];
  const step = 0.5, n = Math.ceil(L / step);
  for (let i = 0; i < n; i++) {
    const t = (i + .5) / n, X = A[0] + ux * L * t, Z = A[1] + uz * L * t, dy = deckY(t);
    let bottom = terrainY(X, Z) - 1.5;
    for (const [s0, s1] of arches) if (t > s0 && t < s1) {
      const u = (t - s0) / (s1 - s0) * 2 - 1, half = (s1 - s0) * L / 2;
      const spring = terrainY(A[0] + ux * L * s0, A[1] + uz * L * s0) - 1.2;
      bottom = Math.max(bottom, Math.min(dy - 0.9, spring + Math.sqrt(1 - u * u) * half * 0.75));
    }
    B.plain.box(X, bottom, Z, step + 0.02, dy - bottom, W, th, stone);
    B.plain.box(X, dy, Z, step + 0.02, 0.06, W - 0.5, th, paver);
    for (const sg of [1, -1]) {
      const ox = -uz * sg * (W / 2 - 0.12), oz = ux * sg * (W / 2 - 0.12);
      B.plain.box(X + ox, dy + 1.0, Z + oz, step + 0.02, 0.07, 0.07, th, iron);
      B.plain.box(X + ox, dy + 0.15, Z + oz, step + 0.02, 0.06, 0.06, th, iron);
      if (i % 2 === 0) B.plain.box(X + ox, dy, Z + oz, 0.04, 1.0, 0.04, th, iron);
      if (i % 3 === 0) B.plain.box(X + ox, dy + 0.15, Z + oz, 0.03, 0.85, 0.03, th + .6, iron);
    }
    const t2 = (i + 1.5) / n;
    bridges.push({ a: [X - ux * step / 2, Z - uz * step / 2], b: [X + ux * step / 2, Z + uz * step / 2], w: W, ya: deckY(t - .5 / n), yb: deckY(t + .5 / n) });
  }
  // sign sits beside the path just past the east (upper-campus) end, facing the bridge
  const ex = A[0] + ux * (L + 4) - uz * 5.5, ez = A[1] + uz * (L + 4) + ux * 5.5;
  signSpot = { x: ex, z: ez, rot: th + Math.PI / 2 - 0.5 };
  for (const t of [0.12, 0.5, 0.88]) for (const sg of [1, -1]) {
    const X = A[0] + ux * L * t - uz * sg * (W / 2 - 0.12), Z = A[1] + uz * L * t + ux * sg * (W / 2 - 0.12), dy = deckY(t);
    B.plain.box(X, dy, Z, 0.16, 4.2, 0.16, th, iron);
    B.plain.box(X, dy + 4.2, Z, 0.45, 0.6, 0.45, th, col3('#f3e7c6'));
    B.plain.box(X + ux * 0.35, dy + 2.4, Z + uz * 0.35, 0.6, 1.3, 0.04, th, col3('#b01e2e'));
  }
}

