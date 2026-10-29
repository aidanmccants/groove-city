/* ---------------- Chick-fil-A job: stand behind the Breen counter to be on shift; walkers queue, a sandwich pays $1 ----------------
   CFA.zone (centre + poly behind the counter), CFA.counter and CFA.door (outside the servery doorway) are world positions
   other systems can point players to. Customers are ordinary walkers (people[]) with pp.cfa set while they are inside. */
const CFA = {
  zone: null, counter: null, door: null, route: [], queue: [], onShift: false, served: 0, nearStarts: [],
  PAY: RULES['cfa.serve'].cash / 100, PATIENCE: 18, MAXQ: 4, nextPull: 0, HAND_MS: 650, handing: null, fly: null,
  slot(i) { return breen.W(10, 15.9 - i * 1.1); },   // queue runs back from the register toward the hall
  join(pp) {
    if (!this.zone || this.queue.length >= this.MAXQ) return false;
    pp.cfa = { stage: 'in', wp: this.route.slice(), at: 0, until: 0 }; this.queue.push(pp); return true;
  },
  leave(pp, happy) {
    const i = this.queue.indexOf(pp); if (i >= 0) this.queue.splice(i, 1);
    pp.cfa.stage = 'out'; pp.cfa.wp = this.route.slice().reverse(); pp.cfa.happy = happy;
    say(pp, happy ? 'happy' : 'sad', 5);
    pp.bag.visible = happy;
  },
  // hand the customer at the register a sandwich: it leaves the player's hand and arcs over the counter (updateCFA);
  // the customer pays when it lands. One at a time; true if a hand-over started
  serve() {
    if (!this.onShift || this.handing) return false;
    const pp = this.queue[0];
    if (!pp || pp.cfa.stage !== 'queue' || !pp.cfa.at) { toast('No one at the register yet', 'info'); return false; }
    const f = new THREE.Vector3(); camera.getWorldDirection(f);
    const from = camera.position.clone().addScaledVector(f, 0.55).add(new THREE.Vector3(Math.cos(yaw) * 0.22, -0.3, -Math.sin(yaw) * 0.22));
    pp.cfa.handing = true; this.handing = { pp, t0: performance.now(), from };
    this.fly.position.copy(from); this.fly.visible = true; return true;
  },
  reset() {
    if (this.fly) this.fly.visible = false; this.handing = null; for (const pp of this.queue.slice()) { pp.cfa = null; updatePeople.ctx && updatePeople.ctx.spawn(pp); } this.queue.length = 0; this.onShift = false; },
};
const SANDWICH_MATS = {};
// voxel chicken sandwich, about 22 cm across: bun, pickles, fillet, bun, standing on its base
function makeSandwich() {
  const g = new THREE.Group(), m = c => SANDWICH_MATS[c] || (SANDWICH_MATS[c] = new THREE.MeshLambertMaterial({ color: c }));
  for (const [sx, sy, y, c] of [[.2, .05, 0, '#d39a52'], [.13, .015, .05, '#5f7d2c'], [.23, .055, .065, '#b8702a'], [.2, .08, .12, '#e2ab62']]) {
    const b = new THREE.Mesh(boxGeo, m(c)); b.scale.set(sx, sy, sx); b.position.y = y; g.add(b);
  }
  return g;
}
const SAY = {}; const SAY_TEXT = { order: 'one chicken sandwich, please!', happy: 'thank you! my pleasure 😊', sad: 'too slow... 😞' };
function say(pp, what, secs) {
  SAY[what] = SAY[what] || bubbleTexture(SAY_TEXT[what]);
  pp.bubble.material.map = SAY[what]; pp.bubble.material.needsUpdate = true; pp.cfa.until = performance.now() / 1000 + secs;
}
function setupCFA() {
  if (!breen) return; const F = breen;
  const [zx, zz] = F.W(10, 19.05), [cx, cz] = F.W(10, 17.2);
  CFA.zone = { x: zx, z: zz, y: F.fy, poly: [F.W(4, 17.75), F.W(16, 17.75), F.W(16, 20.45), F.W(4, 20.45)] };
  CFA.counter = { x: cx, z: cz, y: F.fy + 1.1 };
  CFA.door = F.W(12, -4);
  CFA.route = [F.W(12, -2.5), F.W(12, 1.2), F.W(11, 8)];   // street, through the servery doorway, onto the tiles
  CFA.face = Math.atan2(F.vx, F.vz);   // customers in line face the counter
  CFA.fly = makeSandwich(); CFA.fly.visible = false; scene.add(CFA.fly);
}
function updateCustomer(pp, dt, now) {
  const c = pp.cfa, t = now / 1000;
  let target = null, sp = pp.sp * (c.stage === 'out' && !c.happy ? 0.75 : 1);
  if (c.wp.length) target = c.wp[0];
  else if (c.stage === 'in') c.stage = 'queue';
  if (c.stage === 'queue') target = CFA.slot(CFA.queue.indexOf(pp));
  else if (c.stage === 'out' && !c.wp.length) { updatePeople.ctx.spawn(pp); return; }   // back outside: off to somewhere new
  const dx = target[0] - pp.x, dz = target[1] - pp.z, d = Math.hypot(dx, dz), step = sp * dt;
  let moving = d > 0.02;
  if (d <= step) { pp.x = target[0]; pp.z = target[1]; if (c.stage !== 'queue') c.wp.shift(); else moving = false; }
  else { pp.x += dx / d * step; pp.z += dz / d * step; pp.g.rotation.y = Math.atan2(dx, dz); }
  if (c.stage === 'queue' && !moving) {
    pp.g.rotation.y = CFA.face;
    if (CFA.queue[0] === pp) {
      if (!c.at) { c.at = t; say(pp, 'order', CFA.PATIENCE); }
      else if (t - c.at > CFA.PATIENCE && !c.handing) CFA.leave(pp, false);
    }
  }
  pp.g.position.set(pp.x, groundAt(pp.x, pp.z), pp.z);
  const sw = moving ? Math.sin(t * pp.sp * 5 + pp.ph) * .6 : 0; pp.legL.rotation.x = sw; pp.legR.rotation.x = -sw; pp.armL.rotation.x = -sw; pp.armR.rotation.x = pp.bag.visible ? -0.3 : sw;
  pp.bubble.visible = t < c.until && Math.hypot(pp.x - P.x, pp.z - P.z) < 30;
}
// shift status, the hint line, and extra customers while someone is working
function updateCFA(now) {
  if (!CFA.zone) return;
  const F = breen, z = CFA.zone, H = CFA.handing;
  if (H) {   // sandwich in flight: ease across, with a little hop over the counter
    const k = Math.min(1, (now - H.t0) / CFA.HAND_MS), e = k * k * (3 - 2 * k), to = H.pp.bag.getWorldPosition(new THREE.Vector3());
    CFA.fly.position.lerpVectors(H.from, to, e); CFA.fly.position.y += Math.sin(Math.PI * k) * 0.35; CFA.fly.rotation.y = k * Math.PI * 2;
    if (k >= 1) { CFA.fly.visible = false; CFA.handing = null; H.pp.cfa.handing = false; CFA.served++; CFA.leave(H.pp, true); Econ.act('cfa.serve'); }
  }
  const inside = started && !flying && Math.abs(P.y - F.fy) < 1.5;
  CFA.onShift = inside && pip(P.x, P.z, z.poly);
  if (!started) return;
  if (CFA.onShift) {
    const pp = CFA.queue[0], ready = pp && pp.cfa.stage === 'queue' && pp.cfa.at;
    const wait = ready ? Math.max(0, Math.ceil(CFA.PATIENCE - (now / 1000 - pp.cfa.at))) : 0;
    setHint(H ? 'Here you go!' : ready ? `Customer at the register · ${Input.glyph('use')} to hand a sandwich · ${wait}s` : `On shift at Chick-fil-A · ${CFA.queue.length ? CFA.queue.length + ' on the way' : 'waiting for customers'} · ${money(CFA.PAY)} a sandwich`);
    // keep a trickle coming: bring in a walker from out of sight, about one every 7 s, while the line is short
    if (now > CFA.nextPull && CFA.queue.length < 2 && CFA.nearStarts.length) {
      CFA.nextPull = now + 5000 + Math.random() * 4000;
      const C = updatePeople.ctx, incoming = people.filter(pp => pp.t === 'cfa' && !pp.cfa && (C.T.cfa.dist.get(pp.k) ?? 1e9) < 120).length;
      const pick = people.find(pp => !pp.cfa && pp.t !== 'cfa' && Math.hypot(pp.x - P.x, pp.z - P.z) > 60);
      if (pick && incoming < 2) C.spawn(pick, 'cfa', CFA.nearStarts[Math.floor(Math.random() * CFA.nearStarts.length)]);
    }
  } else if (inside && pip(P.x, P.z, breen.b.p)) {
    const u = (P.x - F.a[0]) * F.ux + (P.z - F.a[1]) * F.uz;   // along the hall: the servery end is u < 20
    setHint(u < 22 ? 'Step behind the Chick-fil-A counter to work a shift' : carHint);
  } else setHint(Bank.hint() || carHint);
}

