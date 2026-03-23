// ═══════════════════════════════════════════════════════════
//  INPUT STATE
// ═══════════════════════════════════════════════════════════
let keys={}, mX=null, mY=null, mDown=false;

// ═══════════════════════════════════════════════════════════
//  INPUT HANDLERS
// ═══════════════════════════════════════════════════════════
document.addEventListener('keydown',e=>{
  keys[e.key.toLowerCase()]=true;
  if(!G||G.dead||G.mode!=='space') return;
  if(e.key.toLowerCase()==='q' && G?.p) cycleWeaponGroup(G.p);
  if(e.key.toLowerCase()==='e' && G.nearSt) dock(G.nearSt);
  if(e.key.toLowerCase()==='m' && G.nearLZ) openStarMap();

  // T — target nearest to crosshair
  if(e.key.toLowerCase()==='t'){
    if(G.enemies.length===0){ G.targetIdx=-1; G.targetShip=null; G.locked=false; return; }
    const p=G.p, cPos=p.pos, cQ=p.ori;
    let bestDot=-Infinity, bestE=null, bestIdx=-1;
    const pFwd = qFwd(cQ);
    G.enemies.forEach((en,i)=>{
      if(en.struct<=0) return;
      const toE = v3norm(v3sub(en.pos, cPos));
      const dot = v3dot(pFwd, toE);
      if(dot > bestDot){ bestDot=dot; bestE=en; bestIdx=i; }
    });
    if(bestE){ G.targetIdx=bestIdx; G.targetShip=bestE; G.locked=false; }
  }

  // Y — cycle target sequentially
  if(e.key.toLowerCase()==='y'){
    if(G.enemies.length===0){ G.targetIdx=-1; G.targetShip=null; G.locked=false; return; }
    G.targetIdx = (G.targetIdx+1) % G.enemies.length;
    G.targetShip = G.enemies[G.targetIdx];
    G.locked = false;
  }

  // L — toggle lock on current target
  if(e.key.toLowerCase()==='l'){
    if(G.targetShip && G.enemies.includes(G.targetShip) && G.targetShip.struct>0){
      G.locked = !G.locked;
      if(G.locked){
        // Locking is a hostile act — make target aware
        const t=G.targetShip;
        if(t.aiRole==='pirate'||t.aiRole==='merc'){ t.hostile=true; t.aiSt='chase'; }
        if(t.aiRole==='cargo'){ t.aiSt='flee'; t._attacker=G.p.pos; }
        if(t.aiRole==='militia'||t.aiRole==='corporate'){
          G.p.friendlyHits++;
          if(G.p.friendlyHits>=OUTLAW_THRESHOLD&&!G.p.outlaw){
            G.p.outlaw=true; G.p.outlawTimer=OUTLAW_TIME;
            flash('⚠ OUTLAW STATUS — MILITIA HOSTILE');
          }
        }
      }
    } else {
      G.locked=false;
    }
  }

  // N — cycle nav through destinations
  if(e.key.toLowerCase()==='n'){
    const navList = getNavList();
    if(navList.length===0){ G.navIdx=-1; G.navTarget=null; return; }
    G.navIdx = (G.navIdx+1) % navList.length;
    G.navTarget = navList[G.navIdx];
  }
});
document.addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false;});
document.addEventListener('mousemove',e=>{mX=e.clientX;mY=e.clientY;});
document.addEventListener('mousedown',()=>{mDown=true;});
document.addEventListener('mouseup',()=>{mDown=false;});
document.addEventListener('contextmenu',e=>e.preventDefault());

