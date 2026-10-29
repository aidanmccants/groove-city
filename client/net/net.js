/* ---------------- multiplayer: the Worker relays positions; names are random and assigned by the server ---------------- */
const remotes = new Map(); let netSock = null, myId = null, myName = '', netRetries = 0, netSentAt = 0, netSent = null, netOff = false;
const SHIRTS = ['#c0392b', '#2e86c1', '#28b463', '#f1c40f', '#8e44ad', '#ecf0f1', '#e67e22', '#16a085'];
const limbGeo = (() => { const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, -.5, 0); return g; })();   // pivots at the hip or shoulder
function nameTag(text) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const g = cv.getContext('2d');
  g.fillStyle = 'rgba(20,22,26,.75)'; g.fillRect(4, 10, 248, 44);
  g.fillStyle = '#fff'; g.font = '600 30px "Barlow Semi Condensed", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 33);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog: false }));
  sp.scale.set(3.2, .8, 1); sp.position.y = 2.3; return sp;
}
function makeAvatar(name, id) {
  const shirt = SHIRTS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % SHIRTS.length], skin = '#e8b896', pants = '#2b3a55';
  const g = new THREE.Group(), mat = c => new THREE.MeshLambertMaterial({ color: c });
  const limb = (sx, sy, sz, c, x, y) => { const m = new THREE.Mesh(limbGeo, mat(c)); m.scale.set(sx, sy, sz); m.position.set(x, y, 0); g.add(m); return m; };
  const part = (sx, sy, sz, c, y) => { const m = new THREE.Mesh(boxGeo, mat(c)); m.scale.set(sx, sy, sz); m.position.y = y; g.add(m); };
  const legL = limb(.2, .85, .22, pants, -.12, .85), legR = limb(.2, .85, .22, pants, .12, .85);
  const armL = limb(.14, .7, .16, shirt, -.33, 1.5), armR = limb(.14, .7, .16, shirt, .33, 1.5);
  part(.5, .68, .28, shirt, .85); part(.32, .32, .32, skin, 1.55); part(.34, .1, .34, '#3a2a1e', 1.85);
  const tag = nameTag(name); g.add(tag);
  return { g, legL, legR, armL, armR, tag };
}
function remoteFor(p) {
  let r = remotes.get(p.id);
  if (!r) {
    r = { ...makeAvatar(p.name, p.id), name: p.name, seen: false, x: 0, y: 0, z: 0, yaw: 0, tx: 0, ty: 0, tz: 0, tyaw: 0, walk: 0, v: -1, cy: 0, f: 0, car: null };
    r.g.visible = false; scene.add(r.g); remotes.set(p.id, r);
  }
  return r;
}
// a visitor is shown once their first position arrives
function applyMove(p) {
  const r = remoteFor(p);
  r.tx = p.x; r.ty = p.y; r.tz = p.z; r.tyaw = p.yaw;
  r.v = Number.isInteger(p.v) && p.v >= 0 && p.v < Vehicles.parked ? p.v : -1; r.cy = +p.cy || 0; r.f = p.f | 0;   // the car they are driving, its heading, lights/siren
  if (!r.seen) { r.seen = true; r.x = p.x; r.y = p.y; r.z = p.z; r.yaw = p.yaw; r.g.visible = true; updateOnline(); }
}
function dropRemote(id) {
  const r = remotes.get(id); if (!r) return;
  Bank.release(id);   // cops chasing them go back to patrol
  if (r.car && r.car.kind === 'remote') { r.car.kind = 'parked'; r.car.v = 0; r.car.flash = false; Vehicles.setFlash(r.car, false); Vehicles.setBrake(r.car, false); }   // the Worker parks it where they left it
  scene.remove(r.g); r.g.traverse(o => { if (o.material) { o.material.map?.dispose(); o.material.dispose(); } });
  remotes.delete(id);
}
function updateRemotes(dt) {
  const k = Math.min(1, dt * 10);   // ease toward the last received position
  for (const r of remotes.values()) {
    if (!r.seen) continue;
    const px = r.x, pz = r.z, dyaw = Math.atan2(Math.sin(r.tyaw - r.yaw), Math.cos(r.tyaw - r.yaw));
    r.x += (r.tx - r.x) * k; r.y += (r.ty - r.y) * k; r.z += (r.tz - r.z) * k; r.yaw += dyaw * k;
    const sp = Math.hypot(r.x - px, r.z - pz) / Math.max(dt, 1e-3);
    r.walk += dt * 9 * Math.min(1, sp / 3);
    const sw = Math.sin(r.walk) * .6 * Math.min(1, sp / 2);
    const car = r.v >= 0 ? Vehicles.list[r.v] : null;
    if (r.car && r.car !== car && r.car.kind === 'remote') { r.car.v = 0; r.car.flash = false; Vehicles.setFlash(r.car, false); Vehicles.setBrake(r.car, false); }
    r.car = car && car !== Vehicles.player ? car : null;
    if (r.car) {   // driving: move their car instead of the avatar
      const c = r.car, jump = c.kind !== 'remote' || Math.hypot(c.x - r.x, c.z - r.z) > 15; c.kind = 'remote';
      const dh = wrapA(r.cy - c.h); c.h = jump ? r.cy : c.h + dh * k; c.x = r.x; c.z = r.z;
      c.v = sp * (Math.cos(Math.atan2(r.x - px, r.z - pz) - c.h) < 0 ? -1 : 1); c.flash = !!(r.f & 1); Vehicles.setBrake(c, !!(r.f & 4));
      Vehicles.pose(c, jump); Vehicles.place(c);
    }
    r.g.visible = !r.car;
    r.g.position.set(r.x, r.y, r.z); r.g.rotation.y = r.yaw + Math.PI;   // the player's forward is (-sin yaw, -cos yaw)
    r.legL.rotation.x = sw; r.legR.rotation.x = -sw; r.armL.rotation.x = -sw; r.armR.rotation.x = sw;
    r.tag.visible = Math.hypot(r.x - P.x, r.z - P.z) < 120;
  }
}
function sendMove(now) {
  if (!netSock || netSock.readyState !== 1 || now - netSentAt < 120) return;   // at most about 8 updates a second
  if (now - (netSent?.ping || 0) > 30000) { netSock.send(JSON.stringify({ t: 'ping', c: Date.now() })); if (netSent) netSent.ping = now; }   // keep the shared clock honest
  const c = Vehicles.player, f = c ? (Vehicles.lights || (c.cop && Vehicles.siren) ? 1 : 0) | (Vehicles.siren ? 2 : 0) | (Vehicles.braking ? 4 : 0) : 0, cy = c ? c.h : 0;
  const moved = !netSent || Math.hypot(P.x - netSent.x, P.z - netSent.z) > .02 || Math.abs(P.y - netSent.y) > .02 || Math.abs(yaw - netSent.yaw) > .01 || (c ? c.id : -1) !== netSent.v || Math.abs(cy - netSent.cy) > .01 || f !== netSent.f;
  if (!moved && now - netSentAt < 4000) return;   // standing still: a keep-alive every 4 s
  netSentAt = now; netSent = { x: P.x, y: P.y, z: P.z, yaw, v: c ? c.id : -1, cy, f, ping: netSent?.ping || now };
  const m = { t: 'move', x: +P.x.toFixed(2), y: +P.y.toFixed(2), z: +P.z.toFixed(2), yaw: +yaw.toFixed(3) };
  if (c) { m.v = c.id; m.cy = +cy.toFixed(3); m.f = f; }
  netSock.send(JSON.stringify(m));
}
function onNet(m) {
  if (m.t === 'welcome') {
    myId = m.id; myName = m.name; if (typeof m.now === 'number') { clockOffset = m.now - Date.now(); clockRtt = 1e9; }
    if (m.cars) Vehicles.applyServer(m.cars);
    if (m.vault) Bank.onVault(m.vault);
    for (const p of m.players) applyMove(p);
    if (Vehicles.player) netSock.send(JSON.stringify({ t: 'take', id: Vehicles.player.id }));   // reconnected mid-drive: claim the car again
    netSock.send(JSON.stringify({ t: 'ping', c: Date.now() })); sendMove(performance.now());
  }
  else if (m.t === 'pong') { const rtt = Date.now() - m.c; if (rtt >= 0 && rtt < clockRtt + 50) { clockRtt = Math.min(clockRtt, rtt); clockOffset = m.now + rtt / 2 - Date.now(); } return; }
  else if (m.t === 'car') { Vehicles.onCar(m); return; }
  else if (m.t === 'took' || m.t === 'deny') { Vehicles.onTake(m); return; }
  else if (m.t === 'evt') { Vehicles.onEvt(m); return; }
  else if (m.t === 'vault') { Bank.onVault(m); return; }
  else if (m.t === 'attrs') { Profile.server(m.a); if (m.act) Econ.answered(m); return; }   // the account's money; after an act, its answer
  else if (m.t === 'join') { const r = remoteFor(m); if (r.name !== m.name) renameRemote(r, m.name); }   // a renamed account reconnects with its new name
  else if (m.t === 'move') { applyMove(m); return; }
  else if (m.t === 'leave') dropRemote(m.id);
  else if (m.t === 'chat') { Chat.onMsg(m); return; }
  else if (m.t === 'full') { netOff = true; return updateOnline('The campus is full right now. Try again in a bit.'); }
  updateOnline();
}
function connectNet() {
  if (netSock || netOff) return;
  if (!/^https?:$/.test(location.protocol)) { netOff = true; return updateOnline('Single player: open the Worker URL to meet others'); }
  Econ.dropPending();   // answers to acts on an earlier socket never come
  let sock;
  try { sock = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws'); }
  catch (e) { netOff = true; return updateOnline('Single player: multiplayer is unavailable here'); }
  netSock = sock; updateOnline('Connecting to campus…');
  let opened = false;
  sock.onopen = () => { opened = true; netRetries = 0; updateOnline(); };
  sock.onmessage = e => { try { onNet(JSON.parse(e.data)); } catch (err) { console.error(err); } };
  sock.onclose = async e => {
    if (netSock !== sock) return;   // dropped on purpose (kickAndReset, reconnectNet) or replaced
    netSock = null; netSent = null; for (const id of [...remotes.keys()]) dropRemote(id); Chat.sync(); Econ.dropPending();
    if (e.code === 4000) {   // the same account opened another tab: this one stays disconnected
      netOff = true; const msg = 'Signed in in another tab — this one is disconnected';
      toast(msg, 'bad'); return updateOnline(msg);
    }
    if (netOff) return;
    if (!opened && await Account.sessionEnded()) { netOff = true; return updateOnline('Session expired — reload to sign in'); }
    if (++netRetries > 5) { netOff = true; return updateOnline('Offline: could not reach the campus server'); }
    updateOnline('Reconnecting…'); setTimeout(connectNet, Math.min(15000, 1000 * 2 ** netRetries));
  };
}
// closes this browser's connection and opens a new one, so the room shows the account's current name (after a save)
function reconnectNet() {
  const s = netSock; netSock = null; netSent = null;
  if (s) { try { s.close(1000, 'renamed'); } catch (e) { } }
  connectNet();
}
// a remote player's name tag, when the room gives them a new name
function renameRemote(r, name) {
  r.g.remove(r.tag); r.tag.material.map?.dispose(); r.tag.material.dispose();
  r.tag = nameTag(name); r.g.add(r.tag); r.name = name;
}
function updateOnline(note) {
  Chat.sync();
  const el = $('online'); if (!el) return;
  el.hidden = false;
  const others = [...remotes.values()].filter(r => r.seen).length;
  el.textContent = note || (myName ? `● ${others + 1} online · you are ${myName}` : 'Connecting to campus…');
}

