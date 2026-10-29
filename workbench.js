/* =====================================================================
   workbench.js  -  Ink Walker hands-on crafting bench (v1)
   Weapons: slingshot, hatchet, Bowie knife.
   Everything is prefixed wb / WB so it can't clash with the main file.
   Needs these globals from the main file: ctx W H P keys banner INV ITEM_DEFS
   dropItem hash sm clamp01 lerp FIST TH_HS TH_WX TH_SC TH_DY shake
   ===================================================================== */
(function () {
'use strict';
const INK = '#111', WOOD = 'rgb(190,141,84)', WOODD = 'rgb(160,112,64)', STONE = 'rgb(165,160,150)',
      METAL = 'rgb(186,190,196)', CORD = 'rgb(222,196,140)', LEATH = 'rgb(125,84,52)', PAPERC = '#e6e4e0';
const BENCH_LX = 55;                         // bench centre, treehouse-local x (matches the drawn bench)
const SAVE_KEY = 'inkwalker_workbench_v1';
const STARTER = true;                        // give test materials once per session (set false when done testing)
const TOOLK = { knife: 1, hammer: 1, file: 1 };
const MATLABEL = { stick: 'stick', stone: 'stone', plant: 'cord/herb', scrap: 'scrap metal' };

const WEAP = {
  slingshot: { name: 'Slingshot', mats: { stick: 1, plant: 1 }, stages: [
    { id: 'carve', kind: 'hold', tool: 'knife', label: 'CARVE THE FORK', help: 'HOLD SPACE to carve. Steady strokes = cleaner wood.', dur: 2.8 },
    { id: 'bend', kind: 'bend', tool: 'hand', label: 'BEND THE FORK', help: 'HOLD SPACE to bend, RELEASE in the green zone. Too far and the wood splits.', win: [.58, .76], crack: .92, rate: .42, fail: 'stick' },
    { id: 'bind', kind: 'beat', tool: 'hand', label: 'BIND WITH CORD', help: 'Tap SPACE on the beat to wrap the cord.', hits: 6, bpm: 80 },
    { id: 'fit', kind: 'fit', tool: 'hand', label: 'FIT THE POUCH', help: 'SPACE when the pouch lines up with the slot.', speed: 1.1 },
    { id: 'test', kind: 'test', label: 'TEST: SHOOT THE TARGET', help: 'SPACE to fire when the sight crosses the bullseye.' } ] },
  hatchet: { name: 'Hatchet', mats: { stick: 1, stone: 1, plant: 1 }, stages: [
    { id: 'carve', kind: 'hold', tool: 'knife', label: 'SHAPE THE HANDLE', help: 'HOLD SPACE to whittle the haft.', dur: 3.2 },
    { id: 'knap', kind: 'beat', tool: 'hammer', label: 'KNAP THE STONE HEAD', help: 'Tap SPACE on the beat to flake the stone.', hits: 7, bpm: 78 },
    { id: 'fit', kind: 'fit', tool: 'hand', label: 'SOCKET THE HEAD & BIND', help: 'SPACE when the head sits over the haft.', speed: 1.3 },
    { id: 'test', kind: 'test', label: 'TEST: CHOP THE LOG', help: 'SPACE to swing when the line crosses the notch.' } ] },
  bowie: { name: 'Bowie Knife', mats: { scrap: 2, stick: 1, plant: 1 }, stages: [
    { id: 'forge', kind: 'beat', tool: 'hammer', label: 'FORGE THE BLADE', help: 'Tap SPACE on the beat while the metal glows.', hits: 8, bpm: 92, heat: true },
    { id: 'quench', kind: 'bend', tool: 'hand', label: 'QUENCH', help: 'HOLD SPACE to dip, RELEASE in the green. Too long and it cracks.', win: [.5, .68], crack: .85, rate: .5, fail: 'scrap' },
    { id: 'file', kind: 'hold', tool: 'file', label: 'FILE THE EDGE', help: 'HOLD SPACE to file. A dull file? Hold Q to sharpen it.', dur: 3.4 },
    { id: 'fit', kind: 'fit', tool: 'hand', label: 'PIN THE HANDLE', help: 'SPACE when the handle scales line up with the tang.', speed: 1.5 },
    { id: 'test', kind: 'test', label: 'TEST: STAB THE BOARD', help: 'SPACE to stab when the line crosses the mark.' } ] }
};
const ORDER = ['slingshot', 'hatchet', 'bowie'];

const WB = window.WB = { active: false, fade: 0, mode: 'menu', sel: 0, wid: null, si: 0, sp: 0, t: 0, s: {}, scores: [], tool: { knife: 1, hammer: 1, file: 1 },
  owned: [], mess: [], parts: [], lamp: 0, lampV: 0, k: {}, pe: {}, msg: '', msgT: 0, shk: 0, inited: false, tag: '', result: null, jit: .6, sweepT: 0 };
let JU = 60, AC = null;

/* ---------------- sound (synthesised, no files needed) ---------------- */
function ac() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } } if (AC && AC.state === 'suspended') AC.resume(); return AC; }
function noise(dur, f0, f1, vol, type) {
  const a = ac(); if (!a) return; const n = (a.sampleRate * dur) | 0, b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = a.createBufferSource(); s.buffer = b; const f = a.createBiquadFilter(); f.type = type || 'bandpass';
  f.frequency.setValueAtTime(f0, a.currentTime); f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), a.currentTime + dur);
  const g = a.createGain(); g.gain.value = vol; s.connect(f); f.connect(g); g.connect(a.destination); s.start();
}
function tone(fr, dur, vol, type, to) {
  const a = ac(); if (!a) return; const o = a.createOscillator(), g = a.createGain();
  o.type = type || 'sine'; o.frequency.setValueAtTime(fr, a.currentTime); if (to) o.frequency.exponentialRampToValueAtTime(to, a.currentTime + dur);
  g.gain.setValueAtTime(vol, a.currentTime); g.gain.exponentialRampToValueAtTime(.001, a.currentTime + dur);
  o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + dur);
}
const SFX = {
  carve: () => noise(.07, 3200, 1800, .09), file: () => noise(.11, 5000, 2500, .1, 'highpass'),
  hammer: () => { tone(180, .12, .22, 'square', 60); noise(.05, 2500, 800, .18); }, clink: () => { tone(1800, .25, .1, 'triangle', 1500); tone(2700, .2, .06, 'triangle'); },
  click: () => tone(900, .05, .16, 'square', 500), quench: () => noise(.9, 3000, 800, .16, 'highpass'), creak: () => tone(140 + Math.random() * 40, .12, .08, 'sawtooth', 100),
  snap: () => { noise(.12, 1500, 300, .35); tone(220, .12, .2, 'sawtooth', 80); }, twang: () => tone(300, .5, .18, 'triangle', 150),
  thud: () => { tone(90, .18, .3, 'sine', 50); noise(.08, 700, 200, .18, 'lowpass'); }, whoosh: () => noise(.25, 600, 2000, .1),
  done: () => { tone(660, .12, .14, 'triangle'); setTimeout(() => tone(990, .2, .14, 'triangle'), 110); }, swish: () => noise(.12, 1200, 600, .06, 'lowpass')
};

/* ---------------- save ---------------- */
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify({ owned: WB.owned })); } catch (e) { } }
function load() { try { const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (d && d.owned) WB.owned = d.owned.slice(0, 6); } catch (e) { } }

