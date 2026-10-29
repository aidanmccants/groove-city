/* ---------------- maps ---------------- */
let mapCanvas, mapScale;
function buildMapCanvas(ground) {
  mapCanvas = document.createElement('canvas'); mapCanvas.width = 2048; mapCanvas.height = Math.round(2048 * H / W); mapScale = 2048 / W;
  const g = mapCanvas.getContext('2d'); g.drawImage(ground, 0, 0, mapCanvas.width, mapCanvas.height);
  for (const b of D.buildings) { g.beginPath(); b.p.forEach((q, i) => { const X = (q[0] + W / 2) * mapScale, Z = (q[1] + H / 2) * mapScale; i ? g.lineTo(X, Z) : g.moveTo(X, Z); }); g.closePath(); g.fillStyle = b.n ? '#8c3a2c' : '#a0968a'; g.fill(); g.strokeStyle = '#2a201b'; g.lineWidth = 1; g.stroke(); }
  // a few trees as dots
  g.fillStyle = 'rgba(40,80,30,.55)'; for (const t of D.trees) { g.beginPath(); g.arc((t[0] + W / 2) * mapScale, (t[1] + H / 2) * mapScale, 2, 0, 7); g.fill(); }
}
function drawBigMap() {
  const bm = $('bigmap'); bm.width = mapCanvas.width; bm.height = mapCanvas.height; const g = bm.getContext('2d');
  const fx = $('bigmapfx'); fx.width = bm.width; fx.height = bm.height;
  g.drawImage(mapCanvas, 0, 0);
  g.font = '600 15px "Barlow Semi Condensed", sans-serif'; g.textAlign = 'center';
  for (const l of labels) { const X = (l.x + W / 2) * mapScale, Z = (l.z + H / 2) * mapScale; g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(l.name, X, Z); g.fillStyle = '#fff'; g.fillText(l.name, X, Z); }
  const X = (P.x + W / 2) * mapScale, Z = (P.z + H / 2) * mapScale;
  g.save(); g.translate(X, Z); g.rotate(-yaw); g.fillStyle = '#e0566b'; g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -16); g.lineTo(11, 12); g.lineTo(0, 6); g.lineTo(-11, 12); g.closePath(); g.stroke(); g.fill(); g.restore();
}
// the officers chasing the local player, as world positions (on foot, or in their car)
function chasingCops() { return Cops.list.filter(c => c.state === 'chase' && c.data.target === P).map(c => c.officer.onFoot ? c.officer : c.car); }
const chaserCol = () => Math.floor(performance.now() / 250) % 2 ? '#2a5bff' : '#ff2020';   // police lights: red / blue
function chaserDot(g, x, y, r, col) {   // a dot with a white outline and a faint glow ring of its colour
  g.strokeStyle = col; g.globalAlpha = .4; g.lineWidth = r * .5; g.beginPath(); g.arc(x, y, r * 1.6, 0, 7); g.stroke(); g.globalAlpha = 1;
  g.fillStyle = col; g.strokeStyle = '#fff'; g.lineWidth = r * .3; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.stroke();
}
function drawMini() {
  const mc = $('minic'), g = mc.getContext('2d'), S = mc.width, view = 220, view2 = view * 1.42;   // metres across; the source is 1.42x bigger so a rotated square never shows corners
  const k = mapScale, sx = (P.x + W / 2) * k - view2 * k / 2, sz = (P.z + H / 2) * k - view2 * k / 2;
  g.save(); g.beginPath(); g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); g.clip();   // round minimap
  g.fillStyle = '#3b4a33'; g.fillRect(0, 0, S, S);
  g.save(); g.translate(S / 2, S / 2); g.rotate(yaw); g.translate(-S / 2, -S / 2);
  g.drawImage(mapCanvas, sx, sz, view2 * k, view2 * k, -S * .21, -S * .21, S * 1.42, S * 1.42); g.restore();
  g.fillStyle = '#e0566b'; g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.moveTo(S / 2, S / 2 - 16); g.lineTo(S / 2 + 11, S / 2 + 12); g.lineTo(S / 2, S / 2 + 6); g.lineTo(S / 2 - 11, S / 2 + 12); g.closePath(); g.stroke(); g.fill();
  // chasing officers; any beyond the rim are pinned to it
  for (const p of chasingCops()) {
    const dx = p.x - P.x, dz = p.z - P.z; let x = S / 2 + (dx * Math.cos(yaw) - dz * Math.sin(yaw)) * S / view, y = S / 2 + (dx * Math.sin(yaw) + dz * Math.cos(yaw)) * S / view;
    const d = Math.hypot(x - S / 2, y - S / 2), R = S / 2 - 10;
    if (d > R) { x = S / 2 + (x - S / 2) * R / d; y = S / 2 + (y - S / 2) * R / d; }
    chaserDot(g, x, y, 7, chaserCol());
  }
  g.restore();
  // north marker
  const nr = S / 2 - 18, na = yaw - Math.PI / 2, nx = S / 2 + Math.cos(na) * nr, ny = S / 2 + Math.sin(na) * nr;
  g.font = '700 22px Silkscreen, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 4; g.strokeText('N', nx, ny); g.fillText('N', nx, ny);
}

// the chasers on the big map, blinking, with the player as a white dot; drawn each frame while it is open
function drawBigFx() {
  const fx = $('bigmapfx'), g = fx.getContext('2d'), w = fx.width, h = fx.height, cops = chasingCops();
  g.clearRect(0, 0, w, h); if (!Bank.wanted && !cops.length) return;
  const at = p => [(p.x + W / 2) / W * w, (p.z + H / 2) / H * h], r = w / 160, col = chaserCol();
  const [px, pz] = at(P); g.fillStyle = '#fff'; g.beginPath(); g.arc(px, pz, r * .6, 0, 7); g.fill();
  for (const p of cops) { const [x, y] = at(p); chaserDot(g, x, y, r, col); }
}

