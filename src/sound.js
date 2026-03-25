// ═══════════════════════════════════════════════════════════
//  PROCEDURAL SOUND SYSTEM  — Web Audio API, no files
// ═══════════════════════════════════════════════════════════
let _actx = null;

// Lazy AudioContext — created on first user gesture
function _ctx(){
  if(!_actx){
    try{ _actx = new (window.AudioContext||window.webkitAudioContext)(); } catch(e){}
  }
  return _actx;
}

// Distance gain: squared falloff 0→maxDist — drops off fast, nearly silent at 60%+ range
function _distGain(dist, maxDist){
  if(dist >= maxDist) return 0;
  const linear = 1 - dist/maxDist;
  return linear * linear;
}

// ── PLAYER WEAPONS ──────────────────────────────────────────

// Autocannon — short percussive crack
function sndAutocannon(){
  const ctx=_ctx(); if(!ctx) return;
  const dur=0.09;
  const buf=ctx.createBuffer(1, ctx.sampleRate*dur, ctx.sampleRate);
  const d=buf.getChannelData(0);
  for(let i=0;i<d.length;i++){
    const t=i/ctx.sampleRate;
    const env=Math.exp(-t*40);
    d[i]=(Math.random()*2-1)*env*0.75
         +Math.sin(2*Math.PI*160*t)*env*0.35
         +Math.sin(2*Math.PI*320*t)*Math.exp(-t*70)*0.2;
  }
  const src=ctx.createBufferSource(); src.buffer=buf;
  const g=ctx.createGain(); g.gain.value=0.38;
  src.connect(g); g.connect(ctx.destination); src.start();
}

// Laser — descending tone zap
function sndLaser(){
  const ctx=_ctx(); if(!ctx) return;
  const now=ctx.currentTime;
  const osc=ctx.createOscillator();
  const osc2=ctx.createOscillator();
  const g=ctx.createGain();
  osc.type='sine'; osc2.type='sine';
  osc.frequency.setValueAtTime(1800,now);
  osc.frequency.exponentialRampToValueAtTime(350,now+0.20);
  osc2.frequency.setValueAtTime(1800*1.5,now);
  osc2.frequency.exponentialRampToValueAtTime(350*1.5,now+0.20);
  g.gain.setValueAtTime(0.28,now);
  g.gain.exponentialRampToValueAtTime(0.001,now+0.22);
  osc.connect(g); osc2.connect(g); g.connect(ctx.destination);
  osc.start(now); osc.stop(now+0.23);
  osc2.start(now); osc2.stop(now+0.23);
}

// Hypervelocity — deep resonant thud
function sndHypervelocity(){
  const ctx=_ctx(); if(!ctx) return;
  const dur=0.35;
  const buf=ctx.createBuffer(1, ctx.sampleRate*dur, ctx.sampleRate);
  const d=buf.getChannelData(0);
  for(let i=0;i<d.length;i++){
    const t=i/ctx.sampleRate;
    const envLow=Math.exp(-t*10);
    const envNoise=Math.exp(-t*28);
    d[i]=(Math.random()*2-1)*envNoise*0.35
         +Math.sin(2*Math.PI*55*t)*envLow*0.9
         +Math.sin(2*Math.PI*110*t)*Math.exp(-t*18)*0.45
         +Math.sin(2*Math.PI*220*t)*Math.exp(-t*35)*0.15;
  }
  const src=ctx.createBufferSource(); src.buffer=buf;
  const g=ctx.createGain(); g.gain.value=0.55;
  src.connect(g); g.connect(ctx.destination); src.start();
}

// ── PLAYER DAMAGE ───────────────────────────────────────────

// Armour hit — metallic clang
function sndArmourHit(){
  const ctx=_ctx(); if(!ctx) return;
  const now=ctx.currentTime;
  const osc=ctx.createOscillator();
  const g=ctx.createGain();
  osc.type='sawtooth';
  osc.frequency.setValueAtTime(700,now);
  osc.frequency.exponentialRampToValueAtTime(180,now+0.28);
  g.gain.setValueAtTime(0.33,now);
  g.gain.exponentialRampToValueAtTime(0.001,now+0.30);
  osc.connect(g); g.connect(ctx.destination);
  osc.start(now); osc.stop(now+0.32);
}

