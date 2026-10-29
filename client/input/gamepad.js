/* ---------------- Xbox / standard gamepad (Gamepad API) ---------------- */
// the Xbox badge for a button name; hints get their glyphs from Input.glyph (actions.js)
const XB = n => `<kbd class="xb xb-${{ A: 'a', B: 'b', X: 'x', Y: 'y' }[n] || 'n'}">${n}</kbd>`;
const setPadMode = on => Input.setDevice(on ? 'pad' : 'kbm');
const Pad = {
  x: 0, y: 0, lx: 0, ly: 0, btn: [], prev: [], connected: false,   // btn: the buttons held this frame, read by Input.held
  dz: v => Math.abs(v) < 0.15 ? 0 : Math.sign(v) * (Math.abs(v) - 0.15) / 0.85,
  poll(dt) {
    const gp = [...(navigator.getGamepads ? navigator.getGamepads() : [])].find(g => g && g.connected);
    const cur = gp ? gp.buttons.map(x => x.pressed) : [], prev = this.prev, b = i => !!cur[i], down = i => b(i) && !prev[i];
    if (gp && (gp.buttons.some(x => x.pressed) || gp.axes.some(a => Math.abs(a) > 0.3))) setPadMode(true);
    this.prev = cur; this.btn = [];
    this.x = this.y = this.lx = this.ly = 0;
    if (!gp) return;
    if (!started) {   // the intro card: A presses the focused button (ENTER when none is focused), B backs out of a sign-in form
      if (down(1) && !$('authForm').hidden) $('authBack').click();
      else if (down(0) || down(9)) { const a = document.activeElement; (a && a.tagName === 'BUTTON' && a.closest('#intro') ? a : $('go')).click(); }
      return;
    }
    if (newsOpen) { if (down(0) || down(1) || down(9)) closeNews(); return; }
    // the account panel or the chat box is open, or a text box has focus: B closes the panel, and the pad does not drive the player
    if (acctOpen || chatOpen || document.activeElement?.matches?.('input,textarea,[contenteditable]')) {
      if (down(1)) { if (acctOpen) Account.closePanel(); else if (chatOpen) Chat.close(); }
      return;
    }
    if (mapOpen) {
      const mx = this.dz(gp.axes[0] || 0) + this.dz(gp.axes[2] || 0) + (b(15) ? 1 : 0) - (b(14) ? 1 : 0), mz = this.dz(gp.axes[1] || 0) + this.dz(gp.axes[3] || 0) + (b(13) ? 1 : 0) - (b(12) ? 1 : 0);
      const sp = 0.45 * dt * (b(4) || b(5) ? 2.2 : 1);   // fraction of the map per second; hold LB/RB for faster
      mapCur.fx = Math.max(0, Math.min(1, mapCur.fx + mx * sp)); mapCur.fz = Math.max(0, Math.min(1, mapCur.fz + mz * sp));
      if (Input.device === 'pad') { $('padcur').hidden = false; placePadCur(); }
      if (down(0)) mapTeleport(mapCur.fx, mapCur.fz);
      else if (down(8) || down(1)) toggleMap(false);
      return;
    }
    this.btn = cur;   // the game is running: held buttons drive the player through Input.held
    if (down(9)) fsToggle(true);
    if (down(14)) Chat.open();   // D-pad left opens the chat box
    const ax = this.dz(gp.axes[0] || 0), ay = this.dz(gp.axes[1] || 0), rx = this.dz(gp.axes[2] || 0), ry = this.dz(gp.axes[3] || 0);
    this.lx = ax; this.ly = ay;
    yaw -= Math.sign(rx) * rx * rx * 3.0 * dt; pitch = Math.max(-1.55, Math.min(1.55, pitch - Math.sign(ry) * ry * ry * 2.2 * dt));
    if (Vehicles.player) {   // driving: RT gas, LT brake/reverse, A handbrake (Input.held('handbrake'))
      this.lastA = 0; this.x = ax; this.y = (gp.buttons[7]?.value || 0) - (gp.buttons[6]?.value || 0);
      if (down(1) || down(2)) onKey('KeyE', false, true);
      if (down(3)) onKey('KeyV', false, true);
      if (down(5)) onKey('KeyH', false, true);
      if (down(4)) onKey('KeyL', false, true);
      if (down(8)) onKey('KeyM', false, true);
    } else {                 // on foot: A jump, B descend, LB/LS run (held through Input.held)
      this.x = ax; this.y = -ay;
      if (down(2)) onKey('KeyE', false, true);
      if (down(3)) onKey('KeyF', false, true);
      if (down(0)) { const t = performance.now(); if (t - (this.lastA || 0) < 300) { onKey('KeyF', false, true); this.lastA = 0; } else this.lastA = t; }   // double-tap A flies (A still jumps)
      if (down(8)) onKey('KeyM', false, true);
      if (down(12)) onKey('KeyL', false, true);
      if (down(13)) onKey('KeyN', false, true);
    }
  },
  rumble(ms, strong) { try { const gp = [...(navigator.getGamepads ? navigator.getGamepads() : [])].find(g => g && g.connected); const p = gp?.vibrationActuator?.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: strong / 2 }); if (p && p.catch) p.catch(() => { }); } catch (e) { } },
};
addEventListener('gamepadconnected', () => { Pad.connected = true; toast('🎮 Controller connected: X use · Y fly · A jump · LB run · View map'); });
addEventListener('gamepaddisconnected', () => { Pad.connected = false; toast('🎮 Controller disconnected'); });
// the starting device: a touch screen starts on touch, anything else on keyboard and mouse
Input.device = isTouch ? 'touch' : 'kbm'; Input.sync();
