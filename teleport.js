/* ============================================================
   teleport.js : Azazel-style smoke teleport for Ink Walker (v4, body-shaped dissolve)
   The sprite is NOT shown while teleporting. Instead the body is rebuilt out of ink
   strokes that turn to mist + sparks and stream away to the top-right (~2 o'clock);
   on arrival it plays in reverse: mist and sparks pour down from the top-right and
   assemble into the body. No horizontal travel effect.
   Load AFTER the main script. Wraps window.update, window.drawChar (and window.leg
   if it is a global function, to read the leg poses).
   ============================================================ */
(function () {
    'use strict';

    const TP = window.TP = {
        // ---- tuning ----
        key: 'KeyR',
        stealKey: true,       // KeyR is also pressReload(): swallow it when a teleport fires
        dist: 550,            // world px, x CSc() if scaleDist
        scaleDist: true,
        minDist: 70,
        cooldown: 2.5,
        failCooldown: 0.6,
        slow: 1.25,           // 1 = base speed, higher = slower motion (cooldown stays real-time)
        // timings in effect-seconds (real time = value x slow)
        spread: 0.14,         // how long the body takes to start dissolving / finish assembling
        moteDur: [0.18, 0.24],// time each ink stroke needs to fly between the body and the exit point
        wind: 0.40,           // departure phase length (must be >= spread + moteDur max)
        vanish: 0.03,         // real sprite crossfades to the ink strokes in this time
        appearAt: 0.30,       // real sprite starts returning here
        appearRamp: 0.08,
        arrive: 0.46,         // arrival phase length
        // exit / entry point of the mist, relative to the body (2 o'clock = 30 degrees above horizontal, to the right)
        portAngle: 30,        // degrees above horizontal
        portDist: 300,        // px at CSc()=1
        mirror: false,        // true = exit point flips with the teleport direction
        step: 12, clear: 24, edge: 40,
        bodyH: 330,
        maxMotes: 150, maxWisps: 40, maxSparks: 90,

        // ---- world rules ----
        solidAt: function (x, P) {
            if (typeof MT_STOP_X === 'function' && x < MT_STOP_X()) return true;
            if (P.thDeck && P.dh > 0) {
                if (typeof TH_HS !== 'undefined' && TH_HS.in) {
                    if (x < TH_WX - 165 * TH_SC || x > TH_WX + 140 * TH_SC) return true;
                } else if (x < TH_WX - 285 * TH_SC || x > TH_WX + 205 * TH_SC) return true;
            } else if (P.dh > 0 && typeof stairGeom === 'function') {
                const g = stairGeom(); if (x < g.x0 || x > g.tx) return true;
            }
            return false;
        },
        hazardAt: function (x, P) {
            return typeof inPond === 'function' && inPond(x) && !(x >= DOCK_X0 && x <= DOCK_X1);
        },
        bounds: function () { return typeof MT_STOP_X === 'function' ? [MT_STOP_X(), Infinity] : null; },
        blocked: function () { return !!(window.paused || window.gamePaused || window.menuOpen); },   // TODO real pause flag
        ext: false,

        // ---- state (read-only) ----
        cd: 0, phase: 'idle', t: 0, dir: 1, travel: 0, fromX: 0, alpha: 1
    };

    const TAU = 6.2832;
    const motes = [], wisps = [], sparks = [], smudges = [], LEGS = [null, null];
    let lastClock = performance.now() / 1000, held = false;
    const rnd = (a, b) => a + Math.random() * (b - a);
    const clamp01 = t => t < 0 ? 0 : t > 1 ? 1 : t;
    const scale = () => (typeof CSc === 'function' ? CSc() : 1) || 1;
    const elevAt = x => (PL.dh || 0) + (typeof mtGround === 'function' ? mtGround(x) : (PL.mh || 0));

    // ---------- input ----------
    addEventListener('keydown', e => {
        if (e.code !== TP.key) return;
        if (held && TP.stealKey) { e.stopImmediatePropagation(); e.preventDefault(); return; }
        if (e.repeat) return;
        if (canTeleport()) {
            trigger(PL);
            if (TP.stealKey) { held = true; e.stopImmediatePropagation(); e.preventDefault(); }
        }
    }, true);
    addEventListener('keyup', e => { if (e.code === TP.key) held = false; }, true);

    // ---------- rules ----------
    function canTeleport() {
        const P = PL;
        if (TP.phase !== 'idle' || TP.cd > 0) return false;
        if (TP.blocked()) return false;
        if (P.hurt > 0 || P.grabbed) return false;
        if (P.fin > 0 || P.stbk > 0 || P.fs > 0 || P.gu > 0 || P.yk > 0) return false;
        if (P.pk > 0 || P.mpk > 0 || P.mSl > 0) return false;
        if (P.mount || P.mk > 0.05) return false;
        if (P.rl > 0 || P.srl > 0 || P.sgp > 0 || P.stm > 0) return false;
        if (P.cs > 0 || P.thw > 0 || P.tt > 0 || P.pu > 0) return false;
        if (P.sm === 1 || P.ldLock || P.stc > 0) return false;
        if (P.sqg > 0 || P.sqt > 0) return false;
        if (typeof swim !== 'undefined' && (swim.on || swim.cl > 0)) return false;
        if (typeof TH_CL !== 'undefined' && TH_CL.on) return false;
        if (typeof DD !== 'undefined' && DD.carry) return false;
        if (typeof TH_SQ !== 'undefined' && TH_SQ.held) return false;
        return true;
    }

    function resolveDist(P, dir) {
        const S = scale(), k = TP.scaleDist ? S : 1, want = TP.dist * k, b = TP.bounds();
        let d = 0;
        for (let t = TP.step; t <= want; t += TP.step) {
            const x = P.x + dir * t;
            if (b && (x < b[0] + TP.edge || x > b[1] - TP.edge)) break;
            if (TP.solidAt(x, P)) break;
            d = t;
        }
        while (d > 0 && (TP.solidAt(P.x + dir * (d + TP.clear), P) || TP.hazardAt(P.x + dir * d, P))) d -= TP.step;
        return d >= TP.minDist * k ? d : 0;
    }

    // ============================================================
    //  BODY SKELETON  ->  points the ink strokes are built from
    // ============================================================
    // All local coords below are the character's own units: screen = (cx + x*S, gy + 4 + y*S)
    function skeleton(P) {
        const segs = [], F = P.face || 1;
        const add = (a, b, wt) => { if (a && b) segs.push([a[0], a[1], b[0], b[1], wt]); };
        if (P.hdp) for (let i = 0; i < 10; i++) {                    // head outline
            const a0 = i / 10 * TAU, a1 = (i + 1) / 10 * TAU;
            add([P.hdp[0] + Math.cos(a0) * 22, P.hdp[1] + Math.sin(a0) * 22], [P.hdp[0] + Math.cos(a1) * 22, P.hdp[1] + Math.sin(a1) * 22], 1);
        }
        if (P.nkP && P.hipP) add(P.hipP, P.nkP, 1.4);               // spine
        if (P.nkP && P.hdp) add(P.nkP, P.hdp, .4);
        const A = P.armFullPts;                                      // arms: shoulder -> elbow -> hand
        for (let i = 0; i < 2; i++) if (A && A[i]) { add(A[i][0], A[i][1], 1); add(A[i][1], A[i][2], 1); }
        for (let i = 0; i < 2; i++) {                                // legs: hip -> knee -> foot
            let hip, foot; const L = LEGS[i];
            if (L) { hip = [L[0], L[1]]; foot = [L[2], L[3]]; }
            else if (P.hipP) { hip = P.hipP; foot = [P.hipP[0] + (i ? -16 : 16) * F, -12]; }
            if (hip) { const knee = [(hip[0] + foot[0]) / 2 + F * 10, (hip[1] + foot[1]) / 2]; add(hip, knee, 1); add(knee, foot, 1); }
        }
        return segs;
    }
    // n points spread along the body; x / h are px offsets from the player (h = height above ground)
    function samplePoints(n) {
        const S = scale(), segs = skeleton(PL), pts = [];
        if (!segs.length) {                                          // no pose yet: plain vertical line
            for (let i = 0; i < n; i++) pts.push({ x: rnd(-6, 6) * S, h: (10 + i / n * 290) * S, ux: 0, uy: 1 });
            return pts;
        }
        let tot = 0;
        for (const s of segs) { s.len = Math.hypot(s[2] - s[0], s[3] - s[1]) * s[4]; tot += s.len; }
        for (let i = 0; i < n; i++) {
            let r = (i + Math.random()) / n * tot, k = 0;
            while (k < segs.length - 1 && r > segs[k].len) { r -= segs[k].len; k++; }
            const s = segs[k], t = s.len ? clamp01(r / s.len) : 0, dx = s[2] - s[0], dy = s[3] - s[1], l = Math.hypot(dx, dy) || 1;
            pts.push({ x: (s[0] + dx * t) * S, h: -(s[1] + dy * t) * S - 4, ux: dx / l, uy: -dy / l });
        }
        return pts;
    }
    function portPoint() {
        const S = scale(), R = TP.portDist * S, a = TP.portAngle * Math.PI / 180, sg = TP.mirror ? TP.dir : 1;
        return [sg * Math.cos(a) * R, TP.bodyH * S * .55 + Math.sin(a) * R];
    }

    // ============================================================
    //  SPAWNERS
    // ============================================================
    function addSpark(o) { if (sparks.length >= TP.maxSparks) sparks.shift(); sparks.push(o); }
    const unit = (dx, dh) => { const l = Math.hypot(dx, dh) || 1; return [dx / l, dh / l]; };

    // dep=true : body -> ink strokes -> flows to the exit point and vanishes
    // dep=false: strokes pour from the exit point down into the body shape (the same motion, reversed)
    // follow=true: effect stays attached to the player (so he can already move while he re-forms)
    function spawnBody(dep, base, follow, pts) {
        if (!pts.length) return;
        const S = scale(), E = portPoint(), g0 = follow ? 0 : elevAt(base), sp = TP.spread;
        const ds = pts.map(p => Math.hypot(E[0] - p.x, E[1] - p.h));
        let mn = Infinity, mx = 0; for (const d of ds) { if (d < mn) mn = d; if (d > mx) mx = d; }
        const rg = (mx - mn) || 1, dly = i => (dep ? (ds[i] - mn) / rg : 1 - (ds[i] - mn) / rg) * sp;

        for (let i = 0; i < pts.length; i++) {                       // ink strokes that make up the body
            if (motes.length >= TP.maxMotes) motes.shift();
            const p = pts[i], delay = dly(i) + rnd(0, .02), dur = rnd(TP.moteDur[0], TP.moteDur[1]);
            motes.push({
                dep, base, follow, g0, s: S, sx: p.x, sh: p.h, ex: E[0] + rnd(-14, 14) * S, eh: E[1] + rnd(-14, 14) * S,
                ux: p.ux, uy: p.uy, delay, dur, amp: rnd(-70, 70) * S, ph: rnd(0, TAU),
                w: rnd(1.6, 3.2) * S, L0: rnd(12, 24) * S, age: 0, life: delay + dur + .1
            });
        }
        for (let k = 0; k < 16; k++) {                               // flowing mist ribbons
            if (wisps.length >= TP.maxWisps) wisps.shift();
            const i = (Math.random() * pts.length) | 0, p = pts[i], wide = Math.random() < .25, delay = dly(i) + rnd(0, .02), dur = rnd(.2, .26);
            wisps.push({
                dep, base, follow, g0, s: S, sx: p.x, sh: p.h, ex: E[0] + rnd(-18, 18) * S, eh: E[1] + rnd(-18, 18) * S,
                delay, dur, lag: rnd(.07, .11), amp: rnd(-90, 90) * S, ph: rnd(0, TAU),
                W: (wide ? rnd(13, 19) : rnd(4, 9)) * S, a0: wide ? .2 : rnd(.5, .8), c: rnd(10, 38) | 0, age: 0, life: delay + dur + .13
            });
        }
        for (let k = 0; k < 16; k++) {                               // sharp black shards (12) + orange embers (4)
            const i = (Math.random() * pts.length) | 0, p = pts[i], ember = k >= 12;
            const v = (ember ? rnd(50, 150) : rnd(250, 600)) * S, nz = rnd(-180, 180) * S * (ember ? .4 : 1);
            let x0, h0, u;
            if (dep) { x0 = p.x; h0 = p.h; u = unit(E[0] - x0, E[1] - h0); }
            else { x0 = E[0] + rnd(-30, 30) * S; h0 = E[1] + rnd(-30, 30) * S; u = unit(p.x - x0, p.h - h0); }
            addSpark({
                ember, rel: follow, wx: follow ? x0 : base + x0, g0, h: h0, vx: u[0] * v - u[1] * nz, vy: u[1] * v + u[0] * nz,
                age: -(dep ? dly(i) : rnd(0, sp)), life: ember ? rnd(.35, .55) : rnd(.16, .28), w: rnd(1.4, 2.6) * S, k: ember ? .03 : .045,
                col: Math.random() < .5 ? '#e8731a' : '#ff9d4a'
            });
        }
        if (!dep) for (let k = 0; k < 13; k++) {                     // snap of shards the instant the body finishes forming
            const p = pts[(Math.random() * pts.length) | 0], ember = k >= 10, a = rnd(0, TAU), v = (ember ? rnd(60, 170) : rnd(250, 600)) * S;
            addSpark({
                ember, rel: true, wx: p.x, g0: 0, h: p.h, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
                age: -TP.appearAt, life: ember ? rnd(.3, .5) : rnd(.14, .24), w: rnd(1.4, 2.6) * S, k: ember ? .03 : .045,
                col: Math.random() < .5 ? '#e8731a' : '#ff9d4a'
            });
        }
    }
    function smudge(wx, size) {
        smudges.push({ wx, g0: elevAt(wx), age: 0, life: 1.0, size, r: Array.from({ length: 7 }, () => rnd(.75, 1.2)), rot: rnd(0, 6) });
    }

    function trigger(P) {
        const moving = Math.abs(P.vx || 0) > 20, S = scale();
        TP.dir = moving ? Math.sign(P.vx) : (P.face || 1);
        TP.travel = resolveDist(P, TP.dir);
        if (!TP.travel) {                                           // blocked: tiny fizzle
            for (let i = 0; i < 5; i++) { const a = rnd(0, TAU), v = rnd(150, 350) * S; addSpark({ ember: false, rel: false, wx: P.x, g0: elevAt(P.x), h: rnd(.2, .8) * TP.bodyH * S, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, life: rnd(.12, .22), w: 1.8 * S, k: .045 }); }
            TP.cd = TP.failCooldown; return;
        }
        TP.phase = 'wind'; TP.t = 0; TP.cd = TP.cooldown; TP.fromX = P.x;
        spawnBody(true, P.x, false, samplePoints(110));
        smudge(P.x, 30 * S);
    }
    TP.fire = function () { if (canTeleport()) trigger(PL); };   // console testing

    // ============================================================
    //  UPDATE  (dt in seconds; 0 during hitstop)
    // ============================================================
    TP.update = function (dt) {
        const P = PL;
        dt = Math.min(dt, 0.05);
        if (TP.cd > 0) TP.cd = Math.max(0, TP.cd - dt);   // cooldown runs in real time
        dt /= TP.slow;

        if (TP.phase === 'wind') {
            TP.t += dt;
            P.x = TP.fromX;                                          // he stays put while he comes apart
            TP.alpha = 1 - clamp01(TP.t / TP.vanish);
            if (TP.t >= TP.wind) {
                const x0 = TP.fromX, d = resolveDist(P, TP.dir) || 0;   // re-check at the moment of the jump
                P.x = x0 + TP.dir * d;                                  // instant relocation
                TP.phase = 'arrive'; TP.t = 0; TP.alpha = 0;
                spawnBody(false, P.x, true, samplePoints(110));
                smudge(P.x, 20 * scale());
            }
        } else if (TP.phase === 'arrive') {
            TP.t += dt;
            TP.alpha = clamp01((TP.t - TP.appearAt) / TP.appearRamp);
            if (TP.t >= TP.arrive) { TP.phase = 'idle'; TP.alpha = 1; }
        }

        const S = scale();
        for (let i = motes.length - 1; i >= 0; i--) { const m = motes[i]; m.age += dt; if (m.age >= m.life) { motes[i] = motes[motes.length - 1]; motes.pop(); } }
        for (let i = wisps.length - 1; i >= 0; i--) { const w = wisps[i]; w.age += dt; if (w.age >= w.life) { wisps[i] = wisps[wisps.length - 1]; wisps.pop(); } }
        for (let i = sparks.length - 1; i >= 0; i--) {
            const s = sparks[i]; s.age += dt;
            if (s.age >= s.life) { sparks[i] = sparks[sparks.length - 1]; sparks.pop(); continue; }
            if (s.age < 0) continue;
            s.wx += s.vx * dt; s.h += s.vy * dt;
            const drag = 1 - (s.ember ? 2.5 : 3.2) * dt; s.vx *= drag; s.vy *= drag;
            if (s.ember) s.vy += 90 * S * dt;
        }
        for (let i = smudges.length - 1; i >= 0; i--) { smudges[i].age += dt; if (smudges[i].age >= smudges[i].life) smudges.splice(i, 1); }
    };

    // ============================================================
    //  RENDER
    // ============================================================
    const XS = new Float32Array(16), YS = new Float32Array(16), WS = new Float32Array(16);
    const LX = new Float32Array(16), LY = new Float32Array(16), RX = new Float32Array(16), RY = new Float32Array(16);
    const tmp = [0, 0];

    function ribbon(c, n, alpha, shade) {
        for (let i = 0; i < n; i++) {
            const a = i > 0 ? i - 1 : 0, b = i < n - 1 ? i + 1 : n - 1;
            let tx = XS[b] - XS[a], ty = YS[b] - YS[a]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
            const nx = -ty * WS[i], ny = tx * WS[i];
            LX[i] = XS[i] + nx; LY[i] = YS[i] + ny; RX[i] = XS[i] - nx; RY[i] = YS[i] - ny;
        }
        c.globalAlpha = alpha; c.fillStyle = 'rgb(' + shade + ',' + shade + ',' + shade + ')';
        c.beginPath(); c.moveTo(LX[0], LY[0]);
        for (let i = 1; i < n - 1; i++) c.quadraticCurveTo(LX[i], LY[i], (LX[i] + LX[i + 1]) / 2, (LY[i] + LY[i + 1]) / 2);
        c.lineTo(LX[n - 1], LY[n - 1]); c.lineTo(RX[n - 1], RY[n - 1]);
        for (let i = n - 2; i > 0; i--) c.quadraticCurveTo(RX[i], RY[i], (RX[i] + RX[i - 1]) / 2, (RY[i] + RY[i - 1]) / 2);
        c.lineTo(RX[0], RY[0]); c.closePath(); c.fill();
    }
    // flow path from the body point (uu=0) to the exit point (uu=1): accelerating, with a curling sideways swirl
    function pathPos(o, uu) {
        const e = Math.pow(uu, 2.2), vx = o.ex - o.sx, vh = o.eh - o.sh, l = Math.hypot(vx, vh) || 1;
        const sw = Math.sin(Math.PI * e) * (o.amp * (1 - .3 * e) + Math.sin(e * 18 + o.ph) * 3 * o.s);
        tmp[0] = o.sx + vx * e - vh / l * sw;
        tmp[1] = o.sh + vh * e + vx / l * sw;
    }
    function blob(c, x, y, s, sq, rot, radii) {
        const n = radii.length, pts = [];
        for (let i = 0; i < n; i++) { const a = rot + i / n * TAU; pts.push([x + Math.cos(a) * s * radii[i], y + Math.sin(a) * s * radii[i] * sq]); }
        c.beginPath(); c.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2);
        for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; c.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
        c.closePath(); c.fill();
    }

    TP.render = function (c, cx, gy, px) {
        if (!motes.length && !wisps.length && !sparks.length && !smudges.length) return;
        const S = scale(), eNow = (PL.dh || 0) + (PL.mh || 0), N = 8;
        c.save(); c.lineCap = 'round'; c.lineJoin = 'round';

        for (const s of smudges) {                                       // flat ink stain on the ground
            c.globalAlpha = .3 * (1 - s.age / s.life) * Math.min(1, s.age * 12); c.fillStyle = '#111';
            blob(c, cx + (s.wx - px), gy + eNow - s.g0 + 4, s.size * (1 + .25 * s.age), .16, s.rot, s.r);
        }

        for (const w of wisps) {                                         // flowing mist ribbons
            if (w.age < w.delay) continue;
            const alpha = w.a0 * Math.min(1, (w.age - w.delay) * 25) * (1 - clamp01((w.age - w.delay - w.dur) / w.lag));
            if (alpha < .01) continue;
            const X = cx + (w.follow ? 0 : w.base - px), Y0 = gy + (w.follow ? 0 : eNow - w.g0);
            for (let i = 0; i < N; i++) {
                const u = clamp01((w.age - w.delay - i * w.lag / (N - 1)) / w.dur);
                pathPos(w, w.dep ? u : 1 - u);
                XS[i] = X + tmp[0]; YS[i] = Y0 - tmp[1];
                WS[i] = w.W * (.25 + .75 * Math.sin(Math.PI * (.12 + .76 * i / (N - 1))));
            }
            ribbon(c, N, alpha, w.c);
        }

        c.fillStyle = '#111';
        for (const m of motes) {                                         // ink strokes forming the body
            const u = clamp01((m.age - m.delay) / m.dur), ut = Math.max(0, u - .14);
            pathPos(m, m.dep ? u : 1 - u); let hx = tmp[0], hh = tmp[1];
            pathPos(m, m.dep ? ut : 1 - ut); const px0 = tmp[0], ph0 = tmp[1];
            const mv = m.dep ? clamp01(u / .12) : clamp01((1 - u) / .12);   // 0 = resting in the body shape, 1 = streaking
            if (m.dep && mv < 1) { hx += Math.sin(m.age * 70 + m.ph) * 1.3 * m.s * (1 - mv); hh += Math.cos(m.age * 63 + m.ph) * 1.3 * m.s * (1 - mv); }
            const bx = hx - m.ux * m.L0, bh = hh - m.uy * m.L0;          // resting stroke lies along the bone
            const tx = bx + (px0 - bx) * mv, th = bh + (ph0 - bh) * mv;
            const a = m.dep ? (u < .8 ? 1 : 1 - (u - .8) / .2) : (m.age <= m.delay + m.dur ? 1 : 1 - (m.age - m.delay - m.dur) / .1);
            if (a < .01) continue;
            const X = cx + (m.follow ? 0 : m.base - px), Y0 = gy + (m.follow ? 0 : eNow - m.g0);
            const x1 = X + hx, y1 = Y0 - hh, x0 = X + tx, y0 = Y0 - th;
            const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
            if (len < .5) continue;
            const ux = dx / len, uy = dy / len, wd = m.w * (m.dep ? 1 - .5 * u : .5 + .5 * u), nx = -uy * wd, ny = ux * wd;
            const mx = x1 - ux * len * .3, my = y1 - uy * len * .3;
            c.globalAlpha = a;
            c.beginPath(); c.moveTo(x0, y0); c.lineTo(mx + nx, my + ny); c.lineTo(x1, y1); c.lineTo(mx - nx, my - ny); c.closePath(); c.fill();
        }

        for (const s of sparks) {                                        // sharp black shards / orange embers
            if (s.age < 0) continue;
            const k = s.age / s.life, x = cx + (s.rel ? s.wx : s.wx - px), y = gy + (s.rel ? 0 : eNow - s.g0) - s.h;
            const vx = s.vx, vy = -s.vy, sp = Math.hypot(vx, vy) || 1, len = Math.max(3 * S, sp * s.k);
            const dx = vx / sp, dy = vy / sp, nx = -dy * s.w, ny = dx * s.w;
            const mx = x - dx * len * .35, my = y - dy * len * .35;
            c.globalAlpha = Math.pow(1 - k, s.ember ? 1.2 : .7);
            c.fillStyle = s.ember ? s.col : '#111';
            c.beginPath(); c.moveTo(x - dx * len, y - dy * len); c.lineTo(mx + nx, my + ny); c.lineTo(x, y); c.lineTo(mx - nx, my - ny); c.closePath(); c.fill();
        }
        c.restore();
    };

    // ============================================================
    //  HOOKS
    // ============================================================
    function install() {
        if (TP._installed || typeof window.drawChar !== 'function') return false;
        if (typeof window.leg === 'function') {                      // record leg poses (hip -> foot) for the body shape
            const l0 = window.leg;
            window.leg = function (hx, hy, fx, fy) {
                if (typeof CUR !== 'undefined' && CUR === PL && typeof legIdx !== 'undefined') LEGS[legIdx & 1] = [hx, hy, fx, fy];
                return l0.apply(this, arguments);
            };
        }
        if (typeof window.update === 'function') {
            const u0 = window.update;
            window.update = function (dt) { const r = u0.apply(this, arguments); TP.update(dt); return r; };
            TP.ext = true;
        }
        const orig = window.drawChar;
        window.drawChar = function (cx, gy, P) {
            if (P !== PL) return orig.apply(this, arguments);
            if (!TP.ext) { const now = performance.now() / 1000; TP.update(now - lastClock); lastClock = now; }
            const c = ctx;
            c.save();
            c.globalAlpha *= TP.alpha;                               // real sprite is hidden while the ink body is shown
            orig.apply(this, arguments);                             // always runs so hdp / hipP / armFullPts stay current
            c.restore();
            TP.render(c, cx, gy, P.x);
        };
        TP._installed = true; return true;
    }
    if (!install()) addEventListener('load', install);
})();