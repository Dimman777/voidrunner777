// ═══════════════════════════════════════════════════════════
//  §5/§12/§13 FACTIONS · REPUTATION · SIMULATION
// ═══════════════════════════════════════════════════════════
// ── FACTION ECONOMY CONFIG ────────────────────────────────────
// shipCost/capitalCost: assets consumed per spawn
// spawnInterval: seconds between economy spawn attempts
// passiveIncome: assets granted every 30 s
// controlBase: base max-ships cap (modified ±by econ/str at runtime)
const FACTION_ECON_CFG = {
  governmental: { shipCost:15, capitalCost:80,  spawnInterval:120, passiveIncome:5, controlBase:12 },
  corporate:    { shipCost:20, capitalCost:100, spawnInterval:150, passiveIncome:4, controlBase:8  },
  criminal:     { shipCost:10, capitalCost:60,  spawnInterval:90,  passiveIncome:3, controlBase:10 },
  independent:  { shipCost:18, capitalCost:90,  spawnInterval:130, passiveIncome:3, controlBase:6  },
};

const FACTIONS_INIT = [
  { id:'f01',name:'SOL POLICE',      cat:'governmental',col:'#4488ff',str:70,econ:65,
    systems:['sol'], spawnWeight:.35,
    rels:{ f02:+20,f03:+30,f04:+15,f05:+30,f06:+20,f07:-80,f08:-60,f09:0,f10:+20 },
    playerRep:0, flags:{ active:true,revealed:true } },
  { id:'f02',name:'NAVAL AUTHORITY',  cat:'governmental',col:'#3366cc',str:75,econ:60,
    systems:['sol','proxima','sirius','vega'], spawnWeight:.20,
    rels:{ f01:+20,f03:+25,f04:+10,f05:+20,f06:+10,f07:-70,f08:-70,f09:+10,f10:+10 },
    playerRep:0, flags:{ active:true,revealed:true } },
  { id:'f03',name:'CUSTOMS BUREAU',   cat:'governmental',col:'#55aaff',str:55,econ:55,
    systems:['sol','proxima','sirius','vega'], spawnWeight:.10,
    rels:{ f01:+30,f02:+25,f04:+5,f05:+15,f06:+10,f07:-65,f08:-65,f09:-5,f10:+5 },
    playerRep:0, flags:{ active:true,revealed:true } },
  { id:'f04',name:'HEGEMONY CORP',    cat:'corporate',col:'#cc44cc',str:80,econ:85,
    systems:['sol','proxima','vega'], spawnWeight:.05,
    rels:{ f01:+10,f02:+10,f03:+5,f05:-10,f06:+20,f07:+35,f08:+25,f09:+15,f10:-20 },
    playerRep:0, flags:{ active:true,revealed:false,destabilizing:true } },
  { id:'f05',name:'MERCHANT GUILD',   cat:'corporate',col:'#44cc88',str:60,econ:70,
    systems:['sol','sirius','vega'], spawnWeight:.20,
    rels:{ f01:+30,f02:+20,f03:+15,f04:-10,f06:+25,f07:-55,f08:-55,f09:+20,f10:+40 },
    playerRep:0, flags:{ active:true,revealed:true } },
  { id:'f06',name:'DEEP VEIN MINING', cat:'corporate',col:'#cc8844',str:55,econ:65,
    systems:['sol','proxima','sirius'], spawnWeight:.10,
    rels:{ f01:+20,f02:+10,f03:+10,f04:+20,f05:+25,f07:-40,f08:-30,f09:+15,f10:+10 },
    playerRep:0, flags:{ active:true,revealed:true } },
  { id:'f07',name:'CLAN ASHFIRE',     cat:'criminal',col:'#ff4400',str:50,econ:40,
    systems:['sol','proxima'], spawnWeight:.35,
    rels:{ f01:-80,f02:-70,f03:-65,f04:+35,f05:-55,f06:-40,f08:-30,f09:-20,f10:-35 },
    playerRep:-10, flags:{ active:true,revealed:true } },
  { id:'f08',name:'CLAN WRECKBORN',   cat:'criminal',col:'#ff6622',str:45,econ:35,
    systems:['sirius','vega'], spawnWeight:.35,
    rels:{ f01:-60,f02:-70,f03:-65,f04:+25,f05:-55,f06:-30,f07:-30,f09:-20,f10:-35 },
    playerRep:-10, flags:{ active:true,revealed:true } },
  { id:'f09',name:'IRONCLAD MERCS',   cat:'independent',col:'#aaaaaa',str:45,econ:50,
    systems:['sol','proxima','sirius','vega'], spawnWeight:.05,
    rels:{ f01:0,f02:+10,f03:0,f04:+15,f05:+20,f06:+15,f07:-20,f08:-20,f10:+10 },
    playerRep:0, flags:{ active:true,revealed:false } },
  { id:'f10',name:'FREE TRADERS',     cat:'independent',col:'#44ccaa',str:40,econ:55,
    systems:['proxima','sirius','vega'], spawnWeight:.15,
    rels:{ f01:+20,f02:+10,f03:+5,f04:-20,f05:+40,f06:+10,f07:-35,f08:-35,f09:+10 },
    playerRep:0, flags:{ active:true,revealed:true } },
];

