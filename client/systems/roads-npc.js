/* ---------------- vehicles: rentable parked cars, police cars, NPC traffic on the shared clock ----------------
   Vehicles.list: every car { id, x, y, z, h (heading, Math.atan2(dx, dz), as rotation.y), v (m/s, signed), pt, rl, cop, col,
   roof, kind: 'parked' | 'player' | 'remote' | 'npc', npc (NPC state) }. Parked cars keep stable ids (buildCars order), so the
   Worker can remember where each one was left; NPC cars come after them. Each car part is one InstancedMesh for the whole
   fleet; Vehicles.place(car) rewrites one car's instances. Vehicles.player is the car you are driving (or null).
   NPC traffic is deterministic: each NPC runs a seeded random walk on the road graph, planned as timed legs from the start
   of its half-hour slot on Rail.now() (the shared netNow() clock), holding at red lights and closed rail crossings, so every
   client sees the same car at the same place with no networking. A local reaction (pull-over, chase) takes a car off its
   schedule (npc.ov) until it rejoins. */
const LIMIT = 11.18, NPC_SLOT = 1800, COP_NEAR = 6.1 + 2.2;   // 25 mph; 20 ft from the cop car's bumper (centre + half a car)
const mulberry = s => () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
const mph = v => Math.round(Math.abs(v) * 2.23694);

/* road graph for NPC cars: nodes { i, x, z, adj: [{ to, L, w, rank, br, cross, cs }], light } */
const Roads = {
  nodes: [], main: [], copStarts: [],
  build() {
    const RANK = { primary: 4, secondary: 3, tertiary: 2, unclassified: 2, residential: 1 }, by = new Map();
    const node = q => { const k = q[0].toFixed(1) + ',' + q[1].toFixed(1); let n = by.get(k); if (!n) { n = { i: this.nodes.length, x: q[0], z: q[1], adj: [], light: null }; this.nodes.push(n); by.set(k, n); } return n; };
    for (const l of D.lines) if (CAR_KINDS.includes(l.k) && !l.tu) for (let i = 1; i < l.p.length; i++) {
      const out = q => Math.abs(q[0]) > W / 2 - 4 || Math.abs(q[1]) > H / 2 - 4; if (out(l.p[i - 1]) || out(l.p[i])) continue;   // keep NPCs on the map
      const a = node(l.p[i - 1]), b = node(l.p[i]); if (a === b) continue;
      const e = { L: Math.hypot(b.x - a.x, b.z - a.z), w: l.w || 7, rank: RANK[l.k] || 1, br: !!l.br, name: l.n || '' };
      a.adj.push(Object.assign({ to: b }, e)); b.adj.push(Object.assign({ to: a }, e));
    }
    for (const I of Traffic.lights) { const n = this.nodes.find(n => Math.hypot(n.x - I.x, n.z - I.z) < 1); if (n) n.light = I; }
    for (const n of this.nodes) for (const e of n.adj) for (const c of Rail.crossings) if (c.kind === 'road') {
      const [qx, qz, t] = closestOnSeg(c.x, c.z, [n.x, n.z], [e.to.x, e.to.z]); if (Math.hypot(qx - c.x, qz - c.z) < 4) { e.cross = c; e.cs = t * e.L; }
    }
    this.main = this.nodes.filter(n => n.adj.length && Math.abs(n.x) < W / 2 - 20 && Math.abs(n.z) < H / 2 - 20);
    this.copStarts = this.main.filter(n => n.adj.some(e => e.rank >= 3 || /Broad|Main|College|Center|Pine/.test(e.name)));
    if (!this.copStarts.length) this.copStarts = this.main;
  },
  pick(from, back, r, cop) {   // next edge out of `from`, not straight back unless it is a dead end; cops favour main streets
    const c = from.adj.filter(e => e.to !== back), list = c.length ? c : from.adj;
    let sum = 0; for (const e of list) sum += cop ? e.rank * e.rank : 1 + e.rank * .5;
    let x = r() * sum; for (const e of list) { x -= cop ? e.rank * e.rank : 1 + e.rank * .5; if (x <= 0) return e; }
    return list[list.length - 1];
  },
};

