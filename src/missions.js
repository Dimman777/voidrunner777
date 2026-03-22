// ═══════════════════════════════════════════════════════════
//  §10 MISSION SYSTEM + §11 STORY ARC
// ═══════════════════════════════════════════════════════════
let _storyFlags = {};
function getStoryFlag(k){ return _storyFlags[k]||false; }
function setStoryFlag(k,v){ _storyFlags[k]=v; }

// ── STORY MISSIONS (§11) ──
const STORY_MISSIONS = [
  // Act 1
  { id:'s1', act:1, gate:()=>true,
    title:'ROUTINE CONVOY ESCORT', type:'escort', factionId:'f05',
    body:'Merchant Guild freighter needs safe passage. Standard escort pay.',
    reward:800, onComplete:()=>{ adjustRep('f05',15,true); setStoryFlag('s1_done',true); }},
  { id:'s2', act:1, gate:()=>getStoryFlag('s1_done'),
    title:'COORDINATED ATTACK DEBRIEFING', type:'bounty', factionId:'f05',
    targetFactionId:'f07', count:5,
    body:'Clan Ashfire launched a coordinated raid. Eliminate 5 of their fighters.',
    reward:1400, onComplete:()=>{ adjustStr('f07',-10); setStoryFlag('s2_done',true); }},
  { id:'s3', act:1, gate:()=>getStoryFlag('s2_done'),
    title:'WRECKAGE SURVEY — ECHO-7', type:'intel', factionId:'f02',
    body:'Naval Authority needs sensor data from a debris field. Fly to the marked coordinates.',
    reward:2000, onComplete:()=>{ adjustRep('f02',20,true); setStoryFlag('conspiracy',true); setStoryFlag('s3_done',true); }},
  // Act 2
  { id:'s4', act:2, gate:()=>getStoryFlag('s3_done'),
    title:'PIRATE MOVEMENT INTEL', type:'bounty', factionId:'f02',
    targetFactionId:'f07', count:4,
    body:'Naval intel suggests both pirate clans are being supplied. Eliminate 4 hostiles for data.',
    reward:2800, onComplete:()=>{ adjustRep('f07',-10,true); adjustRep('f08',-10,true); setStoryFlag('s4_done',true); }},
  { id:'s5', act:2, gate:()=>getStoryFlag('s4_done'),
    title:"A PIRATE'S OFFER", type:'delivery', factionId:'f07',
    good:'medicine', qty:3, destFaction:'f07',
    body:'Clan Ashfire requests medical supplies as a gesture of good faith. Deliver 3 MEDIPACKS.',
    reward:3500, onComplete:()=>{ adjustRep('f07',15,true); setStoryFlag('s5_done',true); }},
  { id:'s6', act:2, gate:()=>getStoryFlag('s5_done'),
    title:'FREELANCE: CONVOY INTERCEPT', type:'bounty', factionId:'f04',
    targetFactionId:'f05', count:2,
    body:'Anonymous contract: disable 2 Merchant Guild cargo ships. Payment on completion.',
    reward:5000, onComplete:()=>{ adjustRep('f05',-25,true); FACTIONS['f04'].flags.revealed=true; setStoryFlag('s6_done',true); flash('HEGEMONY CORP EXPOSED AS CONTRACT ISSUER'); }},
  // Act 3
  { id:'s7', act:3, gate:()=>getStoryFlag('s6_done'),
    title:'EXPOSE HEGEMONY', type:'intel', factionId:'f02',
    body:'Naval Authority needs evidence of Hegemony funding pirate operations. Scan two locations.',
    reward:8000, onComplete:()=>{
      FACTIONS['f04'].flags.exposed=true; FACTIONS['f04'].flags.destabilizing=false;
      // Hegemony/Naval at war
      if(FACTIONS['f04']) FACTIONS['f04'].rels['f02']=-80;
      if(FACTIONS['f02']) FACTIONS['f02'].rels['f04']=-80;
      setStoryFlag('s7_done',true);
    }},
  { id:'s8', act:3, gate:()=>getStoryFlag('s7_done'),
    title:'PROTECT NAVAL CONVOY', type:'escort', factionId:'f02',
    body:'Naval Authority convoy under threat from Hegemony forces. Escort safely.',
    reward:6500, onComplete:()=>{ adjustRep('f02',20,true); adjustRep('f05',15,true); setStoryFlag('s8_done',true); }},
  { id:'s9', act:3, gate:()=>getStoryFlag('s8_done'),
    title:'THE SIRIUS BATTLE', type:'bounty', factionId:'f02',
    targetFactionId:'f04', count:8,
    body:'Full-scale engagement authorised. Eliminate 8 Hegemony fighters in the Sirius system.',
    reward:12000, onComplete:()=>{ adjustStr('f02',20); adjustStr('f04',-30); setStoryFlag('s9_done',true); }},
  // Act 4
  { id:'s10', act:4, gate:()=>getStoryFlag('s9_done'),
    title:'ASSAULT ON HEGEMONY PRIME', type:'bounty', factionId:'f02',
    targetFactionId:'f04', count:12,
    body:'Final offensive. Destroy all remaining Hegemony forces. This ends the war.',
    reward:25000, onComplete:()=>{
      adjustStr('f04',-100); adjustStr('f07',-20); adjustStr('f08',-20);
      setStoryFlag('s10_done',true);
      flash('HEGEMONY CORP ELIMINATED — THE VOID IS FREE');
    }},
];

