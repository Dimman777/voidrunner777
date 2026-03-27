// ═══════════════════════════════════════════════════════════
//  ASSET LOADER — custom models, textures, cockpits, sounds
//
//  To activate a custom asset:
//    1. Drop the file in the matching assets/ folder.
//    2. Set its path string in ASSET_REGISTRY below.
//    3. Run the game from a local HTTP server — browsers block
//       fetch() on file:// URLs (images work without a server).
//
//  GLTF notes:
//    - GLB (binary GLTF) is preferred over .gltf + loose files.
//    - Models should face +Z (forward) and be centred at origin.
//    - Scale to roughly match the existing convex-hull sizes;
//      e.g. a militia_fighter fits in a ~10-unit sphere.
//    - PBR materials and embedded textures are fully supported.
//    - The faction colour tint is NOT applied to custom models —
//      faction colouring is left to the model's own materials.
//
//  Cockpit notes:
//    - PNG or JPG, any aspect ratio — drawn full-screen.
//    - Draw your cockpit frame with a transparent centre so the
//      3D viewport shows through.
//    - 'default' is used when no ship-specific key is registered.
//
//  Sound notes:
//    - OGG Vorbis is the most portable; MP3 and WAV also work.
//    - Gain values below each key match the procedural mixer —
//      record / normalise your files to –3 dBFS and the volumes
//      will be roughly consistent.
// ═══════════════════════════════════════════════════════════

// ── REGISTRY ────────────────────────────────────────────────
// Set a string path (relative to the HTML file) to activate,
// or leave null to use the built-in procedural stand-in.
const ASSET_REGISTRY = {

  // 3-D ship / environment models (.glb recommended)
  models: {
    // NPC hulls — key matches NPC_HULLS keys in data-equipment.js
    militia_fighter: null,   // e.g. 'assets/models/militia_fighter.glb'
    cruiser:         null,
    recovery_ship:   null,
    shuttle_npc:     null,
    courier_npc:     null,
    gunship_npc:     null,
    freighter_npc:   null,
    // Capital ships — key matches CAP_DEFS keys
    frigate:         null,
    dreadnought:     null,
    // Environment
    station:         null,   // replaces all stations (single model, recoloured)
    pirate_base:     null,
  },

  // Cockpit overlay bitmaps (PNG with transparent centre recommended)
  // Key is G.p.shipKey ('shuttle', 'viper', 'heavy_fighter', …).
  // 'default' is the universal fallback.
  cockpits: {
    default:          null,  // e.g. 'assets/cockpits/default.png'
    shuttle:          null,
    viper:            null,
    heavy_fighter:    null,
    freighter:        null,
  },

  // One-shot sound file overrides (OGG/MP3/WAV)
  sounds: {
    autocannon:       null,  // e.g. 'assets/sounds/autocannon.ogg'
    laser:            null,
    hypervelocity:    null,
    armour_hit:       null,  // player armour hit
    struct_hit:       null,  // player structure hit
    npc_armour_hit:   null,
    npc_struct_hit:   null,
    explosion:        null,
    alarm:            null,
    collision_station:null,
    collision_planet: null,
  },
};

// ── INTERNAL CACHES ──────────────────────────────────────────
const _models   = {};   // hullKey → THREE.Group (deep-cloned per use)
const _sounds   = {};   // soundKey → AudioBuffer
const _cockpits = {};   // shipKey  → HTMLImageElement

let _GLTFLoader = null;
let _audioCtx   = null;

