// =====================================================================
//  FLARE PISTOL  (break-open signal pistol, Webley-style)
//  Standalone add-on for the revolver/shotgun code. Load it AFTER your main script:
//      <script src="flare.js"></script>
//
//  It reuses the revolver's arm pose, recoil, reload timeline (RL_* / rlTilt / cylOpen),
//  muzzle flash and holster. P.wt ('rev' | 'flare') says which gun P.gun means.
// =====================================================================

const FL_KEY = 'KeyX', FL_KEY_LABEL = 'X';
const FL_SFX = { fire: 'shotgun', fireVol: .55, empty: 'gunempty', pickup: 'pump' };   // rename to your own sound ids, e.g. 'flare'
const FL_V = 1500, FL_G = 700;                  // launch speed, gravity (px/s, px/s^2): the flare arcs
const FL_BODY_DMG = 14, FL_HEAD_DMG = 26;       // impact damage
const FL_BURN_T = 4.5, FL_BURN_DPS = 7;         // burn duration (s) and damage per second after ignition
const FL_GROUND_T = 7;                          // how long a flare keeps burning on the ground
const FL_FIRE_CD = .5;

function flSfx(n, v) { try { playSfx(n, v) } catch (e) { } }

const flares = [];
P.wt = 'rev'; P.fAmmo = 1; P.fRlOn = 0; P.fRlShell = 0; P.fRlLoad = 0;
P.fgp = 0; P.fgpT = 0; P.fgpWalk = 0; P.fgpWalkT = 0; P.fgpHit = 0;

// ================= ARTWORK =================
// Drawn in the same pixel space as the revolver (scale .07, same grip position), so the hand,
// recoil, muzzle point and holster all line up. co = barrel broken open (0..1), u = reload progress.
const FL_K = .07, FL_X0 = 405, FL_Y0 = 543.6, FL_INK = '#1b140e';