// Struct hit — heavy thud with rumble
function sndStructHit(){
  const ctx=_ctx(); if(!ctx) return;
  const dur=0.55;
  const buf=ctx.createBuffer(1, ctx.sampleRate*dur, ctx.sampleRate);
  const d=buf.getChannelData(0);
  for(let i=0;i<d.length;i++){
    const t=i/ctx.sampleRate;
    const envImpact=Math.exp(-t*8);
    const envRumble=Math.exp(-t*20);
    d[i]=(Math.random()*2-1)*envImpact*0.55
         +Math.sin(2*Math.PI*48*t)*envImpact*0.85
         +Math.sin(2*Math.PI*95*t)*envRumble*0.4;
  }
  const src=ctx.createBufferSource(); src.buffer=buf;
  const g=ctx.createGain(); g.gain.value=0.65;
  src.connect(g); g.connect(ctx.destination); src.start();
}

// ── RCS THRUSTERS (rotation inputs) ─────────────────────────

let _rcsNode=null, _rcsGain=null, _rcsRunning=false;

function _rcsStart(){
  const ctx=_ctx(); if(!ctx) return;
  if(_rcsRunning) return;
  const osc=ctx.createOscillator();
  const noise=ctx.createOscillator();
  const filter=ctx.createBiquadFilter();
  const g=ctx.createGain();
  osc.type='sine';      osc.frequency.value=310;
  noise.type='sawtooth'; noise.frequency.value=618;
  noise.detune.value=18;
  filter.type='bandpass'; filter.frequency.value=380; filter.Q.value=1.8;
  g.gain.setValueAtTime(0, ctx.currentTime); // caller drives gain via sndRCSUpdate
  osc.connect(filter); noise.connect(filter);
  filter.connect(g); g.connect(ctx.destination);
  osc.start(); noise.start();
  _rcsNode={osc,noise,filter}; _rcsGain=g; _rcsRunning=true;
}

function _rcsStop(){
  if(!_rcsNode||!_actx) return;
  const ctx=_actx, now=ctx.currentTime;
  _rcsGain.gain.setValueAtTime(_rcsGain.gain.value,now);
  _rcsGain.gain.linearRampToValueAtTime(0.0001,now+0.08);
  const n=_rcsNode, gg=_rcsGain;
  setTimeout(()=>{ try{n.osc.stop();n.noise.stop();}catch(e){} try{gg.disconnect();}catch(e){} },150);
  _rcsNode=null; _rcsGain=null; _rcsRunning=false;
}

// vol: 0..1 target volume; hasInput: whether rotation input is active at all
function sndRCSUpdate(vol, hasInput){
  if(!hasInput){ if(_rcsRunning) _rcsStop(); return; }
  if(!_rcsRunning) _rcsStart();
  if(_rcsGain && _actx)
    _rcsGain.gain.setTargetAtTime(vol * 0.055, _actx.currentTime, 0.12);
}

// ── BRAKE THRUSTERS (S key) ──────────────────────────────────

let _brkNode=null, _brkGain=null, _brkRunning=false;

function _brkStart(){
  const ctx=_ctx(); if(!ctx) return;
  if(_brkRunning) return;
  const osc=ctx.createOscillator();
  const filter=ctx.createBiquadFilter();
  const g=ctx.createGain();
  osc.type='sawtooth'; osc.frequency.value=195;
  filter.type='bandpass'; filter.frequency.value=240; filter.Q.value=2.2;
  g.gain.setValueAtTime(0, ctx.currentTime);
  osc.connect(filter); filter.connect(g); g.connect(ctx.destination);
  osc.start();
  _brkNode={osc,filter}; _brkGain=g; _brkRunning=true;
}

function _brkStop(){
  if(!_brkNode||!_actx) return;
  const ctx=_actx, now=ctx.currentTime;
  _brkGain.gain.setValueAtTime(_brkGain.gain.value,now);
  _brkGain.gain.linearRampToValueAtTime(0.0001,now+0.10);
  const n=_brkNode, gg=_brkGain;
  setTimeout(()=>{ try{n.osc.stop();}catch(e){} try{gg.disconnect();}catch(e){} },200);
  _brkNode=null; _brkGain=null; _brkRunning=false;
}

function sndBrakeUpdate(vol, hasInput){
  if(!hasInput){ if(_brkRunning) _brkStop(); return; }
  if(!_brkRunning) _brkStart();
  if(_brkGain && _actx)
    _brkGain.gain.setTargetAtTime(vol * 0.045, _actx.currentTime, 0.10);
}

// ── ENGINE ───────────────────────────────────────────────────

let _engNode=null, _engGain=null, _engBoost=false, _engRunning=false;

