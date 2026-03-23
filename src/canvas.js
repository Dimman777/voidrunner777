// ═══════════════════════════════════════════════════════════
//  CANVAS — #hud is the 2D overlay; #c is owned by Three.js
// ═══════════════════════════════════════════════════════════
const HUD = document.getElementById('hud');
const ctx = HUD.getContext('2d');
const PI = Math.PI, PI2 = PI*2, DEG = PI/180;

let W, H, CX, CY;
function resize(){
  W = HUD.width = innerWidth; H = HUD.height = innerHeight;
  CX = W/2; CY = H/2;
}
resize();
window.addEventListener('resize', resize);
