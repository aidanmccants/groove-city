/* ---------------- police: NPC cops patrol on the shared schedule and react to the local player ----------------
   Cops.list: [{ id, car, state, st (seconds in state), data, officer: { g, x, z, onFoot }, busy }]. Each frame
   Cops.update runs Cops.states[cop.state](cop, dt, now). 'patrol' follows the car's schedule; any other state takes the
   car off it (car.npc.ov) until 'leave' hands it back. Built-in states: patrol, respond (drive to a target), pull (the
   pull-over sequence), run (officer on foot to a target), driveRun (drive close, then run), leave.
   To add a chase: Cops.states.chase = (cop, dt, now) => { Cops.driveTo(cop, target.x, target.z, dt, 20); ... };
   then Cops.setState(cop, 'chase', { target }). Helpers: Cops.driveTo, Cops.walkTo, Cops.exitCar, Cops.enterCar,
   Cops.dispatch(cop, target, mode, onArrive), Cops.nearest(x, z). Targets are anything with x and z (read every frame). */
const Cops = {
  list: [], graceUntil: 0,
  states: {},
  add(car) {
    const g = new THREE.Group(), mat = c => new THREE.MeshLambertMaterial({ color: c });
    const limb = (sx, sy, sz, c, x, y) => { const m = new THREE.Mesh(limbGeo, mat(c)); m.scale.set(sx, sy, sz); m.position.set(x, y, 0); g.add(m); return m; };
    const part = (sx, sy, sz, c, y) => { const m = new THREE.Mesh(boxGeo, mat(c)); m.scale.set(sx, sy, sz); m.position.y = y; g.add(m); return m; };
    const legL = limb(.2, .85, .22, '#1b2233', -.12, .85), legR = limb(.2, .85, .22, '#1b2233', .12, .85), armL = limb(.14, .7, .16, '#24324f', -.33, 1.5), armR = limb(.14, .7, .16, '#24324f', .33, 1.5);
    part(.5, .68, .28, '#24324f', .85); part(.32, .32, .32, '#d9a87e', 1.55); part(.38, .1, .38, '#111827', 1.84); part(.1, .1, .04, '#e5c04a', 1.32).position.z = .15;   // badge
    g.visible = false; scene.add(g);
    const cop = { id: this.list.length, car, state: 'patrol', st: 0, data: {}, officer: { g, legL, legR, armL, armR, x: 0, z: 0, onFoot: false, walk: 0 } };
    car.copRef = cop; this.list.push(cop); return cop;
  },
  setState(cop, s, data) { cop.state = s; cop.st = 0; cop.data = data || {}; const N = cop.car.npc; if (s === 'patrol') N.ov = null; else if (!N.ov || N.ov.cop !== cop) N.ov = { s: 'cop', cop }; },
  nearest(x, z, free = true) { let b = null, bd = 1e9; for (const c of this.list) { if (free && c.state !== 'patrol') continue; const p = c.officer.onFoot ? c.officer : c.car, d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; b = c; } } return b; },
  // drive the cop's car straight toward (x, z), slowing to stop there; returns the distance left
  driveTo(cop, x, z, dt, vmax = 12, stopAt = 1.5) {
    const c = cop.car, dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), want = Math.atan2(dx, dz), dh = wrapA(want - c.h);
    const ahead = Math.abs(dh) < 1.8, vt = d < stopAt ? 0 : Math.min(vmax, (d - stopAt) * 1.2 + 1) * (ahead ? 1 : -.4);
    c.v += Math.max(-10 * dt, Math.min(6 * dt, vt - c.v));
    c.h += Math.max(-1.6 * dt, Math.min(1.6 * dt, (ahead ? dh : -wrapA(dh + Math.PI)) * 2)) * Math.min(1, Math.abs(c.v) / 3) * Math.sign(c.v || 1);
    Vehicles.drive(c, dt); return d;
  },
  exitCar(cop) { const c = cop.car, O = cop.officer, lx = Math.cos(c.h), lz = -Math.sin(c.h); O.x = c.x + lx * 1.4; O.z = c.z + lz * 1.4; O.onFoot = true; O.g.visible = true; this.walkTo(cop, O.x, O.z, 0); },
  enterCar(cop) { cop.officer.onFoot = false; cop.officer.g.visible = false; },
  // walk (or run, sp ~5) the officer toward (x, z); returns the distance left
  walkTo(cop, x, z, dt, sp = 1.8) {
    const O = cop.officer, dx = x - O.x, dz = z - O.z, d = Math.hypot(dx, dz), step = Math.min(d, sp * dt);
    if (d > 1e-3) { O.x += dx / d * step; O.z += dz / d * step; O.g.rotation.y = Math.atan2(dx, dz); }
    O.walk += step * 3; const sw = step > 1e-4 ? Math.sin(O.walk) * .6 : 0;
    O.legL.rotation.x = sw; O.legR.rotation.x = -sw; O.armL.rotation.x = -sw; O.armR.rotation.x = sw;
    O.g.position.set(O.x, groundAt(O.x, O.z), O.z); return d;
  },
  // send a cop to a target: 'drive' (car to the target), 'run' (on foot), 'driveRun' (drive near, then run the last bit)
  dispatch(cop, target, mode = 'drive', onArrive) { this.setState(cop, mode === 'run' ? 'run' : mode === 'driveRun' ? 'driveRun' : 'respond', { target, onArrive }); cop.car.flash = true; },
  // pull over a car at target {x, z, h}; ticket is the local player's car (charged $10) or null for another player's
  pullOver(cop, target, ticket) {
    cop.car.flash = true; this.setState(cop, 'pull', { target, ticket, step: 'approach' });
    if (Math.hypot(cop.car.x - P.x, cop.car.z - P.z) < 150) Siren.wail(2.4, .05, cop.car.x, cop.car.z);
  },
  update(dt, now) {
    for (const cop of this.list) { cop.st += dt; const fn = this.states[cop.state]; if (fn) fn(cop, dt, now); }
    // enforcement against the local player (a player cop is never ticketed)
    const me = Vehicles.player; if (!me || me.cop || Vehicles.frozen || now < this.graceUntil || Bank.wanted) return;
    const speeding = Math.abs(me.v) > LIMIT + .3, red = Vehicles.redT && now - Vehicles.redT < 1500;
    if (!speeding && !red) return;
    for (const cop of this.list) {
      if (cop.state !== 'patrol') continue;
      const p = cop.officer.onFoot ? cop.officer : cop.car; if (Math.hypot(p.x - me.x, p.z - me.z) > COP_NEAR) continue;
      const why = red ? 'running a red light' : `speeding at ${mph(me.v)} mph in a 25`;
      Vehicles.frozen = why; Vehicles.redT = 0; toast('Pulled over! ' + why[0].toUpperCase() + why.slice(1), 'bad'); Pad.rumble(400, 0.8);
      this.pullOver(cop, me, me); sendEvt('po', [cop.id, +me.x.toFixed(1), +me.z.toFixed(1), +me.h.toFixed(2)]);
      break;
    }
  },
};
Cops.states.patrol = cop => { cop.car.flash = false; };
Cops.states.respond = (cop, dt) => {
  const T = cop.data.target; cop.car.flash = true;
  if (Cops.driveTo(cop, T.x, T.z, dt, cop.data.speed || 14, cop.data.near || 3) < (cop.data.near || 3) + .5 && Math.abs(cop.car.v) < .5) { const f = cop.data.onArrive; Cops.setState(cop, 'stopped'); if (f) f(cop); }
};
Cops.states.stopped = (cop, dt) => { const c = cop.car; c.v = Math.max(0, c.v - 8 * dt); Vehicles.drive(c, dt); };
Cops.states.run = (cop, dt) => {
  const T = cop.data.target; if (!cop.officer.onFoot) Cops.exitCar(cop);
  if (Cops.walkTo(cop, T.x, T.z, dt, cop.data.speed || 5) < 1) { const f = cop.data.onArrive; Cops.setState(cop, 'stopped'); if (f) f(cop); }
};
Cops.states.driveRun = (cop, dt) => {
  const T = cop.data.target; cop.car.flash = true;
  if (Cops.driveTo(cop, T.x, T.z, dt, cop.data.speed || 16, 10) < 11 && Math.abs(cop.car.v) < .5) Cops.setState(cop, 'run', cop.data);
};
Cops.states.pull = (cop, dt) => {
  const D2 = cop.data, T = D2.target, c = cop.car, tf = [Math.sin(T.h), Math.cos(T.h)], tl = [Math.cos(T.h), -Math.sin(T.h)];
  c.flash = true;
  if (D2.step === 'approach') {   // park about a car length behind
    const bx = T.x - tf[0] * 7.5, bz = T.z - tf[1] * 7.5;
    if (Cops.driveTo(cop, bx, bz, dt, 9, 3.5) < 4.5 && Math.abs(c.v) < .4 || cop.st > 20) { D2.step = 'exit'; cop.st = 0; }
  } else if (D2.step === 'exit') { c.v = 0; if (cop.st > .8) { Cops.exitCar(cop); D2.step = 'walk'; cop.st = 0; } }
  else if (D2.step === 'walk') { if (Cops.walkTo(cop, T.x + tl[0] * 1.7 + tf[0] * .3, T.z + tl[1] * 1.7 + tf[1] * .3, dt) < .2 || cop.st > 20) { D2.step = 'ticket'; cop.st = 0; cop.officer.g.rotation.y = Math.atan2(-tl[0], -tl[1]); } }
  else if (D2.step === 'ticket') {
    cop.officer.armR.rotation.x = -1.2;
    if (cop.st > 2.2) {
      if (D2.ticket) {
        Econ.act('ticket', { done: r => { if (r.ok && Profile.inDebt()) toast("You have 10 minutes to earn money selling sandwiches at CFA or you'll be kicked. Follow the yellow beam.", 'bad'); } });
      }
      D2.step = 'back'; cop.st = 0;
    }
  } else if (D2.step === 'back') {
    const lx = Math.cos(c.h), lz = -Math.sin(c.h);
    if (Cops.walkTo(cop, c.x + lx * 1.4, c.z + lz * 1.4, dt) < .2 || cop.st > 20) {
      Cops.enterCar(cop);
      if (D2.ticket && Vehicles.player === D2.ticket) { Vehicles.frozen = null; Cops.graceUntil = performance.now() + 20000; toast('You are free to go. Drive safely!', 'info'); }
      cop.car.flash = false; Cops.setState(cop, 'leave');
    }
  }
};
Cops.states.leave = (cop) => {   // hand the car back to its schedule (npcLeave pulls away and rejoins)
  cop.car.npc.ov = { s: 'leave', t: 0, fn: npcLeave }; cop.state = 'rejoin'; cop.st = 0;
};
Cops.states.rejoin = (cop) => { if (!cop.car.npc.ov) { cop.state = 'patrol'; cop.data = {}; } };

