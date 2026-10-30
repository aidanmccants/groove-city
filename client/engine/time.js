/* ---------------- day and night: one 20-minute day, the same for everyone (phase from the shared clock, netNow) ----------------
   skyPhase: 0 = midnight, 0.25 = sunrise (6:00), 0.5 = noon, 0.75 = sunset (18:00). The sun's height drives the light, the sky
   colours (a blend of day, golden hour and night), the lamps and the stars and moon. Below the horizon the moon lights the scene. */
const DAY_MS = 20 * 60 * 1000;
const SKY = {   // the three looks; look() blends them by how high the sun is
  day:   { sun: 0xfff1dc, si: 2.4, hs: 0xcfe3ff, hg: 0x5d6b45, hi: 1.0, top: 0x4a86cf, hor: 0xcfe0ee, exp: 1.05, cloud: 0x777777 },
  gold:  { sun: 0xffb36b, si: 2.2, hs: 0xf3c6a0, hg: 0x4d4a3a, hi: 0.75, top: 0x40568f, hor: 0xf2a76a, exp: 1.0, cloud: 0x8a5a44 },
  night: { sun: 0x9fb4ff, si: 0.35, hs: 0x3a4a7a, hg: 0x10140f, hi: 0.35, top: 0x060b1c, hor: 0x1b2744, exp: 1.2, cloud: 0x10141f },
};
const NUM = ['si', 'hi', 'exp'], COL = ['sun', 'hs', 'hg', 'top', 'hor', 'cloud'];
const HORIZ = new THREE.Vector2(-0.45, 0.52).normalize();   // the compass line the sun rises and sets along
const LAMP_ON = new THREE.Color(0xffd890), LANTERN_OFF = new THREE.Color(0x332211), LANTERN_ON = new THREE.Color(0xffc870), BLACK = new THREE.Color(0);
let nightLevel = 0;   // 0 = full day, 1 = full night; read by the crossing lights and the lamps
let skyBodies = null; // the stars, the moon and the sun disc (inside the sky dome)
let clouds;           // the cloud layer (buildClouds in main.js); its glow follows the time of day
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const skyPhase = (now = netNow()) => ((now % DAY_MS) + DAY_MS) % DAY_MS / DAY_MS;
// the in-game clock: the same time for everyone, from the same shared phase
function clockText(p = skyPhase()) { const m = Math.floor(p * 1440) % 1440, h = Math.floor(m / 60); return `${h % 12 || 12}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; }
// the light and sky at phase p: the direction the light comes from (always above the horizon), colours and levels
function look(p) {
  const sinE = Math.sin(2 * Math.PI * (p - 0.25));   // sun height: -1 midnight, 0 sunrise or sunset, 1 noon
  const d = smooth(-0.1, 0.12, sinE), g = Math.max(0, 1 - Math.abs(sinE) / 0.3);
  const w = { day: (1 - g) * d, gold: g, night: (1 - g) * (1 - d) };
  const out = { sinE, d, dir: null };
  for (const f of NUM) out[f] = w.day * SKY.day[f] + w.gold * SKY.gold[f] + w.night * SKY.night[f];
  for (const f of COL) {
    const c = new THREE.Color(0, 0, 0);
    for (const k of ['day', 'gold', 'night']) { const s = new THREE.Color(SKY[k][f]), m = w[k]; c.r += s.r * m; c.g += s.g * m; c.b += s.b * m; }
    out[f] = c;
  }
  const cosE = Math.sqrt(Math.max(0, 1 - sinE * sinE)), sign = sinE >= 0 ? 1 : -1;   // below the horizon the light is the moon, on the far side
  out.dir = new THREE.Vector3(HORIZ.x * cosE, sinE, HORIZ.y * cosE).multiplyScalar(sign);
  return out;
}
// stars, moon and sun disc on the sky dome; deterministic star field so everyone sees the same sky
function buildSkyBodies() {
  const n = 700, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = hash(i * 12.9898) * Math.PI * 2, y = hash(i * 78.233 + 1) * 0.92 + 0.06, r = Math.sqrt(1 - y * y) * 3900;
    pos.set([Math.cos(a) * r, y * 3900, Math.sin(a) * r], i * 3);
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  const moon = new THREE.Mesh(new THREE.SphereGeometry(70, 20, 14), new THREE.MeshBasicMaterial({ color: 0xeef1f8, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  const disc = new THREE.Mesh(new THREE.SphereGeometry(110, 20, 14), new THREE.MeshBasicMaterial({ color: 0xfff3c4, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  sky.add(stars, moon, disc);
  skyBodies = { stars, moon, disc };
}
// set the light, sky, fog, lamps and clouds for the current shared time; called every frame (cheap)
function updateSky(now = netNow()) {
  const L = look(skyPhase(now));
  nightLevel = 1 - L.d;
  sunDir.copy(L.dir); sun.color.copy(L.sun); sun.intensity = L.si; hemi.color.copy(L.hs); hemi.groundColor.copy(L.hg); hemi.intensity = L.hi;
  skyU.top.value.copy(L.top); skyU.hor.value.copy(L.hor); scene.fog.color.copy(L.hor); renderer.toneMappingExposure = L.exp;
  if (lampHeads) lampHeads.material.emissive.lerpColors(BLACK, LAMP_ON, nightLevel);
  if (lanternMat) lanternMat.emissive.lerpColors(LANTERN_OFF, LANTERN_ON, nightLevel);
  if (clouds) clouds.material.emissive.copy(L.cloud);
  if (skyBodies) {
    const { stars, moon, disc } = skyBodies;
    stars.material.opacity = smooth(0.1, -0.25, L.sinE);
    disc.material.opacity = smooth(-0.04, 0.02, L.sinE);
    moon.material.opacity = smooth(0.02, -0.06, L.sinE);
    disc.position.copy(sunDir).multiplyScalar(3800); moon.position.copy(sunDir).multiplyScalar(3800);
  }
}