let FACTIONS = {};
function initFactions(){
  FACTIONS={};
  FACTIONS_INIT.forEach(d=>{
    FACTIONS[d.id]={
      ...d, rels:{...d.rels}, flags:{...d.flags},
      activeGoal:null, recentKills:0,
      assets:50, _spawnCd:Math.random()*60, _passiveCd:30,
    };
  });
}
function getFaction(id){ return FACTIONS[id]; }
function allFactions(){ return Object.values(FACTIONS); }

// ── ECONOMY HELPERS ───────────────────────────────────────────
function factionEconCfg(fid){
  const f=FACTIONS[fid]; if(!f) return FACTION_ECON_CFG.independent;
  return FACTION_ECON_CFG[f.cat] || FACTION_ECON_CFG.independent;
}
function factionAddAssets(fid, amount){
  const f=FACTIONS[fid]; if(!f) return;
  f.assets = Math.min(250, (f.assets||0) + amount);
}
// Active ship count for a faction — excludes cargo freighters (they're infrastructure, not combat power)
function factionPower(fid){
  if(!G||!G.enemies) return 0;
  return G.enemies.filter(e=>e.factionId===fid && e.struct>0 && !e._dead && e.aiRole!=='cargo').length;
}
// Max ships allowed — base + econ/str modifiers
function factionControl(fid){
  const f=FACTIONS[fid]; if(!f) return 0;
  const cfg=factionEconCfg(fid);
  return cfg.controlBase
    + Math.floor((f.econ-50)*0.08)
    + Math.floor((f.str -50)*0.04);
}

// §13 Rep helpers
function repLabel(rep){
  if(rep>=60) return 'ALLIED';
  if(rep>=40) return 'FRIENDLY';
  if(rep>=20) return 'WARM';
  if(rep>=0)  return 'NEUTRAL';
  if(rep>=-20) return 'COLD';
  if(rep>=-40) return 'HOSTILE';
  return 'ENEMY';
}
function repCol(rep){
  if(rep>=40) return '#44ff88';
  if(rep>=20) return '#88ffaa';
  if(rep>=0)  return '#888888';
  if(rep>=-20) return '#ffaa44';
  if(rep>=-40) return '#ff6644';
  return '#ff2222';
}

function adjustRep(fid,delta,silent){
  const f=FACTIONS[fid]; if(!f)return;
  f.playerRep=Math.max(-100,Math.min(100,f.playerRep+delta));
  if(!f.flags.revealed && delta>0) f.flags.revealed=true;
  if(!silent && Math.abs(delta)>=1) flash(`${f.name}: ${delta>0?'+':''}${Math.round(delta)} REP`);
}
function adjustStr(fid,delta){
  const f=FACTIONS[fid]; if(!f)return;
  f.str=Math.max(0,Math.min(100,f.str+delta));
  if(f.str<=0){ f.flags.active=false; flash(`${f.name}: ELIMINATED`); }
}
function adjustEcon(fid,delta){
  const f=FACTIONS[fid]; if(!f)return;
  f.econ=Math.max(0,Math.min(100,f.econ+delta));
}

// Event queue for player actions → processed on fast tick
function simEvent(type,data){
  if(!G||!G.eventQueue) return;
  G.eventQueue.push({type,data});
}

