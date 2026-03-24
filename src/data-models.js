// ═══════════════════════════════════════════════════════════
//  WIREFRAME MODELS
// ═══════════════════════════════════════════════════════════
function mkShip(){
  return { verts:[[0,0,2],[-.9,-.25,-1.4],[.9,-.25,-1.4],[0,.35,-.9],
    [-.55,0,-.7],[.55,0,-.7],[0,-.18,-1.4],[-1.3,-.08,-1.7],[1.3,-.08,-1.7]],
    edges:[[0,4],[0,5],[4,1],[5,2],[1,6],[2,6],[4,5],[0,3],[3,1],[3,2],[3,6],[1,7],[7,4],[2,8],[8,5]] };
}
function mkPirate(){
  return { verts:[[0,0,1.6],[-1.1,-.15,-1.1],[1.1,-.15,-1.1],[0,.45,-.7],
    [0,-.35,-1.3],[-.75,.08,-1.5],[.75,.08,-1.5]],
    edges:[[0,1],[0,2],[0,3],[1,2],[1,4],[2,4],[3,1],[3,2],[1,5],[2,6],[5,4],[6,4],[5,6],[3,5],[3,6]] };
}
function mkFreighter(){
  return { verts:[[0,0,2.2],[-1.1,.7,-1.8],[1.1,.7,-1.8],[-1.1,-.7,-1.8],[1.1,-.7,-1.8],
    [-.7,.45,.4],[.7,.45,.4],[-.7,-.45,.4],[.7,-.45,.4]],
    edges:[[0,5],[0,6],[0,7],[0,8],[5,6],[6,8],[8,7],[7,5],[1,2],[2,4],[4,3],[3,1],[5,1],[6,2],[7,3],[8,4],[1,3],[2,4]] };
}
function mkStation(){
  const v=[],e=[],n=8;
  for(let i=0;i<n;i++){
    const a=i/n*PI2;
    v.push([Math.cos(a)*6,Math.sin(a)*6,1.5]);
    v.push([Math.cos(a)*6,Math.sin(a)*6,-1.5]);
  }
  for(let i=0;i<n;i++){
    const j=(i+1)%n;
    e.push([i*2,j*2],[i*2+1,j*2+1],[i*2,i*2+1]);
  }
  const ci=v.length; v.push([0,0,3],[0,0,-3]);
  for(let i=0;i<n;i+=2) e.push([ci,i*2],[ci+1,i*2+1]);
  return {verts:v,edges:e};
}
function mkPBase(){
  const v=[],e=[],n=6;
  for(let i=0;i<n;i++){
    const a=i/n*PI2,r=3+Math.sin(i*2.5)*1.5;
    v.push([Math.cos(a)*r,Math.sin(a)*r,1]);
    v.push([Math.cos(a)*r,Math.sin(a)*r,-1]);
  }
  for(let i=0;i<n;i++){
    const j=(i+1)%n;
    e.push([i*2,j*2],[i*2+1,j*2+1],[i*2,i*2+1]);
  }
  const ci=v.length; v.push([0,0,3]); e.push([ci,0],[ci,4]);
  return {verts:v,edges:e};
}
function scaleM(m,s){
  return {verts:m.verts.map(v=>[v[0]*s,v[1]*s,v[2]*s]),edges:m.edges};
}

// Additional wireframe models for all 7 hull types
function mkCruiser(){
  return { verts:[
    [0,0,2.8],[-.8,.3,1],  [.8,.3,1],  // 0nose,1ltop,2rtop
    [-1.2,-.2,-1.5],[1.2,-.2,-1.5],     // 3lback,4rback
    [0,.5,-.5],[0,-.4,-1.8],             // 5dorsal,6ventral_back
    [-1.6,0,-2],[1.6,0,-2],              // 7lwing,8rwing
    [0,0,-2.2],                          // 9tail
  ], edges:[
    [0,1],[0,2],[1,3],[2,4],[3,4],[1,5],[2,5],[5,9],
    [3,6],[4,6],[6,9],[3,7],[7,9],[4,8],[8,9],
    [1,2],[0,5],[7,3],[8,4],
  ]};
}
function mkGunship(){
  return { verts:[
    [0,0,2],[-.5,.2,.5],[.5,.2,.5],       // 0nose,1-2body
    [-1.2,-.1,-.8],[1.2,-.1,-.8],          // 3-4 side pods
    [-.6,.4,-.6],[.6,.4,-.6],              // 5-6 dorsal
    [0,-.3,-1.2],                          // 7 vent
    [-1.5,0,-1.4],[1.5,0,-1.4],            // 8-9 pod tips
    [0,.2,-1.4],                           // 10 tail
  ], edges:[
    [0,1],[0,2],[1,3],[2,4],[3,7],[4,7],[1,5],[2,6],[5,6],
    [5,10],[6,10],[3,8],[4,9],[8,7],[9,7],[8,10],[9,10],
    [1,2],[3,4],[5,3],[6,4],
  ]};
}
function mkCourier(){
  return { verts:[
    [0,0,1.8],[-.7,-.2,-1],[.7,-.2,-1],   // 0nose,1-2back
    [0,.3,-.4],                             // 3dorsal
    [-1,-.05,-1.3],[1,-.05,-1.3],           // 4-5 wing nubs
    [0,-.15,-1.3],                          // 6 vent
  ], edges:[
    [0,1],[0,2],[0,3],[1,2],[3,1],[3,2],[1,4],[2,5],
    [4,6],[5,6],[1,6],[2,6],[4,1],[5,2],
  ]};
}
function mkShuttleNPC(){
  return { verts:[
    [0,0,1.5],[-.6,-.15,-.9],[.6,-.15,-.9], // 0nose,1-2back
    [0,.25,-.3],                              // 3top
    [0,-.1,-1.1],                             // 4tail
  ], edges:[
    [0,1],[0,2],[0,3],[1,2],[3,1],[3,2],[1,4],[2,4],
  ]};
}
function mkRecovery(){
  return { verts:[
    [.6,0,1.2],[-.6,0,1.2],               // 0-1 claw prongs
    [0,0,.6],                               // 2 claw center
    [-.8,.4,-.8],[.8,.4,-.8],              // 3-4 top back
    [-.8,-.4,-.8],[.8,-.4,-.8],            // 5-6 bot back
    [0,.3,-.2],[0,-.3,-.2],                // 7-8 mid
    [0,0,-1.2],                            // 9 tail
  ], edges:[
    [0,2],[1,2],[2,7],[2,8],[7,3],[7,4],[8,5],[8,6],
    [3,4],[5,6],[3,5],[4,6],[3,9],[4,9],[5,9],[6,9],
    [0,7],[1,7],[0,8],[1,8],
  ]};
}

