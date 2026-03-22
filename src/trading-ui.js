// ═══════════════════════════════════════════════════════════
//  TRADING & SHIPYARD
// ═══════════════════════════════════════════════════════════
let dkSt=null, dkTab='market';

window.switchTab=function(tab){
  dkTab=tab;
  ['market','shipyard','missions','rep'].forEach(t=>{
    const panel=document.getElementById('panel-'+t);
    if(panel) panel.style.display=t===tab?'block':'none';
    const el=document.getElementById('tab-'+t);
    if(el){
      el.style.background=t===tab?'rgba(0,255,204,0.1)':'transparent';
      el.style.color=t===tab?'#00ffcc':'rgba(0,255,204,0.4)';
      el.style.borderColor=t===tab?'rgba(0,255,204,0.3)':'rgba(0,255,204,0.15)';
    }
  });
  if(tab==='shipyard') buildShipyard();
  if(tab==='rep') buildRepScreen();
  if(tab==='missions') buildMissionsPanel();
};

function dock(st){
  G.mode='docked'; dkSt=st; G.p.vel=v3(0,0,0);
  document.getElementById('trade-title').textContent=st.name;
  document.getElementById('trade-sys').textContent=SYS[G.sys].name;
  document.getElementById('trade-msg').textContent='';
  switchTab('market');
  buildMarket(st);
  buildFlavourText();
  document.getElementById('trade-screen').style.display='block';
}

function buildMarket(st){
  const gd=document.getElementById('trade-goods'); gd.innerHTML='';
  GOODS.forEach(g=>{
    let pr=GBASE[g];
    if(st.produces?.includes(g)) pr=Math.round(pr*.6);
    if(st.consumes?.includes(g)) pr=Math.round(pr*1.45);
    const sellPr = st.produces?.includes(g) ? Math.round(pr*.55/.6) : st.consumes?.includes(g) ? Math.round(pr*.92/1.45) : Math.round(pr*.85);
    const own=G.p.cargo[g]||0;
    const row=document.createElement('div'); row.className='trade-row';
    row.innerHTML=`<div class="t-name">${GNAMES[g]}</div><div class="t-price">${pr} CR</div>
      <div class="t-owned">${own}</div>
      <button class="tbtn" onclick="buyG('${g}',${pr})">BUY</button>
      <button class="tbtn sell" onclick="sellG('${g}',${sellPr})">SELL ${sellPr}</button>`;
    gd.appendChild(row);
  });
}

