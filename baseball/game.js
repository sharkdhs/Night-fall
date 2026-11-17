/* THE PITCH — 게임 본체 (렌더링·입력·진행·CPU·온라인) */
(function () {
'use strict';
const T = window.TP, PH = T.PH, PT = T.PT, clamp = T.clamp, gauss = T.gauss;
const $ = id => document.getElementById(id);
const cv = $('cv'), g = cv.getContext('2d');
let W = 0, H = 0, DPR = 1;
function resize() { DPR = Math.min(2, window.devicePixelRatio || 1); W = cv.clientWidth || innerWidth; H = cv.clientHeight || innerHeight; cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); g.setTransform(DPR, 0, 0, DPR, 0, 0); }
addEventListener('resize', resize); resize();
const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } } };
const pickW = (items, w) => { let s = 0; for (const x of w) s += x; let r = Math.random() * s; for (let i = 0; i < items.length; i++) { r -= w[i]; if (r <= 0) return items[i]; } return items[items.length - 1]; };
function toast(t, ms) { const e = $('toast'); e.textContent = t; e.style.opacity = 1; clearTimeout(toast.h); toast.h = setTimeout(() => e.style.opacity = 0, ms || 2200); }

// ================= 사운드 =================
let AC = null, soundOn = LS.get('tp_snd', true);
function ac() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } } if (AC && AC.state === 'suspended') AC.resume(); return AC; }
function noise(dur, freq, q, vol, type) {
  const a = ac(); if (!a || !soundOn) return;
  const n = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate), d = n.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
  const s = a.createBufferSource(); s.buffer = n; const f = a.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const gn = a.createGain(); gn.gain.value = vol; s.connect(f); f.connect(gn); gn.connect(a.destination); s.start();
}
const SND = {
  crack: p => { noise(0.1, 2400, 1.1, 1.0 * p); noise(0.07, 900, 2, 0.7 * p); },
  mitt: () => noise(0.08, 480, 1.6, 0.9),
  whiff: () => noise(0.22, 800, 0.6, 0.3, 'lowpass'),
  cheer: () => { for (let i = 0; i < 5; i++) setTimeout(() => noise(1.0, 1100 + i * 90, 0.35, 0.16), i * 110); }
};

// ================= 팀 =================
const TEAMS = [
  { id: 'FB', name: '광주 파이어버즈', ab: '광주', c1: '#d8202f', c2: '#ffd400', seed: 101, ace: ['R', 151, [['FF', 85], ['SL', 88], ['CU', 72], ['CH', 70]]], su: ['L', 146, [['FF', 75], ['SL', 78], ['FS', 72]]], cl: ['R', 155, [['FF', 90], ['FS', 86]]] },
  { id: 'ST', name: '서울 스톰', ab: '서울', c1: '#2440a0', c2: '#e6ecff', seed: 202, ace: ['L', 147, [['FF', 80], ['CU', 90], ['CH', 82], ['FC', 70]]], su: ['R', 150, [['FF', 78], ['ST', 80]]], cl: ['R', 153, [['FF', 84], ['SL', 85], ['CU', 70]]] },
  { id: 'SH', name: '부산 씨호크스', ab: '부산', c1: '#123a6b', c2: '#ff7a00', seed: 303, ace: ['R', 149, [['SI', 86], ['ST', 90], ['CH', 78], ['FS', 72]]], su: ['R', 145, [['FC', 82], ['CU', 80], ['FF', 70]]], cl: ['L', 150, [['FF', 86], ['CH', 84]]] },
  { id: 'WH', name: '인천 블루웨일즈', ab: '인천', c1: '#0a78d8', c2: '#c9ecff', seed: 404, ace: ['R', 153, [['FF', 90], ['FS', 88], ['SL', 76]]], su: ['R', 128, [['KN', 92], ['FF', 55]]], cl: ['R', 156, [['FF', 92], ['SL', 80]]] },
  { id: 'TB', name: '대구 썬더볼츠', ab: '대구', c1: '#5a3cc8', c2: '#9ad0ff', seed: 505, ace: ['L', 145, [['FF', 78], ['ST', 88], ['CU', 84], ['CH', 75]]], su: ['R', 148, [['SI', 80], ['SL', 82]]], cl: ['R', 152, [['FF', 85], ['CU', 88]]] },
  { id: 'RK', name: '대전 로켓츠', ab: '대전', c1: '#f26a00', c2: '#2a2a2a', seed: 606, ace: ['R', 144, [['SI', 84], ['FC', 86], ['CU', 82], ['CH', 84]]], su: ['L', 143, [['FF', 72], ['CH', 85], ['SL', 74]]], cl: ['R', 154, [['FF', 88], ['FS', 82]]] }
];
const SUR = '김이박최정강조윤장임한오서신권황안송류홍전고문양손배백허남노하곽성차주우구나진엄원천방공현변추도석설'.split('');
const GIV = '민준서현우진호성재영지훈도윤태상동건승혁규석원수찬희빈율결한경범환철용형기명택균강인주하선광종욱'.split('');
const POS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];
const POSK = { C: '포수', '1B': '1루수', '2B': '2루수', '3B': '3루수', SS: '유격수', LF: '좌익수', CF: '중견수', RF: '우익수', DH: '지명타자' };
const teamDef = id => TEAMS.find(t => t.id === id) || TEAMS[0];
function buildTeam(def) {
  const r = T.mulberry32(def.seed), ri = (a, b) => Math.round(a + (b - a) * r()), used = new Set();
  const name = () => { let n; do { n = SUR[Math.floor(r() * SUR.length)] + GIV[Math.floor(r() * GIV.length)] + GIV[Math.floor(r() * GIV.length)]; } while (used.has(n)); used.add(n); return n; };
  const s1 = ri(0, 8), s2 = (s1 + ri(1, 7)) % 9;
  const bats = POS.map((p, i) => {
    const b = { name: name(), pos: p, hand: r() < 0.32 ? 'L' : 'R', con: ri(48, 80), pow: ri(42, 80), eye: ri(42, 80), spd: ri(40, 82) };
    if (p === 'C') b.spd -= 16; if (p === 'SS' || p === 'CF' || p === '2B') { b.spd += 10; b.pow -= 6; } if (p === '1B' || p === 'DH' || p === 'LF') { b.pow += 10; b.spd -= 6; }
    if (i === s1 || i === s2) { b.con += 10; b.pow += 13; b.eye += 6; b.star = true; }
    for (const k of ['con', 'pow', 'eye', 'spd']) b[k] = clamp(b[k], 30, 99);
    return b;
  });
  const pool = bats.slice(), take = f => { pool.sort((a, b) => f(b) - f(a)); return pool.shift(); };
  const order = [];
  order[0] = take(b => b.spd * 1.2 + b.con); order[1] = take(b => b.con * 1.3 + b.eye); order[3] = take(b => b.pow * 1.5 + b.con * .5);
  order[2] = take(b => b.pow + b.con); order[4] = take(b => b.pow * 1.3 + b.con * .4);
  for (let i = 5; i < 9; i++) order[i] = take(b => b.con + b.pow + b.eye);
  const mkP = (a, role) => ({ name: name(), role: role, hand: a[0], velo: a[1], ps: a[2].map(x => ({ c: x[0], g: x[1] })), ctl: role === '선발' ? ri(64, 82) : role === '중계' ? ri(58, 76) : ri(62, 80), sta: role === '선발' ? ri(86, 96) : role === '중계' ? ri(45, 58) : ri(34, 44) });
  return Object.assign({}, def, { bats: order, pits: [mkP(def.ace, '선발'), mkP(def.su, '중계'), mkP(def.cl, '마무리')] });
}

// ================= 경기 상태 / 규칙 =================
function newState(inn) { return { inn: 1, half: 0, outs: 0, b: 0, s: 0, bases: [-1, -1, -1], score: [0, 0], line: [[], []], hits: [0, 0], hr: [0, 0], k: [0, 0], bb: [0, 0], ord: [0, 0], pit: [0, 0], pc: [[0, 0, 0], [0, 0, 0]], innings: inn, maxInn: inn + 3, over: false, seq: 0, ab: 0 }; }
const HITS = ['1B', '2B', '3B', 'HR', 'IHR'];
function endHalf(st) {
  const off = st.half; st.line[off][st.inn - 1] = st.line[off][st.inn - 1] || 0;
  st.outs = 0; st.b = 0; st.s = 0; st.bases = [-1, -1, -1];
  if (off === 0) { if (st.inn >= st.innings && st.score[1] > st.score[0]) { st.over = true; return; } st.half = 1; }
  else { if (st.inn >= st.innings && st.score[0] !== st.score[1]) { st.over = true; return; } if (st.inn >= st.maxInn) { st.over = true; return; } st.half = 0; st.inn++; }
}
function applyOutcome(st, o) {
  const off = st.half, def = 1 - off, ev = { big: '', sub: '', col: '#fff', abEnd: false };
  st.pc[def][st.pit[def]]++; st.seq++;
  const bi = st.ord[off];
  const endAB = () => { ev.abEnd = true; st.b = 0; st.s = 0; st.ord[off] = (st.ord[off] + 1) % 9; st.ab++; };
  const runs = n => { if (n <= 0) return; st.score[off] += n; st.line[off][st.inn - 1] = (st.line[off][st.inn - 1] || 0) + n; };
  const walk = (txt) => { const w = T.walkBases(st.bases, bi); st.bases = w.bases; runs(w.runs); ev.big = txt; ev.col = '#3fe07a'; if (w.runs) ev.sub = '밀어내기 득점!'; st.bb[off]++; endAB(); };
  if (o.type === 'ball') { st.b++; ev.big = '볼'; ev.col = '#3fe07a'; if (st.b >= 4) walk('볼넷'); }
  else if (o.type === 'hbp') { walk('몸에 맞는 볼'); }
  else if (o.type === 'strike' || o.type === 'swstr') {
    st.s++; ev.big = o.type === 'strike' ? '스트라이크' : '헛스윙'; ev.col = '#ffd23f';
    if (st.s >= 3) { ev.big = o.type === 'strike' ? '루킹 삼진!' : '헛스윙 삼진!'; ev.col = '#ff5252'; st.outs++; st.k[off]++; endAB(); }
  } else if (o.type === 'foul') {
    if (o.tipK) { ev.big = '파울팁 삼진!'; ev.col = '#ff5252'; st.outs++; st.k[off]++; endAB(); }
    else { if (st.s < 2) st.s++; ev.big = '파울'; ev.col = '#ffd23f'; }
  } else if (o.type === 'inplay') {
    const p = o.play; st.outs += p.outs;
    if (st.outs < 3) { st.bases = p.bases.slice(); runs(p.runs); }
    if (HITS.includes(p.res)) st.hits[off]++; if (p.res === 'HR' || p.res === 'IHR') st.hr[off]++;
    ev.big = p.text; ev.col = HITS.includes(p.res) ? (p.res === 'HR' || p.res === 'IHR' ? '#ffd23f' : '#4fc8ff') : (p.runs && st.outs < 3 ? '#3fe07a' : '#ff8a8a');
    if (p.runs && st.outs < 3 && p.res !== 'HR' && p.res !== 'SF') ev.sub = p.runs + '점 득점!';
    if (p.res === 'HR') ev.sub = p.runs === 4 ? '만루 홈런!!' : p.runs + '점 홈런';
    endAB();
  }
  if (st.half === 1 && st.inn >= st.innings && st.score[1] > st.score[0]) { st.over = true; ev.sub = (ev.sub ? ev.sub + ' · ' : '') + '끝내기!'; }
  if (!st.over && st.outs >= 3) { ev.halfEnd = true; endHalf(st); }
  return ev;
}

