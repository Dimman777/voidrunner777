// ═══════════════════════════════════════════════════════════
//  CANVAS — shared globals: ctx, PI, W/H/CX/CY
// ═══════════════════════════════════════════════════════════
const C = document.getElementById('c');
const ctx = C.getContext('2d');
const PI = Math.PI, PI2 = PI*2, DEG = PI/180;

let W, H, CX, CY;
function resize(){
  W = C.width = innerWidth; H = C.height = innerHeight;
  CX = W/2; CY = H/2;
}
resize();
window.addEventListener('resize', resize);