function init() {
  WB.inited = true; load();
  ITEM_DEFS.scrap = { label: 'SCRAP', h: 4 };
  for (let i = 0; i < 4; i++) dropItem('scrap', TH_WX + (-180 + i * 95));
  if (STARTER) { INV.stick = (INV.stick || 0) + 4; INV.stone = (INV.stone || 0) + 3; INV.plant = (INV.plant || 0) + 4; INV.scrap = (INV.scrap || 0) + 5; }
  addEventListener('keydown', e => {
    if (!WB.active) return; e.preventDefault(); e.stopImmediatePropagation();
    if (!e.repeat) WB.pe[e.code] = 1; WB.k[e.code] = 1; ac();
  }, true);
  addEventListener('keyup', e => { WB.k[e.code] = 0; }, true);
  addEventListener('pointerdown', e => {
    if (!WB.active) return; ac(); const G = geom(), x = e.clientX * W / innerWidth, y = e.clientY * H / innerHeight;
    if (WB.mode === 'menu') {
      if (x < G.px || x > G.px + G.pw || y < G.py || y > G.py + G.ph) { close(); return; }
      const i = Math.max(0, Math.min(2, Math.floor((x - G.px - G.pw * .03) / (G.pw * .31))));
      if (i === WB.sel) WB.pe.Space = 1; else WB.sel = i; return;
    }
    WB.k.Space = 1; WB.pe.Space = 1;
  }, true);
  addEventListener('pointerup', () => { WB.k.Space = 0; }, true);
}

/* ---------------- helpers ---------------- */
function geom() {
  const pw = Math.min(W * .84, 1120), ph = Math.min(H * .86, 720), px = (W - pw) / 2, py = (H - ph) / 2;
  return { pw, ph, px, py, u: Math.min(pw / 13.5, ph / 8.6), cx: px + pw * .5, cy: py + ph * .38, bt: py + ph * .72 };
}
const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
const stg = () => WEAP[WB.wid].stages[WB.si];
const qName = q => q < .5 ? 'Rough' : q < .82 ? 'Good' : 'Fine';
function say(t) { WB.msg = t; WB.msgT = 2.2; }
function near() { return TH_HS.in && TH_HS.k > .9 && P.thDeck && P.dh > 0 && Math.abs((P.x - TH_WX) / TH_SC - BENCH_LX) < 30; }
function ready() { return P.z >= 0 && !P.mount && !P.gun && !P.sg && P.cs === 0 && P.kn === 0 && P.pu === 0 && !P.pk; }

function emit(type, x, y, n) {
  const u = JU;
  for (let i = 0; i < n && WB.parts.length < 260; i++) {
    const sp = type === 'spark';
    WB.parts.push({ type, x, y, t: 0, seed: Math.random() * 99, rot: Math.random() * 6, vr: (Math.random() - .5) * 12,
      vx: (Math.random() - .5) * u * (sp ? 14 : 5), vy: type === 'steam' ? -u * (1 + Math.random() * 2) : -(Math.random() * u * (sp ? 8 : 4) + u * 1.5),
      life: sp ? .35 + Math.random() * .35 : type === 'steam' ? 1.1 + Math.random() * .6 : 3, r: u * (.04 + Math.random() * .05) });
  }
}
function partsTick(dt, G) {
  const g = G.u * 34;
  for (let i = WB.parts.length - 1; i >= 0; i--) {
    const p = WB.parts[i]; p.t += dt;
    if (p.type === 'steam') { p.x += Math.sin(p.t * 3 + p.seed) * 8 * dt; p.y += p.vy * dt * .5; p.vy *= .98; }
    else { p.vy += g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      if (p.y >= G.bt) { if (p.type !== 'spark') { WB.mess.push({ x: Math.max(.06, Math.min(.94, (p.x - G.px) / G.pw)), k: p.type, r: Math.random(), a: p.rot }); if (WB.mess.length > 90) WB.mess.shift(); } WB.parts.splice(i, 1); continue; } }
    if (p.t > p.life) WB.parts.splice(i, 1);
  }
}

/* ---------------- stage control ---------------- */
function beginStage() {
  WB.sp = 0; WB.t = 0;
  WB.s = { held: 0, holdT: 0, pauses: 0, hits: 0, misses: 0, vals: [], g: 0, bending: 0, soft: 0, fx: .5, fm: 0, fmT: 0, fails: 0, fitScore: 0, lastN: -1, swing: 0, sfxT: 0, shot: null, aim: 0, fl: 0 };
}
function startBuild(id) {
  const w = WEAP[id];
  for (const k in w.mats) if ((INV[k] || 0) < w.mats[k]) { say('MISSING: ' + MATLABEL[k] + ' x' + w.mats[k]); return; }
  for (const k in w.mats) INV[k] -= w.mats[k];
  WB.wid = id; WB.si = 0; WB.scores = []; WB.mode = 'build'; beginStage(); SFX.click();
}
function refund() { const w = WEAP[WB.wid]; if (w) for (const k in w.mats) INV[k] = (INV[k] || 0) + w.mats[k]; }
function close() { WB.active = false; WB.k = {}; WB.pe = {}; }
function finishStage(score) {
  WB.scores.push(Math.max(.05, Math.min(1, score)));
  const w = WEAP[WB.wid];
  if (WB.si + 1 < w.stages.length) { WB.si++; beginStage(); SFX.click(); say('STAGE DONE'); shk(3); return; }
  // weapon finished: test counts half
  let sum = 0, wt = 0; WB.scores.forEach((v, i) => { const ww = w.stages[i].kind === 'test' ? .5 : 1; sum += v * ww; wt += ww; });
  const q = sum / wt, tag = qName(q) + ' ' + w.name;
  WB.owned.unshift({ id: WB.wid, q, tag }); WB.owned = WB.owned.slice(0, 6); save();
  WB.result = { id: WB.wid, q, tag }; WB.mode = 'done'; SFX.done(); banner.t = 1.4; banner.text = tag.toUpperCase();
}
function failStage() {
  const s = stg(), G = geom(); SFX.snap(); shk(8); emit('bit', G.cx, G.cy, 14);
  if (s.fail && (INV[s.fail] || 0) > 0) { INV[s.fail]--; say('SNAP! Lost 1 ' + MATLABEL[s.fail] + '.'); beginStage(); }
  else { WB.mode = 'fail'; }
}
function shk(v) { WB.shk = Math.max(WB.shk, v); WB.lampV += (Math.random() < .5 ? -1 : 1) * v * .12; }
function effOf(t) { if (!TOOLK[t]) return 1; const w = WB.tool[t]; return w > .3 ? 1 : .2 + .8 * w / .3; }
function dull(t) { return TOOLK[t] && WB.tool[t] < .02; }
function wear(t, v) { if (TOOLK[t]) WB.tool[t] = Math.max(0, WB.tool[t] - v); }