function buildShipyard(){
  const p=G.p;
  // ── SHIPS ──
  const sd=document.getElementById('sy-ships'); sd.innerHTML='';
  Object.entries(SHIP_DEFS).forEach(([key,s])=>{
    const isCurrent = key===p.shipKey;
    const canAfford = p.credits >= s.price && !isCurrent;
    const row=document.createElement('div'); row.className='trade-row';
    row.style.opacity=isCurrent?'1':canAfford?'0.9':'0.4';
    row.style.borderLeft=isCurrent?'2px solid #00ffcc':'2px solid transparent';
    row.style.paddingLeft='6px';
    const hpStr = s.hardpoints.join('·');
    row.innerHTML=`<div style="flex:1">
      <div style="letter-spacing:1px;">${s.name} ${isCurrent?'◄':''}</div>
      <div style="font-size:8px;opacity:0.4;margin-top:2px">T${s.tier} · ${s.mass}t · STR ${s.struct} · CARGO ${s.cargo} · HP[${hpStr}] · ENG×${s.engineSlots}</div>
    </div>
    <div style="width:70px;color:#ffdd44;text-align:right">${s.price?s.price+' CR':'FREE'}</div>
    ${isCurrent?'<div style="width:50px;text-align:right;font-size:8px;opacity:0.5">CURRENT</div>':
      `<button class="tbtn" onclick="buyShip('${key}')" ${canAfford?'':'disabled'}>BUY</button>`}`;
    sd.appendChild(row);
  });

  // ── ENGINES ──
  const ed=document.getElementById('sy-engines'); ed.innerHTML='';
  const bestEngIdx = Math.max(...p.engines);
  ENGINE_TIERS.forEach((eng,i)=>{
    const isCurrent = i===bestEngIdx;
    const isUpgrade = i > bestEngIdx;
    const canAfford = p.credits >= eng.price && isUpgrade;
    const row=document.createElement('div'); row.className='trade-row';
    row.style.opacity=isCurrent?'1':canAfford?'0.9':'0.4';
    row.innerHTML=`<div style="flex:1">
      <div>${eng.name} ${isCurrent?'◄':''}</div>
      <div style="font-size:8px;opacity:0.4;margin-top:2px">T${eng.tier} · Thrust ${eng.thrustForce} · Turn ${eng.baseTurn} · Max ${eng.baseMaxSpd} m/s · Fuel ${eng.fuelRate}/s</div>
    </div>
    <div style="width:70px;color:#ffdd44;text-align:right">${eng.price?eng.price+' CR':'FREE'}</div>
    ${isCurrent?'<div style="width:50px;text-align:right;font-size:8px;opacity:0.5">INSTALLED</div>':
      isUpgrade?`<button class="tbtn" onclick="buyEngine(${i})" ${canAfford?'':'disabled'}>BUY</button>`:''}`;
    ed.appendChild(row);
  });

  // ── ARMOUR ──
  const ad=document.getElementById('sy-armour'); ad.innerHTML='';
  ARMOUR_TYPES.forEach((arm,i)=>{
    const isCurrent = i===p.armourTier;
    const isUpgrade = i > p.armourTier;
    const canAfford = p.credits >= arm.price && isUpgrade;
    const maxArm = SHIP_DEFS[p.shipKey].struct * arm.mult;
    const row=document.createElement('div'); row.className='trade-row';
    row.style.opacity=isCurrent?'1':canAfford?'0.9':'0.4';
    row.innerHTML=`<div style="flex:1">
      <div>${arm.name} ${isCurrent?'◄':''}</div>
      <div style="font-size:8px;opacity:0.4;margin-top:2px">T${arm.tier} · ×${arm.mult} (${maxArm} armour)</div>
    </div>
    <div style="width:70px;color:#ffdd44;text-align:right">${arm.price?arm.price+' CR':'FREE'}</div>
    ${isCurrent?'<div style="width:50px;text-align:right;font-size:8px;opacity:0.5">INSTALLED</div>':
      isUpgrade?`<button class="tbtn" onclick="buyArmour(${i})" ${canAfford?'':'disabled'}>BUY</button>`:''}`;
    ad.appendChild(row);
  });

  // ── WEAPONS PER HARDPOINT ──
  const wd=document.getElementById('sy-weapons'); wd.innerHTML='';
  p.hardpoints.forEach((hp,hpIdx)=>{
    const hpLabel = `SLOT ${hpIdx+1} [${hp.type}]`;
    const curWpn = hp.weapon;
    const hdr=document.createElement('div');
    hdr.style.cssText='font-size:9px;letter-spacing:2px;opacity:0.5;margin:8px 0 4px;color:#00ffcc;';
    hdr.textContent=hpLabel + (curWpn ? ` — ${curWpn.name}` : ' — EMPTY');
    wd.appendChild(hdr);

    // List compatible weapons
    const allWpns = [...WPN_BALLISTIC,...WPN_LASER,...WPN_HYPERVEL];
    const compatible = allWpns.filter(w=>hpAccepts(hp.type, w.type));
    compatible.forEach(w=>{
      const isEquipped = curWpn && curWpn.key===w.key;
      const canAfford = p.credits >= w.price && !isEquipped;
      const row=document.createElement('div'); row.className='trade-row';
      row.style.opacity=isEquipped?'1':canAfford?'0.8':'0.35';
      row.style.fontSize='10px';
      const typeTag = {ballistic:'BAL',laser:'LAS',hypervelocity:'HV'}[w.type]||'?';
      row.innerHTML=`<div style="flex:1">
        <span style="color:${w.col};font-size:8px;letter-spacing:1px;">[${typeTag}]</span> ${w.name} ${isEquipped?'◄':''}
        <span style="font-size:8px;opacity:0.35;margin-left:6px">T${w.tier}</span>
      </div>
      <div style="width:65px;color:#ffdd44;text-align:right;font-size:10px">${w.price?w.price+' CR':'FREE'}</div>
      ${isEquipped?'':'<button class="tbtn" onclick="buyWeapon('+hpIdx+',\''+w.key+'\')" '+(canAfford?'':'disabled')+'>EQUIP</button>'}`;
      wd.appendChild(row);
    });
  });
}

