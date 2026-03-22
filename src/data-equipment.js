// ═══════════════════════════════════════════════════════════
//  NPC HULL DEFINITIONS (§6)
// ═══════════════════════════════════════════════════════════
// hp = total; armour=60%, struct=40%. spd/turn at T3 baseline.
const NPC_HULLS = {
  militia_fighter: { name:'PATROL FIGHTER', hp:55, spd:300, maxSpd:560, turn:2.4, sz:11, reward:0,
    model:M_SHIP, scale:5 },
  cruiser: { name:'CRUISER', hp:125, spd:150, maxSpd:360, turn:1.1, sz:20, reward:260,
    model:M_CRUISER, scale:7 },
  recovery_ship: { name:'RECOVERY SHIP', hp:55, spd:90, maxSpd:200, turn:0.8, sz:14, reward:60,
    model:M_RECOVERY, scale:6 },
  shuttle_npc: { name:'SHUTTLE', hp:38, spd:330, maxSpd:600, turn:2.8, sz:12, reward:55,
    model:M_SHUTTLE, scale:5 },
  courier_npc: { name:'COURIER', hp:68, spd:265, maxSpd:530, turn:2.2, sz:15, reward:85,
    model:M_COURIER, scale:5 },
  gunship_npc: { name:'GUNSHIP', hp:190, spd:135, maxSpd:340, turn:1.0, sz:24, reward:240,
    model:M_GUNSHIP, scale:7 },
  freighter_npc: { name:'FREIGHTER', hp:200, spd:50, maxSpd:120, turn:0.4, sz:22, reward:0,
    model:M_FREIGHT, scale:8 },
};

// ═══════════════════════════════════════════════════════════
//  AI CONFIGURATION (§7 — all tuning constants here)
// ═══════════════════════════════════════════════════════════
const AI_CFG = {
  militia: { patrolR:480, chaseLeash:750, pingLeash:2400, fleeHpRatio:0.2, fleeDur:6, distressCd:10 },
  corporate: { patrolR:420, chaseLeash:680 },
  merc: { chaseLeash:1100, fleeHpRatio:0.2, fleeDur:8, escortLeash:600, noDistressTimer:15 },
  pirate: { huntThresh:4, baseR:380, baseLeash:700, fleeHpRatio:.25, fleeDur:8, safeR:1400 },
  cargo: { dockR:90, respawnMinMs:2000, respawnRangeMs:3000, distressRange:3000 },
  pirateRespawnMs: 8000,
};

// Faction spawn distributions (§6 hull distributions + engine tier ranges)
const FACTION_SPAWNS = {
  militia: [ {hull:'courier_npc',w:60}, {hull:'gunship_npc',w:40} ],
  pirate:  [ {hull:'shuttle_npc',w:50}, {hull:'courier_npc',w:50} ],
  cargo:   [ {hull:'freighter_npc',w:100} ],
  merc:    [ {hull:'gunship_npc',w:50}, {hull:'militia_fighter',w:50} ],
  corporate:[ {hull:'militia_fighter',w:60}, {hull:'cruiser',w:40} ],
  recovery: [ {hull:'recovery_ship',w:100} ],
};

// Engine tier range per AI role (from §6 Spawn Distributions)
const FACTION_TIER_RANGE = {
  militia:   [3,3],   // Sol Police: T3 only
  corporate: [2,3],   // Hegemony: T2-T3
  pirate:    [1,3],   // Clans: T1-T3
  cargo:     [1,3],   // Merchant freighters: T1-T3
  merc:      [2,4],   // Ironclad Mercs: T2-T4
  recovery:  [1,2],   // Recovery ships: T1-T2
};

function pickHull(dist){
  let total=0; dist.forEach(d=>total+=d.w);
  let r=Math.random()*total;
  for(const d of dist){ r-=d.w; if(r<=0) return d.hull; }
  return dist[dist.length-1].hull;
}

