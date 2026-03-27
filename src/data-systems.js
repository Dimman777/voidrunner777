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
    // Sol layout by distance from star (origin):
    //   Terra ~5500u → Mars ~9200u → Pirate belt ~13-15k u → Jupiter ~22k u → Transit ~27k u
    stations:[
      // Terra Industrial orbits Terra at 800u (initial pos: Terra + X-axis)
      {id:'s1',name:'TERRA INDUSTRIAL',pos:v3(5200,200,-3300),col:'#00ffcc',
        factionId:'f04',type:'Industrial Hub',produces:['machinery'],consumes:['metal','ore'],
        orbitCenter:v3(4400,0,-3300),orbitRadius:800,orbitSpeed:0.015,orbitAngle:0,orbitY:200},
      // Mars Mining Co orbits Mars
      {id:'s2',name:'MARS MINING CO.',pos:v3(-7750,400,5150),col:'#ff8844',
        factionId:'f06',type:'Mining Colony',produces:['ore'],consumes:['food','machinery'],
        orbitCenter:v3(-8000,0,4500),orbitRadius:700,orbitSpeed:0.012,orbitAngle:1.2,orbitY:400},
      // Luna Agri-Dome orbits the Moon (dynamic parent — follows Luna's own orbit)
      {id:'s3',name:'LUNA AGRI-DOME',pos:v3(6340,0,-3160),col:'#aaffaa',
        factionId:'f05',type:'Agricultural',produces:['food'],consumes:['tech','machinery'],
        orbitParentName:'Luna',orbitRadius:200,orbitSpeed:0.018,orbitAngle:0.8,orbitY:0},
      // Ceres Refinery orbits Jupiter
      {id:'s4',name:'CERES REFINERY',pos:v3(15040,700,15720),col:'#ffdd88',
        factionId:'f06',type:'Refinery',produces:['metal'],consumes:['ore','food'],
        orbitCenter:v3(16000,700,15000),orbitRadius:1200,orbitSpeed:0.010,orbitAngle:2.5,orbitY:0},
    ],
    pBases:[
      {id:'pb1',name:'SCAVENGER NEST', pos:v3(11000,600,8000), col:'#ff4400',factionId:'f07'},
      {id:'pb2',name:'WRECK YARD ALPHA',pos:v3(-12000,-500,-7500),col:'#ff4400',factionId:'f07'},
      {id:'pb3',name:'DEAD RING',       pos:v3(3000,300,14000), col:'#ff4400',factionId:'f07'},
    ],
    launchZone:{id:'lz-sol',name:'SOL TRANSIT HUB',pos:v3(-6000,-250,26300),col:'#50c8ff'},
    planets:[
      {pos:v3(4400,0,-3300),r:340,col:'#4488cc',name:'Terra'},
      // Luna orbits Terra — pos updated each frame from orbitCenter + angle
      {pos:v3(6200,0,-3300),r:90,col:'#aaaaaa',name:'Luna',
        orbitCenter:v3(4400,0,-3300),orbitRadius:1800,orbitSpeed:0.02,orbitAngle:0},
      {pos:v3(-8000,0,4500),r:270,col:'#cc6633',name:'Mars'},
      {pos:v3(16000,700,15000),r:560,col:'#ddbb66',name:'Jupiter'},
    ],
  },
  proxima:{
    name:'PROXIMA CENTAURI', starCol:'#ff6644',
    systemPolice:'f02',
    stations:[
      {id:'s5',name:'NOVA OUTPOST',pos:v3(4420,0,4100),col:'#ff6644',
        factionId:'f10',type:'Military Base',produces:['weapons'],consumes:['tech','food'],
        orbitCenter:v3(4100,0,3600),orbitRadius:600,orbitSpeed:0.015,orbitAngle:1.0,orbitY:0},
      {id:'s6',name:'INFERNO FORGE',pos:v3(-6100,-400,-3710),col:'#ff9933',
        factionId:'f06',type:'Refinery',produces:['metal'],consumes:['ore','food'],
        orbitCenter:v3(-5700,0,-4400),orbitRadius:800,orbitSpeed:0.012,orbitAngle:2.1,orbitY:-400},
      {id:'s7',name:'PROXIMA LABS',pos:v3(1430,300,-3380),col:'#cc88ff',
        factionId:'f04',type:'Tech Laboratory',produces:['tech'],consumes:['metal','food'],
        orbitCenter:v3(1900,0,-3200),orbitRadius:500,orbitSpeed:0.018,orbitAngle:3.5,orbitY:300},
    ],
    pBases:[
      {id:'pb4',name:'EMBER REEF',  pos:v3(-16000,500,14000), col:'#ff4400',factionId:'f07'},
      {id:'pb5',name:'ASH STATION', pos:v3(15200,-400,-15200),col:'#ff4400',factionId:'f07'},
      {id:'pb6',name:'CINDER DOCK', pos:v3(-19000,200,-8500), col:'#ff4400',factionId:'f07'},
    ],
    launchZone:{id:'lz-proxima',name:'PROXIMA RELAY GATE',pos:v3(18000,0,3800),col:'#50c8ff'},
    planets:[
      {pos:v3(4100,0,3600), r:220,col:'#883322',name:'Proxima b'},
      {pos:v3(-5700,0,-4400),r:420,col:'#661111',name:'Inferno'},
      {pos:v3(1900,0,-3200),r:180,col:'#aa4422',name:'Cinder'},
    ],
  },
  sirius:{
    name:'SIRIUS', starCol:'#aaccff',
    systemPolice:'f02',
    stations:[
      {id:'s8',name:'SIRIUS HUB',pos:v3(-1390,0,-5370),col:'#aaccff',
        factionId:'f05',type:'Trade Hub',produces:[],consumes:[],
        orbitCenter:v3(-2000,0,-5700),orbitRadius:700,orbitSpeed:0.013,orbitAngle:0.5,orbitY:0},
      {id:'s9',name:'GLACIER MEDICAL',pos:v3(5500,200,2680),col:'#88ffee',
        factionId:'f10',type:'Medical Station',produces:['medicine'],consumes:['food','tech'],
        orbitCenter:v3(5700,0,1800),orbitRadius:900,orbitSpeed:0.011,orbitAngle:1.8,orbitY:200},
      {id:'s10',name:'SHARD MINING',pos:v3(-5370,-400,2720),col:'#cc99ff',
        factionId:'f06',type:'Mining Colony',produces:['ore'],consumes:['food','machinery'],
        orbitCenter:v3(-5100,0,3200),orbitRadius:550,orbitSpeed:0.016,orbitAngle:4.2,orbitY:-400},
    ],
    pBases:[
      {id:'pb7',name:'WRECKERS HOLLOW',pos:v3(17000,500,13200), col:'#ff4400',factionId:'f08'},
      {id:'pb8',name:'SHARD STATION',  pos:v3(-20000,-200,-5700),col:'#ff4400',factionId:'f08'},
      {id:'pb9',name:'GLACIER FRINGE', pos:v3(5700,300,-19000),  col:'#ff4400',factionId:'f08'},
    ],
    launchZone:{id:'lz-sirius',name:'SIRIUS JUMP POINT',pos:v3(2400,0,19500),col:'#50c8ff'},
    planets:[
      {pos:v3(-2000,0,-5700),r:300,col:'#8899cc',name:'Sirius II'},
      {pos:v3(5700,0,1800),  r:520,col:'#aabbee',name:'Glacier'},
      {pos:v3(-5100,0,3200), r:220,col:'#6677aa',name:'Shard'},
    ],
  },
  vega:{
    name:'VEGA EXPANSE', starCol:'#88ff88',
    systemPolice:'f02',
    stations:[
      {id:'s11',name:'FREEPORT VEGA',pos:v3(7670,0,-1320),col:'#88ff88',
        factionId:'f10',type:'Trade Hub',produces:[],consumes:[],
        orbitCenter:v3(7100,0,-1800),orbitRadius:750,orbitSpeed:0.014,orbitAngle:0.7,orbitY:0},
      {id:'s12',name:'VERDANT COLONY',pos:v3(-3770,400,5900),col:'#55ff88',
        factionId:'f05',type:'Agricultural',produces:['food'],consumes:['tech','machinery'],
        orbitCenter:v3(-3200,0,5700),orbitRadius:600,orbitSpeed:0.015,orbitAngle:2.8,orbitY:400},
      {id:'s13',name:'CANOPY WORKSHOP',pos:v3(2690,0,3180),col:'#ffcc44',
        factionId:'f04',type:'Industrial Hub',produces:['machinery'],consumes:['metal','ore'],
        orbitCenter:v3(2500,0,3800),orbitRadius:650,orbitSpeed:0.016,orbitAngle:5.0,orbitY:0},
    ],
    pBases:[
      {id:'pb10',name:'DEADFALL',           pos:v3(-17000,-300,-11400),col:'#ff4400',factionId:'f08'},
      {id:'pb11',name:'CANOPY SHADOW',      pos:v3(16000,500,18000),   col:'#ff4400',factionId:'f08'},
      {id:'pb12',name:'VERDANT UNDERBELLY', pos:v3(-4700,200,21800),   col:'#ff4400',factionId:'f08'},
    ],
    launchZone:{id:'lz-vega',name:'VEGA OUTER BEACON',pos:v3(-17000,0,-6600),col:'#50c8ff'},
    planets:[
      {pos:v3(7100,0,-1800),r:380,col:'#446644',name:'Vega Prime'},
      {pos:v3(-3200,0,5700),r:250,col:'#228822',name:'Verdant'},
      {pos:v3(2500,0,3800), r:300,col:'#336633',name:'Canopy'},
    ],
  },
};
