/* ---------------- input ---------------- */
let started = false, mapOpen = false;
const locked = () => document.pointerLockElement === canvas;
function lockPointer() { if (!isTouch && canvas.requestPointerLock && !locked()) { try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => { }); } catch (e) { } } }
canvas.addEventListener('click', () => {
  if (!started || mapOpen || newsOpen) return;
  if (!locked()) { if (isTouch && CFA.onShift) CFA.serve(); else if (isTouch && Bank.canSmash()) Bank.smash(); else if (!(isTouch && !Vehicles.player && Vehicles.tryEnter())) lockPointer(); }
  else if (CFA.onShift) CFA.serve();
  else if (Bank.canSmash()) Bank.smash();
  else if (!Vehicles.player) Vehicles.tryEnter();
});
let drag = null;
canvas.addEventListener('mousedown', e => { kbmInput(); if (!locked()) drag = [e.clientX, e.clientY]; });
addEventListener('mouseup', () => drag = null);
addEventListener('mousemove', e => {
  if (Math.abs(e.movementX) + Math.abs(e.movementY) > 2) kbmInput();
  if (!started || mapOpen || newsOpen) return;
  let dx = 0, dy = 0;
  if (locked()) { dx = e.movementX; dy = e.movementY; } else if (drag) { dx = e.clientX - drag[0]; dy = e.clientY - drag[1]; drag = [e.clientX, e.clientY]; } else return;
  yaw -= dx * 0.0022; pitch = Math.max(-1.55, Math.min(1.55, pitch - dy * 0.0022));
});
addEventListener('keydown', e => {
  Input.setDevice('kbm');
  if (!started) return;
  if (newsOpen) { if (e.code === 'Escape' || e.code === 'Enter') { e.preventDefault(); closeNews(); } return; }
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  onKey(e.code, e.repeat);
});
// every key press lives here; the gamepad calls it too with fromPad set (its held buttons reach Input.held instead)
function onKey(code, repeat, fromPad) {
  if (!fromPad) keys.add(code);
  if (Vehicles.player) {   // driving: E/F get out, C/V camera, H siren and L lights in a police car
    const cop = Vehicles.player.cop;
    if ((code === 'KeyE' || code === 'KeyF') && !repeat) Vehicles.exit();
    else if ((code === 'KeyC' || code === 'KeyV') && !repeat) Vehicles.toggleCam();
    else if (code === 'KeyH' && cop && !repeat) { Vehicles.siren = !Vehicles.siren; if (Vehicles.siren) Vehicles.lights = true; }
    else if (code === 'KeyL' && cop && !repeat) Vehicles.lights = !Vehicles.lights;
    else if (code === 'KeyL') showLabels = !showLabels;
    if (code === 'KeyM') toggleMap();
    if (code === 'Escape' && mapOpen) toggleMap(false);
    if (code === 'KeyN') cycleTime();
    return;
  }
  if (code === 'KeyF') toggleFly();
  if (code === 'KeyM') toggleMap();
  if (code === 'Escape' && mapOpen) toggleMap(false);
  if (code === 'KeyL') { showLabels = !showLabels; }
  if (code === 'KeyN') cycleTime();
  if (code === 'KeyE' && !repeat) { if (CFA.onShift) CFA.serve(); else if (Bank.canSmash()) Bank.smash(); else Vehicles.tryEnter(); }
}
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
function toggleFly() {
  if (!flying && Bank.wanted) { toast('No flying while the police are after you', 'bad'); return; }
  flying = !flying; V.set(0, 0, 0); $('mode').textContent = flying ? 'FLY' : 'WALK'; }