// ═══════════════════════════════════════════════════════════
//  §2 PLAYER SHIP & EQUIPMENT
// ═══════════════════════════════════════════════════════════

// ── SHIP DEFINITIONS ──
const SHIP_DEFS = {
  shuttle:    { name:'SHUTTLE',      tier:1, sz:12, mass:20,  struct:100, cargo:20,  maxFuel:100,
    hardpoints:['M'],                   engineSlots:1, price:0,     col:'#00ffcc',
    desc:'Fast scout. One weapon + one engine.' },
  courier:    { name:'COURIER',      tier:2, sz:15, mass:45,  struct:140, cargo:40,  maxFuel:140,
    hardpoints:['M','B'],               engineSlots:1, price:12000, col:'#44ddff',
    desc:'Light hauler. Two weapons, one engine.' },
  recovery_ship:{ name:'RECOVERY SHIP', tier:2, sz:15, mass:60, struct:160, cargo:80, maxFuel:200,
    hardpoints:['M'],                   engineSlots:2, price:28000, col:'#ff9944',
    desc:'Salvage & support. Single weapon, twin engines.' },
  fighter:    { name:'FIGHTER',      tier:3, sz:18, mass:80,  struct:200, cargo:30,  maxFuel:170,
    hardpoints:['B','M','L'],           engineSlots:2, price:35000, col:'#88aaff',
    desc:'Combat specialist. B·M·L hardpoints.' },
  freighter:  { name:'FREIGHTER',    tier:3, sz:22, mass:120, struct:260, cargo:200, maxFuel:380,
    hardpoints:['M'],                   engineSlots:2, price:65000, col:'#88ff44',
    desc:'Bulk hauler. Massive cargo, single weapon.' },
  gunship:    { name:'GUNSHIP',      tier:4, sz:24, mass:150, struct:300, cargo:60,  maxFuel:240,
    hardpoints:['B','L','H','B'],       engineSlots:2, price:90000, col:'#cc88ff',
    desc:'Heavy warship. B·L·H·B quad mount.' },
  dreadnought:{ name:'DREADNOUGHT', tier:5, sz:32, mass:300, struct:500, cargo:120, maxFuel:360,
    hardpoints:['B','L','H','L','B'],   engineSlots:3, price:220000,col:'#ff88cc',
    desc:'Capital ship. Five hardpoints, triple engine.' },
};

const CARGO_MASS = 2; // tonnes per cargo unit

// ── ENGINE TIERS ──
// thrustForce per slot. Total acc = sum(installed) / totalMass.
// turn & maxSpd from BEST single engine installed.
const ENGINE_TIERS = [
  { name:'IMPULSE Mk.I',  tier:1, thrustForce:1600,  baseTurn:0.8, baseMaxSpd:220, fuelRate:0.06, price:0      },
  { name:'IMPULSE Mk.II', tier:2, thrustForce:4050,  baseTurn:1.4, baseMaxSpd:360, fuelRate:0.11, price:3500   },
  { name:'VECTOR Mk.I',   tier:3, thrustForce:8000,  baseTurn:2.0, baseMaxSpd:470, fuelRate:0.16, price:10000  },
  { name:'VECTOR Mk.II',  tier:4, thrustForce:18750, baseTurn:2.5, baseMaxSpd:550, fuelRate:0.22, price:28000  },
  { name:'APEX DRIVE',    tier:5, thrustForce:28000, baseTurn:2.8, baseMaxSpd:600, fuelRate:0.30, price:65000  },
];

// NPC engine tier picker — must be after ENGINE_TIERS
const NPC_TIER_WEIGHTS = [75, 20, 5];
const NPC_ENGINE_BASELINE = ENGINE_TIERS[2]; // T3 = ECFG reference

