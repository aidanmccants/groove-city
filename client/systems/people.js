/* ---------------- people: spawn anywhere, walk the path network to Breen or Hicks (or into Breen to queue at Chick-fil-A) ---------------- */
const people = []; let speechOK = false;
const LINES = { breen: 'mmmm chick fil a', hicks: "mmm i love deb's sandwiches", cfa: 'mmmm chick fil a' };
function bubbleTexture(text) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96; const g = cv.getContext('2d');
  g.fillStyle = 'rgba(255,255,255,.95)'; g.fillRect(0, 0, 512, 80); g.beginPath(); g.moveTo(240, 80); g.lineTo(256, 96); g.lineTo(272, 80); g.fill();
  g.fillStyle = '#1b1b1b'; g.font = '600 38px "Barlow Semi Condensed", "Segoe UI Emoji", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 40);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function buildPeople() {
  const key = q => Math.round(q[0]) + ',' + Math.round(q[1]), nodes = new Map(), adj = new Map();
  const add = q => { const k = key(q); if (!nodes.has(k)) { nodes.set(k, [Math.round(q[0]), Math.round(q[1])]); adj.set(k, []); } return k; };
  for (const l of D.lines) {
    if (!['footway', 'path', 'pedestrian', 'service', 'residential', 'unclassified', 'tertiary', 'secondary', 'primary', 'steps'].includes(l.k)) continue;
    for (let i = 0; i < l.p.length - 1; i++) {
      const a = l.p[i], b = l.p[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / 6));
      let prev = add(a);
      for (let j = 1; j <= n; j++) { const k = add([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n]); if (k !== prev) { adj.get(prev).push(k); adj.get(k).push(prev); } prev = k; }
    }
  }
  // stitch nearby loose ends (paths that stop a metre short of each other)
  const grid = new Map(); for (const [k, q] of nodes) { const g = Math.floor(q[0] / 4) + ',' + Math.floor(q[1] / 4); if (!grid.has(g)) grid.set(g, []); grid.get(g).push(k); }
  for (const [k, q] of nodes) if (adj.get(k).length <= 1) {
    const gx = Math.floor(q[0] / 4), gz = Math.floor(q[1] / 4);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const k2 of grid.get((gx + i) + ',' + (gz + j)) || []) { const q2 = nodes.get(k2); if (k2 !== k && Math.hypot(q2[0] - q[0], q2[1] - q[1]) < 4 && !adj.get(k).includes(k2)) { adj.get(k).push(k2); adj.get(k2).push(k); } }
  }
  const nearest = (x, z) => { let b = null, bd = 1e9; for (const [k, q] of nodes) { const d = Math.hypot(q[0] - x, q[1] - z); if (d < bd) { bd = d; b = k; } } return b; };
  const centre = name => { const b = D.buildings.find(o => o.n === name); let x = 0, z = 0; b.p.forEach(q => { x += q[0]; z += q[1]; }); return [x / b.p.length, z / b.p.length]; };
  const nextHop = goal => {   // BFS-by-distance (Dijkstra) from the goal; next[k] points one step closer
    const dist = new Map([[goal, 0]]), next = new Map(), open = [[0, goal]];
    while (open.length) {
      open.sort((a, b) => b[0] - a[0]); const [d, k] = open.pop(); if (d > dist.get(k)) continue;
      const q = nodes.get(k);
      for (const k2 of adj.get(k)) { const q2 = nodes.get(k2), nd = d + Math.hypot(q2[0] - q[0], q2[1] - q[1]); if (nd < (dist.get(k2) ?? 1e18)) { dist.set(k2, nd); next.set(k2, k); open.push([nd, k2]); } }
    }
    return { next, goal, dist };
  };
  const T = { breen: nextHop(nearest(...centre('Breen Student Union'))), hicks: nextHop(nearest(...centre('Hicks Dining Hall'))) };
  T.cfa = CFA.door ? nextHop(nearest(...CFA.door)) : T.breen;   // the path node outside Breen's servery door
  const starts = { breen: [...T.breen.next.keys()], hicks: [...T.hicks.next.keys()], cfa: [...T.cfa.next.keys()] };
  CFA.nearStarts = starts.cfa.filter(k => { const d = T.cfa.dist.get(k); return d > 25 && d < 70; });   // where a customer can appear unseen
  const shirts = ['#8c1d2f', '#24406e', '#3b6b3b', '#d9a43b', '#5b3f6b', '#e8e8e8', '#202225', '#c45a2a', '#4a7d9a'], skins = ['#f1c9a5', '#d9a87e', '#a8754f', '#7a4f33', '#e8b896'];
  const mk = (sx, sy, sz, c, y) => { const m = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: c })); m.scale.set(sx, sy, sz); m.position.y = y; m.castShadow = true; return m; };
  const bubbleTex = {}; for (const t in LINES) bubbleTex[t] = bubbleTexture(LINES[t]);
  // t: where they are headed; some of the Breen crowd is really after a sandwich (more while someone is on shift)
  function spawn(pp, t, k) {
    pp.t = t || (Math.random() < 0.5 ? 'hicks' : Math.random() < (CFA.onShift ? 0.6 : 0.3) ? 'cfa' : 'breen'); const list = starts[pp.t];
    pp.k = k || list[Math.floor(Math.random() * list.length)]; const q = nodes.get(pp.k); pp.x = q[0]; pp.z = q[1]; pp.spoke = -99;
    pp.cfa = null; pp.bag.visible = false;
    pp.bubble.material.map = bubbleTex[pp.t]; pp.bubble.material.needsUpdate = true;
  }
  for (let i = 0; i < 70; i++) {
    const g = new THREE.Group(), shirt = shirts[i % shirts.length], skin = skins[i % skins.length], pants = i % 3 ? '#2b3a55' : '#3a3a3a';
    const legL = mk(.2, .85, .22, pants, 0), legR = mk(.2, .85, .22, pants, 0), armL = mk(.14, .7, .16, shirt, 0), armR = mk(.14, .7, .16, shirt, 0);
    legL.geometry = legR.geometry = armL.geometry = armR.geometry = (() => { const gg = new THREE.BoxGeometry(1, 1, 1); gg.translate(0, -.5, 0); return gg; })();
    legL.position.set(-.12, .85, 0); legR.position.set(.12, .85, 0); armL.position.set(-.33, 1.5, 0); armR.position.set(.33, 1.5, 0);
    g.add(legL, legR, armL, armR, mk(.5, .68, .28, shirt, .85), mk(.32, .32, .32, skin, 1.55), mk(.34, .1, .34, i % 4 ? '#3a2a1e' : '#d9b56b', 1.85));
    const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, fog: false })); bubble.scale.set(3.4, .64, 1); bubble.position.y = 2.5; bubble.visible = false; g.add(bubble);
    scene.add(g);
    const bag = makeSandwich(); bag.position.set(.36, .7, .2); bag.visible = false; g.add(bag);   // the sandwich in hand, once served
    const pp = { g, legL, legR, armL, armR, bubble, bag, sp: 1.2 + Math.random() * .5, ph: Math.random() * 6 }; spawn(pp);
    // spread them along their routes so the campus isn't empty at the start
    for (let s = Math.floor(Math.random() * 40); s > 0 && T[pp.t].next.get(pp.k); s--) pp.k = T[pp.t].next.get(pp.k);
    const q = nodes.get(pp.k); pp.x = q[0]; pp.z = q[1];
    people.push(pp);
  }
  updatePeople.ctx = { nodes, T, spawn };
}
function updatePeople(dt, now) {
  const C = updatePeople.ctx; if (!C) return;
  for (const pp of people) {
    if (pp.knock) { updateKnock(pp, dt); continue; }
    if (pp.cfa) { updateCustomer(pp, dt, now); continue; }
    const nk = C.T[pp.t].next.get(pp.k);
    if (!nk) { if (!(pp.t === 'cfa' && CFA.join(pp))) spawn_(pp); continue; }   // arrived (or stranded): respawn somewhere new
    const q = C.nodes.get(nk), dx = q[0] - pp.x, dz = q[1] - pp.z, d = Math.hypot(dx, dz);
    const step = Rail.crossingBlocked(q[0], q[1]) && !Rail.crossingBlocked(pp.x, pp.z) ? 0 : pp.sp * dt;   // hold short of a closed crossing
    if (d <= step) { pp.x = q[0]; pp.z = q[1]; pp.k = nk; } else { pp.x += dx / d * step; pp.z += dz / d * step; pp.g.rotation.y = Math.atan2(dx, dz); }
    pp.g.position.set(pp.x, groundAt(pp.x, pp.z), pp.z);
    const sw = step ? Math.sin(now / 1000 * pp.sp * 5 + pp.ph) * .6 : 0; pp.legL.rotation.x = sw; pp.legR.rotation.x = -sw; pp.armL.rotation.x = -sw; pp.armR.rotation.x = sw;
    const dist = Math.hypot(pp.x - P.x, pp.z - P.z);
    pp.bubble.visible = dist < 30 && (now / 1000 - pp.spoke) < 4;
    if (dist < 14 && now / 1000 - pp.spoke > 12 + Math.random() * 6) {
      pp.spoke = now / 1000;
      if (speechOK && window.speechSynthesis && !speechSynthesis.speaking) {
        const u = new SpeechSynthesisUtterance(LINES[pp.t]); u.rate = 0.95; u.pitch = 0.7 + (people.indexOf(pp) % 7) * 0.1; u.volume = Math.max(0.25, 1 - dist / 14);
        speechSynthesis.speak(u);
      }
    }
  }
  function spawn_(pp) { C.spawn(pp); }
}

