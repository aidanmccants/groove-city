/* ---------------- world: every thing in the map is a node with components (docs/ARCHITECTURE.md) ---------------- */
const Components = {
  defs: new Map(),
  define(name, def) { this.defs.set(name, def); World.dirty = true; return def; },   // def: { init(node, data), update(node, dt, now, data), interact(node), sync: bool }
};
const World = {
  nodes: new Map(), kinds: new Map(), cell: 32, grid: new Map(), ticking: [], dirty: true,
  // node = { id, kind, parent = 'map', x = 0, y = 0, z = 0, rot = 0, c = {} }. Nodes are indexed by position, so move them with move()
  cellOf(x, z) { return Math.floor(x / this.cell) + ',' + Math.floor(z / this.cell); },
  kindSet(kind) { let s = this.kinds.get(kind); if (!s) this.kinds.set(kind, s = new Set()); return s; },
  bucket(x, z) { const k = this.cellOf(x, z); let s = this.grid.get(k); if (!s) this.grid.set(k, s = new Set()); return s; },
  unbucket(n) { const k = this.cellOf(n.x, n.z), s = this.grid.get(k); if (s) { s.delete(n); if (!s.size) this.grid.delete(k); } },
  add(node) {
    if (this.nodes.has(node.id)) throw new Error('node already exists: ' + node.id);
    node.parent = node.parent || 'map'; node.x = node.x || 0; node.y = node.y || 0; node.z = node.z || 0; node.rot = node.rot || 0; node.c = node.c || {}; node.children = [];
    this.nodes.set(node.id, node); this.kindSet(node.kind).add(node); this.bucket(node.x, node.z).add(node);
    const p = this.nodes.get(node.parent); if (p) p.children.push(node.id);
    for (const name in node.c) { const def = Components.defs.get(name); if (def && def.init) def.init(node, node.c[name]); }
    this.dirty = true; return node;
  },
  get(id) { return this.nodes.get(id); },
  byKind(kind) { return [...(this.kinds.get(kind) || [])]; },
  remove(id) {   // also removes the children, and takes the node out of its parent's list
    const n = this.nodes.get(id); if (!n) return;
    for (const ch of [...n.children]) this.remove(ch);
    this.nodes.delete(id); this.kinds.get(n.kind).delete(n); this.unbucket(n);
    const p = this.nodes.get(n.parent), i = p ? p.children.indexOf(id) : -1; if (i >= 0) p.children.splice(i, 1);
    this.dirty = true;
  },
  move(node, x, z) { this.unbucket(node); node.x = x; node.z = z; this.bucket(x, z).add(node); },
  setKind(node, kind) { if (node.kind === kind) return; this.kinds.get(node.kind).delete(node); node.kind = kind; this.kindSet(kind).add(node); },
  near(x, z, r, kind) {   // nodes within r metres of (x, z), optionally of one kind
    const out = [], c = this.cell, r2 = r * r;
    for (let i = Math.floor((x - r) / c); i <= Math.floor((x + r) / c); i++) for (let j = Math.floor((z - r) / c); j <= Math.floor((z + r) / c); j++) {
      const s = this.grid.get(i + ',' + j); if (!s) continue;
      for (const n of s) if ((!kind || n.kind === kind) && (n.x - x) ** 2 + (n.z - z) ** 2 <= r2) out.push(n);
    }
    return out;
  },
  update(dt, now) {
    if (this.dirty) this.rebuild();
    for (let i = 0; i < this.ticking.length; i++) { const e = this.ticking[i]; e[1].update(e[0], dt, now, e[2]); }
  },
  rebuild() {   // [node, def, data] for every component that has update(); rebuilt lazily after adds, removes, patches and define()
    this.ticking = [];
    for (const n of this.nodes.values()) for (const name in n.c) { const def = Components.defs.get(name); if (def && def.update) this.ticking.push([n, def, n.c[name]]); }
    this.dirty = false;
  },
  patch(id, comps) {   // merges component data into node.c (overrides); init runs only for components the node did not have
    const n = this.nodes.get(id); if (!n) return;
    for (const name in comps) {
      const fresh = !(name in n.c), def = Components.defs.get(name);
      n.c[name] = Object.assign({}, n.c[name], comps[name]);
      if (fresh && def && def.init) def.init(n, n.c[name]);
    }
    this.dirty = true;
  },
  // building id: gc:<slug of its name>, else gc:b<x>_<z> from the footprint centre (metres, minus written as m); -2, -3 on a clash
  makeId(b) {
    const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const name = b.n ? slug(b.n) : '';
    let base;
    if (name) base = 'gc:' + name;
    else {
      let cx = 0, cz = 0; for (const q of b.p) { cx += q[0]; cz += q[1]; }
      const num = v => (Math.round(v) < 0 ? 'm' : '') + Math.abs(Math.round(v));
      base = 'gc:b' + num(cx / b.p.length) + '_' + num(cz / b.p.length);
    }
    let id = base, k = 2; while (this.nodes.has(id)) id = base + '-' + k++;
    return id;
  },
};
