/* ---------------- main ---------------- */
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  Rail.update(now); Traffic.update();
  Pad.poll(dt);
  if (started && !mapOpen && !newsOpen) update(dt);
  Cops.update(dt, now); updateRemotes(dt); Vehicles.update(dt, now); Bank.update(dt, now);
  updatePeople(dt, now); updateCFA(now);
  checkDebt();
  if (started) sendMove(now);
  sky.position.copy(camera.position);
  // shadow camera follows the player, snapped to texels to avoid shimmer
  const snap = 220 / 2048, tx = Math.round(P.x / snap) * snap, tz = Math.round(P.z / snap) * snap;
  sun.target.position.set(tx, P.y, tz); sun.position.set(tx + sunDir.x * 400, P.y + sunDir.y * 400, tz + sunDir.z * 400);
  if (clouds) clouds.position.x = ((now / 1000 * 1.5) % 300);
  for (const sp of labelSprites) { const d = Math.hypot(sp.position.x - P.x, sp.position.z - P.z); sp.visible = showLabels && d < 260 && d > 6; if (sp.visible) sp.material.opacity = Math.min(1, (260 - d) / 60); }
  if (started && now - hudT > 120) { hudT = now; updateHUD(); drawMini(); }
  if (mapOpen) drawBigFx();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

async function boot() {
  try { await document.fonts.load('700 40px Silkscreen'); await document.fonts.load('600 40px "Barlow Semi Condensed"'); } catch (e) { }
  status('Painting 6.5 million ground pixels: paths, fields, lots, Wolf Creek…', .1); await tick();
  const ground = paintGround();
  status('Raising terrain from elevation data…', .35); await tick();
  buildTerrain(ground);
  status(`Extruding ${D.buildings.length} buildings and fitting hipped roofs…`, .5); await tick();
  buildBuildings(); addSignText(); addBrandSigns(); planDoors(); setupCFA();
  status(`Planting ${D.trees.length.toLocaleString()} trees where the satellite sees canopy…`, .7); await tick();
  buildTrees(); buildLamps(); buildDoors(); const parked = buildCars(); Rail.build(); Traffic.build(); Vehicles.init(parked); clouds = buildClouds();
  status('Drawing the campus map…', .9); await tick();
  buildMapCanvas(ground); buildLabels(); applyTime(); buildPeople();
  const sp = D.specials.spawn || [0, 0]; teleport(sp[0], sp[1]);
  if (D.specials.harbisonTower) { const t = D.specials.harbisonTower; yaw = Math.atan2(-(t[0] - P.x), -(t[1] - P.z)); pitch = 0.12; }
  camera.position.set(P.x, P.y + EYE, P.z); camera.rotation.set(pitch, yaw, 0);
  status(`${D.buildings.length} buildings · ${D.lines.length} roads and paths · ${D.trees.length.toLocaleString()} trees · map data © OpenStreetMap contributors`, 1);
  $('go').disabled = false; $('go').textContent = 'ENTER CAMPUS';
  requestAnimationFrame(frame);
}
$('go').addEventListener('click', () => {
  started = true; $('intro').hidden = true; speechOK = true; Rail.initAudio();
  for (const id of ['where', 'mini', 'mode', 'cross', 'money']) $(id).hidden = false; syncFsBtn();
  if (kicked) { kicked = false; netOff = false; netRetries = 0; }
  connectNet();
  if (isTouch) $('touch').hidden = false; else $('keys').hidden = false;
  if (Profile.inDebt() && Profile.debtLeft() === 0) { Profile.reset(); toast('Your ten minutes in debt ran out, so you start over', 'info'); }
  updateMoney();
  if (Profile.state.seenUpdate !== CURRENT_UPDATE_ID) openNews(); else lockPointer();
});
window.__gcc = {
  net: () => ({ me: myName, others: [...remotes.values()].filter(r => r.seen).map(r => r.name) }),
  Profile, CFA, Bank, bank: () => bank, Rail, Traffic, people, Vehicles, Cops, Roads, netNow, Siren, npcAt, walkGraph: () => updatePeople.ctx, doors: () => doorList, kickAndReset,
  P, view(x, y, z, yw, pt) { flying = true; P.set(x, y, z); yaw = yw; pitch = pt; update(0); },
  // stand at a lat/lon facing a compass heading (matches Google Street View's camera)
  at(lat, lon, hdg, pt = 0) { flying = false; teleport((lon - D.lon0) * 111320 * Math.cos(D.lat0 * Math.PI / 180), -(lat - D.lat0) * 110574); yaw = -hdg * Math.PI / 180; pitch = pt; update(0); },
};
boot().catch(err => { status('Could not build the campus: ' + err.message); console.error(err); });