// ── PURCHASE FUNCTIONS ──
window.buyG=function(g,pr){
  const p=G.p;
  if(p.credits<pr){tMsg('INSUFFICIENT CREDITS');return;}
  if(p.cargoUsed>=p.cargoMax){tMsg('CARGO FULL');return;}
  p.credits-=pr;p.cargo[g]=(p.cargo[g]||0)+1;p.cargoUsed++;
  if(dkSt) simEvent('TRADE_COMPLETED',{stationId:dkSt.id,value:pr});
  tMsg(`BOUGHT 1 ${GNAMES[g]}`);buildMarket(dkSt);
};
window.sellG=function(g,pr){
  const p=G.p;
  if(!p.cargo[g]||p.cargo[g]<=0){tMsg('NONE IN CARGO');return;}
  p.credits+=pr;p.cargo[g]--;p.cargoUsed--;
  tMsg(`SOLD 1 ${GNAMES[g]} FOR ${pr} CR`);buildMarket(dkSt);
};

window.buyShip=function(key){
  const p=G.p, s=SHIP_DEFS[key];
  if(p.credits<s.price){tMsg('INSUFFICIENT CREDITS');return;}
  p.credits-=s.price;
  p.shipKey=key; p.ship=s; p.sz=s.sz;
  p.maxStruct=s.struct; p.struct=s.struct;
  p.maxFuel=s.maxFuel; p.fuel=s.maxFuel;
  p.cargoMax=s.cargo;
  // Rebuild hardpoints — transfer compatible weapons
  const oldHPs = p.hardpoints;
  p.hardpoints = s.hardpoints.map((hpType,i) => {
    // Try to transfer weapon from old slot if compatible
    const oldWpn = oldHPs[i]?.weapon;
    const weapon = (oldWpn && hpAccepts(hpType, oldWpn.type)) ? oldWpn : null;
    return { type:hpType, weapon, fireCd:0, laserBeam:null };
  });
  // Rebuild engine slots
  const oldBest = Math.max(...p.engines);
  p.engines = [];
  for(let i=0;i<s.engineSlots;i++) p.engines.push(Math.min(oldBest, ENGINE_TIERS.length-1));
  // Recalc armour
  p.maxArmour = s.struct * ARMOUR_TYPES[p.armourTier].mult;
  p.armour = p.maxArmour;
  calcPlayerPhysics(p);
  tMsg(`PURCHASED ${s.name}`);buildShipyard();
};

window.buyEngine=function(tierIdx){
  const p=G.p, eng=ENGINE_TIERS[tierIdx];
  if(p.credits<eng.price){tMsg('INSUFFICIENT CREDITS');return;}
  p.credits-=eng.price;
  // Upgrade ALL engine slots to this tier
  for(let i=0;i<p.engines.length;i++) p.engines[i]=tierIdx;
  calcPlayerPhysics(p);
  tMsg(`INSTALLED ${eng.name}`);buildShipyard();
};

window.buyArmour=function(tierIdx){
  const p=G.p, arm=ARMOUR_TYPES[tierIdx];
  if(p.credits<arm.price){tMsg('INSUFFICIENT CREDITS');return;}
  p.credits-=arm.price;
  p.armourTier=tierIdx;
  p.maxArmour=SHIP_DEFS[p.shipKey].struct * arm.mult;
  p.armour=p.maxArmour;
  tMsg(`INSTALLED ${arm.name}`);buildShipyard();
};

