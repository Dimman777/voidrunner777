// ═══════════════════════════════════════════════════════════
//  THREE.JS RENDERER — 3D scene only
//
//  Coordinate bridge:
//    Game world uses +Z forward (left-handed).
//    Three.js camera uses -Z forward (right-handed).
//    _sceneRoot has scale.z = -1: scene objects placed at
//      game (x, y, z) → world (x, y, -z).
//    Camera position: world (x, y, -z) to match scene Z-flip.
//    Camera quaternion: {w, x, -y, z} — negating only Y component
//      (M*q*M, M=diag(1,1,-1)) fixes yaw while preserving pitch/roll.
//    Star field is in _scene (not sceneRoot) with Z negated
//    in its geometry so it distributes correctly around the camera.
// ═══════════════════════════════════════════════════════════

let _renderer, _scene, _sceneRoot, _camera;

// Scene object groups (rebuilt per system, live in _sceneRoot)
let _stationGroup, _pBaseGroup, _planetGroup;
let _launchZoneObj = null;
let _starField = null;

// NPC mesh tracking: entity object → THREE.LineSegments
const _npcMeshes = new Map();

// Bullet point cloud
const MAX_BULLETS = 300;
let _bulletPositions, _bulletColors, _bulletGeo, _bulletPoints;

// Particle point cloud
const MAX_PARTS = 1500;
let _partPositions, _partColors, _partGeo, _partPoints;

// Material cache (color string → LineBasicMaterial)
const _matCache = {};
function _lineMat(col) {
  if (!_matCache[col]) {
    _matCache[col] = new THREE.LineBasicMaterial({ color: new THREE.Color(col) });
  }
  return _matCache[col];
}

// Color cache
const _colCache = {};
function _col(str) {
  if (!_colCache[str]) _colCache[str] = new THREE.Color(str);
  return _colCache[str];
}