function stageTick(dt, G) {
  const s = stg(), st = WB.s, k = WB.k, pe = WB.pe, space = k.Space, press = pe.Space, hp = handFor(G);
  WB.t += dt; st.swing = Math.max(0, st.swing - dt);
  if (k.KeyQ && TOOLK[s.tool]) { WB.tool[s.tool] = Math.min(1, WB.tool[s.tool] + dt * .5); st.sfxT -= dt; if (st.sfxT <= 0) { st.sfxT = .12; SFX.file(); } return; }
  switch (s.kind) {
    case 'hold': {
      if (space && !dull(s.tool)) {
        st.held = 1; st.holdT += dt; WB.sp = Math.min(1, WB.sp + dt / s.dur * effOf(s.tool)); wear(s.tool, dt * .06); st.sfxT -= dt;
        if (st.sfxT <= 0) { st.sfxT = .11; (s.tool === 'file' ? SFX.file : SFX.carve)(); emit(s.tool === 'file' ? 'spark' : 'shave', hp.x, hp.y + JU * .3, s.tool === 'file' ? 2 : 2); if (s.tool === 'file') emit('bit', hp.x, hp.y, 1); }
        if (WB.sp >= 1) finishStage(Math.max(.25, 1 - .17 * st.pauses));
      } else {
        if (st.held) { st.held = 0; if (st.holdT > .12) st.pauses++; st.holdT = 0; }
        if (space && dull(s.tool)) say('TOOL DULL: hold Q to sharpen');
      }
      break; }
    case 'beat': {
      const per = 60 / s.bpm, n = Math.round((WB.t - 1) / per), bt = 1 + n * per;
      if (press) {
        if (dull(s.tool)) { say('TOOL DULL: hold Q to sharpen'); break; }
        const d = Math.abs(WB.t - bt); st.swing = .16;
        if (n >= 0 && n !== st.lastN && d < .16) {
          st.lastN = n; let v = d < .07 ? 1 : .6; if (s.heat && 1 - .55 * WB.sp < .3) v *= .7;
          st.vals.push(v); st.hits++; WB.sp = st.hits / s.hits; wear(s.tool, .045);
          (s.tool === 'hammer' ? SFX.hammer : SFX.click)(); if (s.tool === 'hammer') SFX.clink();
          emit('spark', hp.x, hp.y + JU * .5, s.heat ? 16 : 7); emit('bit', hp.x, hp.y + JU * .5, 3); shk(v === 1 ? 5 : 3);
          st.fl = d < .07 ? 1 : 0; say(d < .07 ? 'PERFECT' : 'OK');
          if (st.hits >= s.hits) finishStage(mean(st.vals) * (1 - Math.min(.4, .08 * st.misses)));
        } else { st.misses++; SFX.thud(); say('OFF BEAT'); }
      }
      break; }
    case 'bend': {
      const [a, b] = s.win;
      if (space) {
        if (!st.bending) st.bending = 1;
        st.g = Math.min(1, st.g + dt * s.rate); st.sfxT -= dt; if (st.sfxT <= 0) { st.sfxT = .18 - .12 * st.g; SFX.creak(); }
        if (s.id === 'quench' && st.g > .4) { st.fl -= dt; if (st.fl <= 0) { st.fl = .06; emit('steam', G.cx + (Math.random() - .5) * G.u * .8, G.cy + 1.7 * G.u, 1); } }
        if (st.g >= s.crack) failStage();
      } else if (st.bending) {
        st.bending = 0; const g = st.g;
        if (g >= a && g <= b) finishStage(Math.max(.3, 1 - Math.abs(g - (a + b) / 2) / ((b - a) / 2) * .35 - st.soft * .12));
        else if (g < a) { st.soft++; st.g = 0; say('TOO SOFT: bend further'); SFX.thud(); }
        else finishStage(.45);
        if (s.id === 'quench') SFX.quench();
      } else st.g = Math.max(0, st.g - dt * .5);
      break; }
    case 'fit': {
      if (!st.fm) {
        st.fx = .5 + .46 * Math.sin(WB.t * 2.2 * s.speed);
        if (press) {
          const d = Math.abs(st.fx - .5);
          if (d < .25 || st.fails >= 2) { st.fm = 1; st.fmT = 0; st.fitScore = Math.max(.2, (d < .06 ? 1 : d < .14 ? .7 : .4) - st.fails * .1); SFX.click(); shk(2); }
          else { st.fails++; SFX.thud(); say('MISSED THE SLOT'); }
        }
      } else { st.fmT += dt; if (st.fmT > .6) finishStage(st.fitScore); }
      break; }
    case 'test': {
      st.aim = Math.sin(WB.t * 2.1);
      if (!st.shot && press) { st.shot = { t: 0, y: st.aim, hit: false, score: 0 }; WB.id === 0; (WB.wid === 'slingshot' ? SFX.twang : SFX.whoosh)(); }
      if (st.shot) {
        const sh = st.shot; sh.t += dt;
        if (!sh.hit && sh.t > .45) {
          sh.hit = true; sh.score = clamp01(1 - Math.abs(sh.y)); SFX.thud(); shk(6);
          emit('shave', G.cx + 3.8 * G.u, G.cy + sh.y * 1.6 * G.u, 6);
          say(sh.score > .9 ? 'BULLSEYE!' : sh.score > .6 ? 'GOOD HIT' : 'GLANCING');
        }
        if (sh.t > 1.5) finishStage(sh.score);
      }
      break; }
  }
}

