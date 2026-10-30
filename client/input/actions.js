/* ---------------- input actions: keyboard+mouse, touch and gamepad all drive the same actions ---------------- */
// device: 'kbm' | 'pad' | 'touch' (the last one used); hints call Input.glyph(action) so they always show the right button
const BIND = {
  // action:   keyboard codes                 pad buttons (standard mapping)   label shown on touch
  forward:  { key: ['KeyW', 'ArrowUp'] },                                      // pad: the left stick (Input.axis)
  back:     { key: ['KeyS', 'ArrowDown'] },
  left:     { key: ['KeyA', 'ArrowLeft'] },
  right:    { key: ['KeyD', 'ArrowRight'] },
  jump:     { key: ['Space'], pad: [0], touch: '▲' },                          // jump / rise while flying
  down:     { key: ['KeyC', 'ControlLeft'], pad: [1] },                        // descend while flying (on foot)
  run:      { key: ['ShiftLeft', 'ShiftRight'], pad: [4, 10] },
  use:      { key: ['KeyE'], pad: [2], touch: 'USE', mouse: 'click' },
  fly:      { key: ['KeyF'], pad: [3], touch: 'FLY' },                         // pad: double-tap A also flies (gamepad.js)
  map:      { key: ['KeyM'], pad: [8], touch: 'MAP' },
  chat:     { key: ['KeyT', 'Enter'], pad: [14], touch: '💬' },                  // opens the chat box (typing uses the on-screen or OS keyboard)
  labels:   { key: ['KeyL'], pad: [12] },
  guide:    { key: ['KeyG'] },                                                // What to do (the ? button on screen)
  exit:     { key: ['KeyE', 'KeyF'], pad: [1, 2], touch: 'EXIT' },             // in a car
  camera:   { key: ['KeyV', 'KeyC'], pad: [3], touch: 'USE' },                 // in a car
  siren:    { key: ['KeyH'], pad: [5], touch: 'SIREN' },                       // in a police car
  lights:   { key: ['KeyL'], pad: [4] },                                       // in a police car (L is labels otherwise)
  handbrake: { key: ['Space'], pad: [0] },                                     // in a car
  gas:      { pad: [7] }, brake: { pad: [6] },                                 // in a car: RT / LT
  fullscreen: { pad: [9] },
  back_ui:  { key: ['Escape', 'Enter'], pad: [1] },                            // close the map or the news
};
const PADNAME = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'LS', 'RS', '↑', '↓', '←', '→'];   // by button index
const KEYNAME = { Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Ctrl', Escape: 'Esc', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
const keyName = c => KEYNAME[c] || c.replace(/^Key/, '');
// the #keys chip: keyboard and pad share this list (keysChipHTML adds each device's own extras)
const KEYS_CHIP = [['forward', 'walk'], ['run', 'run'], ['jump', 'jump'], ['fly', 'fly'], ['map', 'map'], ['chat', 'chat'], ['guide', 'what to do'], ['labels', 'labels'], ['use', 'serve / get in a car']];
const Input = {
  device: 'kbm',
  // a bound key is down, or the pad holds a bound button (Pad.btn is empty outside the game), or for jump the on-screen ▲
  held(a) {
    const b = BIND[a];
    return (b.key || []).some(c => keys.has(c)) || (b.pad || []).some(i => !!Pad.btn[i]) || (a === 'jump' && touchUp);
  },
  // on foot or in a car: keys, the on-screen stick and the gamepad stick, clamped to [-1, 1]
  axis() {
    const h = a => this.held(a) ? 1 : 0, c = v => Math.max(-1, Math.min(1, v));
    return { x: c(h('right') - h('left') + joy.x + Pad.x), y: c(h('forward') - h('back') + joy.y + Pad.y) };
  },
  // the button for an action on a device (default: the one in use); 'bare' is just the first key or button, for chips and car hints
  glyph(a, ctx, dev = this.device) {
    const b = BIND[a], ks = b.key || [];
    if (dev === 'touch' && b.touch) return a === 'use' ? 'Tap' : `<kbd>${b.touch}</kbd>`;
    if (dev === 'pad' && b.pad) return XB(PADNAME[b.pad[0]]);
    if (!ks.length) return '';
    const names = [...new Set((ctx === 'bare' ? ks.slice(0, 1) : ks).map(keyName))].join('/');
    return `<kbd>${names}</kbd>` + (b.mouse && ctx !== 'bare' ? ` or ${b.mouse}` : '');
  },
  setDevice(d) { if (d !== this.device) { this.device = d; this.sync(); } },
  // the page follows the device: body classes, the #keys chip, the map's help line and the pad cursor
  sync() {
    const pad = this.device === 'pad';
    document.body.classList.toggle('pad', pad); document.body.classList.toggle('touch', this.device === 'touch');
    $('keys').innerHTML = keysChipHTML();
    $('maphelp').textContent = pad ? 'Left stick to aim · A to teleport · B to close' : 'Click to teleport · M or Esc to close';
    $('padcur').hidden = !(pad && mapOpen); if (pad && mapOpen) placePadCur();
  },
};
// one list, two devices: the keyboard shows WASD and Esc, the pad shows its sticks and Menu
function keysChipHTML() {
  const pad = Input.device === 'pad', dev = pad ? 'pad' : 'kbm', items = [];
  for (const [a, label] of KEYS_CHIP) {
    if (a !== 'forward') items.push(Input.glyph(a, 'bare', dev) + (pad && a === 'jump' ? 'jump (double-tap: fly)' : label));
    else if (pad) items.push(`${XB('LS')}move`, `${XB('RS')}look`); else items.push('<kbd>WASD</kbd>walk');
  }
  items.push(pad ? `${Input.glyph('fullscreen', 'bare', dev)}fullscreen` : `${Input.glyph('back_ui', 'bare', dev)}free mouse`);
  return items.map(t => `<span>${t}</span>`).join('');
}
// a touch sets the 'touch' device; the mouse events a tap fires after it must not switch back to kbm
let touchAt = -1e9;
addEventListener('pointerdown', e => { if (e.pointerType === 'touch') { touchAt = performance.now(); Input.setDevice('touch'); } }, true);
function kbmInput() { if (performance.now() - touchAt > 1000) Input.setDevice('kbm'); }   // a real mouse move or click