function drawFlarePistol(co, u, cock) {
    co = co || 0; u = u || 0;
    if (cock === undefined) cock = P.fAmmo > 0;
    ctx.save(); ctx.scale(FL_K, FL_K); ctx.translate(-FL_X0, -FL_Y0);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = FL_INK;
    const LW = 1.5 / FL_K, LD = 1 / FL_K;
    const fs = (col, w) => { ctx.fillStyle = col; ctx.lineWidth = w || LW; ctx.fill(); ctx.stroke() };
    const tube = (w, col) => { ctx.strokeStyle = FL_INK; ctx.lineWidth = w + 14; ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke(); ctx.strokeStyle = FL_INK };

    // ---- wooden grip, lanyard ring and cord ----
    ctx.beginPath(); ctx.moveTo(410, 515); ctx.lineTo(500, 512); ctx.lineTo(503, 578);
    ctx.quadraticCurveTo(468, 622, 447, 680); ctx.quadraticCurveTo(436, 725, 442, 775);
    ctx.lineTo(255, 775); ctx.quadraticCurveTo(300, 690, 340, 625); ctx.quadraticCurveTo(375, 570, 410, 515); ctx.closePath();
    fs('#6d4a2b');
    ctx.save(); ctx.strokeStyle = '#9a6d3f'; ctx.lineWidth = 13; ctx.globalAlpha *= .45;
    ctx.beginPath(); ctx.moveTo(452, 585); ctx.quadraticCurveTo(405, 680, 398, 750); ctx.stroke();
    ctx.strokeStyle = '#43291a'; ctx.lineWidth = .6 / FL_K; ctx.globalAlpha = .6;
    for (const g of [[320, 735, 350, 680], [365, 750, 385, 695], [395, 605, 418, 550], [338, 655, 368, 612]]) { ctx.beginPath(); ctx.moveTo(g[0], g[1]); ctx.lineTo(g[2], g[3]); ctx.stroke() }
    ctx.restore();
    ctx.beginPath(); ctx.arc(395, 655, 17, 0, 7); ctx.fillStyle = '#a19d95'; ctx.lineWidth = LD * 1.1; ctx.fill(); ctx.stroke();   // grip screw medallion
    ctx.beginPath(); ctx.moveTo(388, 655); ctx.lineTo(402, 655); ctx.lineWidth = LD * .8; ctx.stroke();
    ctx.beginPath(); ctx.arc(348, 790, 14, 0, 7); ctx.lineWidth = 12; ctx.stroke(); ctx.strokeStyle = '#a19d95'; ctx.lineWidth = 5; ctx.stroke(); ctx.strokeStyle = FL_INK;
    ctx.beginPath(); ctx.moveTo(348, 804); ctx.quadraticCurveTo(334, 828, 350, 848); tube(7, '#cdb88f');
    ctx.beginPath(); ctx.arc(344, 822, 9, 0, 7); ctx.fillStyle = '#cdb88f'; ctx.lineWidth = LD; ctx.fill(); ctx.stroke();

    // ---- trigger guard + trigger ----
    ctx.beginPath(); ctx.moveTo(548, 556); ctx.bezierCurveTo(528, 625, 578, 660, 625, 648); ctx.bezierCurveTo(668, 636, 678, 590, 668, 548); tube(14, '#a8a49c');
    ctx.beginPath(); ctx.moveTo(578, 560); ctx.quadraticCurveTo(566, 612, 604, 620); tube(10, '#8b877f');

    // ---- frame (light steel) ----
    ctx.beginPath();
    ctx.moveTo(505, 582); ctx.lineTo(500, 515); ctx.lineTo(500, 462); ctx.lineTo(520, 418); ctx.lineTo(560, 372); ctx.lineTo(600, 340);
    ctx.lineTo(800, 336); ctx.lineTo(808, 452); ctx.lineTo(796, 470); ctx.lineTo(770, 495); ctx.lineTo(752, 528); ctx.lineTo(600, 552); ctx.closePath();
    fs('#a9a59d');
    ctx.save(); ctx.globalAlpha *= .5; ctx.fillStyle = '#d2cfc7'; ctx.beginPath(); ctx.ellipse(590, 420, 50, 44, .4, 0, 7); ctx.fill();
    ctx.strokeStyle = '#5c5850'; ctx.lineWidth = LD * .8; ctx.beginPath(); ctx.moveTo(560, 470); ctx.quadraticCurveTo(650, 470, 740, 440); ctx.stroke(); ctx.restore();
    ctx.fillStyle = '#76726a'; ctx.lineWidth = LD * .6;
    for (const s of [[538, 500], [610, 530], [690, 405]]) { ctx.beginPath(); ctx.arc(s[0], s[1], 9, 0, 7); ctx.fill(); ctx.stroke() }

    // ---- standing breech face (dark gap shows when the barrel breaks open) ----
    if (co > .05) { ctx.save(); ctx.globalAlpha *= Math.min(1, co * 4); ctx.fillStyle = '#2b241c'; ctx.beginPath(); ctx.rect(784, 338, 22, 112); ctx.fill(); ctx.restore() }

    // ---- barrel group, hinged at the front of the frame; muzzle swings down when it breaks ----
    ctx.save(); ctx.translate(806, 446); ctx.rotate(.5 * co); ctx.translate(-806, -446);
    if (co > .25 && u > 0) {                                  // spent shell lifts out, fresh shell is pushed in
        let out = -1, spent = false;
        if (u < RL_EJECT) { out = 14 + 105 * sm((u - RL_OPEN) / (RL_EJECT - RL_OPEN)); spent = true }
        else if (u >= RL_INSERT - .02) out = 14 + 36 * (1 - sm((u - RL_INSERT + .02) / .07));
        if (out >= 0) {
            const x0 = 800 - out;
            ctx.beginPath(); ctx.rect(x0 + 16, 336, 112, 76); fs(spent ? '#7a2a22' : '#c4281e', LD * 1.6);
            ctx.beginPath(); ctx.rect(x0 + 108, 336, 20, 76); fs(spent ? '#5d2018' : '#8f1a12', LD * 1.4);
            ctx.beginPath(); ctx.rect(x0, 330, 18, 88); fs('#c99a3a', LD * 1.6);
            ctx.beginPath(); ctx.arc(x0 + 9, 374, 8, 0, 7); ctx.fillStyle = spent ? '#3a3a3a' : '#8a6a22'; ctx.fill();
        }
    }
    ctx.beginPath(); ctx.rect(800, 306, 200, 134); fs('#8a7a62');                       // rear sleeve
    ctx.fillStyle = '#6a5b47'; ctx.fillRect(802, 418, 196, 20);
    ctx.save(); ctx.globalAlpha *= .6; ctx.strokeStyle = '#d1c4a5'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(815, 322); ctx.lineTo(985, 322); ctx.stroke(); ctx.restore();
    ctx.beginPath(); ctx.rect(800, 306, 200, 134); ctx.lineWidth = LW; ctx.stroke();
    ctx.beginPath(); ctx.rect(1000, 318, 195, 112); fs('#938466');                       // long front tube
    ctx.fillStyle = '#6a5b47'; ctx.fillRect(1002, 410, 191, 18);
    ctx.save(); ctx.globalAlpha *= .6; ctx.strokeStyle = '#d1c4a5'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(1015, 333); ctx.lineTo(1160, 333); ctx.stroke(); ctx.restore();
    ctx.beginPath(); ctx.rect(1000, 318, 195, 112); ctx.lineWidth = LW; ctx.stroke();
    ctx.beginPath(); ctx.rect(992, 310, 16, 128); fs('#7c6e58', LD * 1.4);                // joint collar
    ctx.beginPath(); ctx.rect(1168, 312, 27, 124); fs('#c99a3a');                         // brass muzzle ring
    ctx.beginPath(); ctx.moveTo(1130, 318); ctx.lineTo(1138, 298); ctx.lineTo(1154, 298); ctx.lineTo(1158, 318); ctx.closePath(); fs('#4d4943', LD * 1.4);   // front sight
    ctx.restore();
    ctx.beginPath(); ctx.arc(806, 446, 11, 0, 7); ctx.fillStyle = '#5c5850'; ctx.lineWidth = LD; ctx.fill(); ctx.stroke();   // hinge pin

    // ---- hammer with wide thumb spur (cocked back when loaded and closed) ----
    ctx.save(); ctx.translate(545, 430); ctx.rotate((cock && co < .3 ? -.42 : 0)); ctx.translate(-545, -430);
    ctx.beginPath(); ctx.moveTo(540, 430); ctx.lineTo(500, 420); ctx.lineTo(478, 380); ctx.quadraticCurveTo(450, 340, 428, 316);
    ctx.lineTo(442, 304); ctx.quadraticCurveTo(472, 300, 500, 318); ctx.quadraticCurveTo(522, 336, 545, 350);
    ctx.lineTo(572, 372); ctx.lineTo(566, 410); ctx.closePath(); fs('#c7c3bb');
    ctx.strokeStyle = '#5c5850'; ctx.lineWidth = LD * .7; ctx.beginPath(); ctx.moveTo(452, 322); ctx.lineTo(492, 336); ctx.moveTo(458, 331); ctx.lineTo(498, 346); ctx.stroke();
    ctx.restore();
    ctx.restore();
}

