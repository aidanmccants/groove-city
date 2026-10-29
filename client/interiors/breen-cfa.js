/* ---------- Breen Student Union: walkable interior, to scale (from Google Maps photos) ----------
   double-height Great Room with hammer-beam trusses, plaster over wood wainscot, tall arched end window,
   iron-railed mezzanine on a central stair, Chick-fil-A counter under a drop ceiling */
let breen = null;
function breenFrame(b) {
  if (breen) return breen;
  let L = 0, a, c; for (let i = 0; i < b.p.length; i++) { const p = b.p[i], q = b.p[(i + 1) % b.p.length], l = Math.hypot(q[0] - p[0], q[1] - p[1]); if (l > L) { L = l; a = p; c = q; } }
  const ux = (c[0] - a[0]) / L, uz = (c[1] - a[1]) / L; let vx = -uz, vz = ux;
  let cx = 0, cz = 0; b.p.forEach(q => { cx += q[0]; cz += q[1]; }); cx /= b.p.length; cz /= b.p.length;
  if ((cx - a[0]) * vx + (cz - a[1]) * vz < 0) { vx = -vx; vz = -vz; }
  const fy = Math.max(...b.p.map(q => terrainY(q[0], q[1]))) + 0.15;
  const W = (u, v) => [a[0] + ux * u + vx * v, a[1] + uz * u + vz * v];
  const near = d => b.p.some((q, i) => { const r = b.p[(i + 1) % b.p.length], [px, pz] = closestOnSeg(d[0], d[1], q, r); return Math.hypot(px - d[0], pz - d[1]) < 3; });
  const doors = [W(33, 0), W(12, 0), W(L, 11), ...D.doors.filter(near).map(d => [d[0], d[1]])];
  return breen = { L, ux, uz, vx, vz, fy, W, a, th: Math.atan2(uz, ux), doors, mezz: [20, 25.5], b };
}
function interiorWall(B, b, a, c, len, n, bot, wallTop, tint, floorH, gref) {
  const F = breenFrame(b), gaps = [];
  for (const d of F.doors) { const [px, pz, t] = closestOnSeg(d[0], d[1], a, c); if (Math.hypot(px - d[0], pz - d[1]) < 3 && t * len > 1.6 && t * len < len - 1.6) gaps.push([t * len - 1.3, t * len + 1.3]); }
  gaps.sort((p, q) => p[0] - q[0]);
  const dx = (c[0] - a[0]) / len, dz = (c[1] - a[1]) / len, P = s => [a[0] + dx * s, a[1] + dz * s], uw = Math.max(1, Math.round(len / 3.2)) / len;
  const inx = -n[0] * 0.3, inz = -n[2] * 0.3, doorTop = F.fy + 3.0;
  const piece = (s0, s1, y0, y1) => {
    const p = P(s0), q = P(s1), v = y => (y - gref) / floorH;
    B.brick.quad([p[0], y0, p[1]], [q[0], y0, q[1]], [q[0], y1, q[1]], [p[0], y1, p[1]], [s0 * uw, v(y0)], [s1 * uw, v(y0)], [s1 * uw, v(y1)], [s0 * uw, v(y1)], tint, n);
    const yi0 = Math.max(y0, F.fy), vi = y => (y - F.fy) / 3.8;
    if (y1 > yi0) B.plaster.quad([p[0] + inx, yi0, p[1] + inz], [q[0] + inx, yi0, q[1] + inz], [q[0] + inx, y1, q[1] + inz], [p[0] + inx, y1, p[1] + inz], [s0 * uw, vi(yi0)], [s1 * uw, vi(yi0)], [s1 * uw, vi(y1)], [s0 * uw, vi(y1)], [1, 1, 1], [-n[0], 0, -n[2]]);
    if (y0 <= F.fy + 0.5) { const e = 0.2; addCollider([[[p[0] - n[0] * e, p[1] - n[2] * e], [q[0] - n[0] * e, q[1] - n[2] * e], [q[0] + n[0] * e, q[1] + n[2] * e], [p[0] + n[0] * e, p[1] + n[2] * e]]], wallTop + 3); }
  };
  let s = 0;
  for (const [g0, g1] of gaps) {
    if (g0 > s) piece(s, g0, bot, wallTop);
    piece(g0, g1, doorTop, wallTop);
    const m = P((g0 + g1) / 2);   // the frame, stoop and steps are added with the other doorways (planDoors)
    (F.gaps = F.gaps || []).push({ x: m[0], z: m[1], ang: Math.atan2(dz, dx), nx: n[0], nz: n[2], w: g1 - g0, h: doorTop - F.fy, base: F.fy, open: true, b });
    s = g1;
  }
  piece(s, len, bot, wallTop);
}
function breenInside(B, b) {
  const F = breenFrame(b), { W, th, fy, L } = F, wood = col3('#6b4a2e'), dark = col3('#3d2a1b'), iron = col3('#1d1f1f'), cream = col3('#efe6d2');
  const box = (u, v, y, su, sy, sv, col, buf = B.plain) => { const [x, z] = W(u, v); buf.box(x, y, z, su, sy, sv, th, col); };
  const rect = (u0, u1, v0, v1) => [W(u0, v0), W(u1, v0), W(u1, v1), W(u0, v1)];
  const uv = (x, z) => { const ax = x - F.a[0], az = z - F.a[1]; return [ax * F.ux + az * F.uz, ax * F.vx + az * F.vz]; };
  capRings(B.plain, [insetRings([b.p], 0.1)[0]], fy, col3('#a77b4f'));   // oak boards
  // tile floor: beige ceramic on the diagonal with darker grout, 1 cm above the boards; texture and plane helpers for the servery below
  const cfaTex = (w, h, draw) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d')); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const rep = (tex, rx, ry) => { const t = tex.clone(); t.repeat.set(rx, ry); return t; };
  const region = (tex, x, y, w, h) => { const t = tex.clone(); t.repeat.set(w / 1024, h / 512); t.offset.set(x / 1024, 1 - (y + h) / 512); return t; };   // one part of the 1024x512 sign atlas
  const plane = (w, h, mat, u, v, y, rot) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat), [x, z] = W(u, v); m.position.set(x, y, z); m.rotation.y = rot; scene.add(m); return m; };
  const faceV = -th, faceNV = Math.PI - th, faceU = Math.PI / 2 - th;   // plane rotations facing +v, -v and +u
  const floorTex = cfaTex(256, 256, g => {   // 0.848 m square holds one diagonal lattice of 0.6 m tiles
    g.fillStyle = '#d9cdb8'; g.fillRect(0, 0, 256, 256); g.strokeStyle = '#a99b86'; g.lineWidth = 4;
    for (const c of [-256, 0, 256, 512]) { g.beginPath(); g.moveTo(c, 0); g.lineTo(c + 256, 256); g.stroke(); }
    for (const c of [0, 256, 512]) { g.beginPath(); g.moveTo(c, 0); g.lineTo(c - 256, 256); g.stroke(); }
  });
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(20 / 0.848, 21 / 0.848);
  const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(20, 21), new THREE.MeshLambertMaterial({ map: floorTex }));
  const [fx, fz] = W(10, 11); floorMesh.position.set(fx, fy + 0.01, fz); floorMesh.rotation.set(-Math.PI / 2, -th, 0, 'YXZ'); scene.add(floorMesh);
  floors.push((x, z) => pip(x, z, b.p) ? fy : null);
  box(10, 11, fy + 3.8, 20.5, 0.15, 22, cream);                           // drop ceiling
  hipRoof(B.plaster, insetRings([b.p], 0.35), b.t - 0.15, b.pi || 45, cream, 0, 7);  // plaster roof underside
  for (let u = 27; u < L - 1.5; u += 3.6) {
    box(u, 11, b.t - 0.6, 0.35, 0.5, 21, dark);
    for (const v of [1.2, 20.8]) box(u, v, fy + 4.5, 0.4, b.t - fy - 5, 0.4, dark);
    box(u, 11, b.t + 2.2, 0.3, 0.3, 11, dark);
  }
  const [ex, ez] = W(L - 0.45, 11);
  const wm = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, map: pix(18, 18, g => { g.fillStyle = '#3a3a36'; g.fillRect(0, 0, 18, 18); g.fillStyle = '#d7e9f7'; for (let x = 1; x < 18; x += 4) for (let y = 2; y < 18; y += 3) g.fillRect(x, y, 3, 2); g.clearRect(0, 0, 4, 4); g.clearRect(14, 0, 4, 4); }, false) }));
  wm.position.set(ex, fy + 5.2, ez); wm.rotation.y = -th + Math.PI / 2; scene.add(wm);
  const [m0, m1] = F.mezz, my = fy + 4.2;
  box((m0 + m1) / 2, 11, my - 0.3, m1 - m0, 0.3, 21, wood);
  floors.push((x, z) => { const [u, v] = uv(x, z); return u > m0 && u < m1 && v > 0.4 && v < 21.6 ? my : null; });
  for (const v of [0.6, 3, 8.8, 13.2, 19, 21.4]) box(m1 - 0.2, v, fy, 0.4, my - fy - 0.3, 0.4, dark);
  for (const [v0, v1] of [[0.5, 9.6], [12.4, 21.5]]) {
    box(m1 - 0.05, (v0 + v1) / 2, my + 1.0, 0.08, 0.08, v1 - v0, iron); box(m1 - 0.05, (v0 + v1) / 2, my + 0.1, 0.06, 0.06, v1 - v0, iron);
    for (let v = v0; v < v1; v += 0.25) box(m1 - 0.05, v, my, 0.03, 1.0, 0.03, iron);
    addCollider([rect(m1 - 0.2, m1 + 0.1, v0, v1)], my + 1.1, my - 0.2);
  }
  const s0 = m1, s1 = m1 + 7;   // 24 risers of 17.5 cm over 7 m
  for (let i = 0; i < 24; i++) box(s1 - (i + 0.5) * (7 / 24), 11, fy, 7 / 24 + 0.01, (i + 1) * 4.2 / 24, 2.8, col3('#5a3c26'));
  floors.push((x, z) => { const [u, v] = uv(x, z); return u >= s0 && u <= s1 && v > 9.6 && v < 12.4 ? fy + 4.2 * (s1 - u) / 7 : null; });
  for (const v of [9.5, 12.5]) for (let u = s0; u < s1; u += 0.5) box(u, v, fy + 4.2 * (s1 - u) / 7 + 0.1, 0.04, 1.0, 0.04, iron);
  // Chick-fil-A servery (u 0..20, v 0..22). Counter, staff zone, door route and queue slots are fixed by the game logic.
  {
    const gl = new Buf(), ss = col3('#b9bec2'), blk = col3('#2b2e31'), red = col3('#c8102e'), wht = col3('#f2f2f2'), pcol = col3('#6f685f');
    const pants = col3('#15171a'), polo = col3('#d0202e'), skin = col3('#e0b48c'), hair = col3('#2b1d14');
    // the six new canvases: subway tile, stainless mosaic, menu boards, sign atlas, CFA logo and CARES plaques
    const subway = cfaTex(256, 128, g => { g.fillStyle = '#cfcac0'; g.fillRect(0, 0, 256, 128); for (let r = 0; r < 4; r++) for (let c = -1; c < 4; c++) { g.fillStyle = (r + c) & 1 ? '#f4f2ec' : '#efede6'; g.fillRect(c * 64 + (r & 1) * 32 + 1.5, r * 32 + 1.5, 61, 29); } });
    subway.wrapS = subway.wrapT = THREE.RepeatWrapping;
    const mosaic = cfaTex(128, 128, g => { g.fillStyle = '#6d7478'; g.fillRect(0, 0, 128, 128); const C = ['#a8adb1', '#c4c8cb', '#9aa0a5', '#b9bec2']; for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { g.fillStyle = C[(x * 3 + y * 5 + x * y) % 4]; g.fillRect(x * 8 + 1, y * 8 + 1, 6, 6); } });
    mosaic.wrapS = mosaic.wrapT = THREE.RepeatWrapping;
    const menu = cfaTex(2140, 160, g => {   // four backlit boards, 2.6 m x 0.8 m each, 0.1 m black bezels between
      g.fillStyle = '#0d0d0d'; g.fillRect(0, 0, 2140, 160); g.textBaseline = 'middle'; g.textAlign = 'left';
      const titles = ['Meals & Entrées', 'Chicken', 'Salads', 'Drinks · Treats'], tints = ['#d7a86e', '#c98a4b', '#5f9e3c'], cups = ['#e77a9a', '#f3d24a', '#7a4a2a', '#8bc34a'];
      titles.forEach((t, i) => {
        const x0 = i * 540;
        g.fillStyle = '#fbfbf8'; g.fillRect(x0, 0, 520, 160);
        g.fillStyle = '#9e1b22'; g.font = 'bold 32px "Barlow Semi Condensed", Arial, sans-serif'; g.fillText(t, x0 + 18, 28, 484); g.fillRect(x0 + 18, 50, 484, 3);
        for (let k = 0; k < 4; k++) {
          const y = 74 + k * 24;
          if (i === 3) { g.fillStyle = cups[k]; g.beginPath(); g.moveTo(x0 + 20, y - 9); g.lineTo(x0 + 40, y - 9); g.lineTo(x0 + 37, y + 9); g.lineTo(x0 + 23, y + 9); g.fill(); }
          else if (i === 1) { g.fillStyle = tints[1]; g.fillRect(x0 + 22, y - 8, 16, 16); }
          else { g.fillStyle = tints[i === 0 ? 0 : 2]; g.beginPath(); g.arc(x0 + 30, y, 9, 0, Math.PI * 2); g.fill(); }
          g.fillStyle = '#8a9096'; g.fillRect(x0 + 54, y - 5, 150 + ((k * 61 + i * 37) % 120), 10);
          g.fillStyle = '#b5bbc0'; g.fillRect(x0 + 452, y - 5, 40, 10);
        }
      });
    });
    const atlas = cfaTex(1024, 512, g => {   // Pick Up sign (0,0), temporary-hours sign (0,130), modified-hours card (320,130), script logo (610,0)
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#c8102e'; g.fillRect(0, 0, 520, 120); g.fillStyle = '#fff'; g.font = 'bold 84px Arial, sans-serif'; g.fillText('Pick Up', 260, 60, 480);
      g.fillStyle = '#fff'; g.fillRect(0, 130, 300, 382); g.fillStyle = '#e51636'; g.fillRect(0, 262, 300, 250);
      g.font = 'italic 700 46px Georgia, serif'; g.fillText('Chick-fil-A', 150, 196, 280);
      g.fillStyle = '#fff'; g.font = 'bold 30px Arial, sans-serif'; g.fillText('TEMPORARY', 150, 300, 280); g.fillText('HOURS IN EFFECT', 150, 338, 280); g.fillRect(40, 354, 220, 3);
      g.font = 'bold 44px Arial, sans-serif'; g.fillText('MON – SAT', 150, 406, 280); g.fillText('10 AM – 6 PM', 150, 462, 280);
      g.fillStyle = '#fff'; g.fillRect(320, 130, 280, 200); g.strokeStyle = '#c8102e'; g.lineWidth = 6; g.strokeRect(326, 136, 268, 188);
      g.fillStyle = '#c8102e'; g.font = 'bold 40px Arial, sans-serif'; g.fillText('Modified Hours', 460, 200, 260);
      g.fillStyle = '#333'; g.font = 'bold 30px Arial, sans-serif'; g.fillText('Mon–Sat', 460, 256, 260); g.fillText('10 AM – 6 PM', 460, 294, 260);
      g.fillStyle = '#e51636'; g.font = 'italic 700 70px Georgia, serif'; g.fillText('Chick-fil-A', 812, 65, 390);
    });
    const plaques = cfaTex(1024, 512, g => {   // CFA chicken-head C on dark (0,0); CARES plaque (512,0)
      g.fillStyle = '#2b2b2b'; g.fillRect(0, 0, 512, 512);
      g.strokeStyle = '#f3ead7'; g.fillStyle = '#f3ead7'; g.lineWidth = 58; g.lineCap = 'round';
      g.beginPath(); g.arc(250, 290, 120, 0.8, Math.PI * 2 - 0.8); g.stroke();
      for (const [x, y, r] of [[214, 136, 26], [250, 112, 28], [288, 132, 24]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#f5f1e6'; g.fillRect(512, 0, 512, 256); g.fillStyle = '#c8102e'; g.fillRect(512, 0, 512, 22); g.fillRect(512, 234, 512, 22);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#2b2b2b'; g.font = 'bold 120px Georgia, serif'; g.fillText('CARES', 768, 118, 460);
      g.fillStyle = '#c8102e'; g.font = 'italic 600 40px Georgia, serif'; g.fillText('Chick-fil-A', 768, 196, 440);
    });

    // counter: plinth, taupe shaker cabinet with recessed panel outlines, white quartz top (top at fy + 1.1, 5 cm overhang)
    box(10, 17.2, fy, 12, 0.12, 1.0, col3('#5d574f'));
    box(10, 17.2, fy + 0.12, 12, 0.94, 1.0, col3('#8c8479'));
    for (let k = 0; k < 8; k++) { const u0 = 4.1 + k * 1.5, u1 = u0 + 1.3, uc = (u0 + u1) / 2; box(u0, 16.68, fy + 0.25, 0.03, 0.66, 0.03, pcol); box(u1, 16.68, fy + 0.25, 0.03, 0.66, 0.03, pcol); box(uc, 16.68, fy + 0.25, 1.33, 0.03, 0.03, pcol); box(uc, 16.68, fy + 0.88, 1.33, 0.03, 0.03, pcol); }
    box(10, 17.2, fy + 1.06, 12.1, 0.04, 1.1, col3('#f2f0ea'));
    addCollider([rect(4, 16, 16.7, 17.7)], fy + 1.1);

    // counter top: two stainless coffee urns, straw caddies, lemonade dispenser, Modified-hours card, three POS registers
    for (const u of [5.3, 6.7]) { box(u, 17.15, fy + 1.1, 0.42, 0.75, 0.42, ss); box(u, 17.15, fy + 1.85, 0.44, 0.05, 0.44, blk); box(u, 16.9, fy + 1.2, 0.08, 0.08, 0.06, blk); }
    for (const u of [4.5, 12.1]) { box(u, 16.95, fy + 1.1, 0.2, 0.16, 0.2, ss); for (let k = 0; k < 4; k++) box(u + (k & 1 ? 0.012 : -0.012), 16.95, fy + 1.26 + k * 0.045, 0.17, 0.045, 0.17, k & 1 ? wht : red); }
    box(15, 17.1, fy + 1.1, 1.3, 0.2, 0.55, ss);
    for (const u of [14.7, 15.3]) { box(u, 17.1, fy + 1.3, 0.5, 0.55, 0.45, col3('#f3d24a')); box(u, 17.1, fy + 1.85, 0.52, 0.04, 0.47, blk); }
    plane(0.36, 0.26, new THREE.MeshLambertMaterial({ map: region(atlas, 320, 130, 280, 200) }), 9.55, 17.05, fy + 1.23, faceNV);
    for (const u of [8.2, 10.9, 13.4]) {
      box(u, 17.25, fy + 1.1, 0.4, 0.14, 0.3, blk);
      const [x0, z0] = W(u - 0.17, 17.1), [x1, z1] = W(u + 0.17, 17.1), [x2, z2] = W(u + 0.17, 17.36), [x3, z3] = W(u - 0.17, 17.36);
      gl.quad([x0, fy + 1.24, z0], [x1, fy + 1.24, z1], [x2, fy + 1.52, z2], [x3, fy + 1.52, z3], [0, 0], [1, 0], [1, 1], [0, 1], col3('#4fc9b8'));   // tilted screen, unlit
    }

    // back wall (v 20.6): taupe base, subway tile under the soffit, stainless mosaic band, kitchen pass-through with warmer rack and glow
    box(10, 20.6, fy, 12, 3.8, 0.3, col3('#8c8479'));
    plane(12, 0.65, new THREE.MeshLambertMaterial({ map: rep(subway, 20, 2.17) }), 10, 20.47, fy + 2.425, faceNV);
    plane(12, 1.1, new THREE.MeshLambertMaterial({ map: rep(mosaic, 30, 2.75) }), 10, 20.47, fy + 1.55, faceNV);
    box(10, 20.465, fy + 1.15, 2.8, 0.85, 0.05, col3('#1d1a18'));
    box(10, 20.42, fy + 1.17, 2.5, 0.05, 0.02, col3('#ffb46b'), gl);
    for (const y of [1.5, 1.85]) box(10, 20.36, fy + y, 2.5, 0.04, 0.14, ss);
    for (const u of [8.9, 11.1]) box(u, 20.36, fy + 1.15, 0.05, 0.85, 0.05, ss);

    // red soffit with four backlit menu boards on its front face
    box(10, 20.25, fy + 2.75, 12, 1.05, 0.7, col3('#9e1b22'));
    plane(10.7, 0.8, new THREE.MeshBasicMaterial({ map: menu }), 10, 19.87, fy + 2.85, faceNV);

    // "Pick Up" sign: red box on a rod from the drop ceiling, text on both faces
    box(14.5, 17.2, fy + 3.2, 0.03, 0.6, 0.03, iron);
    box(14.5, 17.2, fy + 2.6, 2.6, 0.6, 0.12, red);
    plane(2.5, 0.58, new THREE.MeshLambertMaterial({ map: region(atlas, 0, 0, 520, 120) }), 14.5, 17.13, fy + 2.9, faceNV);
    plane(2.5, 0.58, new THREE.MeshLambertMaterial({ map: region(atlas, 0, 0, 520, 120) }), 14.5, 17.27, fy + 2.9, faceV);

    // three static staff behind the counter (no colliders), facing the counter
    for (const u of [7, 10.5, 13]) {
      const v = 19.6;
      box(u - 0.11, v, fy, 0.2, 0.8, 0.22, pants); box(u + 0.11, v, fy, 0.2, 0.8, 0.22, pants);
      box(u, v, fy + 0.8, 0.5, 0.7, 0.3, polo);
      box(u - 0.35, v, fy + 0.9, 0.14, 0.6, 0.14, polo); box(u + 0.35, v, fy + 0.9, 0.14, 0.6, 0.14, polo);
      box(u, v, fy + 1.5, 0.26, 0.26, 0.26, skin);
      box(u, v, fy + 1.73, 0.28, 0.06, 0.28, hair); box(u, v - 0.15, fy + 1.66, 0.26, 0.05, 0.1, hair);
    }

    // queue rails: two stanchion runs alongside the queue lane (u 10, slots v 12.6..15.9), 1 m posts, oak handrails, thin colliders
    for (const u of [9.1, 10.9]) {
      for (const v of [12, 13, 14, 15, 15.4]) box(u, v, fy, 0.05, 1.0, 0.05, iron);
      box(u, 13.7, fy + 0.45, 0.04, 0.04, 3.4, iron);
      box(u, 13.7, fy + 0.98, 0.09, 0.06, 3.4, col3('#b07a45'));
      addCollider([rect(u - 0.06, u + 0.06, 12, 15.4)], fy + 1.05);
    }

    // solid bits by the open ends: trash bin at the east end, napkin and utensil station at the west end
    box(17.1, 16.1, fy, 0.6, 1.0, 0.6, col3('#8d9296'));
    box(17.1, 16.1, fy + 1.0, 0.64, 0.05, 0.64, col3('#3a3d40'));
    addCollider([rect(16.8, 17.4, 15.8, 16.4)], fy + 1.05);
    box(3, 14, fy, 0.6, 0.55, 0.45, blk); box(3, 14, fy + 0.55, 0.55, 0.3, 0.4, blk);
    box(2.8, 14, fy + 0.85, 0.22, 0.2, 0.3, wht); box(3.2, 14, fy + 0.85, 0.22, 0.14, 0.3, col3('#e8e8e8'));
    addCollider([rect(2.7, 3.3, 13.7, 14.3)], fy + 1.0);

    // entrance (door at u 12, v 0): subway tile either side of the door, glowing script sign, temporary-hours sign on a black stand
    plane(4.4, 3, new THREE.MeshLambertMaterial({ map: rep(subway, 4.4 / 0.6, 10) }), 8.4, 0.34, fy + 1.5, faceV);
    plane(6.4, 3, new THREE.MeshLambertMaterial({ map: rep(subway, 6.4 / 0.6, 10) }), 16.6, 0.34, fy + 1.5, faceV);
    plane(2, 0.65, new THREE.MeshBasicMaterial({ map: region(atlas, 610, 0, 404, 130), transparent: true }), 16, 0.42, fy + 2.5, faceV);
    box(15.2, 1.26, fy, 0.9, 0.03, 0.5, blk); box(15.2, 1.26, fy + 0.03, 0.05, 0.77, 0.05, blk);
    box(15.2, 1.26, fy + 0.8, 0.86, 1.06, 0.04, blk);
    plane(0.8, 1.02, new THREE.MeshLambertMaterial({ map: region(atlas, 0, 130, 300, 382) }), 15.2, 1.22, fy + 1.31, faceNV);

    // feature wall on the west end wall (u 0), v 9..17: reclaimed-wood planks, CFA logo plaque, framed CARES plaque, black award
    const wood4 = [col3('#8a6440'), col3('#a27a4f'), col3('#6e4f33'), col3('#b88a5a')];
    for (let i = 0; i < 33; i++) box(0.36, 9.12 + i * 0.24, fy, 0.14, 3.2, 0.235, wood4[(i * 3 + (i >> 2)) % 4]);
    plane(1.1, 1.1, new THREE.MeshLambertMaterial({ map: region(plaques, 0, 0, 512, 512) }), 0.47, 13, fy + 2.1, faceU);
    box(0.44, 10.2, fy + 1.3, 0.06, 0.5, 0.86, col3('#3d2a1b'));
    plane(0.8, 0.4, new THREE.MeshLambertMaterial({ map: region(plaques, 512, 0, 512, 256) }), 0.48, 10.2, fy + 1.55, faceU);
    box(0.44, 15.8, fy + 1.9, 0.06, 0.6, 0.46, col3('#111111'));
    box(0.48, 15.8, fy + 2.0, 0.02, 0.4, 0.3, col3('#e9e2cf'));

    // ceiling: eight glowing panels just under the drop ceiling, four small downlights; one extra light over the staff zone
    for (const u of [4, 8.5, 13, 17.5]) for (const v of [5.5, 11.5]) box(u, v, fy + 3.77, 2.0, 0.02, 1.2, col3('#fffdf5'), gl);
    for (const [u, v] of [[2.2, 8.5], [19, 8.5], [6.5, 2], [13.5, 2]]) box(u, v, fy + 3.77, 0.22, 0.02, 0.22, col3('#fffdf5'), gl);
    const gm = gl.mesh(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })); gm.castShadow = gm.receiveShadow = false; scene.add(gm);
    { const [x, z] = W(10, 19); const l = new THREE.PointLight(0xfff1dc, 3, 20, 1); l.position.set(x, fy + 3.1, z); scene.add(l); interiorLights.push(l); }
  }
  for (let u = 29; u < L - 3; u += 3.4) for (let v = 3.5; v < 19; v += 3.6) {
    if (Math.abs(v - 11) < 2.4 && u < s1 + 1.5) continue;
    box(u, v, fy, 0.12, 0.74, 0.12, iron); box(u, v, fy + 0.74, 1.0, 0.05, 1.0, col3('#3a2a1e'));
    for (const [du, dv] of [[0.8, 0], [-0.8, 0], [0, 0.8], [0, -0.8]]) { box(u + du, v + dv, fy, 0.45, 0.45, 0.45, col3('#4b5a6a')); box(u + du * 1.25, v + dv * 1.25, fy + 0.45, du ? 0.06 : 0.45, 0.5, dv ? 0.06 : 0.45, col3('#4b5a6a')); }
    addTrunk(...W(u, v), 0.6);
  }
  for (const v of [3, 7, 15, 19]) { box(22.5, v, fy, 2.0, 0.45, 0.9, col3('#5b3f6b')); box(22.5, v + 0.4, fy + 0.45, 2.0, 0.45, 0.15, col3('#5b3f6b')); }
  B.lantern = B.lantern || new Buf();
  for (let u = 29; u < L - 2; u += 7.2) for (const v of [6, 16]) { box(u, v, fy + 6.2, 0.03, b.t - fy - 6.2, 0.03, iron); box(u, v, fy + 5.2, 0.7, 1.0, 0.7, col3('#ffe7b0'), B.lantern); }
  for (const [u, v, y] of [[35, 11, 7], [10, 11, 3.2]]) { const [x, z] = W(u, v); const l = new THREE.PointLight(0xffe6c0, 6, 30, 1); l.position.set(x, fy + y, z); scene.add(l); interiorLights.push(l); }
}
function addBrandSigns() {
  for (const b of signs) {
    const [text, bg, fg, accent] = BRAND[b.n];
    let best = -1, a, c;
    for (let i = 0; i < b.p.length; i++) {
      const p = b.p[i], q = b.p[(i + 1) % b.p.length], l = Math.hypot(q[0] - p[0], q[1] - p[1]), mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2;
      const road = D.lines.some(r => ['primary', 'secondary', 'residential', 'unclassified'].includes(r.k) && r.p.some(pt => Math.hypot(pt[0] - mx, pt[1] - mz) < 35));
      const sc = l * (road ? 3 : 1); if (sc > best) { best = sc; a = p; c = q; }
    }
    const len = Math.hypot(c[0] - a[0], c[1] - a[1]), dx = (c[0] - a[0]) / len, dz = (c[1] - a[1]) / len, nx = dz, nz = -dx, rot = Math.atan2(dz, dx);
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96; const g = cv.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, 512, 96); g.fillStyle = accent; g.fillRect(0, 86, 512, 10);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `800 ${text.length > 14 ? 36 : 54}px "Barlow Semi Condensed", Arial, sans-serif`; g.fillText(text, 256, 44);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    const w = Math.min(len * 0.8, 11), mat = new THREE.MeshLambertMaterial({ map: t, emissive: 0x222222 });
    const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2, y = Math.min(b.t - 0.9, b.b + 4.6);
    for (const s of [1, -1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 96 / 512), mat); m.position.set(mx + nx * 0.12 * s, y, mz + nz * 0.12 * s); m.rotation.y = -rot + (s < 0 ? Math.PI : 0); scene.add(m); }
    const bb = new Buf(); for (const s of [1, -1]) bb.box(mx + nx * 0.55 * s, b.b + 3.2, mz + nz * 0.55 * s, len * 0.98, 0.45, 1.1, rot, col3(accent));
    scene.add(bb.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })));
  }
}