function sndEngineStart(boost){
  const ctx=_ctx(); if(!ctx) return;
  if(_engRunning) return;

  const osc1=ctx.createOscillator();
  const osc2=ctx.createOscillator();
  const filter=ctx.createBiquadFilter();
  const g=ctx.createGain();

  osc1.type='sawtooth'; osc2.type='sine';
  osc1.frequency.value = boost ? 82 : 57;
  osc2.frequency.value = boost ? 164 : 114;
  filter.type='lowpass';
  filter.frequency.value = boost ? 700 : 320;
  filter.Q.value = 1.2;

  g.gain.setValueAtTime(0, ctx.currentTime); // caller drives gain via sndEngineUpdate

  osc1.connect(filter); osc2.connect(filter);
  filter.connect(g); g.connect(ctx.destination);
  osc1.start(); osc2.start();

  _engNode={osc1,osc2,filter};
  _engGain=g;
  _engRunning=true;
  _engBoost=boost;
}

function sndEngineStop(){
  _rcsStop();
  _brkStop();
  if(!_engNode||!_actx) return;
  const ctx=_actx;
  const now=ctx.currentTime;
  _engGain.gain.setValueAtTime(_engGain.gain.value,now);
  _engGain.gain.linearRampToValueAtTime(0.0001,now+0.22);
  const n=_engNode, gg=_engGain;
  setTimeout(()=>{ try{n.osc1.stop();n.osc2.stop();}catch(e){} try{gg.disconnect();}catch(e){} },350);
  _engNode=null; _engGain=null; _engRunning=false;
}

// volScale: 0..1 — caller ramps this up over time; boost transition handled internally
function sndEngineUpdate(isThrusting, isBoost, volScale){
  const vs = (volScale !== undefined) ? Math.max(0, volScale) : 1.0;
  if(!isThrusting){ if(_engRunning) sndEngineStop(); return; }
  if(!_engRunning) sndEngineStart(isBoost);
  if(_engGain && _actx){
    const maxG = isBoost ? 0.20 : 0.11;
    _engGain.gain.setTargetAtTime(vs * maxG, _actx.currentTime, 0.10);
  }
  if(isBoost!==_engBoost && _engNode && _actx){
    const ctx=_actx, now=ctx.currentTime;
    _engNode.osc1.frequency.setValueAtTime(isBoost?82:57, now);
    _engNode.osc2.frequency.setValueAtTime(isBoost?164:114, now);
    _engNode.filter.frequency.setValueAtTime(isBoost?700:320, now);
    _engBoost=isBoost;
  }
}

// ── NPC SOUNDS  (distance-attenuated) ───────────────────────

// NPC armour hit — heard within weapon range
function sndNPCArmourHit(dist, maxDist){
  const ctx=_ctx(); if(!ctx) return;
  const vol=_distGain(dist,maxDist); if(vol<0.04) return;
  const now=ctx.currentTime;
  const osc=ctx.createOscillator();
  const g=ctx.createGain();
  osc.type='square';
  osc.frequency.setValueAtTime(550,now);
  osc.frequency.exponentialRampToValueAtTime(160,now+0.10);
  g.gain.setValueAtTime(vol*0.18,now);
  g.gain.exponentialRampToValueAtTime(0.001,now+0.12);
  osc.connect(g); g.connect(ctx.destination);
  osc.start(now); osc.stop(now+0.13);
}

// NPC struct hit — heavier, heard within weapon range
function sndNPCStructHit(dist, maxDist){
  const ctx=_ctx(); if(!ctx) return;
  const vol=_distGain(dist,maxDist); if(vol<0.04) return;
  const dur=0.22;
  const buf=ctx.createBuffer(1,ctx.sampleRate*dur,ctx.sampleRate);
  const d=buf.getChannelData(0);
  for(let i=0;i<d.length;i++){
    const t=i/ctx.sampleRate;
    const env=Math.exp(-t*22);
    d[i]=(Math.random()*2-1)*env*0.45
         +Math.sin(2*Math.PI*95*t)*env*0.75;
  }
  const src=ctx.createBufferSource(); src.buffer=buf;
  const g=ctx.createGain(); g.gain.value=vol*0.38;
  src.connect(g); g.connect(ctx.destination); src.start();
}

// ── EXPLOSIONS ───────────────────────────────────────────────

