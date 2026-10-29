/* ---------------- pixel-art textures ---------------- */
function pix(w, h, draw, rep = true) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(cv); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapLinearFilter;
  if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const jitter = (g, w, h, a = 18, cell = 1) => { const d = g.getImageData(0, 0, w, h); for (let y = 0; y < h; y += cell) for (let x = 0; x < w; x += cell) { const k = (Math.random() - .5) * a; for (let yy = y; yy < Math.min(h, y + cell); yy++) for (let xx = x; xx < Math.min(w, x + cell); xx++) { const i = (yy * w + xx) * 4; d.data[i] += k; d.data[i + 1] += k; d.data[i + 2] += k; } } g.putImageData(d, 0, 0); };
function brickBg(g, w, h, base = '#9b4a36', mortar = '#c8b8a4') {
  g.fillStyle = mortar; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 2) for (let x = -(y / 2 % 2) * 2; x < w; x += 4) { g.fillStyle = base; g.fillRect(x, y, 3, 1); }
  jitter(g, w, h, 22, 1);
}
const TEX = {
  brick: pix(32, 32, (g, w, h) => {   // one bay 3.2 m wide x one floor 3.8 m high
    brickBg(g, w, h);
    g.fillStyle = '#efe9dc'; g.fillRect(9, 5, 14, 20);           // limestone trim
    g.fillStyle = '#26323d'; g.fillRect(10, 6, 12, 18);          // glass
    g.fillStyle = '#3d5466'; g.fillRect(11, 7, 4, 7); g.fillRect(17, 15, 3, 6);
    g.fillStyle = '#efe9dc'; g.fillRect(15, 6, 2, 18); g.fillRect(10, 14, 12, 2);
    g.fillStyle = '#d9d0bd'; g.fillRect(8, 25, 16, 2);            // sill
    g.fillStyle = '#e6dfcf'; g.fillRect(0, 31, 32, 1);            // floor band
  }),
  stone: pix(32, 32, (g, w, h) => {
    // buff sandstone, as on Harbison and Crawford
    g.fillStyle = '#9c8d70'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 4) for (let x = -(y / 4 % 2) * 4; x < w; x += 8) { g.fillStyle = ['#c4b28e', '#cfbe9b', '#b9a683'][(x + y) & 1 ? 1 : (x * 7 + y) % 3]; g.fillRect(x, y, 7, 3); }
    jitter(g, w, h, 16, 1);
    g.fillStyle = '#e3d8bf'; g.fillRect(11, 6, 10, 21); g.fillRect(12, 4, 8, 2); g.fillRect(14, 3, 4, 1);  // gothic arch surround
    g.fillStyle = '#1f2a33'; g.fillRect(12, 7, 8, 19); g.fillRect(13, 5, 6, 2); g.fillRect(15, 4, 2, 1);
    g.fillStyle = '#6b3d5c'; g.fillRect(13, 9, 2, 3); g.fillStyle = '#2f5878'; g.fillRect(17, 12, 2, 3); g.fillStyle = '#8a6a2a'; g.fillRect(13, 18, 2, 3);
    g.fillStyle = '#c9c1ae'; g.fillRect(15, 7, 2, 19); g.fillRect(12, 16, 8, 1);
  }),
  siding: pix(32, 32, (g, w, h) => {
    g.fillStyle = '#f2f0ea'; g.fillRect(0, 0, w, h);
    for (let y = 1; y < h; y += 3) { g.fillStyle = '#d6d2c8'; g.fillRect(0, y, w, 1); }
    jitter(g, w, h, 8, 2);
    g.fillStyle = '#4a4f55'; g.fillRect(8, 8, 3, 13); g.fillRect(21, 8, 3, 13);   // shutters
    g.fillStyle = '#ffffff'; g.fillRect(11, 7, 10, 15); g.fillStyle = '#2e3a44'; g.fillRect(12, 8, 8, 13);
    g.fillStyle = '#ffffff'; g.fillRect(15, 8, 2, 13); g.fillRect(12, 14, 8, 1);
  }),
  commercial: pix(32, 32, (g, w, h) => {
    g.fillStyle = '#e4ded2'; g.fillRect(0, 0, w, h); jitter(g, w, h, 10, 2);
    g.fillStyle = '#c6bfb2'; g.fillRect(0, 0, w, 3);
    g.fillStyle = '#2b3640'; g.fillRect(3, 9, 26, 14); g.fillStyle = '#41586a'; g.fillRect(5, 10, 6, 6);
    g.fillStyle = '#e4ded2'; g.fillRect(15, 9, 2, 14);
  }),
  modern: pix(32, 32, (g, w, h) => {   // mostly blank brick with a limestone band (Pew Fine Arts Center)
    brickBg(g, w, h, '#a2523c', '#b9a58e');
    g.fillStyle = '#e6dfcf'; g.fillRect(0, 0, w, 2);
  }),
  plain: pix(16, 16, (g, w, h) => { g.fillStyle = '#e8e6e0'; g.fillRect(0, 0, w, h); jitter(g, w, h, 16, 2); }),
  ashlar: pix(32, 32, (g, w, h) => {   // dressed limestone blocks, 2 m x 2 m (the PNC Bank front)
    g.fillStyle = '#b9b2a3'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 8) for (let x = (y / 8 % 2) * 8 - 8; x < w; x += 16) { g.fillStyle = ['#e4dccb', '#dcd3c0', '#e9e2d3'][(x + y + 32) / 8 % 3]; g.fillRect(x + 1, y + 1, 15, 7); }
    jitter(g, w, h, 8, 1);
  }),
  roof: pix(16, 16, (g, w, h) => {
    g.fillStyle = '#ece6dc'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 4) { g.fillStyle = '#b9b0a2'; g.fillRect(0, y + 3, w, 1); for (let x = (y / 4 % 2) * 2; x < w; x += 4) g.fillRect(x, y, 1, 3); }
    jitter(g, w, h, 18, 1);
  }),
  plaster: pix(32, 32, (g, w, h) => {
    g.fillStyle = '#efe6d2'; g.fillRect(0, 0, w, h); jitter(g, w, h, 6, 2);
    g.fillStyle = '#7a5134'; g.fillRect(0, 22, w, 10); g.fillStyle = '#5e3c25'; g.fillRect(0, 22, w, 1); for (let x = 0; x < w; x += 8) g.fillRect(x, 23, 1, 9);
    g.fillStyle = '#d9cdb4'; g.fillRect(9, 5, 14, 20); g.fillStyle = '#bcd7ee'; g.fillRect(10, 6, 12, 18);
    g.fillStyle = '#e4eef7'; g.fillRect(11, 7, 4, 7); g.fillStyle = '#3a3a36'; g.fillRect(15, 6, 2, 18); g.fillRect(10, 14, 12, 1);
  }),
  flat: pix(16, 16, (g, w, h) => { g.fillStyle = '#dcdad5'; g.fillRect(0, 0, w, h); jitter(g, w, h, 30, 1); }),
  leaves: pix(16, 16, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); const d = g.getImageData(0, 0, w, h); for (let i = 0; i < d.data.length; i += 4) { const k = 150 + Math.random() * 105; d.data[i] = d.data[i + 1] = d.data[i + 2] = k; } g.putImageData(d, 0, 0); }),
  bark: pix(16, 16, (g, w, h) => { g.fillStyle = '#6b4f35'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 3) { g.fillStyle = '#4e3826'; g.fillRect(x, 0, 1, h); } jitter(g, w, h, 24, 1); }),
};
const lambert = (map, extra = {}) => new THREE.MeshLambertMaterial(Object.assign({ map, vertexColors: true }, extra));