function pickNPCEngine(minTier, maxTier){
  const pool = ENGINE_TIERS.filter(e => e.tier >= minTier && e.tier <= maxTier);
  if(!pool.length) return ENGINE_TIERS[0];
  let total = 0;
  const weighted = pool.map((eng, i) => {
    const wt = NPC_TIER_WEIGHTS[i] ?? 1;
    total += wt;
    return { eng, wt };
  });
  let roll = Math.random() * total;
  for(const entry of weighted){
    roll -= entry.wt;
    if(roll <= 0) return entry.eng;
  }
  return weighted[weighted.length - 1].eng;
}

// ── ARMOUR TYPES ──
// maxArmour = ship.struct * mult
const ARMOUR_TYPES = [
  { name:'HULL PLATING I',   tier:1, mult:2, price:0      },
  { name:'HULL PLATING II',  tier:2, mult:3, price:4000   },
  { name:'COMPOSITE ARMOUR', tier:3, mult:4, price:14000  },
  { name:'REACTIVE ARMOUR',  tier:4, mult:5, price:38000  },
  { name:'AEGIS PLATING',    tier:5, mult:6, price:95000  },
];

// ── WEAPONS ──
// Ballistic (5 tiers)
const WPN_BALLISTIC = [
  { key:'b1',tier:1,type:'ballistic',name:'AUTO CANNON',   dmgA:2, dmgS:4, velocity:680, cd:0.14,impact:55, range:750, col:'#ffcc44',price:0 },
  { key:'b2',tier:2,type:'ballistic',name:'CHAIN GUN',     dmgA:4, dmgS:7, velocity:750, cd:0.12,impact:80, range:850, col:'#ffaa22',price:8000 },
  { key:'b3',tier:3,type:'ballistic',name:'REPEATER',      dmgA:8, dmgS:12,velocity:800, cd:0.15,impact:120,range:920, col:'#ff8800',price:22000 },
  { key:'b4',tier:4,type:'ballistic',name:'HEAVY CANNON',  dmgA:14,dmgS:20,velocity:860, cd:0.30,impact:200,range:1050,col:'#ff6600',price:55000 },
  { key:'b5',tier:5,type:'ballistic',name:'MASS DRIVER',   dmgA:24,dmgS:36,velocity:950, cd:0.50,impact:360,range:1200,col:'#ff4400',price:130000 },
];
// Laser (5 tiers) — dmg = total over beam duration
const WPN_LASER = [
  { key:'l1',tier:1,type:'laser',name:'ALPHA LASER',  dmgA:33, dmgS:33, beamDur:1.0,cd:0.8, range:500, col:'#00ffff',price:0 },
  { key:'l2',tier:2,type:'laser',name:'BETA LASER',   dmgA:82, dmgS:82, beamDur:1.2,cd:0.9, range:620, col:'#22ddff',price:9000 },
  { key:'l3',tier:3,type:'laser',name:'PULSE LASER',  dmgA:142,dmgS:142,beamDur:1.5,cd:1.0, range:720, col:'#44bbff',price:25000 },
  { key:'l4',tier:4,type:'laser',name:'HEAVY LASER',  dmgA:145,dmgS:145,beamDur:1.8,cd:1.2, range:840, col:'#8888ff',price:60000 },
  { key:'l5',tier:5,type:'laser',name:'SIEGE LASER',  dmgA:189,dmgS:189,beamDur:2.2,cd:1.5, range:960, col:'#aa66ff',price:140000 },
];
// Hypervelocity (5 tiers)
const WPN_HYPERVEL = [
  { key:'h1',tier:1,type:'hypervelocity',name:'PLASMA CANNON',   dmgA:2, dmgS:3, velocity:1400,cd:0.50,impact:140,range:900, col:'#cc88ff',price:0 },
  { key:'h2',tier:2,type:'hypervelocity',name:'ION CANNON',      dmgA:5, dmgS:7, velocity:1600,cd:0.60,impact:200,range:1050,col:'#bb66ff',price:10000 },
  { key:'h3',tier:3,type:'hypervelocity',name:'RAIL GUN',        dmgA:9, dmgS:13,velocity:1900,cd:0.80,impact:310,range:1200,col:'#aa44ff',price:28000 },
  { key:'h4',tier:4,type:'hypervelocity',name:'GAUSS CANNON',    dmgA:16,dmgS:23,velocity:2200,cd:1.10,impact:480,range:1400,col:'#9922ff',price:68000 },
  { key:'h5',tier:5,type:'hypervelocity',name:'SINGULARITY GUN', dmgA:28,dmgS:40,velocity:2600,cd:1.50,impact:720,range:1600,col:'#7700ee',price:150000 },
];

