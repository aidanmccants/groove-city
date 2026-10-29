/* ---------------- colliders ---------------- */
const CELL = 16, cgrid = new Map();
const colliders = [];
function addCollider(rings, top, bot) {
  const c = { rings, top, bot }; colliders.push(c);
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const q of rings[0]) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); z0 = Math.min(z0, q[1]); z1 = Math.max(z1, q[1]); }
  for (let i = Math.floor(x0 / CELL) - 1; i <= Math.floor(x1 / CELL) + 1; i++) for (let j = Math.floor(z0 / CELL) - 1; j <= Math.floor(z1 / CELL) + 1; j++) {
    const k = i + ',' + j; if (!cgrid.has(k)) cgrid.set(k, []); cgrid.get(k).push(c);
  }
  return c;
}
const tgrid = new Map();
function addTrunk(x, z, r) { const k = Math.floor(x / CELL) + ',' + Math.floor(z / CELL); if (!tgrid.has(k)) tgrid.set(k, []); tgrid.get(k).push([x, z, r]); }