// ── AUDIO CONTEXT ────────────────────────────────────────────
// Separate from sound.js so decoding and playback use the same
// context (AudioBuffers are bound to the context that decoded them).
function _getAudioCtx() {
  if (!_audioCtx) {
    try {
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {}
  }
  return _audioCtx;
}

// ── GLTF LOADER ──────────────────────────────────────────────
// Dynamically imports THREE's GLTFLoader the first time it is
// needed. Requires the importmap in index.html so the loader's
// internal `import … from 'three'` resolves correctly.
// Falls back gracefully if the browser or network are unavailable.
async function _ensureGLTFLoader() {
  if (_GLTFLoader) return _GLTFLoader;
  try {
    const { GLTFLoader } = await import(
      'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js'
    );
    _GLTFLoader = GLTFLoader;
  } catch (e) {
    console.warn('[assets] GLTFLoader unavailable:', e.message);
  }
  return _GLTFLoader;
}

async function _loadModel(key, path) {
  const Loader = await _ensureGLTFLoader();
  if (!Loader) return;
  try {
    const loader = new Loader();
    const gltf = await new Promise((res, rej) => loader.load(path, res, null, rej));

    // Re-wrap each mesh using window.THREE so it integrates with the
    // existing scene graph (THREE module-build vs. global-build have
    // identical duck-typing flags, so geometry/material are compatible).
    const group = new THREE.Group();
    gltf.scene.traverse(child => {
      if (child.isMesh) {
        const m = new THREE.Mesh(child.geometry, child.material);
        m.position.copy(child.position);
        m.quaternion.copy(child.quaternion);
        m.scale.copy(child.scale);
        m.castShadow    = child.castShadow;
        m.receiveShadow = child.receiveShadow;
        group.add(m);
      }
    });
    _models[key] = group;
    console.log(`[assets] model loaded: ${key}`);
  } catch (e) {
    console.warn(`[assets] model failed (${key}): ${e.message}`);
  }
}

// ── SOUND LOADER ─────────────────────────────────────────────
async function _loadSound(key, path) {
  try {
    const resp = await fetch(path);
    if (!resp.ok) throw new Error(resp.statusText);
    const arrayBuf = await resp.arrayBuffer();
    const ctx = _getAudioCtx();
    if (!ctx) return;
    _sounds[key] = await ctx.decodeAudioData(arrayBuf);
    console.log(`[assets] sound loaded: ${key}`);
  } catch (e) {
    console.warn(`[assets] sound failed (${key}): ${e.message}`);
  }
}

// ── COCKPIT LOADER ────────────────────────────────────────────
// Images work on file:// — no server needed for cockpits.
async function _loadCockpit(key, path) {
  try {
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload  = res;
      img.onerror = () => rej(new Error('load failed'));
      img.src = path;
    });
    _cockpits[key] = img;
    console.log(`[assets] cockpit loaded: ${key}`);
  } catch (e) {
    console.warn(`[assets] cockpit failed (${key}): ${e.message}`);
  }
}

// ── PUBLIC API ────────────────────────────────────────────────

// Call once at startup before the game loop begins.
// Fires all registered loads in parallel; awaiting this ensures
// custom assets are ready before the first frame.
async function assetsInit() {
  const jobs = [];
  for (const [key, path] of Object.entries(ASSET_REGISTRY.models)) {
    if (path) jobs.push(_loadModel(key, path));
  }
  for (const [key, path] of Object.entries(ASSET_REGISTRY.sounds)) {
    if (path) jobs.push(_loadSound(key, path));
  }
  for (const [key, path] of Object.entries(ASSET_REGISTRY.cockpits)) {
    if (path) jobs.push(_loadCockpit(key, path));
  }
  await Promise.allSettled(jobs);
}

// Returns a deep-cloned THREE.Group for the given hull key,
// or null if no custom model was loaded (caller uses procedural fallback).
// Each call returns a fresh clone so NPCs get independent transform trees.
function assetsGetModel(key) {
  const g = _models[key];
  return g ? g.clone(true) : null;
}

// Returns the cockpit HTMLImageElement for the given ship key,
// or falls back to 'default', or null if nothing was loaded.
function assetsGetCockpit(shipKey) {
  return _cockpits[shipKey] || _cockpits['default'] || null;
}

// Plays a loaded one-shot sound at the given gain.
// Returns true if the override played (caller skips procedural synthesis).
function assetsPlaySound(key, gainValue) {
  const buf = _sounds[key];
  if (!buf) return false;
  const ctx = _getAudioCtx();
  if (!ctx) return false;
  if (ctx.state === 'suspended') ctx.resume();
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.value = gainValue ?? 1.0;
  src.connect(g);
  g.connect(ctx.destination);
  src.start();
  return true;
}

// Distance-attenuated variant — uses the same squared-falloff as sound.js.
// Returns true if the override consumed the event (even when inaudible).
function assetsPlaySoundDist(key, maxGain, dist, maxDist) {
  if (!_sounds[key]) return false;
  const linear = (dist >= maxDist) ? 0 : 1 - dist / maxDist;
  const vol = linear * linear * (maxGain ?? 1.0);
  if (vol < 0.02) return true;   // consumed but inaudible — skip procedural too
  return assetsPlaySound(key, vol);
}
