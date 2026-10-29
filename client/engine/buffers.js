/* ---------------- geometry buffers ---------------- */
class Buf {
  constructor() { this.p = []; this.n = []; this.u = []; this.c = []; }
  tri(A, B, C, ua, ub, uc, col, hint) {
    const ab = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], ac = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    let n = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    const L = Math.hypot(...n); if (L < 1e-8) return; n = n.map(v => v / L);
    if (hint && n[0] * hint[0] + n[1] * hint[1] + n[2] * hint[2] < 0) { [B, C] = [C, B]; [ub, uc] = [uc, ub]; n = n.map(v => -v); }
    this.p.push(...A, ...B, ...C); this.n.push(...n, ...n, ...n); this.u.push(...ua, ...ub, ...uc); this.c.push(...col, ...col, ...col);
  }
  quad(A, B, C, D_, ua, ub, uc, ud, col, hint) { this.tri(A, B, C, ua, ub, uc, col, hint); this.tri(A, C, D_, ua, uc, ud, col, hint); }
  box(cx, cy, cz, sx, sy, sz, rot, col, uvs = 1) {
    const c = Math.cos(rot), s = Math.sin(rot), P = (x, y, z) => [cx + x * c - z * s, cy + y, cz + x * s + z * c];
    const hx = sx / 2, hz = sz / 2;
    const v = [P(-hx, 0, -hz), P(hx, 0, -hz), P(hx, 0, hz), P(-hx, 0, hz), P(-hx, sy, -hz), P(hx, sy, -hz), P(hx, sy, hz), P(-hx, sy, hz)];
    const f = (a, b, cc, d, w, h, hint) => this.quad(v[a], v[b], v[cc], v[d], [0, 0], [w * uvs, 0], [w * uvs, h * uvs], [0, h * uvs], col, hint);
    const R = (x, z) => [x * c - z * s, 0, x * s + z * c];
    f(0, 1, 5, 4, sx, sy, R(0, -1)); f(1, 2, 6, 5, sz, sy, R(1, 0)); f(2, 3, 7, 6, sx, sy, R(0, 1)); f(3, 0, 4, 7, sz, sy, R(-1, 0));
    f(4, 5, 6, 7, sx, sz, [0, 1, 0]); f(0, 1, 2, 3, sx, sz, [0, -1, 0]);
  }
  pyramid(cx, cy, cz, half, h, rot, col) {
    const c = Math.cos(rot), s = Math.sin(rot), P = (x, z) => [cx + x * c - z * s, cy, cz + x * s + z * c];
    const v = [P(-half, -half), P(half, -half), P(half, half), P(-half, half)], top = [cx, cy + h, cz];
    for (let i = 0; i < 4; i++) { const a = v[i], b = v[(i + 1) % 4]; const m = [(a[0] + b[0]) / 2 - cx, 0.6, (a[2] + b[2]) / 2 - cz]; this.tri(a, b, top, [0, 0], [half, 0], [half / 2, h / 2], col, m); }
  }
  mesh(mat) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true; return m;
  }
}
const col3 = (hex, k = 1) => { const c = new THREE.Color(hex); return [c.r * k, c.g * k, c.b * k]; };