// ================= HUD =================
function drawFlareHUD() {
    if (P.gunK < .05) return;
    ctx.save(); ctx.globalAlpha = Math.min(1, P.gunK); ctx.lineWidth = 2.5; ctx.strokeStyle = '#111';
    const x = 24, y = calcTop() + 8;
    ctx.fillStyle = P.fAmmo > 0 ? '#c4281e' : 'rgba(0,0,0,0)'; ctx.beginPath(); ctx.rect(x, y, 14, 28); ctx.fill(); ctx.stroke();
    if (P.fAmmo > 0) { ctx.fillStyle = '#c99a3a'; ctx.beginPath(); ctx.rect(x, y + 22, 14, 6); ctx.fill(); ctx.stroke() }
    if (P.rl > 0) { ctx.fillStyle = '#111'; ctx.font = 'italic 18px Georgia,serif'; ctx.fillText('reloading…', 22, calcTop() + 60) }
    ctx.restore();
}

// ================= FIRING =================
function flareFire() {                                     // called from pressFire() after the generic guards
    if (P.fAmmo <= 0) { banner.t = .5; banner.text = 'CLICK! (R)'; P.fireCd = .3; flSfx(FL_SFX.empty, .8); return }
    const S = CSc(), F = P.face, th = P.gunA || 0, m = P.muzzle || [P.x + F * 60 * S, -250 * S], R = Math.random;
    const dh = (P.thDeck && P.dh > 0) ? P.dh : 0;
    P.fAmmo = 0; P.fireCd = FL_FIRE_CD; P.recoil = 1; P.idle = 0; P.fid = 0;
    flSfx(FL_SFX.fire, FL_SFX.fireVol);
    const a = th - .05;
    flares.push({ x: m[0], y: m[1] - dh, x0: m[0], dh, F, vx: F * Math.cos(a) * FL_V, vy: Math.sin(a) * FL_V, age: 0, st: 0, t: 0, tr: 0, bn: 0, seed: R() * 100 });
    burst(m[0], m[1] - dh, 10, 300, F);
    fireFX([m[0], m[1] - dh], F, th);
    const ux = F * Math.cos(th), uy = Math.sin(th);
    for (let i = 0; i < 5; i++) addSmoke(m[0] + ux * (14 + i * 10), m[1] - dh + uy * (14 + i * 10), ux * (120 - i * 15) + (R() - .5) * 30, uy * 120 - 20 - R() * 30, (9 + R() * 6) * S, 1.5 + R() * .8, .45);
    shake = Math.max(shake, 5);
}