// Explosion — deep boom + noise, heard at up to ~2× weapon range
function sndExplosion(dist, maxDist){
  const ctx=_ctx(); if(!ctx) return;
  const vol=_distGain(dist,maxDist); if(vol<0.02) return;
  const dur=0.85;
  const buf=ctx.createBuffer(1,ctx.sampleRate*dur,ctx.sampleRate);
  const d=buf.getChannelData(0);
  for(let i=0;i<d.length;i++){
    const t=i/ctx.sampleRate;
    const envBoom=Math.exp(-t*5);
    const envCrack=Math.exp(-t*18);
    d[i]=(Math.random()*2-1)*envBoom*0.55
         +Math.sin(2*Math.PI*42*t)*envBoom*1.0
         +Math.sin(2*Math.PI*84*t)*envCrack*0.45
         +Math.sin(2*Math.PI*168*t)*Math.exp(-t*30)*0.2;
  }
  const src=ctx.createBufferSource(); src.buffer=buf;
  const g=ctx.createGain(); g.gain.value=vol*0.72;
  src.connect(g); g.connect(ctx.destination); src.start();
}

// ── HUD ALARM ────────────────────────────────────────────────

// Two-beep warning tone
function sndAlarm(){
  const ctx=_ctx(); if(!ctx) return;
  const now=ctx.currentTime;
  for(let i=0;i<2;i++){
    const osc=ctx.createOscillator();
    const g=ctx.createGain();
    osc.type='square';
    osc.frequency.value=960;
    const t0=now+i*0.19;
    g.gain.setValueAtTime(0,t0);
    g.gain.linearRampToValueAtTime(0.14,t0+0.01);
    g.gain.setValueAtTime(0.14,t0+0.12);
    g.gain.linearRampToValueAtTime(0,t0+0.15);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(t0); osc.stop(t0+0.16);
  }
}

// ── ATMOSPHERE DANGER ALARM ──────────────────────────────────

// Continuous klaxon siren: pitch-swept sawtooth + low pulse gain LFO
let _atmoAlarmRunning=false, _atmoAlarmNodes=null, _atmoAlarmGain=null;

function _atmoAlarmStart(){
  const ctx=_ctx(); if(!ctx||_atmoAlarmRunning) return;
  const now=ctx.currentTime;

  // Siren oscillator — sawtooth swept between 520 Hz and 940 Hz
  const osc=ctx.createOscillator();
  osc.type='sawtooth';
  osc.frequency.value=730;

  // LFO for pitch sweep (2.2 Hz siren sweep)
  const pitchLFO=ctx.createOscillator();
  const pitchDepth=ctx.createGain();
  pitchLFO.type='sine';
  pitchLFO.frequency.value=2.2;
  pitchDepth.gain.value=210;          // ±210 Hz sweep
  pitchLFO.connect(pitchDepth);
  pitchDepth.connect(osc.frequency);

  // Pulse LFO for klaxon chop (4 Hz on/off pulse)
  const ampLFO=ctx.createOscillator();
  const ampDepth=ctx.createGain();
  ampLFO.type='square';
  ampLFO.frequency.value=4;
  ampDepth.gain.value=0.5;            // modulate ±0.5 around 0.5 → 0..1 range

  // DC offset to centre the amp LFO above zero
  const dc=ctx.createConstantSource();
  dc.offset.value=0.5;

  const chop=ctx.createGain();
  chop.gain.value=0;                  // driven by dc + ampDepth
  dc.connect(chop.gain);
  ampDepth.connect(chop.gain);
  ampLFO.connect(ampDepth);

  // Bandpass — keeps it harsh but not scratchy
  const flt=ctx.createBiquadFilter();
  flt.type='bandpass'; flt.frequency.value=800; flt.Q.value=1.2;

  const g=ctx.createGain();
  g.gain.setValueAtTime(0,now);
  g.gain.linearRampToValueAtTime(0.14,now+0.12);

  osc.connect(flt); flt.connect(chop); chop.connect(g); g.connect(ctx.destination);

  osc.start(now); pitchLFO.start(now); ampLFO.start(now); dc.start(now);
  _atmoAlarmNodes={osc,pitchLFO,pitchDepth,ampLFO,ampDepth,dc,flt,chop};
  _atmoAlarmGain=g;
  _atmoAlarmRunning=true;
}

function _atmoAlarmStop(){
  if(!_atmoAlarmRunning||!_actx) return;
  const ctx=_actx, now=ctx.currentTime;
  _atmoAlarmGain.gain.setValueAtTime(_atmoAlarmGain.gain.value,now);
  _atmoAlarmGain.gain.linearRampToValueAtTime(0.0001,now+0.18);
  const nodes=_atmoAlarmNodes, gg=_atmoAlarmGain;
  setTimeout(()=>{
    try{nodes.osc.stop();nodes.pitchLFO.stop();nodes.ampLFO.stop();nodes.dc.stop();}catch(e){}
    try{gg.disconnect();}catch(e){}
  },300);
  _atmoAlarmNodes=null; _atmoAlarmGain=null; _atmoAlarmRunning=false;
}

