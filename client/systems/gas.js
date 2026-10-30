/* ---------------- fuel: a tank lasts about 6 km of driving; the two pumps outside the Marathon fill it for $8 ----------------
   Stop beside a pump (within 6 m, not moving) and press E: the server takes the money (economy 'gas.fill'), then the tank fills
   over about four seconds while the nozzle is out. Fuel is per car and lives in this session only. */
const TANK_M = 6000, FILL_S = 4;
const PUMPS = [[-703, -323], [-707, -327]];   // on the Marathon's forecourt, clear of its walls
const Gas = {
  fill: null,   // { car, t } while a car is being filled
  nozzle: 0,    // 0 = in the holster, 1 = out
  pumps: [],
  build() {
    for (const [x, z] of PUMPS) {
      const grp = new THREE.Group(); grp.position.set(x, terrainY(x, z), z); scene.add(grp);
      const body = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xb3262e })); body.scale.set(.9, 1.5, .5); body.castShadow = true;
      const screen = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0x9ff7b0 })); screen.scale.set(.6, .25, .02); screen.position.set(0, 1.15, .26);
      const head = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x222222 })); head.scale.set(.5, .3, .5); head.position.y = 1.5;
      grp.add(body, screen, head); this.pumps.push({ grp, head, screen });
    }
  },
  near(x, z, r = 6) { return PUMPS.some(([px, pz]) => Math.hypot(px - x, pz - z) < r); },
  // E in a car: if it is stopped at a pump and the tank is not full, start a fill (true); otherwise false and E does its usual job
  tryFill(car) {
    if (!car || this.fill || car.fuel >= .999 || Math.abs(car.v) > .5 || !this.near(car.x, car.z)) return !!this.fill && this.fill.car === car;
    Econ.act('gas.fill', { done: r => { if (r.ok && car === Vehicles.player && !this.fill) { this.fill = { car, t: 0 }; toast('Filling up…', 'info'); } } });
    return true;
  },
  // the player's car is at a pump and could be filled (for the driving prompt)
  canFill(car) { return !!car && car.fuel < .999 && Math.abs(car.v) < .5 && this.near(car.x, car.z); },
  update(dt, now) {
    const F = this.fill;
    if (F) {
      if (F.car !== Vehicles.player || !this.near(F.car.x, F.car.z)) { this.fill = null; toast('Fill stopped: stay beside the pump', 'bad'); }
      else { F.t += dt; F.car.fuel = Math.min(1, F.car.fuel + dt / FILL_S); if (F.car.fuel >= 1) { this.fill = null; toast('Tank full', 'info'); } }
    }
    this.nozzle += ((this.fill ? 1 : 0) - this.nozzle) * Math.min(1, dt * 4);
    const blink = this.fill && Math.floor(now / 300) % 2;
    for (const p of this.pumps) { p.head.position.y = 1.5 - this.nozzle * .3; p.screen.material.color.set(blink ? 0xffe066 : 0x9ff7b0); }
  },
};
