/* ---------------- car engines: your car revs with the throttle; the nearest moving cars hum from where they are ---------------- */
const Engine = {
  rev: 0, voices: null, scanT: 0,
  init(ac) {
    this.voices = [];
    for (let i = 0; i < 6; i++) {   // voice 0 is your own car (not panned); the rest follow the nearest moving cars
      const o = ac.createOscillator(), lp = ac.createBiquadFilter(), g = ac.createGain(), pan = i ? Mix.panner(ac) : null;
      o.type = 'sawtooth'; lp.type = 'lowpass'; lp.frequency.value = 600; g.gain.value = 0;
      o.connect(lp); lp.connect(g); g.connect(pan || ac.destination); o.start();
      this.voices.push({ o, g, pan, car: null });
    }
  },
  set(ac, v, hz, gain) { v.o.frequency.setTargetAtTime(hz, ac.currentTime, .08); v.g.gain.setTargetAtTime(gain, ac.currentTime, .15); },
  update(dt, now) {
    const ac = Rail.ac; if (!ac || ac.state !== 'running') return;
    if (!this.voices) this.init(ac);
    const me = Vehicles.player, fuel = !!me && me.fuel > 0;
    // your own engine: idle, then a rev while the throttle is held (no fuel, no sound)
    this.rev += ((fuel && Input.held('forward') && !Vehicles.frozen ? 1 : 0) - this.rev) * Math.min(1, dt * 3);
    if (fuel) this.set(ac, this.voices[0], 34 + Math.abs(me.v) * 2.6 + this.rev * 46, .028);
    else this.set(ac, this.voices[0], 34, 0);
    // every half second, the five nearest moving cars (not yours) take the other voices
    if ((this.scanT -= dt) <= 0) {
      this.scanT = .5;
      const near = [];
      for (const c of Vehicles.list) if (c !== me && Math.abs(c.v) > .5) { const d = Math.hypot(c.x - P.x, c.z - P.z); if (d < 90) near.push([d, c]); }
      near.sort((a, b) => a[0] - b[0]);
      for (let i = 1; i < this.voices.length; i++) this.voices[i].car = near[i - 1] ? near[i - 1][1] : null;
    }
    for (let i = 1; i < this.voices.length; i++) {
      const v = this.voices[i], c = v.car;
      if (!c) { this.set(ac, v, 34, 0); continue; }
      Mix.place(v.pan, c.x, 1, c.z);
      this.set(ac, v, 34 + Math.abs(c.v) * 2.6, .02);
    }
  },
};
