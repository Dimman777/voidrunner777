// ═══════════════════════════════════════════════════════════
//  NPC FACTORY — creates properly typed NPC entities
// ═══════════════════════════════════════════════════════════
// homeObj: pirate base or station; overrideFid: optional faction id; isHostile: optional bool
function spawnCapital(homeObj, overrideFid, isHostile){
  const fid = overrideFid || homeObj.factionId || 'f07';
  const fStr = FACTIONS[fid]?.str || 50;
  const dreadChance = 0.05 + (fStr/100)*0.2;
  const type = Math.random() < dreadChance ? 'dreadnought' : 'frigate';
  const def = CAP_DEFS[type];

  let pos, _tries=0;
  do {
    const a=Math.random()*PI2, d=300+Math.random()*400;
    pos = v3add(homeObj.pos, v3(Math.cos(a)*d,(Math.random()-.5)*80,Math.sin(a)*d));
    _tries++;
  } while(_tries<8 && G.asteroids?.some(ast=>v3len(v3sub(pos,ast.pos))<ast.r+60));

  const components = def.components.map(c=>({
    name:c.name, hp:c.hp, maxHp:c.hp, isCore:c.isCore,
    turrets:c.turrets, fireCd:1+Math.random()*2,
  }));

  const cap = {
    isCapital: true,
    capType: type,
    name: def.name,
    pos, vel:v3(0,0,0),
    yaw:Math.random()*PI2, pitch:0,
    speed:0, maxSpd:def.maxSpd, baseSpd:def.baseSpd,
    turnRate: def.turn,
    sz: def.sz,
    col: FACTIONS[fid]?.col || homeObj.col || '#ff4400',
    model: scaleM(def.model, def.scale),
    reward: def.reward,
    components,
    homeBase: homeObj,
    factionId: fid,
    aiSt:'patrol', aiT:Math.random()*5, patT:null,
    hostile: isHostile !== undefined ? isHostile : (FACTIONS[fid]?.cat==='criminal'),
    // NPC compat fields
    aiRole:'capital', hullKey:type,
    armour:0, maxArmour:0,
    struct: def.components.reduce((s,c)=>s+c.hp,0),
    maxStruct: def.components.reduce((s,c)=>s+c.hp,0),
    distressT:0, _cargo:[], _returning:false,
    _fleeing:false, _fleeTimer:0, _fledDamaged:false, _fleeDir:v3(0,0,1),
    _mercWpA:null, _mercWpB:null, _mercTarget:null, _mercEscort:false, _mercEscortNpc:null,
    // Capital patrol
    _capPhase:'returning', _capMidpoint:null, _capNavTarget:null, _capDwellT:0,
  };

  G.enemies.push(cap);
  return cap;
}

function makeNPC(hullKey, aiRole, col, pos){
  const hull = NPC_HULLS[hullKey];
  const totalHP = hull.hp;
  const armour = Math.round(totalHP * 0.6);
  const struct = totalHP - armour;
  const wpn = (hullKey === 'freighter_npc') ? null : pickEWpn();

  // Engine tier scaling — ECFG values are calibrated to T3 baseline.
  // Pick engine from faction tier range, then scale speed/turn.
  const tierRange = FACTION_TIER_RANGE[aiRole] || [1,3];
  const eng = pickNPCEngine(tierRange[0], tierRange[1]);
  const spdMult  = eng.baseMaxSpd / NPC_ENGINE_BASELINE.baseMaxSpd;
  const turnMult = eng.baseTurn   / NPC_ENGINE_BASELINE.baseTurn;

  return {
    hullKey, aiRole,
    type: aiRole,
    name: hull.name,
    pos: pos || v3(0,0,0),
    vel: v3(0,0,0),
    yaw: Math.random()*PI2, pitch: 0,
    speed: 0,
    maxSpd: hull.maxSpd * spdMult,
    baseSpd: hull.spd * spdMult,
    turnRate: hull.turn * turnMult,
    engineTier: eng.tier,
    // Two-pool damage
    armour, maxArmour: armour,
    struct, maxStruct: struct,
    hp: totalHP, maxHp: totalHP,
    sz: hull.sz,
    col: col || '#888888',
    model: scaleM(hull.model, hull.scale),
    reward: hull.reward,
    // Weapon
    wpn, fireCd: 0,
    // AI state
    aiSt: 'patrol', aiT: Math.random()*5,
    hostile: false,
    homeStation: null,
    homeBase: null,
    patT: null,
    routeA: null,
    routeB: null,
    escortTarget: null,
    fleeT: 0,
    distressT: 0,
    _cargo: [],
    _returning: false,
    // Pirate flee state
    _fleeing: false,
    _fleeTimer: 0,
    _fledDamaged: false,
    _fleeDir: v3(0,0,1),
    _attacker: null,          // who last hit us (entity ref)
    _combatTarget: null,      // who we're actively fighting (entity ref or 'player')
    _distressCd: 0,           // distress ping cooldown for police
    _noDistressTimer: 0,      // merc: time since last heard escort distress
    // Merc waypoints
    _mercWpA: null,
    _mercWpB: null,
    _mercTarget: null,
    _mercEscort: false,
    _mercEscortNpc: null,
    _capEscortOf: null,       // capital ship being escorted (fighter escort)
    _capEscortAngle: 0,       // orbit angle around the capital
    _capEscortDist: 0,        // orbit radius
  };
}

function spawnNPC(aiRole, factionCol, stationA, stationB, pirateBase){
  // Pick hull from faction distribution
  const dist = FACTION_SPAWNS[aiRole] || FACTION_SPAWNS.militia;
  const hullKey = pickHull(dist);

  // Colour by role — mercs use faction colour (grey)
  const col = factionCol || {
    militia:'#4488ff', pirate:'#ff4400', cargo:'#44ff88',
    merc:'#aaaaaa', corporate:'#cc44cc', recovery:'#ff9944',
  }[aiRole] || '#888888';

  // Position — mercs and cargo spawn near stations, not random
  let pos;
  if(pirateBase){
    let tries=0;
    do {
      const a=Math.random()*PI2, d=200+Math.random()*400;
      pos = v3add(pirateBase.pos, v3(Math.cos(a)*d, (Math.random()-.5)*100, Math.sin(a)*d));
      tries++;
    } while(tries<8 && G.asteroids?.some(ast=>v3len(v3sub(pos,ast.pos))<ast.r+30));
  } else if(stationA){
    const a=Math.random()*PI2, d=150+Math.random()*500;
    pos = v3add(stationA.pos, v3(Math.cos(a)*d, (Math.random()-.5)*100, Math.sin(a)*d));
  } else if(aiRole==='merc'){
    // Mercs always spawn near a station
    const st = pickStation();
    const a=Math.random()*PI2, d=150+Math.random()*300;
    pos = v3add(st.pos, v3(Math.cos(a)*d, (Math.random()-.5)*60, Math.sin(a)*d));
  } else {
    const a=Math.random()*PI2, d=2000+Math.random()*5000;
    pos = v3add(G.p.pos, v3(Math.cos(a)*d, (Math.random()-.5)*400, Math.sin(a)*d));
  }

  const e = makeNPC(hullKey, aiRole, col, pos);

  // Role-specific setup
  if(aiRole==='pirate'){
    e.hostile = true;
    e.homeBase = pirateBase || G.pBases[Math.floor(Math.random()*G.pBases.length)];
    e.factionId = e.homeBase?.factionId || 'f07';
  }
  if(aiRole==='militia' || aiRole==='corporate'){
    e.homeStation = stationA || pickStation();
    e.factionId = aiRole==='militia' ? (SYS[G.sys]?.systemPolice||'f01') :
                  (e.homeStation?.factionId || 'f04');
  }
  if(aiRole==='cargo'){
    e.routeA = stationA || pickStation();
    e.routeB = stationB || pickStation();
    const _lzs=e.routeB.landingZones;
    e.patT = _lzs ? _lzs[Math.floor(Math.random()*_lzs.length)].pos : e.routeB.pos;
    e.hostile = false;
    // _cargoOwner: faction whose assets are being transported (delivery payment recipient)
    e._cargoOwner = e.routeA?.factionId || 'f05';
    // Freighters are always Merchant Guild ships regardless of cargo owner
    e.factionId = 'f05';
    e.col = FACTIONS['f05']?.col || '#44cc88';
  }
  if(aiRole==='merc'){
    // Two-waypoint patrol between stations (matches 2D spawnMerc)
    const sts = G.stations.slice();
    const stA = sts[Math.floor(Math.random()*sts.length)];
    let stB = sts[Math.floor(Math.random()*sts.length)];
    if(stB===stA && sts.length>1) stB = sts[(sts.indexOf(stA)+1)%sts.length];
    e._mercWpA = stA.pos;
    e._mercWpB = stB.pos;
    e._mercTarget = stB.pos;
    e._mercEscort = Math.random() < 0.5;
    e._mercEscortNpc = null;
    e.homeStation = stA;
    e.factionId = 'f09';
    e.aiSt = 'patrol';
  }
  if(aiRole==='recovery'){
    e.hostile = false;
    e.homeBase = pirateBase || stationA || G.pBases[0];
    e.col = factionCol || '#ff9944';
    e.factionId = e.homeBase?.factionId || 'f07';
  }

  G.enemies.push(e);
  return e;
}