/* NPC schedule: legs { t0, t1, ax, az, bx, bz, h, m (0 cruise, 1 speeding up, 2 slowing down, 3 waiting), rr (ran a red), br } */
function npcSlot(car, t) {
  const N = car.npc, k = Math.floor((t - N.ph) / NPC_SLOT); if (k === N.k) return;
  const r = N.r = mulberry((N.seed * 7919 + k * 104729) >>> 0), pool = N.cop ? Roads.copStarts : Roads.main;
  N.k = k; N.legs = []; N.li = 0; N.tEnd = k * NPC_SLOT + N.ph; N.stopped = true;
  N.speeder = !N.cop && r() < 0.3; N.runner = !N.cop && r() < 0.3; N.vmul = N.speeder ? 1.3 + r() * .25 : .9 + r() * .1;
  N.from = pool[Math.floor(r() * pool.length)]; N.e1 = Roads.pick(N.from, null, r, N.cop); N.e2 = Roads.pick(N.e1.to, N.from, r, N.cop);
  const d = npcDir(N.from, N.e1), ln = npcLane(N.e1); N.p = [N.from.x - d[1] * ln, N.from.z + d[0] * ln]; N.h = Math.atan2(d[0], d[1]);
}
const npcDir = (a, e) => [(e.to.x - a.x) / (e.L || 1), (e.to.z - a.z) / (e.L || 1)];
const npcLane = e => Math.min(2.2, e.w / 4);
function npcTravel(N, x, z, v, endStop, br, rr) {
  const px = N.p[0], pz = N.p[1], L = Math.hypot(x - px, z - pz); if (L < .01) { N.stopped = N.stopped && endStop; return; }
  const ramp = Math.min(12, L / 2), sIn = N.stopped ? ramp : 0, sOut = endStop ? ramp : 0, h = Math.atan2(x - px, z - pz); N.h = h;
  const seg = (s0, s1, m) => {
    if (s1 - s0 < 1e-3) return; const dur = (m ? 2 : 1) * (s1 - s0) / v;
    N.legs.push({ t0: N.tEnd, t1: N.tEnd + dur, ax: px + (x - px) * s0 / L, az: pz + (z - pz) * s0 / L, bx: px + (x - px) * s1 / L, bz: pz + (z - pz) * s1 / L, h, m, br, rr }); N.tEnd += dur;
  };
  seg(0, sIn, 1); seg(sIn, L - sOut, 0); seg(L - sOut, L, 2);
  N.p = [x, z]; N.stopped = endStop;
}
function npcWait(N, until) { if (until <= N.tEnd) return; N.legs.push({ t0: N.tEnd, t1: until, ax: N.p[0], az: N.p[1], bx: N.p[0], bz: N.p[1], h: N.h, m: 3 }); N.tEnd = until; N.stopped = true; }
function npcStep(car) {   // plan one edge: N.from -> N.e1.to, with its stop points
  const N = car.npc, r = N.r, a = N.from, e = N.e1, b = e.to, e2 = N.e2;
  const d1 = npcDir(a, e), d2 = npcDir(b, e2), l1 = npcLane(e), l2 = npcLane(e2), v = (e.rank >= 3 ? 11 : 10) * (N.cop ? 1 : N.vmul);
  const at = s => [a.x + d1[0] * s - d1[1] * l1, a.z + d1[1] * s + d1[0] * l1];
  if (e.cross) {   // hold short of a closed crossing
    const c = e.cross, s = Math.max(0, e.cs - c.r - 4), [x, z] = at(s), eta = N.tEnd + Math.hypot(x - N.p[0], z - N.p[1]) / v;
    if (Rail.closedAt(c, eta) || Rail.closedAt(c, eta + 4)) {
      npcTravel(N, x, z, v, true, e.br); let t = N.tEnd; for (let i = 0; i < 300 && (Rail.closedAt(c, t) || Rail.closedAt(c, t + 4)); i++) t += 1; npcWait(N, t);
    }
  }
  let rr = false;
  if (b.light && e.L > b.light.r + 1) {   // stop line
    const I = b.light, [x, z] = at(e.L - I.r - .6), eta = N.tEnd + Math.hypot(x - N.p[0], z - N.p[1]) / v, h = Math.atan2(d1[0], d1[1]);
    if (Traffic.stateFor(I, h, eta) !== 'green') {
      if (N.runner && r() < 0.5) rr = true;
      else { npcTravel(N, x, z, v, true, e.br); let t = N.tEnd; for (let i = 0; i < 90 && Traffic.stateFor(I, h, t) !== 'green'; i++) t += 1; npcWait(N, t + .5); }
    }
  }
  // corner: the miter point of the two right-hand lanes
  const r1 = [-d1[1], d1[0]], r2 = [-d2[1], d2[0]], dot = d1[0] * d2[0] + d1[1] * d2[1];
  let ex, ez;
  if (dot < -0.6) { ex = b.x + r1[0] * l1; ez = b.z + r1[1] * l1; }
  else { const m = [r1[0] + r2[0], r1[1] + r2[1]], m2 = m[0] * m[0] + m[1] * m[1], k = Math.min(2.5, 2 / m2) * (l1 + l2) / 2; ex = b.x + m[0] * k; ez = b.z + m[1] * k; }
  npcTravel(N, ex, ez, v, false, e.br, rr);
  if (dot < -0.6) N.p = [b.x + r2[0] * l2, b.z + r2[1] * l2];   // dead end: swing round to the other lane
  N.from = b; N.e1 = e2; N.e2 = Roads.pick(e2.to, b, r, N.cop);
}
function npcAt(car, t, out) {   // scheduled pose at time t
  const N = car.npc; npcSlot(car, t);
  for (let guard = 0; N.tEnd < t + 3 && guard < 5000; guard++) {
    npcStep(car);
    if (N.legs.length > 80 && N.legs[N.legs.length - 30].t1 < t - 1) { N.legs.splice(0, N.legs.length - 30); N.li = 0; }
  }
  const L = N.legs; let i = Math.min(N.li, L.length - 1);
  while (i < L.length - 1 && L[i].t1 < t) i++; while (i > 0 && L[i].t0 > t) i--; N.li = i;
  if (i > 40) { L.splice(0, i - 4); N.li = i = 4; }
  const g = L[i]; if (!g) return null;
  const dur = g.t1 - g.t0 || 1, u = Math.max(0, Math.min(1, (t - g.t0) / dur)), len = Math.hypot(g.bx - g.ax, g.bz - g.az);
  const f = g.m === 1 ? u * u : g.m === 2 ? 1 - (1 - u) * (1 - u) : g.m === 3 ? 0 : u;
  out.x = g.ax + (g.bx - g.ax) * f; out.z = g.az + (g.bz - g.az) * f; out.h = g.h; out.br = g.br; out.rr = g.rr;
  out.v = g.m === 3 ? 0 : g.m === 1 ? 2 * len / dur * u : g.m === 2 ? 2 * len / dur * (1 - u) : len / dur;
  return out;
}

