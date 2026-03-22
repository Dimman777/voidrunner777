# VOIDRUNNER — Modularisation & Three.js Migration Plan

## Overview

The current single-file build (`voidrunner-fp.html`) is ~5,200 lines. There are two distinct goals this document addresses, and they reinforce each other:

1. **Modularisation** — break the file into independently-workable chunks so a session with an AI assistant can load *one module* at a time rather than the whole file.
2. **Three.js migration** — replace the hand-rolled canvas/projection renderer with Three.js, which buys real lighting, post-processing, and a maintained scene graph.

The critical observation is that **almost all of the game logic has zero coupling to the renderer**. The renderer is an isolated layer. Separating it first makes the Three.js swap a bounded, well-defined task rather than a surgery-on-a-patient kind of job.

---

## Current Line Budget (approximate)

| Section | Lines | Notes |
|---|---|---|
| CSS + HTML scaffolding | 300 | Title screen, trade screen, HUD elements |
| Math helpers | 90 | v3, quat, proj, w2c |
| Wireframe model definitions | 260 | mk* functions + constants |
| Equipment & NPC data | 260 | Ship/engine/armour/weapon tables, NPC hulls |
| AI configuration | 30 | AI_CFG, FACTION_SPAWNS, tier ranges |
| Faction / simulation | 280 | FACTIONS_INIT, goals, fast/slow ticks |
| Star systems | 100 | SYS, jump links, nav |
| Game state + init | 110 | G object, init(), pickStation() |
| NPC factory + spawning | 170 | makeNPC, spawnNPC, spawnCapital |
| Input handlers | 80 | keydown/up, mousemove |
| Trading & shipyard UI | 380 | dock, buildMarket, buildShipyard, buy* fns |
| Missions | 560 | STORY_MISSIONS, generate/accept/update |
| Player update | 350 | Physics, firing, proximity, outlaw |
| Bullet & physics update | 260 | updBullets, damageNPC, eDeath |
| NPC AI (updEnemies) | 520 | All six AI role switch arms |
| Renderer (draw + HUD) | 900 | draw(), drawTargeting, drawCockpit, drawRadar |
| Loop + startup | 50 | loop(), init trigger |
| **Total** | **~5,200** | |

---

## Proposed Module Split

### `math.js` (~90 lines) — Pure, no dependencies

All vector and quaternion helpers:

```
v3, v3add, v3sub, v3scale, v3dot, v3len, v3norm, v3cross
quat, qmul, qnorm, qconj, qrotv, qfromAxisAngle
qFwd, qRight, qUp
w2c (world-to-camera transform)
proj (perspective projection)
PI, PI2, DEG constants
```

**Three.js migration note:** Most of these become `THREE.Vector3` / `THREE.Quaternion` method calls. Keep the file but thin it down to wrappers, or drop it entirely and update call sites. `w2c` and `proj` disappear entirely — Three.js handles those with `PerspectiveCamera`.

---

### `data-models.js` (~260 lines) — Pure geometry, no runtime deps

All wireframe model factory functions and their pre-computed constants:

```
mkShip, mkPirate, mkFreighter, mkStation, mkPBase
mkCruiser, mkGunship, mkCourier, mkShuttleNPC, mkRecovery
mkFrigate, mkDreadnought
scaleM
M_SHIP, M_PIRATE, M_FREIGHT, M_STATION, M_PBASE,
M_CRUISER, M_GUNSHIP, M_COURIER, M_SHUTTLE, M_RECOVERY
M_FRIGATE, M_DREADNOUGHT
CAP_DEFS (capital ship definitions, references M_* constants)
```

**Three.js migration note:** Each factory gets a paired function:

```js
// Current
function mkShip() { return { verts:[...], edges:[...] }; }

// Three.js companion
function mkShipGeometry() {
  const geo = new THREE.BufferGeometry();
  const { verts, edges } = mkShip();
  const positions = [];
  edges.forEach(([a, b]) => {
    positions.push(...verts[a], ...verts[b]);
  });
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geo;
}
```

Each `LineSegments` object is created once and cloned per entity. The raw `{verts, edges}` format is still needed for MFD wireframe rendering (2D mini-view in the targeting panel) and for the starmap, so both coexist.

---

### `data-equipment.js` (~300 lines) — Pure data, no runtime deps

Everything a player can own or buy, plus NPC configuration tables:

