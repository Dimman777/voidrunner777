// ═══════════════════════════════════════════════════════════
//  §3 OUTLAW CONSTANTS
// ═══════════════════════════════════════════════════════════
const OUTLAW_THRESHOLD=3, OUTLAW_TIME=60, OUTLAW_SAFE_DIST=1400;

// ═══════════════════════════════════════════════════════════
//  §4 STAR SYSTEMS
// ═══════════════════════════════════════════════════════════
const JUMP_FUEL = 40;
const SM_LINKS = [['sol','proxima'],['sol','sirius'],['sol','vega'],['proxima','vega'],['sirius','vega']];
const SM_POS = { sol:{x:.33,y:.55}, proxima:{x:.62,y:.7}, sirius:{x:.68,y:.28}, vega:{x:.18,y:.25} };

const SYS={
  sol:{
    name:'SOL SYSTEM', starCol:'#ffee88',
    systemPolice:'f01',
    stations:[
      {id:'s1',name:'TERRA INDUSTRIAL',pos:v3(3300,0,-1920),col:'#00ffcc',
        factionId:'f04',type:'Industrial Hub',produces:['machinery'],consumes:['metal','ore']},
      {id:'s2',name:'MARS MINING CO.',pos:v3(-4500,600,2980),col:'#ff8844',
        factionId:'f06',type:'Mining Colony',produces:['ore'],consumes:['food','machinery']},
      {id:'s3',name:'LUNA AGRI-DOME',pos:v3(1350,-150,-6300),col:'#aaffaa',
        factionId:'f05',type:'Agricultural',produces:['food'],consumes:['tech','machinery']},
      {id:'s4',name:'CERES REFINERY',pos:v3(-2700,150,6300),col:'#ffdd88',
        factionId:'f06',type:'Refinery',produces:['metal'],consumes:['ore','food']},
    ],
    pBases:[
      {id:'pb1',name:'SCAVENGER NEST',pos:v3(8550,450,3600),col:'#ff4400',factionId:'f07'},
      {id:'pb2',name:'WRECK YARD ALPHA',pos:v3(-8100,-300,-5850),col:'#ff4400',factionId:'f07'},
      {id:'pb3',name:'DEAD RING',pos:v3(1350,225,9900),col:'#ff4400',factionId:'f07'},
    ],
    launchZone:{id:'lz-sol',name:'SOL TRANSIT HUB',pos:v3(-900,-150,-9450),col:'#50c8ff'},
    planets:[
      {pos:v3(2400,0,-1200),r:340,col:'#4488cc',name:'Terra'},
      {pos:v3(-3600,0,2200),r:270,col:'#cc6633',name:'Mars'},
      {pos:v3(4200,500,2100),r:560,col:'#ddbb66',name:'Jupiter'},
    ],
  },
  proxima:{
    name:'PROXIMA CENTAURI', starCol:'#ff6644',
    systemPolice:'f02',
    stations:[
      {id:'s5',name:'NOVA OUTPOST',pos:v3(2460,0,2220),col:'#ff6644',
        factionId:'f10',type:'Military Base',produces:['weapons'],consumes:['tech','food']},
      {id:'s6',name:'INFERNO FORGE',pos:v3(-1350,-300,-750),col:'#ff9933',
        factionId:'f06',type:'Refinery',produces:['metal'],consumes:['ore','food']},
      {id:'s7',name:'PROXIMA LABS',pos:v3(1350,225,-4950),col:'#cc88ff',
        factionId:'f04',type:'Tech Laboratory',produces:['tech'],consumes:['metal','food']},
    ],
    pBases:[
      {id:'pb4',name:'EMBER REEF',pos:v3(-7650,300,6750),col:'#ff4400',factionId:'f07'},
      {id:'pb5',name:'ASH STATION',pos:v3(7200,-225,-7200),col:'#ff4400',factionId:'f07'},
      {id:'pb6',name:'CINDER DOCK',pos:v3(-9000,150,-4050),col:'#ff4400',factionId:'f07'},
    ],
    launchZone:{id:'lz-proxima',name:'PROXIMA RELAY GATE',pos:v3(8550,0,1800),col:'#50c8ff'},
    planets:[
      {pos:v3(1920,0,1680),r:220,col:'#883322',name:'Proxima b'},
      {pos:v3(-2700,0,-2100),r:420,col:'#661111',name:'Inferno'},
      {pos:v3(900,0,-1500),r:180,col:'#aa4422',name:'Cinder'},
    ],
  },
  sirius:{
    name:'SIRIUS', starCol:'#aaccff',
    systemPolice:'f02',
    stations:[
      {id:'s8',name:'SIRIUS HUB',pos:v3(-1500,0,-3420),col:'#aaccff',
        factionId:'f05',type:'Trade Hub',produces:[],consumes:[]},
      {id:'s9',name:'GLACIER MEDICAL',pos:v3(2925,150,-1800),col:'#88ffee',
        factionId:'f10',type:'Medical Station',produces:['medicine'],consumes:['food','tech']},
      {id:'s10',name:'SHARD MINING',pos:v3(-3300,-300,3300),col:'#cc99ff',
        factionId:'f06',type:'Mining Colony',produces:['ore'],consumes:['food','machinery']},
    ],
    pBases:[
      {id:'pb7',name:'WRECKERS HOLLOW',pos:v3(8100,300,6300),col:'#ff4400',factionId:'f08'},
      {id:'pb8',name:'SHARD STATION',pos:v3(-9450,-150,-2700),col:'#ff4400',factionId:'f08'},
      {id:'pb9',name:'GLACIER FRINGE',pos:v3(2700,225,-9000),col:'#ff4400',factionId:'f08'},
    ],
    launchZone:{id:'lz-sirius',name:'SIRIUS JUMP POINT',pos:v3(1125,0,9225),col:'#50c8ff'},
    planets:[
      {pos:v3(-960,0,-2700),r:300,col:'#8899cc',name:'Sirius II'},
      {pos:v3(2700,0,840),r:520,col:'#aabbee',name:'Glacier'},
      {pos:v3(-2400,0,1500),r:220,col:'#6677aa',name:'Shard'},
    ],
  },
  vega:{
    name:'VEGA EXPANSE', starCol:'#88ff88',
    systemPolice:'f02',
    stations:[
      {id:'s11',name:'FREEPORT VEGA',pos:v3(4080,0,-1200),col:'#88ff88',
        factionId:'f10',type:'Trade Hub',produces:[],consumes:[]},
      {id:'s12',name:'VERDANT COLONY',pos:v3(300,300,4500),col:'#55ff88',
        factionId:'f05',type:'Agricultural',produces:['food'],consumes:['tech','machinery']},
      {id:'s13',name:'CANOPY WORKSHOP',pos:v3(3000,0,2700),col:'#ffcc44',
        factionId:'f04',type:'Industrial Hub',produces:['machinery'],consumes:['metal','ore']},
    ],
    pBases:[
      {id:'pb10',name:'DEADFALL',pos:v3(-8100,-150,-5400),col:'#ff4400',factionId:'f08'},
      {id:'pb11',name:'CANOPY SHADOW',pos:v3(7650,300,8550),col:'#ff4400',factionId:'f08'},
      {id:'pb12',name:'VERDANT UNDERBELLY',pos:v3(-2250,150,10350),col:'#ff4400',factionId:'f08'},
    ],
    launchZone:{id:'lz-vega',name:'VEGA OUTER BEACON',pos:v3(-8100,0,-3150),col:'#50c8ff'},
    planets:[
      {pos:v3(3360,0,-840),r:380,col:'#446644',name:'Vega Prime'},
      {pos:v3(-1500,0,2700),r:250,col:'#228822',name:'Verdant'},
      {pos:v3(1200,0,1800),r:300,col:'#336633',name:'Canopy'},
    ],
  },
};
