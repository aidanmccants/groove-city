/* ---------------- HUD ---------------- */
let hudT = 0;
function updateHUD() {
  let best = null;
  for (const l of labels) {
    let d;
    if (pip(P.x, P.z, l.poly)) d = 0; else { d = 1e9; for (let i = 0; i < l.poly.length; i++) { const [qx, qz] = closestOnSeg(P.x, P.z, l.poly[i], l.poly[(i + 1) % l.poly.length]); d = Math.min(d, Math.hypot(P.x - qx, P.z - qz)); } }
    if (!best || d < best[0]) best = [d, l.name];
  }
  const inCampus = D.campus && pip(P.x, P.z, D.campus);
  $('near').textContent = best && best[0] < 45 ? (best[0] < 2 ? 'At ' : 'Near ') + best[1] : (inCampus ? 'On campus' : 'Grove City, PA');
  const lat = D.lat0 - P.z / 110574, lon = D.lon0 + P.x / (111320 * Math.cos(D.lat0 * Math.PI / 180));
  const hd = ((-yaw * 180 / Math.PI) % 360 + 360) % 360, dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  $('coords').textContent = `${lat.toFixed(5)}°N ${(-lon).toFixed(5)}°W · ${Math.round(P.y + D.base)} m elev`;
  $('heading').textContent = `${dirs[Math.round(hd / 45) % 8]} ${Math.round(hd)}°`;
  if (Profile.inDebt()) updateMoney();
  $('clock').textContent = clockText();
  Vehicles.hud(); $('tSiren').hidden = !(isTouch && Vehicles.player && Vehicles.player.cop);
}
const money = v => (v < 0 ? '-$' : '$') + Math.abs(v).toFixed(Math.abs(v) % 1 ? 2 : 0);
function updateMoney() {
  const v = Profile.balance(), left = Profile.debtLeft();
  $('cash').textContent = money(v); $('money').classList.toggle('debt', v < 0);
  $('debt').hidden = left == null;
  if (left != null) { const s = Math.ceil(left / 1000); $('debt').textContent = `in debt · ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} left`; }
}
// kind: '' (money in, green), 'bad' (money out, red), 'info' (plain message)
function toast(text, kind = '') {
  const el = document.createElement('div'); el.className = 'toast ' + kind; el.textContent = text;
  const box = $('toasts'); box.appendChild(el); while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => el.remove(), 2500);
}
// money toasts come from Econ, when the server (or the offline rule) confirms a change
Profile.onChange(() => updateMoney());
let hintText = '';
function setHint(html) { if (html === hintText) return; hintText = html; $('hint').hidden = !html; $('hint').innerHTML = html; }