// Convert {verts, edges} wireframe model to LineSegments
function _modelToLineSegs(model, col) {
  const positions = [];
  model.edges.forEach(([a, b]) => {
    const va = model.verts[a], vb = model.verts[b];
    positions.push(va[0], va[1], va[2]);
    positions.push(vb[0], vb[1], vb[2]);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return new THREE.LineSegments(geo, _lineMat(col));
}

// ═══════════════════════════════════════════════════════════
//  ONE-TIME SETUP — call once before init()
// ═══════════════════════════════════════════════════════════
function initScene() {
  const canvas = document.getElementById('c');
  _renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  _renderer.setSize(W, H);
  _renderer.setClearColor(0x000006, 1);

  _scene = new THREE.Scene();

  // Z-flip root — all game objects live here.
  // This bridges game +Z-forward to Three.js -Z-forward without touching the camera.
  _sceneRoot = new THREE.Group();
  _sceneRoot.scale.z = -1;
  _scene.add(_sceneRoot);

  // FOV matches proj() in renderer.js: Math.PI/2.5 ≈ 72°
  _camera = new THREE.PerspectiveCamera(72, W / H, 0.5, 60000);

  _scene.add(new THREE.AmbientLight(0x334455, 2.0));

  // Static groups (go into sceneRoot)
  _stationGroup = new THREE.Group(); _sceneRoot.add(_stationGroup);
  _pBaseGroup   = new THREE.Group(); _sceneRoot.add(_pBaseGroup);
  _planetGroup  = new THREE.Group(); _sceneRoot.add(_planetGroup);

  // Bullet point cloud (in sceneRoot so Z coords match game world)
  _bulletPositions = new Float32Array(MAX_BULLETS * 3);
  _bulletColors    = new Float32Array(MAX_BULLETS * 3);
  _bulletGeo = new THREE.BufferGeometry();
  _bulletGeo.setAttribute('position', new THREE.BufferAttribute(_bulletPositions, 3).setUsage(THREE.DynamicDrawUsage));
  _bulletGeo.setAttribute('color',    new THREE.BufferAttribute(_bulletColors,    3).setUsage(THREE.DynamicDrawUsage));
  _bulletGeo.setDrawRange(0, 0);
  _bulletPoints = new THREE.Points(_bulletGeo, new THREE.PointsMaterial({
    size: 5, vertexColors: true, sizeAttenuation: false,
  }));
  _bulletPoints.frustumCulled = false;
  _sceneRoot.add(_bulletPoints);

  // Particle point cloud (in sceneRoot)
  _partPositions = new Float32Array(MAX_PARTS * 3);
  _partColors    = new Float32Array(MAX_PARTS * 3);
  _partGeo = new THREE.BufferGeometry();
  _partGeo.setAttribute('position', new THREE.BufferAttribute(_partPositions, 3).setUsage(THREE.DynamicDrawUsage));
  _partGeo.setAttribute('color',    new THREE.BufferAttribute(_partColors,    3).setUsage(THREE.DynamicDrawUsage));
  _partGeo.setDrawRange(0, 0);
  _partPoints = new THREE.Points(_partGeo, new THREE.PointsMaterial({
    size: 4, vertexColors: true, sizeAttenuation: false,
  }));
  _partPoints.frustumCulled = false;
  _sceneRoot.add(_partPoints);

  window.addEventListener('resize', () => {
    _renderer.setSize(W, H);
    _camera.aspect = W / H;
    _camera.updateProjectionMatrix();
  });
}

// ═══════════════════════════════════════════════════════════
//  PER-SYSTEM BUILD — call after G is ready (init / loadSystem)
// ═══════════════════════════════════════════════════════════
function initSceneForSystem(G) {
  // Clear stations
  while (_stationGroup.children.length) {
    const c = _stationGroup.children[0];
    c.geometry.dispose();
    _stationGroup.remove(c);
  }
  // Clear pirate bases
  while (_pBaseGroup.children.length) {
    const c = _pBaseGroup.children[0];
    c.geometry.dispose();
    _pBaseGroup.remove(c);
  }
  // Clear planets
  while (_planetGroup.children.length) {
    const c = _planetGroup.children[0];
    if (c.geometry) c.geometry.dispose();
    if (c.material) c.material.dispose();
    _planetGroup.remove(c);
  }
  // Clear launch zone
  if (_launchZoneObj) {
    _launchZoneObj.geometry.dispose();
    _sceneRoot.remove(_launchZoneObj);
    _launchZoneObj = null;
  }
  // Clear NPC meshes (enemies array was wiped by loadSystem)
  for (const [, obj] of _npcMeshes) {
    obj.geometry.dispose();
    _sceneRoot.remove(obj);
  }
  _npcMeshes.clear();

  // Star field lives in _scene, not _sceneRoot, to avoid double Z-flip.
  // Star geometry positions have Z negated so they distribute correctly
  // around the camera which is in Three.js world space (+Z is behind).
  _buildStarField(G);

  // Stations (positions in _sceneRoot space = game world positions)
  G.stations.forEach(st => {
    const ls = _modelToLineSegs(st.model, st.col);
    ls.position.set(st.pos.x, st.pos.y, st.pos.z);
    ls.userData.entity = st;
    _stationGroup.add(ls);
  });

  // Pirate bases
  G.pBases.forEach(pb => {
    const ls = _modelToLineSegs(pb.model, pb.col);
    ls.position.set(pb.pos.x, pb.pos.y, pb.pos.z);
    ls.userData.entity = pb;
    _pBaseGroup.add(ls);
  });

  // Launch zone
  if (G.launchZone) {
    _launchZoneObj = _modelToLineSegs(G.launchZone.model, '#50c8ff');
    _launchZoneObj.position.set(G.launchZone.pos.x, G.launchZone.pos.y, G.launchZone.pos.z);
    _launchZoneObj.userData.entity = G.launchZone;
    _sceneRoot.add(_launchZoneObj);
  }

  // Planets
  G.planets.forEach(pl => {
    // Wireframe sphere
    const sphereGeo = new THREE.SphereGeometry(pl.r, 14, 9);
    const wireGeo   = new THREE.WireframeGeometry(sphereGeo);
    sphereGeo.dispose();
    const wf = new THREE.LineSegments(wireGeo, new THREE.LineBasicMaterial({
      color: _col(pl.col), transparent: true, opacity: 0.22,
    }));
    wf.position.set(pl.pos.x, pl.pos.y, pl.pos.z);
    _planetGroup.add(wf);

    // Faint glow shell
    const glowGeo = new THREE.SphereGeometry(pl.r * 1.18, 8, 6);
    const glowMat = new THREE.MeshBasicMaterial({
      color: _col(pl.col), transparent: true, opacity: 0.04,
      side: THREE.DoubleSide,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.set(pl.pos.x, pl.pos.y, pl.pos.z);
    _planetGroup.add(glow);
  });
}

function _buildStarField(G) {
  if (_starField) { _starField.geometry.dispose(); _scene.remove(_starField); }
  const positions = [], colors = [];
  G.bgStars.forEach(s => {
    // Negate Z so +Z-forward game stars appear at -Z in Three.js world (in front of camera)
    positions.push(s.dir.x * 50000, s.dir.y * 50000, -s.dir.z * 50000);
    const b = s.br * 0.75;
    colors.push(b, b, b);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color',    new THREE.Float32BufferAttribute(colors, 3));
  _starField = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 1.5, vertexColors: true, sizeAttenuation: false,
  }));
  // Stars live in _scene (world space), not _sceneRoot, and follow camera directly
  _scene.add(_starField);
}

// ═══════════════════════════════════════════════════════════
//  MAIN FRAME — call from loop() each tick
// ═══════════════════════════════════════════════════════════
function drawFrame(G, dt) {
  if (!G || !_renderer) return;
  const p = G.p;

  // Camera Z is negated to match sceneRoot Z-flip (objects live at world -z_game).
  // Camera quaternion derivation: q_cam = conj(M * conj(p.ori) * M), M=diag(1,1,-1).
  // M conjugation negates rotations around X and Y axes, preserves Z:
  //   M·Rx(α)·M = Rx(-α)  →  negate x component
  //   M·Ry(θ)·M = Ry(-θ)  →  negate y component
  //   M·Rz(φ)·M = Rz(φ)   →  keep z component
  // Result: q_cam = (w, -x, -y, z)
  // THREE.Quaternion.set(x, y, z, w).
  _camera.position.set(p.pos.x, p.pos.y, -p.pos.z);
  _camera.quaternion.set(-p.ori.x, -p.ori.y, p.ori.z, p.ori.w);

  // Star field follows camera in world space (Z negated to match camera)
  if (_starField) _starField.position.set(p.pos.x, p.pos.y, -p.pos.z);

  // Rotate stations & bases
  _stationGroup.children.forEach(ls => {
    const st = ls.userData.entity;
    if (st) ls.rotation.y = st.rAngle || 0;
  });
  _pBaseGroup.children.forEach(ls => {
    const pb = ls.userData.entity;
    if (pb) ls.rotation.y = pb.rAngle || 0;
  });
  if (_launchZoneObj && G.launchZone) {
    G.launchZone.rAngle = (G.launchZone.rAngle || 0) + 0.3 * (dt || 0.016);
    _launchZoneObj.rotation.y = G.launchZone.rAngle;
  }

  // NPC wireframes
  _syncNPCs(G);

  // Bullets (player + enemy combined)
  _syncBullets(G);

  // Particles
  _syncParticles(G);

  _renderer.render(_scene, _camera);
}

// ── NPC MESH SYNC ──
function _syncNPCs(G) {
  const currentSet = new Set(G.enemies);

  // Remove meshes for enemies no longer in the array
  for (const [entity, ls] of _npcMeshes) {
    if (!currentSet.has(entity)) {
      ls.geometry.dispose();
      _sceneRoot.remove(ls);
      _npcMeshes.delete(entity);
    }
  }

  // Create or update mesh for each active enemy
  G.enemies.forEach(e => {
    if (!_npcMeshes.has(e)) {
      const ls = _modelToLineSegs(e.model, e.col);
      _sceneRoot.add(ls);
      _npcMeshes.set(e, ls);
    }
    const ls = _npcMeshes.get(e);
    ls.position.set(e.pos.x, e.pos.y, e.pos.z);
    // YXZ order: yaw (Y) applied before pitch (X), matching eRotY then eRotX
    ls.rotation.order = 'YXZ';
    ls.rotation.y = e.yaw   || 0;
    ls.rotation.x = e.pitch || 0;
    ls.visible = e.struct > 0;
  });
}

// ── BULLET SYNC ──
function _syncBullets(G) {
  const bullets = [...G.bullets, ...G.eBullets];
  const n = Math.min(bullets.length, MAX_BULLETS);
  for (let i = 0; i < n; i++) {
    const b = bullets[i];
    _bulletPositions[i * 3]     = b.pos.x;
    _bulletPositions[i * 3 + 1] = b.pos.y;
    _bulletPositions[i * 3 + 2] = b.pos.z;
    const c = _col(b.col);
    const a = Math.min(1, b.life * 3);
    _bulletColors[i * 3]     = c.r * a;
    _bulletColors[i * 3 + 1] = c.g * a;
    _bulletColors[i * 3 + 2] = c.b * a;
  }
  _bulletGeo.setDrawRange(0, n);
  if (n > 0) {
    _bulletGeo.attributes.position.needsUpdate = true;
    _bulletGeo.attributes.color.needsUpdate    = true;
  }
}

// ── PARTICLE SYNC ──
function _syncParticles(G) {
  const n = Math.min(G.parts.length, MAX_PARTS);
  for (let i = 0; i < n; i++) {
    const pt = G.parts[i];
    _partPositions[i * 3]     = pt.pos.x;
    _partPositions[i * 3 + 1] = pt.pos.y;
    _partPositions[i * 3 + 2] = pt.pos.z;
    const c = _col(pt.col);
    const a = pt.life > 0.4 ? 0.7 : (pt.life / 0.4) * 0.7;
    _partColors[i * 3]     = c.r * a;
    _partColors[i * 3 + 1] = c.g * a;
    _partColors[i * 3 + 2] = c.b * a;
  }
  _partGeo.setDrawRange(0, n);
  if (n > 0) {
    _partGeo.attributes.position.needsUpdate = true;
    _partGeo.attributes.color.needsUpdate    = true;
  }
}