// Flat lookup
const ALL_WEAPONS = {};
[...WPN_BALLISTIC,...WPN_LASER,...WPN_HYPERVEL].forEach(w=>ALL_WEAPONS[w.key]=w);

// Helper: get T1 weapon by type
function t1Weapon(type){
  if(type==='ballistic') return WPN_BALLISTIC[0];
  if(type==='laser') return WPN_LASER[0];
  if(type==='hypervelocity') return WPN_HYPERVEL[0];
  return WPN_BALLISTIC[0];
}

// Hardpoint compatibility check
function hpAccepts(hpType, wpnType){
  if(hpType==='M') return true;
  if(hpType==='B') return wpnType==='ballistic';
  if(hpType==='L') return wpnType==='laser';
  if(hpType==='H') return wpnType==='hypervelocity';
  return false;
}

// ── PLAYER PHYSICS CALC ──
// Called whenever equipment changes to recalculate derived stats.
function calcPlayerPhysics(p){
  const ship = SHIP_DEFS[p.shipKey];
  const totalMass = ship.mass + p.cargoUsed * CARGO_MASS;

  // Sum thrust from all engine slots
  let totalThrust = 0, bestEngine = ENGINE_TIERS[0];
  p.engines.forEach(eIdx => {
    const eng = ENGINE_TIERS[eIdx];
    totalThrust += eng.thrustForce;
    if(eng.tier > bestEngine.tier) bestEngine = eng;
  });

  p.thrustF = totalThrust / totalMass;
  p.turnRate = bestEngine.baseTurn;
  p.maxSpd = bestEngine.baseMaxSpd;
  p.fuelRate = p.engines.reduce((sum,eIdx) => sum + ENGINE_TIERS[eIdx].fuelRate, 0);
  p.totalMass = totalMass;
}

// Weapon group info
function getWeaponGroups(p){
  const groups = {};
  p.hardpoints.forEach(hp => {
    if(!hp.weapon) return;
    const t = hp.weapon.type;
    if(!groups[t]) groups[t] = [];
    groups[t].push(hp);
  });
  return groups;
}

function cycleWeaponGroup(p){
  const groups = getWeaponGroups(p);
  const types = Object.keys(groups);
  if(types.length <= 1) return;
  const idx = types.indexOf(p.activeGroup);
  p.activeGroup = types[(idx+1) % types.length];
}

// Starting weapon choice (set before init)
let startingWeaponType = 'ballistic';
let invertPitch = false;

// ── NPC weapon table (unchanged) ──
const EWPN = {
  ballistic:{ dmg:6, speed:490, cd:.6, range:600, col:'#ff6644', sz:2 },
  laser:    { dmg:4, speed:1800, cd:1.4, range:380, col:'#ff4488', sz:1.5 },
  hypervel: { dmg:5, speed:1100, cd:1.0, range:650, col:'#dd88ff', sz:2.5 },
};
function pickEWpn(){ const k=['ballistic','laser','hypervel']; return EWPN[k[Math.floor(Math.random()*3)]]; }

// ── GOODS ──
const GOODS=['food','medicine','ore','metal','tech','weapons','machinery'];
const GNAMES={food:'RATIONS',medicine:'MEDIPACKS',ore:'RAW ORE',metal:'METALS',
  tech:'TECH PARTS',weapons:'ARMS',machinery:'MACHINERY'};
const GBASE={food:15,medicine:55,ore:20,metal:48,tech:90,weapons:130,machinery:80};