/* ---------------- main tick ---------------- */
function tick(dt) {
  if (!WB.inited) init();
  const d = Math.max(dt, .001);
  WB.fade += ((WB.active ? 1 : 0) - WB.fade) * Math.min(1, d * 10);
  if (!WB.active) { WB.pe = {}; return; }
  for (const c of ['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyS', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyJ', 'KeyE']) keys[c] = 0;
  P.vx = 0; P.abuf = 0; P.jbuf = 0; P.idle = 0; P.face = (TH_WX + BENCH_LX * TH_SC) >= P.x ? 1 : -1;
  const G = geom(); JU = G.u; const pe = WB.pe;
  WB.lampV += (-60 * WB.lamp - 3 * WB.lampV) * d; WB.lamp += WB.lampV * d; WB.shk = Math.max(0, WB.shk - d * 20); WB.msgT -= d;
  partsTick(d, G);
  if (WB.mode === 'menu') {
    if (pe.ArrowLeft || pe.KeyA) WB.sel = (WB.sel + 2) % 3;
    if (pe.ArrowRight || pe.KeyD) WB.sel = (WB.sel + 1) % 3;
    if (pe.Space || pe.Enter) startBuild(ORDER[WB.sel]);
    else if (pe.Escape || pe.KeyE) close();
    if (WB.k.KeyX && WB.mess.length) { WB.sweepT -= d; if (WB.sweepT <= 0) { WB.sweepT = .035; WB.mess.shift(); if (Math.random() < .3) SFX.swish(); } }
    if (WB.k.KeyQ) { for (const t in WB.tool) WB.tool[t] = Math.min(1, WB.tool[t] + d * .3); WB.sweepT -= d; if (WB.sweepT <= 0) { WB.sweepT = .12; SFX.file(); } }
  } else if (WB.mode === 'build') {
    if (pe.Escape) { refund(); WB.mode = 'menu'; say('Parts put back.'); }
    else stageTick(d, G);
  } else if (pe.Space || pe.Enter || pe.Escape) { if (WB.mode === 'fail') say('Project lost.'); WB.mode = 'menu'; }
  WB.pe = {};
}

/* ---------------- drawing primitives ---------------- */
function jp(x, y, s) { const j = WB.jit * JU * .045; return [x + (hash(s * 3.1 + x * .013) - .5) * j * 2, y + (hash(s * 5.7 + y * .017) - .5) * j * 2]; }
function pathPts(pts, sd, close) { ctx.beginPath(); pts.forEach((p, i) => { const q = jp(p[0], p[1], sd + i); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); if (close) ctx.closePath(); }
function poly(pts, fill, lw, sd) { pathPts(pts, sd || 1, true); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = lw || Math.max(1.2, JU * .035); ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke(); }
function thick(pts, w, col, sd) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; const ow = Math.max(1.2, JU * .03);
  pathPts(pts, sd || 1, false); ctx.strokeStyle = INK; ctx.lineWidth = w + ow * 2; ctx.stroke();
  pathPts(pts, sd || 1, false); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke();
}
function heatCol(h) { h = clamp01(h); return 'rgb(' + Math.round(lerp(150, 255, h)) + ',' + Math.round(lerp(150, 105, h)) + ',' + Math.round(lerp(158, 22, h)) + ')'; }
function lerpPts(A, B, t) { return A.map((p, i) => [lerp(p[0], B[i][0], t), lerp(p[1], B[i][1], t)]); }
function txt(s, x, y, size, align, bold, col) { ctx.font = (bold ? 'italic bold ' : 'italic ') + Math.round(size) + 'px Georgia,serif'; ctx.textAlign = align || 'left'; ctx.fillStyle = col || INK; ctx.fillText(s, x, y); }
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

/* ---------------- weapon art (origin = centre, a = unit) ---------------- */
function drawSling(a, o) {
  const Lp = 1.9 * a * o.pp, top = -.3 * a, lx = -Math.sin(o.spread) * Lp, ly = top - Math.cos(o.spread) * Lp, rx = -lx;
  thick([[0, 2.4 * a], [0, top]], .55 * a, WOOD, 1);
  thick([[0, top], [lx, ly]], .42 * a, WOOD, 5); thick([[0, top], [rx, ly]], .42 * a, WOOD, 9);
  if (o.bark > .02) { ctx.fillStyle = 'rgba(110,80,50,' + o.bark * .8 + ')'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse((hash(i * 3.3) - .5) * .4 * a, (hash(i * 7.1) * 3.6 - 1.2) * a, .09 * a, .17 * a, 0, 0, 7); ctx.fill(); } }
  for (let i = 0; i < o.wraps; i++) { const y = top + .5 * a - i * .09 * a; thick([[-.33 * a, y], [.33 * a, y + .05 * a]], .06 * a, CORD, 20 + i); }
  if (o.bands) {
    const px = o.pouchX * 1, py = ly + 1.4 * a + o.pull * 1.2 * a;
    thick([[lx, ly], [px, py]], .09 * a, 'rgb(80,66,52)', 30); thick([[rx, ly], [px, py]], .09 * a, 'rgb(80,66,52)', 34);
    ctx.save(); ctx.translate(px, py); poly([[-.45 * a, -.1 * a], [0, -.28 * a], [.45 * a, -.1 * a], [.3 * a, .28 * a], [-.3 * a, .28 * a]], LEATH, null, 40);
    if (o.stone) { ctx.beginPath(); ctx.arc(0, -.08 * a, .17 * a, 0, 7); ctx.fillStyle = STONE; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke(); } ctx.restore();
  }
}
const HEADP = a => [[.35, -2.7], [.35, -1.7], [-1.1, -1.35], [-1.35, -2.0], [-1.1, -2.9]].map(p => [p[0] * a, p[1] * a]);
const ROCKP = a => [[.2, -2.3], [.3, -1.5], [-.6, -1.3], [-.9, -2.3], [-.4, -2.9]].map(p => [p[0] * a, p[1] * a]);
function drawHatchet(a, o) {
  const w = lerp(.7 * a, .4 * a, o.hp);
  thick([[0, 2.6 * a], [0, -2.1 * a]], w, WOOD, 1);
  if (o.hp < 1) { ctx.fillStyle = 'rgba(110,80,50,' + (1 - o.hp) * .8 + ')'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse((hash(i * 3.3) - .5) * .3 * a, (hash(i * 7.1) * 4 - 1.6) * a, .09 * a, .2 * a, 0, 0, 7); ctx.fill(); } }
  if (o.hp > .6) { ctx.strokeStyle = INK; ctx.lineWidth = 1.5; for (const y of [1.2, 1.6, 2.0]) { ctx.beginPath(); ctx.moveTo(-.18 * a, y * a); ctx.lineTo(.18 * a, y * a + .05 * a); ctx.stroke(); } }
  if (o.head) {
    ctx.save(); ctx.translate(o.hx || 0, 0); poly(HEADP(a), STONE, null, 50);
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = Math.max(1, JU * .02); ctx.beginPath(); ctx.moveTo(-1.28 * a, -2.05 * a); ctx.lineTo(-1.06 * a, -1.45 * a); ctx.stroke(); ctx.restore();
    for (let i = 0; i < o.wraps; i++) { const y = -1.95 * a + i * .075 * a; thick([[-.3 * a, y], [.3 * a, y + .03 * a]], .05 * a, CORD, 60 + i); }
  }
}
const BLADE = a => [[-.8, -.32], [2.6, -.5], [3.6, -.1], [2.6, .32], [-.8, .32]].map(p => [p[0] * a, p[1] * a]);
const SCRAP = a => [[-.9, -.7], [1.2, -.95], [2.2, -.2], [1.0, .8], [-1.0, .6]].map(p => [p[0] * a, p[1] * a]);
function drawBowie(a, o) {
  if (o.handle) {                      // wooden scales, behind the blade
    ctx.save(); ctx.translate(o.ox || 0, 0);
    poly([[-2.6 * a, -.45 * a], [-.9 * a, -.5 * a], [-.9 * a, .5 * a], [-2.6 * a, .45 * a]], WOOD, null, 70);
    ctx.fillStyle = INK; for (const x of [-2.2, -1.4]) { ctx.beginPath(); ctx.arc(x * a, 0, .07 * a, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  if (o.tang) poly([[-2.4 * a, -.12 * a], [-.8 * a, -.12 * a], [-.8 * a, .12 * a], [-2.4 * a, .12 * a]], METAL, null, 71);
  const pts = lerpPts(SCRAP(a), BLADE(a), o.shape);
  if (o.heat > .3) { const g = ctx.createRadialGradient(a, 0, 0, a, 0, 3 * a); g.addColorStop(0, 'rgba(255,150,40,' + (.5 * o.heat) + ')'); g.addColorStop(1, 'rgba(255,150,40,0)'); ctx.fillStyle = g; ctx.fillRect(-2 * a, -3 * a, 6 * a, 6 * a); }
  poly(pts, o.heat > .03 ? heatCol(o.heat) : METAL, null, 80);
  if (o.edge > 0) { const x0 = -.6 * a, x1 = x0 + (3.1 * a) * o.edge; thick([[x0, .24 * a], [x1, .22 * a]], .07 * a, 'rgba(255,255,255,.9)', 90); }
  if (o.handle && o.guard) poly([[-.95 * a, -.62 * a], [-.72 * a, -.62 * a], [-.72 * a, .62 * a], [-.95 * a, .62 * a]], METAL, null, 95);
}
// finished weapon as an icon (also trophy rail / tag)
function drawIcon(id, q, s) {
  const sv = WB.jit, sj = JU; WB.jit = (1 - q) * 2.2 + .1; JU = s; ctx.save();
  if (id === 'slingshot') drawSling(s * .8, { pp: 1, spread: .8, bark: 0, wraps: 9, bands: 1, pouchX: 0, pull: 0 });
  else if (id === 'hatchet') { ctx.rotate(.55); drawHatchet(s * .75, { hp: 1, head: true, wraps: 8, hx: 0 }); }
  else { ctx.rotate(-.35); drawBowie(s * .7, { shape: 1, heat: 0, edge: 1, tang: 1, handle: 1, guard: 1, ox: 0 }); }
  if (q > .8) { ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = Math.max(1, s * .03); ctx.beginPath(); ctx.moveTo(-s * .2, -s * .6); ctx.lineTo(s * .1, -s * .75); ctx.stroke(); }
  ctx.restore(); WB.jit = sv; JU = sj;
}

/* ---------------- work area per weapon ---------------- */
function testPos(a, id) {
  const sh = WB.s.shot, aim = WB.s.aim * 1.6 * a;
  if (id === 'slingshot') return { x: -3.2 * a, y: 0 };
  const sw = sh ? sm(sh.t / .4) : 0, ty = sh ? sh.y * 1.6 * a : aim;
  return { x: lerp(-3 * a, 2.7 * a, sw), y: ty, sw };
}
function drawTarget(a, st) {
  ctx.save(); ctx.translate(3.8 * a, 0); poly([[-.4 * a, -2.3 * a], [.4 * a, -2.3 * a], [.4 * a, 2.3 * a], [-.4 * a, 2.3 * a]], WOODD, null, 110);
  ctx.strokeStyle = INK; for (const r of [.25, .7, 1.1]) { ctx.lineWidth = Math.max(1.2, JU * .03); ctx.beginPath(); ctx.ellipse(0, 0, .3 * a, r * a * .75, 0, 0, 7); ctx.stroke(); }
  ctx.fillStyle = '#b3261e'; ctx.beginPath(); ctx.ellipse(0, 0, .12 * a, .2 * a, 0, 0, 7); ctx.fill();
  if (!st.shot) { const y = st.aim * 1.6 * a; ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(-.7 * a, y); ctx.lineTo(-1.1 * a, y - .15 * a); ctx.lineTo(-1.1 * a, y + .15 * a); ctx.fill(); ctx.lineWidth = 1.5; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(-3 * a, y); ctx.lineTo(-.7 * a, y); ctx.globalAlpha = .4; ctx.stroke(); ctx.globalAlpha = 1; ctx.setLineDash([]); }
  else if (st.shot.hit) { const y = st.shot.y * 1.6 * a; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-.2 * a, y - .2 * a); ctx.lineTo(.2 * a, y + .2 * a); ctx.moveTo(.2 * a, y - .2 * a); ctx.lineTo(-.2 * a, y + .2 * a); ctx.stroke(); }
  ctx.restore();
}
function workSling(a, si, p, st) {
  const o = { pp: 1, spread: .8, bark: 0, wraps: 0, bands: 0, pouchX: 0, pull: 0 };
  if (si === 0) { o.pp = p; o.spread = .35; o.bark = 1 - p; }
  else if (si === 1) o.spread = lerp(.35, .8, st.g);
  else if (si === 2) { o.wraps = Math.ceil(p * 9); o.bands = p > .7 ? 1 : 0; }
  else if (si === 3) { o.wraps = 9; o.bands = 1; o.pouchX = st.fm ? 0 : (st.fx - .5) * 5 * a; }
  else { o.wraps = 9; o.bands = 1; o.stone = 1; const sh = st.shot; o.pull = sh ? (sh.t < .45 ? sm(sh.t / .3) : Math.max(0, 1 - (sh.t - .45) * 6)) : .35 + .15 * Math.sin(WB.t * 4); if (sh && sh.t > .45) o.stone = 0; ctx.translate(-3.2 * a, 0); }
  drawSling(a, o);
  if (si === 4 && st.shot && st.shot.t > .3 && !st.shot.hit) { const u = clamp01((st.shot.t - .3) / .15); ctx.beginPath(); ctx.arc(lerp(0, 7 * a, u), lerp(1.2 * a, st.shot.y * 1.6 * a, u) - Math.sin(u * 3) * .1 * a, .15 * a, 0, 7); ctx.fillStyle = STONE; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke(); }
}
function workHatch(a, si, p, st) {
  if (si === 0) { ctx.rotate(.55); drawHatchet(a, { hp: p, head: false, wraps: 0 }); }
  else if (si === 1) {
    ctx.save(); ctx.translate(-3.6 * a, 0); ctx.rotate(.55); drawHatchet(a * .8, { hp: 1, head: false, wraps: 0 }); ctx.restore();
    ctx.save(); ctx.translate(.8 * a, 2.1 * a); ctx.translate(0, st.swing > 0 ? .06 * a : 0); poly(lerpPts(ROCKP(a), HEADP(a), p), STONE, null, 120); ctx.restore();
  } else if (si === 2) { ctx.save(); ctx.rotate(.55); drawHatchet(a, { hp: 1, head: true, hx: st.fm ? 0 : (st.fx - .5) * 5 * a, wraps: st.fm ? Math.ceil(Math.min(1, st.fmT / .5) * 8) : 0 }); ctx.restore(); }
  else { const tp = testPos(a, 'hatchet'); ctx.save(); ctx.translate(tp.x, tp.y); ctx.rotate(lerp(.5, 1.3, tp.sw || 0) + 1.57 * 0); ctx.scale(.75, .75); drawHatchet(a, { hp: 1, head: true, wraps: 8, hx: 0 }); ctx.restore(); }
}
function workBowie(a, si, p, st) {
  const o = { shape: 1, heat: 0, edge: 0, tang: 1, handle: 0, guard: 0, ox: 0 };
  if (si === 0) { o.shape = p; o.heat = Math.max(.1, 1 - .55 * p); o.tang = p > .5 ? 1 : 0; ctx.translate(-.4 * a, 0); drawBowie(a, o); return; }
  if (si === 1) {
    const y0 = -1.4 * a + st.g * 1.3 * a;
    ctx.save(); ctx.translate(0, y0); ctx.rotate(Math.PI / 2); o.heat = Math.max(0, .9 - st.g * 1.1); drawBowie(a * .62, o); ctx.restore();
    ctx.save(); poly([[-1.1 * a, 1.7 * a], [1.1 * a, 1.7 * a], [.95 * a, 2.9 * a], [-.95 * a, 2.9 * a]], WOODD, null, 130);
    ctx.fillStyle = 'rgba(110,160,190,.55)'; ctx.fillRect(-1.0 * a, 1.8 * a, 2.0 * a, 1.0 * a); ctx.restore();
    if (st.bending) { ctx.fillStyle = 'rgba(80,200,90,.28)'; /* window hint rendered in HUD */ } return;
  }
  if (si === 2) { o.edge = p; ctx.translate(-.4 * a, 0); drawBowie(a, o); return; }
  if (si === 3) { o.handle = 1; o.guard = st.fm ? 1 : 0; o.ox = st.fm ? 0 : (st.fx - .5) * 6 * a; ctx.translate(-.4 * a, 0); drawBowie(a, Object.assign(o, { edge: 1 })); return; }
  const tp = testPos(a, 'bowie'); ctx.save(); ctx.translate(tp.x - 1.5 * a, tp.y); drawBowie(a * .8, { shape: 1, heat: 0, edge: 1, tang: 1, handle: 1, guard: 1, ox: 0 }); ctx.restore();
}

/* ---------------- hands & tools ---------------- */
function handFor(G) {
  const a = G.u, s = stg(), st = WB.s, cx = G.cx, cy = G.cy, id = WB.wid, k = s.kind;
  const h = { x: cx + a * 1.2, y: cy + a * .3, ang: .5, tool: null, two: false, x2: cx - 1.8 * a, y2: cy + .9 * a };
  if (k === 'hold') {
    const sw = Math.sin(WB.t * 18) * (st.held ? 1 : .15);
    if (s.tool === 'file') Object.assign(h, { x: cx + .6 * a + sw * a * 1.0, y: cy - .15 * a, ang: -1.45, tool: 'file', two: true, x2: cx - 2.4 * a, y2: cy + .15 * a });
    else Object.assign(h, { x: cx + sw * a * .5, y: cy - .5 * a + Math.abs(sw) * .08 * a, ang: .55, tool: 'knife', two: true });
  } else if (k === 'beat') {
    if (s.tool === 'hammer') {
      const per = 60 / s.bpm, n = Math.round((WB.t - 1) / per), dtb = 1 + (WB.t - 1 > (n * per) ? (n + 1) : n) * per - WB.t;
      const dn = st.swing > 0 ? 1 : sm(1 - clamp01(dtb / (per * .6)));
      const hy = s.heat ? 0 : 1.2 * a;
      Object.assign(h, { x: cx + .5 * a, y: cy - lerp(1.5, .5, dn) * a + hy * 0 + (WB.wid === 'hatchet' ? 1.5 * a : 0) * 0, ang: lerp(2.5, .25, dn), tool: 'hammer' });
      if (WB.wid === 'hatchet') { h.x = cx + .8 * a; h.y = cy + 2.1 * a - lerp(1.6, .3, dn) * a; }
    } else { const pulse = st.swing > 0 ? 1 : 0; Object.assign(h, { x: cx + Math.cos(WB.t * 6) * .3 * a, y: cy - 1.4 * a + pulse * .2 * a, ang: .2, two: true, x2: cx, y2: cy + 2 * a }); }
  } else if (k === 'bend') {
    if (WB.wid === 'bowie') Object.assign(h, { x: cx, y: cy + (-1.4 + st.g * 1.3) * a - 1.7 * a, ang: 0 });
    else Object.assign(h, { x: cx - .1 * a, y: cy - 1.8 * a - .3 * a * st.g, ang: 0, two: true, x2: cx, y2: cy + 2.2 * a });
  } else if (k === 'fit') {
    h.ang = 0; h.x = cx + (st.fm ? 0 : (st.fx - .5) * 5 * a); h.y = cy - 1.9 * a; if (WB.wid === 'bowie') { h.x += st.fm ? -2 * a : (st.fx - .5) * 6 * a - 2 * a; h.y = cy - 1.2 * a; }
  } else if (k === 'test') {
    const tp = testPos(a, id); h.x = cx + tp.x; h.y = cy + (id === 'slingshot' ? 2.3 * a : tp.y + 1.0 * a); h.ang = 0; h.two = id === 'slingshot'; h.x2 = cx + tp.x; h.y2 = cy + 2.0 * a;
  }
  return h;
}
function drawArm(sx, sy, x, y, k) {
  const mx = (sx + x) / 2 - (x - sx) * .1, my = (sy + y) / 2 + 25 * k;
  ctx.fillStyle = INK;
  for (let i = 0; i <= 36; i++) { const t = i / 36, u = 1 - t, X = u * u * sx + 2 * u * t * mx + t * t * x, Y = u * u * sy + 2 * u * t * my + t * t * y; ctx.beginPath(); ctx.arc(X, Y, (3 + 3.5 * t) * k, 0, 7); ctx.fill(); }
}
function drawFist(x, y, sx, sy, k) {
  if (!FIST || !FIST.complete) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(y - sy, x - sx) - Math.PI / 2); ctx.scale(k, k); ctx.drawImage(FIST, -FIST.naturalWidth / 2, -14); ctx.restore();
}
function drawTool(t, x, y, ang, a) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);               // tools hang from the fist along +y
  if (t === 'hammer') { thick([[0, 0], [0, 1.5 * a]], .13 * a, WOOD, 3); poly([[-.45 * a, 1.35 * a], [.45 * a, 1.35 * a], [.45 * a, 1.8 * a], [-.45 * a, 1.8 * a]], 'rgb(120,126,132)', null, 140); }
  else if (t === 'knife') { poly([[-.1 * a, 0], [.1 * a, 0], [.1 * a, .6 * a], [-.1 * a, .6 * a]], WOOD, null, 141); poly([[-.12 * a, .6 * a], [.12 * a, .6 * a], [.02 * a, 1.9 * a]], METAL, null, 142); }
  else if (t === 'file') { poly([[-.1 * a, 0], [.1 * a, 0], [.1 * a, .5 * a], [-.1 * a, .5 * a]], WOOD, null, 143); poly([[-.14 * a, .5 * a], [.14 * a, .5 * a], [.14 * a, 2.1 * a], [-.14 * a, 2.1 * a]], 'rgb(120,124,130)', null, 144); ctx.strokeStyle = INK; ctx.lineWidth = 1; for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(-.14 * a, (.6 + i * .16) * a); ctx.lineTo(.14 * a, (.65 + i * .16) * a); ctx.stroke(); } }
  ctx.restore();
}
function drawHands(G) {
  const h = handFor(G), a = G.u, k = a / 55, sx = G.px + G.pw * .9, sy = G.py + G.ph * 1.02;
  if (h.tool) drawTool(h.tool, h.x, h.y, h.ang, a);
  drawArm(sx, sy, h.x, h.y, k); drawFist(h.x, h.y, sx, sy, k);
  if (h.two) { const sx2 = G.px + G.pw * .08; drawArm(sx2, sy, h.x2, h.y2, k); drawFist(h.x2, h.y2, sx2, sy, k); }
}

