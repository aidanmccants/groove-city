/* ---------------- small geometry helpers ---------------- */
const area = p => { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
function pip(x, z, poly) { let ins = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) ins = !ins; } return ins; }
function closestOnSeg(px, pz, a, b) { const vx = b[0] - a[0], vz = b[1] - a[1], L2 = vx * vx + vz * vz || 1e-9; let t = ((px - a[0]) * vx + (pz - a[1]) * vz) / L2; t = Math.max(0, Math.min(1, t)); return [a[0] + vx * t, a[1] + vz * t, t]; }
function segInt(p1, p2, p3, p4) {
  const d = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0]); if (Math.abs(d) < 1e-12) return false;
  const u = ((p3[0] - p1[0]) * (p4[1] - p3[1]) - (p3[1] - p1[1]) * (p4[0] - p3[0])) / d, v = ((p3[0] - p1[0]) * (p2[1] - p1[1]) - (p3[1] - p1[1]) * (p2[0] - p1[0])) / d;
  return u > 1e-6 && u < 1 - 1e-6 && v > 1e-6 && v < 1 - 1e-6;
}
function hash(n) { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); }
let seed = 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

/* inset each ring by d (negative = outset). rings: outer CCW, holes CW (x/z math frame) */
function insetRings(rings, d) {
  return rings.map(p => {
    const n = p.length, out = [];
    for (let i = 0; i < n; i++) {
      const a = p[(i - 1 + n) % n], b = p[i], c = p[(i + 1) % n];
      const e1 = [b[0] - a[0], b[1] - a[1]], e2 = [c[0] - b[0], c[1] - b[1]];
      const l1 = Math.hypot(...e1) || 1e-9, l2 = Math.hypot(...e2) || 1e-9;
      const n1 = [-e1[1] / l1, e1[0] / l1], n2 = [-e2[1] / l2, e2[0] / l2];
      const q1 = [b[0] + n1[0] * d, b[1] + n1[1] * d], q2 = [b[0] + n2[0] * d, b[1] + n2[1] * d];
      const cr = e1[0] * e2[1] - e1[1] * e2[0];
      if (Math.abs(cr) < 1e-6 * l1 * l2) { out.push(q1); continue; }
      const s = ((q2[0] - q1[0]) * e2[1] - (q2[1] - q1[1]) * e2[0]) / cr;
      out.push([q1[0] + e1[0] * s, q1[1] + e1[1] * s]);
    }
    return out;
  });
}
function validInset(r0, r1) {
  const edges = [];
  for (let k = 0; k < r0.length; k++) {
    const a = r0[k], b = r1[k], n = a.length;
    for (let i = 0; i < n; i++) {
      const o = [a[(i + 1) % n][0] - a[i][0], a[(i + 1) % n][1] - a[i][1]], w = [b[(i + 1) % n][0] - b[i][0], b[(i + 1) % n][1] - b[i][1]];
      if (o[0] * w[0] + o[1] * w[1] <= 0) return false;
      edges.push([b[i], b[(i + 1) % n], k, i, n]);
    }
  }
  for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) {
    const A = edges[i], B = edges[j];
    if (A[2] === B[2] && (Math.abs(A[3] - B[3]) <= 1 || Math.abs(A[3] - B[3]) === A[4] - 1)) continue;
    if (segInt(A[0], A[1], B[0], B[1])) return false;
  }
  return true;
}

