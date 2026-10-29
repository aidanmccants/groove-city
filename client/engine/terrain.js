/* ---------------- terrain ---------------- */
function buildTerrain(groundCanvas) {
  const nx = D.nx, nz = D.nz, pos = new Float32Array(nx * nz * 3), uv = new Float32Array(nx * nz * 2), idx = [];
  for (let r = 0; r < nz; r++) for (let c = 0; c < nx; c++) {
    const i = r * nx + c, x = -W / 2 + c * D.step, z = -H / 2 + r * D.step;
    pos.set([x, HM[i], z], i * 3); uv.set([(x + W / 2) / W, 1 - (z + H / 2) / H], i * 2);
  }
  for (let r = 0; r < nz - 1; r++) for (let c = 0; c < nx - 1; c++) { const a = r * nx + c, b = a + 1, d = a + nx, e = d + 1; idx.push(a, d, b, b, d, e); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const tex = new THREE.CanvasTexture(groundCanvas); tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: tex })); m.receiveShadow = true; scene.add(m);
  // diorama skirt: dirt walls down to a base slab
  const sk = new Buf(), dirt = col3('#6b4f35'), edge = [];
  for (let c = 0; c < nx; c++) edge.push([c, 0]); for (let r = 0; r < nz; r++) edge.push([nx - 1, r]); for (let c = nx - 1; c >= 0; c--) edge.push([c, nz - 1]); for (let r = nz - 1; r >= 0; r--) edge.push([0, r]);
  for (let i = 0; i < edge.length - 1; i++) {
    const [c0, r0] = edge[i], [c1, r1] = edge[i + 1]; const x0 = -W / 2 + c0 * D.step, z0 = -H / 2 + r0 * D.step, x1 = -W / 2 + c1 * D.step, z1 = -H / 2 + r1 * D.step;
    const y0 = HM[r0 * nx + c0], y1 = HM[r1 * nx + c1];
    sk.quad([x0, -6, z0], [x1, -6, z1], [x1, y1, z1], [x0, y0, z0], [0, 0], [1, 0], [1, y1 / 4], [0, y0 / 4], dirt, [Math.sign(x0 + x1) * (c0 === c1), 0, Math.sign(z0 + z1) * (r0 === r1)]);
  }
  scene.add(sk.mesh(lambert(TEX.bark, { side: THREE.DoubleSide })));
  const base = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshLambertMaterial({ color: 0x5f7f45 })); base.rotation.x = -Math.PI / 2; base.position.y = -6; base.receiveShadow = true; scene.add(base);
}

