/* ---------------- ground painting ---------------- */
const CW = 4096, CH = Math.round(4096 * H / W), SS = CW / W;
const gx = x => (x + W / 2) * SS, gz = z => (z + H / 2) * SS;
function trace(g, p, close = true) { g.beginPath(); p.forEach((q, i) => i ? g.lineTo(gx(q[0]), gz(q[1])) : g.moveTo(gx(q[0]), gz(q[1]))); if (close) g.closePath(); }
function minRect(p) {   // minimum-area oriented rectangle
  let best = null;
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length], th = Math.atan2(b[1] - a[1], b[0] - a[0]), c = Math.cos(th), s = Math.sin(th);
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const q of p) { const u = q[0] * c + q[1] * s, v = -q[0] * s + q[1] * c; x0 = Math.min(x0, u); x1 = Math.max(x1, u); z0 = Math.min(z0, v); z1 = Math.max(z1, v); }
    const A = (x1 - x0) * (z1 - z0);
    if (!best || A < best.A) { const cu = (x0 + x1) / 2, cv = (z0 + z1) / 2; best = { A, th, lu: x1 - x0, lv: z1 - z0, cx: cu * c - cv * s, cz: cu * s + cv * c }; }
  }
  if (best.lu < best.lv) { best = { ...best, th: best.th + Math.PI / 2, lu: best.lv, lv: best.lu }; }
  return best;   // lu = long side along angle th
}
function paintGround() {
  const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH; const g = cv.getContext('2d');
  g.fillStyle = '#6c9a4a'; g.fillRect(0, 0, CW, CH);
  g.lineJoin = g.lineCap = 'round';
  if (D.campus) { trace(g, D.campus); g.fillStyle = '#6aa548'; g.fill(); }
  const order = ['retail', 'grass', 'park', 'playground', 'wood', 'parking', 'track', 'pitch', 'bleachers', 'water'];
  const A = [...D.areas].sort((a, b) => order.indexOf(a.k.split(':')[0]) - order.indexOf(b.k.split(':')[0]));
  for (const a of A) {
    const k = a.k.split(':'); trace(g, a.p);
    if (k[0] === 'retail') { g.fillStyle = '#8d9a7a'; g.fill(); }
    else if (k[0] === 'grass' || k[0] === 'park') { g.fillStyle = '#6fa94c'; g.fill(); }
    else if (k[0] === 'playground') { g.fillStyle = '#b79b74'; g.fill(); }
    else if (k[0] === 'wood') { g.fillStyle = '#4c7a36'; g.fill(); }
    else if (k[0] === 'parking') { g.fillStyle = '#56585b'; g.fill(); g.strokeStyle = '#8d8f90'; g.lineWidth = 1.2; g.stroke(); }
    else if (k[0] === 'water') { g.fillStyle = '#3c6a86'; g.fill(); g.strokeStyle = '#5c8a6a'; g.lineWidth = 3; g.stroke(); }
    else if (k[0] === 'bleachers') { g.fillStyle = '#9a9a9a'; g.fill(); }
    else if (k[0] === 'track') paintTrack(g, a);
    else if (k[0] === 'pitch') paintPitch(g, a, k[1], k[2]);
  }
  // mulch beds around campus buildings
  for (const b of D.buildings) if (b.n && (b.k === 'brick' || b.k === 'stone')) { trace(g, b.p); g.strokeStyle = '#4a3527'; g.lineWidth = 3.4 * SS; g.stroke(); }
  // lines
  const L = [...D.lines].filter(l => !l.tu);
  const rank = { stream: 0, fence: 9, wall: 9, rail: 1, path: 2, footway: 3, steps: 3, pedestrian: 3, cycleway: 3, track: 2, service: 4, unclassified: 5, residential: 5, tertiary: 6, secondary: 7, primary: 8 };
  L.sort((a, b) => (rank[a.k] ?? 4) - (rank[b.k] ?? 4));
  // downtown Broad and Main: brick-paver sidewalks running up to the shopfronts
  for (const l of L) if (/Broad Street|Main Street/.test(l.n || '') && l.p.some(q => q[0] < -480)) {
    trace(g, l.p, false); g.strokeStyle = '#a0614c'; g.lineWidth = (l.w + 11) * SS; g.stroke();
    g.strokeStyle = '#b9b3a6'; g.lineWidth = (l.w + 1.2) * SS; g.stroke();   // curb
  }
  Rail.paint(g);
  for (const l of L) {
    if (l.k === 'fence' || l.k === 'wall') { trace(g, l.p, false); g.strokeStyle = '#3a3a36'; g.lineWidth = 1; g.stroke(); continue; }
    if (l.k === 'stream') { trace(g, l.p, false); g.strokeStyle = '#3c6a86'; g.lineWidth = 5 * SS; g.stroke(); continue; }
    if (l.k === 'rail') continue;   // Rail.paint laid the gravel; the track itself is 3D
    const foot = ['footway', 'path', 'steps', 'pedestrian', 'cycleway'].includes(l.k);
    let c = foot ? (l.k === 'path' ? '#a8977a' : '#d3cbbb') : (l.k === 'service' ? '#6c6d70' : '#5f6063');
    if (l.s === 'gravel') c = '#9b9282'; if (l.s === 'concrete' && !foot) c = '#8e8d88'; if (l.s === 'cobblestone') c = '#8b7a6b';
    if (l.br) continue;   // bridges are 3D
    trace(g, l.p, false); g.strokeStyle = c; g.lineWidth = l.w * SS; g.stroke();
    if (!foot && (l.k === 'primary' || l.k === 'secondary' || l.k === 'tertiary')) {
      // white edge lines and a solid double-yellow centre, as on East Main and Madison
      g.strokeStyle = '#e9e9e4'; g.lineWidth = (l.w - 0.8) * SS; g.stroke();
      g.strokeStyle = c; g.lineWidth = (l.w - 1.1) * SS; g.stroke();
      g.strokeStyle = '#e3bd3a'; g.lineWidth = 0.6 * SS; g.stroke();
      g.strokeStyle = c; g.lineWidth = 0.2 * SS; g.stroke();
    }
    if (l.k === 'steps') { g.strokeStyle = '#a49c8c'; g.setLineDash([0.3 * SS, 0.3 * SS]); g.lineWidth = l.w * SS * 0.9; g.stroke(); g.setLineDash([]); }
  }
  Traffic.paint(g);
  // curbs / plinths under buildings
  for (const b of D.buildings) { trace(g, b.p); g.fillStyle = '#8b8780'; g.fill(); g.strokeStyle = '#b8b2a6'; g.lineWidth = 1.2 * SS; g.stroke(); }
  // pixel noise pass: per 40 cm cell
  const img = g.getImageData(0, 0, CW, CH), d = img.data;
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
    const i = (y * CW + x) * 4, k = (hash(x * 0.917 + y * 13.13) - .5) * 20;
    d[i] += k; d[i + 1] += k * 1.1; d[i + 2] += k * .8;
  }
  g.putImageData(img, 0, 0);
  return cv;
}
function paintTrack(g, a) {
  trace(g, a.p); g.fillStyle = '#3a3a3e'; g.fill();
  const q = minRect(a.p);
  if (q.lu < 60) return;   // short bits of track are just surface
  const sg = area(a.p) > 0 ? 1 : -1;
  g.save(); trace(g, a.p); g.clip();
  g.strokeStyle = 'rgba(245,245,240,.95)'; g.lineWidth = 0.14 * SS;
  for (let k = 1; k <= 8; k++) { trace(g, insetRings([a.p], sg * k * 1.22)[0]); g.stroke(); }
  trace(g, insetRings([a.p], sg * 9.9)[0]); g.fillStyle = '#2f6e33'; g.fill();
  g.restore();
  g.strokeStyle = '#c9c9c4'; g.lineWidth = 0.35 * SS; trace(g, a.p); g.stroke();
}
// Thorn Field: dark-green turf, red end zones with lettering, yard lines every 5 yd, red G at midfield
function paintFootball(g, a, r) {
  const ez = 9.14, pw = 48.8;
  g.save(); trace(g, a.p); g.clip();
  g.translate(gx(r.cx), gz(r.cz)); g.rotate(r.th); g.scale(SS, SS);
  g.fillStyle = '#2f6e33'; g.fillRect(-r.lu / 2 - 2, -r.lv / 2 - 2, r.lu + 4, r.lv + 4);
  for (let u = -r.lu / 2; u < r.lu / 2; u += 6) { g.fillStyle = Math.floor((u + r.lu / 2) / 6) % 2 ? '#357a38' : '#2a6530'; g.fillRect(u, -r.lv / 2, 6, r.lv); }
  g.fillStyle = '#9e1b25';
  g.fillRect(-r.lu / 2, -pw / 2, ez, pw); g.fillRect(r.lu / 2 - ez, -pw / 2, ez, pw);
  g.fillStyle = '#f4f4ef';
  for (let u = -r.lu / 2 + ez; u <= r.lu / 2 - ez + 0.01; u += 4.572) g.fillRect(u - 0.12, -pw / 2, 0.24, pw);
  g.fillRect(-r.lu / 2 + ez, -pw / 2 - 0.12, r.lu - 2 * ez, 0.24); g.fillRect(-r.lu / 2 + ez, pw / 2 - 0.12, r.lu - 2 * ez, 0.24);
  g.font = '800 3.2px "Barlow Semi Condensed", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  [[-1, 'GROOVE CITY'], [1, 'WOLVERINES']].forEach(([sg, label]) => {
    g.save(); g.translate(sg * (r.lu / 2 - ez / 2), 0); g.rotate(sg > 0 ? -Math.PI / 2 : Math.PI / 2); g.fillText(label, 0, 0); g.restore();
  });
  g.font = '900 9px "Barlow Semi Condensed", Arial, sans-serif'; g.fillStyle = '#b3202a'; g.strokeStyle = '#f4f4ef'; g.lineWidth = 0.5;
  g.strokeText('G', 0, 0); g.fillText('G', 0, 0);
  g.strokeStyle = '#9e1b25'; g.lineWidth = 0.8; g.strokeRect(-r.lu / 2 + 0.4, -r.lv / 2 + 0.4, r.lu - 0.8, r.lv - 0.8);
  g.restore();
}
function paintPitch(g, a, sport, surface) {
  if (sport === 'american_football') { const q = minRect(a.p); if (Math.hypot(q.cx + 370, q.cz + 180) < 120) { paintFootball(g, a, q); return; } }
  const r = minRect(a.p); const c = Math.cos(r.th), s = Math.sin(r.th);
  g.save(); trace(g, a.p); g.clip();
  const greenA = '#5f9f42', greenB = '#69ac4a';
  if (sport === 'tennis' || sport === 'basketball' || sport === 'four_square') {
    g.fillStyle = sport === 'tennis' ? '#3b6f53' : '#77787a'; g.fill();
    if (sport === 'tennis') { drawRect(g, r, r.lu - 4, r.lv - 3, '#3f6a9a', true); drawRect(g, r, r.lu - 4, r.lv - 3, '#ffffff', false); }
  } else if (sport === 'beachvolleyball' || surface === 'sand') { g.fillStyle = '#d9c48f'; g.fill(); }
  else if (sport === 'baseball' || sport === 'softball') { g.fillStyle = greenB; g.fill(); paintDiamond(g, a.p); }
  else {
    // mowing stripes along the long axis
    for (let i = -Math.ceil(r.lu / 8); i <= Math.ceil(r.lu / 8); i++) {
      g.beginPath(); const u0 = i * 8, pts = [[u0, -r.lv], [u0 + 4, -r.lv], [u0 + 4, r.lv], [u0, r.lv]];
      pts.forEach(([u, v], k) => { const X = r.cx + u * c - v * s, Z = r.cz + u * s + v * c; k ? g.lineTo(gx(X), gz(Z)) : g.moveTo(gx(X), gz(Z)); });
      g.fillStyle = i % 2 ? greenA : greenB; g.fill();
    }
    if (a.c && sport === 'american_football') { /* keep grass */ }
    if (r.lu > 40) {
      drawRect(g, r, r.lu - 3, r.lv - 3, '#f4f4ef', false);
      g.beginPath(); const P = (u, v) => [gx(r.cx + u * c - v * s), gz(r.cz + u * s + v * c)];
      g.moveTo(...P(0, -(r.lv - 3) / 2)); g.lineTo(...P(0, (r.lv - 3) / 2)); g.strokeStyle = '#f4f4ef'; g.lineWidth = 0.5 * SS; g.stroke();
      if (sport === 'american_football') for (let u = -(r.lu - 3) / 2 + 10; u < (r.lu - 3) / 2 - 5; u += 9.14) { g.beginPath(); g.moveTo(...P(u, -(r.lv - 3) / 2)); g.lineTo(...P(u, (r.lv - 3) / 2)); g.stroke(); }
      else { g.beginPath(); g.arc(...P(0, 0), 9.15 * SS, 0, Math.PI * 2); g.stroke(); }
    }
  }
  g.restore();
}
function drawRect(g, r, lu, lv, color, fill) {
  const c = Math.cos(r.th), s = Math.sin(r.th); g.beginPath();
  [[-lu / 2, -lv / 2], [lu / 2, -lv / 2], [lu / 2, lv / 2], [-lu / 2, lv / 2]].forEach(([u, v], k) => { const X = gx(r.cx + u * c - v * s), Z = gz(r.cz + u * s + v * c); k ? g.lineTo(X, Z) : g.moveTo(X, Z); });
  g.closePath(); if (fill) { g.fillStyle = color; g.fill(); } else { g.strokeStyle = color; g.lineWidth = 0.5 * SS; g.stroke(); }
}
function paintDiamond(g, p) {
  // home plate = vertex whose corner is closest to 90 degrees with two long legs
  let best = null;
  for (let i = 0; i < p.length; i++) {
    const a = p[(i - 1 + p.length) % p.length], b = p[i], c = p[(i + 1) % p.length];
    const u = [a[0] - b[0], a[1] - b[1]], v = [c[0] - b[0], c[1] - b[1]], lu = Math.hypot(...u), lv = Math.hypot(...v);
    if (lu < 25 || lv < 25) continue;
    const ang = Math.acos((u[0] * v[0] + u[1] * v[1]) / lu / lv), sc = Math.abs(ang - Math.PI / 2);
    if (!best || sc < best.sc) best = { sc, b, dir: Math.atan2(u[1] / lu + v[1] / lv, u[0] / lu + v[0] / lv) };
  }
  if (!best) return;
  const [hx, hz] = best.b, d = best.dir, P = (r, a) => [gx(hx + Math.cos(d + a) * r), gz(hz + Math.sin(d + a) * r)];
  g.fillStyle = '#b98c5c'; g.beginPath(); g.moveTo(gx(hx), gz(hz)); g.arc(gx(hx), gz(hz), 36 * SS, d - Math.PI / 4, d + Math.PI / 4); g.closePath(); g.fill();
  g.fillStyle = '#69ac4a'; g.beginPath(); g.moveTo(...P(3, 0)); g.lineTo(...P(24, -Math.PI / 4 + 0.07)); g.lineTo(...P(34.5, 0)); g.lineTo(...P(24, Math.PI / 4 - 0.07)); g.closePath(); g.fill();
  g.fillStyle = '#b98c5c'; g.beginPath(); g.arc(...P(18.4, 0), 2.8 * SS, 0, 7); g.fill(); g.beginPath(); g.arc(gx(hx), gz(hz), 4 * SS, 0, 7); g.fill();
  g.strokeStyle = '#ffffff'; g.lineWidth = 0.3 * SS; g.beginPath(); g.moveTo(...P(90, -Math.PI / 4)); g.lineTo(gx(hx), gz(hz)); g.lineTo(...P(90, Math.PI / 4)); g.stroke();
}