// ================= 3D 카메라 & 그리기 =================
const V = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cr: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], n: a => { const m = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / m, a[1] / m, a[2] / m]; }
};
function mkCam(eye, tgt, F, cx, cy) { const f = V.n(V.sub(tgt, eye)), r = V.n(V.cr(f, [0, 0, 1])), u = V.cr(r, f); return { eye, f, r, u, F, cx, cy }; }
function toC(c, p) { const d = V.sub(p, c.eye); return [V.dot(d, c.r), V.dot(d, c.u), V.dot(d, c.f)]; }
function prC(c, q) { return [c.cx + c.F * q[0] / q[2], c.cy - c.F * q[1] / q[2]]; }
function prj(c, p) { const q = toC(c, p); if (q[2] < 0.08) return null; const s = prC(c, q); s.push(q[2]); return s; }
function clipNear(ps, n) { const o = []; for (let i = 0; i < ps.length; i++) { const a = ps[i], b = ps[(i + 1) % ps.length], ai = a[2] >= n, bi = b[2] >= n; if (ai) o.push(a); if (ai !== bi) { const t = (n - a[2]) / (b[2] - a[2]); o.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, n]); } } return o; }
function poly(c, pts, fill, stroke, lw) {
  const cp = clipNear(pts.map(p => toC(c, p)), 0.1); if (cp.length < 3) return;
  g.beginPath(); for (let i = 0; i < cp.length; i++) { const s = prC(c, cp[i]); i ? g.lineTo(s[0], s[1]) : g.moveTo(s[0], s[1]); } g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 1; g.stroke(); }
}
function gline(c, a, b, w, col) { // 지면 위 두께 있는 선
  const dx = b[0] - a[0], dy = b[1] - a[1], m = Math.hypot(dx, dy) || 1, nx = -dy / m * w / 2, ny = dx / m * w / 2;
  poly(c, [[a[0] + nx, a[1] + ny, 0.01], [b[0] + nx, b[1] + ny, 0.01], [b[0] - nx, b[1] - ny, 0.01], [a[0] - nx, a[1] - ny, 0.01]], col);
}
const circ = (cx0, cy0, r, n, z) => { const o = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; o.push([cx0 + Math.cos(a) * r, cy0 + Math.sin(a) * r, z || 0]); } return o; };
const GEO = (function () {
  const fence = []; for (let a = -46; a <= 46.01; a += 2) { const r = T.fenceD(a), t = a * Math.PI / 180; fence.push([r * Math.sin(t), r * Math.cos(t), a, r]); }
  const fair = [[0, 0, 0]].concat(fence.map(p => [p[0], p[1], 0]));
  const band = (r0, r1) => { const o = []; for (const p of fence) { const t = p[2] * Math.PI / 180, r = Math.min(p[3], r0); o.push([r * Math.sin(t), r * Math.cos(t), 0]); } for (let i = fence.length - 1; i >= 0; i--) { const p = fence[i], t = p[2] * Math.PI / 180, r = Math.min(p[3], r1); o.push([r * Math.sin(t), r * Math.cos(t), 0]); } return o; };
  const warn = []; for (const p of fence) warn.push([p[0], p[1], 0]); for (let i = fence.length - 1; i >= 0; i--) { const p = fence[i], t = p[2] * Math.PI / 180, r = p[3] - 4.5; warn.push([r * Math.sin(t), r * Math.cos(t), 0]); }
  const dirt = []; for (let a = -71.8; a <= 71.81; a += 4) { const t = a * Math.PI / 180; dirt.push([29 * Math.sin(t), 18.44 + 29 * Math.cos(t), 0]); }
  dirt.push([1.9, 1.9, 0], [-1.9, 1.9, 0]);
  const igrass = [[0, 3.6, 0], [15.8, 19.4, 0], [0, 35.2, 0], [-15.8, 19.4, 0]];
  const stands = [], standTop = [];
  for (let a = -88; a <= 88.01; a += 4) {
    const t = a * Math.PI / 180, aa = Math.abs(a), rin = aa <= 46 ? T.fenceD(a) : 98 + (30 - 98) * (aa - 46) / 42, hin = aa <= 46 ? T.FENCE_H : 2.2;
    stands.push([rin * Math.sin(t), rin * Math.cos(t), hin]); standTop.push([(rin + 38) * Math.sin(t), (rin + 38) * Math.cos(t), 24]);
  }
  const wall = []; for (let a = -88; a <= 88.01; a += 4) { const t = a * Math.PI / 180, aa = Math.abs(a), rin = aa <= 46 ? T.fenceD(a) : 98 + (30 - 98) * (aa - 46) / 42; wall.push([rin * Math.sin(t), rin * Math.cos(t), aa <= 46 ? T.FENCE_H : 2.2, aa]); }
  const crowd = []; const rr = T.mulberry32(77); const cols = ['#e8e8e8', '#d8202f', '#2440a0', '#ffd400', '#f26a00', '#9ad0ff', '#444', '#7a7a7a'];
  for (let i = 0; i < 700; i++) { const a = -86 + rr() * 172, t = a * Math.PI / 180, aa = Math.abs(a), rin = aa <= 46 ? T.fenceD(a) : 98 + (30 - 98) * (aa - 46) / 42, k = rr(); crowd.push([(rin + 3 + k * 33) * Math.sin(t), (rin + 3 + k * 33) * Math.cos(t), 3.5 + k * 20, cols[Math.floor(rr() * cols.length)]]); }
  return { fence, fair, warn, dirt, igrass, stands, standTop, wall, crowd, s1: band(52, 64), s2: band(76, 88) };
})();

function drawWorld(c) {
  // 하늘/지면
  const fh = V.n([c.f[0], c.f[1], 0]), hp = prj(c, [c.eye[0] + fh[0] * 3000, c.eye[1] + fh[1] * 3000, 0]);
  const hy = hp ? hp[1] : -100;
  const sky = g.createLinearGradient(0, 0, 0, Math.max(10, hy));
  sky.addColorStop(0, '#0a1a3a'); sky.addColorStop(1, '#2c4f86');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  g.fillStyle = '#2d6a37'; g.fillRect(0, Math.max(0, hy), W, H);
  // 관중석
  const sp = GEO.stands.concat(GEO.standTop.slice().reverse());
  poly(c, sp, '#1b2333');
  for (const d of GEO.crowd) { const p = prj(c, d); if (!p || p[0] < -5 || p[0] > W + 5 || p[1] < -5 || p[1] > H + 5) continue; const s = Math.max(1, c.F * 0.55 / p[2]); g.fillStyle = d[3]; g.fillRect(p[0] - s / 2, p[1] - s, s, s * 1.3); }
  // 조명탑 빛
  // 그라운드
  poly(c, GEO.fair, '#3a8a45');
  poly(c, GEO.s1, '#43974e'); poly(c, GEO.s2, '#43974e');
  poly(c, GEO.warn, '#8a6a45');
  poly(c, GEO.dirt, '#b98a5a');
  poly(c, GEO.igrass, '#3d9048');
  poly(c, circ(0, 18.44, 2.75, 20), '#c0915f');
  poly(c, circ(0, 0, 4, 22), '#b98a5a');
  for (let i = 1; i <= 3; i++) poly(c, circ(T.BASES[i][0], T.BASES[i][1], 2.3, 14), '#b98a5a');
  // 라인
  gline(c, [0, 0], [T.fenceD(45) * Math.SQRT1_2, T.fenceD(45) * Math.SQRT1_2], 0.1, '#f4f4f4');
  gline(c, [0, 0], [-T.fenceD(45) * Math.SQRT1_2, T.fenceD(45) * Math.SQRT1_2], 0.1, '#f4f4f4');
  gline(c, [19.4, 19.4], [0, 38.8], 0.08, 'rgba(255,255,255,.35)'); gline(c, [0, 38.8], [-19.4, 19.4], 0.08, 'rgba(255,255,255,.35)');
  // 타석 박스
  for (const sx of [-1, 1]) poly(c, [[sx * 0.45, -0.9, 0.01], [sx * 1.67, -0.9, 0.01], [sx * 1.67, 0.95, 0.01], [sx * 0.45, 0.95, 0.01]], null, 'rgba(255,255,255,.7)', 1.5);
  // 베이스
  for (let i = 1; i <= 3; i++) { const b = T.BASES[i]; poly(c, [[b[0], b[1] - 0.27, 0.05], [b[0] + 0.27, b[1], 0.05], [b[0], b[1] + 0.27, 0.05], [b[0] - 0.27, b[1], 0.05]], '#fff'); }
  poly(c, [[-0.216, 0, 0.02], [0.216, 0, 0.02], [0.216, -0.216, 0.02], [0, -0.43, 0.02], [-0.216, -0.216, 0.02]], '#fff');
  poly(c, [[-0.3, 18.3, 0.27], [0.3, 18.3, 0.27], [0.3, 18.45, 0.27], [-0.3, 18.45, 0.27]], '#fff');
  // 펜스
  const wl = GEO.wall;
  for (let i = 0; i < wl.length - 1; i++) { const a = wl[i], b = wl[i + 1]; poly(c, [[a[0], a[1], 0], [b[0], b[1], 0], [b[0], b[1], b[2]], [a[0], a[1], a[2]]], a[3] <= 46 && b[3] <= 46 ? '#16402a' : '#1e3550'); }
  for (let i = 0; i < GEO.fence.length - 1; i++) { const a = GEO.fence[i], b = GEO.fence[i + 1]; poly(c, [[a[0], a[1], T.FENCE_H], [b[0], b[1], T.FENCE_H], [b[0], b[1], T.FENCE_H - 0.25], [a[0], a[1], T.FENCE_H - 0.25]], '#ffd23f'); }
  // 거리 표시
  for (const a of [-45, 0, 45]) { const r = T.fenceD(a) - 0.3, t = a * Math.PI / 180, p = prj(c, [r * Math.sin(t), r * Math.cos(t), 1.6]); if (p && p[2] < 160) { g.fillStyle = 'rgba(255,255,255,.75)'; g.font = `bold ${Math.max(8, c.F * 1.3 / p[2])}px sans-serif`; g.textAlign = 'center'; g.fillText(Math.round(r + 0.3) + 'm', p[0], p[1]); } }
}

function figure(c, x, y, col, col2, opt) {
  opt = opt || {};
  const b = prj(c, [x, y, 0]), t = prj(c, [x, y, 1.82 * (opt.sc || 1)]); if (!b || !t) return;
  const h = b[1] - t[1]; if (h < 1.5) return;
  const w = h * 0.26;
  g.save(); g.globalAlpha = opt.alpha == null ? 1 : opt.alpha;
  g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(b[0], b[1], w * 0.9, w * 0.25, 0, 0, 6.3); g.fill();
  g.strokeStyle = '#e9e9e9'; g.lineCap = 'round'; g.lineWidth = Math.max(1, w * 0.42);
  g.beginPath(); g.moveTo(b[0] - w * .3, b[1]); g.lineTo(b[0] - w * .15, b[1] - h * .48); g.moveTo(b[0] + w * .3, b[1]); g.lineTo(b[0] + w * .15, b[1] - h * .48); g.stroke();
  g.fillStyle = col; g.fillRect(b[0] - w / 2, b[1] - h * .82, w, h * .38);
  g.strokeStyle = col; g.beginPath(); g.moveTo(b[0] - w * .45, b[1] - h * .78); g.lineTo(b[0] - w * .75, b[1] - h * .5); g.moveTo(b[0] + w * .45, b[1] - h * .78); g.lineTo(b[0] + w * .75, b[1] - h * .5); g.stroke();
  g.fillStyle = '#e6b48a'; g.beginPath(); g.arc(b[0], b[1] - h * .9, w * .38, 0, 6.3); g.fill();
  g.fillStyle = col2 || col; g.fillRect(b[0] - w * .42, b[1] - h * 1.0, w * .84, h * .09);
  if (opt.label && h > 10) { g.fillStyle = '#fff'; g.font = 'bold 10px sans-serif'; g.textAlign = 'center'; g.fillText(opt.label, b[0], t[1] - 4); }
  g.restore();
}