// ═══════════════════════════════════════════════════════════
//  BULLETS — two-pool damage model
// ═══════════════════════════════════════════════════════════
let dmgAlpha=0;
function damageNPC(e, dmg){
  // Armour absorbs first; 45% bleed to struct
  if(e.armour > 0){
    const absorbed = Math.min(e.armour, dmg);
    e.armour -= absorbed;
    const excess = dmg - absorbed;
    if(excess > 0) e.struct -= excess * 0.45;
  } else {
    e.struct -= dmg;
  }
  e.hp = e.armour + e.struct;
}
function updBullets(arr,dt,isP){
  for(let i=arr.length-1;i>=0;i--){
    const b=arr[i];
    b.pos=v3add(b.pos,v3scale(b.vel,dt));
    b.life-=dt;
    if(b.life<=0){arr.splice(i,1);continue;}
    if(isP){
      for(let j=G.enemies.length-1;j>=0;j--){
        const e=G.enemies[j];
        if(e.struct<=0 || e._dead) continue; // skip dead
        if(v3len(v3sub(b.pos,e.pos))<e.sz*2){
          const totalDmg = (b.dmgA||0) + (b.dmgS||b.dmg||0);

          // §8 Capital ship component damage
          if(e.isCapital && e.components){
            // Pick the alive component whose centre is closest to the bullet impact point.
            // Uses the same YXZ rotation as the renderer to compute world position.
            const _compDefs = CAP_COMPONENT_MODELS[e.capType];
            let comp = null, _bestDist = Infinity;
            e.components.forEach((c, ci) => {
              if(c.hp <= 0) return;
              let cx = e.pos.x, cy2 = e.pos.y, cz = e.pos.z;
              if(_compDefs && _compDefs[ci]){
                const off = _compDefs[ci].offset;
                const _cy = Math.cos(e.yaw||0), _sy = Math.sin(e.yaw||0);
                const _cp = Math.cos(e.pitch||0), _sp = Math.sin(e.pitch||0);
                const _yx = off[0]*_cy + off[2]*_sy;
                const _yy = off[1];
                const _yz = -off[0]*_sy + off[2]*_cy;
                cx += _yx; cy2 += _yy*_cp - _yz*_sp; cz += _yy*_sp + _yz*_cp;
              }
              const _d = v3len(v3sub(b.pos, {x:cx,y:cy2,z:cz}));
              if(_d < _bestDist){ _bestDist = _d; comp = c; }
            });
            if(comp){
              comp.hp -= totalDmg;
              if(comp.hp <= 0){
                comp.hp = 0;
                // Component destroyed — partial reward + explosion
                G.p.credits += Math.round(e.reward / e.components.length);
                flash(`${e.name}: ${comp.name} DESTROYED`);
                addShockwave(b.pos, 200, 0.3, e.col);
                for(let k=0;k<15;k++){
                  const a2=Math.random()*PI2,el2=(Math.random()-.5)*PI,sp2=40+Math.random()*120;
                  G.parts.push({pos:{...b.pos},vel:v3(Math.cos(a2)*sp2,Math.sin(el2)*sp2,Math.sin(a2)*sp2),
                    life:.3+Math.random()*.8,col:Math.random()<.3?'#fff':'#ffaa00',sz:1+Math.random()*2});
                }
                if(comp.isCore){
                  e.struct = 0; // core destroyed = whole ship dead
                }
              }
              // Update struct to reflect total remaining component HP (unless core killed it)
              if(e.struct > 0){
                e.struct = e.components.reduce((s,c)=>s+Math.max(0,c.hp),0);
              }
              e.maxStruct = e.components.reduce((s,c)=>s+c.maxHp,0);
            }
          } else {
            const _wasArmour = e.armour > 0;
            damageNPC(e, totalDmg);
            // NPC hit sound — audible within ~weapon range, attenuated by distance
            const _hitDist = v3len(v3sub(e.pos, G.p.pos));
            if(_wasArmour) sndNPCArmourHit(_hitDist, 1600);
            else sndNPCStructHit(_hitDist, 1600);
          }

          arr.splice(i,1);
          // Hit sparks
          for(let k=0;k<6;k++){
            const a=Math.random()*PI2,el=(Math.random()-.5)*PI;
            G.parts.push({pos:{...b.pos},vel:v3(Math.cos(a)*90,Math.sin(el)*90,Math.sin(a)*90),
              life:.15+Math.random()*.3,col:b.col,sz:1+Math.random()*2});
          }
          // Impact knockback
          if(b.impact && b.impact > 0){
            const pushDir = v3norm(v3sub(e.pos, b.pos));
            e.vel = v3add(e.vel||v3(0,0,0), v3scale(pushDir, b.impact * 0.1));
          }
          // HV tumble — angular impulse spins yaw and pitch, damps over ~1.5s
          if(b.isHV && b.impact > 0){
            const spinScale = b.impact * 0.015;
            e.spinYaw   = (e.spinYaw   || 0) + (Math.random() - 0.5) * 2 * spinScale;
            e.spinPitch = (e.spinPitch || 0) + (Math.random() - 0.5) * 2 * spinScale;
          }
          // HV flash trail
          if(b.isHV){
            const bDir = v3norm(b.vel);
            const trailStart = v3sub(b.pos, v3scale(bDir, 200));
            G.hvFlashes.push({start:trailStart, end:{...b.pos}, life:0.08, ml:0.08, col:b.col});
          }
          if(e.struct<=0){ eDeath(e); G.enemies.splice(j,1); }
          else {
            e._attacker = {...p.pos}; // position snapshot of player
            if(e.aiRole==='pirate'){
              // Aggro chance scales with lock + bounty status
              const isLocked = G.targetShip===e && G.locked;
              const hasBounty = (FACTIONS[e.factionId]?.playerRep||0) < -30;
              const aggroChance = isLocked ? (hasBounty ? 0.80 : 0.40) : 0.15;
              if(Math.random() < aggroChance){ e.hostile=true; e.aiSt='chase'; }
            }
            if(e.aiRole==='merc') {
              e.hostile=true; e._combatTarget='player';
              if(e._mercEscortNpc){
                G.enemies.forEach(m2=>{
                  if(m2.aiRole==='merc' && m2!==e && m2._mercEscortNpc===e._mercEscortNpc){
                    m2.hostile=true; m2._combatTarget='player';
                  }
                });
              }
            }
            if(e.aiRole==='militia'||e.aiRole==='corporate') {
              e.hostile=true; e._chaseTarget=p.pos; e.aiSt='chase';
            }
            if(e.aiRole==='cargo') {
              e.aiSt='flee'; e._attacker={...G.p.pos};
              broadcastDistress(e, AI_CFG.cargo.distressRange);
              G.enemies.forEach(m2=>{
                if(m2.aiRole==='merc' && m2._mercEscortNpc===e){
                  m2.hostile=true; m2._combatTarget='player';
                }
              });
            }
          }
          // §3 Outlaw: hitting friendly NPCs
          if(!e.hostile && e.aiRole!=='pirate' && e.aiRole!=='recovery'){
            G.p.friendlyHits++;
            if(G.p.friendlyHits>=OUTLAW_THRESHOLD && !G.p.outlaw){
              G.p.outlaw=true; G.p.outlawTimer=OUTLAW_TIME;
              flash('⚠ OUTLAW STATUS — MILITIA HOSTILE');
            }
          }
          break;
        }
      }
    } else {
      if(v3len(v3sub(b.pos,G.p.pos))<15){
        const p=G.p;
        if(p.armour>0){
          const absorbed=Math.min(p.armour,b.dmg);
          p.armour-=absorbed;
          const excess=b.dmg-absorbed;
          if(excess>0) p.struct-=excess*0.45;
          sndArmourHit();
        } else {
          p.struct=Math.max(0,p.struct-b.dmg);
          sndStructHit();
        }
        arr.splice(i,1); dmgAlpha=.3;
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════
//  CARGO BOX SYSTEM
// ═══════════════════════════════════════════════════════════
function spawnCargoBox(pos, vel){
  const goods = GOODS;
  const good = goods[Math.floor(Math.random()*goods.length)];
  const units = 1 + Math.floor(Math.random()*5);
  const a=Math.random()*PI2, el=(Math.random()-.5)*1;
  const sp=20+Math.random()*40;
  G.cargoBoxes.push({
    pos: {...pos},
    vel: v3add(vel||v3(0,0,0), v3(Math.cos(a)*sp, el*sp, Math.sin(a)*sp)),
    good, units,
    life: 300+Math.random()*180,  // 300-480s — long enough for recovery ships
    angle: Math.random()*PI2,
    spin: (Math.random()-.5)*2,
  });
}

// ═══════════════════════════════════════════════════════════
//  DISTRESS PING
// ═══════════════════════════════════════════════════════════
function broadcastDistress(e, range){
  if(e.distressT > 0) return;
  e.distressT = 5; // cooldown
  const r = range || 1600;
  G.distressPings.push({
    pos:{...e.pos}, r:10, life:r/800, ml:r/800, col:'#ffff44',
    speed: 800, maxR: r,
    sourceId: e, // reference to the ship in distress
    sourceRole: e.aiRole,
  });
}

// Police-specific distress — blue ping, longer range, 10s cooldown
function broadcastPoliceDistress(e){
  if(e._distressCd > 0) return;
  e._distressCd = AI_CFG.militia.distressCd;
  G.distressPings.push({
    pos:{...e.pos}, r:10, life:3, ml:3, col:'#4488ff',
    speed: 800, maxR: 3000,
    sourceId: e,
    sourceRole: 'militia_distress',
  });
}

// ═══════════════════════════════════════════════════════════
//  ENEMY DEATH — cargo drops, rewards, explosions
// ═══════════════════════════════════════════════════════════
function eDeath(e, playerKill){
  if(e._dead) return; // prevent re-entry
  e._dead = true;
  // Explosion sound — audible at up to 2× typical weapon range (3000 u)
  const _explDist = v3len(v3sub(e.pos, G.p.pos));
  sndExplosion(_explDist, e.isCapital ? 5000 : 3000);
  // Emit faction event
  if(e.factionId) simEvent('SHIP_DESTROYED',{factionId:e.factionId, hullKey:e.hullKey, playerKill: playerKill!==false});
  // Shockwave ring — double for capitals
  if(e.isCapital){
    addShockwave(e.pos, 600, 0.25, '#ffffff');
    addShockwave(e.pos, 450, 0.35, '#ffcc00');
    addShockwave(e.pos, 250, 0.6, '#ff6600');
  } else {
    addShockwave(e.pos, 420, 0.22, '#ffffff');
    addShockwave(e.pos, 180, 0.5, '#ff8800');
  }
  // Explosion particles — capped for performance
  const scale = e.sz / 14;
  const nExpl = Math.min(25, Math.round(20*scale));
  for(let i=0;i<nExpl;i++){
    const a=Math.random()*PI2,el=(Math.random()-.5)*PI,sp=40+Math.random()*200*scale;
    G.parts.push({pos:{...e.pos},
      vel:v3add(e.vel||v3(0,0,0), v3(Math.cos(a)*Math.cos(el)*sp,Math.sin(el)*sp,Math.sin(a)*Math.cos(el)*sp)),
      life:.2+Math.random()*.8,col:Math.random()<.3?'#fff':Math.random()<.5?'#ffaa00':e.col,
      sz:1+Math.random()*3*scale});
  }
  // Cargo drops — only freighters and pirate recovery ships
  if(e.aiRole==='cargo' || e.hullKey==='freighter_npc'){
    const nDrop = 2 + Math.floor(Math.random()*4); // 2-5 boxes
    for(let i=0;i<nDrop;i++) spawnCargoBox(e.pos, e.vel);
  } else if(e.aiRole==='recovery'){
    // Drop only what was carried — nothing if empty
    const nDrop = (e._cargo||[]).length;
    for(let i=0;i<nDrop;i++) spawnCargoBox(e.pos, e.vel);
  }

  // Credit reward — only for player kills
  if(e.reward && playerKill!==false) G.p.credits += e.reward;
  if(playerKill!==false) flash(`${e.name} DESTROYED` + (e.reward ? ` +${e.reward} CR` : ''));

  // Mission bounty tracking — only player kills
  if(playerKill!==false) checkBountyKill(e);

  // Pirate respawn via pending queue
  if(e.aiRole==='pirate' && e.homeBase){
    G.pendingSpawns.push({
      timer: AI_CFG.pirateRespawnMs / 1000,
      role:'pirate', base:e.homeBase, sys:G.sys,
    });
  }
}

// ═══════════════════════════════════════════════════════════
//  AI — 5 DISPATCHED ROLES (§7)
// ═══════════════════════════════════════════════════════════

const NPC_DRAG = 0.984;        // per-frame drag when thrusting (same as 2D)
const NPC_DRIFT_DRAG = 0.999;  // passive drag always applied

function steerTo(e, target, dt){
  const dir = v3norm(v3sub(target, e.pos));
  const targetYaw = Math.atan2(dir.x, dir.z);
  const targetPitch = Math.asin(Math.max(-1, Math.min(1, dir.y)));

  // Yaw — hard capped at turnRate * dt (matching 2D: Math.sign(ad)*Math.min(abs(ad), turn*dt))
  let yd = targetYaw - e.yaw;
  while(yd > PI) yd -= PI2;
  while(yd < -PI) yd += PI2;
  const maxYawStep = e.turnRate * dt;
  e.yaw += Math.sign(yd) * Math.min(Math.abs(yd), maxYawStep);

  // Pitch — same cap
  let pd = targetPitch - e.pitch;
  const maxPitchStep = e.turnRate * dt;
  e.pitch += Math.sign(pd) * Math.min(Math.abs(pd), maxPitchStep);
}

function npcForward(e){
  return v3(Math.sin(e.yaw)*Math.cos(e.pitch), Math.sin(e.pitch), Math.cos(e.yaw)*Math.cos(e.pitch));
}

// thrust(): matches 2D — accelerate along facing at e.baseSpd rate, apply drag, cap at maxSpd
// doThrust: true = engines on, false = coasting
function moveNPC(e, dt, doThrust){
  const ef = npcForward(e);

  if(doThrust){
    // Acceleration: add baseSpd * dt along facing direction (same as 2D: vx += cos*spd*dt)
    e.vel = v3add(e.vel, v3scale(ef, e.baseSpd * dt));

    // Thrust drag (2D: vx *= pow(0.984, dt*60))
    const thrustDrag = Math.pow(NPC_DRAG, dt * 60);
    e.vel = v3scale(e.vel, thrustDrag);

    // Thrust exhaust particles — rate & size scaled by engine tier and speed fraction
    const spdFrac = Math.min(1, v3len(e.vel) / (e.maxSpd || 200));
    const tierScale = (e.engineTier || 1) / 3; // T1=0.33, T3=1, T5=1.67
    const baseRate = e.isCapital ? 0.6 : (e.aiRole==='cargo' || e.hullKey==='freighter_npc') ? 0.15 : 0.25;
    const rate = baseRate * (0.3 + spdFrac * 0.7) * (0.5 + tierScale * 0.5);

    if(Math.random() < rate){
      // Hard particle budget — skip if too many
      if(G.parts.length > 800) return;
      const exhaust = v3scale(ef, -(e.sz || 8) * 0.7);
      const col = (e.engineTier||1) >= 4 ? '#44ccff' :
                  (e.engineTier||1) >= 3 ? '#88aaff' :
                  e.aiRole==='militia' || e.aiRole==='corporate' ? '#4499ff' :
                  e.aiRole==='pirate' ? '#ff6600' : '#ffaa44';
      const pSize = (0.8 + tierScale * 1.5) * (0.5 + spdFrac);
      const nParts = e.isCapital ? 2 : 1;
      for(let pp=0; pp<nParts; pp++){
        G.parts.push({
          pos: v3add(e.pos, v3add(exhaust, v3((Math.random()-.5)*3,(Math.random()-.5)*3,(Math.random()-.5)*3))),
          vel: v3add(v3scale(ef, -15 - Math.random()*20 * tierScale), v3scale(e.vel, 0.7)),
          life: 0.6 + Math.random() * 0.8 * (1 + tierScale*0.3),
          col, sz: pSize + Math.random() * pSize,
        });
      }
    }
  }

  // ── OBSTACLE AVOIDANCE ──
  // Skip for cargo on final approach (<200u from patT) and for fleeing/homing AI states
  const _isFinalApproach = e.aiRole==='cargo' && e.patT && v3len(v3sub(e.patT,e.pos))<200;
  if(!_isFinalApproach && e.aiSt!=='flee' && !e._returning){
    // Planet repulsion — keep NPCs outside r*3
    G.planets?.forEach(pl=>{
      const toE=v3sub(e.pos,pl.pos);
      const d=v3len(toE);
      const thresh=pl.r*3;
      if(d<thresh && d>0.1){
        const strength=(1-d/thresh)*e.baseSpd*2;
        e.vel=v3add(e.vel,v3scale(v3norm(toE),strength*dt));
      }
    });
    // Station repulsion — keep NPCs outside 200u
    G.stations.forEach(st=>{
      const toE=v3sub(e.pos,st.pos);
      const d=v3len(toE);
      if(d<200 && d>0.1){
        const strength=(1-d/200)*e.baseSpd*2.5;
        e.vel=v3add(e.vel,v3scale(v3norm(toE),strength*dt));
      }
    });
    // Asteroid repulsion — keep NPCs outside radius + clearance
    G.asteroids?.forEach(ast=>{
      const toE=v3sub(e.pos,ast.pos);
      const d=v3len(toE);
      const thresh=ast.r+(e.sz||10)+50;
      if(d<thresh && d>0.1){
        const strength=(1-d/thresh)*e.baseSpd*3;
        e.vel=v3add(e.vel,v3scale(v3norm(toE),strength*dt));
      }
    });
  }

  // Passive drift drag — always applied (2D: vx *= pow(0.999, dt*60))
  const driftDrag = Math.pow(NPC_DRIFT_DRAG, dt * 60);
  e.vel = v3scale(e.vel, driftDrag);

  // Hard speed cap at maxSpd
  const spd = v3len(e.vel);
  if(spd > e.maxSpd) e.vel = v3scale(v3norm(e.vel), e.maxSpd);

  // Track scalar speed for HUD/AI
  e.speed = v3len(e.vel);

  // Move
  e.pos = v3add(e.pos, v3scale(e.vel, dt));
}

function npcFireAt(e, target, dt){
  if(!e.wpn) return;
  e.fireCd = Math.max(0, e.fireCd - dt);
  const dist = v3len(v3sub(target, e.pos));
  if(dist > (e.wpn.range||600) || e.fireCd > 0) return;
  const ef = npcForward(e);
  const toTarget = v3norm(v3sub(target, e.pos));
  if(v3dot(ef, toTarget) < 0.966) return;  // 15° cone
  e.fireCd = e.wpn.cd;
  G.eBullets.push({
    pos:v3add(e.pos,v3scale(ef,e.sz)),
    vel:v3scale(ef, e.wpn.speed),
    life:1.2, maxLife:1.2, dmg:e.wpn.dmg, col:e.wpn.col, sz:e.wpn.sz,
  });
}

// NPC-vs-NPC proximity combat — when an NPC is fighting another NPC, apply direct DPS
function npcCombatNPC(attacker, target, dt){
  if(!attacker.wpn || !target || target.struct<=0 || target._dead) return;
  // Prevent friendly fire — lawful NPCs never attack each other
  const lawfulRoles = ['militia','corporate','merc','cargo','recovery'];
  if(lawfulRoles.includes(attacker.aiRole) && lawfulRoles.includes(target.aiRole)) return;
  const dist = v3len(v3sub(target.pos, attacker.pos));
  if(dist > (attacker.wpn.range||600)) return;
  const ef = npcForward(attacker);
  const toT = v3norm(v3sub(target.pos, attacker.pos));
  if(v3dot(ef, toT) < .7) return;
  const dps = (attacker.wpn.dmg||5) * 0.7;
  const _wasArmourNvN = target.armour > 0;
  damageNPC(target, dps * dt);
  // NPC-vs-NPC hit sounds — audible within weapon range, attenuated by distance to player
  if(!target._nvnSndT || target._nvnSndT <= 0){
    const _nvnDist = v3len(v3sub(target.pos, G.p.pos));
    if(_wasArmourNvN) sndNPCArmourHit(_nvnDist, attacker.wpn.range||600);
    else sndNPCStructHit(_nvnDist, attacker.wpn.range||600);
    target._nvnSndT = 0.25; // throttle — one sound per 250 ms per NPC
  }
  // Track attacker on victim as a POSITION snapshot (not entity ref)
  target._attacker = {...attacker.pos};
  if(target.struct <= 0){ eDeath(target, false); return; }
  // Trigger cargo flee + distress when attacked by NPCs
  if(target.aiRole==='cargo' && target.aiSt!=='flee'){
    target.aiSt='flee';
    broadcastDistress(target, AI_CFG.cargo.distressRange);
    // Alert escorting mercs
    G.enemies.forEach(m=>{
      if(m.aiRole==='merc' && m._mercEscortNpc===target){
        m._combatTarget=attacker;
      }
    });
  }
  // Re-ping distress if cargo already fleeing (cooldown handles rate)
  if(target.aiRole==='cargo' && target.aiSt==='flee'){
    broadcastDistress(target, AI_CFG.cargo.distressRange);
  }
  // Alert mercs escorting a recovery ship that's under NPC attack
  if(target.aiRole==='recovery'){
    G.enemies.forEach(m=>{
      if(m.aiRole==='merc' && m._mercEscortNpc===target){
        m._combatTarget=attacker;
      }
    });
  }
  // Trigger militia/corporate react when attacked by NPCs
  if((target.aiRole==='militia'||target.aiRole==='corporate') && target.aiSt!=='chase'){
    target._chaseTarget = attacker;
    target.aiSt = 'chase';
  }
  // Mercs react to being attacked by NPCs
  if(target.aiRole==='merc' && !target._combatTarget){
    target._combatTarget = attacker;
  }
}

// Count pirates sharing the same home base as this pirate (2D: siblingPirates)
function pirateSiblings(e){
  if(!e.homeBase) return 1;
  return G.enemies.filter(p=>
    p.aiRole==='pirate' && p!==e && p.homeBase &&
    v3len(v3sub(p.homeBase.pos, e.homeBase.pos)) < 50
  ).length + 1;
}

// Freighter path-avoidance: returns a lateral waypoint that steers around any
// pirate base whose centre falls within _DETOUR_R of the direct path pos→dest.
// Returns dest unchanged when the route is already clear.
const _DETOUR_R = 2200; // u — threat radius around each pirate base
function _cargoDetour(pos, dest){
  const toD = v3sub(dest, pos);
  const distToDest = v3len(toD);
  if(distToDest < 400) return dest; // already on final approach
  const dir = v3scale(toD, 1/distToDest);

  let bestAlong = -1, bestPerp = Infinity, bestPerpVec = null;
  G.pBases.forEach(pb=>{
    const toPb = v3sub(pb.pos, pos);
    const along = v3dot(toPb, dir);
    if(along < 50 || along > distToDest - 50) return; // behind or beyond dest
    const perpVec = v3sub(toPb, v3scale(dir, along));
    const perpDist = v3len(perpVec);
    if(perpDist < _DETOUR_R && perpDist < bestPerp){
      bestPerp = perpDist; bestAlong = along; bestPerpVec = perpVec;
    }
  });

  if(bestAlong < 0) return dest; // path is clear

  // Closest point on straight path to the threatening base
  const closestPt = v3add(pos, v3scale(dir, bestAlong));
  // Push direction: away from the pirate base (negate perpVec)
  const pushDir = bestPerp > 0.1
    ? v3scale(bestPerpVec, -1/bestPerp)
    : v3(dir.z, 0, -dir.x); // fallback when base is exactly on the path
  return v3add(closestPt, v3scale(pushDir, _DETOUR_R * 1.4));
}

function updEnemies(dt){
  const p=G.p;

  G.enemies.forEach(e=>{
    if(e._dead || e._despawn || e.struct <= 0) return; // skip dead/despawned
    const toP = v3sub(p.pos, e.pos);
    const dP = v3len(toP);
    e.fireCd = Math.max(0, e.fireCd - dt);
    e.aiT -= dt;
    if(e.distressT > 0) e.distressT -= dt;
    if(e._nvnSndT > 0) e._nvnSndT -= dt;

    // HV tumble spin — applied before AI so steering fights against it
    if(e.spinYaw)  { e.yaw   += e.spinYaw   * dt; e.spinYaw   *= Math.pow(0.05, dt); if(Math.abs(e.spinYaw)   < 0.005) e.spinYaw   = 0; }
    if(e.spinPitch){ e.pitch += e.spinPitch * dt; e.spinPitch *= Math.pow(0.05, dt); if(Math.abs(e.spinPitch) < 0.005) e.spinPitch = 0; }

    // ── DISPATCH BY ROLE ──
    switch(e.aiRole){

    // ─── MILITIA AI ───
    case 'militia': {
      // ── Capital escort — shadow a same-faction capital when idle ──
      if(e._capEscortOf){
        const cap = e._capEscortOf;
        if(!G.enemies.includes(cap)||cap.struct<=0){ e._capEscortOf=null; }
        else if(!e._fleeing && !e._returning && e.aiSt!=='chase'){
          const ef2=npcForward(cap), rt=v3norm(v3(ef2.z,0,-ef2.x));
          const escPos = v3add(cap.pos,
            v3add(v3scale(ef2, Math.cos(e._capEscortAngle)*(e._capEscortDist||320)),
                  v3scale(rt,  Math.sin(e._capEscortAngle)*(e._capEscortDist||320))));
          steerTo(e, escPos, dt);
          moveNPC(e, dt, v3len(v3sub(escPos,e.pos))>80);
          if(cap.hostile){ e._chaseTarget=cap; e.aiSt='chase'; e._capEscortOf=null; }
          break;
        }
      }

      const cfg = AI_CFG.militia;
      const hpFrac = (e.armour+e.struct)/(e.maxArmour+e.maxStruct);

      // Tick distress cooldown
      if(e._distressCd > 0) e._distressCd -= dt;

      // ── FLEE + RETURN TO BASE when badly damaged ──
      if(e._fleeing){
        e._fleeTimer -= dt;
        if(e._fleeTimer <= 0){
          e._fleeing = false;
          if(e._fledDamaged && e.homeStation){
            e._returning = true;
          }
        } else {
          steerTo(e, v3add(e.pos, v3scale(e._fleeDir, 500)), dt);
          moveNPC(e, dt, true);
          // Broadcast police distress every 10s while fleeing
          broadcastPoliceDistress(e);
          break;
        }
      }

      if(hpFrac < cfg.fleeHpRatio && !e._fleeing && !e._returning){
        e._fleeing = true; e._fleeTimer = cfg.fleeDur; e._fledDamaged = true;
        // Get threat position — handle both entity refs and position objects
        let threatPos = p.pos;
        if(e._chaseTarget){
          if(e._chaseTarget.pos) threatPos = e._chaseTarget.pos; // entity
          else if(e._chaseTarget.x !== undefined) threatPos = e._chaseTarget; // position
        }
        e._fleeDir = v3norm(v3sub(e.pos, threatPos));
        broadcastPoliceDistress(e);
        break;
      }

      // ── RETURNING TO BASE — fly home, send periodic distress for escort ──
      if(e._returning && e.homeStation){
        const homeDist = v3len(v3sub(e.homeStation.pos, e.pos));
        if(homeDist < 120){
          e._returning = false; e._fleeing = false;
          e.armour = e.maxArmour; e.struct = e.maxStruct; // healed at base
          e.aiSt = 'patrol';
        } else {
          steerTo(e, e.homeStation.pos, dt);
          moveNPC(e, dt, true);
          // Ping for escort every 10s
          broadcastPoliceDistress(e);
        }
        break;
      }

      // ── COMBAT / ESCORT ──
      if(e.aiSt === 'chase'){
        let tgt = e._chaseTarget;
        if(tgt && typeof tgt === 'object' && tgt.pos){
          // Chasing an NPC entity — check if it's friendly (escort) or hostile (combat)
          const isFriendly = tgt.aiRole==='militia'||tgt.aiRole==='corporate'||tgt.aiRole==='cargo';
          if(isFriendly){
            // ESCORT — fly toward the friendly, don't attack
            steerTo(e, tgt.pos, dt);
            moveNPC(e, dt, v3len(v3sub(tgt.pos,e.pos)) > 150);
            // Disengage once close enough or target healed/safe
            if(v3len(v3sub(tgt.pos, e.pos)) < 200 || tgt._dead || tgt.struct <= 0 ||
               (!tgt._returning && !tgt._fleeing)){
              e.aiSt='patrol'; e._chaseTarget=null;
            }
          } else {
            // COMBAT — attack hostile NPC (pirate etc)
            steerTo(e, tgt.pos, dt);
            moveNPC(e, dt, true);
            npcCombatNPC(e, tgt, dt);
            npcFireAt(e, tgt.pos, dt);
            if(tgt.struct <= 0 || tgt._dead || v3len(v3sub(tgt.pos, e.pos)) > cfg.chaseLeash){
              e.aiSt='patrol'; e._chaseTarget=null; e.hostile=false;
            }
          }
        } else if(tgt === 'player' || (e.hostile && !tgt)){
          // Chasing the player — always use live position
          steerTo(e, p.pos, dt);
          moveNPC(e, dt, true);
          npcFireAt(e, p.pos, dt);
          if(!p.outlaw || dP > cfg.chaseLeash){ e.aiSt='patrol'; e._chaseTarget=null; e.hostile=false; }
        } else {
          e.aiSt = 'patrol';
        }
      } else {
        // ── PATROL ──
        if(!e.patT || e.aiT<=0){
          e.aiT = 3+Math.random()*4;
          const a=Math.random()*PI2;
          const home = e.homeStation ? e.homeStation.pos : e.pos;
          e.patT = v3add(home, v3(Math.cos(a)*cfg.patrolR,(Math.random()-.5)*60,Math.sin(a)*cfg.patrolR));
        }
        steerTo(e, e.patT, dt);
        moveNPC(e, dt, true);

        // Respond to distress pings — both cargo (yellow) and police (blue)
        G.distressPings.forEach(dp=>{
          if(v3len(v3sub(dp.pos,e.pos)) < cfg.pingLeash && dp.sourceId){
            if(dp.sourceRole==='militia_distress'){
              // Escort damaged police — fly toward them
              if(dp.sourceId !== e){
                e._chaseTarget = dp.sourceId; e.aiSt='chase'; e.hostile=false;
              }
            } else {
              // Respond to cargo distress — find nearest pirate
              let nearPirate=null, bestD=Infinity;
              G.enemies.forEach(p2=>{
                if(p2.aiRole==='pirate' && p2!==e){
                  const d2=v3len(v3sub(p2.pos,dp.pos));
                  if(d2<bestD){bestD=d2;nearPirate=p2;}
                }
              });
              if(nearPirate){ e._chaseTarget=nearPirate; e.aiSt='chase'; e.hostile=false; }
            }
          }
        });

        // Chase player if outlaw
        if(p.outlaw && dP < cfg.chaseLeash){
          e._chaseTarget = 'player'; e.aiSt = 'chase'; e.hostile = true;
        }

        // Occasionally attach to a nearby same-faction capital as escort
        if(!e._capEscortOf && Math.random()<0.004){
          const myCap = G.enemies.find(c=>c.isCapital&&c.factionId===e.factionId&&c.struct>0&&
            v3len(v3sub(c.pos,e.pos))<1800);
          if(myCap){
            e._capEscortOf=myCap;
            e._capEscortAngle=Math.random()*PI2;
            e._capEscortDist=280+Math.random()*200;
          }
        }
      }
      break;
    }

    // ─── CORPORATE AI ───
    case 'corporate': {
      // ── Capital escort — shadow a same-faction capital when idle ──
      if(e._capEscortOf){
        const cap = e._capEscortOf;
        if(!G.enemies.includes(cap)||cap.struct<=0){ e._capEscortOf=null; }
        else if(e.aiSt!=='chase'){
          const ef2=npcForward(cap), rt=v3norm(v3(ef2.z,0,-ef2.x));
          const escPos = v3add(cap.pos,
            v3add(v3scale(ef2, Math.cos(e._capEscortAngle)*(e._capEscortDist||320)),
                  v3scale(rt,  Math.sin(e._capEscortAngle)*(e._capEscortDist||320))));
          steerTo(e, escPos, dt);
          moveNPC(e, dt, v3len(v3sub(escPos,e.pos))>80);
          if(cap.hostile){ e.hostile=true; e.aiSt='chase'; e._capEscortOf=null; }
          break;
        }
      }

      const cfg = AI_CFG.corporate;
      if(e.aiSt === 'chase'){
        steerTo(e, p.pos, dt);
        moveNPC(e, dt, true);
        npcFireAt(e, p.pos, dt);
        if(dP > cfg.chaseLeash) { e.aiSt='patrol'; e.hostile=false; }
      } else {
        if(!e.patT || e.aiT<=0){
          e.aiT = 3+Math.random()*5;
          const a=Math.random()*PI2;
          const home = e.homeStation ? e.homeStation.pos : e.pos;
          e.patT = v3add(home, v3(Math.cos(a)*cfg.patrolR,(Math.random()-.5)*60,Math.sin(a)*cfg.patrolR));
        }
        steerTo(e, e.patT, dt);
        moveNPC(e, dt, true);
        // Rep-gated hostility: attack if player rep < -40 with this faction
        const corpRep = e.factionId ? (FACTIONS[e.factionId]?.playerRep||0) : 0;
        if((corpRep < -40 || p.outlaw) && dP < cfg.chaseLeash){
          e.hostile=true; e.aiSt='chase';
        }
        // Occasionally attach to a nearby same-faction capital as escort
        if(!e._capEscortOf && Math.random()<0.004){
          const myCap = G.enemies.find(c=>c.isCapital&&c.factionId===e.factionId&&c.struct>0&&
            v3len(v3sub(c.pos,e.pos))<1800);
          if(myCap){
            e._capEscortOf=myCap;
            e._capEscortAngle=Math.random()*PI2;
            e._capEscortDist=280+Math.random()*200;
          }
        }
      }
      break;
    }

    // ─── MERC AI — escort/patrol with reactive combat, flee/return ───
    case 'merc': {
      const cfg = AI_CFG.merc;
      const hpFrac = (e.armour+e.struct)/(e.maxArmour+e.maxStruct);
      const mercRep = FACTIONS['f09']?.playerRep ?? 0;
      const isEscorting = e._mercEscort && e._mercEscortNpc &&
        G.enemies.includes(e._mercEscortNpc) && e._mercEscortNpc.struct>0;

      // ── FLEE when badly damaged (non-escort) ──
      if(e._fleeing){
        e._fleeTimer -= dt;
        if(e._fleeTimer <= 0){
          e._fleeing = false;
          if(e._fledDamaged){ e._returning = true; }
        } else {
          steerTo(e, v3add(e.pos, v3scale(e._fleeDir, 500)), dt);
          moveNPC(e, dt, true);
          break;
        }
      }

      // Non-escort: flee at low HP
      if(!isEscorting && hpFrac < cfg.fleeHpRatio && !e._fleeing && !e._returning){
        e._fleeing = true; e._fleeTimer = cfg.fleeDur; e._fledDamaged = true;
        const threat = (e._combatTarget==='player') ? p.pos :
          (e._combatTarget?.pos || p.pos);
        e._fleeDir = v3norm(v3sub(e.pos, threat));
        break;
      }

      // ── RETURNING TO NEAREST STATION ──
      if(e._returning){
        let nearSt = null, bestSD = Infinity;
        G.stations.forEach(s=>{
          const d=v3len(v3sub(s.pos,e.pos));
          if(d<bestSD){bestSD=d;nearSt=s;}
        });
        if(nearSt && bestSD > 120){
          steerTo(e, nearSt.pos, dt);
          moveNPC(e, dt, true);
        } else {
          // Arrived — heal and resume patrol
          e._returning = false; e._fleeing = false;
          e.armour = e.maxArmour; e.struct = e.maxStruct;
          e.hostile = false; e._combatTarget = null;
        }
        break;
      }

      // ── FIND COMBAT TARGET ──
      // Priority 1: whoever attacked us or our escort
      let combatNPC = null, combatDist = Infinity, combatIsPlayer = false;

      // Check if we've been attacked
      if(e._combatTarget === 'player'){
        combatIsPlayer = true; combatDist = dP;
      } else if(e._combatTarget && typeof e._combatTarget === 'object' &&
                G.enemies.includes(e._combatTarget) && e._combatTarget.struct > 0){
        combatNPC = e._combatTarget;
        combatDist = v3len(v3sub(combatNPC.pos, e.pos));
      }

      // Priority 2: scan for nearby pirates
      if(!combatNPC && !combatIsPlayer){
        G.enemies.forEach(pi=>{
          if(pi.aiRole==='pirate'){
            const d=v3len(v3sub(pi.pos,e.pos));
            if(d<cfg.chaseLeash && d<combatDist){ combatDist=d; combatNPC=pi; }
          }
        });
      }

      // Priority 3: hostile player
      if(!combatNPC && !combatIsPlayer && mercRep < -40 && dP < cfg.chaseLeash){
        combatIsPlayer = true; combatDist = dP;
      }

      const hasCombat = combatNPC || combatIsPlayer;

      // ── ESCORT LEASH CHECK ──
      // If escorting and in combat, don't chase beyond escort leash
      if(hasCombat && isEscorting){
        const escortDist = v3len(v3sub(e.pos, e._mercEscortNpc.pos));
        if(combatDist > cfg.escortLeash || escortDist > cfg.escortLeash){
          // Too far from escort — disengage, return to escort
          e._combatTarget = null;
          steerTo(e, e._mercEscortNpc.pos, dt);
          moveNPC(e, dt, true);
          e.hostile = false;
          break;
        }
      }

      if(hasCombat){
        // ── COMBAT ──
        if(combatIsPlayer){
          steerTo(e, p.pos, dt);
          moveNPC(e, dt, true);
          npcFireAt(e, p.pos, dt);
          e.hostile = true;
        } else if(combatNPC){
          steerTo(e, combatNPC.pos, dt);
          moveNPC(e, dt, true);
          npcCombatNPC(e, combatNPC, dt);
          npcFireAt(e, combatNPC.pos, dt);
          e.hostile = false;
          // Clear target if dead or too far
          if(combatNPC.struct <= 0 || combatDist > cfg.chaseLeash){
            e._combatTarget = null;
          }
        }

        // Escort mode: flee at lower HP threshold when protecting
        if(isEscorting && hpFrac < cfg.fleeHpRatio * 1.5){
          e._fleeing = true; e._fleeTimer = cfg.fleeDur * 0.5; e._fledDamaged = true;
          e._fleeDir = v3norm(v3sub(e.pos, combatNPC ? combatNPC.pos : p.pos));
        }
      } else {
        // ── NO COMBAT — PATROL / ESCORT ──
        e.hostile = false;
        e._combatTarget = null;

        if(isEscorting){
          // ── ESCORT MODE: follow freighter ──
          // No-distress timer: if freighter hasn't pinged distress recently, detach
          e._noDistressTimer = (e._noDistressTimer||0) + dt;
          // Reset timer if escort is fleeing or under attack
          if(e._mercEscortNpc.aiSt === 'flee' || e._mercEscortNpc._attacker) e._noDistressTimer = 0;
          // Check nearby distress pings from our escort
          G.distressPings.forEach(dp=>{
            if(dp.sourceId === e._mercEscortNpc) e._noDistressTimer = 0;
          });

          if(e._noDistressTimer > cfg.noDistressTimer){
            // Freighter is safe — drop escort, resume patrol
            e._mercEscort = false;
            e._mercEscortNpc = null;
            e._noDistressTimer = 0;
          } else {
            // Shadow the freighter
            const off = v3add(e._mercEscortNpc.pos, v3(80,30,0));
            steerTo(e, off, dt);
            const escDist = v3len(v3sub(off, e.pos));
            moveNPC(e, dt, escDist > 80);
          }
        } else if(e._mercWpA && e._mercWpB){
          // ── WAYPOINT PATROL ──
          // Scan for freighters to escort
          if(Math.random() < 0.01){ // check occasionally, not every frame
            let bestCargo=null, bestD=Infinity;
            G.enemies.forEach(c=>{
              // Escort cargo ships, and non-hostile (merchant) recovery ships
              const escortable = c.aiRole==='cargo' ||
                (c.aiRole==='recovery' && !c.hostile && FACTIONS[c.factionId]?.cat!=='criminal');
              if(escortable){
                const d=v3len(v3sub(c.pos,e.pos));
                if(d<2000 && d<bestD){bestD=d; bestCargo=c;}
              }
            });
            if(bestCargo){
              e._mercEscort = true;
              e._mercEscortNpc = bestCargo;
              e._noDistressTimer = 0;
            }
          }

          steerTo(e, e._mercTarget, dt);
          const distToWp = v3len(v3sub(e._mercTarget, e.pos));
          moveNPC(e, dt, distToWp > 120);

          if(distToWp < 180){
            const atA = v3len(v3sub(e._mercTarget, e._mercWpA)) < 10;
            e._mercTarget = atA ? e._mercWpB : e._mercWpA;
          }
        } else {
          // Fallback patrol
          if(!e.patT || e.aiT<=0){
            e.aiT=4+Math.random()*6;
            e.patT = pickStation().pos;
          }
          steerTo(e, e.patT, dt);
          moveNPC(e, dt, true);
        }
      }
      break;
    }

    // ─── PIRATE AI (matches 2D aiPirate) ───
    case 'pirate': {
      // ── Capital escort — shadow a same-faction capital when not in combat ──
      if(e._capEscortOf){
        const cap = e._capEscortOf;
        if(!G.enemies.includes(cap) || cap.struct<=0){
          e._capEscortOf = null;
        } else if(!e._fleeing && !e._combatTarget && !e.hostile){
          const ef2=npcForward(cap), rt=v3norm(v3(ef2.z,0,-ef2.x));
          const escPos = v3add(cap.pos,
            v3add(v3scale(ef2, Math.cos(e._capEscortAngle)*(e._capEscortDist||320)),
                  v3scale(rt,  Math.sin(e._capEscortAngle)*(e._capEscortDist||320))));
          steerTo(e, escPos, dt);
          moveNPC(e, dt, v3len(v3sub(escPos,e.pos))>80);
          if(cap.hostile){ e.hostile=true; e.aiSt='chase'; e._capEscortOf=null; }
          break;
        }
      }

      const cfg = AI_CFG.pirate;
      const hpFrac = (e.armour+e.struct)/(e.maxArmour+e.maxStruct);
      const nearLawful = G.enemies.filter(m=>
        (m.aiRole==='militia'||m.aiRole==='corporate'||m.aiRole==='merc') &&
        v3len(v3sub(m.pos,e.pos)) < 900
      );
      const nearThreat = nearLawful.length > 0 ||
        (p.outlaw && dP < cfg.safeR);

      // ── FLEE: sprint away when low HP or outnumbered by militia ──
      const fleeingHP = hpFrac < cfg.fleeHpRatio;
      const militiaFleeing = nearLawful.length >= 2;
      const shouldFlee = (militiaFleeing || (fleeingHP && nearLawful.length>0)) && !e._fleeing;

      if(shouldFlee && !e._fleeing){
        e._fleeing = true;
        e._fleeTimer = cfg.fleeDur;
        e._fledDamaged = fleeingHP;
        // Flee away from nearest threat
        const runFrom = nearLawful[0] || p;
        e._fleeDir = v3norm(v3sub(e.pos, runFrom.pos));
      }

      if(e._fleeing){
        e._fleeTimer -= dt;
        if(e._fleeTimer <= 0){
          e._fleeing = false;
          // If fled because damaged, return home
          if(e._fledDamaged && e.homeBase){
            e._returning = true;
          }
        } else {
          const fleeTarget = v3add(e.pos, v3scale(e._fleeDir, 500));
          steerTo(e, fleeTarget, dt);
          moveNPC(e, dt, true);
          break;
        }
      }

      // ── RETURN HOME: fly to base, despawn, respawn fresh ──
      if(fleeingHP && !e._returning && !nearThreat && e.homeBase){
        e._returning = true;
      }
      if(e._returning && e.homeBase){
        if(nearThreat){ e._returning = false; }
        else {
          const homeDist = v3len(v3sub(e.homeBase.pos, e.pos));
          if(homeDist < 60){
            // Despawn and queue respawn
            e.struct = 0; // will be filtered out
            G.pendingSpawns.push({
              timer: AI_CFG.pirateRespawnMs / 1000,
              role:'pirate', base:e.homeBase, sys:G.sys,
            });
          } else {
            steerTo(e, e.homeBase.pos, dt);
            moveNPC(e, dt, true);
          }
          break;
        }
      }

      // ── DEFEND vs HUNT decision based on siblings at THIS base ──
      const siblings = pirateSiblings(e);
      const defending = siblings < cfg.huntThresh;

      if(defending){
        // Defend home base — orbit and attack intruders
        if(!e.patT || e.aiT<=0){
          e.aiT = 2+Math.random()*4;
          const a=Math.random()*PI2;
          const home = e.homeBase ? e.homeBase.pos : e.pos;
          let pt = v3add(home, v3(Math.cos(a)*cfg.baseR,(Math.random()-.5)*80,Math.sin(a)*cfg.baseR));
          // Nudge patrol point out of any asteroid
          G.asteroids?.forEach(ast=>{
            const diff=v3sub(pt,ast.pos), dist=v3len(diff);
            if(dist < ast.r*1.5 && dist > 0.1)
              pt = v3add(pt, v3scale(v3norm(diff), ast.r*1.5 - dist));
          });
          e.patT = pt;
        }
        steerTo(e, e.patT, dt);
        moveNPC(e, dt, v3len(v3sub(e.patT,e.pos)) > 80);

        // Detect intruders near base
        if(e.homeBase){
          // Check for lawful NPCs or player near base
          const intruder = G.enemies.find(m=>
            (m.aiRole==='militia'||m.aiRole==='cargo'||m.aiRole==='merc') &&
            v3len(v3sub(m.pos, e.homeBase.pos)) < cfg.baseLeash
          );
          const playerNearBase = v3len(v3sub(p.pos, e.homeBase.pos)) < cfg.baseLeash;

          if(intruder){
            steerTo(e, intruder.pos, dt);
            moveNPC(e, dt, true);
            npcCombatNPC(e, intruder, dt);
            npcFireAt(e, intruder.pos, dt);
            break;
          }
          if(playerNearBase){
            steerTo(e, p.pos, dt);
            moveNPC(e, dt, true);
            npcFireAt(e, p.pos, dt);
            break;
          }
        }
        // Also chase if player comes very close
        if(dP < 800){
          steerTo(e, p.pos, dt);
          moveNPC(e, dt, true);
          npcFireAt(e, p.pos, dt);
        }
      } else {
        // HUNT MODE — aggressively seek cargo ships, fan out from base
        let huntTarget = null, huntDist = 5000;

        // Find nearest cargo/freighter within wide hunt range
        G.enemies.forEach(c=>{
          if(c.aiRole==='cargo'){
            const d=v3len(v3sub(c.pos,e.pos));
            if(d<huntDist){ huntDist=d; huntTarget=c; }
          }
        });

        // Also target mercs and militia if close and no cargo found
        if(!huntTarget){
          G.enemies.forEach(c=>{
            if(c.aiRole==='merc'||c.aiRole==='militia'){
              const d=v3len(v3sub(c.pos,e.pos));
              if(d<2000 && d<huntDist){ huntDist=d; huntTarget=c; }
            }
          });
        }

        if(huntTarget){
          steerTo(e, huntTarget.pos, dt);
          const distToTgt = v3len(v3sub(huntTarget.pos, e.pos));
          moveNPC(e, dt, distToTgt > 120);
          npcCombatNPC(e, huntTarget, dt);
          npcFireAt(e, huntTarget.pos, dt);
        } else if(dP < 3000){
          // No NPC targets — fall back to player
          steerTo(e, p.pos, dt);
          moveNPC(e, dt, dP > 150);
          npcFireAt(e, p.pos, dt);
        } else {
          // Bounty hunt — when faction has a bounty on the player, proactively hunt
          // Triggers on patrol timer reset (~30% per 3-5s cycle ≈ same odds as lock+shot no bounty)
          if(!e.hostile && e.aiT <= 0){
            const hasBounty = (FACTIONS[e.factionId]?.playerRep||0) < -30;
            if(hasBounty && dP < 2500 && Math.random() < 0.30){
              e.hostile=true; e.aiSt='chase';
            }
          }

          // No targets — check for a friendly capital to escort, else roam
          if(!e._capEscortOf && Math.random()<0.004){
            const myCap = G.enemies.find(c=>c.isCapital&&c.factionId===e.factionId&&c.struct>0&&
              v3len(v3sub(c.pos,e.pos))<1800);
            if(myCap){
              e._capEscortOf=myCap;
              e._capEscortAngle=Math.random()*PI2;
              e._capEscortDist=280+Math.random()*200;
            }
          }
          if(!e.patT || e.aiT<=0){
            e.aiT = 3+Math.random()*5;
            const a=Math.random()*PI2;
            const home = e.homeBase ? e.homeBase.pos : e.pos;
            let pt2 = v3add(home, v3(Math.cos(a)*cfg.baseR*4,(Math.random()-.5)*150,Math.sin(a)*cfg.baseR*4));
            G.asteroids?.forEach(ast=>{
              const diff2=v3sub(pt2,ast.pos), dist2=v3len(diff2);
              if(dist2 < ast.r*1.5 && dist2 > 0.1)
                pt2 = v3add(pt2, v3scale(v3norm(diff2), ast.r*1.5 - dist2));
            });
            e.patT = pt2;
          }
          steerTo(e, e.patT, dt);
          moveNPC(e, dt, true);
          if(v3len(v3sub(e.patT,e.pos))<120) e.patT=null;
        }
      }
      break;
    }

    // ─── CARGO AI ───
    case 'cargo': {
      if(e.aiSt === 'flee'){
        // Flee away from attacker
        const awayDir = v3norm(v3sub(e.pos, e._attacker || p.pos));
        const fleeTarget = v3add(e.pos, v3scale(awayDir, 600));
        steerTo(e, fleeTarget, dt);
        moveNPC(e, dt, true);
        // Re-ping distress every 5s while fleeing (longer range)
        broadcastDistress(e, AI_CFG.cargo.distressRange);
        // Check if safe
        if(!e._attacker || v3len(v3sub(e.pos, e._attacker)) > 1500){
          e.aiSt = 'patrol'; e._attacker = null;
        }
      } else {
        // Navigate route A → B, detouring around pirate bases
        const tgt = e.patT || (e.routeB ? e.routeB.pos : null);
        if(tgt){
          // Recompute detour waypoint every 3-5 s
          if(!e._detourT || e._detourT <= 0){
            e._detourT = 3 + Math.random()*2;
            e._detourWp = _cargoDetour(e.pos, tgt);
          }
          e._detourT -= dt;
          // Use detour waypoint until we're close to it, then head straight to dest
          const steerTgt = (e._detourWp && v3len(v3sub(e._detourWp, e.pos)) > 200)
            ? e._detourWp : tgt;
          steerTo(e, steerTgt, dt);
          moveNPC(e, dt, true);
          // Reached destination — give assets to station faction, despawn, queue respawn
          if(v3len(v3sub(e.pos, tgt)) < AI_CFG.cargo.dockR){
            const arrivedSt = e.routeB;
            // Primary: cargo owner gets 20 assets
            const ownerFid = e._cargoOwner || arrivedSt?.factionId;
            if(ownerFid) factionAddAssets(ownerFid, 20);
            // Merchant Guild takes 10% for running the freighter (2 assets)
            factionAddAssets('f05', 2);
            // Mercs take 5% for lane security (1 asset)
            factionAddAssets('f09', 1);
            // Respawn from this station to a different random station after 12-20 s
            const otherSts = G.stations.filter(s=>s!==arrivedSt);
            const newDest = otherSts.length ? otherSts[Math.floor(Math.random()*otherSts.length)] : pickStation();
            G.pendingSpawns.push({
              timer: 12+Math.random()*8, role:'cargo',
              routeA: arrivedSt, routeB: newDest, sys: G.sys,
            });
            e._despawn = true;
          }
        } else {
          moveNPC(e, dt, false);
        }
      }
      break;
    }

    // ─── RECOVERY SHIP AI ───
    case 'recovery': {
      if(e._returning){
        // Return to home base with cargo
        if(e.homeBase){
          steerTo(e, e.homeBase.pos, dt);
          moveNPC(e, dt, true);
          if(v3len(v3sub(e.pos, e.homeBase.pos)) < 100){
            // Give pirate base 1 asset per box carried (max 5)
            const assetGain = Math.min(5, e._cargo.length);
            if(assetGain > 0 && e.homeBase.factionId) factionAddAssets(e.homeBase.factionId, assetGain);
            e._cargo = [];
            e._returning = false;
          }
          // When returning under attack, alert nearby pirates from same base to escort
          if(e._attacker && e.homeBase){
            if(!e._escortCd || e._escortCd<=0){
              e._escortCd = 4;
              const isCriminal = FACTIONS[e.factionId]?.cat==='criminal';
              G.enemies.forEach(guard=>{
                if(isCriminal){
                  // Pirate recovery: alert nearby pirates from the same base
                  if(guard.aiRole==='pirate' && guard.homeBase===e.homeBase &&
                     !guard._combatTarget && v3len(v3sub(guard.pos,e.pos))<2500){
                    guard.hostile=true; guard._combatTarget='player'; guard.aiSt='chase';
                  }
                } else {
                  // Merchant/lawful recovery: alert assigned merc escort
                  if(guard.aiRole==='merc' && guard._mercEscortNpc===e){
                    guard.hostile=true; guard._combatTarget='player';
                  }
                }
              });
            }
          }
          if(e._escortCd>0) e._escortCd-=dt;
        }
      } else {
        // Scan for cargo boxes — wide 4000u range, prioritize nearest
        let nearBox = null, bestD = Infinity;
        G.cargoBoxes.forEach(box=>{
          const d = v3len(v3sub(box.pos, e.pos));
          if(d < 4000 && d < bestD){ bestD = d; nearBox = box; }
        });
        if(nearBox){
          steerTo(e, nearBox.pos, dt);
          moveNPC(e, dt, true);
          // Collect — wider scoop radius so they don't circle forever
          if(bestD < 80){
            e._cargo.push({good:nearBox.good, units:nearBox.units});
            G.cargoBoxes.splice(G.cargoBoxes.indexOf(nearBox), 1);
            if(e._cargo.length >= 5) e._returning = true;
          }
        } else {
          // No boxes in range
          if(e._cargo.length > 0){
            // Has some cargo — check if anything within wider range, else go home
            const anyFar = G.cargoBoxes.some(box=>
              v3len(v3sub(box.pos, e.pos)) < 6000
            );
            if(!anyFar) e._returning = true;
            else {
              // Fly toward nearest far box
              let farBox=null, farD=Infinity;
              G.cargoBoxes.forEach(box=>{
                const d=v3len(v3sub(box.pos,e.pos));
                if(d<6000&&d<farD){farD=d;farBox=box;}
              });
              if(farBox){
                steerTo(e, farBox.pos, dt);
                moveNPC(e, dt, true);
              }
            }
          } else {
            // No cargo, no boxes — patrol wider area around base looking for debris
            if(!e.patT || e.aiT<=0){
              e.aiT = 3+Math.random()*4;
              const a=Math.random()*PI2;
              const home = e.homeBase ? e.homeBase.pos : e.pos;
              // Wide patrol radius so they roam toward battle sites
              e.patT = v3add(home, v3(Math.cos(a)*2000,(Math.random()-.5)*100,Math.sin(a)*2000));
            }
            steerTo(e, e.patT, dt);
            moveNPC(e, dt, true);
            if(v3len(v3sub(e.patT, e.pos)) < 100) e.patT = null;
          }
        }
      }
      // Fight back if attacked
      if(e.hostile && dP < 600){
        npcFireAt(e, p.pos, dt);
      }
      break;
    }

    // ─── CAPITAL SHIP AI (§8) ───
    case 'capital': {
      const home = e.homeBase ? e.homeBase.pos : e.pos;

      // ── MIDPOINT PATROL ──
      if(e._capPhase === 'outbound'){
        if(!e._capMidpoint){
          // Pick a nav point and fly to the midpoint between home and it
          const allNav = [...(G.stations||[]), ...(G.pBases||[])];
          const others = allNav.filter(n => v3len(v3sub(n.pos, home)) > 600);
          const navObj = others.length ? others[Math.floor(Math.random()*others.length)] : null;
          e._capNavTarget = navObj;
          e._capMidpoint = navObj
            ? {x:(home.x+navObj.pos.x)*0.5, y:(home.y+navObj.pos.y)*0.5, z:(home.z+navObj.pos.z)*0.5}
            : v3add(home, v3(Math.cos(Math.random()*PI2)*1800, 0, Math.sin(Math.random()*PI2)*1800));
          e._capDwellT = 0;
        }
        const distToMid = v3len(v3sub(e._capMidpoint, e.pos));
        steerTo(e, e._capMidpoint, dt);
        moveNPC(e, dt, distToMid > 200);

        if(distToMid < 200){
          e._capDwellT += dt;
          // Become hostile to enemy capitals encountered at the midpoint
          if(!e.hostile){
            const isCriminal = FACTIONS[e.factionId]?.cat==='criminal';
            const threat = G.enemies.find(m =>
              m !== e && m.isCapital && m.struct>0 &&
              (isCriminal ? !FACTIONS[m.factionId]?.cat || FACTIONS[m.factionId].cat!=='criminal'
                          : FACTIONS[m.factionId]?.cat==='criminal') &&
              v3len(v3sub(m.pos, e.pos)) < 2000
            );
            if(threat) e.hostile = true;
          }
          if(e._capDwellT > 10 + Math.random()*8){
            e._capPhase = 'returning';
            e._capMidpoint = null;
          }
        }
      } else {
        // Returning home
        const distToHome = v3len(v3sub(home, e.pos));
        steerTo(e, home, dt);
        moveNPC(e, dt, distToHome > 250);
        if(distToHome < 300){
          e._capPhase = 'outbound';
          e._capMidpoint = null;
          // Reset hostility on return unless permanently criminal
          if(FACTIONS[e.factionId]?.cat !== 'criminal') e.hostile = false;
        }
      }

      // ── CAPITAL vs CAPITAL DPS ──
      // Apply direct DPS to any nearby hostile capital within turret range
      if(e.hostile && e.components){
        const aliveTurrets = e.components.reduce((s,c)=>s+(c.hp>0?(c.turrets||1):0), 0);
        const capDPS = aliveTurrets * 6;
        G.enemies.forEach(m=>{
          if(m===e || !m.isCapital || m.struct<=0 || m._dead) return;
          const capDist = v3len(v3sub(m.pos, e.pos));
          if(capDist > 1400) return;
          const isFoe = FACTIONS[e.factionId]?.cat==='criminal'
            ? FACTIONS[m.factionId]?.cat!=='criminal'
            : FACTIONS[m.factionId]?.cat==='criminal';
          if(!isFoe) return;
          damageNPC(m, capDPS*dt);
          m._attacker = {...e.pos};
          // Enemy capital reacts — becomes hostile
          if(!m.hostile) m.hostile = true;
          // Alert its escorts
          G.enemies.forEach(guard=>{
            if(guard._capEscortOf===m && !guard.hostile){
              guard.hostile=true; guard._combatTarget=e; guard.aiSt='chase';
            }
          });
        });
      }

      // ── TURRET FIRE at player — criminal factions always hostile; lawful only if bad rep or outlaw ──
      const _capTargetsPlayer = e.hostile && (
        FACTIONS[e.factionId]?.cat === 'criminal' ||
        p.outlaw ||
        (FACTIONS[e.factionId]?.playerRep || 0) < -40
      );
      if(_capTargetsPlayer && e.components && dP < 1200){
        const toPlayer = v3norm(v3sub(p.pos, e.pos));
        e.components.forEach((comp,ci)=>{
          if(comp.hp <= 0) return;
          comp.fireCd = (comp.fireCd||0) - dt;
          if(comp.fireCd > 0) return;
          comp.fireCd = (1.8 / (comp.turrets||1)) + Math.random()*0.6;
          for(let tt=0; tt<(comp.turrets||1); tt++){
            const scatter = v3((Math.random()-.5)*0.08,(Math.random()-.5)*0.08,(Math.random()-.5)*0.08);
            const bDir = v3norm(v3add(toPlayer, scatter));
            const ef = npcForward(e);
            const right = v3norm(v3(ef.z,0,-ef.x));
            const compOffset = v3add(e.pos, v3add(
              v3scale(ef, (ci-1)*e.sz*0.25),
              v3scale(right, (Math.random()-.5)*e.sz*0.3)
            ));
            const wpnCol = tt%2===0 ? '#ff6644' : '#dd88ff';
            const dmg = e.capType==='dreadnought' ? 10 : 7;
            G.eBullets.push({
              pos: compOffset,
              vel: v3scale(bDir, 500+Math.random()*100),
              life: 1.8, maxLife:1.8, dmg, col:wpnCol, sz:2.5,
            });
          }
        });
      }
      break;
    }

    // ─── DEFAULT (fallback) ───
    default: {
      if(!e.patT || e.aiT<=0){
        e.aiT=3+Math.random()*5;
        e.patT=v3add(e.pos,v3((Math.random()-.5)*2000,(Math.random()-.5)*300,(Math.random()-.5)*2000));
      }
      steerTo(e, e.patT, dt);
      moveNPC(e, dt, true);
    }
    } // end switch

    // Despawn if very far from player (not capitals)
    if(dP > 20000 && !e.isCapital) e.struct = 0;
  });

  // Remove dead
  G.enemies = G.enemies.filter(e => e.struct > 0 && !e._dead);

  // Update distress pings — cap at 20
  if(G.distressPings.length > 20) G.distressPings.splice(0, G.distressPings.length - 15);
  G.distressPings = G.distressPings.filter(dp=>{
    dp.r += (dp.speed||300) * dt;
    dp.life -= dt;
    return dp.life > 0 && dp.r < (dp.maxR||2000);
  });

  // Update cargo boxes
  G.cargoBoxes.forEach(box=>{
    box.pos = v3add(box.pos, v3scale(box.vel, dt));
    box.vel = v3scale(box.vel, 0.998); // slow drift
    box.angle += box.spin * dt;
    box.life -= dt;
  });
  // Player picks up cargo boxes
  G.cargoBoxes = G.cargoBoxes.filter(box=>{
    if(box.life <= 0) return false;
    if(v3len(v3sub(box.pos, p.pos)) < 25 && p.cargoUsed < p.cargoMax){
      p.cargo[box.good] = (p.cargo[box.good]||0) + box.units;
      p.cargoUsed += box.units;
      flash(`SCOOPED ${box.units} ${GNAMES[box.good]||box.good}`);
      return false;
    }
    return true;
  });

  // Process pending spawns
  G.pendingSpawns = G.pendingSpawns.filter(ps=>{
    ps.timer -= dt;
    if(ps.timer <= 0){
      if(ps.sys === G.sys){
        if(ps.role === 'cargo'){
          spawnNPC('cargo', null, ps.routeA, ps.routeB || pickStation());
        } else {
          spawnNPC(ps.role, null, null, null, ps.base);
        }
      }
      return false;
    }
    return true;
  });

  // Remove NPCs that docked/despawned cleanly (no death effects)
  for(let i=G.enemies.length-1;i>=0;i--){
    if(G.enemies[i]._despawn) G.enemies.splice(i,1);
  }
}
