/* ---------------- instanced props ---------------- */
const dummy = new THREE.Object3D();
function instanced(geo, mat, list, setter, shadow = true) {
  const m = new THREE.InstancedMesh(geo, mat, list.length); const c = new THREE.Color();
  list.forEach((it, i) => { setter(it, dummy, c); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); if (m.instanceColor || it.col) m.setColorAt(i, c); });
  m.castShadow = shadow; m.receiveShadow = true; scene.add(m); return m;
}
const boxGeo = (() => { const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, .5, 0); return g; })();
function buildTrees() {
  const trunks = [], leaves = [];
  const greens = ['#3f7a2e', '#4d8a34', '#5b9a3c', '#477f30', '#386b29', '#6a9f3f'];
  const onBridge = (x, z) => bridges.some(br => { const [cx, cz] = closestOnSeg(x, z, br.a, br.b); return Math.hypot(x - cx, z - cz) < br.w / 2 + 2.5; });
  for (const t of D.trees) {
    if (onBridge(t[0], t[1])) continue;
    const [x, z, kind, y] = t, h = hash(x * 3.1 + z * 7.7), h2 = hash(x * 1.3 - z * 2.9);
    const conifer = h2 < 0.14, s = 3.6 + h * 3.4, th = 2.5 + h2 * 3;
    trunks.push({ x, z, y, w: conifer ? .5 : .6 + h * .3, h: th + s * 0.5 });
    addTrunk(x, z, 0.45);
    if (conifer) {
      const cc = '#2f5d2a';
      for (let k = 0; k < 4; k++) leaves.push({ x, z, y: y + 1.5 + k * 2.1, sx: s * (1 - k * .22), sy: 2.3, sz: s * (1 - k * .22), col: cc, r: h * 3 });
    } else {
      const cc = greens[Math.floor(h * 997) % greens.length];
      leaves.push({ x, z, y: y + th, sx: s, sy: s * .78, sz: s, col: cc, r: h * 6 });
      leaves.push({ x: x + (h2 - .5) * s * .5, z: z + (h - .5) * s * .5, y: y + th + s * .55, sx: s * .62, sy: s * .5, sz: s * .62, col: cc, r: h2 * 6 });
      if (h > .5) leaves.push({ x: x - (h2 - .5) * s * .6, z: z + (h2 - .3) * s * .5, y: y + th + s * .15, sx: s * .55, sy: s * .55, sz: s * .55, col: greens[(Math.floor(h * 997) + 1) % greens.length], r: h * 2 });
    }
  }
  // shrubs along campus buildings
  const doorPts = doorList.map(d => [d.x + d.nx, d.z + d.nz]);
  for (const b of D.buildings) if (b.n && (b.k === 'brick' || b.k === 'stone')) {
    const p = b.p;
    for (let i = 0; i < p.length; i++) {
      const a = p[i], c = p[(i + 1) % p.length], dx = c[0] - a[0], dz = c[1] - a[1], L = Math.hypot(dx, dz);
      for (let s = 1.6; s < L - 1.2; s += 2.6) {
        const x = a[0] + dx / L * s + dz / L * 1.1, z = a[1] + dz / L * s - dx / L * 1.1;
        if (pip(x, z, p) || doorPts.some(d => Math.hypot(d[0] - x, d[1] - z) < 3.2)) continue;
        const hh = hash(x + z * 3), sz = 0.9 + hh * .6;
        leaves.push({ x, z, y: terrainY(x, z) - .1, sx: sz, sy: sz * .9, sz, col: hh > .5 ? '#3c6e2c' : '#4a7d33', r: Math.atan2(dz, dx) });
      }
    }
  }
  instanced(boxGeo, lambert(TEX.bark, { vertexColors: false }), trunks, (t, o) => { o.position.set(t.x, t.y - .3, t.z); o.scale.set(t.w, t.h, t.w); o.rotation.set(0, 0, 0); });
  instanced(boxGeo, new THREE.MeshLambertMaterial({ map: TEX.leaves }), leaves, (t, o, c) => { o.position.set(t.x, t.y, t.z); o.scale.set(t.sx, t.sy, t.sz); o.rotation.set(0, t.r, 0); c.set(t.col); });
}
let lampHeads;
function buildLamps() {
  const L = D.lamps;
  instanced(boxGeo, new THREE.MeshLambertMaterial({ color: 0x2a2e2b }), L, (l, o) => { o.position.set(l[0], l[2] - .2, l[1]); o.scale.set(.16, 4.4, .16); o.rotation.set(0, 0, 0); });
  lampHeads = instanced(boxGeo, new THREE.MeshLambertMaterial({ color: 0xf5ead0, emissive: 0x000000 }), L, (l, o) => { o.position.set(l[0], l[2] + 4.1, l[1]); o.scale.set(.55, .45, .55); o.rotation.set(0, 0, 0); }, false);
  for (const l of L) addTrunk(l[0], l[1], 0.2);
}