```
SHIP_DEFS
ENGINE_TIERS
ARMOUR_TYPES
WPN_BALLISTIC, WPN_LASER, WPN_HYPERVEL, ALL_WEAPONS
NPC_HULLS
NPC_TIER_WEIGHTS, NPC_ENGINE_BASELINE
AI_CFG
FACTION_SPAWNS, FACTION_TIER_RANGE
GOODS, GNAMES, GBASE
CARGO_MASS
EWPN (NPC weapon table)
Helper fns: hpAccepts, t1Weapon, pickHull, pickNPCEngine, pickEWpn
```

**Three.js migration note:** Zero coupling to renderer. Drops in unchanged.

---

### `data-systems.js` (~100 lines) — Pure data, no runtime deps

All star system geography and jump network:

```
SYS  (sol, proxima, sirius, vega — stations, pBases, launchZone, planets)
SM_LINKS, SM_POS
JUMP_FUEL
OUTLAW_THRESHOLD, OUTLAW_TIME, OUTLAW_SAFE_DIST
```

**Three.js migration note:** Zero coupling. Drops in unchanged. Planet and station positions are just `v3(x,y,z)` coordinates — Three.js uses the same numbers.

---

### `faction-sim.js` (~350 lines) — Game logic, reads G.stations but nothing visual

```
FACTIONS_INIT, FACTIONS (live runtime copy)
GOALS system (SURVIVE, SUPPRESS, DESTABILIZE, PROTECT_ROUTES)
initFactions, getFaction, allFactions
repLabel, repCol
adjustRep, adjustStr, adjustEcon
simEvent (pushes to G.eventQueue)
evalGoals
fastTick (45s — event processing, spawn weights, bounties)
slowTick (5 min — world evolution, relationship drift)
fastTickT, slowTickT (timers, live in this module)
```

**Dependencies:** Reads `G.stations` and `G.eventQueue`. Everything else is self-contained.

**Three.js migration note:** Zero coupling to renderer. The only G reference is reading station counts and the event queue — both survive the migration unchanged.

---

### `npc.js` (~700 lines) — Game logic, pushes to G arrays

NPC factory, spawn logic, AI update loop:

```
makeNPC
spawnNPC
spawnCapital
npcForward (derives facing from yaw/pitch)
steerTo (angular steering toward a world position)
moveNPC (thrust + drag physics, identical to 2D source)
npcFireAt (shoot at a position, pushes to G.eBullets)
npcCombatNPC (NPC-vs-NPC reactive combat + cargo flee trigger)
broadcastDistress
eDeath (drops cargo boxes, posts SHIP_DESTROYED event, handles mission kills)
updEnemies (main switch: militia, corporate, merc, pirate, cargo, recovery, capital)
```

**Dependencies:** `G.enemies`, `G.eBullets`, `G.cargoBoxes`, `G.parts`, `G.shockwaves`, `G.missions`. Calls `flash()` (can be an injected callback). No rendering calls.

**Three.js migration note:** Logic is fully renderer-agnostic. The Three.js renderer reads `e.pos` / `e.yaw` / `e.pitch` each frame to position the pre-created `LineSegments` objects. The only change required is in `eDeath`: instead of directly pushing to `G.parts`, it can push events to a VFX queue that the renderer reads.

---

### `player.js` (~350 lines) — Game logic, reads keys/mouse

Player-specific physics and input:

```
calcPlayerPhysics (derives thrustF, turnRate, maxSpd from equipment)
getWeaponGroups, cycleWeaponGroup
startingWeaponType, invertPitch (pre-game config state)
keydown/keyup/mousemove/mousedown event listeners
Player update logic (inside update()):
  — pitch/yaw/roll from mouse + keys
  — thrust, drag, fuel burn
  — weapon firing (pushes to G.bullets or sets laserBeam)
  — laser beam hit check (raycasts against G.enemies)
  — station proximity (sets G.nearSt)
  — launch zone proximity (sets G.nearLZ)
  — outlaw timer
  — targeting validation
```

**Three.js migration note:** Physics and input are unchanged. Mouse coordinates become `THREE.Vector2` for raycasting if needed, but the current look-control model (mX/mY as screen fractions) continues to work fine.

---

### `missions.js` (~560 lines) — Game logic + UI, no rendering

```
STORY_MISSIONS (10-mission arc, gates, dialogue, act structure)
generateMissions (procedural: escort, bounty, delivery, suppression, intel)
refreshMissionBoard
buildMissionsPanel (writes innerHTML, calls tMsg)
acceptMission, abandonMission
missionProgress
updateMissions (called each frame — checks completion, triggers rewards)
```