// ── PROCEDURAL MISSION GENERATION ──
function generateMissions(station){
  const missions = [];
  const sys = G.sys;

  // 1 — ESCORT
  const escortFacs = ['f05','f10'].filter(id=>FACTIONS[id]?.flags.active && (FACTIONS[id]?.playerRep||0)>-20);
  if(escortFacs.length){
    const fid=escortFacs[Math.floor(Math.random()*escortFacs.length)];
    const f=FACTIONS[fid];
    const pay=Math.round(400+(f.econ||50)*8+(f.str||50)*4);
    const dest=G.stations.filter(s=>s.id!==station.id)
      .sort((a,b)=>v3len(v3sub(b.pos,station.pos))-v3len(v3sub(a.pos,station.pos)))[0];
    if(dest) missions.push({
      id:'p_escort_'+G.time, type:'escort', factionId:fid,
      title:'CONVOY ESCORT', faction:f.name,
      body:`${f.name} freighter to ${dest.name}. Escort safely.`,
      reward:pay, _originStation:station, _destStation:dest,
    });
  }

  // 2 — BOUNTY: police post kill contracts on pirates
  const pirateFacs = allFactions().filter(f=>f.cat==='criminal'&&f.flags.active&&f.str>20&&
    f.systems.includes(sys));
  if(pirateFacs.length){
    const pf=pirateFacs[0];
    const police=FACTIONS[SYS[sys]?.systemPolice||'f01']||FACTIONS['f01'];
    const count=Math.max(2,Math.floor(pf.str/15));
    const pay=Math.round(count*(200+(police?.str||50)*3));
    missions.push({
      id:'p_bounty_'+G.time, type:'bounty', factionId:police?.id||'f01',
      targetFactionId:pf.id, count, progress:0,
      title:'PIRATE SUPPRESSION BOUNTY', faction:police?.name||'POLICE',
      body:`Eliminate ${count} ${pf.name} hostiles.`, reward:pay,
    });
  }

  // 3 — DELIVERY
  if(station.consumes?.length){
    const good=station.consumes[Math.floor(Math.random()*station.consumes.length)];
    const src=G.stations.find(s=>s.id!==station.id&&(s.produces||[]).includes(good));
    if(src){
      const f=FACTIONS[station.factionId];
      const qty=Math.max(1,Math.floor(3-(f?.econ||50)/40));
      const pay=Math.round((GBASE[good]||50)*2.2*qty);
      missions.push({
        id:'p_delivery_'+G.time, type:'delivery', factionId:station.factionId,
        good, qty, destStationId:station.id, srcStationId:src.id,
        title:'SUPPLY CONTRACT: '+(GNAMES[good]||good).toUpperCase(),
        faction:(f||{name:'LOCAL'}).name,
        body:`Deliver ${qty}× ${GNAMES[good]||good} from ${src.name}.`, reward:pay,
      });
    }
  }

  // 4 — SUPPRESSION
  allFactions().forEach(f=>{
    if(f.activeGoal==='SUPPRESS'&&f._suppressTarget&&f.systems?.includes(sys)){
      const tgt=FACTIONS[f._suppressTarget]; if(!tgt)return;
      missions.push({
        id:'p_suppress_'+f.id+'_'+G.time, type:'bounty', factionId:f.id,
        targetFactionId:tgt.id, count:3, progress:0,
        title:'SUPPRESSION: '+tgt.name.toUpperCase(), faction:f.name,
        body:`${f.name} orders: eliminate 3 ${tgt.name} ships.`,
        reward:Math.round(f.str*30),
      });
    }
  });

  return missions;
}

