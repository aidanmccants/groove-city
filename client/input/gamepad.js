/* ---------------- Xbox / standard gamepad (Gamepad API) ---------------- */
// which input the player used last: hints show Xbox buttons after a controller, keys after a keyboard or mouse
let usingPad = false;
const XB = n => `<kbd class="xb xb-${{ A: 'a', B: 'b', X: 'x', Y: 'y' }[n] || 'n'}">${n}</kbd>`;
const KB = (key, pad) => usingPad ? XB(pad) : `<kbd>${key}</kbd>`;
const USE = () => usingPad ? XB('X') : '<kbd>E</kbd> or click';   // the "use" action in hints
const KEY_KEYS_HTML = $('keys').innerHTML;
const PAD_KEYS_HTML = `<span>${XB('LS')}move</span><span>${XB('RS')}look</span><span>${XB('LB')}run</span><span>${XB('A')}jump (double-tap: fly)</span><span>${XB('Y')}fly</span><span>${XB('View')}map</span><span>${XB('↓')}time of day</span><span>${XB('↑')}labels</span><span>${XB('X')}serve / get in a car</span><span>${XB('Menu')}fullscreen</span>`;
function setPadMode(on) {
  if (on === usingPad) return; usingPad = on; document.body.classList.toggle('pad', on);
  $('keys').innerHTML = on ? PAD_KEYS_HTML : KEY_KEYS_HTML;
  $('maphelp').textContent = on ? 'Left stick to aim · A to teleport · B to close' : 'Click to teleport · M or Esc to close';
  $('padcur').hidden = !(on && mapOpen); if (on && mapOpen) placePadCur();
}
const Pad = {
  x: 0, y: 0, lx: 0, ly: 0, held: new Set(), prev: [], connected: false,
  dz: v => Math.abs(v) < 0.15 ? 0 : Math.sign(v) * (Math.abs(v) - 0.15) / 0.85,
  sync(want) { for (const c of want) keys.add(c); for (const c of this.held) if (!want.has(c)) keys.delete(c); this.held = want; },   // keys the pad holds this frame
  poll(dt) {
    const gp = [...(navigator.getGamepads ? navigator.getGamepads() : [])].find(g => g && g.connected);
    const b = i => !!(gp && gp.buttons[i] && gp.buttons[i].pressed), prev = this.prev, down = i => b(i) && !prev[i];
    if (gp && (gp.buttons.some(x => x.pressed) || gp.axes.some(a => Math.abs(a) > 0.3))) setPadMode(true);
    this.prev = gp ? gp.buttons.map(x => x.pressed) : [];
    this.x = this.y = this.lx = this.ly = 0;
    if (!gp) { this.sync(new Set()); return; }
    if (!started) { if (down(0) || down(9)) $('go').click(); this.sync(new Set()); return; }
    if (newsOpen) { if (down(0) || down(1) || down(9)) closeNews(); this.sync(new Set()); return; }
    if (mapOpen) {
      const mx = this.dz(gp.axes[0] || 0) + this.dz(gp.axes[2] || 0) + (b(15) ? 1 : 0) - (b(14) ? 1 : 0), mz = this.dz(gp.axes[1] || 0) + this.dz(gp.axes[3] || 0) + (b(13) ? 1 : 0) - (b(12) ? 1 : 0);
      const sp = 0.45 * dt * (b(4) || b(5) ? 2.2 : 1);   // fraction of the map per second; hold LB/RB for faster
      mapCur.fx = Math.max(0, Math.min(1, mapCur.fx + mx * sp)); mapCur.fz = Math.max(0, Math.min(1, mapCur.fz + mz * sp));
      if (usingPad) { $('padcur').hidden = false; placePadCur(); }
      if (down(0)) mapTeleport(mapCur.fx, mapCur.fz);
      else if (down(8) || down(1)) toggleMap(false);
      this.sync(new Set()); return;
    }
    if (down(9)) fsToggle(true);
    const ax = this.dz(gp.axes[0] || 0), ay = this.dz(gp.axes[1] || 0), rx = this.dz(gp.axes[2] || 0), ry = this.dz(gp.axes[3] || 0);
    this.lx = ax; this.ly = ay;
    yaw -= Math.sign(rx) * rx * rx * 3.0 * dt; pitch = Math.max(-1.55, Math.min(1.55, pitch - Math.sign(ry) * ry * ry * 2.2 * dt));
    const want = new Set();
    if (Vehicles.player) {   // driving: RT gas, LT brake/reverse, A handbrake
      this.lastA = 0; this.x = ax; this.y = (gp.buttons[7]?.value || 0) - (gp.buttons[6]?.value || 0);
      if (b(0)) want.add('Space');
      if (down(1) || down(2)) onKey('KeyE', false, true);
      if (down(3)) onKey('KeyV', false, true);
      if (down(5)) onKey('KeyH', false, true);
      if (down(4)) onKey('KeyL', false, true);
      if (down(8)) onKey('KeyM', false, true);
    } else {                 // on foot
      this.x = ax; this.y = -ay;
      if (b(0)) want.add('Space');
      if (b(1)) want.add('KeyC');
      if (b(4) || b(10)) want.add('ShiftLeft');
      if (down(2)) onKey('KeyE', false, true);
      if (down(3)) onKey('KeyF', false, true);
      if (down(0)) { const t = performance.now(); if (t - (this.lastA || 0) < 300) { onKey('KeyF', false, true); this.lastA = 0; } else this.lastA = t; }   // double-tap A flies (A still jumps)
      if (down(8)) onKey('KeyM', false, true);
      if (down(12)) onKey('KeyL', false, true);
      if (down(13)) onKey('KeyN', false, true);
    }
    this.sync(want);
  },
  rumble(ms, strong) { try { const gp = [...(navigator.getGamepads ? navigator.getGamepads() : [])].find(g => g && g.connected); const p = gp?.vibrationActuator?.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: strong / 2 }); if (p && p.catch) p.catch(() => { }); } catch (e) { } },
};
addEventListener('gamepadconnected', () => { Pad.connected = true; toast('🎮 Controller connected: X use · Y fly · A jump · LB run · View map'); });
addEventListener('gamepaddisconnected', () => { Pad.connected = false; toast('🎮 Controller disconnected'); });