// map cursor: fx/fz are 0..1 across the map (the same numbers a mouse click gives); the controller moves it
const mapCur = { fx: 0.5, fz: 0.5 };
function placePadCur() { const c = $('bigmap'), w = $('mapwrap'), r = c.getBoundingClientRect(), q = w.getBoundingClientRect(), el = $('padcur'); el.style.left = (r.left - q.left + mapCur.fx * r.width) + 'px'; el.style.top = (r.top - q.top + mapCur.fz * r.height) + 'px'; }
function toggleMap(force) {
  mapOpen = force ?? !mapOpen; $('map').hidden = !mapOpen;
  if (mapOpen) { if (locked()) document.exitPointerLock(); drawBigMap();
    mapCur.fx = Math.max(0, Math.min(1, (P.x + W / 2) / W)); mapCur.fz = Math.max(0, Math.min(1, (P.z + H / 2) / H));
    $('padcur').hidden = Input.device !== 'pad'; placePadCur(); }
  else { const fx = $('bigmapfx'); fx.getContext('2d').clearRect(0, 0, fx.width, fx.height); }
}
function mapTeleport(fx, fz) {
  const x = fx * W - W / 2, z = fz * H - H / 2;
  if (Bank.wanted) { toast('No teleporting while the police are after you', 'bad'); return; }
  teleport(x, z); toggleMap(false);
}
$('bigmap').addEventListener('click', e => { const r = e.target.getBoundingClientRect(); mapTeleport((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); });
$('map').addEventListener('click', e => { if (e.target.id === 'map' || e.target.id === 'mapwrap') toggleMap(false); });
// fullscreen: the ⛶ chip, or the controller's Menu button (pad presses may be refused without a user gesture, so that case says so)
function fsToggle(fromPad) {
  const fail = () => { if (fromPad) toast('Press the ⛶ button for fullscreen', 'info'); };
  try { const p = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen({ navigationUI: 'hide' }); if (p && p.catch) p.catch(fail); }
  catch (e) { fail(); }
}
function syncFsBtn() {
  const el = $('fsbtn'), on = !!document.fullscreenElement;
  el.hidden = !started || !document.fullscreenEnabled; el.textContent = on ? '⤡' : '⛶';
  el.setAttribute('aria-label', on ? 'Exit fullscreen' : 'Enter fullscreen'); el.title = on ? 'Exit fullscreen' : 'Fullscreen';
}
$('fsbtn').addEventListener('click', () => fsToggle(false));
document.addEventListener('fullscreenchange', syncFsBtn);
// touch
const joy = { x: 0, y: 0 }; let touchUp = false, joyId = null, lookId = null, lookLast = null;
const isTouch = matchMedia('(pointer: coarse)').matches;
$('joy').addEventListener('pointerdown', e => { joyId = e.pointerId; e.target.setPointerCapture?.(e.pointerId); moveJoy(e); });
$('joy').addEventListener('pointermove', e => { if (e.pointerId === joyId) moveJoy(e); });
const endJoy = e => { if (e.pointerId === joyId) { joyId = null; joy.x = joy.y = 0; $('joy').firstChild.style.transform = ''; } };
$('joy').addEventListener('pointerup', endJoy); $('joy').addEventListener('pointercancel', endJoy);
function moveJoy(e) { const r = $('joy').getBoundingClientRect(); let dx = (e.clientX - r.left - 60) / 50, dy = (e.clientY - r.top - 60) / 50; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } joy.x = dx; joy.y = -dy; $('joy').firstChild.style.transform = `translate(${dx * 40}px,${dy * 40}px)`; }
canvas.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') { lookId = e.pointerId; lookLast = [e.clientX, e.clientY]; } });
canvas.addEventListener('pointermove', e => { if (e.pointerId === lookId) { yaw -= (e.clientX - lookLast[0]) * 0.005; pitch = Math.max(-1.5, Math.min(1.5, pitch - (e.clientY - lookLast[1]) * 0.005)); lookLast = [e.clientX, e.clientY]; } });
canvas.addEventListener('pointerup', e => { if (e.pointerId === lookId) lookId = null; });
$('tJump').addEventListener('pointerdown', () => touchUp = true); $('tJump').addEventListener('pointerup', () => touchUp = false); $('tJump').addEventListener('pointerleave', () => touchUp = false);
$('tFly').addEventListener('click', () => Vehicles.player ? Vehicles.exit() : toggleFly());
$('tUse').addEventListener('click', () => { if (Vehicles.player) Vehicles.toggleCam(); else if (CFA.onShift) CFA.serve(); else if (Bank.canSmash()) Bank.smash(); else Vehicles.tryEnter(); });
$('tSiren').addEventListener('click', () => { Vehicles.siren = !Vehicles.siren; Vehicles.lights = Vehicles.siren; }); $('tMap').addEventListener('click', () => toggleMap());