// ── MISSION BOARD ──
function refreshMissionBoard(){
  if(!dkSt) return;
  const M=G.missions;
  if(M.active) return; // don't regenerate while mission active
  M.board = generateMissions(dkSt);

  // Inject available story missions
  const nextStory = STORY_MISSIONS.find(sm=>
    sm.gate() && !M.completedStory.includes(sm.id) && (!M.active || M.active.id!==sm.id)
  );
  if(nextStory) M.board.unshift({...nextStory, isStory:true});
}

function buildMissionsPanel(){
  const M=G.missions;
  refreshMissionBoard();

  // Active mission
  const ad=document.getElementById('missions-active');
  if(M.active){
    const m=M.active;
    const prog=missionProgress(m);
    const progBar = prog.total>1 ? ` [${prog.current}/${prog.total}]` : '';
    ad.innerHTML=`
      <div style="font-size:9px;letter-spacing:3px;opacity:0.4;margin-bottom:6px;">ACTIVE MISSION</div>
      <div style="border:1px solid rgba(0,255,204,0.25);padding:8px 10px;margin-bottom:8px;">
        <div style="font-size:11px;letter-spacing:2px;color:#ffdd44;margin-bottom:4px;">
          ${m.isStory?'◆ ':''}${m.title}${progBar}
        </div>
        <div style="font-size:9px;opacity:0.5;line-height:1.6;margin-bottom:6px;">${m.body||''}</div>
        <div style="display:flex;gap:8px;align-items:center;">
          <span style="font-size:9px;color:#ffdd44">${m.reward} CR</span>
          <span style="font-size:8px;opacity:0.3">${m.faction||''}</span>
          <button class="tbtn sell" onclick="abandonMission()" style="margin-left:auto;">ABANDON</button>
        </div>
      </div>`;
  } else {
    ad.innerHTML='';
  }

  // Board
  const bd=document.getElementById('missions-board');
  if(M.active){
    bd.innerHTML='<div style="font-size:9px;opacity:0.3;letter-spacing:2px;padding:10px 0;">COMPLETE OR ABANDON CURRENT MISSION TO VIEW BOARD</div>';
    return;
  }
  if(!M.board.length){
    bd.innerHTML='<div style="font-size:9px;opacity:0.3;letter-spacing:2px;padding:10px 0;">NO MISSIONS AVAILABLE</div>';
    return;
  }
  let html='<div style="font-size:9px;letter-spacing:3px;opacity:0.4;margin-bottom:8px;">MISSION BOARD</div>';
  M.board.forEach((m,i)=>{
    html+=`<div style="border:1px solid rgba(0,255,204,0.12);padding:8px 10px;margin-bottom:6px;">
      <div style="font-size:10px;letter-spacing:1px;color:${m.isStory?'#ffdd44':'#00ffcc'};margin-bottom:3px;">
        ${m.isStory?'◆ ':''}${m.title}
      </div>
      <div style="font-size:9px;opacity:0.45;line-height:1.5;margin-bottom:5px;">${m.body||''}</div>
      <div style="display:flex;gap:8px;align-items:center;">
        <span style="font-size:9px;color:#ffdd44">${m.reward} CR</span>
        <span style="font-size:8px;opacity:0.3">${m.faction||''}</span>
        <button class="tbtn" onclick="acceptMission(${i})" style="margin-left:auto;">ACCEPT</button>
      </div>
    </div>`;
  });
  bd.innerHTML=html;
}

function missionProgress(m){
  if(!m) return {current:0,total:0};
  if(m.type==='bounty') return {current:m.progress||0, total:m.count||1};
  if(m.type==='delivery'){
    const held = G.p.cargo[m.good]||0;
    return {current:Math.min(held,m.qty), total:m.qty};
  }
  if(m.type==='escort') return {current:m._escortAlive?1:0, total:1};
  if(m.type==='intel') return {current:m._scanned?1:0, total:1};
  return {current:0,total:1};
}