// ── GOAL SYSTEM ──
const GOALS={
  SURVIVE:{
    trigger:f=>f.str<20,
    tick:()=>{},
    done:f=>f.str>40,
    abandon:f=>f.str<=0,
  },
  SUPPRESS:{
    trigger:(f)=>{
      return Object.entries(f.rels).some(([tid,rel])=>
        rel<-50 && f.str>50 && FACTIONS[tid]?.flags.active);
    },
    activate:(f)=>{
      const target=Object.entries(f.rels)
        .filter(([tid,rel])=>rel<-50&&FACTIONS[tid]?.flags.active)
        .sort((a,b)=>a[1]-b[1])[0];
      f._suppressTarget=target?.[0]||null;
    },
    tick:(f)=>{ if(f._suppressTarget) adjustStr(f._suppressTarget,-1); },
    done:(f)=>!f._suppressTarget||(FACTIONS[f._suppressTarget]?.str||0)<25,
    abandon:(f)=>f.str<35,
  },
  DESTABILIZE:{
    trigger:f=>f.id==='f04'&&f.flags.destabilizing&&!f.flags.exposed,
    tick:(f)=>{
      ['f07','f08'].forEach(pid=>{adjustStr(pid,+1);adjustEcon(pid,+0.5);});
      adjustEcon('f04',-0.5);
    },
    done:f=>!!f.flags.exposed,
    abandon:f=>!!f.flags.exposed,
  },
  PROTECT_ROUTES:{
    trigger:f=>(f.cat==='corporate'||f.cat==='independent')&&f.econ<45,
    tick:f=>{adjustEcon(f.id,+1);},
    done:f=>f.econ>65,
    abandon:f=>f.econ<15,
  },
};

function evalGoals(){
  allFactions().forEach(f=>{
    if(!f.flags.active) return;
    if(f.activeGoal){
      const g=GOALS[f.activeGoal];
      if(!g){f.activeGoal=null;return;}
      if(g.abandon&&g.abandon(f)){f.activeGoal=null;return;}
      if(g.done&&g.done(f)){f.activeGoal=null;}
      else if(g.tick) g.tick(f);
    }
    if(!f.activeGoal){
      for(const gid of['SURVIVE','DESTABILIZE','SUPPRESS','PROTECT_ROUTES']){
        const g=GOALS[gid];
        if(g.trigger&&g.trigger(f)){
          f.activeGoal=gid;
          if(g.activate) g.activate(f);
          break;
        }
      }
    }
  });
}

// ── FAST TICK (45s) — event processing, spawn weights, prices ──
let fastTickT=0;
function fastTick(){
  const queue=G.eventQueue||[];
  G.eventQueue=[];

  queue.forEach(ev=>{
    if(ev.type==='SHIP_DESTROYED'){
      const d=ev.data, f=FACTIONS[d.factionId]; if(!f)return;
      const strHit = d.hullKey==='cruiser'?-2:d.hullKey==='freighter_npc'?-0.2:-0.5;
      adjustStr(d.factionId,strHit);   // structural damage always (reflects real loss)
      adjustEcon(d.factionId,-0.3);    // economic damage always
      // Rep and bounty tracking only for player kills — NPC-vs-NPC combat is invisible to player rep
      if(d.playerKill){
        const repHit = d.hullKey==='cruiser'?-10:d.hullKey==='freighter_npc'?-5:-3;
        adjustRep(d.factionId,repHit,true);
        f.recentKills=(f.recentKills||0)+1;
        if(f.cat==='criminal'){
          adjustRep('f01',+2,true);
          adjustRep('f05',+2,true);
          adjustRep('f10',+1,true);
        }
      }
    }
    if(ev.type==='TRADE_COMPLETED'){
      const st=G.stations.find(s=>s.id===ev.data.stationId);
      if(st?.factionId){
        adjustEcon(st.factionId,ev.data.value/1000);
        if(ev.data.value>500) adjustRep(st.factionId,1,true);
      }
    }
    if(ev.type==='STATION_SERVICES'){
      const st=G.stations.find(s=>s.id===ev.data.stationId);
      if(st?.factionId) adjustEcon(st.factionId,ev.data.value/500);
    }
  });

  // Bounty threshold
  allFactions().forEach(f=>{
    if((f.recentKills||0)>=5 && f.playerRep<-30){
      flash(`${f.name}: BOUNTY ISSUED`);
      f._bountyActive=true;
    }
    f.recentKills=0;
  });

  // Update spawn weights
  allFactions().forEach(f=>{
    const base=FACTIONS_INIT.find(d=>d.id===f.id)?.spawnWeight||.1;
    let w=base;
    if(f.str>80) w*=1.5;
    else if(f.str<30) w*=.4;
    else if(f.str<10) w*=.1;
    if(f.activeGoal==='SUPPRESS') w*=1.4;
    if(!f.flags.active) w=0;
    f.spawnWeight=w;
  });
}