function ejectFlareShell() {
    const w = P.gunW || [P.x, -150], F = P.face, R = Math.random;
    shells.push({ x: w[0], y: w[1] - 8, vx: -F * (50 + R() * 60), vy: -(200 + R() * 120), rot: R() * 6, vr: (R() - .5) * 14, landed: false, t: 0, sg: 1 });
    addSmoke(w[0], w[1] - 8, (R() - .5) * 20, -40, 5, 1, .2);
    shake = Math.max(shake, 2.5);
}

function flareHit(p, e, h, S) {
    const F = p.F, R = Math.random, dmg = h.head ? FL_HEAD_DMG : FL_BODY_DMG;
    e.hp -= dmg; e.bar = 2.5; e.kdir = F; e.face = -F; e.hurt = Math.max(e.hurt, .25); e.vx = F * 140; e.wait = 1; e.fid = 0;
    e.burn = Math.max(e.burn || 0, FL_BURN_T);
    combo.n++; combo.dmg += dmg; combo.t = 1.8; combo.pop = 1.2;
    burst(h.x, h.y, 10, 260, F);
    for (let i = 0; i < 22; i++) addSpark(h.x, h.y, (R() - .5) * 520 + F * 80, -(R() * 420), .3 + R() * .4);
    addSmoke(h.x, h.y, F * 40, -30, 8 * S, .9, .35);
    impacts.push({ x: h.x, y: h.y, t: 0, life: .2, s: 65, seed: R() * 50 });
    hitstop = Math.max(hitstop, .04); shake = Math.max(shake, 4);
    if (e.hp <= 0) { e.hp = 0; e.dying = .5; banner.t = 1.1; banner.text = 'BURNED!'; if (P.grabbed === e) P.grabbed = null }
    else { banner.t = .9; banner.text = h.head ? 'FLARE TO THE FACE!' : 'IGNITED!' }
}

function flSmallHit(p, px, py) {                           // birds, fowl, butterflies
    return (typeof birdsHit === 'function' && birdsHit(px, py, p.x, p.y, p.F, 20)) ||
        (typeof fowlHit === 'function' && fowlHit(px, py, p.x, p.y, p.F, 20)) ||
        (typeof bflyHit === 'function' && bflyHit(px, py, p.x, p.y, p.F, 20));
}

// ================= GROUND GUN + PICKUP =================
const FL_REST = .3, FL_REST_Y = -14, FL_CEN = 24;          // lying angle, grip height, centre of the gun along its length
const FL_RANGE = 200, FL_STAND = 40, FL_HIT = .3, FL_FLY = .55;
const FL_DECK_DH = typeof TH_DY !== 'undefined' && typeof TH_SC !== 'undefined' ? -TH_DY * TH_SC : 1122;
const FL_INIT_X = typeof TH_WX !== 'undefined' && typeof TH_SC !== 'undefined' ? (TH_WX + 60 * TH_SC) : -29796;
const FLG = { on: 1, x: FL_INIT_X, y: 0, dh: FL_DECK_DH, F: 1, th: FL_REST, vx: 0, vy: 0, air: 0, bounced: 0, flying: 0, cx: 0, c0: [0, 0], tr: [], trT: 0 };

function flCenter(S) { return FLG.x + FLG.F * Math.cos(FL_REST) * FL_CEN * S }

