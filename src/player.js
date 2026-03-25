// ═══════════════════════════════════════════════════════════
//  INPUT STATE
// ═══════════════════════════════════════════════════════════
let keys={}, mX=null, mY=null, mDown=false;

// ═══════════════════════════════════════════════════════════
//  INPUT HANDLERS
// ═══════════════════════════════════════════════════════════
document.addEventListener('keydown',e=>{
  keys[e.key.toLowerCase()]=true;
  sndInit(); // unlock AudioContext on first key press
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
        if(t.aiRole==='merc'){ t.hostile=true; t.aiSt='chase'; } // mercs react to being locked
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

  // N — cycle nav through destinations (clears cargo target)
  if(e.key.toLowerCase()==='n'){
    G.cargoTarget = null;
    const navList = getNavList();
    if(navList.length===0){ G.navIdx=-1; G.navTarget=null; return; }
    G.navIdx = (G.navIdx+1) % navList.length;
    G.navTarget = navList[G.navIdx];
  }

  // C — target cargo box nearest to crosshair (like T for enemies)
  if(e.key.toLowerCase()==='c'){
    if(G.cargoTarget){ G.cargoTarget=null; return; }  // toggle off
    if(!G.cargoBoxes.length) return;
    const pFwd=qFwd(G.p.ori);
    let bestDot=-Infinity, best=null;
    G.cargoBoxes.forEach(box=>{
      const toBox=v3norm(v3sub(box.pos,G.p.pos));
      const dot=v3dot(pFwd,toBox);
      if(dot>bestDot){ bestDot=dot; best=box; }
    });
    if(best){ G.cargoTarget=best; G.navIdx=-1; G.navTarget=null; }
  }
});
document.addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false;});
document.addEventListener('mousemove',e=>{
  let x=e.clientX, y=e.clientY;
  if(G&&!G.dead&&G.mode==='space'){
    const r=H*0.375, dx=x-CX, dy=y-CY, d=Math.sqrt(dx*dx+dy*dy);
    if(d>r){ x=CX+dx*r/d; y=CY+dy*r/d; }
  }
  mX=x; mY=y;
});
document.addEventListener('mousedown',()=>{mDown=true; sndInit();});
document.addEventListener('mouseup',()=>{mDown=false;});
document.addEventListener('contextmenu',e=>e.preventDefault());

