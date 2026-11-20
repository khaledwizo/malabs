// فيزياء حركة اللاعب (مشتركة بين السيرفر والتنبؤ عند العميل)
export const PH = {
  r: 0.33, hStand: 1.8, hCrouch: 1.28, eyeStand: 1.64, eyeCrouch: 1.16, step: 0.43,
  run: 5.6, walk: 2.7, crouch: 1.9, accel: 9, airAccel: 1.6, friction: 5.5, gravity: 16, jump: 5.7, stopSpeed: 1.6,
};

// cmd: { mx, mz (-1..1), yaw, jump, crouch, walk }
export function stepMove(p, cmd, dt, world, speedMul = 1) {
  const wantCrouch = !!cmd.crouch;
  // الانحناء التدريجي (مع منع الوقوف تحت سقف منخفض)
  if (wantCrouch) p.crouch = Math.min(1, p.crouch + dt * 8);
  else if (p.crouch > 0) {
    const h = PH.hStand;
    if (!world.overlap(p.pos[0], p.pos[1], p.pos[2], PH.r, h)) p.crouch = Math.max(0, p.crouch - dt * 7);
  }
  const height = PH.hStand + (PH.hCrouch - PH.hStand) * p.crouch;
  // رفع القدمين عند الانحناء في الهواء (قفزة منحنية)
  if (!p.onGround && wantCrouch && !p.airDucked) { if (!world.overlap(p.pos[0], p.pos[1] + 0.45, p.pos[2], PH.r, height)) p.pos[1] += 0.45; p.airDucked = true; }
  if (p.onGround) p.airDucked = false;

  const sy = Math.sin(cmd.yaw), cy = Math.cos(cmd.yaw);
  // الأمام = (-sin, -cos) · اليمين = (cos, -sin)
  let wx = -sy * cmd.mz + cy * cmd.mx, wz = -cy * cmd.mz - sy * cmd.mx;
  const wl = Math.hypot(wx, wz); if (wl > 1) { wx /= wl; wz /= wl; }
  const amt = Math.min(1, Math.hypot(cmd.mx, cmd.mz));
  let maxS = (p.crouch > 0.5 ? PH.crouch : cmd.walk ? PH.walk : PH.run) * speedMul;
  const v = p.vel;
  if (p.onGround) {
    // احتكاك
    const sp = Math.hypot(v[0], v[2]);
    if (sp > 0.001) { const drop = Math.max(sp, PH.stopSpeed) * PH.friction * dt; const ns = Math.max(0, sp - drop) / sp; v[0] *= ns; v[2] *= ns; }
    // تسارع نحو السرعة المطلوبة
    const wish = maxS * amt;
    if (wish > 0) { const cur = v[0] * wx / (wl || 1) + v[2] * wz / (wl || 1); const add = Math.min(Math.max(0, wish - cur), PH.accel * wish * dt); v[0] += add * wx / (wl || 1); v[2] += add * wz / (wl || 1); }
    if (cmd.jump && p.jumpReady) { v[1] = PH.jump; p.onGround = false; p.jumpReady = false; p.justJumped = true; }
  } else {
    const wish = Math.min(maxS * amt, 0.9);
    if (wish > 0 && wl > 0) { const dx = wx / wl, dz = wz / wl, cur = v[0] * dx + v[2] * dz, add = Math.min(Math.max(0, wish - cur), PH.airAccel * maxS * dt * 4); v[0] += add * dx; v[2] += add * dz; }
    v[1] -= PH.gravity * dt;
  }
  if (!cmd.jump) p.jumpReady = true;
  const fallV = v[1];
  const res = world.move(p.pos, v, dt, PH.r, height, PH.step, p.onGround);
  const wasAir = !p.onGround;
  p.onGround = res.ground;
  p.landed = wasAir && res.ground ? -fallV : 0;
  if (res.ground && v[1] < 0) v[1] = 0;
  p.height = height;
  return res;
}
export function eyeHeight(p) { return PH.eyeStand + (PH.eyeCrouch - PH.eyeStand) * p.crouch; }
