/* ---------------- sirens (WebAudio, on Rail's audio context) ---------------- */
const Siren = {
  wail(secs = 2.4, vol = .05, x, z) {   // a short whoop-whoop for a pull-over; (x, z) makes it come from that car, quieter with distance
    const ac = Rail.ac; if (!ac || ac.state !== 'running') return; const t0 = ac.currentTime, out = Mix.node(x, z);
    const o = ac.createOscillator(), g = ac.createGain(); o.type = 'square'; g.gain.value = vol; o.connect(g); g.connect(out);
    for (let s = 0; s < secs; s += .6) { o.frequency.setValueAtTime(620, t0 + s); o.frequency.linearRampToValueAtTime(1350, t0 + s + .3); o.frequency.linearRampToValueAtTime(620, t0 + s + .6); }
    g.gain.setValueAtTime(vol, t0 + secs - .1); g.gain.linearRampToValueAtTime(0, t0 + secs); o.start(t0); o.stop(t0 + secs + .05);
  },
  update(on) {   // the player's own siren: a two-tone wail while it is on
    const ac = Rail.ac; if (!ac || ac.state !== 'running') return;
    if (on && !this.o) {
      this.o = ac.createOscillator(); this.g = ac.createGain(); this.lfo = ac.createOscillator(); const lg = ac.createGain();
      this.o.type = 'sawtooth'; this.o.frequency.value = 900; this.lfo.frequency.value = .35; lg.gain.value = 380; this.lfo.connect(lg); lg.connect(this.o.frequency);
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; this.g.gain.value = .035; this.o.connect(lp); lp.connect(this.g); this.g.connect(ac.destination);
      this.o.start(); this.lfo.start();
    } else if (!on && this.o) this.stop();
  },
  stop() { if (this.o) { try { this.o.stop(); this.lfo.stop(); } catch (e) { } this.o = this.lfo = this.g = null; } },
};
