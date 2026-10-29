/* ---------------- bank robbery: smash the PNC vault for $100, then keep away from the police for two minutes ----------------
   The vault belongs to the room: {t: 'rob'} asks the Worker, which answers {t: 'vault', until, by} (by: who cracked it), so it
   stands open for everyone for VAULT_MS and newcomers get it in welcome. While the robber is wanted, every cop within 50 ft
   of them (or of the bank's doors) gives chase: the robber's browser picks them and sends evt 'chase' [cop ids], and the
   other browsers run the same chase against that player's avatar; 'caught' or 'calm' ends it everywhere. An officer who
   touches you, or a chasing car that hits you (or your car), busts you: kicked, and your money is gone. No flying meanwhile. */
const VAULT_MS = 5 * 60 * 1000, WANTED_MS = 2 * 60 * 1000, CHASE_R = 15.24, VAULT_HITS = 5, CHASE_RUN = 6.4, CHASE_DRIVE = 17;
const Bank = {
  until: 0, hits: 0, lastHit: 0, pending: 0, wanted: null, shake: 0, sparks: [], al: null, crackN: 0, shown: '',
  broken() { return netNow() < this.until; },
  near() {   // on foot in the vault room, in front of the door
    if (!bank || !started || Vehicles.player || flying || Math.abs(P.y - bank.fy) > 1.5) return false;
    const [u, v] = bank.uv(P.x, P.z); return u > bank.vu0 - 3.4 && u < bank.vu0 + .1 && Math.abs(v) < 2.6;
  },
  canSmash() { return this.near() && !this.broken() && !this.pending; },
  smash() {
    const now = performance.now(); if (now - this.lastHit < 220) return;
    this.lastHit = now; this.hits++; this.shake = .35; this.crack(this.hits); this.burst(14); this.bang(this.hits >= VAULT_HITS ? 1.8 : 1);
    if (this.hits >= VAULT_HITS) this.rob();
  },
  rob() {
    if (netSock && netSock.readyState === 1) { this.pending = performance.now(); netSock.send(JSON.stringify({ t: 'rob' })); }
    else this.cracked(netNow() + VAULT_MS);
  },
  onVault(m) {   // the Worker: open until m.until (shared clock), cracked by m.by
    const was = this.broken(); this.until = +m.until || 0;
    if (this.pending && m.by === myId) { this.pending = 0; this.cracked(this.until); }
    else if (this.pending) { this.pending = 0; this.hits = 0; toast('Someone else just cleaned out the vault', 'bad'); }
    else if (!was && this.broken() && started && bank && Math.hypot(P.x - bank.M[0], P.z - bank.M[1]) < 150) toast('🚨 The alarm is ringing at PNC Bank: someone cracked the vault', 'info');
  },
  cracked(until) {
    this.until = until; this.hits = 0; this.burst(40);
    Profile.earn(100, 'bank robbery'); Pad.rumble(250, 0.6);
    banner('VAULT CRACKED · +$100', 'The alarm is ringing. Stay away from the police for 2:00 and the cash is yours.');
    if (flying) toggleFly();
    this.wanted = { end: performance.now() + WANTED_MS, cops: new Set() }; $('wanted').hidden = false;
    this.join();
    if (!this.wanted.cops.size) toast('No police close by yet. Any that come within 50 ft will chase you.', 'info');
  },
  // cops within 50 ft of the robber or of the bank's doors join the chase
  join() {
    const w = this.wanted, door = bank ? bank.W(-2, 0) : [P.x, P.z], ids = [];
    for (const cop of Cops.list) {
      if (w.cops.has(cop) || cop.state === 'pull' || cop.state === 'chase') continue;
      const p = cop.officer.onFoot ? cop.officer : cop.car;
      if (Math.hypot(p.x - P.x, p.z - P.z) > CHASE_R && Math.hypot(p.x - door[0], p.z - door[1]) > CHASE_R) continue;
      this.chase(cop, P, null); w.cops.add(cop); ids.push(cop.id);
    }
    if (ids.length) { sendEvt('chase', ids); toast(`🚓 ${ids.length > 1 ? ids.length + ' officers are' : 'An officer is'} after you!`, 'bad'); Siren.wail(1.8, .04); }
  },
  // a cop out of his car near it, with the target some way off, runs back to drive; otherwise he runs (or drives, then runs)
  chase(cop, target, remote) {
    const O = cop.officer, c = cop.car, toCar = O.onFoot && Math.hypot(O.x - c.x, O.z - c.z) < 6 && Math.hypot(O.x - target.x, O.z - target.z) > 14;
    Cops.setState(cop, 'chase', { target, remote, toCar, stuck: 0, think: 0, rev: 0 }); c.flash = true;
  },
  release(remote) { for (const cop of Cops.list) if (cop.state === 'chase' && cop.data.remote === remote) Cops.setState(cop, 'giveup'); },
  endWanted(escaped) {
    if (!this.wanted) return;
    this.wanted = null; $('wanted').hidden = true; this.alarm(false); this.release(null);
    if (escaped) { sendEvt('calm', []); banner('YOU GOT AWAY', 'The police gave up the chase. The $100 is yours.'); }
  },
  bust() {
    sendEvt('caught', []); this.endWanted(false);
    kickAndReset('Busted! A Grove City officer caught you after the PNC Bank robbery. All your money is gone, so you start over with ' + money(START_MONEY) + '.');
  },
  reset() { this.endWanted(false); this.hits = 0; this.pending = 0; this.clearCracks(); },
  onEvt(m) {   // another player's chase: 'chase' [cop ids], 'caught', 'calm'
    const r = remotes.get(m.id);
    if (m.k === 'chase') { if (!r || !r.seen) return; for (const id of m.a) { const cop = Cops.list[id]; if (cop && cop.state !== 'chase' && cop.state !== 'pull') this.chase(cop, r, m.id); } }
    else { this.release(m.id); if (m.k === 'caught' && r && Math.hypot(r.x - P.x, r.z - P.z) < 250) toast(`🚓 ${r.name} got busted`, 'info'); }
  },
  hint() {
    if (!bank || !started || Vehicles.player) return '';
    if (this.near()) {
      if (this.broken()) { const s = Math.max(0, Math.ceil((this.until - netNow()) / 1000)); return `The vault has been cleaned out · restocked in ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
      if (this.pending) return 'Cracking the vault…';
      return `${Input.glyph('use')} to smash the vault door · ${this.hits}/${VAULT_HITS}`;
    }
    if (!this.wanted && !this.broken() && Math.abs(P.y - bank.fy) < 1.5 && pip(P.x, P.z, bank.b.p)) return 'PNC Bank · the vault is past the teller counter, through the back office';
    return '';
  },
  update(dt, now) {
    if (!bank) return;
    const F = bank, open = this.broken();
    if (this.pending && now - this.pending > 3000) { this.pending = 0; this.cracked(netNow() + VAULT_MS); }   // the server is quiet: crack it anyway
    // the door swings open, and shut again once the vault is restocked
    F.ang += Math.max(-dt * .6, Math.min(dt * 1.4, (open ? 1.75 : 0) - F.ang));
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt);
    F.door.rotation.y = F.door0 + F.ang + Math.sin(now * .09) * this.shake * .05;
    const [pu] = F.uv(P.x, P.z);
    F.vaultCol.top = F.ang > 1 || (pu > F.vu0 - .2 && pip(P.x, P.z, F.b.p)) ? -1e4 : F.fy + 3.5;   // open, and never shut anyone in
    F.cash.visible = !open;
    if (!open && F.ang < .01 && this.crackN && !this.hits) this.clearCracks();
    if (this.hits && !open && !this.pending && (now - this.lastHit > 25000 || !this.near())) { this.hits = 0; this.clearCracks(); }
    const ring = this.wanted || (open && netNow() < this.until - VAULT_MS + WANTED_MS);
    F.alarmMat.emissive.setHex(ring && Math.floor(now / 220) % 2 ? 0xff2a1a : 0x000000);
    if (this.shake > 0 && !Vehicles.player) { const k = this.shake * .12; camera.position.x += (Math.random() - .5) * k; camera.position.y += (Math.random() - .5) * k; }
    for (const s of this.sparks) {
      if (s.life <= 0) continue;
      s.life -= dt; s.vy -= s.g * dt; const p = s.m.position; p.x += s.vx * dt; p.y += s.vy * dt; p.z += s.vz * dt;
      if (p.y < F.fy) { p.y = F.fy; s.vy *= -.3; s.vx *= .5; s.vz *= .5; }
      s.m.visible = s.life > 0;
    }
    const w = this.wanted; if (!w) return;
    if (flying) toggleFly();
    this.join();
    // busted: an officer on foot touches you, or a chasing car hits you or your car
    const me = Vehicles.player;
    for (const cop of w.cops) {
      if (cop.state !== 'chase') continue;
      const O = cop.officer, c = cop.car;
      if (O.onFoot) { if (me ? Math.abs(me.v) < 3 && Vehicles.boxPush(me, O.x, O.z, .7) : Math.hypot(O.x - P.x, O.z - P.z) < 1 && Math.abs(O.g.position.y - P.y) < 1.6) return this.bust(); }
      else if (me ? [-1.6, 0, 1.6].some(o => Vehicles.boxPush(me, c.x + Math.sin(c.h) * o, c.z + Math.cos(c.h) * o, 1.1)) : Math.abs(c.v) > 1.5 && P.y < c.y + 1.7 && Vehicles.boxPush(c, P.x, P.z, R + .3)) return this.bust();
    }
    const left = w.end - now; if (left <= 0) return this.endWanted(true);
    const s = Math.ceil(left / 1000), n = [...w.cops].filter(c => c.state === 'chase').length;
    const txt = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}|${n ? `${n} officer${n > 1 ? 's' : ''} chasing you · no flying` : 'Keep clear of the police · no flying'}`;
    if (txt !== this.shown) { this.shown = txt; const [a, b] = txt.split('|'); $('wtime').textContent = a; $('wcops').textContent = b; }
    this.alarm(true); if (this.al) this.al.g.gain.value = .006 + .028 * Math.max(0, 1 - Math.hypot(P.x - F.M[0], P.z - F.M[1]) / 150);
  },
  /* ---- effects: cracks on the door, sparks and dust, the bang, the alarm bell ---- */
  crack(n) {
    if (!bank) return; const g = bank.crackG; this.crackN = n;
    g.strokeStyle = 'rgba(18,20,24,.92)'; g.lineCap = 'round'; g.lineJoin = 'round';
    const cx = 128 + (Math.random() - .5) * 70, cy = 128 + (Math.random() - .5) * 70;
    g.fillStyle = 'rgba(12,12,14,.4)'; g.beginPath(); g.arc(cx, cy, 7 + n * 3, 0, 7); g.fill();
    for (let k = 0; k < 3 + n; k++) {
      let x = cx, y = cy, a = Math.random() * Math.PI * 2; g.lineWidth = 1 + n * .6; g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < 5 + n * 2; s++) { a += (Math.random() - .5) * .9; x += Math.cos(a) * 9; y += Math.sin(a) * 9; g.lineTo(x, y); }
      g.stroke();
    }
    bank.crackTex.needsUpdate = true;
  },
  clearCracks() { if (!bank) return; bank.crackG.clearRect(0, 0, 256, 256); bank.crackTex.needsUpdate = true; this.crackN = 0; },
  burst(n) {
    if (!bank) return; const F = bank;
    if (!this.mats) this.mats = [new THREE.MeshBasicMaterial({ color: 0xffd060 }), new THREE.MeshBasicMaterial({ color: 0xff8a2a }), new THREE.MeshLambertMaterial({ color: 0x9a9ea3 })];
    for (let i = 0; i < n; i++) {
      let s = this.sparks.find(k => k.life <= 0);
      if (!s) { if (this.sparks.length >= 90) break; s = { m: new THREE.Mesh(boxGeo, this.mats[0]), life: 0 }; s.m.castShadow = false; scene.add(s.m); this.sparks.push(s); }
      const dust = i % 4 === 3, sz = dust ? .08 + Math.random() * .1 : .045, sp = dust ? 1.4 : 3.5 + Math.random() * 3.5, [x, z] = F.W(F.vu0 - .6, (Math.random() - .5) * 1.6);
      s.m.material = this.mats[dust ? 2 : i % 2]; s.m.scale.set(sz, sz, sz); s.m.position.set(x, F.cy + (Math.random() - .5) * 1.6, z);
      const out = .4 + Math.random(), side = (Math.random() - .5) * 1.6;
      s.vx = (-F.ix * out + F.vx * side) * sp; s.vz = (-F.iz * out + F.vz * side) * sp; s.vy = (Math.random() * .9 - .1) * sp;
      s.g = dust ? 1.5 : 14; s.life = dust ? 1.3 : .45 + Math.random() * .4; s.m.visible = true;
    }
  },
  bang(k = 1) {   // a metal hit: a burst of noise, a low thump and two ringing partials
    const ac = Rail.ac; if (!ac || ac.state !== 'running') return; const t0 = ac.currentTime;
    const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * .25 * k), ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    const src = ac.createBufferSource(), lp = ac.createBiquadFilter(), g = ac.createGain(); src.buffer = buf; lp.type = 'lowpass'; lp.frequency.value = 2400; g.gain.value = .22;
    src.connect(lp); lp.connect(g); g.connect(ac.destination); src.start(t0);
    for (const [f, v, type] of [[110, .35, 'sine'], [640 + Math.random() * 90, .07, 'triangle'], [1530 + Math.random() * 120, .03, 'triangle']]) {
      const o = ac.createOscillator(), og = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t0); if (type === 'sine') o.frequency.exponentialRampToValueAtTime(40, t0 + .3);
      og.gain.setValueAtTime(v, t0); og.gain.exponentialRampToValueAtTime(.0005, t0 + .5 * k); o.connect(og); og.connect(ac.destination); o.start(t0); o.stop(t0 + .55 * k);
    }
  },
  alarm(on) {   // an electric bell: a bright tone chopped fast, louder near the bank (update sets the level)
    if (!on) { if (this.al) { try { this.al.o.stop(); this.al.lfo.stop(); } catch (e) { } this.al = null; } return; }
    const ac = Rail.ac; if (this.al || !ac || ac.state !== 'running') return;
    const o = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain(), gate = ac.createGain(), g = ac.createGain(), bp = ac.createBiquadFilter();
    o.type = 'square'; o.frequency.value = 1250; lfo.type = 'square'; lfo.frequency.value = 14; lg.gain.value = .5; gate.gain.value = .5;
    bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 1.2; g.gain.value = .02;
    lfo.connect(lg); lg.connect(gate.gain); o.connect(gate); gate.connect(bp); bp.connect(g); g.connect(ac.destination); o.start(); lfo.start();
    this.al = { o, lfo, g };
  },
};
function banner(title, sub) {
  const el = $('heist'); $('heistT').textContent = title; $('heistS').textContent = sub;
  el.hidden = true; void el.offsetWidth; el.hidden = false; clearTimeout(banner.t); banner.t = setTimeout(() => { el.hidden = true; }, 4200);
}
// chasing: on foot at a run (faster than walking, slower than a sprint), or in the car, then out and running once close.
// A target that drives off sends the officer back to his car; a car stuck against something backs out or the officer gets out.
Cops.states.chase = (cop, dt) => {
  const D2 = cop.data, T = D2.target, O = cop.officer, c = cop.car, lx = Math.cos(c.h), lz = -Math.sin(c.h);
  const tcar = D2.remote ? T.car : Vehicles.player; c.flash = true;
  if (O.onFoot) {
    if (D2.toCar) { if (Cops.walkTo(cop, c.x + lx * 1.4, c.z + lz * 1.4, dt, CHASE_RUN) < .4) { Cops.enterCar(cop); D2.toCar = false; D2.stuck = 0; } return; }
    const dT = Cops.walkTo(cop, T.x, T.z, dt, CHASE_RUN);
    if ((D2.think -= dt) <= 0) { D2.think = 1; const dC = Math.hypot(O.x - c.x, O.z - c.z); if ((tcar && dT > 10) || (dT > 35 && dC < dT)) D2.toCar = true; }
    return;
  }
  const d = Math.hypot(T.x - c.x, T.z - c.z);
  if (D2.rev > 0) { D2.rev -= dt; c.v += (-5 - c.v) * Math.min(1, dt * 3); c.h += 1.1 * dt * D2.turn; Vehicles.drive(c, dt); return; }
  if (!tcar && d < 9) { c.v = Math.max(0, c.v - 16 * dt); Vehicles.drive(c, dt); if (c.v < 1) { c.v = 0; Cops.exitCar(cop); } return; }
  Cops.driveTo(cop, T.x, T.z, dt, CHASE_DRIVE, tcar ? 0 : 6);
  D2.stuck = Math.abs(c.v) < 1.2 ? D2.stuck + dt : Math.max(0, D2.stuck - dt);
  if (D2.stuck > 2.5) { D2.stuck = 0; if (!tcar && d < 40) { c.v = 0; Cops.exitCar(cop); } else { D2.rev = 1.4; D2.turn = Math.random() < .5 ? -1 : 1; } }
};
Cops.states.giveup = (cop, dt) => {   // back to the car (on foot), then hand it back to the patrol schedule
  const c = cop.car, O = cop.officer, lx = Math.cos(c.h), lz = -Math.sin(c.h); c.flash = false;
  if (O.onFoot && Cops.walkTo(cop, c.x + lx * 1.4, c.z + lz * 1.4, dt, 2.2) > .3 && cop.st < 40) return;
  if (O.onFoot) Cops.enterCar(cop);
  c.v = 0; Cops.setState(cop, 'leave');
};