window.acceptMission=function(idx){
  const M=G.missions;
  if(M.active){tMsg('ALREADY ON A MISSION');return;}
  const m=M.board[idx];
  if(!m)return;
  M.active={...m, progress:0, _escortAlive:true, _scanned:false};
  M.board=[];

  // Bounty/suppression: guarantee enough targets exist
  if(m.type==='bounty' && m.targetFactionId){
    const needed = m.count || 3;
    const existing = G.enemies.filter(e=>e.factionId===m.targetFactionId && e.struct>0).length;
    if(existing < needed){
      const toSpawn = (needed - existing) + 1 + Math.floor(Math.random()*3);
      const targetFac = FACTIONS[m.targetFactionId];
      const isCriminal = targetFac?.cat === 'criminal';
      for(let s=0; s<toSpawn; s++){
        if(isCriminal && G.pBases.length > 0){
          const pb = G.pBases[Math.floor(Math.random()*G.pBases.length)];
          spawnNPC('pirate', null, null, null, pb);
        } else {
          // Non-pirate faction targets (e.g. Hegemony story missions): spawn as corporate near stations
          const st = pickStation();
          const e2 = spawnNPC('corporate', targetFac?.col||'#cc44cc', st);
          if(e2) e2.factionId = m.targetFactionId;
        }
      }
    }
  }

  // Spawn escort freighter if escort mission
  if(m.type==='escort' && m._originStation && m._destStation){
    const e=spawnNPC('cargo',null,m._originStation,m._destStation);
    if(e){
      e._escortMissionId=m.id;
      M.active._escortNPC=e;
    }
  }

  // Intel mission: mark scan target
  if(m.type==='intel'){
    // Random point 2000-4000u from player
    const a=Math.random()*PI2;
    M.active._scanTarget=v3add(G.p.pos, v3(Math.cos(a)*3000,(Math.random()-.5)*200,Math.sin(a)*3000));
    M.active._scanRadius=150;
  }

  tMsg(`MISSION ACCEPTED: ${m.title}`);
  buildMissionsPanel();
};

window.abandonMission=function(){
  const M=G.missions;
  if(!M.active)return;
  flash(`MISSION ABANDONED: ${M.active.title}`);
  M.active=null;
};

function completeMission(){
  const M=G.missions;
  const m=M.active;
  if(!m) return;
  G.p.credits += m.reward;
  flash(`MISSION COMPLETE: ${m.title} +${m.reward} CR`);

  // Faction rep
  if(m.factionId) adjustRep(m.factionId, 5, true);

  // Story callback
  if(m.isStory && m.onComplete) m.onComplete();
  if(m.isStory) M.completedStory.push(m.id);

  // Delivery: consume goods
  if(m.type==='delivery' && m.good){
    const take=Math.min(G.p.cargo[m.good]||0, m.qty);
    G.p.cargo[m.good]-=take; G.p.cargoUsed-=take;
  }

  M.active=null;
}

// ── MISSION PROGRESS CHECKS (called from update loop) ──
function updateMissions(dt){
  const M=G.missions;
  if(!M.active) return;
  const m=M.active;
  const p=G.p;

  // Escort: check if freighter is alive and reached destination
  if(m.type==='escort'){
    const npc=m._escortNPC;
    if(npc && (!G.enemies.includes(npc) || npc.struct<=0)){
      m._escortAlive=false;
      flash('ESCORT TARGET DESTROYED — MISSION FAILED');
      M.active=null; return;
    }
    if(npc && m._destStation){
      if(v3len(v3sub(npc.pos, m._destStation.pos)) < 200){
        completeMission(); return;
      }
    }
  }

  // Delivery: check on dock at destination
  if(m.type==='delivery' && G.mode==='docked' && dkSt){
    if(dkSt.id===m.destStationId){
      const held=G.p.cargo[m.good]||0;
      if(held>=m.qty){ completeMission(); return; }
    }
  }

  // Bounty: checked in eDeath
  if(m.type==='bounty' && (m.progress||0)>=(m.count||1)){
    completeMission(); return;
  }

  // Intel: check proximity to scan target
  if(m.type==='intel' && m._scanTarget){
    const d=v3len(v3sub(p.pos, m._scanTarget));
    if(d < (m._scanRadius||150)){
      m._scanned=true;
      completeMission(); return;
    }
  }
}

// Wire bounty kills into eDeath — call after enemy death
function checkBountyKill(e){
  const M=G.missions;
  if(!M.active || M.active.type!=='bounty') return;
  const m=M.active;
  // Check if killed enemy matches target faction
  if(m.targetFactionId && e.factionId===m.targetFactionId){
    m.progress=(m.progress||0)+1;
    flash(`BOUNTY: ${m.progress}/${m.count}`);
  }
  // Also match by role for generic pirate bounties
  if(m.target==='pirate' && e.aiRole==='pirate' && (!m.targetFactionId || e.factionId===m.targetFactionId)){
    if(!m.targetFactionId){ m.progress=(m.progress||0)+1; flash(`BOUNTY: ${m.progress}/${m.count}`); }
  }
}