function pressFlarePickup() {
    if (P.fgp > 0) return;
    if (P.wt === 'flare' && (P.gun || P.gunK > .01)) {                 // flare pistol is out (or holstered): throw it down
        if (P.rl > 0 || P.gs === 2 || P.fin > 0) return;
        dropFlarePistol(); return;
    }
    if (P.sg) { banner.t = .6; banner.text = 'DROP SHOTGUN FIRST (Z)'; return }
    if (P.mount) { banner.t = .6; banner.text = 'DISMOUNT FIRST (H)'; return }
    if (P.gun || P.gs === 2) { banner.t = .7; banner.text = 'HOLSTER REVOLVER FIRST (G)'; return }
    if (P.kn !== 0 || P.kt > .2) { banner.t = .7; banner.text = 'PUT THE KNIFE AWAY (K)'; return }
    if (P.fin > 0 || P.cs > 0 || P.thw > 0 || P.tt > 0 || P.sm > 0 || P.pk > 0 || P.fs > 0 || P.gu > 0 || P.yk > 0 || P.stbk > 0 || P.sgp > 0 || P.z < 0) return;
    const S = CSc();
    if (!FLG.on || FLG.air || FLG.flying) return;
    const sameLevel = Math.abs((P.dh || 0) - (FLG.dh || 0)) < 80;
    if (Math.abs(flCenter(S) - P.x) > FL_RANGE * S || !sameLevel) {
        if (!sameLevel && Math.abs(flCenter(S) - P.x) <= FL_RANGE * S) return;
        banner.t = .8; banner.text = 'WALK TO THE FLARE PISTOL'; return;
    }
    if (P.skid) endSkid();
    FLG.cx = flCenter(S);
    P.face = FLG.cx >= P.x ? 1 : -1;
    P.fgp = .0001; P.fgpT = 0; P.fgpWalk = 1; P.fgpWalkT = 0; P.fgpHit = 0;
    P.idle = 0; P.fid = 0; P.abuf = 0; P.clast = 0; P.cgr = 0; P.grabbed = null;
}

function dropFlarePistol() {
    const S = CSc(), F = P.face, R = P.gun && P.armPts && P.armPts[0] ? P.armPts[0][1] : [F * 20, -100];
    const dh = (P.thDeck && P.dh > 0) ? P.dh : 0;
    Object.assign(FLG, { on: 1, air: 1, bounced: 0, flying: 0, F, x: P.x + R[0] * S, y: R[1] * S, dh, th: P.gunA || 0, vx: F * 170, vy: -230 });
    P.gun = 0; P.wt = 'rev'; P.rl = 0; P.gs = 0; P.idle = 0; P.fid = 0;
}

function flGroundTick(dt) {
    const g = FLG, S = CSc();
    if (!g.on || g.flying) return;
    if (g.dh > 0 && typeof TH_WX !== 'undefined' && typeof TH_SC !== 'undefined') {
        const minX = TH_WX - 285 * TH_SC, maxX = TH_WX + 205 * TH_SC;
        if (g.x < minX || g.x > maxX) {
            g.y -= g.dh;
            g.dh = 0;
            g.air = 1;
        }
    }
    if (!g.air) { g.y = FL_REST_Y * S; g.th = FL_REST; return }
    g.vy += 1500 * dt; g.x += g.vx * dt; g.y += g.vy * dt; g.vx *= Math.max(0, 1 - 2.5 * dt);
    g.th += (FL_REST - g.th) * Math.min(1, dt * 9);
    const rest = FL_REST_Y * S;
    if (g.y >= rest) {
        g.y = rest;
        const dh = g.dh || 0;
        burst(g.x, -4 - dh, 6, 180, g.F);
        shake = Math.max(shake, 2.5);
        if (g.vy > 260 && !g.bounced) { g.vy *= -.28; g.bounced = 1 }
        else { g.vy = 0; g.vx = 0; g.air = 0; g.th = FL_REST }
    }
}

function flPickupTick(dt) {
    if (!(P.fgp > 0)) return;
    const S = CSc(), F = P.face, g = FLG, dh = g.dh || 0;
    P.abuf = 0; P.jbuf = 0;
    if (!g.on || P.z < 0) { P.fgp = 0; return }
    if (P.fgpWalk) {                                       // walk up to the gun
        P.fgpWalkT += dt;
        const d = g.cx - F * FL_STAND * S - P.x;
        if (d * F <= 6 * S || P.fgpWalkT > 1.5) { P.fgpWalk = 0; P.vx = 0 }
        else { P.vx = Math.max(-180, Math.min(180, d * 7)); return }
    }
    P.vx *= Math.max(0, 1 - dt * 14);
    P.fgpT += dt;
    if (!P.fgpHit && P.fgpT >= FL_HIT) {                   // toe-flick: the pistol pops up
        P.fgpHit = 1;
        g.c0 = [g.cx, g.y + Math.sin(FL_REST) * FL_CEN * S];
        g.F = F; g.flying = 1; g.air = 0; g.tr = []; g.trT = 0;
        burst(g.cx, -4 - dh, 10, 260, F); burst(g.cx, -4 - dh, 6, 200, -F);
        impacts.push({ x: g.cx, y: (-8 * S) - dh, t: 0, life: .2, s: 70, seed: Math.random() * 50 });
        shake = Math.max(shake, 5); flSfx(FL_SFX.pickup, .6);
        banner.t = .7; banner.text = 'FLICKED UP!';
    }
    if (P.fgpHit) flFly(S, dt);
}

