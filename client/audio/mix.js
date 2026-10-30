/* ---------------- positional sound: the listener is the player; a source out in the world is a panner that gets quieter with distance ---------------- */
const Mix = {
  // where a sound connects: the speakers (no position), or a panner at (x, y, z), quieter the further away the player is
  node(x, z, y = 1.5) {
    const ac = Rail.ac; if (!ac) return null;
    if (x == null) return ac.destination;
    const pn = this.panner(ac); this.place(pn, x, y, z); return pn;
  },
  panner(ac) {
    const pn = ac.createPanner(); pn.panningModel = 'equalpower'; pn.distanceModel = 'inverse'; pn.refDistance = 8; pn.rolloffFactor = 1.3; pn.maxDistance = 400;
    pn.connect(ac.destination); return pn;
  },
  place(o, x, y, z) {   // set a panner's or listener's position (the newer API first)
    if (o.positionX) { o.positionX.value = x; o.positionY.value = y; o.positionZ.value = z; } else o.setPosition(x, y, z);
  },
  // called each frame: the listener follows the camera (yaw is the look direction, as in player.js)
  listen() {
    const ac = Rail.ac; if (!ac || ac.state !== 'running') return;
    const L = ac.listener, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    this.place(L, P.x, P.y + 1.6, P.z);
    if (L.forwardX) { L.forwardX.value = fx; L.forwardY.value = 0; L.forwardZ.value = fz; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; } else L.setOrientation(fx, 0, fz, 0, 1, 0);
  },
};
