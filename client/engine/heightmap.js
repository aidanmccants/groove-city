/* ---------------- heightmap ---------------- */
const bin = atob(D.hm); const HM = new Float32Array(bin.length / 2);
for (let i = 0; i < HM.length; i++) HM[i] = (bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8)) / 10;
function terrainY(x, z) {
  let c = (x + W / 2) / D.step, r = (z + H / 2) / D.step;
  c = Math.min(Math.max(c, 0), D.nx - 1.001); r = Math.min(Math.max(r, 0), D.nz - 1.001);
  const i = r | 0, j = c | 0, fy = r - i, fx = c - j, n = D.nx;
  return HM[i * n + j] * (1 - fx) * (1 - fy) + HM[i * n + j + 1] * fx * (1 - fy) + HM[(i + 1) * n + j] * (1 - fx) * fy + HM[(i + 1) * n + j + 1] * fx * fy;
}
// Bridges (except the Rainbow Bridge) are one flat deck, so the ground is graded to the deck's height at both banks, as on a real road.
// The bank points sit w/2 from each end, so the ground is level out to w/2 + 6 m from each end, then eases back to the
// original terrain over the next 10 m
function gradeBridgeBanks() {
  for (const l of D.lines) if (l.br && l.n !== 'Rainbow Bridge' && l.p.length >= 2) {
    const p = l.p, n = p.length, hw = Math.max(l.w, 2.4) / 2;
    const left = i => { const j = Math.min(i, n - 2), dx = p[j + 1][0] - p[j][0], dz = p[j + 1][1] - p[j][1], L = Math.hypot(dx, dz) || 1; return [-dz / L, dx / L]; };
    const banks = [];
    for (const i of [0, n - 1]) { const [ux, uz] = left(i), X = p[i][0], Z = p[i][1]; banks.push(terrainY(X + ux * hw, Z + uz * hw), terrainY(X - ux * hw, Z - uz * hw)); }
    const G = banks.reduce((s, v) => s + v, 0) / banks.length, FULL = hw + 6, EASE = 10, reach = FULL + EASE;
    for (const i of [0, n - 1]) {
      const [ex, ez] = p[i];
      for (let r = Math.max(0, Math.floor((ez - reach + H / 2) / D.step)); r <= Math.min(D.nz - 1, Math.ceil((ez + reach + H / 2) / D.step)); r++)
        for (let c = Math.max(0, Math.floor((ex - reach + W / 2) / D.step)); c <= Math.min(D.nx - 1, Math.ceil((ex + reach + W / 2) / D.step)); c++) {
          const d = Math.hypot(-W / 2 + c * D.step - ex, -H / 2 + r * D.step - ez);
          if (d > reach) continue;
          const f = d <= FULL ? 1 : 1 - (d - FULL) / EASE, k = r * D.nx + c;
          HM[k] = HM[k] * (1 - f) + G * f;
        }
    }
  }
}
gradeBridgeBanks();