window.buyWeapon=function(hpIdx,wpnKey){
  const p=G.p, w=ALL_WEAPONS[wpnKey];
  if(!w){tMsg('UNKNOWN WEAPON');return;}
  if(p.credits<w.price){tMsg('INSUFFICIENT CREDITS');return;}
  const hp=p.hardpoints[hpIdx];
  if(!hp){tMsg('INVALID SLOT');return;}
  if(!hpAccepts(hp.type,w.type)){tMsg('INCOMPATIBLE SLOT');return;}
  p.credits-=w.price;
  hp.weapon=w; hp.fireCd=0; hp.laserBeam=null;
  // Set active group if this is first weapon
  const groups=getWeaponGroups(p);
  if(!groups[p.activeGroup]) p.activeGroup=w.type;
  tMsg(`EQUIPPED ${w.name}`);buildShipyard();
};

function tMsg(m){document.getElementById('trade-msg').textContent=m;}
document.getElementById('trade-close').onclick=()=>{
  document.getElementById('trade-screen').style.display='none';
  G.mode='space';dkSt=null;
};
document.getElementById('repair-btn').onclick=()=>{
  const p=G.p;
  if(p.credits<50){tMsg('INSUFFICIENT CREDITS');return;}
  if(p.armour>=p.maxArmour){tMsg('ARMOUR FULL');return;}
  p.credits-=50;p.armour=p.maxArmour;
  if(dkSt) simEvent('STATION_SERVICES',{stationId:dkSt.id,value:50});
  tMsg('ARMOUR REPAIRED');
};
document.getElementById('repair-struct-btn').onclick=()=>{
  const p=G.p;
  if(p.credits<100){tMsg('INSUFFICIENT CREDITS');return;}
  if(p.struct>=p.maxStruct){tMsg('STRUCTURE FULL');return;}
  p.credits-=100;p.struct=p.maxStruct;
  if(dkSt) simEvent('STATION_SERVICES',{stationId:dkSt.id,value:100});
  tMsg('STRUCTURE REPAIRED');
};
document.getElementById('refuel-btn').onclick=()=>{
  const p=G.p;
  if(p.credits<30){tMsg('INSUFFICIENT CREDITS');return;}
  if(p.fuel>=p.maxFuel){tMsg('TANK FULL');return;}
  p.credits-=30;p.fuel=p.maxFuel;
  if(dkSt) simEvent('STATION_SERVICES',{stationId:dkSt.id,value:30});
  tMsg('REFUELED');
};