const M_SHIP=mkShip(), M_PIRATE=mkPirate(), M_FREIGHT=mkFreighter(),
      M_STATION=mkStation(), M_PBASE=mkPBase(),
      M_CRUISER=mkCruiser(), M_GUNSHIP=mkGunship(),
      M_COURIER=mkCourier(), M_SHUTTLE=mkShuttleNPC(),
      M_RECOVERY=mkRecovery();

// §8 Capital ship wireframes
function mkFrigate(){
  return { verts:[
    [0,0,5],[-.8,.3,3],[.8,.3,3],[0,-.4,3],
    [-1.5,.5,0],[1.5,.5,0],[-1.5,-.5,0],[1.5,-.5,0],
    [-1.2,.3,-3],[1.2,.3,-3],[-1.2,-.3,-3],[1.2,-.3,-3],
    [0,.6,-3.5],[0,-.4,-4],[-1.8,0,-3.5],[1.8,0,-3.5],
  ], edges:[
    [0,1],[0,2],[0,3],[1,2],[2,3],[3,1],
    [1,4],[2,5],[3,6],[3,7],
    [4,5],[5,7],[7,6],[6,4],[4,8],[5,9],[6,10],[7,11],
    [8,9],[9,11],[11,10],[10,8],[8,12],[9,12],[10,13],[11,13],
    [8,14],[14,13],[9,15],[15,13],[12,13],
  ]};
}
function mkDreadnought(){
  return { verts:[
    [0,0,7],[-.6,.4,5],[.6,.4,5],[0,-.5,5],
    [-2.5,.3,1],[-2.8,0,-2],[-2,.2,-3],
    [2.5,.3,1],[2.8,0,-2],[2,.2,-3],
    [-1.3,.6,0],[1.3,.6,0],[-1.3,-.6,0],[1.3,-.6,0],
    [-1,.3,-4],[1,.3,-4],[0,.8,-3.5],[0,-.5,-4.5],
    [-2.2,0,-4.5],[2.2,0,-4.5],[0,0,-5],
  ], edges:[
    [0,1],[0,2],[0,3],[1,2],[2,3],[3,1],
    [1,10],[2,11],[3,12],[3,13],
    [1,4],[4,5],[5,6],[6,10],[4,10],
    [2,7],[7,8],[8,9],[9,11],[7,11],
    [10,11],[11,13],[13,12],[12,10],
    [10,14],[11,15],[14,15],[14,16],[15,16],
    [12,17],[14,18],[18,17],[15,19],[19,17],[16,20],[17,20],
    [5,18],[8,19],[6,14],[9,15],
  ]};
}

const M_FRIGATE=mkFrigate(), M_DREADNOUGHT=mkDreadnought();

// Unit cube wireframe — used in cargo MFD
function mkCargoBox(){
  return { verts:[
    [-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],  // back  0-3
    [-1,-1, 1],[1,-1, 1],[1,1, 1],[-1,1, 1],  // front 4-7
  ], edges:[
    [0,1],[1,2],[2,3],[3,0],  // back face
    [4,5],[5,6],[6,7],[7,4],  // front face
    [0,4],[1,5],[2,6],[3,7],  // sides
  ]};
}
const M_CARGO_BOX = mkCargoBox();

// §8 Capital ship definitions
const CAP_DEFS = {
  frigate: {
    name:'FRIGATE', reward:900, sz:45,
    model:M_FRIGATE, scale:12, maxSpd:80, baseSpd:40, turn:0.3,
    components:[
      {name:'NOSE',     hp:80,  isCore:false, turrets:1},
      {name:'MAIN HULL',hp:200, isCore:true,  turrets:2},
      {name:'REAR HULL',hp:100, isCore:false, turrets:1},
    ],
  },
  dreadnought: {
    name:'DREADNOUGHT', reward:3500, sz:65,
    model:M_DREADNOUGHT, scale:16, maxSpd:60, baseSpd:30, turn:0.2,
    components:[
      {name:'NOSE',      hp:120, isCore:false, turrets:2},
      {name:'PORT WING', hp:130, isCore:false, turrets:1},
      {name:'STBD WING', hp:130, isCore:false, turrets:1},
      {name:'MAIN HULL', hp:300, isCore:true,  turrets:2},
      {name:'REAR HULL', hp:150, isCore:false, turrets:2},
    ],
  },
};