function flFly(S, dt) {                                    // flip up, spin once, land in the hand
    const g = FLG, F = P.face, u = Math.min(1, (P.fgpT - FL_HIT) / FL_FLY);
    const w = (P.armPts && P.armPts[0]) ? P.armPts[0][1] : [F * 46, -150];
    const ex = P.x + (w[0] + F * 12) * S + F * FL_CEN * S * .5, ey = (w[1] - 4) * S;
    const th = FL_REST + (TAU - FL_REST) * Math.sin(u * Math.PI / 2);
    const cx = lerp(g.c0[0], ex, u), cy = lerp(g.c0[1], ey, u) - 190 * S * 4 * u * (1 - u);
    g.th = th; g.x = cx - F * Math.cos(th) * FL_CEN * S; g.y = cy - Math.sin(th) * FL_CEN * S;
    g.trT -= dt; if (g.trT <= 0) { g.trT = .035; g.tr.push([g.x, g.y, g.th]); if (g.tr.length > 6) g.tr.shift() }
    if (u >= 1) {                                          // CAUGHT
        const dh = g.dh || 0;
        g.on = 0; g.flying = 0; P.fgp = 0; P.fgpHit = 0;
        P.wt = 'flare'; P.gun = 1; P.gunK = Math.max(P.gunK, .5); P.gdT = 1; P.glint = 1; P.rl = 0; P.gs = 0; P.idle = 0; P.fid = 0;
        shake = Math.max(shake, 4); banner.t = .8; banner.text = 'FLARE PISTOL';
        burst(P.x + F * 40 * S, -150 * S - dh, 5, 150, F);
    }
}

// ================= PER-FRAME UPDATE =================
function flareTick(dt) {
    const S = CSc(), R = Math.random;

    // reload events (the revolver timeline does the animation; this does the flare-pistol bookkeeping)
    if (P.wt === 'flare' && P.rl > 0) {
        if (!P.fRlOn) { P.fRlOn = 1; P.fRlShell = 0; P.fRlLoad = 0 }
        const u = P.rl / RELOAD_T;
        if (!P.fRlShell && u >= RL_EJECT) { P.fRlShell = 1; ejectFlareShell() }
        if (!P.fRlLoad && u >= RL_LOADED) { P.fRlLoad = 1; P.fAmmo = 1 }
    } else P.fRlOn = 0;

    flGroundTick(dt);
    flPickupTick(dt);

    // flares in flight / burning on the ground
    for (let i = flares.length - 1; i >= 0; i--) {
        const p = flares[i]; p.age += dt;
        if (p.st === 0) {
            const px = p.x, py = p.y;
            p.vy += FL_G * dt; p.x += p.vx * dt; p.y += p.vy * dt;
            p.tr -= dt;
            if (p.tr <= 0) {
                p.tr = .014;
                addSpark(p.x, p.y, -p.vx * .04 + (R() - .5) * 90, -p.vy * .04 + (R() - .5) * 90, .25 + R() * .25);
                if (R() < .55) addSmoke(p.x, p.y, (R() - .5) * 16, -12 - R() * 14, (3 + R() * 2) * S, .9 + R() * .5, .22);
            }
            let best = null, bd = 1e9;
            for (const e of ENEMIES) {
                if (e.dead > 0 || e.dying > 0) continue;
                const h = bulletHit(p, px, py, e, S);
                if (h && h.d < bd) { bd = h.d; best = { e, h } }
            }
            if (best) { flareHit(p, best.e, best.h, S); flares.splice(i, 1); continue }
            if (flSmallHit(p, px, py)) { flares.splice(i, 1); continue }
            const onDeck = p.dh > 0 && typeof TH_WX !== 'undefined' && typeof TH_SC !== 'undefined' && p.x >= (TH_WX - 285 * TH_SC) && p.x <= (TH_WX + 205 * TH_SC);
            const landY = onDeck ? -p.dh : 0;
            if (p.y > landY) {
                if (!onDeck && inPond(p.x)) { for (let k = 0; k < 4; k++) addSmoke(p.x + (R() - .5) * 10, -2, (R() - .5) * 30, -30 - R() * 40, 6 * S, .8, .35); flares.splice(i, 1); continue }
                if (!p.bn && p.vy > 260) { p.bn = 1; p.y = landY - 1; p.vy *= -.3; p.vx *= .55; burst(p.x, landY - 2, 5, 160, p.F); continue }
                p.y = landY; p.st = 1; p.t = 0; p.vx = 0; p.vy = 0; groundFX(p.x, p.F); continue;
            }
            if (Math.abs(p.x - p.x0) > 2600 || p.age > 4) flares.splice(i, 1);
        } else {
            p.t += dt;
            if (R() < dt * 40) addSpark(p.x + (R() - .5) * 6, p.y - 4, (R() - .5) * 110, -(60 + R() * 150), .25 + R() * .3);
            if (R() < dt * 14) addSmoke(p.x + (R() - .5) * 6, p.y - 8, (R() - .5) * 10, -22 - R() * 18, (4 + R() * 3) * S, 1.1 + R() * .6, .2);
            if (p.t > FL_GROUND_T) flares.splice(i, 1);
        }
    }

    // burning enemies
    for (const e of ENEMIES) {
        if (!(e.burn > 0)) continue;
        e.burn -= dt;
        if (R() < dt * 25) addSpark(e.x + (R() - .5) * 30 * S, -(40 + R() * 240) * S, (R() - .5) * 40, -(60 + R() * 100), .35 + R() * .3);
        if (R() < dt * 10) addSmoke(e.x + (R() - .5) * 24 * S, -(200 + R() * 120) * S, (R() - .5) * 10, -30, 5 * S, 1, .2);
        if (e.dead > 0 || e.dying > 0) continue;           // corpses keep their flames but take no more damage
        e.hp -= FL_BURN_DPS * dt; e.bar = 2.5;
        if (e.hp <= 0) { e.hp = 0; e.dying = .5; banner.t = 1.1; banner.text = 'BURNED!'; if (P.grabbed === e) P.grabbed = null }
    }
}

