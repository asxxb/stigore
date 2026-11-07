/* ============================================================
   dialogue.js : NPC speech bubbles, barks and "talk to NPC" (BASIC) for Ink Walker
   Load AFTER the main script (order vs teleport.js / bow.js doesn't matter).
   - Ink-style speech bubbles above the speaker's head, typewriter text.
   - Friendly NPCs (ENEMIES with .peaceful) greet you when you walk up, warn you when you
     draw a gun, and cry out when you hit them.
   - Walk close to one: a small "E talk" prompt appears. Press E to talk, E again to advance.
   Edit the lines in TALK.profiles below. Uses bare globals: ENEMIES, PL, W, ctx, CSc, PAPER.
   ============================================================ */
(function () {
    'use strict';

    const TALK = window.TALK = {
        enabled: true,
        key: 'KeyE',
        range: 170,           // world px: how close you must be to talk
        greetRange: 230,      // an NPC greets you when you walk inside this
        convEnd: 260,         // walking further than this ends the conversation
        typeSpeed: 38,        // characters per second
        blocked: function () {   // extra "not now" check; add your own (menus, workbench open, ...)
            return !!(window.paused || window.gamePaused || window.menuOpen);
        },

        // ---- the writing (placeholder text: replace freely) ----
        // x = NPC spawn position from addPerson(). talk = list of short conversations (cycled per NPC).
        profiles: [
            { x: -11200, greet: ['Road is long. Mind it.', 'Up early, stranger.'], gun: ['Put that away.'], hit: ['Why would you do that?!'],
              talk: [['That horse by the post? Do not whistle at it.', 'It bites. Same as the road.'], ['The ducks are not for eating.', 'Not by you, anyway.']] },
            { x: -10600, greet: ['Evening, stranger.'], gun: ['We do not need that here.'], hit: ['Help! Somebody!'],
              talk: [['Folks went quiet around here.', 'Do not ask who stopped talking.'], ['If you hear singing at night,', 'do not follow it.']] },
            { x: -9400, greet: ['...'], gun: ['Easy. Easy.'], hit: ['Please, no.'],
              talk: [['I saw nothing. Heard nothing.', 'You did not see me either.']] },
            { x: -9150, greet: ['Good day.'], gun: ['Is that necessary?'], hit: ['You are mad!'],
              talk: [['This hat is older than the town.', 'The town is older than its sins.']] },
            { x: -7900, greet: ['Hm. A visitor.'], gun: ['Careful with that.'], hit: ['Stop it! Stop!'],
              talk: [['The bridge east of here is gone. Water took it.', 'Or somebody helped the water.']] },
            { x: -6800, greet: ['You look tired.'], gun: ['Lower it. Please.'], hit: ['Get away from me!'],
              talk: [['The liquor shop opens when the man feels like it.', 'He rarely feels like it.']] },
            { x: -5600, greet: ['Mm.'], gun: ['I have no money.'], hit: ['Ow! Enough!'],
              talk: [['The graves keep growing east of here.', 'Cheaper than fences.']] },
            { x: -5000, greet: ['Shop is closed.'], gun: ['Not at the door, friend.'], hit: ['Is this about the bottles?!'],
              talk: [['Closed. He is inside, pretending.', 'Knock if you like. He will not answer.']] }
        ],
        fallback: {
            greet: ['Hello.', 'Hm. Evening.'], gun: ['Put that down.'], hit: ['Stop that!'],
            talk: [['Nothing much to say.', 'Keep walking.']]
        }
    };

    const rnd = (a, b) => a + Math.random() * (b - a);
    const pick = a => a[(Math.random() * a.length) | 0];
    const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
    const scale = () => (typeof CSc === 'function' ? CSc() : 1) || 1;
    const paper = () => (typeof PAPER !== 'undefined' ? PAPER : '#f4f1ea');

    // ---------- helpers ----------
    function profileFor(n) {
        const x0 = n.spawnX !== undefined ? n.spawnX : n.home;
        for (const p of TALK.profiles) if (Math.abs(p.x - x0) < 80) return p;
        return TALK.fallback;
    }
    const alive = n => !n.dead && !n.dying && !n.down && !(n.hp <= 0);
    const calm = n => !n.hurt && !n.stab && !n.fst && !n.gut && !n.decap && !n.legHurt && !n.hCrack && !n.hsDead && !n.crawl;
    const gunUp = () => PL.gunK > .6 || PL.sgK > .6;
    function playerBusy() {
        const P = PL;
        if (P.hurt > 0 || P.grabbed || P.fin > 0 || P.stbk > 0 || P.fs > 0 || P.gu > 0 || P.yk > 0) return true;
        if (P.pk > 0 || P.mpk > 0 || P.mSl > 0 || P.mount || P.cs > 0 || P.thw > 0 || P.tt > 0) return true;
        if (typeof swim !== 'undefined' && (swim.on || swim.cl > 0)) return true;
        if (typeof TH_CL !== 'undefined' && TH_CL.on) return true;
        if (typeof DD !== 'undefined' && DD.carry) return true;
        return false;
    }

    // ---------- speaking ----------
    function say(n, text, o) {
        o = o || {};
        n._bub = { text, age: 0, typed: 0, conv: !!o.conv, life: o.life !== undefined ? o.life : .6 + text.length / TALK.typeSpeed + 2.2, seed: (Math.random() * 1e9) | 0, lines: null, fk: '' };
    }
    TALK.say = say;                                               // TALK.say(npc, 'text') from anywhere

    let conv = null;
    TALK.conv = null;
    function startTalk(n) {
        const p = profileFor(n), set = p.talk[(n._tIdx || 0) % p.talk.length];
        n._tIdx = (n._tIdx || 0) + 1;
        conv = TALK.conv = { n, lines: set, i: 0 };
        say(n, set[0], { conv: true });
    }
    function advance() {
        const n = conv.n, b = n._bub;
        if (b && b.typed < b.text.length) { b.typed = b.text.length; return; }     // first press completes the line
        conv.i++;
        if (conv.i >= conv.lines.length) endTalk(); else say(n, conv.lines[conv.i], { conv: true });
    }
    function endTalk() {
        if (conv && conv.n._bub) { conv.n._bub.conv = false; conv.n._bub.life = conv.n._bub.age + .6; }
        conv = TALK.conv = null;
    }

    addEventListener('keydown', e => {
        if (!TALK.enabled || e.code !== TALK.key || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
        if (conv) { advance(); e.stopImmediatePropagation(); e.preventDefault(); return; }
        if (TALK.target && !playerBusy() && !TALK.blocked() && !gunUp()) {
            startTalk(TALK.target); e.stopImmediatePropagation(); e.preventDefault();             // swallowed: no finisher / stairs on this press
        }
    }, true);

    // ============================================================
    //  UPDATE (dt seconds; 0 during hitstop)
    // ============================================================
    TALK.target = null;
    TALK.update = function (dt) {
        if (!TALK.enabled || typeof ENEMIES === 'undefined') return;
        const P = PL; dt = Math.min(dt, .05);
        let best = null, bd = 1e9;
        const half = (typeof W !== 'undefined' ? W : 1200) / 2;

        for (const n of ENEMIES) {
            const b = n._bub;
            if (b) {
                b.age += dt; b.typed = Math.min(b.text.length, b.typed + dt * TALK.typeSpeed);
                if (!b.conv && b.age > b.life) n._bub = null;
            }
            if (!n.peaceful || !alive(n)) { if (b && !alive(n)) n._bub = null; continue; }
            n._greetCd = (n._greetCd || 0) - dt; n._gunCd = (n._gunCd || 0) - dt; n._hitCd = (n._hitCd || 0) - dt;
            const dx = P.x - n.x, ad = Math.abs(dx);

            if (n.hurt > 0 && !n._wasHurt && n._hitCd <= 0) {                                 // cries out when hit
                say(n, pick(profileFor(n).hit || TALK.fallback.hit), { life: 2.4 }); n._hitCd = 4;
                if (conv && conv.n === n) conv = TALK.conv = null;
            }
            n._wasHurt = n.hurt > 0;
            if (!calm(n)) continue;

            const gr = n.social === 'shy' ? 150 : TALK.greetRange;
            if (ad < gr) {                                                                      // greeting when you walk up
                if (!n._inRange) {
                    n._inRange = true;
                    if (n._greetCd <= 0 && !n._bub && ad < half && !(n.social === 'shy' && Math.random() < .5)) { say(n, pick(profileFor(n).greet || TALK.fallback.greet), { life: 2.2 }); n._greetCd = 30; }
                }
            } else if (ad > gr + 120) n._inRange = false;

            if (gunUp() && ad < 420 && ad < half && !n._bub && n._gunCd <= 0) {              // nervous about the gun
                say(n, pick(profileFor(n).gun || TALK.fallback.gun), { life: 2.2 }); n._gunCd = 15;
            }
            if (ad < TALK.range && ad < bd) { bd = ad; best = n; }
        }

        TALK.target = (!conv && best && !playerBusy() && !TALK.blocked() && !gunUp()) ? best : null;

        if (conv) {                                                                             // conversation safety checks
            const n = conv.n;
            if (!alive(n) || !calm(n) || Math.abs(P.x - n.x) > TALK.convEnd || playerBusy() || gunUp() || TALK.blocked()) endTalk();
        }
    };

    // ============================================================
    //  DRAWING (ink bubble + prompt), done right after the NPC's own drawChar
    // ============================================================
    function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

    function wrap(c, text, maxW) {
        const words = text.split(' '), out = []; let line = '';
        for (const w of words) {
            const t = line ? line + ' ' + w : w;
            if (line && c.measureText(t).width > maxW) { out.push(line); line = w; } else line = t;
        }
        if (line) out.push(line);
        return out;
    }

    function drawBubble(c, x, y, b, S) {
        const fs = Math.max(14, Math.round(17 * S)), lh = fs * 1.3, pad = 11, maxW = 230;
        c.save();
        c.font = 'italic ' + fs + 'px Georgia,serif';
        if (!b.lines || b.fk !== c.font) { b.lines = wrap(c, b.text, maxW); b.fk = c.font; }
        let tw = 0; for (const l of b.lines) tw = Math.max(tw, c.measureText(l).width);
        const w = tw + pad * 2, h = b.lines.length * lh + pad * 2 - 4;
        const sw = typeof W !== 'undefined' ? W : 1200;
        const x0 = clamp(x - w / 2, 8, sw - w - 8), y0 = y - 12 * S - h;
        const rnd_ = mulberry(b.seed), j = () => (rnd_() - .5) * 3.2, r = 10;
        const tc = clamp(x, x0 + r + 14, x0 + w - r - 14), pop = Math.min(1, b.age * 9), fade = b.conv ? 1 : clamp((b.life - b.age) * 4, 0, 1);
        c.globalAlpha = Math.min(pop, fade);
        c.translate(x, y); c.scale(.85 + .15 * pop, .85 + .15 * pop); c.translate(-x, -y);
        c.beginPath();
        c.moveTo(x0 + r + j(), y0 + j());
        c.lineTo(x0 + w - r + j(), y0 + j());
        c.quadraticCurveTo(x0 + w + j(), y0 + j(), x0 + w + j(), y0 + r + j());
        c.lineTo(x0 + w + j(), y0 + h - r + j());
        c.quadraticCurveTo(x0 + w + j(), y0 + h + j(), x0 + w - r, y0 + h);
        c.lineTo(tc + 9, y0 + h); c.lineTo(x + j(), y + j()); c.lineTo(tc - 9, y0 + h);
        c.lineTo(x0 + r, y0 + h);
        c.quadraticCurveTo(x0 + j(), y0 + h + j(), x0 + j(), y0 + h - r + j());
        c.lineTo(x0 + j(), y0 + r + j());
        c.quadraticCurveTo(x0 + j(), y0 + j(), x0 + r + j(), y0 + j());
        c.closePath();
        c.fillStyle = paper(); c.fill();
        c.strokeStyle = '#111'; c.lineWidth = 2.6; c.lineJoin = 'round'; c.stroke();
        c.fillStyle = '#111'; c.textAlign = 'left'; c.textBaseline = 'top';
        let left = Math.floor(b.typed);                                                        // typewriter
        for (let i = 0; i < b.lines.length && left > 0; i++) {
            const l = b.lines[i]; c.fillText(l.slice(0, left), x0 + pad, y0 + pad - 2 + i * lh);
            left -= l.length + 1;
        }
        c.restore();
    }

    function drawPrompt(c, x, y, S) {
        c.save(); c.fillStyle = '#111'; c.textAlign = 'center';
        c.font = 'italic bold 22px Georgia,serif'; c.fillText(TALK.key.replace('Key', ''), x, y - 20);
        c.font = 'italic 15px Georgia,serif'; c.fillText('talk', x, y);
        c.restore();
    }

    function install() {
        if (TALK._installed || typeof window.drawChar !== 'function') return false;
        if (typeof window.update === 'function') {
            const u0 = window.update;
            window.update = function (dt) { const r = u0.apply(this, arguments); TALK.update(dt); return r; };
            TALK.ext = true;
        }
        const orig = window.drawChar;
        window.drawChar = function (cx, gy, P) {
            const r = orig.apply(this, arguments);
            if (TALK.enabled && P !== PL && P && (P._bub || TALK.target === P) && P.peaceful && alive(P)) {
                const S = scale(), hd = P.hdp || [0, -290];
                const x = cx + hd[0] * S, y = gy + 4 + hd[1] * S - 30 * S;                      // just above the head
                if (P._bub) drawBubble(ctx, x, y, P._bub, S); else drawPrompt(ctx, x, y - 6 * S, S);
            }
            return r;
        };
        TALK._installed = true; return true;
    }
    if (!install()) addEventListener('load', install);
})();
