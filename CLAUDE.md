# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VOIDRUNNER is a browser-based 3D space combat/trading game. The current codebase is a single monolithic HTML file (`voidrunner-fp (36).html`, ~5,200 lines). There is an active architecture plan (`VOIDRUNNER_architecture.md`) to split it into ES modules and migrate from a hand-rolled 2D canvas renderer to Three.js.

## Running the Game

Open `voidrunner-fp (36).html` directly in a browser. No build step, no server, no dependencies to install. It is self-contained vanilla JS.

## Architecture

The single HTML file is divided into these logical sections (in order):

| Section | ~Lines | Purpose |
|---|---|---|
| CSS + HTML scaffolding | 300 | Title, trade, starmap, game-over screens; HUD DOM |
| Math helpers | 90 | `v3`, `quat`, `proj`, `w2c` — pure vector/quaternion math |
| Wireframe model definitions | 260 | `mk*` factory functions, `M_*` pre-computed constants, `CAP_DEFS` |
| Equipment & NPC data | 300 | `SHIP_DEFS`, `ENGINE_TIERS`, `WPN_*`, `NPC_HULLS`, `GOODS`, `AI_CFG` |
| Faction / simulation | 280 | `FACTIONS`, goals system, `fastTick`/`slowTick`, `adjustRep` |
| Star systems | 100 | `SYS`, `SM_LINKS`, `SM_POS`, `JUMP_FUEL` |
| Game state + init | 110 | `G` master object, `init()`, `pickStation()` |
| NPC factory + spawning | 170 | `makeNPC`, `spawnNPC`, `spawnCapital` |
| Input handlers | 80 | `keydown`/`keyup`, `mousemove` |
| Trading & shipyard UI | 380 | `dock`, `buildMarket`, `buildShipyard`, `buy*` handlers |
| Missions | 560 | `STORY_MISSIONS` (10-mission arc), procedural generation, `updateMissions` |
| Player update | 350 | Physics, firing, proximity checks, outlaw timer |
| Bullet & physics update | 260 | `updBullets`, `damageNPC`, `eDeath` |
| NPC AI (`updEnemies`) | 520 | Six AI roles: militia, corporate, merc, pirate, cargo, recovery/capital |
| Renderer (`draw` + HUD) | 900 | All `draw*` functions, `updHUD`, `flash`, radar, targeting MFD |
| Loop + startup | 50 | `loop()`, `requestAnimationFrame`, start/restart wiring |

**Key global:** `G` is the master game state object (player, enemies, bullets, stations, missions, etc.). Nearly every function reads or mutates `G`.

## Planned Module Split

`VOIDRUNNER_architecture.md` defines the full modularisation plan. When the split is complete, the load order is:

```
math.js → data-models.js → data-equipment.js → data-systems.js →
faction-sim.js → npc.js → player.js → missions.js → trading-ui.js →
renderer.js → game.js
```

The renderer is the only section with canvas coupling. All game logic modules (`faction-sim`, `npc`, `player`, `missions`, `trading-ui`) have zero rendering dependencies and can be worked on independently once extracted.

## Three.js Migration Plan

See `VOIDRUNNER_architecture.md` — "Three.js Renderer Migration" section. Key points:

- `renderer.js` is the sole migration target; all other modules are unchanged.
- Camera maps directly: `G.p.pos` → `camera.position`, `G.p.ori` (quaternion) → `camera.quaternion`.
- Radar and MFD mini-wireframe stay as a 2D `<canvas>` overlay on top of the Three.js canvas.
- DOM HUD elements (health bars, credits, weapon selector) stay as HTML/CSS, layered via `z-index`.

## Known Pending Work

- **Intel mission fix** (`missions.js` + `renderer.js`): needs a ~3-second dwell timer at `M.active._scanTarget` before `_scanned` flips true.
- The waypoint arrow for intel missions is partially implemented in `drawMissionMarker` but lacks the dwell requirement.
