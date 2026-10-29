/* ---------------- labels in 3D ---------------- */
const labelSprites = []; let showLabels = true;
function buildLabels() {
  for (const l of labels) {
    const cv = document.createElement('canvas'), g = cv.getContext('2d'); g.font = '600 44px "Barlow Semi Condensed", sans-serif';
    const w = Math.ceil(g.measureText(l.name).width) + 40; cv.width = w; cv.height = 72;
    g.font = '600 44px "Barlow Semi Condensed", sans-serif'; g.fillStyle = 'rgba(22,20,19,.78)'; g.fillRect(0, 0, w, 72); g.fillStyle = '#8c1d2f'; g.fillRect(0, 66, w, 6);
    g.fillStyle = '#f4efe3'; g.textBaseline = 'middle'; g.fillText(l.name, 20, 36);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog: false }));
    sp.scale.set(w / 72 * 3.6, 3.6, 1); sp.position.set(l.x, l.y, l.z); sp.userData = l; scene.add(sp); labelSprites.push(sp);
  }
}

