/* ---------- PNC Bank, South Broad Street (the OSM "PNC Bank" point): classical limestone front, walkable inside ----------
   Raised granite porch with four columns, a frieze with the PNC sign, glass doors (an open doorway in the doors system),
   a walk-up ATM and lanterns that light up at night. Inside: a lobby with a rope queue and two desks, the teller counter
   with glass windows, a back office and the vault room, whose round steel door can be smashed open (see Bank).
   Frame: u runs from the front wall into the building, v across the front; bank.W(u, v) -> [x, z], bank.uv(x, z) -> [u, v]. */
let bank = null;
function bankFrame(b) {
  if (bank) return bank;
  const broad = D.lines.filter(l => /Broad Street/.test(l.n || ''));
  const roadD = (x, z) => { let d = 1e9; for (const l of broad) for (let i = 0; i < l.p.length - 1; i++) { const [qx, qz] = closestOnSeg(x, z, l.p[i], l.p[i + 1]); d = Math.min(d, Math.hypot(qx - x, qz - z)); } return d; };
  let best = null;   // the front: the wall facing Broad Street
  for (let i = 0; i < b.p.length; i++) { const a = b.p[i], c = b.p[(i + 1) % b.p.length], L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L < 6) continue; const d = roadD((a[0] + c[0]) / 2, (a[1] + c[1]) / 2); if (!best || d < best[0]) best = [d, a, c, L]; }
  const [, a, c, L] = best, M = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
  let ix = -(c[1] - a[1]) / L, iz = (c[0] - a[0]) / L; if (!pip(M[0] + ix * .5, M[1] + iz * .5, b.p)) { ix = -ix; iz = -iz; }
  const vx = -iz, vz = ix, W = (u, v) => [M[0] + ix * u + vx * v, M[1] + iz * u + vz * v];
  const uv = (x, z) => { const dx = x - M[0], dz = z - M[1]; return [dx * ix + dz * iz, dx * vx + dz * vz]; };
  const q = b.p.map(p => uv(p[0], p[1])), fy = Math.max(...b.p.map(p => terrainY(p[0], p[1]))) + 0.15;
  return bank = { b, W, uv, th: Math.atan2(iz, ix), ix, iz, vx, vz, M, fy, depth: Math.max(...q.map(p => p[0])), v0: Math.min(...q.map(p => p[1])), v1: Math.max(...q.map(p => p[1])), front: [a, c], gaps: [] };
}
function bankBuild(B, b) {
  const F = bankFrame(b), { W, th, fy, depth: Dp, v0, v1 } = F, top = b.t + 0.7, T = 0.3, vm = (v0 + v1) / 2, wid = v1 - v0;
  B.ashlar = B.ashlar || new Buf(); B.lantern = B.lantern || new Buf();
  const box = (u, v, y, su, sy, sv, col, buf = B.plain, uvs) => { const [x, z] = W(u, v); buf.box(x, y, z, su, sy, sv, th, col, uvs); };
  const rect = (u0, u1, va, vb) => [W(u0, va), W(u1, va), W(u1, vb), W(u0, vb)];
  const solid = (u0, u1, va, vb, h = fy + 3.5) => addCollider([rect(u0, u1, va, vb)], h);
  const face = (m, u, v, y) => { const [x, z] = W(u, v); m.position.set(x, y, z); m.rotation.y = Math.atan2(-F.ix, -F.iz); scene.add(m); return m; };   // a plane facing the street (-u)
  const W1 = [1, 1, 1], granite = col3('#8d8a84'), lime = col3('#e6dfcf'), cream = col3('#efe9dc'), wood = col3('#5a3b26'), brass = col3('#c9a74a'),
    navy = col3('#1d3557'), steel = col3('#8f979f'), glass = col3('#2f4253'), iron = col3('#2a2d31'), warm = col3('#ffe7b0');
  // walls: limestone front, brick sides and back, plaster and a wood wainscot inside; the doorway is a real opening
  for (let i = 0; i < b.p.length; i++) {
    const a = b.p[i], c = b.p[(i + 1) % b.p.length], len = Math.hypot(c[0] - a[0], c[1] - a[1]); if (len < .05) continue;
    const dx = (c[0] - a[0]) / len, dz = (c[1] - a[1]) / len, rot = Math.atan2(dz, dx), front = a === F.front[0];
    let nx = dz, nz = -dx; if (pip((a[0] + c[0]) / 2 + nx * .3, (a[1] + c[1]) / 2 + nz * .3, b.p)) { nx = -nx; nz = -nz; }
    const at = (s, k) => [a[0] + dx * s - nx * k, a[1] + dz * s - nz * k];   // s along the wall, k inward
    const buf = front ? B.ashlar : B.modern, uvs = front ? .5 : 1 / 3.4;
    const piece = (s0, s1, y0, y1) => {
      const [x, z] = at((s0 + s1) / 2, T / 2); buf.box(x, y0, z, s1 - s0, y1 - y0, T, rot, W1, uvs);
      const l0 = Math.max(s0, T), l1 = Math.min(s1, len - T), yb = Math.max(y0, fy), yl = Math.min(y1, fy + 5);
      if (l1 > l0 && yl > yb) {
        const [lx, lz] = at((l0 + l1) / 2, T + .02); B.plain.box(lx, yb, lz, l1 - l0, yl - yb, .04, rot, cream);
        if (y0 <= fy + .5) { const [wx, wz] = at((l0 + l1) / 2, T + .05); B.plain.box(wx, fy, wz, l1 - l0, 1.0, .04, rot, wood); }
      }
      if (y0 <= fy + .5) addCollider([[at(s0, -.05), at(s1, -.05), at(s1, T + .1), at(s0, T + .1)]], top + 3);
    };
    if (front) {
      const sOf = v => { const [x, z] = W(0, v); return (x - a[0]) * dx + (z - a[1]) * dz; }, g0 = Math.min(sOf(-1.2), sOf(1.2)), g1 = Math.max(sOf(-1.2), sOf(1.2));
      piece(0, g0, b.b, top); piece(g0, g1, fy + 3.0, top); piece(g1, len, b.b, top);
      const m = at((g0 + g1) / 2, 0);   // the doors system adds the frame, the stoop and steps, and the glass doors standing open
      F.gaps.push({ x: m[0], z: m[1], ang: rot, nx, nz, w: g1 - g0, h: 3.0, base: fy, open: true, bank: true, b });
    } else piece(0, len, b.b, top);
  }
  // granite porch up from the sidewalk (the steps come with the doorway)
  let g0 = 1e9; for (const u of [-3, -1.6, 0]) for (const v of [v0, vm, v1]) g0 = Math.min(g0, terrainY(...W(u, v)));
  box(-.8, vm, g0 - .3, 1.6, fy - g0 + .3, wid + .6, granite);
  floors.push((x, z) => { const [u, v] = F.uv(x, z); return u > -1.6 && u <= .05 && v > v0 - .3 && v < v1 + .3 ? fy : null; });
  // four columns carrying the entablature
  const cyl = (x, y, z, r0, r1, h, col, n = 14) => { for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2, Q = (an, r, yy) => [x + Math.cos(an) * r, yy, z + Math.sin(an) * r]; B.plain.quad(Q(a0, r0, y), Q(a1, r0, y), Q(a1, r1, y + h), Q(a0, r1, y + h), [i / n * 2, 0], [(i + 1) / n * 2, 0], [(i + 1) / n * 2, h / 2], [i / n * 2, h / 2], col, [Math.cos((a0 + a1) / 2), 0, Math.sin((a0 + a1) / 2)]); } };
  const colTop = fy + 5.4;
  for (const v of [-5.2, -1.95, 1.95, 5.2]) {
    const [x, z] = W(-.85, v);
    box(-.85, v, fy, .95, .3, .95, lime); cyl(x, fy + .3, z, .38, .32, colTop - fy - .65, lime); box(-.85, v, colTop - .35, .9, .35, .9, lime);
    box(-1.45, v, fy, .22, .12, .3, warm, B.lantern);   // uplight
    addTrunk(x, z, .42);
  }
  box(-.68, vm, colTop, 1.36, .45, wid + .5, lime, B.ashlar, .5);      // architrave
  box(-.68, vm, colTop + .45, 1.36, 1.05, wid + .5, W1, B.ashlar, .5); // frieze
  box(-.85, vm, colTop + 1.5, 1.8, .28, wid + .9, lime);                // cornice
  box(-.75, vm, colTop + 1.78, 1.5, .12, wid + .7, col3('#cfc8b8'));
  // the PNC sign on the frieze (self-lit, so it reads at night) and a smaller one inside
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 120; const g = cv.getContext('2d');
  g.fillStyle = '#0f2340'; g.fillRect(0, 0, 1024, 120); g.fillStyle = '#ef7622'; g.fillRect(0, 110, 1024, 10);
  g.fillStyle = '#ef7622'; g.beginPath(); g.moveTo(232, 92); g.lineTo(276, 16); g.lineTo(300, 58); g.lineTo(276, 58); g.lineTo(262, 92); g.closePath(); g.fill();
  g.fillStyle = '#c3c8cf'; g.beginPath(); g.moveTo(320, 92); g.lineTo(276, 16); g.lineTo(262, 40); g.lineTo(290, 92); g.closePath(); g.fill();
  g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '800 74px "Barlow Semi Condensed", Arial, sans-serif'; g.fillText('PNC BANK', 560, 58);
  const st = new THREE.CanvasTexture(cv); st.colorSpace = THREE.SRGBColorSpace; const sMat = new THREE.MeshBasicMaterial({ map: st });
  face(new THREE.Mesh(new THREE.PlaneGeometry(8.4, 8.4 * 120 / 1024), sMat), -1.37, vm, colTop + .97);
  // tall windows between the columns, the ATM under the left one, a transom over the doors and lanterns beside them
  const win = (v, y0, y1, w = 1.5) => {
    box(T / 2, v, y0, T + .08, y1 - y0, w, glass, B.lantern);
    box(-.06, v, y0 - .18, .22, .18, w + .4, lime); box(-.06, v, y1, .22, .3, w + .4, lime);
    for (const s of [-1, 1]) box(-.05, v + s * (w / 2 + .1), y0, .16, y1 - y0, .2, lime);
    for (const k of [-.06, T + .06]) { box(k, v, y0, .04, y1 - y0, .06, iron); for (let n = 1; n < 3; n++) box(k, v, y0 + (y1 - y0) * n / 3, .04, .05, w, iron); }
  };
  win(3.55, fy + .9, fy + 4.6); win(-3.55, fy + 2.7, fy + 4.6); win(0, fy + 3.25, fy + 4.5, 2.2);
  box(-.22, -3.55, fy, .44, 2.25, 1.2, col3('#2b2f36'));                // ATM housing
  box(-.48, -3.55, fy + .95, .14, .06, .8, col3('#17191d'));            // keypad shelf
  box(-.47, -3.33, fy + 1.12, .06, .02, .14, col3('#0a0b0c'));          // card slot
  box(-.12, -3.55, fy + 2.3, .26, .1, 1.1, warm, B.lantern);            // canopy light
  const at = document.createElement('canvas'); at.width = 256; at.height = 256; const ag = at.getContext('2d');
  ag.fillStyle = '#ef7622'; ag.fillRect(0, 0, 256, 60); ag.fillStyle = '#ffffff'; ag.font = '800 40px "Barlow Semi Condensed", Arial, sans-serif'; ag.textAlign = 'center'; ag.fillText('PNC ATM', 128, 45);
  ag.fillStyle = '#0a3d73'; ag.fillRect(40, 92, 176, 128); ag.fillStyle = '#ffffff'; ag.font = '600 24px "Barlow Semi Condensed", Arial, sans-serif'; ag.fillText('Welcome', 128, 140); ag.font = '20px Arial, sans-serif'; ag.fillText('Insert card', 128, 180);
  const atT = new THREE.CanvasTexture(at); atT.colorSpace = THREE.SRGBColorSpace;
  face(new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: atT })), -.45, -3.55, fy + 1.55);
  for (const s of [-1, 1]) { box(-.2, s * 2.45, fy + 2.55, .3, .5, .3, warm, B.lantern); box(-.06, s * 2.45, fy + 2.75, .14, .06, .06, iron); }
  // inside: marble floor, coffered ceiling with light panels
  capRings(B.plain, [insetRings([b.p], 0.1)[0]], fy, col3('#d8d2c6'));
  floors.push((x, z) => pip(x, z, b.p) ? fy : null);
  box(6, vm, fy + .005, 10, .01, wid - 1.6, col3('#c4b9a6')); box(5.6, 0, fy + .012, 10.4, .01, 1.8, navy);
  box(Dp / 2, vm, fy + 5, Dp - .5, .15, wid - .5, cream);
  for (let u = 2; u < Dp - 1; u += 3) box(u, vm, fy + 4.8, .25, .2, wid - .6, lime);
  for (let u = 3.5; u < 18; u += 6) for (const v of [-3.4, 3.4]) box(u, v, fy + 4.86, 1.0, .06, 1.0, col3('#fff4d8'), B.lantern);
  { const [x, z] = W(13, vm); const l = new THREE.PointLight(0xfff0d8, 5, 34, 1); l.position.set(x, fy + 4.2, z); scene.add(l); interiorLights.push(l); }
  // rope queue up to the tellers
  for (const v of [-2.2, -3.8]) {
    for (let u = 5; u <= 11; u += 2) { box(u, v, fy, .3, .04, .3, brass); box(u, v, fy, .07, .95, .07, brass); box(u, v, fy + .95, .12, .08, .12, brass); addTrunk(...W(u, v), .12); }
    box(8, v, fy + .8, 6, .05, .05, col3('#8a1c24'));
  }
  box(5, -3, fy + .8, .05, .05, 1.6, col3('#8a1c24'));
  const person = (u, v, shirt) => {
    for (const s of [-1, 1]) { box(u, v + s * .12, fy, .22, .85, .2, col3('#2b3a55')); box(u, v + s * .33, fy + .8, .16, .7, .14, col3(shirt)); }
    box(u, v, fy + .85, .28, .68, .5, col3(shirt)); box(u, v, fy + 1.55, .32, .32, .32, col3('#e8b896')); box(u, v, fy + 1.85, .34, .1, .34, col3('#3a2a1e'));
  };
  // desks for the bankers
  for (const u of [4.5, 8.5]) {
    box(u, 4.6, fy, 1.6, .76, .8, wood); box(u, 4.6, fy + .76, 1.65, .04, .85, col3('#3d2a1b')); box(u, 4.85, fy + .8, .5, .38, .05, col3('#16181c'));
    box(u, 3.75, fy, .5, .48, .5, navy); box(u, 3.52, fy + .48, .5, .5, .06, navy); box(u, 5.5, fy, .5, .5, .5, navy);
    solid(u - .85, u + .85, 4.15, 5.05, fy + 1);
  }
  person(4.5, 5.55, '#ffffff');
  for (const v of [v0 + .5, v1 - .5]) { box(.9, v, fy, .5, .5, .5, col3('#7a5134')); box(.9, v, fy + .5, .7, .9, .7, col3('#3f6a45')); }   // potted plants by the doors
  // the teller counter: wood, marble top, brass-framed glass; the staff gap is at the right end
  const cv0 = v0 + T, cg = 4.7, cm = (cv0 + cg) / 2;
  box(13, cm, fy, .8, 1.05, cg - cv0, wood); box(12.95, cm, fy + 1.05, .95, .06, cg - cv0 + .05, col3('#e9e4da'));
  for (const v of [cv0 + .05, -3.2, -.4, 2.4, cg - .05]) box(13.05, v, fy + 1.11, .08, 1.3, .08, brass);
  box(13.05, cm, fy + 2.35, .1, .08, cg - cv0, brass);
  for (const v of [-4.6, -1.8, 1.0]) { box(13.25, v, fy + 1.11, .06, .38, .5, col3('#16181c')); box(12.62, v, fy + .7, .04, .2, .3, brass); }
  solid(12.55, 13.5, cv0 - .2, cg, fy + 2.5);
  const gb = new Buf(); { const [x, z] = W(13.05, cm); gb.box(x, fy + 1.11, z, .03, 1.24, cg - cv0, th, [1, 1, 1]); }
  scene.add(gb.mesh(new THREE.MeshLambertMaterial({ color: 0xbfe3f2, transparent: true, opacity: .25, depthWrite: false, vertexColors: true })));
  person(14, -4.6, '#1d3557'); person(14, -1.8, '#ef7622');
  // back office: filing cabinets and a copier, then the wall to the vault room
  box(17.9, -4.2, fy, .7, 1.35, 3.6, col3('#6f757c')); box(17.9, 3.3, fy, .9, 1.1, 1.2, col3('#d9d9d4')); solid(17.5, 18.4, -6, -2.4); solid(17.4, 18.4, 2.7, 3.9);
  const pu = 19.15;
  box(pu, (v0 - .8) / 2, fy, .3, 5, -.8 - v0, cream); box(pu, (.8 + v1) / 2, fy, .3, 5, v1 - .8, cream); box(pu, 0, fy + 2.5, .3, 2.5, 1.6, cream);
  solid(19, 19.3, v0, -.8); solid(19, 19.3, .8, v1);
  for (const s of [-1, 1]) box(pu, s * .85, fy, .36, 2.5, .1, steel); box(pu, 0, fy + 2.45, .36, .1, 1.8, steel);
  face(new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2 * 120 / 1024), sMat), 18.98, 0, fy + 3.5);
  // the vault: a thick wall with a round opening behind a big steel door on a hinge (Bank swings it open)
  const vu0 = Dp - 4.6, vu1 = vu0 + 1, cy = fy + 1.45, R0 = 1.22, concrete = col3('#7b8188');
  box(vu0 + .5, (v0 - 1.4) / 2, fy, 1, 5, -1.4 - v0, concrete); box(vu0 + .5, (1.4 + v1) / 2, fy, 1, 5, v1 - 1.4, concrete); box(vu0 + .5, 0, fy + 2.9, 1, 2.1, 2.8, concrete);
  solid(vu0, vu1, v0, -1.4); solid(vu0, vu1, 1.4, v1); F.vaultCol = addCollider([rect(vu0 - .55, vu1, -1.4, 1.4)], fy + 3.5);   // the door itself, until it swings open
  box((19.3 + vu0) / 2, vm, fy + .006, vu0 - 19.3, .01, wid - .6, col3('#9aa0a6'));
  const steelMat = new THREE.MeshLambertMaterial({ color: 0xa3abb3, emissive: 0x15181b, side: THREE.DoubleSide });
  const sh = new THREE.Shape(); sh.moveTo(-1.65, -1.6); sh.lineTo(1.65, -1.6); sh.lineTo(1.65, 1.6); sh.lineTo(-1.65, 1.6); sh.closePath();
  const hole = new THREE.Path(); hole.absarc(0, 0, R0, 0, Math.PI * 2, true); sh.holes.push(hole);
  face(new THREE.Mesh(new THREE.ShapeGeometry(sh, 32), steelMat), vu0 - .02, 0, cy);
  face(new THREE.Mesh(new THREE.TorusGeometry(R0 + .05, .1, 8, 40), steelMat), vu0 - .06, 0, cy);
  const door = new THREE.Group(), [hx, hz] = W(vu0 - .3, R0 + .08), dc = -(R0 + .08), doorMat = new THREE.MeshLambertMaterial({ color: 0xb4bcc4, emissive: 0x1a1d21 });
  door.position.set(hx, cy, hz); F.door0 = door.rotation.y = Math.atan2(-F.vz, F.vx); scene.add(door);   // local x along +v, local z toward the lobby
  const part = (geo, x, y, z, rx = 0, rz = 0, mat = doorMat) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); door.add(m); return m; };
  const disc = part(new THREE.CylinderGeometry(R0 + .1, R0 + .1, .45, 40), dc, 0, 0, Math.PI / 2); disc.castShadow = true;
  part(new THREE.TorusGeometry(R0 - .25, .03, 4, 40), dc, 0, .23);
  part(new THREE.TorusGeometry(.38, .045, 6, 24), dc, 0, .32, 0, 0, steelMat);
  for (let k = 0; k < 3; k++) part(new THREE.BoxGeometry(.8, .06, .06), dc, 0, .32, 0, k * Math.PI / 3, steelMat);
  part(new THREE.CylinderGeometry(.1, .1, .2, 12), dc, 0, .3, Math.PI / 2, 0, steelMat);
  const bolt = new THREE.CylinderGeometry(.06, .06, .08, 8);
  for (let k = 0; k < 16; k++) { const an = k / 16 * Math.PI * 2; part(bolt, dc + Math.cos(an) * (R0 - .1), Math.sin(an) * (R0 - .1), .25, Math.PI / 2, 0, steelMat); }
  part(new THREE.CylinderGeometry(.13, .13, 1.6, 12), 0, 0, 0, 0, 0, steelMat);
  const ccv = document.createElement('canvas'); ccv.width = ccv.height = 256; F.crackG = ccv.getContext('2d');
  F.crackTex = new THREE.CanvasTexture(ccv); F.crackTex.colorSpace = THREE.SRGBColorSpace;
  F.crack = part(new THREE.CircleGeometry(R0 + .08, 40), dc, 0, .236, 0, 0, new THREE.MeshBasicMaterial({ map: F.crackTex, transparent: true, depthWrite: false }));
  Object.assign(F, { door, disc, vu0, vu1, cy, R0, ang: 0 });
  // inside the vault: safe-deposit boxes on three walls, a cart of cash and a pallet of gold (hidden once it is cleaned out)
  const cu0 = vu1, cu1 = Dp - T, dep = col3('#b7bec5');
  box((cu0 + cu1) / 2, vm, fy + .006, cu1 - cu0, .01, wid - .6, col3('#5d636a'));
  for (let v = v0 + .6; v < v1 - .5; v += .46) for (let y = fy + .3; y < fy + 2.6; y += .3) box(cu1 - .1, v, y, .2, .26, .42, dep);
  for (const v of [v0 + T + .1, v1 - T - .1]) for (let u = cu0 + .4; u < cu1 - .3; u += .46) for (let y = fy + .3; y < fy + 2.6; y += .3) box(u, v, y, .42, .26, .2, dep);
  const cb = new Buf(), cash = (u, v, y, su, sy, sv, col) => { const [x, z] = W(u, v); cb.box(x, y, z, su, sy, sv, th, col); };
  box(cu0 + 1.6, -1.65, fy, 1.4, .8, 1.0, steel); box(cu0 + 1.6, 1.65, fy, 1.2, .15, .9, wood);
  solid(cu0 + .9, cu0 + 2.3, -2.15, -1.15, fy + 1); solid(cu0 + 1, cu0 + 2.2, 1.2, 2.1, fy + 1);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) { cash(cu0 + 1.05 + i * .36, -2.0 + j * .33, fy + .8 + k * .12, .32, .11, .15, col3(k % 2 ? '#6d9a58' : '#5f8f4e')); cash(cu0 + 1.05 + i * .36, -2.0 + j * .33, fy + .8 + k * .12 + .04, .33, .03, .04, col3('#efe8cf')); }
  for (let k = 0; k < 4; k++) for (let i = 0; i < 4 - k; i++) for (let j = 0; j < 3; j++) cash(cu0 + 1.1 + (i + k / 2) * .3, 1.35 + j * .3, fy + .15 + k * .1, .26, .1, .14, col3('#e8b730'));
  F.cash = cb.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x141200 })); scene.add(F.cash);
  // alarm lights: over the vault, over the back-office door and the red bell on the front (Bank flashes them)
  const ab = new Buf(), alarm = (u, v, y, s) => { const [x, z] = W(u, v); ab.box(x, y, z, s, s * .7, s, th, W1); };
  alarm(vu0 - .15, 0, fy + 3.2, .35); alarm(18.9, 0, fy + 4.3, .3); alarm(-.12, 5.95, fy + 4.4, .4);
  F.alarmMat = new THREE.MeshLambertMaterial({ color: 0x9a1414, emissive: 0x000000 }); scene.add(ab.mesh(F.alarmMat));
}