// Call each frame with current danger state
function sndAtmoDangerUpdate(active){
  if(active && !_atmoAlarmRunning) _atmoAlarmStart();
  else if(!active && _atmoAlarmRunning) _atmoAlarmStop();
}

// ── COLLISION SOUNDS ─────────────────────────────────────────

// Simple time-based cooldown — prevents hammering when grinding along a surface
let _lastStationHit=-999, _lastPlanetHit=-999;

// Station collision — sharp metallic crunch + structural groan
// impactSpd: abs(vDotN) — scales volume and harshness
function sndCollisionStation(impactSpd){
  const ctx=_ctx(); if(!ctx) return;
  const now=ctx.currentTime;
  if(now-_lastStationHit < 0.20) return; // 200ms cooldown
  _lastStationHit=now;
  const vol=Math.min(1, impactSpd/100);
  if(vol<0.04) return;
  const dur=0.70;
  const buf=ctx.createBuffer(1, ctx.sampleRate*dur, ctx.sampleRate);
  const d=buf.getChannelData(0);
  for(let i=0;i<d.length;i++){
    const t=i/ctx.sampleRate;
    const envCrunch = Math.exp(-t*18);   // very sharp initial crunch
    const envRing   = Math.exp(-t*6);    // metallic ring / resonance
    const envGroan  = Math.exp(-t*3.5);  // low structural groan tail
    d[i] = (Math.random()*2-1)*envCrunch*1.0   // broadband impact noise
           + Math.sin(2*Math.PI*260*t)*envRing*0.55  // metallic fundamental
           + Math.sin(2*Math.PI*520*t)*Math.exp(-t*22)*0.30  // harmonic crack
           + Math.sin(2*Math.PI*130*t)*envRing*0.40  // lower resonance
           + (Math.random()*2-1)*envGroan*0.30   // scraping/grinding noise
           + Math.sin(2*Math.PI*58*t)*envGroan*0.65; // deep structural groan
  }
  const src=ctx.createBufferSource(); src.buffer=buf;
  // Bandpass gives it that hollow metal-on-metal character
  const flt=ctx.createBiquadFilter();
  flt.type='bandpass'; flt.frequency.value=380; flt.Q.value=0.7;
  const g=ctx.createGain(); g.gain.value=vol*0.80;
  src.connect(flt); flt.connect(g); g.connect(ctx.destination); src.start();
}

// Planet atmosphere collision — deep boom + atmospheric roar + crackle
function sndCollisionPlanet(impactSpd){
  const ctx=_ctx(); if(!ctx) return;
  const now=ctx.currentTime;
  if(now-_lastPlanetHit < 0.25) return; // 250ms cooldown
  _lastPlanetHit=now;
  const vol=Math.min(1, impactSpd/100);
  if(vol<0.04) return;
  const dur=1.10;
  const buf=ctx.createBuffer(1, ctx.sampleRate*dur, ctx.sampleRate);
  const d=buf.getChannelData(0);
  for(let i=0;i<d.length;i++){
    const t=i/ctx.sampleRate;
    const envBoom  = Math.exp(-t*4.5);  // deep atmospheric boom
    const envRoar  = Math.exp(-t*2.0);  // sustained atmospheric roar
    const envCrack = Math.exp(-t*22);   // entry crackle / plasma flash
    d[i] = Math.sin(2*Math.PI*30*t)*envBoom*1.1   // sub-bass boom
           + Math.sin(2*Math.PI*60*t)*Math.exp(-t*7)*0.55  // second harmonic
           + Math.sin(2*Math.PI*115*t)*Math.exp(-t*12)*0.30 // upper thud
           + (Math.random()*2-1)*envCrack*0.80  // plasma/crackle burst
           + (Math.random()*2-1)*envRoar*0.45   // atmospheric roar/turbulence
           + Math.sin(2*Math.PI*48*t + Math.sin(2*Math.PI*1.8*t)*8)*envRoar*0.35; // rumble wobble
  }
  const src=ctx.createBufferSource(); src.buffer=buf;
  // Low-shelf boost to emphasise the deep boom
  const flt=ctx.createBiquadFilter();
  flt.type='lowshelf'; flt.frequency.value=200; flt.gain.value=6;
  const g=ctx.createGain(); g.gain.value=vol*0.85;
  src.connect(flt); flt.connect(g); g.connect(ctx.destination); src.start();
}

// ── INIT ─────────────────────────────────────────────────────

// Call on first user interaction to unlock AudioContext
function sndInit(){
  const ctx=_ctx();
  if(ctx&&ctx.state==='suspended') ctx.resume();
}