function drawPitcher(c, tm, P, ph) {
  const m = P.hand === 'L' ? 1 : -1; // 포수 시점에서 던지는 팔 쪽 (우투 = 화면 왼쪽)
  const x = 0.1 * m, b = prj(c, [x, 18.44, 0.25]), t = prj(c, [x, 18.44, 2.1]); if (!b || !t) return;
  const h = b[1] - t[1], w = h * 0.26, ox = b[0], oy = b[1];
  const P2 = (dx, dy) => [ox + dx * w * m, oy - dy * h];
  let knee = 0, lean = 0, arm = 0;
  if (ph < 0.5) knee = Math.sin(ph / 0.5 * Math.PI / 2);
  else if (ph < 0.85) { knee = 1 - (ph - 0.5) / 0.35; lean = (ph - 0.5) / 0.35; arm = (ph - 0.5) / 0.35; }
  else if (ph < 1.0) { lean = 1; arm = 1 + (ph - 0.85) / 0.15; }
  else { lean = Math.max(0, 1 - (ph - 1) * 2); arm = 2 + Math.min(1, (ph - 1) * 3); }
  const hipY = 0.5 - lean * 0.06, shY = 0.8 - lean * 0.1;
  g.save(); g.lineCap = 'round';
  g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(ox, oy, w, w * 0.25, 0, 0, 6.3); g.fill();
  g.strokeStyle = '#ececec'; g.lineWidth = Math.max(1.5, w * .42);
  const hp = P2(0, hipY), f1 = P2(-0.35, 0), k2 = P2(0.45, hipY - 0.18 + knee * 0.25), f2 = P2(0.5 + lean * 0.4, knee * 0.22);
  g.beginPath(); g.moveTo(...f1); g.lineTo(...hp); g.moveTo(...hp); g.lineTo(...k2); g.lineTo(...f2); g.stroke();
  const sh = P2(0, shY); g.fillStyle = tm.c1; g.beginPath(); g.moveTo(hp[0] - w * .5, hp[1]); g.lineTo(hp[0] + w * .5, hp[1]); g.lineTo(sh[0] + w * .55, sh[1]); g.lineTo(sh[0] - w * .55, sh[1]); g.closePath(); g.fill();
  g.strokeStyle = tm.c1; g.lineWidth = Math.max(1.5, w * .36);
  // 글러브 팔
  const gl = arm < 1 ? P2(0.15 + arm * 0.4, shY - 0.1 + arm * 0.05) : P2(0.75, shY - 0.15 - (arm - 1) * 0.15);
  g.beginPath(); g.moveTo(...P2(0.45, shY - 0.02)); g.lineTo(...gl); g.stroke(); g.fillStyle = '#6b3d1e'; g.beginPath(); g.arc(gl[0], gl[1], w * .3, 0, 6.3); g.fill();
  // 투구 팔
  let hand;
  if (arm < 1) hand = arm < 0.01 ? P2(0.1, shY - 0.12) : P2(-0.2 - arm * 0.7, shY - 0.1 + arm * 0.3);
  else if (arm < 2) { const a = (arm - 1); hand = P2(-0.9 + a * 0.9, shY + 0.25 - a * 0.05); }
  else { const a = arm - 2; hand = P2(0.1 + a * 0.6, shY - 0.1 - a * 0.35); }
  g.beginPath(); g.moveTo(...P2(-0.45, shY - 0.02)); g.lineTo(...hand); g.stroke();
  g.fillStyle = '#e6b48a'; g.beginPath(); g.arc(...P2(0, shY + 0.11), w * .38, 0, 6.3); g.fill();
  g.fillStyle = tm.c2; g.fillRect(...P2(-0.45, shY + 0.21), w * .9, h * .05);
  g.restore();
}

function drawBall(c, p, r0) {
  const sh = prj(c, [p[0], p[1], 0]), q = prj(c, p); if (!q) return;
  const r = Math.max(r0 || 1.8, c.F * PH.R / q[2]);
  if (sh && p[2] < 40) { g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(sh[0], sh[1], r * 1.1, r * 0.35, 0, 0, 6.3); g.fill(); }
  const gr = g.createRadialGradient(q[0] - r * .35, q[1] - r * .35, r * .1, q[0], q[1], r);
  gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#c9c9c9'); g.fillStyle = gr; g.beginPath(); g.arc(q[0], q[1], r, 0, 6.3); g.fill();
  return q;
}

// ================= 게임 객체 =================
const G = {
  mode: null, st: null, teams: null, mySide: 0, diff: 1, phase: 'idle', pt: 0, pitch: null, swing: null, cpuSw: null,
  sel: null, aim: [0, 0.76], cur: [0, 0.76], gauge: null, guess: null, outcome: null, ev: null, play: null, playOff: 0,
  marks: [], lastPitch: null, labTrail: [], camF: [0, 40], qPitch: null, pendRes: null, paused: false, showChart: false, bp: null, fx: [], lastAb: -1, lastHalf: 0, waitT: 0
};
const WIND = 0.95;
const off = () => G.st.half, defn = () => 1 - G.st.half;
const curBatter = () => G.teams[off()].bats[G.st.ord[off()]];
const curPitcher = () => G.teams[defn()].pits[G.st.pit[defn()]];
const curPC = () => G.st.pc[defn()][G.st.pit[defn()]];
function roles() {
  if (G.auto) return { p: 'cpu', b: 'cpu' };
  if (G.mode === 'lab') return { p: 'me', b: 'none' };
  if (G.mode === 'bp') return { p: 'cpu', b: 'me' };
  const other = G.mode === 'online' ? 'remote' : 'cpu';
  return G.mySide === off() ? { p: other, b: 'me' } : { p: 'me', b: other };
}

function pitchCam() {
  const F = 2.75 * Math.min(W, H * 0.6);
  return mkCam([0, -3.8, 1.6], [0, 12, 0.95], F, W / 2, H * 0.38);
}
function unproj(c, sx, sy) { // y=0 평면
  const X = (sx - c.cx) / c.F, Y = -(sy - c.cy) / c.F;
  const d = [c.r[0] * X + c.u[0] * Y + c.f[0], c.r[1] * X + c.u[1] * Y + c.f[1], c.r[2] * X + c.u[2] * Y + c.f[2]];
  const t = -c.eye[1] / d[1]; return [c.eye[0] + d[0] * t, c.eye[2] + d[2] * t];
}

// ---------- 투구 시작 ----------
function startPitch(pd) {
  G.pitch = T.runPitch(pd); G.pitch.seq = G.st.seq; G.swing = null; G.cpuSw = null; G.outcome = null; G.ev = null; G.pendResUsed = false;
  G.phase = 'windup'; G.pt = 0; G.gauge = null;
  if (roles().b === 'cpu') planCpuSwing();
  setBanner(null); renderControls(); if (G.mode !== 'lab') $('pinfo').classList.add('hide');
}
function planCpuSwing() {
  const pr = G.pitch, st = G.st, b = curBatter(), P = curPitcher(), dm = [1.55, 1.0, 0.72][G.diff];
  const mv = Math.abs(pr.hb) + Math.abs(pr.ivb - 0.3);
  const sp = (0.016 + (100 - b.eye) * 0.00045) * (1 + mv * 1.1) * dm;
  const px = pr.cross.x + gauss() * sp, pz = pr.cross.z + gauss() * sp;
  const zs = Math.abs(px) < PH.ZX + PH.R + 0.02 && pz > PH.ZB - 0.04 && pz < PH.ZT + 0.04;
  let prob = zs ? [0.6, 0.72, 0.9][st.s] : (0.15 + (st.s === 2 ? 0.17 : 0)) * (1.35 - b.eye / 100) * dm;
  const far = Math.max(Math.abs(px) - PH.ZX - PH.R, PH.ZB - pz, pz - PH.ZT, 0); if (!zs && far > 0.1) prob *= 0.35;
  if (st.b === 3 && st.s < 2) prob = zs ? 0.55 : 0.04;
  if (st.b === 0 && st.s === 0) prob *= 0.75;
  if (Math.random() > prob) return;
  const fooled = Math.max(0, (P.velo - pr.speed) / P.velo) * 0.33 * (1 - b.eye / 160);
  const ts = pr.cross.t - PH.SWING_T - fooled * (Math.random() < 0.55 ? 1 : 0.3) + gauss() * 0.024 * dm;
  const sc = (0.012 + (100 - b.con) * 0.00025) * dm;
  G.cpuSw = { ts: ts, cx: px + gauss() * sc, cz: pz + gauss() * sc };
}
function cpuPitch() {
  const st = G.st, P = curPitcher(), ps = P.ps;
  const w = ps.map(p => { let x = p.g / 60; const fam = PT[p.c].fam; if (st.b > st.s && fam === 'F') x *= 1.8; if (st.s === 2 && fam !== 'F') x *= 1.6; return x; });
  const code = pickW(ps.map(p => p.c), w), fam = PT[code].fam, r = Math.random();
  let tx, tz;
  const edgeX = () => (Math.random() < 0.5 ? -1 : 1) * (0.14 + Math.random() * 0.13), edgeZ = () => Math.random() < 0.5 ? 0.48 + Math.random() * 0.12 : 0.92 + Math.random() * 0.12;
  if (G.mode === 'bp') { tx = (Math.random() - 0.5) * 0.5; tz = 0.5 + Math.random() * 0.55; }
  else if (st.b === 3 && st.s < 2) { tx = gauss() * 0.1; tz = 0.76 + gauss() * 0.12; }
  else if (st.s === 2 && r < 0.45) { if (fam === 'F') { tx = gauss() * 0.15; tz = 1.12 + Math.random() * 0.15; } else { tx = (Math.random() - 0.5) * 0.45; tz = 0.28 + Math.random() * 0.17; } }
  else if (r < 0.62) { if (Math.random() < 0.5) { tx = edgeX(); tz = 0.52 + Math.random() * 0.45; } else { tx = (Math.random() - .5) * 0.4; tz = edgeZ(); } }
  else { tx = gauss() * 0.12; tz = 0.76 + gauss() * 0.14; }
  const qd = [[.1, .35, .4, .15], [.18, .42, .32, .08], [.3, .45, .22, .03]][G.mode === 'bp' ? 1 : G.diff];
  return T.makePitch(P, code, [tx, tz], pickW(['P', 'G', 'N', 'B'], qd), curPC());
}
function cpuMaybeSub() {
  const st = G.st, d = defn(), P = curPitcher();
  if (st.pit[d] < 2 && T.fatigue(curPC(), P) > 0.7) { st.pit[d]++; toast(`${G.teams[d].ab} 투수 교체 → ${curPitcher().name} (${curPitcher().role})`); renderHUD(); }
  else if (st.pit[d] === 1 && st.inn >= st.innings && Math.abs(st.score[0] - st.score[1]) <= 3 && (d === 1 ? st.score[1] >= st.score[0] : st.score[0] > st.score[1]) && st.outs === 0 && st.b === 0 && st.s === 0) { st.pit[d] = 2; toast(`${G.teams[d].ab} 마무리 투입 → ${curPitcher().name}`); renderHUD(); }
}