// ================= DRAWING: flares, fire, shell in hand =================
function flFlame(x, y, h, w, seed, now, a) {
    const fl = .75 + .25 * Math.sin(now * 22 + seed * 3.1), H = h * fl, lean = Math.sin(now * 9 + seed) * w * .35;
    ctx.save(); ctx.globalAlpha = a;
    const g = ctx.createLinearGradient(x, y, x, y - H);
    g.addColorStop(0, 'rgba(255,240,170,.95)'); g.addColorStop(.35, 'rgba(255,170,50,.9)'); g.addColorStop(1, 'rgba(220,60,10,0)');
    ctx.fillStyle = g; ctx.strokeStyle = 'rgba(60,25,10,.5)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x - w, y);
    ctx.bezierCurveTo(x - w * 1.1, y - H * .45, x + lean - w * .3, y - H * .7, x + lean, y - H);
    ctx.bezierCurveTo(x + lean + w * .3, y - H * .7, x + w * 1.1, y - H * .45, x + w, y);
    ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
}

function drawFlareFX(gy) {
    const now = performance.now() / 1000, S = CSc();
    ctx.save(); ctx.lineCap = 'round';

    for (const p of flares) {
        const sx = p.x - P.x + W / 2, sy = gy + 4 + p.y;
        if (sx < -250 || sx > W + 250) continue;
        const fl = .85 + .15 * Math.sin(now * 45 + p.seed);
        if (p.st === 0) {
            const l = Math.hypot(p.vx, p.vy) || 1, R = 100 * S * fl;
            const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, R);
            g.addColorStop(0, 'rgba(255,150,110,.55)'); g.addColorStop(.35, 'rgba(255,80,50,.2)'); g.addColorStop(1, 'rgba(255,60,30,0)');
            ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, R, 0, 7); ctx.fill();
            ctx.strokeStyle = 'rgba(255,90,60,.6)'; ctx.lineWidth = 6 * S; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - p.vx / l * 36 * S, sy - p.vy / l * 36 * S); ctx.stroke();
            ctx.strokeStyle = 'rgba(255,230,200,.9)'; ctx.lineWidth = 2.4 * S; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - p.vx / l * 24 * S, sy - p.vy / l * 24 * S); ctx.stroke();
            ctx.fillStyle = '#fff4ec'; ctx.strokeStyle = '#c0301a'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(sx, sy, 4.6 * S, 0, 7); ctx.fill(); ctx.stroke();
        } else {
            const fade = Math.min(1, (FL_GROUND_T - p.t) / 1.2), R = 125 * S * fl * fade;
            const g = ctx.createRadialGradient(sx, sy - 4, 0, sx, sy - 4, R);
            g.addColorStop(0, 'rgba(255,150,110,.5)'); g.addColorStop(.4, 'rgba(255,80,50,.16)'); g.addColorStop(1, 'rgba(255,60,30,0)');
            ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy - 4, R, 0, 7); ctx.fill();
            flFlame(sx, sy - 2, 30 * S, 6 * S, p.seed, now, fade);
            ctx.globalAlpha = fade; ctx.fillStyle = '#fff4ec'; ctx.strokeStyle = '#c0301a'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(sx, sy - 2, 3.4 * S, 0, 7); ctx.fill(); ctx.stroke();
        }
    }

    // flames on burning enemies
    for (const e of ENEMIES) {
        if (!(e.burn > 0)) continue;
        const sx = e.x - P.x + W / 2; if (sx < -150 || sx > W + 150) continue;
        const a = Math.min(1, e.burn / .6), base = gy + 4 + Math.min(0, e.z || 0);
        const low = e.down > 0 || e.crawl || e.dead > 0;
        for (let k = 0; k < 6; k++) {
            const sd = k * 7.3 + (e.x % 17);
            if (low) flFlame(sx + (k - 2.5) * 22 * S, base - (4 + (k % 2) * 8) * S, 38 * S, 9 * S, sd, now, a);
            else flFlame(sx + Math.sin(sd) * 14 * S, base - (30 + k * 48) * S, 46 * S, 10 * S, sd, now, a);
        }
    }

    // fresh shell in the off hand while reloading
    if (P.wt === 'flare' && P.rl > 0) {
        const u = P.rl / RELOAD_T, h = P.armPts && P.armPts[1] && P.armPts[1][1];
        if (h && u >= RL_GRAB && u < RL_INSERT - .02) {
            ctx.save(); ctx.translate(P.x + h[0] * S - P.x + W / 2, gy + 4 + h[1] * S); ctx.scale(P.face, 1); ctx.rotate(P.cylA || 0);
            ctx.lineWidth = 1.4; ctx.strokeStyle = '#111';
            ctx.fillStyle = '#c4281e'; ctx.beginPath(); ctx.rect(-7, -4, 12, 8); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#c99a3a'; ctx.beginPath(); ctx.rect(5, -4, 4, 8); ctx.fill(); ctx.stroke();
            ctx.restore();
        }
    }
    ctx.restore();
}