/* ---------------- overlay ---------------- */
function drawMess(G) {
  ctx.save(); ctx.strokeStyle = INK; ctx.lineWidth = 1.3;
  for (const m of WB.mess) {
    const x = G.px + G.pw * m.x, y = G.bt - 2;
    if (m.k === 'shave') { ctx.fillStyle = 'rgba(214,180,120,.95)'; ctx.beginPath(); ctx.arc(x, y - 3, 4 + m.r * 3, Math.PI, Math.PI * (1.8 + m.r * .4)); ctx.stroke(); }
    else { ctx.fillStyle = 'rgb(130,134,140)'; ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.lineTo(x, y - 3 - m.r * 2); ctx.lineTo(x + 3, y); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  }
  ctx.restore();
}
function drawParts(G) {
  ctx.save(); ctx.lineCap = 'round';
  for (const p of WB.parts) {
    const k = 1 - p.t / p.life;
    if (p.type === 'spark') { const gl = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5); gl.addColorStop(0, 'rgba(255,170,60,' + .5 * k + ')'); gl.addColorStop(1, 'rgba(255,170,60,0)'); ctx.fillStyle = gl; ctx.fillRect(p.x - p.r * 5, p.y - p.r * 5, p.r * 10, p.r * 10); ctx.strokeStyle = 'rgb(255,' + Math.round(150 + 90 * k) + ',60)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * .03, p.y - p.vy * .03); ctx.stroke(); }
    else if (p.type === 'steam') { ctx.globalAlpha = .4 * k; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (3 + 5 * (1 - k)), 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    else if (p.type === 'shave') { ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.fillStyle = 'rgba(214,180,120,.95)'; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.beginPath(); ctx.arc(0, 0, p.r * 1.6, 0, Math.PI * 1.5); ctx.stroke(); ctx.restore(); }
    else { ctx.fillStyle = 'rgb(130,134,140)'; ctx.fillRect(p.x - p.r * .7, p.y - p.r * .7, p.r * 1.4, p.r * 1.4); }
  }
  ctx.restore();
}
function drawMenu(G) {
  const fs = G.u * .3;
  for (let i = 0; i < 3; i++) {
    const id = ORDER[i], w = WEAP[id], cw = G.pw * .27, ch = G.ph * .56, x = G.px + G.pw * (.055 + i * .31), y = G.py + G.ph * .13, sel = i === WB.sel;
    ctx.save(); ctx.translate(x + cw / 2, y + ch / 2); ctx.rotate((i - 1) * .025 + (sel ? 0 : .01));
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(-cw / 2 + 6, -ch / 2 + 8, cw, ch);
    ctx.fillStyle = 'rgb(242,234,210)'; ctx.fillRect(-cw / 2, -ch / 2, cw, ch); ctx.strokeStyle = INK; ctx.lineWidth = sel ? 5 : 2.4; ctx.strokeRect(-cw / 2, -ch / 2, cw, ch);
    ctx.fillStyle = '#b3261e'; ctx.beginPath(); ctx.arc(0, -ch / 2 + 8, 7, 0, 7); ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = INK; ctx.stroke();
    txt(w.name.toUpperCase(), 0, -ch / 2 + fs * 1.9, fs * 1.15, 'center', true);
    ctx.save(); ctx.translate(0, -ch * .08); ctx.strokeStyle = INK; drawIcon(id, .6, G.u * .9); ctx.restore();
    ctx.strokeStyle = 'rgba(60,90,160,.5)'; ctx.lineWidth = 1; ctx.setLineDash([4, 5]); ctx.strokeRect(-cw * .42, -ch * .38, cw * .84, ch * .6); ctx.setLineDash([]);
    let yy = ch * .3, n = 0;
    for (const m in w.mats) {
      const have = INV[m] || 0, ok = have >= w.mats[m];
      txt(MATLABEL[m] + '  ' + have + '/' + w.mats[m], 0, yy + n * fs * 1.25, fs * .95, 'center', false, ok ? INK : '#b3261e');
      if (!ok) { ctx.setLineDash([4, 4]); ctx.lineWidth = 1.4; ctx.strokeStyle = '#b3261e'; ctx.strokeRect(-cw * .36, yy + n * fs * 1.25 - fs, cw * .72, fs * 1.3); ctx.setLineDash([]); }
      n++;
    }
    ctx.restore();
  }
  txt('A/D choose  ·  SPACE build  ·  hold X sweep (' + WB.mess.length + ' bits)  ·  hold Q sharpen tools  ·  E close', G.cx, G.py + G.ph * .93, fs * .85, 'center');
  txt('More blueprints: find torn manual pages and gun parts out in the world.', G.cx, G.py + G.ph * .885, fs * .8, 'center', false, 'rgba(17,17,17,.6)');
}
function drawOverlay() {
  if (WB.fade < .01) return;
  const G = geom(), now = performance.now() / 1000; JU = G.u;
  ctx.save(); ctx.globalAlpha = WB.fade; ctx.fillStyle = 'rgba(18,16,12,.6)'; ctx.fillRect(0, 0, W, H);
  ctx.translate((Math.random() - .5) * WB.shk, (Math.random() - .5) * WB.shk);
  ctx.fillStyle = PAPERC; rr(G.px, G.py, G.pw, G.ph, 18); ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
  ctx.save(); rr(G.px, G.py, G.pw, G.ph, 18); ctx.clip();
  ctx.fillStyle = 'rgba(238,223,150,.35)'; ctx.fillRect(G.px, G.py, G.pw, G.bt - G.py);
  // swinging lamp
  ctx.save(); ctx.translate(G.cx, G.py); ctx.rotate(WB.lamp); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, G.ph * .09); ctx.stroke();
  const lg = ctx.createRadialGradient(0, G.ph * .13, 0, 0, G.ph * .13, G.ph * .6); lg.addColorStop(0, 'rgba(255,240,170,.5)'); lg.addColorStop(1, 'rgba(255,240,170,0)'); ctx.fillStyle = lg; ctx.fillRect(-G.pw, 0, G.pw * 2, G.ph);
  ctx.fillStyle = 'rgb(40,40,44)'; ctx.beginPath(); ctx.moveTo(-G.u * .15, G.ph * .09); ctx.lineTo(G.u * .15, G.ph * .09); ctx.lineTo(G.u * .45, G.ph * .13); ctx.lineTo(-G.u * .45, G.ph * .13); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgb(255,246,200)'; ctx.beginPath(); ctx.arc(0, G.ph * .135, G.u * .1, 0, 7); ctx.fill(); ctx.restore();
  // bench
  ctx.fillStyle = WOODD; ctx.fillRect(G.px + G.pw * .07, G.bt, G.u * .35, G.ph * .2); ctx.fillRect(G.px + G.pw * .93 - G.u * .35, G.bt, G.u * .35, G.ph * .2);
  ctx.fillStyle = WOOD; ctx.fillRect(G.px + G.pw * .03, G.bt, G.pw * .94, G.ph * .06); ctx.lineWidth = 3; ctx.strokeRect(G.px + G.pw * .03, G.bt, G.pw * .94, G.ph * .06);
  ctx.lineWidth = 1; ctx.globalAlpha *= .5; for (let i = 1; i < 9; i++) { ctx.beginPath(); ctx.moveTo(G.px + G.pw * (.03 + i * .105), G.bt); ctx.lineTo(G.px + G.pw * (.03 + i * .105), G.bt + G.ph * .06); ctx.stroke(); } ctx.globalAlpha = WB.fade;
  drawMess(G);
  if (WB.mode === 'menu') drawMenu(G);
  else if (WB.mode === 'build') {
    JU = G.u; const s = stg(), st = WB.s, cj = WB.scores.length ? mean(WB.scores) : .7; WB.jit = (1 - cj) * 2.2 + .15;
    ctx.save(); ctx.translate(G.cx, G.cy);
    if (WB.wid === 'slingshot') workSling(G.u, WB.si, WB.sp, st); else if (WB.wid === 'hatchet') workHatch(G.u, WB.si, WB.sp, st); else workBowie(G.u, WB.si, WB.sp, st);
    if (s.kind === 'test') drawTarget(G.u, st);
    ctx.restore();
    drawHands(G); drawGauges(G, s, st);
    // header + footer
    const fs = G.u * .3, w = WEAP[WB.wid], n = w.stages.length;
    txt(w.name.toUpperCase() + ' · ' + s.label, G.px + G.pw * .04, G.py + G.ph * .07, fs * 1.1, 'left', true);
    for (let i = 0; i < n; i++) { ctx.beginPath(); ctx.arc(G.px + G.pw * .96 - (n - 1 - i) * fs * 1.2, G.py + G.ph * .06, fs * .4, 0, 7); ctx.fillStyle = i < WB.si ? INK : i === WB.si ? 'rgb(255,214,120)' : 'rgba(0,0,0,0)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke(); }
    txt(s.help, G.cx, G.py + G.ph * .885, fs * .95, 'center');
    if (WB.scores.length) txt('so far: ' + qName(mean(WB.scores)).toUpperCase(), G.px + G.pw * .96, G.py + G.ph * .13, fs * .9, 'right');
    txt('Esc: put parts back', G.px + G.pw * .04, G.py + G.ph * .93, fs * .75, 'left', false, 'rgba(17,17,17,.55)');
  } else if (WB.mode === 'done') {
    const fs = G.u * .3, r = WB.result;
    ctx.save(); ctx.translate(G.cx, G.cy + G.u * .2); drawIcon(r.id, r.q, G.u * 1.5); ctx.restore();
    ctx.save(); ctx.translate(G.cx, G.cy + G.u * 2.4); ctx.rotate(-.03); ctx.fillStyle = 'rgb(242,234,210)'; ctx.fillRect(-G.u * 2.2, -fs * 1.2, G.u * 4.4, fs * 2.1); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.strokeRect(-G.u * 2.2, -fs * 1.2, G.u * 4.4, fs * 2.1);
    txt(r.tag, 0, fs * .3, fs * 1.5, 'center', true); ctx.restore();
    txt('Hung on the wall rail. SPACE to continue', G.cx, G.py + G.ph * .9, fs, 'center');
  } else { txt('THE PROJECT IS LOST', G.cx, G.cy, G.u * .5, 'center', true); txt('no spare parts left · SPACE', G.cx, G.cy + G.u * .6, G.u * .3, 'center'); }
  drawParts(G);
  if (WB.msgT > 0) txt(WB.msg, G.cx, G.py + G.ph * .17, G.u * .45, 'center', true, 'rgba(17,17,17,' + clamp01(WB.msgT) + ')');
  ctx.restore();
  ctx.restore();
}
// gauges that are part of the action: beat ring, bend window, fit slot, tool wear
function drawGauges(G, s, st) {
  const a = G.u, fs = a * .26;
  if (s.kind === 'beat') {
    const per = 60 / s.bpm, n = Math.max(0, Math.round((WB.t - 1) / per)), bt = 1 + n * per, d = WB.t - bt;
    const tx = G.cx + 3.4 * a, ty = G.cy - 2.2 * a, rad = a * .35 * (1 + clamp01(Math.abs(d) / per * 2) * 1.8);
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(tx, ty, a * .35, 0, 7); ctx.stroke();
    ctx.globalAlpha *= .6; ctx.beginPath(); ctx.arc(tx, ty, rad, 0, 7); ctx.stroke(); ctx.globalAlpha = WB.fade;
    txt(st.hits + '/' + s.hits, tx, ty + a * .75, fs, 'center');
  } else if (s.kind === 'bend') {
    const x = G.cx + 3.4 * a, y0 = G.cy + 2.2 * a, hgt = 4.2 * a;
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(x - a * .15, y0 - hgt, a * .3, hgt);
    ctx.fillStyle = 'rgba(80,190,90,.6)'; ctx.fillRect(x - a * .15, y0 - hgt * s.win[1], a * .3, hgt * (s.win[1] - s.win[0]));
    ctx.fillStyle = 'rgba(190,50,40,.6)'; ctx.fillRect(x - a * .15, y0 - hgt, a * .3, hgt * (1 - s.crack));
    ctx.fillStyle = INK; const y = y0 - hgt * st.g; ctx.beginPath(); ctx.moveTo(x + a * .2, y); ctx.lineTo(x + a * .5, y - a * .15); ctx.lineTo(x + a * .5, y + a * .15); ctx.fill();
  } else if (s.kind === 'fit') {
    const y = G.cy + 2.6 * a, w = 6 * a; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(G.cx - w / 2, y); ctx.lineTo(G.cx + w / 2, y); ctx.stroke();
    ctx.fillStyle = 'rgba(80,190,90,.6)'; ctx.fillRect(G.cx - w * .06, y - a * .15, w * .12, a * .3);
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(G.cx + (st.fx - .5) * w, y, a * .12, 0, 7); ctx.fill();
  }
  if (TOOLK[s.tool]) { const w = WB.tool[s.tool]; txt(s.tool + (w < .3 ? ' DULL · hold Q' : ''), G.px + G.pw * .04, G.py + G.ph * .12, fs, 'left', false, w < .3 ? '#b3261e' : INK); ctx.fillStyle = w < .3 ? '#b3261e' : INK; ctx.fillRect(G.px + G.pw * .04, G.py + G.ph * .13, a * 1.5 * w, 4); }
}

/* ---------------- main-file hooks ---------------- */
function drawWall(k, now) {                       // inside thInterior(): treehouse image-pixel space
  if (!WB.owned.length && !WB.mess.length) return;
  const sv = JU, sj = WB.jit; ctx.save();
  if (WB.owned.length) {
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(232, 272); ctx.lineTo(376, 272); ctx.stroke();
    ctx.fillStyle = INK; for (const x of [232, 376]) { ctx.beginPath(); ctx.arc(x, 272, 3, 0, 7); ctx.fill(); }
    WB.owned.slice(0, 6).forEach((w, i) => {
      const x = 246 + i * 24; ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, 272); ctx.lineTo(x, 279); ctx.stroke();
      ctx.save(); ctx.translate(x, 292); drawIcon(w.id, w.q, 9); ctx.restore();
      ctx.fillStyle = 'rgb(242,234,210)'; ctx.fillRect(x - 5, 303, 10, 7); ctx.lineWidth = 1; ctx.strokeStyle = INK; ctx.strokeRect(x - 5, 303, 10, 7);
      ctx.fillStyle = INK; ctx.font = 'bold 6px Georgia,serif'; ctx.textAlign = 'center'; ctx.fillText(qName(w.q)[0], x, 309);
    });
  }
  ctx.fillStyle = 'rgb(214,180,120)'; ctx.strokeStyle = INK; ctx.lineWidth = .6;       // shavings / metal bits on the floor
  WB.mess.forEach((m, i) => { const x = 436 + m.x * 106, y = 449 + (m.r * 4); if (m.k === 'shave') { ctx.beginPath(); ctx.arc(x, y, 1.8, Math.PI, 5.4); ctx.stroke(); } else { ctx.fillStyle = 'rgb(130,134,140)'; ctx.fillRect(x, y, 2, 1.6); } });
  ctx.restore(); JU = sv; WB.jit = sj;
}
function drawHint(gy) {
  if (WB.active || !near()) return;
  const sx = W / 2 + TH_WX + BENCH_LX * TH_SC - P.x, sy = gy + (TH_DY - 82) * TH_SC - 4 * Math.sin(performance.now() / 200);
  ctx.save(); ctx.textAlign = 'center'; ctx.beginPath(); ctx.arc(sx, sy, 26, 0, 7); ctx.fillStyle = 'rgba(230,228,222,.92)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = INK; ctx.font = 'italic bold 30px Georgia,serif'; ctx.fillText('E', sx, sy + 11); ctx.font = 'italic 15px Georgia,serif'; ctx.fillText('workbench', sx, sy + 46); ctx.restore();
}
function pressE() {
  if (!WB.inited) init();
  if (WB.active || !near()) return false;
  if (!ready()) { banner.t = .7; banner.text = 'FREE YOUR HANDS FIRST'; return true; }
  for (const c in keys) keys[c] = 0;
  WB.active = true; WB.mode = 'menu'; WB.k = {}; WB.pe = {}; ac(); return true;
}
function drawItem(it) {                           // called at the top of drawItemShape(); return true if handled
  if (it.type !== 'scrap') return false;
  ctx.lineJoin = 'round'; ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.beginPath();
  [[-8, 2], [-4, -6], [4, -5], [9, 1], [3, 6], [-5, 5]].forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
  ctx.closePath(); ctx.fillStyle = 'rgb(150,152,158)'; ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(150,80,40,.6)'; ctx.beginPath(); ctx.ellipse(-2, 1, 3, 2, .3, 0, 7); ctx.fill(); return true;
}
window.wbTick = tick; window.wbDrawOverlay = drawOverlay; window.wbDrawWall = drawWall; window.wbDrawHint = drawHint;
window.wbPressE = pressE; window.wbDrawItem = drawItem; window.wbActive = () => WB.active;
})();