// ═══════════════════════════════════════════════════════════
//  §14 REP SCREEN + FLAVOUR TEXT
// ═══════════════════════════════════════════════════════════
function buildRepScreen(){
  const known = allFactions().filter(f=>f.flags.revealed);
  const catOrder = ['governmental','corporate','criminal','independent'];
  const catLabel = {governmental:'GOVERNMENTAL',corporate:'CORPORATE',criminal:'CRIMINAL',independent:'INDEPENDENT'};
  let html = '';

  catOrder.forEach(cat=>{
    const facs = known.filter(f=>f.cat===cat);
    if(!facs.length) return;
    html += `<div style="font-size:9px;letter-spacing:3px;opacity:0.4;margin:14px 0 6px;">${catLabel[cat]}</div>`;
    facs.forEach(f=>{
      const rep = f.playerRep;
      const repPct = ((rep+100)/200*100).toFixed(0);
      const rc = repCol(rep);
      const rl = repLabel(rep);
      const strPct = f.str.toFixed(0);
      const goalText = f.activeGoal && rep>=20 ? ` · GOAL: ${f.activeGoal}` : '';
      const bounty = f._bountyActive ? ' <span style="color:#ff4444">⚠ BOUNTY</span>' : '';
      html += `<div style="margin-bottom:10px;padding:6px 8px;border:1px solid rgba(255,255,255,0.06);border-radius:2px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span style="font-size:10px;letter-spacing:2px;color:${f.col}">${f.name}</span>
          <span style="font-size:9px;letter-spacing:1px;color:${rc}">${rl}${bounty}</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <div style="flex:1;height:3px;background:rgba(255,255,255,0.1);border-radius:1px;">
            <div style="width:${repPct}%;height:100%;background:${rc};border-radius:1px;"></div>
          </div>
          <span style="font-size:8px;opacity:0.4;white-space:nowrap">STR ${strPct}</span>
        </div>
        ${goalText?`<div style="font-size:8px;opacity:0.3;margin-top:3px;letter-spacing:1px;">${goalText}</div>`:''}
      </div>`;
    });
  });

  // Relationship matrix (visible if any rep >= 40)
  const majors = ['f01','f02','f04','f05','f07','f08'].filter(id=>FACTIONS[id]?.flags.revealed);
  const canSeeMatrix = majors.some(id=>(FACTIONS[id]?.playerRep||0)>=40);
  if(canSeeMatrix){
    html += `<div style="font-size:9px;letter-spacing:3px;opacity:0.4;margin:14px 0 6px;">FACTION RELATIONS</div>`;
    majors.forEach(id=>{
      const f=FACTIONS[id]; if(!f) return;
      majors.filter(id2=>id2!==id&&FACTIONS[id2]).forEach(id2=>{
        const f2=FACTIONS[id2];
        const rel=f.rels[id2]||0;
        if(Math.abs(rel)<10) return;
        const relC=rel>=40?'#44ffaa':rel>=0?'#888888':rel>=-40?'#ff8844':'#ff4444';
        const relL=rel>=70?'ALLIED':rel>=40?'FRIENDLY':rel>=0?'NEUTRAL':rel>=-40?'HOSTILE':'AT WAR';
        html += `<div style="font-size:9px;display:flex;gap:6px;margin-bottom:3px;opacity:0.7;">
          <span style="color:${f.col};min-width:100px">${f.name}</span>
          <span style="color:${relC};min-width:60px">${relL}</span>
          <span style="color:${f2.col}">${f2.name}</span>
        </div>`;
      });
    });
  }

  document.getElementById('rep-content').innerHTML = html ||
    '<div style="opacity:0.3;font-size:9px;letter-spacing:2px;padding:20px 0;">NO KNOWN FACTIONS</div>';
}

// Flavour text — live-state news
const FLAVOUR_TEMPLATES = [
  f => f.activeGoal==='SUPPRESS' && f._suppressTarget ?
    `${f.name} DEPLOYS STRIKE FORCE AGAINST ${(FACTIONS[f._suppressTarget]?.name||'HOSTILES')}` : null,
  f => f.str < 25 ?
    `${f.name} FORCES STRETCHED — PATROLS RECALLED` : null,
  f => f.str > 80 ?
    `${f.name} EXPANDS OPERATIONS — INCREASED PATROLS` : null,
  f => f.econ < 30 ?
    `${f.name} REPORTS REVENUE SHORTFALL` : null,
  f => f.id==='f04' && !f.flags.exposed && f.flags.destabilizing ?
    `HEGEMONY CORP WINS NEW STATION CONTRACT` : null,
  f => f.id==='f04' && f.flags.exposed ?
    `HEGEMONY CORP UNDER INVESTIGATION` : null,
  f => f.activeGoal==='PROTECT_ROUTES' ?
    `${f.name} ISSUES CONVOY PROTECTION CONTRACTS` : null,
];

function buildFlavourText(){
  const lines = [];
  allFactions().filter(f=>f.flags.active).forEach(f=>{
    FLAVOUR_TEMPLATES.forEach(tpl=>{
      const line = tpl(f);
      if(line && lines.length < 6) lines.push(line);
    });
  });
  lines.sort(()=>Math.random()-.5);
  const el = document.getElementById('flavour-text');
  if(el) el.innerHTML = lines.slice(0,3).join('<br>') || '';
}