function drawFlareProp(gy, front) {                        // front=false: lying on the ground/deck, front=true: flipping through the air
    const g = FLG;
    if (!g.on || !!g.flying !== front) return;
    const S = CSc(), dh = g.dh || 0;
    const sx = g.x - P.x + W / 2, sy = gy - dh + 4 + g.y;
    if (sx < -250 || sx > W + 250) return;
    if (g.flying) {                                        // motion-blur afterimages
        ctx.save(); ctx.strokeStyle = '#111'; ctx.lineCap = 'round';
        g.tr.forEach((q, j) => {
            ctx.save(); ctx.translate(q[0] - P.x + W / 2, gy - dh + 4 + q[1]); ctx.scale(S * g.F, S); ctx.rotate(q[2]);
            ctx.globalAlpha = .05 + .07 * j; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(56, -12); ctx.stroke(); ctx.restore();
        });
        ctx.restore();
    } else if (!g.air && !(P.fgp > 0) && !(P.wt === 'flare' && P.gun)) {   // dashed ring + key hint
        const cxs = flCenter(S) - P.x + W / 2, near = Math.abs(flCenter(S) - P.x) < FL_RANGE * S && Math.abs((P.dh || 0) - dh) < 80, now = performance.now();
        ctx.save(); ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
        ctx.globalAlpha = (near ? .5 : .25) + .2 * Math.sin(now / 250);
        ctx.beginPath(); ctx.ellipse(cxs, gy - dh + 6, 70 * S, 8, 0, 0, 7); ctx.stroke(); ctx.restore();
        if (near) { ctx.save(); ctx.fillStyle = '#111'; ctx.font = 'italic bold 22px Georgia,serif'; ctx.textAlign = 'center'; ctx.fillText(FL_KEY_LABEL, cxs, gy - dh - 50 * S - 4 * Math.sin(now / 200)); ctx.restore() }
    }
    ctx.save(); ctx.translate(sx, sy); ctx.scale(S * g.F, S); ctx.rotate(g.th);
    ctx.globalAlpha = 1; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = '#111';
    drawFlarePistol(0, 0, P.fAmmo > 0);
    ctx.restore();
}

