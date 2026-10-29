/* ---------------- heightmap ---------------- */
const bin = atob(D.hm); const HM = new Float32Array(bin.length / 2);
for (let i = 0; i < HM.length; i++) HM[i] = (bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8)) / 10;
function terrainY(x, z) {
  let c = (x + W / 2) / D.step, r = (z + H / 2) / D.step;
  c = Math.min(Math.max(c, 0), D.nx - 1.001); r = Math.min(Math.max(r, 0), D.nz - 1.001);
  const i = r | 0, j = c | 0, fy = r - i, fx = c - j, n = D.nx;
  return HM[i * n + j] * (1 - fx) * (1 - fy) + HM[i * n + j + 1] * fx * (1 - fy) + HM[(i + 1) * n + j] * (1 - fx) * fy + HM[(i + 1) * n + j + 1] * fx * fy;
}

