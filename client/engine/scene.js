/* ---------------- scene ---------------- */
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 5000);
camera.rotation.order = 'YXZ';
scene.fog = new THREE.Fog(0xcfe0ee, 220, 1300);
const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x5d6b45, 1.0); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dc, 2.4); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); const SC = sun.shadow.camera; SC.left = SC.bottom = -110; SC.right = SC.top = 110; SC.near = 10; SC.far = 900; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.4;
scene.add(sun, sun.target);
const sunDir = new THREE.Vector3(-0.45, 0.72, 0.52).normalize();

const skyU = { top: { value: new THREE.Color(0x4a86cf) }, hor: { value: new THREE.Color(0xcfe0ee) }, bot: { value: new THREE.Color(0x9fb0a0) } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
  vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: 'uniform vec3 top; uniform vec3 hor; uniform vec3 bot; varying vec3 vP; void main(){ float h = normalize(vP).y; vec3 c = h>0. ? mix(hor, top, pow(min(h*1.6,1.),0.7)) : mix(hor, bot, min(-h*4.,1.)); gl_FragColor = vec4(c,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'
}));
sky.renderOrder = -1; scene.add(sky);