// ═══════════════════════════════════════════════════════════
//  UPDATE — NEWTONIAN FLIGHT MODEL
// ═══════════════════════════════════════════════════════════
function update(dt){
  if(!running||G.dead||G.mode!=='space') return;
  const p=G.p;
  G.time+=dt;

  // ── MOUSE → SHIP NOSE ──
  // Mouse offset from center controls turn rate.
  // mX/mY are null until first mouse move — treat as screen center (zero offset).
  const halfW=W*.45, halfH=H*.45;
  const mx = mX===null ? 0 : Math.max(-1,Math.min(1,(mX-CX)/halfW));
  const my = mY===null ? 0 : Math.max(-1,Math.min(1,(mY-CY)/halfH));

  // Non-linear: squared for fine control near center
  // Yaw rate = HALF of pitch rate for proper space-sim feel
  const yawRate  =  mx * Math.abs(mx) * p.turnRate * 0.5;
  const pitchMul = invertPitch ? 1 : -1;  // default (airplane): mouse-down = pitch up (positive my)
  const pitchRate= pitchMul * my * Math.abs(my) * p.turnRate;

  // A/D keys = roll (same rate as pitch)
  let rollInput = 0;
  if(keys['a']) rollInput =  1;
  if(keys['d']) rollInput = -1;
  const rollRate = rollInput * p.turnRate;

  // Apply via quaternion — yaw around LOCAL up, pitch around LOCAL right, roll around LOCAL forward
  if(Math.abs(yawRate)>.001){
    p.ori = qNorm(qMul(qFromAxisAngle(qUp(p.ori), yawRate*dt), p.ori));
  }
  if(Math.abs(pitchRate)>.001){
    p.ori = qNorm(qMul(qFromAxisAngle(qRight(p.ori), pitchRate*dt), p.ori));
  }
  if(Math.abs(rollRate)>.001){
    p.ori = qNorm(qMul(qFromAxisAngle(qFwd(p.ori), rollRate*dt), p.ori));
  }
  p.ori = qNorm(p.ori); // keep clean

  // Visual cockpit — no roll, keep HUD stable
  p.roll = 0;

  // ── NEWTONIAN THRUST ──
  const fwd = qFwd(p.ori);
  const boost = keys['shift'] && p.fuel > 0;

  if(keys['w'] && p.fuel > 0){
    const force = p.thrustF * (boost ? p.boostMul : 1);
    p.vel = v3add(p.vel, v3scale(fwd, force * dt));
    p.fuel -= p.fuelRate * (boost ? 3 : 1) * dt;
    const back = v3scale(fwd, -10);
    const bestEng = Math.max(...p.engines);
    const tierScale = (bestEng+1) / 3;
    const thrustFrac = Math.min(1, v3len(p.vel) / (p.maxSpd || 220));
    // More particles so the trail is dense enough to fly through
    const nParts = boost ? Math.ceil(3+tierScale*2) : Math.max(1, Math.ceil(1 + tierScale * (0.3+thrustFrac*0.5)));
    const pCol = (bestEng>=3) ? '#44ccff' : (bestEng>=2) ? '#88aaff' : boost ? '#ffaa00' : '#ff6600';
    const pSize = 1.2 + tierScale * 1.8;
    const right = qRight(p.ori), up = qUp(p.ori);
    for(let i=0;i<nParts;i++){
      if(G.parts.length > 800) break; // particle budget
      const lateralOff = v3add(
        v3scale(right, (Math.random()-.5)*4),
        v3scale(up, (Math.random()-.5)*4)
      );
      G.parts.push({
        pos: v3add(p.pos, v3add(back, lateralOff)),
        vel: v3add(v3scale(fwd, -8 - Math.random()*12*tierScale), v3scale(p.vel, 0.55)),
        life: 0.8 + Math.random()*1.0*(1+tierScale*0.3),
        col: pCol, sz: pSize + Math.random()*pSize,
      });
    }
  }

  if(keys['s']){
    const spd=v3len(p.vel);
    if(spd>1){
      const brkDir=v3norm(v3scale(p.vel,-1));
      const brkAmt=Math.min(spd, p.brakeF*dt);
      p.vel=v3add(p.vel, v3scale(brkDir, brkAmt));
    } else {
      p.vel=v3(0,0,0);
    }
  }

  const spd=v3len(p.vel);
  const effectiveMaxSpd = boost ? p.maxSpd * 1.5 : p.maxSpd;
  if(spd>effectiveMaxSpd) p.vel=v3scale(v3norm(p.vel),effectiveMaxSpd);
  p.vel=v3scale(p.vel, .9997);
  p.pos=v3add(p.pos,v3scale(p.vel,dt));
  p.fuel=Math.max(0,p.fuel);

  // Recalculate physics when cargo changes (checked each frame, cheap)
  calcPlayerPhysics(p);

  // ── FIRING — hardpoint group system ──
  // All hardpoints of active weapon group fire together, each on its own cooldown
  p.hardpoints.forEach(hp => {
    if(hp.fireCd > 0) hp.fireCd -= dt;
    // Clear finished laser beams
    if(hp.laserBeam) {
      hp.laserBeam.timer -= dt;
      if(hp.laserBeam.timer <= 0) hp.laserBeam = null;
    }
  });

  if(mDown){
    const activeHPs = p.hardpoints.filter(hp => hp.weapon && hp.weapon.type === p.activeGroup);
    activeHPs.forEach(hp => {
      if(hp.fireCd > 0) return;
      const w = hp.weapon;
      hp.fireCd = w.cd;

      if(w.type === 'ballistic'){
        G.bullets.push({
          pos: v3add(p.pos, v3scale(fwd, 12)),
          vel: v3add(v3scale(fwd, w.velocity), v3scale(p.vel, .5)),
          life: w.range / w.velocity,
          dmgA: w.dmgA, dmgS: w.dmgS, impact: w.impact||0,
          col: w.col, sz: 2,
        });
      } else if(w.type === 'hypervelocity'){
        G.bullets.push({
          pos: v3add(p.pos, v3scale(fwd, 12)),
          vel: v3add(v3scale(fwd, w.velocity), v3scale(p.vel, .3)),
          life: w.range / w.velocity,
          dmgA: w.dmgA, dmgS: w.dmgS, impact: w.impact||0,
          col: w.col, sz: 3, isHV: true,
        });
      } else if(w.type === 'laser'){
        // Laser: set beam active on this hardpoint for beamDur
        hp.laserBeam = { timer: w.beamDur, totalDmgA: w.dmgA, totalDmgS: w.dmgS, range: w.range, col: w.col };
        hp.fireCd = w.beamDur + w.cd; // can't fire again until beam finishes + cooldown
      }
    });
  }

  // ── LASER BEAM HIT CHECK ──
  p.hardpoints.forEach(hp => {
    if(!hp.laserBeam) return;
    const lb = hp.laserBeam;
    const w = hp.weapon;
    if(!w) return;
    const dpsA = lb.totalDmgA / (w.beamDur||1);
    const dpsS = lb.totalDmgS / (w.beamDur||1);
    // Raycast along forward
    G.enemies.forEach(e => {
      if(e.struct <= 0) return; // skip dead
      const toE = v3sub(e.pos, p.pos);
      const along = v3dot(toE, fwd);
      if(along < 0 || along > lb.range) return;
      const perp = v3len(v3sub(toE, v3scale(fwd, along)));
      if(perp < e.sz * 1.5){
        damageNPC(e, (dpsA + dpsS) * dt);
        if(e.struct <= 0){ eDeath(e); }
        else if(e.aiRole==='pirate'||e.aiRole==='merc') { e.hostile=true; e.aiSt='chase'; }
        else if(e.aiRole==='cargo') { e.aiSt='flee'; e._attacker={...p.pos}; broadcastDistress(e, AI_CFG.cargo.distressRange); }
      }
    });
  });

  // ── STATION PROXIMITY ──
  G.nearSt=null;
  let cd=Infinity;
  G.stations.forEach(st=>{
    const d=v3len(v3sub(st.pos,p.pos));
    if(d<st.dockR&&d<cd){cd=d;G.nearSt=st;}
  });
  document.getElementById('dock-prompt').style.display=G.nearSt?'block':'none';
  if(G.nearSt){
    document.getElementById('dock-prompt').textContent='[ E ] DOCK';
  }

  // ── LAUNCH ZONE PROXIMITY ──
  G.nearLZ=false;
  if(G.launchZone){
    const lzDist=v3len(v3sub(G.launchZone.pos,p.pos));
    if(lzDist<250) G.nearLZ=true;
  }
  if(!G.nearSt && G.nearLZ){
    document.getElementById('dock-prompt').style.display='block';
    document.getElementById('dock-prompt').textContent='[ M ] STAR MAP';
  }

  // ── §3 OUTLAW SYSTEM ──
  if(p.outlaw){
    // Timer decrements when no militia within safe distance
    const nearMilitia = G.enemies.some(e=>
      (e.aiRole==='militia'||e.aiRole==='corporate')&&v3len(v3sub(e.pos,p.pos))<OUTLAW_SAFE_DIST
    );
    if(!nearMilitia) p.outlawTimer -= dt;
    if(p.outlawTimer<=0){
      p.outlaw=false; p.friendlyHits=0; p.outlawTimer=0;
      flash('OUTLAW STATUS CLEARED');
    }
  }

  // ── TARGETING ──
  validateTargets();

  // ── MISSIONS ──
  updateMissions(dt);

  // ── FACTION TICKS ──
  fastTickT+=dt;
  if(fastTickT>=45){ fastTickT=0; fastTick(); }
  slowTickT+=dt;
  if(slowTickT>=300){ slowTickT=0; slowTick(); }

  // Rotate world objects
  G.stations.forEach(st=>{st.rAngle+=.15*dt;});
  G.pBases.forEach(pb=>{pb.rAngle+=.08*dt;});

  // Bullets
  // Bullets — cap arrays for safety
  if(G.bullets.length > 200) G.bullets.splice(0, G.bullets.length - 150);
  if(G.eBullets.length > 300) G.eBullets.splice(0, G.eBullets.length - 200);
  updBullets(G.bullets,dt,true);
  updBullets(G.eBullets,dt,false);

  // Enemies
  updEnemies(dt);

  // Spawn — weighted faction table (§16)
  G.spawnT-=dt;
  if(G.spawnT<=0&&G.enemies.length<45){
    const roll=Math.random();
    if(roll<.15) spawnNPC('militia',null,pickStation());
    else if(roll<.30) spawnNPC('cargo',null,pickStation(),pickStation());
    else if(roll<.62) spawnNPC('pirate',null,null,null,G.pBases[Math.floor(Math.random()*G.pBases.length)]);
    else if(roll<.72) spawnNPC('recovery',null,null,null,G.pBases[Math.floor(Math.random()*G.pBases.length)]);
    else if(roll<.85) spawnNPC('merc');
    else spawnNPC('corporate',null,pickStation());
    G.spawnT=8+Math.random()*5;
  }

  // Pirate & recovery reinforcement — each base maintains 5 pirates + 2 recovery
  if(!G._pirateReinforceT) G._pirateReinforceT=0;
  G._pirateReinforceT-=dt;
  if(G._pirateReinforceT<=0){
    G._pirateReinforceT = 6+Math.random()*5;
    G.pBases.forEach(pb=>{
      const atBase = G.enemies.filter(en=>en.aiRole==='pirate'&&en.homeBase&&
        v3len(v3sub(en.homeBase.pos,pb.pos))<50).length;
      if(atBase < 5 && G.enemies.length < 45){
        spawnNPC('pirate',null,null,null,pb);
      }
      const recAtBase = G.enemies.filter(en=>en.aiRole==='recovery'&&en.homeBase&&
        v3len(v3sub(en.homeBase.pos,pb.pos))<50).length;
      if(recAtBase < 2 && G.enemies.length < 45){
        spawnNPC('recovery',null,null,null,pb);
      }
    });
  }

  // Particles
  // Particles — trim if over budget
  if(G.parts.length > 1000) G.parts.splice(0, G.parts.length - 800);
  G.parts=G.parts.filter(pt=>{
    pt.pos=v3add(pt.pos,v3scale(pt.vel,dt));
    pt.life-=dt; return pt.life>0;
  });

  // Shockwaves
  if(G.shockwaves){
    G.shockwaves.forEach(s=>{ s.r+=s.speed*dt; s.life-=dt; });
    G.shockwaves=G.shockwaves.filter(s=>s.life>0);
  }

  // HV flashes
  if(G.hvFlashes){
    G.hvFlashes.forEach(f=>{ f.life-=dt; });
    G.hvFlashes=G.hvFlashes.filter(f=>f.life>0);
  }

  // Flash
  if(flashT>0){flashT-=dt;if(flashT<=0)document.getElementById('flash-msg').style.opacity='0';}

  // Death
  if(p.struct<=0&&!G.dead){
    G.dead=true;running=false;
    for(let i=0;i<60;i++){
      const a=Math.random()*PI2,b=(Math.random()-.5)*PI,sp=50+Math.random()*300;
      G.parts.push({pos:{...p.pos},
        vel:v3(Math.cos(a)*Math.cos(b)*sp,Math.sin(b)*sp,Math.sin(a)*Math.cos(b)*sp),
        life:.5+Math.random()*2,
        col:Math.random()<.3?'#fff':Math.random()<.5?'#ffaa00':'#ff4400',sz:1+Math.random()*3});
    }
    document.getElementById('game-over').style.display='block';
  }
}