// ── SLOW TICK (5 min) — world evolution ──
let slowTickT=0;
function slowTick(){
  allFactions().forEach(f=>{
    if(!f.flags.active) return;
    // Str from econ
    adjustStr(f.id,(f.econ-50)*0.05);
    // Econ from controlled stations
    const ownedSt=G.stations.filter(s=>s.factionId===f.id).length;
    adjustEcon(f.id,ownedSt*2);
    if(f.activeGoal==='SUPPRESS') adjustEcon(f.id,-3);
    // Relationship drift toward 0
    Object.keys(f.rels).forEach(tid=>{
      const rel=f.rels[tid];
      const rate=(Math.abs(rel)>60)?0.25:0.5;
      if(Math.abs(rel)>0.5) f.rels[tid]-=Math.sign(rel)*rate;
    });
    // Shared enemy bonus
    allFactions().forEach(f2=>{
      if(f2.id===f.id) return;
      const shared=allFactions().some(e=>
        e.id!==f.id&&e.id!==f2.id&&
        (f.rels[e.id]||0)<-50&&(f2.rels[e.id]||0)<-50
      );
      if(shared) f.rels[f2.id]=Math.min(100,(f.rels[f2.id]||0)+0.3);
    });
  });
  evalGoals();
}

// ── ECONOMY TICK — called every frame from update() ───────────
function econTick(dt){
  if(!G || G.mode!=='space') return;
  allFactions().forEach(f=>{
    if(!f.flags.active) return;
    const cfg = factionEconCfg(f.id);

    // Passive income every 30 s
    f._passiveCd -= dt;
    if(f._passiveCd <= 0){
      f._passiveCd = 30;
      factionAddAssets(f.id, cfg.passiveIncome);
    }

    // Spawn attempt on interval
    f._spawnCd -= dt;
    if(f._spawnCd <= 0){
      f._spawnCd = cfg.spawnInterval;
      const power   = factionPower(f.id);
      const control = factionControl(f.id);
      if(power < control){
        // Capital: needs 70% of control filled AND enough capital assets
        if(f.assets >= cfg.capitalCost && power >= Math.floor(control * 0.7)){
          factionSpawnCapital(f.id);
          f.assets -= cfg.capitalCost;
        } else if(f.assets >= cfg.shipCost){
          factionSpawnShip(f.id);
          f.assets -= cfg.shipCost;
        }
      }
    }
  });
}

function factionSpawnShip(fid){
  const f=FACTIONS[fid]; if(!f||!G) return;
  if(f.cat==='criminal'){
    const base=G.pBases.find(pb=>pb.factionId===fid);
    if(!base) return;
    spawnNPC(Math.random()<0.65?'pirate':'recovery', f.col, null, null, base);
  } else if(f.cat==='corporate'){
    if(fid==='f05' && Math.random()<0.20){
      // Merchant Guild: 20% chance to deploy a salvage/recovery ship at their station
      const homeSt = G.stations.find(s=>s.factionId===fid) || pickStation();
      spawnNPC('recovery', f.col, homeSt, null, null);
    } else {
      // Cargo run — Merchants use 30% own routes, 70% carry goods for other factions
      let routeFrom;
      if(fid==='f05' && Math.random()>0.30){
        const otherSts = G.stations.filter(s=>s.factionId && s.factionId!==fid);
        routeFrom = otherSts.length ? otherSts[Math.floor(Math.random()*otherSts.length)] : pickStation();
      } else {
        routeFrom = G.stations.find(s=>s.factionId===fid) || pickStation();
      }
      const allDest = G.stations.filter(s=>s!==routeFrom);
      const dest = allDest.length ? allDest[Math.floor(Math.random()*allDest.length)] : pickStation();
      spawnNPC(Math.random()<0.55?'corporate':'cargo', f.col, routeFrom, dest);
    }
  } else {
    // governmental / independent
    const st=pickStation();
    const dest=pickStation();
    if(Math.random()<0.65) spawnNPC('militia', f.col, st);
    else spawnNPC('cargo', f.col, st, dest);
  }
}

function factionSpawnCapital(fid){
  const f=FACTIONS[fid]; if(!f||!G) return;
  if(f.cat==='criminal'){
    const base=G.pBases.find(pb=>pb.factionId===fid);
    if(base) spawnCapital(base);
  } else {
    const homeObj = G.stations.find(s=>s.factionId===fid) || pickStation();
    spawnCapital(homeObj, fid, false); // non-hostile lawful capital
  }
}