// ═══════════════════════════════════════════════════════════
//  UPDATE — NEWTONIAN FLIGHT MODEL
// ═══════════════════════════════════════════════════════════
function update(dt){
  if(!running||G.dead||G.mode!=='space'){ sndEngineUpdate(false,false); sndAtmoDangerUpdate(false); return; }
  const p=G.p;
  G.time+=dt;

  // ── MOUSE → SHIP NOSE ──
  // Radial normalization against the ring radius so the visual ring maps
  // directly to input: perimeter = max rate, arc ticks (50%) = half rate, center = zero.
  const ringR = H * 0.375;
  const rdx = mX === null ? 0 : mX - CX;
  const rdy = mY === null ? 0 : mY - CY;
  const dist = Math.sqrt(rdx*rdx + rdy*rdy);
  const norm = dist < 0.5 ? 0 : Math.min(1, dist / ringR);
  const mx = dist > 0.5 ? (rdx / dist) * norm : 0;
  const my = dist > 0.5 ? (rdy / dist) * norm : 0;

  // Linear rate — 50% distance = 50% turn rate, matching the arc tick markers.
  // Yaw rate = HALF of pitch rate for proper space-sim feel.
  const yawRate  = mx * p.turnRate * 0.5;
  const pitchMul = invertPitch ? 1 : -1;
  const pitchRate = pitchMul * my * p.turnRate;

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

  // ── COLLISION SPIN ──
  if(p._spinYaw && Math.abs(p._spinYaw)>0.001){
    p.ori=qNorm(qMul(qFromAxisAngle(qUp(p.ori),p._spinYaw*dt),p.ori));
    p._spinYaw*=Math.pow(0.96,dt*60);
  }
  if(p._spinPitch && Math.abs(p._spinPitch)>0.001){
    p.ori=qNorm(qMul(qFromAxisAngle(qRight(p.ori),p._spinPitch*dt),p.ori));
    p._spinPitch*=Math.pow(0.96,dt*60);
  }

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

  // ── SOUND HOLD TIMERS ──
  // Each input accumulates hold time; volume derived from that, with onset delays and ramps.
  if(!p._wHoldT)     p._wHoldT     = 0;  // W thrust
  if(!p._sHoldT)     p._sHoldT     = 0;  // S brake
  if(!p._adHoldT)    p._adHoldT    = 0;  // A/D roll
  if(!p._mRotHoldT)  p._mRotHoldT  = 0;  // mouse rotation

  const isThrusting = keys['w'] && p.fuel > 0;
  const isBraking   = keys['s'] && v3len(p.vel) > 1;
  const isAD        = !!(keys['a'] || keys['d']);
  const mouseNorm   = Math.min(1, dist / ringR);           // 0..1 across ring
  const mouseOverHalf = mouseNorm > 0.5;

  if(isThrusting)    p._wHoldT    += dt; else p._wHoldT    = 0;
  if(isBraking)      p._sHoldT    += dt; else p._sHoldT    = 0;
  if(isAD)           p._adHoldT   += dt; else p._adHoldT   = 0;
  if(mouseOverHalf)  p._mRotHoldT += dt; else p._mRotHoldT = 0;

  // Engine: no delay, ramps to full over 2 s
  const engVol  = isThrusting ? Math.min(1, p._wHoldT / 2.0) : 0;
  sndEngineUpdate(isThrusting, boost, engVol);

  // Brake: 0.5 s delay, 1.5 s ramp
  const brkVol  = isBraking ? Math.min(1, Math.max(0, (p._sHoldT - 0.5) / 1.5)) : 0;
  sndBrakeUpdate(brkVol, isBraking);

  // RCS: A/D needs 1 s hold then 3 s ramp; mouse needs >50% and 3 s ramp,
  //       scaled by how far past 50% the mouse is.
  const rcsADVol    = isAD          ? Math.min(1, Math.max(0, (p._adHoldT   - 1.0) / 3.0)) : 0;
  const rcsMouseVol = mouseOverHalf ? Math.min(1, p._mRotHoldT / 3.0) * Math.min(1, (mouseNorm - 0.5) * 2) : 0;
  const rcsVol      = Math.max(rcsADVol, rcsMouseVol);
  sndRCSUpdate(rcsVol, isAD || mouseOverHalf);

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

  // Ballistic spread heat — builds while firing, decays when trigger released
  if(!p._spreadHeat) p._spreadHeat = 0;
  if(!mDown) p._spreadHeat = Math.max(0, p._spreadHeat - 2.5 * dt);

  if(mDown){
    const activeHPs = p.hardpoints.filter(hp => hp.weapon && hp.weapon.type === p.activeGroup);
    activeHPs.forEach(hp => {
      if(hp.fireCd > 0) return;
      const w = hp.weapon;
      hp.fireCd = w.cd;

      if(w.type === 'ballistic'){
        // Spread cone — max 15° (Math.PI/12), builds over ~10 shots, decays quickly on release
        p._spreadHeat = Math.min(1, p._spreadHeat + 0.09);
        const spreadAngle = p._spreadHeat * (Math.PI / 120); // max ~1.5°
        const spreadMag = Math.tan(spreadAngle);
        const right = qRight(p.ori), up = qUp(p.ori);
        const az = Math.random() * PI2;
        const spreadFwd = v3norm(v3add(fwd,
          v3add(v3scale(right, Math.cos(az) * spreadMag),
                v3scale(up,    Math.sin(az) * spreadMag))));
        const life = w.range / w.velocity;
        G.bullets.push({
          pos: v3add(p.pos, v3scale(fwd, 12)),
          vel: v3add(v3scale(spreadFwd, w.velocity), v3scale(p.vel, .5)),
          life, maxLife: life,
          dmgA: w.dmgA, dmgS: w.dmgS, impact: w.impact||0,
          col: w.col, sz: 2,
        });
        sndAutocannon();
      } else if(w.type === 'hypervelocity'){
        const life = w.range / w.velocity;
        G.bullets.push({
          pos: v3add(p.pos, v3scale(fwd, 12)),
          vel: v3add(v3scale(fwd, w.velocity), v3scale(p.vel, .3)),
          life, maxLife: life,
          dmgA: w.dmgA, dmgS: w.dmgS, impact: w.impact||0,
          col: w.col, sz: 3, isHV: true,
        });
        sndHypervelocity();
      } else if(w.type === 'laser'){
        // Laser: set beam active on this hardpoint for beamDur
        hp.laserBeam = { timer: w.beamDur, totalDmgA: w.dmgA, totalDmgS: w.dmgS, range: w.range, col: w.col };
        hp.fireCd = w.beamDur + w.cd; // can't fire again until beam finishes + cooldown
        sndLaser();
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
        else if(e.aiRole==='pirate'){
          const isLocked = G.targetShip===e && G.locked;
          const hasBounty = (FACTIONS[e.factionId]?.playerRep||0) < -30;
          const aggroChance = isLocked ? (hasBounty ? 0.80 : 0.40) : 0.15;
          if(Math.random() < aggroChance){ e.hostile=true; e.aiSt='chase'; }
        } else if(e.aiRole==='merc') { e.hostile=true; e.aiSt='chase'; }
        else if(e.aiRole==='cargo') { e.aiSt='flee'; e._attacker={...p.pos}; broadcastDistress(e, AI_CFG.cargo.distressRange); }
      }
    });
  });

  // ── STATION PROXIMITY via LANDING ZONES ──
  G.nearSt=null;
  G.stations.forEach(st=>{
    if(st.landingZones){
      for(const lz of st.landingZones){
        if(v3len(v3sub(lz.pos,p.pos))<80){ G.nearSt=st; break; }
      }
    } else {
      if(v3len(v3sub(st.pos,p.pos))<st.dockR) G.nearSt=st;
    }
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

  // ── PLANET ATMOSPHERE & COLLISION ──
  G._atmoDanger=false;
  G.planets?.forEach(pl=>{
    const d=v3len(v3sub(pl.pos,p.pos));
    const atmoR=pl.r*1.08;
    if(d<atmoR*2.5) G._atmoDanger=true;
    if(d<atmoR){
      const normal=v3norm(v3sub(p.pos,pl.pos));
      const vDotN=v3dot(p.vel,normal);
      if(vDotN<0){
        const retention=0.25+Math.random()*0.25;
        p.vel=v3add(p.vel,v3scale(normal,-vDotN*(1+retention)));
        const spd=Math.abs(vDotN);
        const dmg=Math.min(100,spd*0.3);
        p.armour=Math.max(0,p.armour-dmg*0.6);
        p.struct-=dmg*0.4;
        if(!p._spinYaw) p._spinYaw=0; if(!p._spinPitch) p._spinPitch=0;
        p._spinYaw+=(Math.random()-.5)*2.5;
        p._spinPitch+=(Math.random()-.5)*2.5;
        sndCollisionPlanet(spd);
        flash('HULL BREACH — COLLISION DAMAGE');
      }
    }
  });

  sndAtmoDangerUpdate(G._atmoDanger);

  // ── STATION COLLISION ──
  G.stations.forEach(st=>{
    const d=v3len(v3sub(st.pos,p.pos));
    if(d<80){
      const normal=v3norm(v3sub(p.pos,st.pos));
      const vDotN=v3dot(p.vel,normal);
      if(vDotN<0){
        const retention=0.25+Math.random()*0.25;
        p.vel=v3add(p.vel,v3scale(normal,-vDotN*(1+retention)));
        const spd=Math.abs(vDotN);
        const dmg=Math.min(100,spd*0.5);
        p.armour=Math.max(0,p.armour-dmg*0.6);
        p.struct-=dmg*0.4;
        if(!p._spinYaw) p._spinYaw=0; if(!p._spinPitch) p._spinPitch=0;
        p._spinYaw+=(Math.random()-.5)*3;
        p._spinPitch+=(Math.random()-.5)*3;
        sndCollisionStation(spd);
        flash('HULL BREACH — COLLISION DAMAGE');
      }
    }
  });

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
  econTick(dt);
  fastTickT+=dt;
  if(fastTickT>=45){ fastTickT=0; fastTick(); }
  slowTickT+=dt;
  if(slowTickT>=300){ slowTickT=0; slowTick(); }

  // Rotate world objects
  G.stations.forEach(st=>{
    st.rAngle+=.15*dt;
    st.landingZones?.forEach(lz=>{lz.rAngle+=.12*dt;});
  });
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
    else if(roll<.62){ const _ab=G.pBases.filter(pb=>FACTIONS[pb.factionId]?.flags.active); if(_ab.length) spawnNPC('pirate',null,null,null,_ab[Math.floor(Math.random()*_ab.length)]); }
    else if(roll<.72){ const _ab=G.pBases.filter(pb=>FACTIONS[pb.factionId]?.flags.active); if(_ab.length) spawnNPC('recovery',null,null,null,_ab[Math.floor(Math.random()*_ab.length)]); }
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
      if(!FACTIONS[pb.factionId]?.flags.active) return;
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

  // Low-struct alarm — beep every 3 s when below 25%
  if(!G._alarmT) G._alarmT=0;
  G._alarmT-=dt;
  if(p.struct>0 && p.struct<p.maxStruct*0.25 && G._alarmT<=0){
    sndAlarm();
    G._alarmT=3;
  }

  // Death
  if(p.struct<=0&&!G.dead){
    G.dead=true;running=false;
    sndEngineStop();
    document.getElementById('mouse-ring').style.display='none';
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
