// bow.js - realistic bow & arrow for Ink Walker. Drop-in: needs only <script src="bow.js"></script> after the main script.
// Q = take out / put away bow | hold F = nock & draw, release F = loose | W/S = aim | Space = relax | T = pick up arrows
(() => {
    'use strict';
    const CFG = {
        quiver: 20, drawTime: 1.05, vMin: 650, vMax: 4350,   // px/s, scales with draw (energy ~ draw^1.25)
        gravity: 1500, drag: .000045, windPush: .25,         // arrows drop, slow down and drift in the wind
        preview: true,                                       // faint trajectory dots at full draw (set false for pure skill)
        life: 120                                            // seconds a spent arrow stays on the ground
    };
    // L_ARROW = arrow length, LDRAW = full draw length (must stay < L_ARROW so the head clears the bow hand)
    const L_ARROW = 118, HL = 92, LDRAW = 100, TB0 = 16, PSI_C = -1.25, BP = { lean: -.05, hipY: 7, hx: 3, hy: 1 };
    const BW = window.BOW = { out: false, eq: 0, w: 0, d: 0, dh: 0, vib: 0, aim: .1, sway: 0, hold: 0, fat: 0, tired: false, cd: 0, rt: 9, ammo: CFG.quiver, ai: 0, fr: null, t: 0, arrows: [], saved: null, dirIn: 0, ok: false, msg: 0, qa: 0, qv: 0 };
    const A = BW.arrows, lp = (a, b, k) => a + (b - a) * k, c01 = v => Math.max(0, Math.min(1, v));
    const safe = f => { try { return f() } catch (e) { return false } };
    const spd = (d, fat) => (CFG.vMin + (CFG.vMax - CFG.vMin) * Math.pow(d, 1.25)) * (1 - .18 * fat);
    const say = (t, s) => { banner.t = t; banner.text = s };

    const busy = () => !!(P.mount || swim.on || P.z < 0 || P.pk > 0 || P.stc > 0 || P.cs > 0 || P.fin > 0 || P.thw > 0 || P.tt > 0 || P.stbk > 0 || P.fs > 0 || P.gu > 0 ||
        P.yk > 0 || P.sgp > 0 || P.sm > 0 || P.ln > 0 || P.lb > 0 || P.ld > 0 || P.pu > 0 || P.sqg > 0 || P.sqt > 0 || P.dts > 0 || P.stm > 0 || P.mpk > 0 || P.mSl > 0 ||
        P.sqSl > 0 || P.gun || P.gs === 2 || P.sg || P.kn !== 0 || P.kt > .05 || TH_CL.on || DD.carry || DD.g.on);

    function toggle() {
        if (BW.out) { BW.out = false; return }
        if (P.gun || P.gs === 2 || P.sg) return say(.7, 'HOLSTER GUN FIRST');
        if (P.kn !== 0 || P.kt > .05) return say(.7, 'PUT KNIFE AWAY (K)');
        if (P.mount) return say(.7, 'DISMOUNT FIRST (H)');
        BW.out = true; say(.6, 'BOW READY');
    }
    addEventListener('keydown', e => {
        if (e.repeat) return;
        if (e.code === 'KeyQ') toggle();
        if (e.code === 'Space' && BW.d > 0) BW.tired = true;       // relax the string without shooting
    });

    // ---------------- floor under an x position (ground, mountain slope, deck, dock) ----------------
    function floorY(x, py) {
        let f = -(safe(() => mtGround(x)) || 0);
        const deck = -TH_DY * TH_SC;
        if (x > TH_WX - 285 * TH_SC && x < TH_WX + 205 * TH_SC && py <= -deck + 6) f = Math.min(f, -deck);
        if (x >= DOCK_X0 && x <= DOCK_X1) f = Math.min(f, -2);
        return f;
    }

    // ---------------- pre / post update: stance lock, draw state machine ----------------
    function pre(dt) {
        BW.t += dt; BW.rt += dt; BW.cd = Math.max(0, BW.cd - dt); BW.msg -= dt;
        if (BW.out && (P.gun || P.gs === 2 || P.sg || P.kn !== 0 || P.kt > .05 || P.mount || swim.on)) BW.out = false;
        const ok = BW.ok = BW.out && !busy(), held = !!keys.KeyF;
        const want = ok && held && BW.ammo > 0;
        if (BW.out && held && BW.ammo <= 0 && BW.msg <= 0) { BW.msg = 1.2; say(.7, 'NO ARROWS') }
        if (!held) BW.tired = false;
        BW.eq += ((BW.out ? 1 : 0) - BW.eq) * Math.min(1, dt * 9);
        const up = keys.ArrowUp || keys.KeyW, dn = keys.ArrowDown || keys.KeyS;
        const raise = ok && (want || BW.d > 0 || BW.rt < .45);
        BW.w += ((raise ? 1 : 0) - BW.w) * Math.min(1, dt * (raise ? 7 : 5));
        if (!raise && BW.w < .004) BW.w = 0;
        if (ok && BW.w > .3) BW.aim = Math.max(-.6, Math.min(1, BW.aim + ((up ? 1 : 0) - (dn ? 1 : 0)) * 1.25 * dt));
        if (!ok && BW.d > 0) { BW.d = 0; BW.hold = 0 }
        // draw
        if (want && BW.w > .92 && BW.cd <= 0 && !BW.tired) {
            BW.d = Math.min(1, BW.d + dt / CFG.drawTime);
            if (BW.d >= 1) { BW.hold += dt; if (BW.hold > 6.5) BW.tired = true }
        } else if (BW.d > 0 && ok) {
            if (BW.tired || BW.d < .2) { BW.d = Math.max(0, BW.d - dt * 2.2); if (BW.d <= 0) BW.hold = 0 }   // slack: no shot
            else loose();
        }
        BW.fat = BW.d >= 1 ? c01((BW.hold - 2) / 3.5) : Math.max(0, BW.fat - dt * .6);
        BW.dh = Math.max(0, BW.dh - dt * 3.2);
        const k = 1 + 4 * BW.fat;
        BW.sway = (Math.sin(BW.t * 1.3) * .010 + Math.sin(BW.t * 2.9 + 1) * .006) * k * (BW.d > 0 ? 1 : .4) + Math.sin(BW.t * 31) * .004 * BW.fat;
        // quiver swing: a damped spring that lags behind the body when you start / stop / run
        {
            const h = Math.min(dt, .033), vx = P.vx || 0, tgt = -Math.max(-1, Math.min(1, vx / 500)) * .2;
            BW.qv += (150 * (tgt - BW.qa) - 12 * BW.qv) * h; BW.qa += BW.qv * h;
            BW.qa = Math.max(-.5, Math.min(.5, BW.qa));
        }
        // aiming roots the player; A/D only turns him
        if (ok && BW.w > .08) {
            BW.dirIn = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
            BW.saved = [keys.ArrowLeft, keys.ArrowRight, keys.KeyA, keys.KeyD];
            keys.ArrowLeft = keys.ArrowRight = keys.KeyA = keys.KeyD = 0;
            P.jbuf = 0; P.abuf = 0;
        }
    }
    function post() {
        if (BW.saved) {
            [keys.ArrowLeft, keys.ArrowRight, keys.KeyA, keys.KeyD] = BW.saved; BW.saved = null;
            if (BW.dirIn) P.face = BW.dirIn;
            P.idle = 0; P.fid = 0;
        }
    }
    const _upd = window.update;
    window.update = function (dt) { pre(dt); _upd.call(this, dt); post() };

    // ---------------- loose the arrow ----------------
    function loose() {
        const f = BW.fr; if (!f) { BW.d = 0; return }
        const S = CSc(), d = BW.d, dist = TB0 + (LDRAW - TB0) * d, v = spd(d, BW.fat);
        const th = Math.atan2(f.u[1], f.u[0]) + (Math.random() - .5) * (.012 + .05 * BW.fat + .02 * (1 - d));   // human error: fatigue, weak draw
        const gx = P.x + f.g[0] * S, gy = f.g[1] * S - (P.dh || 0) - (P.mh || 0), len = (L_ARROW - dist) * S;
        A.push({
            st: 'fly', x: gx + f.u[0] * len, y: gy + f.u[1] * len, vx: Math.cos(th) * v + P.vx * .3, vy: Math.sin(th) * v,
            F: Math.cos(th) >= 0 ? 1 : -1, age: 0, pw: c01(v / CFG.vMax), ang: th
        });
        BW.ammo--; BW.cd = .55; BW.dh = d; BW.vib = 6 + 9 * d; BW.rt = 0; BW.d = 0; BW.hold = 0;
        shake = Math.max(shake, 1.5 + 1.5 * d); playSfx('throw', .85);
    }

    // ---------------- arrow flight, impacts, sticking ----------------
    function embed(a, e, h) {
        a.st = 'emb'; a.e = e; a.ox = h.x - e.x; a.oy = h.y; a.ang = Math.atan2(a.vy, a.vx); a.age = 0; a.depth = 16 + 12 * a.pw;
        const mine = A.filter(q => q.st === 'emb' && q.e === e);
        if (mine.length > 5) A.splice(A.indexOf(mine[0]), 1);
    }
    function hitEnemy(a, e, h, S) {
        const F = a.F, pw = a.pw, head = h.head;
        if (!head && h.y > -150 * S && safe(() => legShot(a, e, h, S))) { embed(a, e, h); return }
        const dmg = head ? Math.round(30 + 85 * pw) : Math.round(10 + 34 * pw);
        e.hp -= dmg; e.bar = 2.5; e.kdir = F; e.face = -F; e.hurt = Math.max(e.hurt, .4); e.vx = F * (head ? 220 : 110); e.wait = 1; e.fid = 0;
        combo.n++; combo.dmg += dmg; combo.t = 1.8; combo.pop = 1.3;
        spray(h.x, h.y, head ? 20 : 12, 300 + 300 * pw, F); spray(h.x, h.y, 6, 200, -F); burst(h.x, h.y, head ? 12 : 7, 220, F);
        impacts.push({ x: h.x, y: h.y, t: 0, life: .18, s: head ? 70 : 48, seed: Math.random() * 50 });
        hitstop = Math.max(hitstop, head ? .06 : .035); shake = Math.max(shake, head ? 6 : 3.5); playSfx('stab', 1);
        if (e.hp <= 0) { e.hp = 0; e.dying = .5; say(1.1, head ? 'HEADSHOT KILL!' : 'K.O.!'); if (P.grabbed === e) P.grabbed = null }
        else say(.8, head ? 'HEADSHOT!' : 'ARROW!');
        embed(a, e, h);
    }
    function step(a, i, dt, S) {
        const px = a.x, py = a.y, v = Math.hypot(a.vx, a.vy);
        a.vx += (-CFG.drag * v * a.vx + wind.v * CFG.windPush) * dt;     // air drag + wind drift
        a.vy += (CFG.gravity - CFG.drag * v * a.vy) * dt;                // gravity
        a.x += a.vx * dt; a.y += a.vy * dt; a.F = a.vx >= 0 ? 1 : -1;
        let best = null, bd = 1e9;
        for (const e of ENEMIES) {
            if (e.dead > 0 || e.dying > 0) continue;
            const h = bulletHit(a, px, py, e, S);
            if (h && h.d < bd) { bd = h.d; best = { e, h } }
        }
        if (best) { hitEnemy(a, best.e, best.h, S); return }
        const X = a.x, Y = a.y, F = a.F;
        if (safe(() => headGoreHit(px, py, X, Y, F, false)) || safe(() => birdsHit(px, py, X, Y, F, 20)) || safe(() => fowlHit(px, py, X, Y, F, 20)) ||
            safe(() => bflyHit(px, py, X, Y, F, 20)) || safe(() => clothHit(px, py, X, Y, F)) || safe(() => thSqHit(px, py, X, Y, F, 20)) ||
            safe(() => frogHit(a, px, py, false)) || safe(() => duckHit(a, px, py, false)) || safe(() => crocHit(a, px, py)) || safe(() => horseHit(a, px, py, false))) { a.dead = 1; return }
        if (onWater(a.x) && a.y >= waterSurfaceY(a.x)) {                  // into the pond: splash, scared fish, gone
            splash(a.x, Math.min(7, 2 + v / 900), 8); shockFish(a.x, 10, 160);
            for (let k = 0; k < 3; k++) addBubble(a.x, 6 + Math.random() * 14);
            a.dead = 1; return;
        }
        const f = floorY(a.x, py);
        if (a.y >= f) {                                                   // stick in the ground at the real impact angle
            const t = c01((f - py) / ((a.y - py) || 1));
            a.x = px + (a.x - px) * t; a.y = f; a.ang = Math.atan2(a.vy, a.vx);
            a.st = 'gnd'; a.age = 0; a.depth = Math.max(5, Math.min(30, v / 150)) * Math.min(1, Math.abs(Math.sin(a.ang)) * 3 + .25);
            burst(a.x, f - 2, 6, 170, F); safe(() => groundFX(a.x, F)); shake = Math.max(shake, 1.5); playSfx('stab', .45);
            return;
        }
        if (a.age > 6 || Math.abs(a.x - P.x) > 12000 || a.y < -20000) a.dead = 1;
    }
    function tick(dt) {
        if (!(dt > 0)) return;
        const S = CSc();
        for (let i = A.length - 1; i >= 0; i--) {
            const a = A[i]; a.age += dt;
            if (a.st === 'fly') step(a, i, dt, S);
            else if (a.st === 'emb') {
                const e = a.e;
                if (e.dying > 0 || e.dead > 0 || e.decap || e.hsDead || e.gutDead || e.crawl) {   // victim drops: arrow pops free and falls
                    a.x = e.x + a.ox; a.y = a.oy; a.vx = (e.vx || 0) * .4 + (Math.random() - .5) * 80; a.vy = -60; a.st = 'fall'; a.spin = (Math.random() - .5) * 7; a.age = 0;
                }
            } else if (a.st === 'fall') {
                a.vy += 1500 * dt; a.x += a.vx * dt; a.y += a.vy * dt; a.ang += a.spin * dt;
                const f = floorY(a.x, a.y - 5);
                if (a.y >= f - 2) {
                    a.y = f - 2; a.st = 'gnd'; a.age = 0; a.depth = 0; a.ang = (Math.random() < .5 ? .12 : Math.PI - .12); a.flat = 1;
                    burst(a.x, f, 3, 100, 1);
                }
            } else if (a.age > CFG.life) a.dead = 1;
            if (a.dead) A.splice(i, 1);
        }
        while (A.length > 70) { const k = A.findIndex(q => q.st === 'gnd'); A.splice(k < 0 ? 0 : k, 1) }
    }
    const _gt = window.gunTick;
    window.gunTick = function (dt) { _gt.call(this, dt); tick(dt) };

    // ---------------- pick arrows up again (T) ----------------
    const _pp = window.pressPickup;
    window.pressPickup = function () {
        if (!P.mount && !swim.on && P.z >= 0) {
            const S = CSc(), lvl = -(P.dh || 0) - (P.mh || 0); let bi = -1, bd = 95 * S;
            A.forEach((a, i) => { if (a.st !== 'gnd') return; const d = Math.abs(a.x - P.x); if (d < bd && Math.abs(a.y - lvl) < 90 * S) { bd = d; bi = i } });
            if (bi >= 0) { A.splice(bi, 1); BW.ammo++; say(.7, 'ARROW RECOVERED'); playSfx('pickup', .7); return }
        }
        return _pp.apply(this, arguments);
    };

    // ---------------- body pose: braced archer stance (legs + torso), arms handled below ----------------
    const _cp = window.comboPose;
    window.comboPose = function (Q) {
        const o = _cp.call(this, Q);
        if (o || Q !== PL || BW.w < .02) return o;
        return {
            w: BW.w, a0: .08, f0: 0, a1: .08, f1: 0, lean: BP.lean - .03 * BW.d, hipX: -2 * BW.d, hipY: BP.hipY, arch: .03, hx: BP.hx, hy: BP.hy,
            l0: [30, 0, 0], l1: [-34, 0, 0], st: STEPS[0], sw: 0, ik: 0, noArms: true
        };
    };

    // ---------------- arms: bow arm extended, string arm hauls to the cheek anchor ----------------
    function wristOf(sh, a, f, F) {
        const d1 = [Math.sin(a) * F, Math.cos(a)], el = [sh[0] + d1[0] * 58, sh[1] + d1[1] * 58], d2 = [Math.sin(a + f) * F, Math.cos(a + f)];
        return { wr: [el[0] + d2[0] * 56, el[1] + d2[1] * 56], d2 };
    }
    function ikFlip(sh, tx, ty, F) {                                       // same as ikTo but the elbow points back and up
        const dx = tx - sh[0], dy = ty - sh[1], dl = Math.hypot(dx, dy) || 1;
        const X = (tx - dx / dl * 11 - sh[0]) * F, Y = ty - dy / dl * 11 - sh[1], a = 58, b = 56, d = Math.max(10, Math.min(a + b - .5, Math.hypot(X, Y)));
        const phi = Math.atan2(X, Y), al = Math.acos(Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d)))), be = Math.acos(Math.max(-1, Math.min(1, (b * b + d * d - a * a) / (2 * b * d))));
        return [phi + al, -(al + be)];
    }
    const _arm = window.arm;
    window.arm = function (sh, ang, flex, F, kt, pq, tq) {
        if (CUR !== PL || BW.eq < .02) return _arm(sh, ang, flex, F, kt, pq, tq);
        const i = BW.ai++, w = BW.w, d = BW.d, now = performance.now() / 1000, fat = BW.fat;
        const tr = [Math.sin(now * 41) * 1.3 * fat + Math.sin(now * 1.7) * .5, Math.sin(now * 37 + 1) * 1.1 * fat + Math.sin(now * 1.3) * .6];
        if (i === 0) {
            const lean = (BP.lean - .03 * d) * w, l = F * lean, bx = F * (-7 + BP.hx * w), by = -34 + BP.hy * w;       // where the face is, relative to the shoulder
            const An = [sh[0] + bx * Math.cos(l) - by * Math.sin(l) + F * 15, sh[1] + bx * Math.sin(l) + by * Math.cos(l) + 11];
            const psi = BW.aim + BW.sway, uA = [F * Math.cos(psi), -Math.sin(psi)];
            if (w > .003) {
                const [ia, ifl] = ikTo(sh, An[0] + uA[0] * LDRAW + tr[0], An[1] + uA[1] * LDRAW + tr[1], F);
                ang = lp(ang, ia, w); flex = lp(flex, ifl, w);
            }
            const { wr, d2 } = wristOf(sh, ang, flex, F), psiE = lp(PSI_C, psi, w), g = [wr[0] + d2[0] * 11, wr[1] + d2[1] * 11];
            BW.fr = { sh, F, g, u: [F * Math.cos(psiE), -Math.sin(psiE)], psi: psiE, An };
        } else if (BW.fr && w > .003) {
            const fr = BW.fr, dd = Math.max(d, BW.dh), w1 = sm((w - .35) / .65), rest = wristOf(sh, ang, flex, F);
            const hx = lp(rest.wr[0] + rest.d2[0] * 11, fr.g[0] - fr.u[0] * (TB0 + (LDRAW - TB0) * dd) + tr[0] * .6, w1);
            const hy = lp(rest.wr[1] + rest.d2[1] * 11, fr.g[1] - fr.u[1] * (TB0 + (LDRAW - TB0) * dd) + tr[1] * .6, w1);
            [ang, flex] = ikFlip(sh, hx, hy, F);
        }
        return _arm(sh, ang, flex, F, 0, pq, tq);
    };
    const _dc = window.drawChar;
    window.drawChar = function (cx, gy, Q) { if (Q === PL) { BW.ai = 0; BW.fr = null } return _dc.call(this, cx, gy, Q) };

    // ---------------- art ----------------
    function arrowShape() {                                                // tip at (0,0), points +x, local units = character units
        const INK = '#111', L = L_ARROW;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        // slim shaft: ink outline, light cedar core, thin highlight
        ctx.strokeStyle = INK; ctx.lineWidth = 3.3; ctx.beginPath(); ctx.moveTo(-L + 4, 0); ctx.lineTo(-18, 0); ctx.stroke();
        ctx.strokeStyle = '#d6aa6e'; ctx.lineWidth = 1.6; ctx.stroke();
        ctx.strokeStyle = 'rgba(255,242,210,.65)'; ctx.lineWidth = .6; ctx.beginPath(); ctx.moveTo(-L + 48, -.5); ctx.lineTo(-30, -.5); ctx.stroke();
        // cresting bands just ahead of the fletching
        ctx.lineCap = 'butt'; ctx.strokeStyle = '#8a2c1c'; ctx.lineWidth = 2;
        for (const x of [-L + 44, -L + 48]) { ctx.beginPath(); ctx.moveTo(x, -.8); ctx.lineTo(x, .8); ctx.stroke() }
        ctx.lineCap = 'round';
        // fletching: low swept shield-cut vanes, tall at the nock end and tapering toward the head
        for (const s of [-1, 1]) {
            ctx.beginPath(); ctx.moveTo(-L + 5, s * .9);
            ctx.quadraticCurveTo(-L + 6, s * 7.4, -L + 14, s * 6.6);
            ctx.quadraticCurveTo(-L + 28, s * 5.2, -L + 39, s * .9);
            ctx.closePath();
            ctx.fillStyle = s < 0 ? '#7e2519' : '#b6402a'; ctx.fill(); ctx.lineWidth = 1.3; ctx.strokeStyle = INK; ctx.stroke();
            ctx.strokeStyle = 'rgba(40,8,4,.7)'; ctx.lineWidth = .6; ctx.beginPath();
            for (let k = 0; k < 6; k++) {                                  // barbs lean toward the head
                const o = 8 + k * 4.4, hh = Math.max(2, 6.4 - Math.max(0, o + 3 - 14) * .22);
                ctx.moveTo(-L + o, s * 1.1); ctx.lineTo(-L + o + 3, s * hh);
            }
            ctx.stroke();
        }
        // nock: small flared knob with a string slot
        ctx.beginPath(); ctx.moveTo(-L - 1.5, -2.5); ctx.lineTo(-L + 5.5, -1.6); ctx.lineTo(-L + 5.5, 1.6); ctx.lineTo(-L - 1.5, 2.5); ctx.closePath();
        ctx.fillStyle = '#2a1c12'; ctx.fill(); ctx.lineWidth = 1.1; ctx.strokeStyle = INK; ctx.stroke();
        ctx.strokeStyle = '#d9d0b4'; ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(-L - 1, 0); ctx.lineTo(-L + 2, 0); ctx.stroke();
        // steel collar + long needle-point leaf head
        ctx.beginPath(); ctx.rect(-24, -2.1, 5, 4.2); ctx.fillStyle = '#5d5f64'; ctx.fill(); ctx.lineWidth = 1.1; ctx.strokeStyle = INK; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-8, -2.1, -13, -4.7); ctx.lineTo(-19, -3.1); ctx.lineTo(-19, 3.1); ctx.lineTo(-13, 4.7); ctx.quadraticCurveTo(-8, 2.1, 0, 0); ctx.closePath();
        ctx.fillStyle = '#9a9da3'; ctx.fill(); ctx.lineWidth = 1.4; ctx.strokeStyle = INK; ctx.stroke();
        ctx.fillStyle = 'rgba(40,42,48,.45)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-8, 2.1, -13, 4.7); ctx.lineTo(-19, 3.1); ctx.lineTo(-19, 0); ctx.closePath(); ctx.fill();   // shaded lower half
        ctx.strokeStyle = '#e3e5e9'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(-1.5, 0); ctx.lineTo(-17, 0); ctx.stroke();   // centre ridge shine
    }

    // arrow poking out of the quiver mouth: nock end up, fletching visible
    function quiverArrow(hk, redder) {
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -hk); ctx.stroke();
        ctx.strokeStyle = '#d6aa6e'; ctx.lineWidth = 1.4; ctx.stroke();
        for (const s of [-1, 1]) {
            ctx.beginPath(); ctx.moveTo(s * .8, -hk + 3);
            ctx.quadraticCurveTo(s * 5.2, -hk + 3.2, s * 4.6, -hk + 9);
            ctx.quadraticCurveTo(s * 2.8, -hk + 14, s * .8, -hk + 16); ctx.closePath();
            ctx.fillStyle = (s < 0) === redder ? '#7e2519' : '#b6402a'; ctx.fill(); ctx.lineWidth = 1.1; ctx.strokeStyle = '#111'; ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(0, -hk - .4, 1.7, 0, 7); ctx.fillStyle = '#2a1c12'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = '#111'; ctx.stroke();
    }

    function top(F, S, now) {                                              // after the head: quiver, bow, string, arrow, hands
        const fr = BW.fr; if (!fr || BW.eq < .02) return;
        const eq = sm(BW.eq), w = BW.w, d = BW.d, g = fr.g, u = fr.u, psi = fr.psi, t = [-F * Math.sin(psi), -Math.cos(psi)];
        ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        {   // ---- quiver: strapped to the back, swings and bounces with movement ----
            // torso lean (forward = +): shoulder offset from the hip line, so the quiver follows the body when walking / running
            const th0 = Math.max(-.15, Math.min(.9, Math.atan2(F * fr.sh[0], 56)));
            BW.th = BW.th === undefined ? th0 : BW.th + (th0 - BW.th) * .6;
            const th = BW.th, rot = F * (th - .2 - .03 * w);   // same back-tilt relative to the spine as when standing
            const QY = 30, QX = 12, QS = .9, QL = 22;   // quiver: height (bigger = lower), distance behind the spine, size, extra length added downward (mouth stays put)
            const sx = F * Math.sin(th), sy = -Math.cos(th);   // spine direction hip -> shoulder
            const ox = fr.sh[0] - F * Math.cos(th) * QX - sx * QY, oy = fr.sh[1] - Math.sin(th) * QX - sy * QY;   // sit behind the back, down the spine
            ctx.save(); ctx.translate(ox, oy); ctx.rotate(rot); ctx.scale(QS, QS); ctx.strokeStyle = '#111';
            ctx.beginPath(); ctx.moveTo(-8, -30); ctx.lineTo(8, -30); ctx.lineTo(6.2, 24 + QL); ctx.quadraticCurveTo(0, 33 + QL, -6.2, 24 + QL); ctx.closePath();   // tapered leather body
            ctx.fillStyle = '#6a4326'; ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
            ctx.strokeStyle = '#8a5a33'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-4.6, -24); ctx.lineTo(-3.6, 21 + QL); ctx.stroke();                 // highlight
            ctx.strokeStyle = '#3a2414'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-8, -24); ctx.lineTo(8, -24); ctx.moveTo(-7.2, 6); ctx.lineTo(7.2, 6); ctx.moveTo(-6.8, 6 + QL * .9); ctx.lineTo(6.8, 6 + QL * .9); ctx.stroke();   // bands
            ctx.setLineDash([2, 2.4]); ctx.strokeStyle = '#d6b27c'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(5.6, -20); ctx.lineTo(4.6, 20 + QL); ctx.stroke(); ctx.setLineDash([]);   // stitching
            ctx.fillStyle = '#3a2414'; ctx.beginPath(); ctx.moveTo(-6.2, 24 + QL); ctx.quadraticCurveTo(0, 33 + QL, 6.2, 24 + QL); ctx.quadraticCurveTo(0, 27.5 + QL, -6.2, 24 + QL); ctx.fill();          // base cap
            ctx.beginPath(); ctx.ellipse(0, -30, 8, 2.7, 0, 0, 7); ctx.fillStyle = '#1a1008'; ctx.fill(); ctx.lineWidth = 2.4; ctx.strokeStyle = '#111'; ctx.stroke();           // open mouth
            const n = Math.min(5, BW.ammo);
            for (let k = 0; k < n; k++) {                                  // arrows rattle a little more than the quiver itself
                const m = k - (n - 1) / 2, hk = 30 + ((k * 7) % 4) * 3.5;
                ctx.save(); ctx.translate(m * 2.8, -30); ctx.rotate(m * .1);
                quiverArrow(hk, k % 2 === 0); ctx.restore();
            }
            ctx.restore();
            // small shoulder strap: holds the quiver, over the shoulder and down the chest to a tiny buckle
            const A = [ox + QS * 14 * Math.sin(rot), oy - QS * 14 * Math.cos(rot)],             // where it clips onto the quiver
                S1 = [fr.sh[0] - F * 1, fr.sh[1] - 3],                                         // over the top of the shoulder
                E = [fr.sh[0] - sx * 18 + F * Math.cos(th) * 5, fr.sh[1] - sy * 18 + Math.sin(th) * 5];   // chest, a little below
            ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            ctx.strokeStyle = '#111'; ctx.lineWidth = 3.6; ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(S1[0], S1[1]); ctx.lineTo(E[0], E[1]); ctx.stroke();
            ctx.strokeStyle = '#4a2f1a'; ctx.lineWidth = 1.8; ctx.stroke();
            ctx.fillStyle = '#8c8e93'; ctx.strokeStyle = '#111'; ctx.lineWidth = 1; ctx.beginPath(); ctx.rect(E[0] - 2.2, E[1] - 2.2, 4.4, 4.4); ctx.fill(); ctx.stroke();   // buckle
            ctx.beginPath(); ctx.arc(A[0], A[1], 2, 0, 7); ctx.fillStyle = '#8c8e93'; ctx.fill(); ctx.stroke();                                                         // clip on the quiver
            ctx.restore();
        }
        // bow limbs: belly faces the archer, tips flex back as it is drawn
        const N = 24, TB = TB0 + 14 * d, hl = HL * (.4 + .6 * eq), pts = [], wd = [];
        for (let k = 0; k <= N; k++) {
            const s = -1 + 2 * k / N, as = Math.abs(s), back = TB * Math.pow(as, 2.1);
            pts.push([g[0] + t[0] * s * hl - u[0] * back, g[1] + t[1] * s * hl - u[1] * back]); wd.push(3 + 6.4 * Math.pow(1 - as, 1.5));
        }
        const seg = (col, extra) => {
            for (let k = 0; k < N; k++) {
                const as = Math.abs((k + .5) / N * 2 - 1);
                ctx.strokeStyle = typeof col === 'function' ? col(as) : col; ctx.lineWidth = (wd[k] + wd[k + 1]) / 2 + extra;
                ctx.beginPath(); ctx.moveTo(pts[k][0], pts[k][1]); ctx.lineTo(pts[k + 1][0], pts[k + 1][1]); ctx.stroke();
            }
        };
        const nk = [g[0] - u[0] * (TB0 + (LDRAW - TB0) * d), g[1] - u[1] * (TB0 + (LDRAW - TB0) * d)];   // string nock point
        if (BW.rt < .5 && BW.vib > 0) { const o = Math.sin(BW.rt * 85) * BW.vib * Math.exp(-BW.rt * 13); nk[0] += u[0] * o; nk[1] += u[1] * o }
        const strn = () => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); ctx.lineTo(nk[0], nk[1]); ctx.lineTo(pts[N][0], pts[N][1]) };
        seg('#111', 3.4); seg(as => as > .84 ? '#8c8e93' : '#8a5329', 0);
        ctx.strokeStyle = '#c98a4e'; ctx.lineWidth = 1.3;
        ctx.beginPath(); for (let k = 3; k <= N - 3; k++) { const x = pts[k][0] + u[0] * 1.8, y = pts[k][1] + u[1] * 1.8; k === 3 ? ctx.moveTo(x, y) : ctx.lineTo(x, y) } ctx.stroke();
        ctx.strokeStyle = '#111'; ctx.lineWidth = 12.5; ctx.beginPath(); ctx.moveTo(g[0] - t[0] * 11, g[1] - t[1] * 11); ctx.lineTo(g[0] + t[0] * 11, g[1] + t[1] * 11); ctx.stroke();   // leather grip
        ctx.strokeStyle = '#3b2616'; ctx.lineWidth = 9; ctx.stroke();
        strn(); ctx.strokeStyle = '#111'; ctx.lineWidth = 2.4; ctx.stroke(); strn(); ctx.strokeStyle = '#e9e1c8'; ctx.lineWidth = 1.1; ctx.stroke();
        if (BW.ammo > 0 && w > .55 && BW.cd <= 0) {                        // nocked arrow, resting on the hand
            ctx.save(); ctx.translate(nk[0] + u[0] * L_ARROW, nk[1] + u[1] * L_ARROW); ctx.rotate(Math.atan2(u[1], u[0])); arrowShape(); ctx.restore();
        }
        const fist = i => { const f = P.fistInfo && P.fistInfo[i]; if (f && FIST.complete) { ctx.save(); ctx.translate(f.x, f.y); ctx.scale(f.F, 1); ctx.rotate(f.a - Math.PI / 2); ctx.drawImage(FIST, -FIST.naturalWidth / 2, -4); ctx.restore() } };
        // string hand: open back of the hand behind the string, three fingers hooked on it
        // (index above the arrow, middle + ring below), thumb relaxed - not a closed fist
        const hook = () => {
            const f = P.fistInfo && P.fistInfo[1]; if (!f) return;
            if (w < .45) return fist(1);
            ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(Math.atan2(u[1], u[0])); ctx.scale(1, F);   // local +x = toward the bow, -y = up
            ctx.fillStyle = '#111'; ctx.strokeStyle = '#111'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            ctx.beginPath(); ctx.ellipse(-4.8, .4, 6.4, 4.4, 0, 0, 7); ctx.fill();                       // back of hand
            ctx.lineWidth = 2.6;
            for (const o of [-4, 1.4, 4.6]) { ctx.beginPath(); ctx.moveTo(-6, o); ctx.lineTo(1.6, o); ctx.lineTo(-.8, o + 2); ctx.stroke() }   // hooked fingers
            ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-7, 3); ctx.lineTo(-12, 5.4); ctx.stroke();    // relaxed thumb
            ctx.restore();
        };
        fist(0);
        const Af = P.armFullPts && P.armFullPts[1];
        if (Af && w > .3) {                                                // string arm drawn over the face
            ctx.fillStyle = '#111';
            for (let j = 14; j <= 30; j++) { const q = j / 30, v = 1 - q, x = v * v * Af[0][0] + 2 * v * q * Af[1][0] + q * q * Af[2][0], y = v * v * Af[0][1] + 2 * v * q * Af[1][1] + q * q * Af[2][1]; ctx.beginPath(); ctx.arc(x, y, 1.8 + 2.4 * q, 0, 7); ctx.fill() }
        }
        hook();
        ctx.restore();
    }
    const _dlp = window.drawLanternProps;
    window.drawLanternProps = function (F, S, now) { _dlp.call(this, F, S, now); ctx.save(); try { top(F, S, now) } catch (e) { } ctx.restore() };

    // ---------------- world: arrows in flight / stuck, trajectory dots ----------------
    function worldDraw(gy) {
        const S = CSc(), now = performance.now() / 1000;
        for (const a of A) {
            let sx, sy, ang = a.ang, al = 1;
            if (a.st === 'emb') { sx = a.e.x + a.ox - P.x + W / 2; sy = gy + 4 + a.oy }
            else { sx = a.x - P.x + W / 2; sy = gy + 4 + a.y }
            if (sx < -250 || sx > W + 250) continue;
            ctx.save();
            if (a.st === 'fly') { ang = Math.atan2(a.vy, a.vx) + Math.sin(a.age * 70) * .07 * Math.exp(-a.age * 7); }
            else if (a.st === 'gnd') {
                if (!a.flat) { ctx.beginPath(); ctx.rect(sx - 300, sy - 1500, 600, 1500 + 1.5); ctx.clip() }
                ang += Math.sin(a.age * 55) * .1 * Math.exp(-a.age * 6.5); if (a.age > CFG.life - 8) al = Math.max(0, (CFG.life - a.age) / 8);
            } else if (a.st === 'emb') ang += Math.sin(a.age * 50) * .09 * Math.exp(-a.age * 6);
            ctx.globalAlpha = al; ctx.translate(sx, sy); ctx.rotate(ang); ctx.scale(S, S);
            if (a.st === 'gnd' || a.st === 'emb') ctx.translate(a.depth || 0, 0);
            if (a.st === 'fly') { ctx.strokeStyle = 'rgba(17,17,17,.28)'; ctx.lineWidth = 1.2; ctx.lineCap = 'round'; for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-L_ARROW - 8, k * 3); ctx.lineTo(-L_ARROW - 80, k * 3); ctx.stroke() } }
            arrowShape(); ctx.restore();
        }
        const f = BW.fr;
        if (CFG.preview && f && BW.d > .55 && BW.w > .9) {                 // faint path of the shot, only near full draw
            const d = BW.d, dist = TB0 + (LDRAW - TB0) * d, len = (L_ARROW - dist) * S, v = spd(d, BW.fat);
            let x = P.x + f.g[0] * S + f.u[0] * len, y = f.g[1] * S - (P.dh || 0) - (P.mh || 0) + f.u[1] * len, vx = f.u[0] * v, vy = f.u[1] * v;
            ctx.save(); ctx.fillStyle = '#111';
            for (let n = 0; n < 80; n++) {
                const sp = Math.hypot(vx, vy), h = .03;
                vx += (-CFG.drag * sp * vx) * h; vy += (CFG.gravity - CFG.drag * sp * vy) * h; x += vx * h; y += vy * h;
                const fl = floorY(x, y - 8);
                if (y >= fl) { ctx.globalAlpha = .5; ctx.lineWidth = 2; ctx.strokeStyle = '#111'; const X = x - P.x + W / 2, Y = gy + 4 + fl; ctx.beginPath(); ctx.moveTo(X - 6, Y - 6); ctx.lineTo(X + 6, Y + 6); ctx.moveTo(X + 6, Y - 6); ctx.lineTo(X - 6, Y + 6); ctx.stroke(); break }
                if (n % 2 === 0) { ctx.globalAlpha = .45 * (1 - n / 80); ctx.beginPath(); ctx.arc(x - P.x + W / 2, gy + 4 + y, 2.1, 0, 7); ctx.fill() }
            }
            ctx.restore();
        }
    }
    const _ds = window.drawShots;
    window.drawShots = function (gy) { _ds.call(this, gy); worldDraw(gy) };

    // ---------------- HUD ----------------
    const _gh = window.drawGunHUD;
    window.drawGunHUD = function () {
        _gh.apply(this, arguments);
        if (BW.eq < .05) return;
        ctx.save(); ctx.globalAlpha = Math.min(1, BW.eq); ctx.fillStyle = '#111'; ctx.strokeStyle = '#111'; ctx.font = 'italic 20px Georgia,serif'; ctx.textAlign = 'left';
        ctx.fillText('arrows ×' + BW.ammo, 24, H - 54);
        if (BW.d > 0) {
            ctx.lineWidth = 2; ctx.strokeRect(24, H - 46, 110, 8); ctx.fillStyle = BW.fat > .5 ? '#a3121a' : '#111'; ctx.fillRect(26, H - 44, 106 * BW.d, 4);
        }
        ctx.restore();
    };

    // ---------------- UI: controls panel + touch buttons ----------------
    const hp = document.getElementById('hudPanel');
    if (hp) {
        const s = document.createElement('section');
        s.innerHTML = '<h4>BOW</h4><p><kbd>Q</kbd> take out / put away</p><p>Hold <kbd>F</kbd> draw · release to loose</p><p><kbd>W</kbd><kbd>S</kbd> aim · <kbd>Space</kbd> relax string</p><p><kbd>T</kbd> pick up arrows</p>';
        hp.appendChild(s);
    }
    if (matchMedia('(pointer:coarse)').matches) {
        const mk = (txt, bottom, down, up) => {
            const b = document.createElement('span'); b.className = 'b'; b.textContent = txt;
            b.style.cssText = 'position:fixed;right:98px;bottom:calc(env(safe-area-inset-bottom,0px) + ' + bottom + 'px);display:flex';
            b.addEventListener('pointerdown', e => { e.preventDefault(); down() });
            if (up) ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => b.addEventListener(t, up));
            document.body.appendChild(b);
        };
        mk('Q', 178, toggle); mk('F', 98, () => keys.KeyF = 1, () => keys.KeyF = 0);
    }
})();