**Dependencies:** `G.missions`, `G.stations`, `G.enemies`, `FACTIONS`, `STORY_MISSIONS`. Calls `flash()` and `tMsg()`.

**Three.js migration note:** Entirely UI/logic. No coupling to canvas. The mission waypoint marker drawing lives in `renderer.js` and reads from `G.missions.active`.

---

### `trading-ui.js` (~500 lines) — HTML/CSS UI, no canvas

Everything that runs inside the dock screen:

```
dkSt, dkTab (docking state)
switchTab
dock, undock
buildMarket, buildShipyard, buildRepScreen, buildFlavourText
window.buyG, sellG, buyShip, buyEngine, buyArmour, buyWeapon (purchase handlers)
window.switchTab (exposed to inline HTML onclick)
tMsg (trade message helper)
buildRepScreen
```

**Three.js migration note:** This module is pure HTML manipulation. It has zero canvas coupling and zero rendering coupling. It is already effectively "ported" — nothing changes.

---

### `renderer.js` (~900 lines) — THE THREE.JS TARGET

Everything that touches `ctx` (2D canvas) or the Three.js scene:

```
Canvas setup (W, H, CX, CY, ctx, canvas element)
draw() — master draw dispatcher
drawWireframe(model, worldPos, yaw, pitch, scale, col, alpha)
drawMesh (capital ship variant)
drawBullets
drawVFX (particles, shockwaves, HV flashes, cargo boxes)
drawStars (background star field)
drawPlanets
drawStations, drawPBases, drawLaunchZone
drawCockpit (cockpit frame, artificial horizon, pitch ladder)
drawHUD (canvas-drawn elements: speed bar, damage sparks)
drawRadar
drawTargeting (brackets, lock square, lead reticle, MFD panels)
drawMFDWireframe (2D mini model view, used in targeting panel)
drawDirIndicator (off-screen arrows)
drawMissionMarker
updHUD (DOM HUD — bars, credits, weapon group display)
flash, flashT, bigWarn (flash message system)
```

**Three.js migration note — see detailed section below.**

---

### `game.js` (~200 lines) — Wiring

```
G (master game state object)
init()
loop() (requestAnimationFrame, dt calculation, update + draw dispatch)
jumpSystem (system transition logic)
getNavList, validateTargets, pickStation
Startup event wiring (start-btn, restart-btn onclick)
```

**Three.js migration note:** `loop()` gains a `THREE.Clock` and calls `renderer.render(scene, camera)`. `init()` now also calls `renderer.initScene()`.

---

## Three.js Renderer Migration — Detail

### What gets replaced

| Current | Three.js equivalent |
|---|---|
| `canvas` + `ctx` (2D) | `THREE.WebGLRenderer` |
| `w2c` + `proj` | `THREE.PerspectiveCamera` |
| `drawWireframe` | `THREE.LineSegments` positioned each frame |
| Background stars (500 pts) | `THREE.Points` with `BufferGeometry` |
| Planets (filled circles) | `THREE.Mesh` with `SphereGeometry` + emissive mat |
| Bullets | Instanced `LineSegments` or `Points` pool |
| Particles | `THREE.Points` pool with per-frame position update |
| Shockwaves | Expanding `RingGeometry` mesh |
| HV flashes | `Line` with two-point geometry |
| Cockpit frame | Static `THREE.LineSegments` pinned to camera-space |
| Radar | Stays as a 2D canvas overlay (HTML `<canvas>`) |
| MFD wireframe | Stays as a 2D canvas overlay (same canvas as radar) |

### What stays unchanged

The DOM-based HUD elements (health bars, credits display, dock prompt, weapon selector) are already HTML/CSS — they stay exactly as they are, layered on top of the Three.js canvas via `z-index`.

The radar and MFD mini-wireframe are easiest to keep as a second 2D canvas drawn on top of the Three.js canvas. Rewriting them as Three.js orthographic pass is possible but offers little value.

### Scene graph layout

```
THREE.Scene
├── ambientLight (dim, col #112244)
├── playerShip (Object3D — camera anchored here, not parented)
│   └── (no geometry — player is a camera viewpoint)
├── npcGroup (Object3D)
│   ├── enemy_0 (Object3D, contains LineSegments + PointLight glow)
│   ├── enemy_1
│   └── ...  (pool of pre-created slots, hidden when unused)
├── stationGroup
│   └── station_N (LineSegments, rotated each frame)
├── pBaseGroup
├── launchZoneGroup
├── planetGroup
│   └── planet_N (Mesh with SphereGeometry)
├── bulletGroup (pool of Line objects)
├── eBulletGroup
├── particleSystem (Points — single BufferGeometry, positions updated each frame)
├── shockwaveGroup
├── hvFlashGroup
└── starField (Points — static, pinned to camera follow group)
```

