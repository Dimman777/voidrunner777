// ═══════════════════════════════════════════════════════════
//  VECTOR MATH
// ═══════════════════════════════════════════════════════════
function v3(x,y,z){ return {x,y,z}; }
function v3add(a,b){ return {x:a.x+b.x, y:a.y+b.y, z:a.z+b.z}; }
function v3sub(a,b){ return {x:a.x-b.x, y:a.y-b.y, z:a.z-b.z}; }
function v3scale(v,s){ return {x:v.x*s, y:v.y*s, z:v.z*s}; }
function v3dot(a,b){ return a.x*b.x+a.y*b.y+a.z*b.z; }
function v3cross(a,b){ return {x:a.y*b.z-a.z*b.y, y:a.z*b.x-a.x*b.z, z:a.x*b.y-a.y*b.x}; }
function v3len(v){ return Math.sqrt(v.x*v.x+v.y*v.y+v.z*v.z); }
function v3norm(v){ const l=v3len(v)||1; return {x:v.x/l,y:v.y/l,z:v.z/l}; }

// ═══════════════════════════════════════════════════════════
//  QUATERNION — full 360° orientation, no gimbal lock
// ═══════════════════════════════════════════════════════════
function quat(w,x,y,z){ return {w,x,y,z}; }
function qFromAxisAngle(axis, angle){
  const ha=angle*.5, s=Math.sin(ha), c=Math.cos(ha);
  return quat(c, axis.x*s, axis.y*s, axis.z*s);
}
function qMul(a,b){
  return quat(
    a.w*b.w-a.x*b.x-a.y*b.y-a.z*b.z,
    a.w*b.x+a.x*b.w+a.y*b.z-a.z*b.y,
    a.w*b.y-a.x*b.z+a.y*b.w+a.z*b.x,
    a.w*b.z+a.x*b.y-a.y*b.x+a.z*b.w
  );
}
function qNorm(q){
  const l=Math.sqrt(q.w*q.w+q.x*q.x+q.y*q.y+q.z*q.z)||1;
  return quat(q.w/l, q.x/l, q.y/l, q.z/l);
}
function qConj(q){ return quat(q.w,-q.x,-q.y,-q.z); }
function qRot(q,v){
  const qv=quat(0,v.x,v.y,v.z);
  const r=qMul(qMul(q,qv),qConj(q));
  return v3(r.x,r.y,r.z);
}
function qFwd(q){ return qRot(q, v3(0,0,1)); }
function qRight(q){ return qRot(q, v3(1,0,0)); }
function qUp(q){ return qRot(q, v3(0,1,0)); }

// World → camera space
function w2c(point, camPos, camQ){
  return qRot(qConj(camQ), v3sub(point, camPos));
}

// Euler rotation helpers for NPC objects
function eRotY(a){ const c=Math.cos(a),s=Math.sin(a); return v=>({x:v.x*c+v.z*s, y:v.y, z:-v.x*s+v.z*c}); }
function eRotX(a){ const c=Math.cos(a),s=Math.sin(a); return v=>({x:v.x, y:v.y*c-v.z*s, z:v.y*s+v.z*c}); }
