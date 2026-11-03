/* ---------------- background music: a calm loop made as it plays (new chords each bar, a few plucked notes), quiet under everything else ---------------- */
const Music = {
  on: true, bus: null, next: 0, n: 0,
  // the four chords (semitones above C) and the scale the plucked notes come from: C, Am, F, G
  CHORDS: [[0, 4, 7], [9, 0, 4], [5, 9, 0], [7, 11, 2]],
  start() {
    const ac = Rail.ac; if (!ac || this.bus) return;
    try { this.on = localStorage.getItem('gcc.music') !== 'off'; } catch (e) { }
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500; lp.connect(ac.destination);
    this.bus = ac.createGain(); this.bus.gain.value = this.on ? .5 : 0; this.bus.connect(lp);
    this.next = ac.currentTime + .3;
  },
  toggle() {   // the Music button in What to do
    this.on = !this.on;
    try { localStorage.setItem('gcc.music', this.on ? 'on' : 'off'); } catch (e) { }
    if (this.bus) this.bus.gain.setTargetAtTime(this.on ? .5 : 0, Rail.ac.currentTime, .4);
    return this.on;
  },
  tick() {
    const ac = Rail.ac; if (!this.bus || ac.state !== 'running') return;
    if (this.next < ac.currentTime - 1) this.next = ac.currentTime + .1;   // after a stall, carry on from now rather than bunch up
    while (this.next < ac.currentTime + .8) { this.bar(this.next); this.next += 4.8; }
  },
  bar(t) {
    const ch = this.CHORDS[this.n++ % this.CHORDS.length], root = ch[0];
    for (const s of ch) this.note('triangle', NOTE(-12 + s + (Math.random() < .3 ? 12 : 0)), t, 5.5, .05, 1.2);   // pads: root, third, fifth
    for (let k = 0; k < 2; k++) if (Math.random() < .65) {   // plucked notes from the chord's pentatonic, an octave up
      const p = PENTA[Math.floor(Math.random() * PENTA.length)];
      this.note('sine', NOTE(12 + ((root + p) % 12)), t + Math.random() * 4.2, 2.2, .07, .02);
    }
  },
  note(type, f, t, dur, peak, atk) {   // one voice: an attack, then a long fade
    const ac = Rail.ac, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + atk); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g); g.connect(this.bus); o.start(t); o.stop(t + dur + .05);
  },
};
const NOTE = n => 261.63 * Math.pow(2, n / 12);   // n semitones above middle C
const PENTA = [0, 2, 4, 7, 9];