/* towers, sign, bleachers, bridges */
function specials(B) {
  const S = D.specials, stoneT = [1, 1, 1];
  const harb = D.buildings.find(b => b.n === 'Harbison Chapel');
  const ang = b => { let best = 0, L = 0; for (let i = 0; i < b.p.length; i++) { const a = b.p[i], c = b.p[(i + 1) % b.p.length], l = Math.hypot(c[0] - a[0], c[1] - a[1]); if (l > L) { L = l; best = Math.atan2(c[1] - a[1], c[0] - a[0]); } } return best; };
  function tower(x, z, gy, size, h, rot, cap) {
    const c = Math.cos(rot), s = Math.sin(rot), hs = size / 2;
    const ring = [[-hs, -hs], [hs, -hs], [hs, hs], [-hs, hs]].map(([u, v]) => [x + u * c - v * s, z + u * s + v * c]);
    for (let i = 0; i < 4; i++) {
      const a = ring[i], b = ring[(i + 1) % 4], dx = b[0] - a[0], dz = b[1] - a[1];
      B.stone.quad([a[0], gy - 1, a[1]], [b[0], gy - 1, b[1]], [b[0], gy + h, b[1]], [a[0], gy + h, a[1]], [0, -.3], [2, -.3], [2, (h + 1) / 3.8], [0, (h + 1) / 3.8], stoneT, [dz / size, 0, -dx / size]);
    }
    capRings(B.flat, [ring], gy + h, col3('#8a867c'));
    const st = col3('#b8b1a0');
    if (cap === 'gothic') {
      // battlements + corner pinnacles
      const m = 7; for (let i = 0; i < m; i++) for (const side of [0, 1, 2, 3]) {
        const t = (i + 0.5) / m - 0.5, u = side < 2 ? t * size : (side === 2 ? hs - .3 : -hs + .3), v = side < 2 ? (side === 0 ? -hs + .3 : hs - .3) : t * size;
        if (i % 2 === 0) B.plain.box(x + u * c - v * s, gy + h, z + u * s + v * c, .7, 1.1, .6, rot, st);
      }
      for (const [u, v] of [[-hs, -hs], [hs, -hs], [hs, hs], [-hs, hs]]) {
        const X = x + u * c - v * s, Z = z + u * s + v * c;
        B.plain.box(X, gy + h - 3, Z, 1.2, 4.4, 1.2, rot, st); B.roof.pyramid(X, gy + h + 1.4, Z, .7, 3.4, rot, col3('#b8b1a0'));
      }
    } else if (cap === 'spire') {
      // Harbison: stone tower with corner pinnacles carrying a slender copper spire
      for (const [u, v] of [[-hs, -hs], [hs, -hs], [hs, hs], [-hs, hs]]) {
        const X = x + u * c - v * s, Z = z + u * s + v * c;
        B.plain.box(X, gy + h - 2, Z, 1.0, 3.2, 1.0, rot, st); B.roof.pyramid(X, gy + h + 1.2, Z, .55, 2.8, rot, col3('#6f9f88'));
      }
      B.stone.box(x, gy + h, z, size * 0.62, 2.2, size * 0.62, rot, stoneT, 0.3);
      B.roof.pyramid(x, gy + h + 2.2, z, size * 0.31, 19, rot, col3('#6f9f88'));
    } else B.roof.pyramid(x, gy + h, z, hs + .4, size * 0.9, rot, col3('#5a5d62', 1.2));
    addCollider([ring], gy + h + 2);
  }
  if (S.harbisonTower && harb) tower(S.harbisonTower[0], S.harbisonTower[1], S.harbisonTower[2], 6.5, 22, ang(harb), 'spire');
  const craw = D.buildings.find(b => b.n === 'Crawford Hall');
  if (S.crawfordTower && craw) tower(S.crawfordTower[0], S.crawfordTower[1], S.crawfordTower[2], 7, 21, ang(craw), 'gothic');
  // bleachers
  for (const a of D.areas) if (a.k === 'bleachers') {
    const r = minRect(a.p); const gy = Math.min(...a.p.map(q => terrainY(q[0], q[1])));
    const steps = 8, c = Math.cos(r.th), s = Math.sin(r.th);
    for (let i = 0; i < steps; i++) { const v = -r.lv / 2 + (i + .5) * r.lv / steps; B.plain.box(r.cx - v * s, gy, r.cz + v * c, r.lu, 0.5 + i * 0.45, r.lv / steps, r.th, col3('#a7abb0')); }
    addCollider([a.p], gy + 4.5);
  }
  // outdoor stairs as stepped blocks
  for (const l of D.lines) if (l.k === 'steps' && !l.br) {
    const p = l.p, col = col3('#bdb5a6');
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i], b = p[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), th = Math.atan2(dz, dx);
      for (let s = 0.2; s < L; s += 0.45) {
        const X = a[0] + dx / L * s, Z = a[1] + dz / L * s, y = terrainY(X, Z);
        B.plain.box(X, y - 0.8, Z, 0.46, 0.8 + 0.08, l.w + 0.3, th, col);
      }
    }
  }
  // bridges
  for (const l of D.lines) if (l.br && l.n === 'Rainbow Bridge') rainbowBridge(B, l);
  for (const l of D.lines) if (l.br && l.n !== 'Rainbow Bridge') {
    const p = l.p, y0 = terrainY(...p[0]), y1 = terrainY(...p[p.length - 1]);
    let tot = 0; const cum = [0]; for (let i = 1; i < p.length; i++) { tot += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); cum.push(tot); }
    const Y = i => Math.max(y0, y1) * 0.5 + (y0 + (y1 - y0) * cum[i] / (tot || 1)) * 0.5 + 0.35;
    const w = Math.max(l.w, 2.4), foot = l.w < 5, deck = col3(foot ? '#a69886' : '#56575a'), rail = col3('#40433f');
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i], b = p[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < .05) continue;
      const nx = -dz / L * w / 2, nz = dx / L * w / 2, ya = Y(i), yb = Y(i + 1);
      B.plain.quad([a[0] + nx, ya, a[1] + nz], [b[0] + nx, yb, b[1] + nz], [b[0] - nx, yb, b[1] - nz], [a[0] - nx, ya, a[1] - nz], [0, 0], [L, 0], [L, w], [0, w], deck, [0, 1, 0]);
      for (const sgn of [1, -1]) {
        B.plain.quad([a[0] + nx * sgn, ya - .5, a[1] + nz * sgn], [b[0] + nx * sgn, yb - .5, b[1] + nz * sgn], [b[0] + nx * sgn, yb + 1.05, b[1] + nz * sgn], [a[0] + nx * sgn, ya + 1.05, a[1] + nz * sgn], [0, 0], [L, 0], [L, 1], [0, 1], rail, [nx * sgn, 0, nz * sgn]);
      }
      bridges.push({ a, b, w, ya, yb });
    }
  }
  // buff stone college sign wall at the east end of Rainbow Bridge, by the stairs
  if (signSpot) {
    const { x, z, rot } = signSpot, gy = terrainY(x, z);
    B.plain.box(x, gy - .5, z, 7.5, 2.4, 0.9, rot, col3('#d9caa6'));
    B.plain.box(x, gy + 1.9, z, 7.9, 0.25, 1.1, rot, col3('#e9e2d0'));
    signAt = { x, z, y: gy + 1.05, rot };
    addCollider([[[-3.75, -.45], [3.75, -.45], [3.75, .45], [-3.75, .45]].map(([u, v]) => [x + u * Math.cos(rot) - v * Math.sin(rot), z + u * Math.sin(rot) + v * Math.cos(rot)])], gy + 2.2);
  }
}
const bridges = []; let signAt = null, signSpot = null, lanternMat = null;
function addSignText() {
  if (!signAt) return;
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const g = cv.getContext('2d');
  g.fillStyle = '#e9e2d0'; g.fillRect(0, 0, 512, 128); g.strokeStyle = '#8c1d2f'; g.lineWidth = 6; g.strokeRect(8, 8, 496, 112);
  g.fillStyle = '#8c1d2f'; g.textAlign = 'center'; g.font = '700 46px Silkscreen, monospace'; g.fillText('GROOVE CITY', 256, 62);
  g.font = '400 26px Silkscreen, monospace'; g.fillText('COLLEGE · EST. 1876', 256, 100);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const m = new THREE.MeshLambertMaterial({ map: t });
  for (const side of [1, -1]) {
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.4), m);
    const nx = -Math.sin(signAt.rot) * side * 0.46, nz = Math.cos(signAt.rot) * side * 0.46;
    pl.position.set(signAt.x + nx, signAt.y + 0.2, signAt.z + nz); pl.rotation.y = -signAt.rot + (side < 0 ? Math.PI : 0); scene.add(pl);
  }
}

