/* THE PITCH — 물리 엔진 / 규칙 (브라우저·node 공용)
 * 좌표계(포수 시점): x = 1루 쪽(+), y = 투수 방향(+), z = 위(+). 홈플레이트 앞면 = y 0
 * 투구: 중력 + 항력 + 마그누스(회전축 벡터) + 심 시프티드 웨이크(SSW) + 너클 난류
 */
(function (G) {
'use strict';
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function gauss(r) { r = r || Math.random; let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283185307 * r()); }

const PH = {
  g: 9.81, R: 0.0366, KQ: 0.5 * 1.2 * Math.PI * 0.0366 * 0.0366 / 0.145, CLK: 0.78,
  MOUND: 18.44, REL_Y: 16.85, REL_Z: 1.82, REL_X: 0.55,
  ZX: 0.2159, ZB: 0.48, ZT: 1.04, SWING_T: 0.13
};
// 양력계수 (Sawicki 근사 × 보정)
function CL(S) { return PH.CLK * (S < 0.1 ? 1.5 * S : Math.min(0.09 + 0.6 * S, 0.33)); }

/* 구종 정의 (우투수 기준)
 * th: 포수 시점에서 마그누스 힘이 향하는 방향 (0 = 위, -90 = 3루쪽/암사이드, +90 = 1루쪽/글러브사이드)
 * e : 회전 효율 (나머지는 자이로 회전 → 무브먼트 없음)
 * ssw: 심 효과로 생기는 추가 가속도 [x, z] (m/s²)
 */
const PT = {
  FF: { n: '포심', s: '직구', r: 1.00, rpm: 2380, e: .95, th: -30, ssw: [0, 0], c: '#ff5a5a', fam: 'F', d: '강한 백스핀으로 덜 떨어져 떠오르는 느낌' },
  SI: { n: '투심', s: '투심', r: .97, rpm: 2200, e: .90, th: -62, ssw: [-1.5, -1.3], c: '#ff9d3a', fam: 'F', d: '암사이드로 휘며 가라앉는 패스트볼' },
  FC: { n: '커터', s: '커터', r: .94, rpm: 2400, e: .45, th: 15, ssw: [0, 0], c: '#ffd84d', fam: 'F', d: '직구처럼 오다 끝에서 살짝 꺾임' },
  SL: { n: '슬라이더', s: '슬라', r: .89, rpm: 2450, e: .30, th: 98, ssw: [0, 0], c: '#4fc8ff', fam: 'B', d: '자이로 회전 위주, 짧고 날카롭게 꺾이며 떨어짐' },
  ST: { n: '스위퍼', s: '스위퍼', r: .86, rpm: 2600, e: .74, th: 86, ssw: [0, 0], c: '#00f0e0', fam: 'B', d: '사이드스핀으로 옆으로 크게 휩쓰는 공' },
  CU: { n: '커브', s: '커브', r: .80, rpm: 2650, e: .86, th: 158, ssw: [0, 0], c: '#b892ff', fam: 'B', d: '탑스핀으로 크게 떨어지는 낙차' },
  CH: { n: '체인지업', s: '체인지', r: .86, rpm: 1750, e: .85, th: -60, ssw: [-0.6, -1.5], c: '#6af0a8', fam: 'O', d: '직구 팔스윙, 느리고 암사이드로 가라앉음' },
  FS: { n: '포크', s: '포크', r: .89, rpm: 1250, e: .72, th: -36, ssw: [-0.3, -1.1], c: '#ff8fc8', fam: 'O', d: '회전이 적어 직구 궤적에서 뚝 떨어짐' },
  KN: { n: '너클볼', s: '너클', r: .74, rpm: 60, e: .5, th: 0, ssw: [0, 0], c: '#f2f2f2', fam: 'O', d: '회전이 거의 없어 공기 흐름 따라 불규칙하게 흔들림' }
};

// ---------- 투구 시뮬레이션 ----------
function simPitch(p, noSpin) {
  let x = p.pos[0], y = p.pos[1], z = p.pos[2], vx = p.vel[0], vy = p.vel[1], vz = p.vel[2];
  const w = noSpin ? [0, 0, 0] : p.w, ssw = noSpin ? [0, 0] : (p.ssw || [0, 0]), kn = noSpin ? null : p.kn;
  const wx = w[0], wy = w[1], wz = w[2], CD = 0.33, KQ = PH.KQ;
  function acc(vx, vy, vz, t, o) {
    const v = Math.hypot(vx, vy, vz);
    let ax = -KQ * CD * v * vx, ay = -KQ * CD * v * vy, az = -KQ * CD * v * vz - PH.g;
    const cx = wy * vz - wz * vy, cy = wz * vx - wx * vz, cz = wx * vy - wy * vx, cm = Math.hypot(cx, cy, cz);
    if (cm > 1e-9) { const S = PH.R * (cm / v) / v, a = KQ * CL(S) * v * v / cm; ax += a * cx; ay += a * cy; az += a * cz; }
    ax += ssw[0]; az += ssw[1];
    if (kn) {
      ax += kn.a * (Math.sin(6.2832 * kn.f1 * t + kn.p1) + 0.6 * Math.sin(6.2832 * kn.f2 * t + kn.p2));
      az += kn.a * (Math.sin(6.2832 * kn.f2 * t + kn.p3) + 0.6 * Math.sin(6.2832 * kn.f1 * t + kn.p4));
    }
    o[0] = ax; o[1] = ay; o[2] = az;
  }
  const dt = 0.001, a1 = [0, 0, 0], a2 = [0, 0, 0], pts = [[0, x, y, z]];
  let t = 0, step = 0, cross = null, bounced = false;
  while (y > -1.3 && t < 3) {
    acc(vx, vy, vz, t, a1);
    const mvx = vx + a1[0] * dt / 2, mvy = vy + a1[1] * dt / 2, mvz = vz + a1[2] * dt / 2;
    acc(mvx, mvy, mvz, t + dt / 2, a2);
    const ny = y + mvy * dt;
    if (!cross && ny <= 0) { const f = y / (y - ny); cross = { t: t + dt * f, x: x + mvx * dt * f, z: z + mvz * dt * f, v: Math.hypot(mvx, mvy, mvz) }; }
    x += mvx * dt; y = ny; z += mvz * dt; vx += a2[0] * dt; vy += a2[1] * dt; vz += a2[2] * dt; t += dt; step++;
    if (z < PH.R && vz < 0) { z = PH.R; vz = -vz * 0.42; vx *= 0.8; vy *= 0.8; bounced = true; }
    if (step % 4 === 0) pts.push([t, x, y, z]);
  }
  if (!cross) cross = { t: t, x: x, z: z, v: 0 };
  cross.bounce = bounced && pts.some(q => q[3] <= PH.R + 0.001 && q[2] > 0);
  return { pts: pts, cross: cross, end: t };
}

function spinVec(rpm, e, thDeg) {
  const w = rpm * 2 * Math.PI / 60, th = thDeg * Math.PI / 180;
  return [w * e * -Math.cos(th), -w * Math.sqrt(Math.max(0, 1 - e * e)), w * e * Math.sin(th)];
}

// 목표 지점(tx,tz)에 도달하도록 초기 속도 방향 풀기 (shooting method)
function solveAim(base, tx, tz) {
  let ax = tx, az = tz, res = null;
  const sp = base.speed / 3.6;
  for (let i = 0; i < 7; i++) {
    const dx = ax - base.pos[0], dy = 0 - base.pos[1], dz = az - base.pos[2], m = Math.hypot(dx, dy, dz);
    base.vel = [dx / m * sp, dy / m * sp, dz / m * sp];
    res = simPitch(base);
    const ex = res.cross.x - tx, ez = res.cross.z - tz;
    if (Math.abs(ex) < 0.0015 && Math.abs(ez) < 0.0015) break;
    ax -= ex; az -= ez;
  }
  return res;
}

// 투수 피로도 0~1
function fatigue(pc, pitcher) { const mx = 35 + pitcher.sta * 0.85; return clamp((pc - mx * 0.72) / (mx * 0.5), 0, 1); }

// 투구 생성 → 전송 가능한 순수 데이터
// q: 'P' perfect, 'G' good, 'N' normal, 'B' bad
const QF = { P: { s: .38, v: 1.009, r: 1.03 }, G: { s: .72, v: 1.0, r: 1.0 }, N: { s: 1.1, v: .995, r: .99 }, B: { s: 1.9, v: .985, r: .96 } };
function makePitch(pitcher, code, target, q, pcount, rng) {
  rng = rng || Math.random;
  const d = PT[code], m = pitcher.hand === 'L' ? -1 : 1, grade = (pitcher.ps.find(p => p.c === code) || { g: 60 }).g;
  const fat = fatigue(pcount || 0, pitcher), qf = QF[q] || QF.N;
  let speed = code === 'KN' ? 104 + rng() * 8 : pitcher.velo * d.r * (1 - fat * 0.04) * qf.v + gauss(rng) * 0.7;
  const rpm = d.rpm * (0.9 + grade / 100 * 0.17) * qf.r * (1 - fat * 0.05) * (1 + gauss(rng) * 0.02);
  const e = clamp(d.e + gauss(rng) * 0.02, 0.05, 1);
  const th = (d.th + gauss(rng) * 3) * m;
  const sig = (0.028 + (100 - pitcher.ctl) * 0.0011) * (1 + fat * 1.3) * qf.s;
  let tx = target[0] + gauss(rng) * sig, tz = target[1] + gauss(rng) * sig;
  if (q === 'B' && rng() < 0.35) { tx = tx * 0.4 + gauss(rng) * 0.05; tz = tz * 0.45 + 0.76 * 0.55; } // 실투: 한가운데로 몰림
  const base = {
    code: code, hand: m, speed: Math.round(speed * 10) / 10, rpm: Math.round(rpm), q: q,
    pos: [-PH.REL_X * m + gauss(rng) * 0.03, PH.REL_Y + gauss(rng) * 0.04, PH.REL_Z + gauss(rng) * 0.03],
    w: spinVec(rpm, e, th), ssw: [d.ssw[0] * m, d.ssw[1]], kn: null, vel: null
  };
  if (code === 'KN') base.kn = { a: 3.0 + rng() * 1.2, f1: 0.9 + rng() * 1.4, f2: 1.8 + rng() * 2, p1: rng() * 6.28, p2: rng() * 6.28, p3: rng() * 6.28, p4: rng() * 6.28 };
  solveAim(base, tx, tz);
  return base;
}

// 수신한 투구 데이터 → 궤적 + 무브먼트 정보
function runPitch(pd) {
  const tr = simPitch(pd), ns = simPitch(pd, true);
  const hb = tr.cross.x - ns.cross.x, ivb = tr.cross.z - ns.cross.z;
  return Object.assign({}, pd, { traj: tr.pts, cross: tr.cross, end: tr.end, hb: hb, ivb: ivb, nsPts: ns.pts });
}

function isStrike(c) { return Math.abs(c.x) <= PH.ZX + PH.R && c.z >= PH.ZB - PH.R && c.z <= PH.ZT + PH.R && !c.bounce; }
function isHBP(c, bhand) { const s = bhand === 'L' ? 1 : -1; const bx = c.x * s; return bx > 0.56 && bx < 1.0 && c.z > 0.25 && c.z < 1.75; }

// ---------- 타격 ----------
function cursorR(b) { return 0.052 + b.con / 100 * 0.05; }
function swingResult(pitch, sw, b, gm, rng) {
  rng = rng || Math.random; gm = gm || 1;
  const tc = pitch.cross.t, dT = (sw.ts + PH.SWING_T) - tc, bx = pitch.cross.x, bz = pitch.cross.z;
  const Rc = cursorR(b) * gm, win = 0.068 * (gm > 1 ? 1.15 : gm < 1 ? 0.93 : 1);
  const out = { dT: dT, dx: bx - sw.cx, dz: bz - sw.cz, Rc: Rc };
  const d = Math.hypot(bx - sw.cx, bz - sw.cz);
  if (Math.abs(dT) > win + 0.028 || d > Rc + PH.R || pitch.cross.bounce && rng() < 0.85) { out.type = 'miss'; return out; }
  if (Math.abs(dT) > win) { out.type = 'foul'; out.tip = true; return out; }
  const qd = 1 - d / (Rc + PH.R), qt = 1 - Math.abs(dT) / win;
  out.qd = qd; out.qt = qt;
  if (qd < 0.13 && rng() < 0.55 || qd < 0.32 && rng() < 0.35 || qt < 0.28 && rng() < 0.5) { out.type = 'foul'; out.tip = qd < 0.2; return out; }
  const vo = clamp((bz - sw.cz) / Rc, -1.35, 1.35);
  const la = 11 + vo * 40 + gauss(rng) * 5;
  const impact = clamp(1 - 0.6 * Math.pow(Math.abs(vo - 0.28), 1.35), 0.18, 1) * (0.76 + 0.24 * qt);
  const maxEV = 141 + b.pow * 0.42 + (pitch.cross.v * 3.6 - 135) * 0.06;
  const ev = clamp(maxEV * (0.6 + 0.4 * impact) + gauss(rng) * 3, 40, 192);
  const ps = b.hand === 'L' ? -1 : 1;
  const spray = ps * (dT / win) * 40 + ((bx - sw.cx) / Rc) * 9 + gauss(rng) * 6;
  out.ev = ev; out.la = la; out.spray = spray; out.perfect = qd > 0.72 && qt > 0.72;
  out.type = Math.abs(spray) > 45 || la > 78 ? 'foul' : 'inplay';
  return out;
}

// ---------- 타구 비행 ----------
function fenceD(phi) { const a = Math.min(Math.abs(phi), 45) / 45; return 120 - 22 * Math.pow(a, 1.5); }
const FENCE_H = 3.2;
function simBatted(ev, la, spray) {
  const v0 = ev / 3.6, a = la * Math.PI / 180, s = spray * Math.PI / 180;
  let x = 0, y = 0.4, z = 0.9, vx = v0 * Math.cos(a) * Math.sin(s), vy = v0 * Math.cos(a) * Math.cos(s), vz = v0 * Math.sin(a);
  const rpm = la > 5 ? 1500 + la * 25 : la > -5 ? 600 : -900;
  const w = rpm * 2 * Math.PI / 60, wx = Math.cos(s) * w, wy = -Math.sin(s) * w;
  const dt = 0.005, KQ = PH.KQ, pts = [[0, x, y, z]];
  let t = 0, land = null, hr = false, wall = false, step = 0, rolling = false, maxH = z, apexT = 0;
  while (t < 14) {
    const v = Math.hypot(vx, vy, vz);
    if (!rolling) {
      const CD = 0.3 + 0.14 * clamp((44 - v) / 18, 0, 1);
      let ax = -KQ * CD * v * vx, ay = -KQ * CD * v * vy, az = -KQ * CD * v * vz - PH.g;
      if (v > 1) {
        const cx = wy * vz, cy = -wx * vz, cz = wx * vy - wy * vx, cm = Math.hypot(cx, cy, cz);
        if (cm > 1e-9) { const S = PH.R * Math.abs(w) / v, k = KQ * CL(S) * v * v / cm * 0.78; ax += k * cx; ay += k * cy; az += k * cz; }
      }
      vx += ax * dt; vy += ay * dt; vz += az * dt;
      x += vx * dt; y += vy * dt; z += vz * dt;
      if (z > maxH) { maxH = z; apexT = t; }
      if (z <= 0) {
        z = 0; if (!land) land = { t: t, x: x, y: y };
        if (vz < -1.6) { vz = -vz * 0.4; const hk = Math.hypot(x, y) < 42 ? 0.86 : 0.7; vx *= hk; vy *= hk; }
        else { vz = 0; rolling = true; }
      }
    } else {
      const hv = Math.hypot(vx, vy); if (hv < 0.35) { pts.push([t, x, y, 0]); break; }
      const dec = Math.max(0, hv - (Math.hypot(x, y) < 40 ? 2.0 : 3.6) * dt) / hv; vx *= dec; vy *= dec; x += vx * dt; y += vy * dt;
    }
    const r = Math.hypot(x, y), phi = Math.atan2(x, y) * 180 / Math.PI, fd = fenceD(phi);
    if (Math.abs(phi) <= 46 && r >= fd && !wall) {
      if (!land && z > FENCE_H) { hr = true; land = { t: t, x: x, y: y }; pts.push([t, x, y, z]); for (let k = 1; k < 25; k++) { t += 0.05; vz -= 9.8 * 0.05; x += vx * 0.05 * .7; y += vy * 0.05 * .7; z = Math.max(0, z + vz * 0.05); pts.push([t, x, y, z]); } break; }
      wall = true; const ux = x / r, uy = y / r, rad = vx * ux + vy * uy;
      vx -= 1.35 * rad * ux; vy -= 1.35 * rad * uy; x = ux * (fd - 0.3); y = uy * (fd - 0.3);
      if (!land && z <= FENCE_H) { /* 펜스 직격 */ }
    }
    t += dt; step++;
    if (step % 10 === 0) pts.push([t, x, y, z]);
  }
  return { pts: pts, land: land, hr: hr, wall: wall, maxH: maxH, apexT: apexT, dist: land ? Math.hypot(land.x, land.y) : 0 };
}
function posAt(pts, t) {
  if (t <= pts[0][0]) return pts[0].slice(1);
  for (let i = 1; i < pts.length; i++) if (pts[i][0] >= t) { const a = pts[i - 1], b = pts[i], f = (t - a[0]) / Math.max(1e-6, b[0] - a[0]); return [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f]; }
  return pts[pts.length - 1].slice(1);
}

// ---------- 수비 ----------
const BASES = [[0, 0], [19.4, 19.4], [0, 38.8], [-19.4, 19.4], [0, 0]];
const FLD = [ // 이름, x, y, 속도(m/s), 반응(s)
  ['투수', 0, 18.4, 4.2, .55], ['포수', 0, -1.2, 4.5, .6], ['1루수', 17, 26.5, 4.6, .45], ['2루수', 9, 40.5, 5.0, .45],
  ['3루수', -17, 26.5, 4.6, .42], ['유격수', -9.5, 40.5, 5.1, .42], ['좌익수', -29, 80, 6.6, .7], ['중견수', 0, 93, 6.9, .7], ['우익수', 29, 80, 6.6, .7]
];
const dist2 = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
function runnerT(spd) { return 4.05 + (100 - spd) / 100 * 0.95; }
function baseT(spd) { return 3.55 + (100 - spd) / 100 * 0.8; }

/* 인플레이 결과 계산
 * st: {outs, bases:[r1,r2,r3] (타순 idx or -1)}, bat: 타자, spdOf(idx)=주자 주력 */
function resolvePlay(hit, st, bat, bIdx, spdOf, rng) {
  rng = rng || Math.random;
  const fl = simBatted(hit.ev, hit.la, hit.spray), pts = fl.pts;
  const play = { ev: hit.ev, la: hit.la, spray: hit.spray, pts: pts.map(p => p.map(v => Math.round(v * 100) / 100)), dist: Math.round(fl.dist), hr: fl.hr, fielder: -1, fT: 0, fP: null, caught: false, throwTo: -1, throwT: 0, moves: [], outs: 0, runs: 0, res: '', text: '' };
  const outs0 = st.outs, B = st.bases.slice();
  const finish = () => play;
  if (fl.hr) {
    play.res = 'HR'; play.text = '홈런!!!';
    for (let b = 2; b >= 0; b--) if (B[b] >= 0) { play.moves.push({ r: B[b], f: b + 1, t: 4 }); play.runs++; }
    play.moves.push({ r: bIdx, f: 0, t: 4 }); play.runs++;
    play.bases = [-1, -1, -1]; return finish();
  }
  // 1) 공중 포구
  const landT = fl.land ? fl.land.t : 99;
  let best = null;
  for (const p of pts) {
    if (p[0] > landT + 0.001) break;
    if (p[3] > 2.7 || p[0] < 0.15) continue;
    for (let i = 0; i < 9; i++) {
      const f = FLD[i], dd = Math.max(0, dist2(f[1], f[2], p[1], p[2]) - (i >= 6 ? 1.2 : 1.0));
      const tr = f[4] + dd / f[3];
      if (tr <= p[0] && (!best || p[0] < best.t)) best = { i: i, t: p[0], x: p[1], y: p[2] };
    }
    if (best) break;
  }
  // 펜스 직격/바운드 전 다이빙 캐치 확률 보정
  if (!best && fl.land) {
    for (let i = 0; i < 9; i++) {
      const f = FLD[i], dd = dist2(f[1], f[2], fl.land.x, fl.land.y), tr = f[4] + dd / f[3];
      if (tr - landT < 0.35 && tr - landT > 0 && rng() < 0.45 * (1 - (tr - landT) / 0.35)) { best = { i: i, t: landT, x: fl.land.x, y: fl.land.y, dive: true }; break; }
    }
  }
  if (best) {
    play.caught = true; play.fielder = best.i; play.fT = best.t; play.fP = [best.x, best.y];
    play.outs = 1; const inf = best.i <= 5;
    play.res = hit.la < 14 ? 'LO' : (inf ? 'PO' : 'FO');
    play.text = (best.dive ? '다이빙 캐치! ' : '') + (play.res === 'LO' ? '라인드라이브 아웃' : inf ? '내야 뜬공 아웃' : FLD[best.i][0] + ' 뜬공 아웃');
    play.moves.push({ r: bIdx, f: 0, t: -1 });
    const dd = Math.hypot(best.x, best.y);
    if (outs0 < 2 && !inf && B[2] >= 0 && dd > 60 && play.res !== 'LO') { // 희생플라이
      play.moves.push({ r: B[2], f: 3, t: 4, tag: best.t }); play.runs = 1; B[2] = -1; play.res = 'SF'; play.text = '희생플라이! 3루 주자 득점';
      if (B[1] >= 0 && dd > 84) { play.moves.push({ r: B[1], f: 2, t: 3, tag: best.t }); B[2] = B[1]; B[1] = -1; }
    }
    play.bases = B; return finish();
  }
  // 2) 땅볼/안타: 굴러가는 공 처리
  let fb = null;
  for (const p of pts) {
    if (p[0] < landT - 0.001 && p[3] > 1.9) continue;
    if (p[3] > 1.9) continue;
    for (let i = 0; i < 9; i++) {
      const f = FLD[i], dd = Math.max(0, dist2(f[1], f[2], p[1], p[2]) - (i <= 5 ? 0.9 : 0.5));
      const tr = f[4] + dd / f[3];
      if (tr <= p[0] && (!fb || p[0] < fb.t)) fb = { i: i, t: p[0], x: p[1], y: p[2] };
    }
    if (fb) break;
  }
  if (!fb) { // 끝까지 안 잡힘 → 가장 빨리 도달하는 외야수
    const e = pts[pts.length - 1]; let bt = 1e9, bi = 7;
    for (let i = 6; i < 9; i++) { const f = FLD[i], tr = f[4] + dist2(f[1], f[2], e[1], e[2]) / f[3]; if (tr < bt) { bt = tr; bi = i; } }
    fb = { i: bi, t: Math.max(bt, e[0]) + 0.3, x: e[1], y: e[2] };
  }
  play.fielder = fb.i; play.fT = fb.t; play.fP = [fb.x, fb.y];
  const sp = bat.spd, Tr = runnerT(sp);
  const fx = fb.x, fy = fb.y, ft = fb.t;
  if (fb.i <= 5 && Math.hypot(fx, fy) < 46) {
    const t1 = ft + 0.85 + (fb.i === 2 && dist2(fx, fy, 19.4, 19.4) < 9 ? dist2(fx, fy, 19.4, 19.4) / 6 - 0.5 : dist2(fx, fy, 19.4, 19.4) / 28);
    const forced2 = B[0] >= 0;
    if (forced2 && outs0 < 2) {
      const t2 = ft + 0.45 + dist2(fx, fy, 0, 38.8) / 31, lead = 3.35 + (100 - spdOf(B[0])) / 100 * 0.6;
      if (t2 < lead) {
        const tdp = t2 + 0.7 + 27.43 / 31;
        if (tdp < Tr) { // 병살
          play.res = 'DP'; play.text = '병살타!'; play.outs = 2; play.throwTo = 2; play.throwT = t2;
          play.moves.push({ r: B[0], f: 1, t: -1 }); play.moves.push({ r: bIdx, f: 0, t: -1 });
          const nb = [-1, B[1], B[2]];
          if (outs0 === 0) { if (nb[2] >= 0) { play.moves.push({ r: nb[2], f: 3, t: 4 }); play.runs++; nb[2] = -1; } if (nb[1] >= 0) { play.moves.push({ r: nb[1], f: 2, t: 3 }); nb[2] = nb[1]; nb[1] = -1; } }
          play.bases = nb; return finish();
        }
        // 선행주자 포스아웃 (야수선택)
        play.res = 'FC'; play.text = '2루 포스아웃 (야수선택)'; play.outs = 1; play.throwTo = 2; play.throwT = t2;
        play.moves.push({ r: B[0], f: 1, t: -1 }); play.moves.push({ r: bIdx, f: 0, t: 1 });
        const nb = [bIdx, -1, -1];
        if (B[1] >= 0) { play.moves.push({ r: B[1], f: 2, t: 3 }); nb[2] = B[1]; }
        if (B[2] >= 0) { if (B[1] >= 0) { play.moves.push({ r: B[2], f: 3, t: 4 }); play.runs++; } else nb[2] = B[2]; }
        play.bases = nb; return finish();
      }
    }
    if (t1 < Tr) { // 1루 아웃
      play.res = 'GO'; play.text = FLD[fb.i][0] + ' 땅볼 아웃'; play.outs = 1; play.throwTo = 1; play.throwT = ft + 0.55;
      play.moves.push({ r: bIdx, f: 0, t: -1 });
      const nb = B.slice();
      if (outs0 < 2) {
        if (nb[0] >= 0) { // 포스 진루
          if (nb[1] >= 0) { if (nb[2] >= 0) { play.moves.push({ r: nb[2], f: 3, t: 4 }); play.runs++; } play.moves.push({ r: nb[1], f: 2, t: 3 }); nb[2] = nb[1]; }
          play.moves.push({ r: nb[0], f: 1, t: 2 }); nb[1] = nb[0]; nb[0] = -1;
        } else {
          if (nb[2] >= 0 && (fx > 3 || ft > 1.5)) { play.moves.push({ r: nb[2], f: 3, t: 4 }); play.runs++; nb[2] = -1; }
          if (nb[1] >= 0 && nb[2] < 0 && fx > 0) { play.moves.push({ r: nb[1], f: 2, t: 3 }); nb[2] = nb[1]; nb[1] = -1; }
        }
      }
      play.bases = nb; return finish();
    }
    // 내야안타
    play.res = '1B'; play.text = '내야 안타!'; play.throwTo = 1; play.throwT = ft + 0.55;
    const nb = [bIdx, -1, -1]; play.moves.push({ r: bIdx, f: 0, t: 1 });
    if (B[2] >= 0) { if (B[1] >= 0 && B[0] >= 0) { play.moves.push({ r: B[2], f: 3, t: 4 }); play.runs++; } else nb[2] = B[2]; }
    if (B[1] >= 0) { if (B[0] >= 0) { if (nb[2] >= 0 && nb[2] !== B[1]) { } nb[2] = B[1]; play.moves.push({ r: B[1], f: 2, t: 3 }); } else nb[1] = B[1]; }
    if (B[0] >= 0) { nb[1] = B[0]; play.moves.push({ r: B[0], f: 1, t: 2 }); }
    play.bases = nb; return finish();
  }
  // 외야 안타: 몇 루까지?
  const thr = k => ft + 0.75 + dist2(fx, fy, BASES[k][0], BASES[k][1]) / 29;
  const bt = baseT(sp);
  let n = 1;
  if (Tr + bt + 0.25 < thr(2)) n = 2;
  if (n === 2 && Tr + bt * 2 + 0.3 < thr(3)) n = 3;
  if (n === 3 && Tr + bt * 3 + 0.4 < thr(4)) n = 4;
  play.res = ['', '1B', '2B', '3B', 'IHR'][n];
  play.text = ['', '안타!', '2루타!!', '3루타!!!', '그라운드 홈런!!!!'][n];
  play.throwTo = Math.min(n + 1, 4); play.throwT = ft + 0.75;
  const nb = [-1, -1, -1];
  for (let b = 2; b >= 0; b--) {
    const r = B[b]; if (r < 0) continue;
    let to = b + 1 + n;
    const extra = n === 1 ? (b === 1 ? (fb.i >= 6 ? 1 : 0) : b === 0 && ft > 2.6 && fx > 5 && rng() < 0.55 ? 1 : 0) : n === 2 && b === 0 && ft + 0.75 + dist2(fx, fy, 0, 0) / 29 > 3.5 + bt * 2 * (spdOf(r) > 70 ? 0.9 : 1) - 3.2 ? 1 : 0;
    to += extra;
    while (to <= 3 && nb[to - 1] >= 0) to++;
    if (to >= 4) { play.runs++; play.moves.push({ r: r, f: b + 1, t: 4 }); }
    else { nb[to - 1] = r; play.moves.push({ r: r, f: b + 1, t: to }); }
  }
  if (n >= 4) { play.runs++; play.moves.push({ r: bIdx, f: 0, t: 4 }); }
  else { nb[n - 1] = bIdx; play.moves.push({ r: bIdx, f: 0, t: n }); }
  play.bases = nb;
  return finish();
}

// 볼넷/사구 진루
function walkBases(B, bIdx) {
  const nb = B.slice(), moves = []; let runs = 0;
  if (nb[0] >= 0) {
    if (nb[1] >= 0) {
      if (nb[2] >= 0) { runs++; moves.push({ r: nb[2], f: 3, t: 4 }); }
      moves.push({ r: nb[1], f: 2, t: 3 }); nb[2] = nb[1];
    }
    moves.push({ r: nb[0], f: 1, t: 2 }); nb[1] = nb[0];
  }
  nb[0] = bIdx; moves.push({ r: bIdx, f: 0, t: 1 });
  return { bases: nb, runs: runs, moves: moves };
}

G.TP = { PH, PT, CL, simPitch, spinVec, solveAim, makePitch, runPitch, fatigue, isStrike, isHBP, cursorR, swingResult, simBatted, posAt, resolvePlay, walkBases, fenceD, FENCE_H, FLD, BASES, runnerT, baseT, mulberry32, gauss, clamp };
if (typeof module !== 'undefined') module.exports = G.TP;
})(typeof globalThis !== 'undefined' ? globalThis : this);