// ---------- 투구 판정 ----------
function localOutcome() {
  const pr = G.pitch, st = G.st, b = curBatter(), sw = G.swing;
  const gm = roles().b === 'me' && G.guess ? (G.guess === pr.code ? 1.3 : 0.88) : 1;
  if (sw) {
    const r = T.swingResult(pr, sw, b, gm);
    const o = { type: r.type === 'miss' ? 'swstr' : r.type, sw: { ts: sw.ts, cx: sw.cx, cz: sw.cz, dT: r.dT, perfect: !!r.perfect, ev: r.ev, la: r.la }, gm: gm, code: pr.code };
    if (r.type === 'foul' && st.s === 2 && r.tip && Math.random() < 0.22) o.tipK = true;
    if (r.type === 'foul' && !r.tip) {
      const fev = r.ev || 105 + Math.random() * 40, fla = r.la != null ? r.la : 10 + Math.random() * 55, fsp = r.spray != null && Math.abs(r.spray) > 45 ? r.spray : (Math.random() < .5 ? -1 : 1) * (50 + Math.random() * 35);
      o.foulPath = T.simBatted(fev, fla, fsp).pts.slice(0, 40).map(p => p.map(v => Math.round(v * 100) / 100));
    }
    if (r.type === 'inplay') { o.play = T.resolvePlay(r, st, b, st.ord[st.half], i => G.teams[st.half].bats[i].spd); o.play.pb = st.bases.slice(); }
    return o;
  }
  if (T.isHBP(pr.cross, b.hand)) return { type: 'hbp', gm: gm, code: pr.code };
  return { type: T.isStrike(pr.cross) ? 'strike' : 'ball', gm: gm, code: pr.code };
}
function finishPitch(o, remoteSt) {
  G.outcome = o;
  const st = G.st, r = roles();
  G.playOff = st.half;
  const batter = curBatter(), pitcherTeam = G.teams[defn()];
  G.marks.push({ x: G.pitch.cross.x, z: G.pitch.cross.z, c: PT[G.pitch.code].c, n: G.marks.length + 1 });
  G.lastPitch = G.pitch; if (G.mode === 'lab') { G.labTrail.push(G.pitch); if (G.labTrail.length > 6) G.labTrail.shift(); }
  let ev;
  if (G.mode === 'lab') {
    ev = { big: T.isStrike(G.pitch.cross) ? '스트라이크' : '볼', col: T.isStrike(G.pitch.cross) ? '#ffd23f' : '#3fe07a', sub: '' };
  } else {
    const snapshot = JSON.parse(JSON.stringify(st));
    ev = applyOutcome(st, o);
    if (G.mode === 'bp') { // 배팅연습: 상황 초기화
      st.outs = 0; st.bases = [-1, -1, -1]; st.half = 0; st.inn = 1; st.over = false; st.score = [0, 0]; st.line = [[], []]; st.pc = [[0, 0, 0], [0, 0, 0]];
      const B = G.bp; if (o.sw) B.sw++; if (o.type === 'inplay') { B.ip++; if (HITS.includes(o.play.res)) B.h++; if (o.play.res === 'HR') B.hr++; B.maxD = Math.max(B.maxD, o.play.dist); B.maxEV = Math.max(B.maxEV, o.play.ev); }
    }
    if (remoteSt) { G.st = remoteSt; }
    else if (G.mode === 'online' && r.b === 'me') { NET.send('res', { seq: snapshot.seq, out: o, st: G.st }); }
  }
  // 타이밍/타구 정보
  if (o.sw && o.type !== 'swstr') {
    const d = o.sw.dT, tt = Math.abs(d) < 0.015 ? '완벽한 타이밍' : d < 0 ? `빠름 ${Math.round(-d * 1000)}ms` : `늦음 ${Math.round(d * 1000)}ms`;
    ev.sub = (ev.sub ? ev.sub + ' · ' : '') + tt;
  } else if (o.sw && o.type === 'swstr') {
    const d = o.sw.dT; ev.sub = (ev.sub ? ev.sub + ' · ' : '') + (Math.abs(d) > 0.096 ? (d < 0 ? '너무 빨라요' : '너무 늦어요') : '공이 커서를 빗나감');
  }
  if (o.gm > 1 && G.mode !== 'lab') ev.sub = (ev.sub ? ev.sub + ' · ' : '') + '🎯 예측 적중!';
  G.ev = ev;
  if (o.type === 'inplay') {
    const pl = o.play; SND.crack(pl.ev > 150 ? 1 : 0.7);
    G.play = pl; G.playTeams = [G.teams[G.playOff], G.teams[1 - G.playOff]];
    setupPlay(pl); G.phase = 'play'; G.pt = 0; G.camF = [0, 30];
  } else {
    if (o.type === 'foul') SND.crack(0.45); else if (o.type === 'swstr') { SND.whiff(); SND.mitt(); } else SND.mitt();
    G.phase = 'after'; G.pt = 0; G.afterDur = ev.abEnd || ev.halfEnd ? 1.7 : 1.15;
    setBanner(ev.big, ev.sub, ev.col);
  }
  renderHUD(); renderPinfo(); renderControls();
  if (G.mode === 'lab' || G.showChart) drawChart();
}
function setupPlay(pl) {
  const thrBase = pl.throwTo >= 0 ? T.BASES[pl.throwTo] : null;
  pl.thrDur = thrBase && pl.fP ? Math.hypot(pl.fP[0] - thrBase[0], pl.fP[1] - thrBase[1]) / 29 : 0;
  const tEnd = pl.pts[pl.pts.length - 1][0];
  let fe = pl.hr ? tEnd + 0.6 : pl.caught ? pl.fT + 1.0 : pl.throwT + pl.thrDur + 0.5;
  let re = 0; const tm = G.playTeams[0];
  for (const m of pl.moves) { m.dur = legTime(m, tm); re = Math.max(re, m.st + m.dur); }
  pl.dur = clamp(Math.max(fe, Math.min(re, pl.hr ? 7 : 12)) + 0.6, 2.6, 10);
}
function legTime(m, tm) {
  const spd = tm.bats[m.r] ? tm.bats[m.r].spd : 60, tgt = m.t === -1 ? m.f + 1 : m.t, legs = tgt - m.f;
  let t = 0; for (let k = 0; k < legs; k++) t += (m.f + k === 0 ? T.runnerT(spd) : T.baseT(spd));
  if (G.play && G.play.hr) t *= 0.42;
  m.st = m.tag != null ? m.tag : m.f === 0 ? 0.25 : 0.1; m.legs = legs;
  return m.t === -1 ? t * 0.8 : t;
}
function runnerPos(m, t) {
  const p = clamp((t - m.st) / m.dur, 0, 1) * (m.t === -1 ? 0.8 : 1) * m.legs, k = Math.min(Math.floor(p), m.legs - 1), f = p - k;
  const a = T.BASES[m.f + k], b = T.BASES[m.f + k + 1]; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}

// ---------- 다음 단계 ----------
function nextStep() {
  const st = G.st;
  if (G.mode !== 'lab' && G.mode !== 'bp' && st.over) { gameOver(); return; }
  if (st.ab !== G.lastAb) { G.marks = []; G.lastAb = st.ab; }
  if (G.mode !== 'lab' && G.mode !== 'bp' && st.half !== G.lastHalf) {
    G.lastHalf = st.half; G.phase = 'change'; G.pt = 0;
    const tm = G.teams[st.half], r = roles();
    setBanner('공수 교대', `${st.inn}회${st.half ? '말' : '초'} ${tm.name} 공격` + (r.b === 'me' ? ' — 내 공격!' : r.p === 'me' ? ' — 내 수비(투구)!' : ''), '#fff');
    renderHUD(); renderControls(); return;
  }
  toSelect();
}
function toSelect() {
  G.phase = 'select'; G.pt = 0; G.cpuPlan = null; setBanner(null);
  const r = roles();
  if (r.p === 'cpu' && G.mode !== 'bp') cpuMaybeSub();
  if (r.p === 'me' && (!G.sel || !curPitcher().ps.find(p => p.c === G.sel))) G.sel = curPitcher().ps[0].c;
  renderHUD(); renderControls();
}

// ================= 업데이트 =================
function update(dt) {
  if (G.paused || G.phase === 'idle' || G.phase === 'over') return;
  G.pt += dt;
  const r = roles();
  for (const f of G.fx) { f.t += dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 160 * dt; } G.fx = G.fx.filter(f => f.t < f.life);
  switch (G.phase) {
    case 'select':
      if (r.p === 'cpu') { if (!G.cpuPlan) G.cpuPlan = 0.9 + Math.random() * 0.9; if (G.pt > G.cpuPlan) startPitch(cpuPitch()); }
      else if (r.p === 'remote' && G.qPitch) { const m = G.qPitch; G.qPitch = null; startPitch(m.pd); }
      break;
    case 'gauge':
      G.gauge.t += dt; if (G.gauge.t >= G.gauge.T) releaseGauge(true);
      break;
    case 'windup':
      if (G.pt >= WIND) { G.phase = 'flight'; G.pt = 0; }
      break;
    case 'flight': {
      const pr = G.pitch;
      if (G.cpuSw && !G.swing && G.pt >= G.cpuSw.ts) G.swing = Object.assign({}, G.cpuSw, { at: G.pt });
      if (G.pt >= pr.cross.t + 0.035 && !G.outcome) {
        if (r.b === 'remote') {
          const m = G.pendRes;
          if (m && m.seq === pr.seq) { G.pendRes = null; if (m.out.sw) G.swing = Object.assign({}, m.out.sw, { at: m.out.sw.ts }); finishPitch(m.out, m.st); $('netw').classList.add('hide'); }
          else if (G.pt > 15) $('netw').classList.remove('hide');
        } else finishPitch(localOutcome());
      }
      break;
    }
    case 'after':
      if (G.pt >= G.afterDur) nextStep();
      break;
    case 'play':
      if (G.pt >= G.play.dur && !G.play.done) {
        G.play.done = true; const ev = G.ev; setBanner(ev.big, ev.sub, ev.col);
        if (G.play.hr || G.play.res === 'IHR') { SND.cheer(); fireworks(); }
        G.phase = 'after'; G.pt = 0; G.afterDur = 1.9;
      }
      break;
    case 'change':
      if (G.pt >= 2.2) toSelect();
      break;
  }
  // 키보드 커서 이동
  if (r.b === 'me' && (KEYS.ArrowLeft || KEYS.ArrowRight || KEYS.ArrowUp || KEYS.ArrowDown)) {
    const s = 0.9 * dt; G.cur[0] += ((KEYS.ArrowRight ? 1 : 0) - (KEYS.ArrowLeft ? 1 : 0)) * s; G.cur[1] += ((KEYS.ArrowUp ? 1 : 0) - (KEYS.ArrowDown ? 1 : 0)) * s; clampCur();
  }
  if (G.mode === 'online' && NET.started) { const idle = performance.now() - NET.last; $('netw').classList.toggle('hide', !(idle > 20000)); }
}
function fireworks() { for (let k = 0; k < 4; k++) { const x = W * (0.2 + Math.random() * 0.6), y = H * (0.15 + Math.random() * 0.25), col = ['#ffd23f', '#ff5a5a', '#4fc8ff', '#6af0a8'][k]; for (let i = 0; i < 36; i++) { const a = Math.random() * 6.28, s = 80 + Math.random() * 160; G.fx.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, t: -k * 0.25, life: 1.6, col }); } } }