### Camera setup

```js
const camera = new THREE.PerspectiveCamera(90, W/H, 1, 60000);
// Each frame:
camera.position.copy(G.p.pos);    // {x,y,z} from game state
camera.quaternion.copy(G.p.ori);  // already a quat
```

The existing quaternion flight model maps directly — no conversion needed.

### Cockpit overlay

The cockpit frame (the parallelogram "windshield" lines) and pitch ladder are best kept as a separate orthographic pass or a static `LineSegments` geometry in camera-local space (child of camera object). The artificial horizon roll can be applied via `Object3D.rotation.z`.

### Migration sequence (recommended order)

**Phase 1 — Modularise first, Three.js second.** Splitting into the modules above does not require any Three.js changes. Ship it as ES modules (or a simple include order in the HTML) with the canvas renderer still intact.

**Phase 2 — Swap renderer only.**
1. Create `renderer-threejs.js` alongside `renderer.js`.
2. Implement `initScene()`, `drawFrame(G)`, `disposeScene()`.
3. Replace the `draw()` call in `loop()` with `drawFrame(G)`.
4. Keep the 2D canvas for radar/MFD overlay — it goes over the Three.js canvas via CSS `position:absolute`.

**Phase 3 — Enhance.**
With Three.js in place, the following become tractable:
- Bloom/glow via `UnrealBloomPass` (EffectComposer)
- Proper depth fog for the star field
- Engine exhaust via `THREE.Sprite` or particle shader
- Shadow casting on capital ships
- Normal-mapped planet surfaces

### Dependency ordering for include/bundling

If staying with vanilla script tags (no bundler):

```html
<script src="math.js"></script>
<script src="data-models.js"></script>       <!-- needs math.js for v3() -->
<script src="data-equipment.js"></script>
<script src="data-systems.js"></script>       <!-- needs v3() for positions -->
<script src="faction-sim.js"></script>        <!-- needs G (injected at init) -->
<script src="npc.js"></script>               <!-- needs G, FACTIONS, data-* -->
<script src="player.js"></script>            <!-- needs G, data-equipment -->
<script src="missions.js"></script>          <!-- needs G, FACTIONS, SYS -->
<script src="trading-ui.js"></script>        <!-- needs G, data-equipment -->
<script src="renderer.js"></script>          <!-- needs everything above -->
<script src="game.js"></script>              <!-- wires it all together -->
```

If using ES modules (`type="module"`), each file gets explicit `import` statements which also makes the Three.js import clean:

```js
// renderer-threejs.js
import * as THREE from 'https://cdn.skypack.dev/three@0.160.0';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
```

---

## Working-session token budget

With modularisation complete, a session focused on a specific domain only needs to load one or two files:

| Task | Files to load | Estimated lines |
|---|---|---|
| Tune AI behaviour | `npc.js` + `data-equipment.js` | ~1,000 |
| Add a new weapon tier | `data-equipment.js` | ~300 |
| Fix faction simulation bug | `faction-sim.js` | ~350 |
| Add a story mission | `missions.js` | ~560 |
| Tweak market/shipyard UI | `trading-ui.js` | ~500 |
| New star system | `data-systems.js` | ~100 |
| Three.js renderer work | `renderer-threejs.js` + `data-models.js` | ~1,200 |
| Physics tuning | `player.js` + `npc.js` | ~1,050 |

Compare to the current situation where *every* session loads 5,200 lines.

---

## Notes on the Intel Mission Fix

Before or during modularisation, the intel mission mechanic needs the following fixes regardless of renderer:

- A visible 3D marker at `M.active._scanTarget` (handled in `renderer.js` → `drawMissionMarker` already has partial support)
- A dwell timer: player must stay within `_scanRadius` for ~3 seconds before `_scanned` flips true (add to `updateMissions` in `missions.js`)
- Waypoint arrow already implemented for intel in `drawMissionMarker` — just needs the dwell requirement to make it meaningful

This is entirely in `missions.js` and `renderer.js` once they are split out.

---

## Summary

The modularisation is a mechanical refactor with no logic changes. Each module boundary is already present as a section comment (`// ══════...`) in the existing file — the split follows the grain of the existing structure. The Three.js migration then becomes a targeted rewrite of `renderer.js` only, with every other module untouched.
