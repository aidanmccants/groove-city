/* ---------------- time of day ---------------- */
const TIMES = [
  { name: 'Afternoon', sun: [-0.45, 0.72, 0.52], sc: 0xfff1dc, si: 2.4, hs: 0xcfe3ff, hg: 0x5d6b45, hi: 1.0, top: 0x4a86cf, hor: 0xcfe0ee, lamp: 0x000000, exp: 1.05, cloud: 0x777777 },
  { name: 'Golden hour', sun: [-0.85, 0.2, 0.45], sc: 0xffb36b, si: 2.2, hs: 0xf3c6a0, hg: 0x4d4a3a, hi: 0.75, top: 0x40568f, hor: 0xf2a76a, lamp: 0x553311, exp: 1.0, cloud: 0x8a5a44 },
  { name: 'Night', sun: [0.35, 0.65, -0.3], sc: 0x9fb4ff, si: 0.35, hs: 0x3a4a7a, hg: 0x10140f, hi: 0.35, top: 0x060b1c, hor: 0x1b2744, lamp: 0xffd890, exp: 1.2, cloud: 0x10141f },
];
let timeIdx = 0;
function applyTime() {
  const t = TIMES[timeIdx]; sunDir.set(...t.sun).normalize(); sun.color.set(t.sc); sun.intensity = t.si; hemi.color.set(t.hs); hemi.groundColor.set(t.hg); hemi.intensity = t.hi;
  skyU.top.value.set(t.top); skyU.hor.value.set(t.hor); scene.fog.color.set(t.hor); renderer.toneMappingExposure = t.exp;
  if (lampHeads) lampHeads.material.emissive.set(t.lamp); if (lanternMat) lanternMat.emissive.set(timeIdx === 2 ? 0xffc870 : 0x332211); if (clouds) clouds.material.emissive.set(t.cloud);
}
function cycleTime() { timeIdx = (timeIdx + 1) % TIMES.length; applyTime(); }
let clouds;