// ================= 렌더 =================
function render() {
  g.clearRect(0, 0, W, H);
  if (G.phase === 'idle' || !G.st) { idleRender(); return; }
  if (G.phase === 'play' && G.pt > 0.45) { renderField(); }
  else renderPitchView();
  for (const f of G.fx) { if (f.t < 0) continue; g.globalAlpha = Math.max(0, 1 - f.t / f.life); g.fillStyle = f.col; g.fillRect(f.x - 2, f.y - 2, 4, 4); } g.globalAlpha = 1;
}
let idleT = 0;
function idleRender() {
  idleT += 0.004; const c = mkCam([Math.sin(idleT) * 30, -40 + Math.cos(idleT) * 10, 30], [0, 45, 0], 0.9 * Math.min(W, H), W / 2, H * 0.55);
  drawWorld(c);
}
function renderPitchView() {
  const c = pitchCam(), st = G.st, r = roles(), dtm = G.teams[defn()], otm = G.teams[off()];
  drawWorld(c);
  // 야수
  const order = [7, 6, 8, 3, 5, 2, 4];
  for (const i of order) { const f = T.FLD[i]; figure(c, f[1], f[2], dtm.c1, dtm.c2); }
  // 주자
  for (let b = 0; b < 3; b++) if (st.bases[b] >= 0) { const B = T.BASES[b + 1]; figure(c, B[0] + (b === 1 ? 1.5 : b === 0 ? -1.2 : 1.2), B[1] - 0.8, otm.c1, otm.c2); }
  // 투수
  const P = curPitcher();
  let ph = 0; if (G.phase === 'windup') ph = G.pt / WIND; else if (G.phase === 'flight') ph = 1 + G.pt; else if (G.phase === 'after') ph = 1.6;
  drawPitcher(c, dtm, P, ph);
  // 스트라이크존
  const zc = 'rgba(255,255,255,.75)';
  const zx = PH.ZX, zb = PH.ZB, zt = PH.ZT;
  poly(c, [[-zx, 0, zb], [zx, 0, zb], [zx, 0, zt], [-zx, 0, zt]], 'rgba(255,255,255,.05)', zc, 1.6);
  g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = 1;
  for (let i = 1; i < 3; i++) { const x = -zx + zx * 2 * i / 3, z = zb + (zt - zb) * i / 3; let a = prj(c, [x, 0, zb]), b = prj(c, [x, 0, zt]); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); a = prj(c, [-zx, 0, z]); b = prj(c, [zx, 0, z]); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
  // 지난 공 궤적
  const showTrail = (G.phase === 'select' || G.phase === 'gauge' || G.phase === 'after' || G.phase === 'change') && G.lastPitch;
  if (G.mode === 'lab') for (const lp of G.labTrail) drawTraj(c, lp, lp === G.lastPitch ? 1 : 0.35, lp === G.lastPitch);
  else if (showTrail) drawTraj(c, G.lastPitch, 0.85, G.showChart);
  // 투구 위치 마커
  for (const m of G.marks) { const p = prj(c, [m.x, 0, m.z]); if (!p) continue; const rr = Math.max(5, c.F * PH.R / p[2]); g.fillStyle = m.c; g.globalAlpha = 0.85; g.beginPath(); g.arc(p[0], p[1], rr, 0, 6.3); g.fill(); g.globalAlpha = 1; g.fillStyle = '#111'; g.font = `bold ${Math.round(rr * 1.1)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(m.n, p[0], p[1] + 1); g.textBaseline = 'alphabetic'; }
  // 공
  if (G.phase === 'flight' || (G.phase === 'play' && G.pt <= 0.45)) {
    const pr = G.pitch;
    if (G.phase === 'flight') {
      const tt = Math.min(G.pt, pr.end);
      for (let k = 7; k >= 1; k--) { const q = prj(c, T.posAt(pr.traj, Math.max(0, tt - k * 0.012))); if (!q) continue; g.fillStyle = `rgba(255,255,255,${0.12 * (1 - k / 8)})`; g.beginPath(); g.arc(q[0], q[1], Math.max(1.5, c.F * PH.R / q[2]) * (1 - k * 0.06), 0, 6.3); g.fill(); }
      const p = T.posAt(pr.traj, tt);
      if (!(G.outcome && G.outcome.type === 'foul' && G.outcome.foulPath && G.pt > pr.cross.t)) drawBall(c, p);
    } else {
      const p = T.posAt(G.play.pts, G.pt); drawBall(c, p, 2.5);
    }
  }
  if (G.phase === 'after' && G.outcome && G.outcome.type === 'foul' && G.outcome.foulPath && G.pt < 1) { const p = T.posAt(G.outcome.foulPath, G.pt); drawBall(c, p, 2); }
  // 미트 (포구)
  if ((G.phase === 'after' || G.phase === 'flight' && G.pt > G.pitch.cross.t) && G.lastPitch && G.outcome && (G.outcome.type !== 'inplay' && G.outcome.type !== 'foul' || G.outcome.tipK)) {
    const lp = G.lastPitch, q = prj(c, [lp.cross.x, -0.5, Math.max(0.15, lp.cross.z - 0.04)]); if (q) { const rr = c.F * 0.085 / q[2]; g.fillStyle = 'rgba(110,60,25,.85)'; g.beginPath(); g.arc(q[0], q[1], rr, 0, 6.3); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(q[0], q[1], Math.max(2, c.F * PH.R / q[2]), 0, 6.3); g.fill(); }
  }
  // 타자 (화면 공간 실루엣)
  if (r.b !== 'none') drawBatter(c, curBatter(), otm);
  // 타격 커서
  if (r.b === 'me' && (G.phase === 'select' || G.phase === 'windup' || G.phase === 'flight' || G.phase === 'gauge')) {
    const b = curBatter(), gmul = G.guess ? 1.08 : 1, R = T.cursorR(b) * gmul;
    const ccx = G.swing ? G.swing.cx : G.cur[0], ccz = G.swing ? G.swing.cz : G.cur[1];
    const p = prj(c, [ccx, 0, ccz]), rp = c.F * R / p[2];
    g.lineWidth = 2.5; g.strokeStyle = G.swing ? 'rgba(255,210,63,.95)' : 'rgba(255,255,255,.9)'; g.fillStyle = G.swing ? 'rgba(255,210,63,.18)' : 'rgba(80,170,255,.12)';
    g.beginPath(); g.arc(p[0], p[1], rp, 0, 6.3); g.fill(); g.stroke();
    g.lineWidth = 1; g.strokeStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(p[0], p[1], rp * 0.45, 0, 6.3); g.stroke();
    g.beginPath(); g.moveTo(p[0] - rp, p[1]); g.lineTo(p[0] + rp, p[1]); g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(p[0], p[1] + rp * 0.28, 2.2, 0, 6.3); g.fill();
  }
  // 조준 & 게이지
  if (r.p === 'me' && (G.phase === 'select' || G.phase === 'gauge')) {
    const p = prj(c, [G.aim[0], 0, G.aim[1]]), col = PT[G.sel] ? PT[G.sel].c : '#fff';
    g.strokeStyle = col; g.lineWidth = 2; const s = 13;
    g.beginPath(); g.moveTo(p[0] - s, p[1]); g.lineTo(p[0] - 4, p[1]); g.moveTo(p[0] + 4, p[1]); g.lineTo(p[0] + s, p[1]); g.moveTo(p[0], p[1] - s); g.lineTo(p[0], p[1] - 4); g.moveTo(p[0], p[1] + 4); g.lineTo(p[0], p[1] + s); g.stroke();
    g.beginPath(); g.arc(p[0], p[1], c.F * PH.R / p[2], 0, 6.3); g.stroke();
    if (G.phase === 'gauge') {
      const R0 = 24, k = G.gauge.t / G.gauge.T, rr = R0 * (3.3 - 3.0 * k);
      g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(p[0], p[1], R0, 0, 6.3); g.stroke();
      g.fillStyle = 'rgba(63,224,122,.18)'; g.beginPath(); g.arc(p[0], p[1], R0 * 1.12, 0, 6.3); g.arc(p[0], p[1], R0 * 0.88, 0, 6.3, true); g.fill();
      const acc = Math.abs(rr / R0 - 1); g.strokeStyle = acc < 0.12 ? '#3fe07a' : acc < 0.3 ? '#ffd23f' : '#ff5a5a'; g.lineWidth = 4; g.beginPath(); g.arc(p[0], p[1], Math.max(1, rr), 0, 6.3); g.stroke();
    }
    if (G.gaugeRes && G.pt < 0.9 && G.phase !== 'gauge') {}
  }
  if (G.gaugeTxt && performance.now() - G.gaugeTxt.at < 900) { const gt = G.gaugeTxt; g.font = '900 26px sans-serif'; g.textAlign = 'center'; g.fillStyle = gt.col; g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 4; g.strokeText(gt.t, W / 2, H * 0.3); g.fillText(gt.t, W / 2, H * 0.3); }
  // 대기 메시지
  if (G.phase === 'select' && r.p === 'remote') waitText('상대 투수가 구종을 고르는 중…');
  if (G.phase === 'flight' && r.b === 'remote' && G.pt > G.pitch.cross.t + 0.4 && !G.outcome) waitText('상대 타자 결과 기다리는 중…');
}
function waitText(t) { g.font = 'bold 14px sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(0,0,0,.55)'; const w = g.measureText(t).width + 24; g.fillRect(W / 2 - w / 2, H * 0.2 - 18, w, 28); g.fillStyle = '#fff'; g.fillText(t, W / 2, H * 0.2); }
function drawTraj(c, lp, alpha, withNs) {
  const col = PT[lp.code].c;
  g.save(); g.globalAlpha = alpha; g.strokeStyle = col; g.lineWidth = 2.2; g.beginPath(); let st = false;
  for (let i = 0; i < lp.traj.length; i += 2) { const p = lp.traj[i]; if (p[2] < -0.4) break; const q = prj(c, [p[1], p[2], p[3]]); if (!q) continue; st ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); st = true; }
  g.stroke();
  if (withNs) {
    g.setLineDash([5, 5]); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1.4; g.beginPath(); st = false;
    for (let i = 0; i < lp.nsPts.length; i += 2) { const p = lp.nsPts[i]; if (p[2] < 0) break; const q = prj(c, [p[1], p[2], p[3]]); if (!q) continue; st ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); st = true; }
    g.stroke(); g.setLineDash([]);
  }
  g.restore();
}
function drawBatter(c, b, tm) {
  const side = b.hand === 'L' ? 1 : -1;
  const zb = prj(c, [0, 0, PH.ZB]), zt = prj(c, [0, 0, PH.ZT]), ze = prj(c, [PH.ZX, 0, PH.ZB]);
  const zh = zb[1] - zt[1], zw = ze[0] - zb[0];
  const h = zh * 2.0, w = h * 0.27;
  let bx = zb[0] + side * (zw + w * 1.55), by = zb[1] + zh * 0.75;
  if (side < 0) bx = Math.max(bx, w * 0.75); else bx = Math.min(bx, W - w * 0.75);
  let sp = -1; if (G.swing && (G.phase === 'flight' || G.phase === 'after' || G.phase === 'play')) { const tSince = (G.phase === 'flight' ? G.pt : G.pitch.cross.t + 0.035 + G.pt) - G.swing.ts; sp = clamp(tSince / PH.SWING_T, 0, 2.2); }
  const P = (dx, dy) => [bx + dx * w * -side, by - dy * h]; // dx>0 = 투수 반대(포수쪽) 방향
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(bx, by, w * 1.1, w * 0.22, 0, 0, 6.3); g.fill();
  const rot = sp < 0 ? 0 : Math.min(1, sp) ; // 몸통 회전
  // 다리
  g.strokeStyle = '#cfd3da'; g.lineWidth = w * 0.36;
  const hip = P(0.05 * (1 - rot), 0.5);
  g.beginPath(); g.moveTo(...P(-0.75 - rot * 0.1, 0.02)); g.lineTo(...P(-0.35, 0.27)); g.lineTo(...hip); g.stroke();
  g.beginPath(); g.moveTo(...P(0.65, 0.02)); g.lineTo(...P(0.45 - rot * 0.1, 0.27)); g.lineTo(...hip); g.stroke();
  // 몸통
  const sh = P(0.1 - rot * 0.15, 0.8);
  g.fillStyle = tm.c1; g.beginPath(); g.moveTo(hip[0] - w * 0.45, hip[1]); g.lineTo(hip[0] + w * 0.45, hip[1]); g.lineTo(sh[0] + w * (0.55 - rot * 0.15), sh[1]); g.lineTo(sh[0] - w * (0.55 - rot * 0.15), sh[1]); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,255,255,.85)'; g.font = `900 ${Math.round(w * 0.5)}px sans-serif`; g.textAlign = 'center'; g.fillText(String(G.st ? G.st.ord[off()] + 1 : ''), (hip[0] + sh[0]) / 2, (hip[1] + sh[1]) / 2 + w * 0.15);
  // 머리/헬멧
  const hd = P(0.08 - rot * 0.1, 0.92);
  g.fillStyle = '#d9a07a'; g.beginPath(); g.arc(hd[0], hd[1], w * 0.3, 0, 6.3); g.fill();
  g.fillStyle = tm.c2 === '#2a2a2a' || tm.c2 === '#222' ? tm.c2 : '#151a26'; g.beginPath(); g.arc(hd[0], hd[1] - w * 0.06, w * 0.34, Math.PI, 0); g.fill(); g.fillRect(hd[0] - w * 0.36, hd[1] - w * 0.08, w * 0.72, w * 0.1);
  // 팔 + 배트
  let ang, hand;
  const a0 = side < 0 ? -2.1 : -1.04, a1 = side < 0 ? 0.1 : Math.PI - 0.1;
  if (sp < 0) { ang = a0; hand = P(0.55, 0.86); }
  else { const k = Math.min(sp, 1), e = k * k * (3 - 2 * k); ang = a0 + (a1 - a0) * e; if (sp > 1) ang = a1 + (side < 0 ? 1 : -1) * Math.min(1.7, (sp - 1) * 2.2); hand = P(0.55 - e * 0.9, 0.86 - e * 0.18); }
  g.strokeStyle = tm.c1; g.lineWidth = w * 0.24; g.beginPath(); g.moveTo(...P(0.3, 0.78)); g.lineTo(...hand); g.moveTo(...P(-0.25, 0.78)); g.lineTo(...hand); g.stroke();
  const L = h * 0.5;
  g.strokeStyle = '#c98f4e'; g.lineWidth = Math.max(4, w * 0.16); g.beginPath(); g.moveTo(hand[0], hand[1]); g.lineTo(hand[0] + Math.cos(ang) * L, hand[1] + Math.sin(ang) * L); g.stroke();
  g.strokeStyle = '#e2b073'; g.lineWidth = Math.max(5, w * 0.2); g.beginPath(); g.moveTo(hand[0] + Math.cos(ang) * L * 0.55, hand[1] + Math.sin(ang) * L * 0.55); g.lineTo(hand[0] + Math.cos(ang) * L, hand[1] + Math.sin(ang) * L); g.stroke();
  g.fillStyle = '#222'; g.beginPath(); g.arc(hand[0], hand[1], w * 0.13, 0, 6.3); g.fill();
  g.restore();
}

function renderField() {
  const pl = G.play, t = G.pt, ft = G.playTeams, dtm = ft[1], otm = ft[0];
  // 공 위치
  let ball, held = false;
  const tEnd = pl.pts[pl.pts.length - 1][0];
  const thrB = pl.throwTo >= 0 ? T.BASES[pl.throwTo] : null;
  if (pl.hr || pl.fielder < 0 || t < pl.fT) ball = T.posAt(pl.pts, Math.min(t, tEnd));
  else if (t < pl.throwT || !thrB) { ball = [pl.fP[0], pl.fP[1], 1.2]; held = true; }
  else { const k = clamp((t - pl.throwT) / Math.max(0.1, pl.thrDur), 0, 1); ball = [pl.fP[0] + (thrB[0] - pl.fP[0]) * k, pl.fP[1] + (thrB[1] - pl.fP[1]) * k, 1.5 + Math.sin(k * Math.PI) * 2.5]; }
  if (pl.caught && t >= pl.fT && t < pl.fT + 0.6) { ball = [pl.fP[0], pl.fP[1], 1.4]; held = true; }
  if (pl.caught && t >= pl.fT + 0.6) { const k = clamp((t - pl.fT - 0.6) / 1.2, 0, 1); ball = [pl.fP[0] + (0 - pl.fP[0]) * k, pl.fP[1] + (36 - pl.fP[1]) * k, 1.5 + Math.sin(k * Math.PI) * 4]; }
  // 카메라
  const k = 1 - Math.exp(-2.2 / 60);
  G.camF[0] += (ball[0] - G.camF[0]) * k * 1.6; G.camF[1] += (clamp(ball[1], 5, 120) - G.camF[1]) * k * 1.6;
  const fx = G.camF[0] * 0.6, fy = G.camF[1] * 0.62 + 12;
  const F = 1.45 * Math.min(W, H * 0.9);
  const c = mkCam([fx * 0.55, fy - 50, 30], [fx, fy, 0], F, W / 2, H * 0.55);
  drawWorld(c);
  // 낙구 지점
  if (pl.pts.length && !pl.hr) { const lp = pl.pts.find(p => p[0] > 0.2 && p[3] <= 0.02); if (lp && t > lp[0] - 1.5) { poly(c, circ(lp[1], lp[2], 1.2, 14, 0.02), 'rgba(255,210,63,.35)'); } }
  // 야수
  const items = [];
  for (let i = 0; i < 9; i++) {
    const f = T.FLD[i]; let x = f[1], y = f[2];
    if (i === pl.fielder && pl.fP) { const k2 = clamp((t - f[4]) / Math.max(0.05, pl.fT - f[4]), 0, 1); x = f[1] + (pl.fP[0] - f[1]) * k2; y = f[2] + (pl.fP[1] - f[2]) * k2; if (held) { x = pl.fP[0]; y = pl.fP[1]; } }
    else if (i >= 6 || pl.hr) { const bg = T.posAt(pl.pts, Math.min(t, tEnd)); const k2 = Math.min(0.45, Math.max(0, t - 0.5) * 0.12); x += (bg[0] - x) * k2; y += (bg[1] - y) * k2; }
    else if (pl.throwTo >= 1 && pl.throwTo <= 3 && (i === [0, 2, 3, 4][pl.throwTo] || (pl.throwTo === 2 && i === (pl.fielder === 5 ? 3 : 5)))) { const B = T.BASES[pl.throwTo], k2 = clamp(t / 1.4, 0, 1); x += (B[0] - x) * k2; y += (B[1] - y) * k2; }
    items.push({ x, y, col: dtm.c1, c2: dtm.c2 });
  }
  // 주자
  const moving = new Set(pl.moves.map(m => m.f));
  for (let b = 0; b < 3; b++) if (pl.pb && pl.pb[b] >= 0 && !moving.has(b + 1)) { const B = T.BASES[b + 1]; items.push({ x: B[0], y: B[1], col: otm.c1, c2: otm.c2 }); }
  for (const m of pl.moves) {
    if (m.t === -1 && t > m.st + m.dur + 0.4) continue;
    if (m.t === 4 && t > m.st + m.dur + 0.3) continue;
    const p = runnerPos(m, t); items.push({ x: p[0], y: p[1], col: otm.c1, c2: otm.c2, out: m.t === -1 && t > m.st + m.dur * 0.9 });
  }
  items.sort((a, b) => Math.hypot(b.x - c.eye[0], b.y - c.eye[1]) - Math.hypot(a.x - c.eye[0], a.y - c.eye[1]));
  for (const it of items) { figure(c, it.x, it.y, it.col, it.c2, { label: it.out ? 'OUT' : null, sc: 1.7 }); }
  drawBall(c, ball, 3.2);
  // 정보
  g.font = 'bold 13px sans-serif'; g.textAlign = 'left'; g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(8, H - 200, 175, 54);
  g.fillStyle = '#fff'; g.fillText(`타구속도 ${Math.round(pl.ev)} km/h`, 16, H - 180); g.fillText(`발사각 ${Math.round(pl.la)}° · 비거리 ${pl.dist}m`, 16, H - 160);
}

// ================= HUD =================
function setBanner(big, sub, col) {
  const b = $('ban'); if (!big) { b.classList.add('hide'); return; }
  b.classList.remove('hide'); const bb = $('banBig'); bb.textContent = big; bb.style.color = col || '#fff';
  bb.style.animation = 'none'; void bb.offsetWidth; bb.style.animation = ''; $('banSub').textContent = sub || '';
}
function renderHUD() {
  const st = G.st; if (!st) return;
  const lab = G.mode === 'lab', bp = G.mode === 'bp';
  $('sb').classList.toggle('hide', lab || bp);
  for (let i = 0; i < 2; i++) { $('n' + i).textContent = G.teams[i].ab; $('c' + i).style.background = G.teams[i].c1; $('s' + i).textContent = st.score[i]; }
  $('inn').textContent = st.inn + '회' + (st.half ? '말' : '초');
  document.querySelectorAll('#sb .b').forEach((e, i) => e.classList.toggle('on', i < st.b));
  document.querySelectorAll('#sb .s').forEach((e, i) => e.classList.toggle('on', i < st.s));
  document.querySelectorAll('#sb .o').forEach((e, i) => e.classList.toggle('on', i < st.outs));
  for (let i = 0; i < 3; i++) $('b' + (i + 1)).classList.toggle('on', st.bases[i] >= 0);
  const P = curPitcher(), pc = curPC(), fat = T.fatigue(pc, P);
  if (lab) { $('iBat').innerHTML = `<div class="nm">🔬 투구 연구소</div><div class="st">아무 구종이나 던져보세요</div>`; }
  else if (bp) { const B = G.bp, b = curBatter(); $('iBat').innerHTML = `<div class="nm">${b.name} <small>${b.hand === 'L' ? '좌타' : '우타'}</small></div><div class="st">컨${b.con} 파${b.pow} 선${b.eye}</div><div class="st">스윙 ${B.sw} · 안타 ${B.h} · 홈런 ${B.hr}<br>최장 ${B.maxD}m · 최고 ${Math.round(B.maxEV)}km/h</div>`; }
  else { const b = curBatter(); $('iBat').innerHTML = `<div class="nm">${st.ord[off()] + 1}번 ${b.name}${b.star ? ' ⭐' : ''}</div><div class="st">${b.hand === 'L' ? '좌타' : '우타'} · ${POSK[b.pos]}</div><div class="st">컨${b.con} 파${b.pow} 선${b.eye} 주${b.spd}</div>`; }
  $('iPit').innerHTML = `<div class="nm">${P.name} <small>${P.hand === 'L' ? '좌투' : '우투'}·${P.role}</small></div><div class="st">${lab ? '최고 ' + P.velo + 'km/h · 제구 ' + P.ctl : '투구수 ' + pc + ' · 제구 ' + P.ctl}</div><div class="st">${P.ps.map(p => PT[p.c].s).join('/')}</div><div class="bar"><i style="width:${Math.round((1 - fat) * 100)}%;background:${fat > 0.6 ? '#ff5252' : fat > 0.25 ? '#ffd23f' : '#3fe07a'}"></i></div>`;
}
function renderPinfo() {
  const lp = G.lastPitch, e = $('pinfo'); if (!lp) { e.classList.add('hide'); return; }
  const d = PT[lp.code], hb = Math.round(lp.hb * 100), ivb = Math.round(lp.ivb * 100);
  const w = Math.hypot(lp.w[0], lp.w[1], lp.w[2]), eff = w ? Math.round(Math.hypot(lp.w[0], lp.w[2]) / w * 100) : 0;
  const q = { P: 'PERFECT', G: 'GOOD', N: 'NORMAL', B: 'BAD' }[lp.q];
  const showQ = roles().p === 'me' || G.mode === 'lab';
  e.innerHTML = `<b style="color:${d.c}">${d.n}</b> ${Math.round(lp.speed)}km/h<br>${lp.rpm}rpm · 회전효율 ${eff}%<br>가로 ${hb > 0 ? '→' : hb < 0 ? '←' : ''} ${Math.abs(hb)}cm · 세로 ${ivb >= 0 ? '↑' : '↓'} ${Math.abs(ivb)}cm` + (G.mode === 'lab' ? `<br><span style="opacity:.75">홈 도달 ${lp.cross.t.toFixed(3)}초 · 종속 ${Math.round(lp.cross.v * 3.6)}km/h</span><br><span style="opacity:.75">${d.d}</span>` : '') + (showQ ? `<br><span style="opacity:.7">제구 ${q}</span>` : '');
  e.style.borderLeftColor = d.c; e.classList.remove('hide');
}
function drawChart() {
  const lp = G.lastPitch, wrap = $('chartWrap'); if (!lp || !(G.mode === 'lab' || G.showChart)) { wrap.classList.add('hide'); return; }
  wrap.classList.remove('hide');
  const cc = $('chart'), x = cc.getContext('2d'), S = Math.min(150, Math.round(W * 0.36));
  cc.style.width = S + 'px'; cc.style.height = S + 'px'; x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, 300, 300);
  const L = 18, R = 288, Y0 = 17.2, px = y => L + (Y0 - y) / Y0 * (R - L);
  const sideY = z => 128 - z / 2.3 * 110, topY = xx => 215 + xx / 0.9 * 70;
  x.fillStyle = 'rgba(255,255,255,.06)'; x.fillRect(L, 14, R - L, 116); x.fillRect(L, 145, R - L, 140);
  x.strokeStyle = 'rgba(255,255,255,.4)'; x.lineWidth = 2; x.beginPath(); x.moveTo(R, sideY(PH.ZB)); x.lineTo(R, sideY(PH.ZT)); x.moveTo(R, topY(-PH.ZX)); x.lineTo(R, topY(PH.ZX)); x.stroke();
  const pth = (pts, fy, idx, col, dash) => { x.setLineDash(dash ? [6, 6] : []); x.strokeStyle = col; x.lineWidth = dash ? 2 : 3; x.beginPath(); let s = false; for (const p of pts) { if (p[2] < 0) break; const X = px(p[2]), Yv = fy(p[idx]); s ? x.lineTo(X, Yv) : x.moveTo(X, Yv); s = true; } x.stroke(); x.setLineDash([]); };
  const col = PT[lp.code].c;
  pth(lp.nsPts, sideY, 3, 'rgba(255,255,255,.6)', true); pth(lp.traj, sideY, 3, col, false);
  pth(lp.nsPts, topY, 1, 'rgba(255,255,255,.6)', true); pth(lp.traj, topY, 1, col, false);
  x.fillStyle = 'rgba(255,255,255,.7)'; x.font = 'bold 18px sans-serif'; x.fillText('측면', L + 4, 34); x.fillText('위', L + 4, 166);
  x.font = '16px sans-serif'; x.fillText('투수', L + 2, 296); x.textAlign = 'right'; x.fillText('홈', R, 296); x.textAlign = 'left';
}

// ================= 컨트롤 =================
function renderControls() {
  const r = roles(), top = $('rowTop'), bot = $('rowBot'), act = $('act'), hint = $('hint');
  top.innerHTML = ''; bot.innerHTML = '';
  const ph = G.phase;
  act.classList.toggle('hide', !(r.p === 'me' && (ph === 'select' || ph === 'gauge') || r.b === 'me'));
  if (r.p === 'me') {
    act.classList.remove('bat'); act.textContent = ph === 'gauge' ? '탭!' : '투구';
    const P = curPitcher();
    P.ps.forEach((p, i) => {
      const d = PT[p.c], bt = document.createElement('button');
      bt.className = 'pbtn' + (G.sel === p.c ? ' sel' : ''); bt.style.borderBottom = `4px solid ${d.c}`;
      const gr = p.g >= 88 ? 'S' : p.g >= 78 ? 'A' : p.g >= 66 ? 'B' : 'C';
      bt.innerHTML = `${d.n}<small>${gr} · ${p.c === 'KN' ? '~108' : Math.round(P.velo * d.r)}km</small>`;
      bt.onclick = () => { if (ph === 'select' || ph === 'gauge') { G.sel = p.c; renderControls(); } };
      bot.appendChild(bt);
    });
    hint.textContent = ph === 'select' ? '구종 선택 → 존을 터치해 코스 지정 → 투구' : ph === 'gauge' ? '원이 안쪽 원에 겹칠 때 탭!' : '';
    if (G.mode !== 'lab' && ph === 'select') { const sb = document.createElement('button'); sb.className = 'sbtn'; sb.textContent = '🔄 투수교체'; sb.onclick = openPause; top.appendChild(sb); }
    if (G.mode === 'lab') {
      const sb = document.createElement('button'); sb.className = 'sbtn'; sb.textContent = '🔄 투수 바꾸기'; sb.onclick = () => { G.st.pit[1] = (G.st.pit[1] + 1) % 3; G.sel = curPitcher().ps[0].c; G.labTrail = []; G.marks = []; G.lastPitch = null; renderHUD(); renderPinfo(); drawChart(); renderControls(); }; top.appendChild(sb);
      const s2 = document.createElement('button'); s2.className = 'sbtn'; s2.textContent = '🏟 팀 바꾸기'; s2.onclick = () => { const i = (TEAMS.findIndex(t => t.id === G.teams[1].id) + 1) % TEAMS.length; const tm = buildTeam(TEAMS[i]); G.teams = [tm, tm]; G.st.pit[1] = 0; G.sel = curPitcher().ps[0].c; G.labTrail = []; G.marks = []; G.lastPitch = null; renderHUD(); renderPinfo(); drawChart(); renderControls(); }; top.appendChild(s2);
      const s3 = document.createElement('button'); s3.className = 'sbtn'; s3.textContent = '🧹 지우기'; s3.onclick = () => { G.labTrail = []; G.marks = []; }; top.appendChild(s3);
    }
  } else if (r.b === 'me') {
    act.classList.add('bat'); act.textContent = '스윙';
    const P = curPitcher();
    const mk = (code, label, col) => { const ch = document.createElement('button'); ch.className = 'chip' + (G.guess === code ? ' sel' : ''); ch.textContent = label; if (col && G.guess !== code) ch.style.borderColor = col; ch.onclick = () => { G.guess = code; renderControls(); }; bot.appendChild(ch); };
    const lab = document.createElement('span'); lab.textContent = '🎯 예측'; lab.style.cssText = 'font-size:12px;font-weight:800;opacity:.8;flex:0 0 auto'; bot.appendChild(lab);
    mk(null, '없음');
    P.ps.forEach(p => mk(p.c, PT[p.c].n, PT[p.c].c));
    hint.textContent = ph === 'select' ? (r.p === 'remote' ? '상대가 고르는 중 — 커서 위치·예측을 정하세요' : '드래그 = 커서 이동 · 공이 오면 탭 = 스윙') : '';
  } else { hint.textContent = ''; }
}
function startGauge() {
  if (G.phase !== 'select' || roles().p !== 'me') return;
  ac();
  const g0 = (curPitcher().ps.find(p => p.c === G.sel) || { g: 60 }).g;
  G.gauge = { t: 0, T: 1.15 - (PT[G.sel].fam === 'F' ? 0 : 0.1) + (g0 - 70) * 0.004 };
  G.phase = 'gauge'; renderControls();
}
function releaseGauge(auto) {
  if (G.phase !== 'gauge') return;
  const R0 = 24, k = G.gauge.t / G.gauge.T, rr = R0 * (3.3 - 3.0 * k), acc = auto ? 9 : Math.abs(rr / R0 - 1);
  const q = acc < 0.12 ? 'P' : acc < 0.3 ? 'G' : acc < 0.62 ? 'N' : 'B';
  G.gaugeTxt = { t: { P: 'PERFECT!', G: 'GOOD', N: 'NORMAL', B: 'BAD…' }[q], col: { P: '#3fe07a', G: '#4fc8ff', N: '#fff', B: '#ff5a5a' }[q], at: performance.now() };
  const pd = T.makePitch(curPitcher(), G.sel, G.aim.slice(), q, G.mode === 'lab' ? 0 : curPC());
  if (G.mode === 'online') NET.send('pitch', { pd: pd, seq: G.st.seq });
  startPitch(pd);
}
function doSwing() {
  const r = roles(); if (r.b !== 'me' || G.phase !== 'flight' || G.swing) return;
  ac(); G.swing = { ts: G.pt, cx: G.cur[0], cz: G.cur[1], at: G.pt };
}
function clampCur() { G.cur[0] = clamp(G.cur[0], -0.6, 0.6); G.cur[1] = clamp(G.cur[1], 0.2, 1.4); }
function onAct() {
  const r = roles();
  if (r.p === 'me') { if (G.phase === 'select') startGauge(); else if (G.phase === 'gauge') releaseGauge(false); }
  else if (r.b === 'me') doSwing();
}
$('act').addEventListener('pointerdown', e => { e.preventDefault(); onAct(); });

// 포인터
let PTR = null;
cv.addEventListener('pointerdown', e => {
  if (!G.st || G.phase === 'idle') return;
  e.preventDefault(); ac();
  const r = roles(), c = pitchCam();
  PTR = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: 0, type: e.pointerType };
  if (r.p === 'me') {
    if (G.phase === 'gauge') { releaseGauge(false); PTR = null; return; }
    if (G.phase === 'select') { const p = unproj(c, e.clientX, e.clientY); G.aim = [clamp(p[0], -0.55, 0.55), clamp(p[1], 0.15, 1.45)]; }
  } else if (r.b === 'me') {
    if (e.pointerType === 'mouse' && G.phase !== 'flight') { const p = unproj(c, e.clientX, e.clientY); G.cur = p; clampCur(); }
    if (G.phase === 'flight') doSwing();
  }
});
cv.addEventListener('pointermove', e => {
  if (!G.st) return; const r = roles(), c = pitchCam();
  if (r.b === 'me' && !G.swing) {
    if (e.pointerType === 'mouse') { const p = unproj(c, e.clientX, e.clientY); G.cur = p; clampCur(); }
    else if (PTR && PTR.id === e.pointerId) { const dx = e.clientX - PTR.x, dy = e.clientY - PTR.y; PTR.moved += Math.hypot(dx, dy); PTR.x = e.clientX; PTR.y = e.clientY; const s = 3.85 / c.F * 1.3; G.cur[0] += dx * s; G.cur[1] -= dy * s; clampCur(); }
  } else if (r.p === 'me' && G.phase === 'select' && PTR && PTR.id === e.pointerId) { const p = unproj(c, e.clientX, e.clientY); G.aim = [clamp(p[0], -0.55, 0.55), clamp(p[1], 0.15, 1.45)]; }
});
cv.addEventListener('pointerup', e => {
  if (!PTR || PTR.id !== e.pointerId) return;
  const r = roles();
  PTR = null;
});
const KEYS = {};
addEventListener('keydown', e => {
  KEYS[e.key] = true; if (!G.st || G.phase === 'idle') return;
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onAct(); }
  const r = roles();
  if (r.p === 'me' && /^[1-9]$/.test(e.key)) { const p = curPitcher().ps[+e.key - 1]; if (p) { G.sel = p.c; renderControls(); } }
  if (r.p === 'me' && G.phase === 'select' && e.key.startsWith('Arrow')) { const s = 0.04; if (e.key === 'ArrowLeft') G.aim[0] -= s; if (e.key === 'ArrowRight') G.aim[0] += s; if (e.key === 'ArrowUp') G.aim[1] += s; if (e.key === 'ArrowDown') G.aim[1] -= s; }
  if (e.key === 'Escape') openPause();
});
addEventListener('keyup', e => { KEYS[e.key] = false; });

// ================= 화면 / 메뉴 =================
const SEL = { my: LS.get('tp_team', 'FB'), opp: 'ST', side: 0, inn: 3, diff: 1, net: LS.get('tp_team', 'FB'), ninn: 3, bpMy: LS.get('tp_team', 'FB'), bpOpp: 'WH', bpP: 0, lab: 'SH' };
function show(id) { document.querySelectorAll('.scr').forEach(s => s.classList.toggle('hide', s.id !== id)); }
function hideScreens() { document.querySelectorAll('.scr').forEach(s => s.classList.add('hide')); }
function teamPicker(el, key) {
  const box = $(el); box.innerHTML = '';
  for (const t of TEAMS) {
    const b = document.createElement('button'); b.className = 'tbtn' + (SEL[key] === t.id ? ' sel' : '');
    const ace = buildTeam(t).pits[0];
    b.innerHTML = `<i style="background:linear-gradient(90deg,${t.c1},${t.c2})"></i>${t.name}<small>에이스 ${ace.ps.map(p => PT[p.c].s).join('·')}</small>`;
    b.onclick = () => { SEL[key] = t.id; teamPicker(el, key); }; box.appendChild(b);
  }
}
function seg(el, key) { const box = $(el); box.querySelectorAll('button').forEach(b => { b.classList.toggle('sel', String(SEL[key]) === b.dataset.v); b.onclick = () => { SEL[key] = +b.dataset.v; seg(el, key); }; }); }
document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { ac(); show(b.dataset.go); });
teamPicker('tMy', 'my'); teamPicker('tOpp', 'opp'); teamPicker('tNet', 'net'); teamPicker('tBpMy', 'bpMy'); teamPicker('tBpOpp', 'bpOpp'); teamPicker('tLab', 'lab');
seg('segSide', 'side'); seg('segInn', 'inn'); seg('segDiff', 'diff'); seg('segNInn', 'ninn'); seg('segBpP', 'bpP');
const nickEl = $('nick'); nickEl.value = LS.get('tp_nick', '') || ('선수' + Math.floor(1000 + Math.random() * 9000)); LS.set('tp_nick', nickEl.value);
nickEl.addEventListener('input', () => LS.set('tp_nick', nickEl.value.replace(/[<>]/g, '').slice(0, 10)));
const myNick = () => (nickEl.value || '선수').replace(/[<>]/g, '').slice(0, 10);

function beginGame(mode, teams, inn, mySide) {
  G.mode = mode; G.teams = teams; G.st = newState(inn); G.mySide = mySide; G.marks = []; G.lastPitch = null; G.labTrail = [];
  G.guess = null; G.qPitch = null; G.pendRes = null; G.lastAb = 0; G.lastHalf = 0; G.paused = false; G.fx = []; G.cur = [0, 0.76]; G.aim = [0, 0.76]; G.sel = null;
  hideScreens(); $('hud').classList.remove('hide'); $('pinfo').classList.add('hide'); $('chartWrap').classList.add('hide'); $('netw').classList.add('hide');
  renderHUD();
  if (mode === 'lab' || mode === 'bp') toSelect();
  else { G.phase = 'change'; G.pt = 0; const r = roles(); setBanner('플레이볼!', `${teams[0].name} vs ${teams[1].name}` + (r.b === 'me' ? ' — 내가 먼저 공격' : ' — 내가 먼저 수비'), '#ffd23f'); renderControls(); }
}
$('goCpu').onclick = () => {
  LS.set('tp_team', SEL.my); let opp = SEL.opp; const my = buildTeam(teamDef(SEL.my)), op = buildTeam(teamDef(opp));
  G.diff = SEL.diff; const teams = SEL.side === 0 ? [my, op] : [op, my];
  G.cfg = { mode: 'cpu' }; beginGame('cpu', teams, SEL.inn, SEL.side);
};
$('goBp').onclick = () => { const my = buildTeam(teamDef(SEL.bpMy)), op = buildTeam(teamDef(SEL.bpOpp)); G.bp = { sw: 0, ip: 0, h: 0, hr: 0, maxD: 0, maxEV: 0 }; beginGame('bp', [my, op], 99, 0); G.st.pit[1] = SEL.bpP; renderHUD(); };
$('goLab').onclick = () => { const tm = buildTeam(teamDef(SEL.lab)); beginGame('lab', [tm, tm], 99, 0); $('bChart').classList.add('hide'); };
$('bSound').onclick = () => { soundOn = !soundOn; LS.set('tp_snd', soundOn); $('bSound').textContent = soundOn ? '🔊 소리 켜짐' : '🔇 소리 꺼짐'; };
$('bSound').textContent = soundOn ? '🔊 소리 켜짐' : '🔇 소리 꺼짐';
$('bChart').onclick = () => { G.showChart = !G.showChart; drawChart(); toast(G.showChart ? '궤적 분석 켜짐: 점선 = 회전 없는 공' : '궤적 분석 꺼짐'); };
$('bMenu').onclick = openPause;
function openPause() {
  if (!G.st) return;
  const r = roles(), box = $('pauseSub'); box.innerHTML = '';
  if (G.mode !== 'online' && G.mode !== 'lab') G.paused = true;
  if (r.p === 'me' && G.mode !== 'lab' && (G.phase === 'select')) {
    const d = defn(), tm = G.teams[d];
    box.innerHTML = '<div class="lbl">투수 교체</div>';
    const list = document.createElement('div'); list.className = 'plist';
    tm.pits.forEach((p, i) => {
      const b = document.createElement('button'); const pc = G.st.pc[d][i], fat = T.fatigue(pc, p);
      b.className = i === G.st.pit[d] ? 'cur' : '';
      b.innerHTML = `${p.name} · ${p.role} ${p.hand === 'L' ? '좌' : '우'}투<br><small>${p.velo}km/h · 제구 ${p.ctl} · ${p.ps.map(x => PT[x.c].s).join('/')} · 투구수 ${pc} · 체력 ${Math.round((1 - fat) * 100)}%</small>`;
      b.onclick = () => { if (i === G.st.pit[d]) return; if (i < G.st.pit[d] && G.st.pc[d][i] > 0) { toast('이미 내려간 투수는 다시 못 나와요'); return; } G.st.pit[d] = i; if (G.mode === 'online') NET.send('sub', { side: d, idx: i }); G.sel = curPitcher().ps[0].c; closePause(); renderHUD(); renderControls(); toast('투수 교체: ' + p.name); };
      list.appendChild(b);
    });
    box.appendChild(list);
  } else if (G.mode === 'online') box.innerHTML = '<p class="note">온라인 경기는 일시정지되지 않아요. 투수 교체는 내 수비 차례에 할 수 있어요.</p>';
  show('sPause');
}
function closePause() { G.paused = false; hideScreens(); }
$('pResume').onclick = closePause;
$('pQuit').onclick = () => { if (G.mode === 'online') { NET.send('bye', {}); NET.close(); } quitToMain(); };
function quitToMain() { G.phase = 'idle'; G.st = null; G.paused = false; $('hud').classList.add('hide'); $('bChart').classList.remove('hide'); setBanner(null); show('sMain'); }
function gameOver() {
  G.phase = 'over'; const st = G.st, t = G.teams;
  const w = st.score[0] > st.score[1] ? 0 : st.score[1] > st.score[0] ? 1 : -1;
  const meWin = G.mode !== 'lab' && w === G.mySide;
  $('ovT').textContent = w < 0 ? '무승부' : meWin ? '🏆 승리!' : '패배';
  $('ovS').innerHTML = `<span style="color:${t[0].c1}">■</span> ${t[0].name} ${st.score[0]} : ${st.score[1]} ${t[1].name} <span style="color:${t[1].c1}">■</span>`;
  const n = Math.max(st.innings, st.line[0].length, st.line[1].length);
  let h = '<table class="ls"><tr><th></th>'; for (let i = 1; i <= n; i++) h += `<th>${i}</th>`; h += '<th>R</th><th>H</th><th>HR</th></tr>';
  for (let s = 0; s < 2; s++) { h += `<tr><td class="t">${t[s].ab}</td>`; for (let i = 0; i < n; i++) h += `<td>${st.line[s][i] == null ? (s === 1 && i === n - 1 && st.over ? 'X' : '') : st.line[s][i]}</td>`; h += `<td><b>${st.score[s]}</b></td><td>${st.hits[s]}</td><td>${st.hr[s]}</td></tr>`; }
  h += '</table>'; $('ovL').innerHTML = h;
  $('ovX').textContent = `삼진 ${t[0].ab} ${st.k[0]} · ${t[1].ab} ${st.k[1]}  /  볼넷 ${t[0].ab} ${st.bb[0]} · ${t[1].ab} ${st.bb[1]}`;
  if (G.mode === 'online') NET.close();
  setTimeout(() => show('sOver'), 600);
}
$('ovAgain').onclick = () => { if (G.mode === 'online') { quitToMain(); show('sOnline'); } else if (G.mode === 'cpu') { quitToMain(); show('sCpu'); } else quitToMain(); };
$('ovMain').onclick = quitToMain;

// ================= 온라인 (공개 MQTT 릴레이) =================
const NET = {
  cli: [], id: 'p' + Math.random().toString(36).slice(2, 10), topic: '', seen: new Set(), peer: '', last: 0, started: false, role: '', iv: null, hb: null, mseq: 0,
  brokers: ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt'],
  load() {
    return new Promise((res, rej) => {
      if (window.mqtt) return res();
      const urls = ['https://unpkg.com/mqtt@5.10.1/dist/mqtt.min.js', 'https://cdn.jsdelivr.net/npm/mqtt@5.10.1/dist/mqtt.min.js']; let i = 0;
      const nx = () => { if (i >= urls.length) return rej(new Error('lib')); const s = document.createElement('script'); s.src = urls[i++]; s.onload = () => res(); s.onerror = () => { s.remove(); nx(); }; document.head.appendChild(s); }; nx();
    });
  },
  async connect() {
    if (NET.cli.length) return true;
    if (/[?&]loop=1/.test(location.search)) { // 테스트용 로컬 전송 (같은 브라우저 탭끼리)
      const bc = new BroadcastChannel('thepitch-loop'), subs = new Set(), hs = [];
      const cl = { subscribe: t => subs.add(t), publish: (t, s) => bc.postMessage({ t, s }), on: (e, f) => { if (e === 'message') hs.push(f); }, end: () => bc.close() };
      bc.onmessage = ev => { if (subs.has(ev.data.t)) hs.forEach(f => f(ev.data.t, ev.data.s)); };
      NET.cli.push(cl); cl.on('message', NET.onMsg); return true;
    }
    await NET.load();
    return new Promise(resolve => {
      let n = 0, ok = false;
      NET.brokers.forEach(url => {
        let c, done = false;
        const fin = (cl) => { n++; if (cl) { NET.cli.push(cl); cl.on('message', NET.onMsg); if (NET.topic) cl.subscribe(NET.topic, { qos: 1 }); if (!ok) { ok = true; resolve(true); } } if (n === NET.brokers.length && !ok) resolve(false); };
        try { c = mqtt.connect(url, { clientId: 'tp_' + NET.id + '_' + Math.random().toString(36).slice(2, 6), clean: true, keepalive: 30, reconnectPeriod: 3000, connectTimeout: 8000 }); } catch (e) { fin(null); return; }
        const to = setTimeout(() => { if (!done) { done = true; try { c.end(true); } catch (e) { } fin(null); } }, 9000);
        c.once('connect', () => { if (done) return; done = true; clearTimeout(to); fin(c); });
        c.on('error', () => { });
      });
    });
  },
  sub(code) { NET.topic = 'thepitch-dh/v1/' + code; NET.cli.forEach(c => c.subscribe(NET.topic, { qos: 1 })); },
  send(k, o) { if (!NET.topic) return; const m = Object.assign({ k: k, id: NET.id + '_' + (++NET.mseq), from: NET.id }, o || {}); const s = JSON.stringify(m); NET.cli.forEach(c => { try { c.publish(NET.topic, s, { qos: 1 }); } catch (e) { } }); },
  onMsg(topic, buf) {
    if (topic !== NET.topic) return; let m; try { m = JSON.parse(buf.toString()); } catch (e) { return; }
    if (!m || m.from === NET.id || NET.seen.has(m.id)) return; NET.seen.add(m.id);
    if (NET.started && m.from !== NET.peer) { if (m.k === 'join' && NET.role === 'host') NET.send('full', { to: m.from }); return; }
    NET.last = performance.now(); NET.handle(m);
  },
  handle(m) {
    switch (m.k) {
      case 'join':
        if (NET.role !== 'host') return;
        if (!NET.started) {
          NET.peer = m.from; NET.started = true; clearInterval(NET.iv);
          NET.cfg = { away: m.team, home: SEL.net, innings: SEL.ninn, nick: [String(m.nick || '').slice(0, 10), myNick()] };
          NET.send('start', { to: m.from, cfg: NET.cfg }); NET.startGame(1);
        } else if (m.from === NET.peer && G.st && G.st.seq === 0) NET.send('start', { to: m.from, cfg: NET.cfg });
        break;
      case 'start':
        if (NET.role !== 'guest' || m.to !== NET.id || NET.started) return;
        NET.peer = m.from; NET.started = true; clearInterval(NET.iv); NET.cfg = m.cfg; NET.startGame(0);
        break;
      case 'hello': if (NET.role === 'guest' && !NET.started) $('lobMsg').innerHTML = '<span class="spin"></span>방을 찾았어요! 입장 중…'; break;
      case 'full': if (m.to === NET.id) { toast('이미 다른 친구가 들어간 방이에요'); NET.close(); show('sOnline'); } break;
      case 'pitch': G.qPitch = m; break;
      case 'res': G.pendRes = m; break;
      case 'sub': if (G.st) { G.st.pit[m.side] = m.idx; renderHUD(); toast('상대 투수 교체: ' + G.teams[m.side].pits[m.idx].name); } break;
      case 'bye': toast('상대방이 경기를 나갔어요', 3500); NET.close(); setTimeout(quitToMain, 1500); break;
    }
  },
  startGame(mySide) {
    const c = NET.cfg, away = buildTeam(teamDef(c.away)), home = buildTeam(teamDef(c.home));
    if (c.away === c.home) { away.ab = away.ab + '(원정)'; }
    NET.last = performance.now();
    clearInterval(NET.hb); NET.hb = setInterval(() => NET.send('ping', {}), 4000);
    beginGame('online', [away, home], c.innings, mySide);
    toast(`${c.nick[0] || '원정'} vs ${c.nick[1] || '홈'} — 경기 시작!`, 3000);
  },
  close() { clearInterval(NET.iv); clearInterval(NET.hb); NET.cli.forEach(c => { try { c.end(true); } catch (e) { } }); NET.cli = []; NET.topic = ''; NET.started = false; NET.peer = ''; NET.role = ''; }
};
function genCode() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 4; i++) s += A[Math.floor(Math.random() * A.length)]; return s; }
async function hostRoom() {
  LS.set('tp_team', SEL.net); NET.close(); NET.role = 'host'; const code = genCode(); NET.code = code;
  show('sLobby'); $('lobT').textContent = '방 만들기'; $('lobCode').textContent = code; $('lobMsg').innerHTML = '<span class="spin"></span>서버 연결 중…'; $('lobShare').classList.remove('hide');
  const ok = await NET.connect().catch(() => false);
  if (!ok) { $('lobMsg').textContent = '서버 연결 실패 😢 인터넷을 확인하고 다시 시도해 주세요.'; return; }
  if (NET.role !== 'host') return;
  NET.sub(code); $('lobMsg').innerHTML = '<span class="spin"></span>친구를 기다리는 중… 이 코드를 알려주거나 초대 링크를 보내세요';
  NET.iv = setInterval(() => NET.send('hello', { team: SEL.net }), 3000);
}
async function joinRoom(code) {
  code = (code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  if (code.length !== 4) { toast('방 코드 4자리를 입력해 주세요'); return; }
  LS.set('tp_team', SEL.net); NET.close(); NET.role = 'guest'; NET.code = code;
  show('sLobby'); $('lobT').textContent = '방 참가'; $('lobCode').textContent = code; $('lobMsg').innerHTML = '<span class="spin"></span>서버 연결 중…'; $('lobShare').classList.add('hide');
  const ok = await NET.connect().catch(() => false);
  if (!ok) { $('lobMsg').textContent = '서버 연결 실패 😢 인터넷을 확인하고 다시 시도해 주세요.'; return; }
  if (NET.role !== 'guest') return;
  NET.sub(code); $('lobMsg').innerHTML = '<span class="spin"></span>방장에게 연결 중…';
  let tries = 0; const j = () => { tries++; NET.send('join', { team: SEL.net, nick: myNick() }); if (tries > 40) { clearInterval(NET.iv); $('lobMsg').textContent = '방을 찾지 못했어요. 코드를 확인해 주세요.'; } };
  j(); NET.iv = setInterval(j, 1500);
}
$('goHost').onclick = () => hostRoom();
$('goJoin').onclick = () => joinRoom($('codeIn').value);
$('lobBack').onclick = () => { NET.close(); show('sOnline'); };
$('lobShare').onclick = async () => {
  const url = location.origin + location.pathname + '?room=' + NET.code, text = `⚾ THE PITCH 야구 한 판 하자! 방 코드: ${NET.code}`;
  try { if (navigator.share) { await navigator.share({ title: 'THE PITCH', text: text, url: url }); return; } } catch (e) { }
  try { await navigator.clipboard.writeText(text + '\n' + url); toast('초대 링크를 복사했어요!'); } catch (e) { toast(url, 5000); }
};
// 초대 링크로 들어온 경우
(function () { const m = /[?&]room=([A-Za-z0-9]{4})/.exec(location.search); if (m) { $('codeIn').value = m[1].toUpperCase(); show('sOnline'); toast('팀을 고르고 "방 참가하기"를 누르세요!', 4000); } })();
addEventListener('beforeunload', () => { if (NET.started) NET.send('bye', {}); });

// ================= 메인 루프 =================
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (G.auto) for (let i = 0; i < G.auto; i++) update(dt); else update(dt);
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
window.__G = G; window.__T = T; window.__dbg = { beginGame, buildTeam, teamDef, roles };
if (/[?&]auto=(\d)/.test(location.search)) { G.auto = +RegExp.$1; }
})();
