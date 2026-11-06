(() => {
  // ---- coin as a normal pick-up item (uses your existing T pickup) ----
  ITEM_DEFS.coin = { label: 'COIN', h: 3 };

  const SAVE_KEY = 'inkwalker.save.v1';
  const loadSave = () => {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; }
    catch (e) { return {}; }
  };
  INV.coin = Math.max(0, +loadSave().coin || 0);
  if (!INV.coin) delete INV.coin;

  const GOLD = 'rgb(232,184,48)', GOLD_D = 'rgb(176,128,30)';
  let ac = null;

  function ting() {
    if (!audioOn) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const t = ac.currentTime;
      [1318, 1760].forEach((f, i) => {
        const o = ac.createOscillator(), g = ac.createGain(), s = t + i * .06;
        o.type = 'sine';
        o.frequency.value = f;
        g.gain.setValueAtTime(.0001, s);
        g.gain.exponentialRampToValueAtTime(.12, s + .01);
        g.gain.exponentialRampToValueAtTime(.0001, s + .35);
        o.connect(g);
        g.connect(ac.destination);
        o.start(s);
        o.stop(s + .4);
      });
    } catch (e) { }
  }

  // ---- coin art ----
  const _shape = drawItemShape;
  drawItemShape = function (it, now, inHand) {
    if (it.type !== 'coin') return _shape(it, now, inHand);

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#111';

    if (inHand) {
      ctx.beginPath();
      ctx.arc(0, 0, 5.5, 0, 7);
      ctx.fillStyle = GOLD;
      ctx.fill();
      ctx.lineWidth = 1.8;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, 3.4, 0, 7);
      ctx.strokeStyle = GOLD_D;
      ctx.lineWidth = 1;
      ctx.stroke();
      return;
    }

    ctx.beginPath();
    ctx.ellipse(0, 1, 6, 2, 0, 0, 7);
    ctx.fillStyle = GOLD_D;
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(0, 0, 6, 2, 0, 0, 7);
    ctx.fillStyle = GOLD;
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(0, 0, 3.6, 1.1, 0, 0, 7);
    ctx.strokeStyle = GOLD_D;
    ctx.lineWidth = .8;
    ctx.stroke();

    const g = ((performance.now() / 1000 + it.seed) % 3) / 3;
    if (g < .25) {
      const k = Math.sin(Math.PI * g / .25) * 4;
      ctx.strokeStyle = '#fff6c0';
      ctx.lineWidth = .9;
      ctx.beginPath();
      ctx.moveTo(-2 - k, -3);
      ctx.lineTo(-2 + k, -3);
      ctx.moveTo(-2, -3 - k);
      ctx.lineTo(-2, -3 + k);
      ctx.stroke();
    }
  };

  // ================= SACK: soft-body physics =================
  const SK = {
    ang: 0, vel: 0, pop: 0, last: 0, n: INV.coin || 0,
    pvx: 0, pvz: 0, pz: 0, ax: 0, az: 0,
    tail: 0, tailV: 0
  };

  const SHAPE = [
    [-.32, 0], [-.8, .22], [-1, .52], [-.9, .82],
    [-.5, .99], [0, 1.03], [.5, .99], [.9, .82],
    [1, .52], [.8, .22], [.32, 0]
  ];

  const NN = SHAPE.length;
  const ND = SHAPE.map(() => ({ dx: 0, dy: 0, vx: 0, vy: 0 }));
  const BR = 'rgb(176,128,76)', BR_D = 'rgb(150,105,60)';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function kick(s) {
    SK.vel += 7 * s;
    SK.pop = 1;
    ND.forEach((d, i) => {
      d.vy -= 45 * s * SHAPE[i][1];
      d.vx += SHAPE[i][0] * 35 * s;
    });
  }

  window.coinDrawSack = function (rot, F, now) {
    const dt = clamp(now - SK.last, .001, .05);
    SK.last = now;
    const n = INV.coin || 0, f = Math.min(1, n / 40);
    const w = 9 + 6 * f + SK.pop * 1.5, h = 19 + 7 * f;
    SK.pop = Math.max(0, SK.pop - dt * 4);

    const vx = P.vx || 0, z = P.z || 0, vz = (z - SK.pz) / dt;
    const rax = clamp((vx - SK.pvx) / dt, -4000, 4000);
    const raz = clamp((vz - SK.pvz) / dt, -4000, 4000);
    const sm = Math.min(1, dt * 18);
    SK.ax += (rax - SK.ax) * sm;
    SK.az += (raz - SK.az) * sm;
    SK.pvx = vx;
    SK.pz = z;
    SK.pvz = vz;

    const tgt = z < 0 ? 0 : -clamp(vx / 700, -1, 1) * .55;
    SK.vel += (-55 * (SK.ang - tgt) - 4.5 * SK.vel - SK.ax * .0009) * dt;
    SK.ang += SK.vel * dt;
    SK.ang = clamp(SK.ang, -1.1, 1.1);

    SK.tailV += (-70 * SK.tail - 6 * SK.tailV - SK.ax * .0025 + SK.vel * .5) * dt;
    SK.tail = clamp(SK.tail + SK.tailV * dt, -1, 1);

    const lim = w * .45;
    for (let s = 0; s < 2; s++) {
      const hs = dt / 2;
      for (let i = 0; i < NN; i++) {
        const d = ND[i], a = ND[Math.max(0, i - 1)], b = ND[Math.min(NN - 1, i + 1)];
        const wgt = .3 + SHAPE[i][1];
        const k = (i === 0 || i === NN - 1) ? 260 : 110;
        const fx = -SK.ax * .012 * wgt, fy = -SK.az * .012 * wgt;
        d.vx += (-k * d.dx - 9 * d.vx + 30 * ((a.dx + b.dx) / 2 - d.dx) + fx) * hs;
        d.vy += (-k * d.dy - 9 * d.vy + 30 * ((a.dy + b.dy) / 2 - d.dy) + fy) * hs;
        d.dx = clamp(d.dx + d.vx * hs, -lim, lim);
        d.dy = clamp(d.dy + d.vy * hs, -lim, lim);
      }
    }

    const p = SHAPE.map((s, i) => [s[0] * w + ND[i].dx, s[1] * h + ND[i].dy]);

    const trace = () => {
      ctx.beginPath();
      let m = [(p[NN - 1][0] + p[0][0]) / 2, (p[NN - 1][1] + p[0][1]) / 2];
      ctx.moveTo(m[0], m[1]);
      for (let i = 0; i < NN; i++) {
        const q = p[(i + 1) % NN];
        ctx.quadraticCurveTo(p[i][0], p[i][1], (p[i][0] + q[0]) / 2, (p[i][1] + q[1]) / 2);
      }
      ctx.closePath();
    };

    const a = rot(-F * 12, -12);
    ctx.save();
    ctx.translate(a[0], a[1]);
    ctx.rotate(SK.ang);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#111';

    // belt strap
    ctx.fillStyle = BR_D;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.rect(-2, -3, 4, 8);
    ctx.fill();
    ctx.stroke();
    ctx.translate(0, 4);

    // body
    trace();
    ctx.fillStyle = BR;
    ctx.fill();
    ctx.save();
    trace();
    ctx.clip();

    ctx.fillStyle = 'rgba(255,230,170,.22)';
    ctx.beginPath();
    ctx.ellipse(-w * .4, h * .4, w * .45, h * .3, 0, 0, 7);
    ctx.fill();

    ctx.fillStyle = 'rgba(90,60,30,.3)';
    ctx.beginPath();
    ctx.ellipse(w * .45, h * .68, w * .6, h * .38, 0, 0, 7);
    ctx.fill();

    ctx.strokeStyle = 'rgba(60,35,15,.35)';
    ctx.lineWidth = .8;
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const x = w * (.1 + i * .13), y = h * (.5 + i * .06);
      ctx.moveTo(x, y);
      ctx.lineTo(x - 3.5, y + 5);
    }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(70,45,20,.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const sx of [-.5, -.15, .3]) {
      ctx.moveTo(sx * w * .5, 2);
      ctx.quadraticCurveTo(sx * w * 1.1, h * .35, sx * w * 1.3, h * .7);
    }
    ctx.stroke();

    // coin bumps
    const bumps = Math.min(7, Math.ceil(n / 6));
    const bx = (ND[2].dx + ND[8].dx) * .25;
    const by = (ND[4].dy + ND[6].dy) * .35;
    ctx.lineWidth = .9;

    for (let i = 0; i < bumps; i++) {
      const cx = bx + Math.sin(i * 2.3 + 1) * w * .55;
      const cy = by + h * (.45 + (i % 4) * .13);

      ctx.strokeStyle = 'rgba(60,35,15,.45)';
      ctx.beginPath();
      ctx.arc(cx, cy, 2.7, 0, 7);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255,235,180,.4)';
      ctx.beginPath();
      ctx.arc(cx - .4, cy - .4, 2, 3.5, 5);
      ctx.stroke();
    }

    // stitched patch
    ctx.save();
    ctx.translate(F * w * .38, h * .5 + (ND[3].dy + ND[7].dy) * .2);
    ctx.rotate(.15 * F);
    ctx.fillStyle = BR_D;
    ctx.fillRect(-3, -3, 6, 6);
    ctx.setLineDash([1.6, 1.2]);
    ctx.strokeStyle = 'rgba(50,30,10,.8)';
    ctx.lineWidth = .8;
    ctx.strokeRect(-3, -3, 6, 6);
    ctx.restore();

    ctx.restore();
    trace();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = '#111';
    ctx.stroke();

    // gathered neck
    const sway = clamp(-SK.ax * .004, -3, 3) + SK.ang * 2;
    const l = p[0], r = p[NN - 1], top = -7;
    const zx = [
      l[0] - 3.4 + sway,
      l[0] + (r[0] - l[0]) * .25 + sway * 1.1,
      (l[0] + r[0]) / 2 + sway * 1.2,
      l[0] + (r[0] - l[0]) * .75 + sway * 1.1,
      r[0] + 3.4 + sway
    ];

    ctx.beginPath();
    ctx.moveTo(l[0], l[1] + 1);
    zx.forEach((x, i) => ctx.lineTo(x, i % 2 ? top + 2.8 : top));
    ctx.lineTo(r[0], r[1] + 1);
    ctx.closePath();
    ctx.fillStyle = BR;
    ctx.fill();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = '#111';
    ctx.stroke();

    ctx.strokeStyle = 'rgba(70,45,20,.55)';
    ctx.lineWidth = .9;
    ctx.beginPath();
    [1, 2, 3].forEach(i => {
      ctx.moveTo(zx[i], i % 2 ? top + 2.8 : top);
      ctx.lineTo(l[0] + (r[0] - l[0]) * (i / 4), 1.5);
    });
    ctx.stroke();

    // coins peeking out of the mouth
    if (n > 0) {
      const k = Math.min(3, Math.ceil(n / 12));
      for (let j = 0; j < k; j++) {
        const cx = (j - (k - 1) / 2) * 3.2 + sway * 1.1;
        const cy = top + 1 + (j % 2) * .8;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(j * .6 - .5);

        ctx.beginPath();
        ctx.ellipse(0, 0, 2.8, 1.9, 0, 0, 7);
        ctx.fillStyle = GOLD;
        ctx.fill();
        ctx.lineWidth = 1.1;
        ctx.strokeStyle = '#111';
        ctx.stroke();

        ctx.beginPath();
        ctx.ellipse(0, 0, 1.4, .9, 0, 0, 7);
        ctx.strokeStyle = GOLD_D;
        ctx.lineWidth = .6;
        ctx.stroke();
        ctx.restore();
      }
    }

    // tie cord and dangling ends
    const cy0 = 1.6 + (ND[0].dy + ND[NN - 1].dy) * .25;
    ctx.beginPath();
    ctx.moveTo(l[0] - 1, cy0);
    ctx.quadraticCurveTo(0, cy0 + 1.8, r[0] + 1, cy0);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 3.4;
    ctx.stroke();

    ctx.strokeStyle = 'rgb(215,185,120)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    for (const [sgn, len] of [[1, 8], [.6, 6]]) {
      const sx = r[0] - 1;
      const ex = sx + 2.5 * sgn + SK.tail * 6 * sgn;
      const ey = cy0 + len;

      ctx.beginPath();
      ctx.moveTo(sx, cy0);
      ctx.quadraticCurveTo(
        sx + 4 * sgn + SK.tail * 3,
        cy0 + len * .5,
        ex,
        ey
      );

      ctx.strokeStyle = '#111';
      ctx.lineWidth = 2.4;
      ctx.stroke();

      ctx.strokeStyle = 'rgb(215,185,120)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(ex, ey, 1.2, 0, 7);
      ctx.fillStyle = 'rgb(215,185,120)';
      ctx.fill();
      ctx.lineWidth = .9;
      ctx.strokeStyle = '#111';
      ctx.stroke();
    }

    ctx.restore();
  };

  // HUD: coin counter and sound
  const _inv = drawInvHUD;
  drawInvHUD = function () {
    const n = INV.coin || 0;
    if (n > SK.n) {
      kick(1);
      ting();
    }
    SK.n = n;

    if (!n) return _inv();

    delete INV.coin;
    _inv();
    INV.coin = n;

    ctx.save();
    ctx.font = 'italic 20px Georgia,serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#111';
    ctx.globalAlpha = .85;

    const t = '×' + n, tw = ctx.measureText(t).width;
    ctx.fillText(t, W - 24, 58);

    ctx.beginPath();
    ctx.arc(W - 24 - tw - 14, 52, 8, 0, 7);
    ctx.fillStyle = GOLD;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#111';
    ctx.stroke();

    ctx.restore();
  };

  // ================= TAKE A COIN FROM THE SACK (Y) =================
  const TK = { on: false, t: 0, took: false, put: false };
  const TK_TAKE = .42, TK_PUT = .98, TK_END = 1.3;

  window.coinTake = { get active() { return TK.on; } };

  const tkMix = (p, q, k) => [
    lerp(p[0], q[0], k),
    lerp(p[1], q[1], k)
  ];

  function tkBlocked() {
    return P.z < 0 || P.mount || swim.on || TH_CL.on ||
      P.stc > 0 || P.pk > 0 || P.cs > 0 || P.pu > 0 ||
      P.sqg > 0 || P.sqt > 0 || P.dts > 0 || P.stm > 0 ||
      P.fin > 0 || P.thw > 0 || P.tt > 0 || P.stbk > 0 ||
      P.fs > 0 || P.gu > 0 || P.yk > 0 || P.sgp > 0 ||
      P.sm > 0 || P.ln > 0 || P.lb > 0 || P.ld > 0 ||
      P.gun || P.gs === 2 || P.sg || P.kn !== 0 || P.kt > .05 ||
      DD.carry || DD.g.on || TH_SQ.held ||
      P.mpk > 0 || P.mSl > 0 || P.sqSl > 0;
  }

  function tkStart() {
    if (TK.on || (INV.coin || 0) <= 0 || P.puHeld || tkBlocked()) return;

    if (P.skid) endSkid();

    Object.assign(TK, {
      on: true,
      t: 0,
      took: false,
      put: false
    });

    P.idle = 0;
    P.fid = 0;
    P.abuf = 0;
  }

  function tkCancel() {
    if (TK.took && P.puHeld && P.puHeld.type === 'coin') {
      dropItem('coin', P.x + P.face * 20 * CSc());
      P.puHeld = null;
    }
    TK.on = false;
  }

  function tkTick(dt) {
    if (!TK.on) return;

    if (tkBlocked()) {
      tkCancel();
      return;
    }

    TK.t += dt;

    if (!TK.took && TK.t >= TK_TAKE) {
      TK.took = true;

      INV.coin = Math.max(0, (INV.coin || 0) - 1);
      if (!INV.coin) delete INV.coin;

      P.puHeld = {
        type: 'coin',
        seed: Math.random() * 99
      };

      kick(-.6);
      ting();
    }
    if (TK.took && !TK.put && TK.t >= TK_PUT) {
      TK.put = true;

      // Keep the coin in the player's hand.
      // Do not drop it onto the ground here.
    }

    if (TK.t >= TK_END) TK.on = false;
  }

  // Arm reaches into sack, takes coin, and sets it down
  window.coinArm = function (i, sh, F, rot) {
    if (!TK.on || i !== 0) return null;

    const t = TK.t;
    const a = rot(-F * 12, -12);
    const g = SK.ang;

    const mouth = [
      a[0] - 5 * Math.sin(g),
      a[1] + 5 * Math.cos(g)
    ];

    const rest = [sh[0] + F * 14, sh[1] + 80];
    const front = [sh[0] + F * 46, sh[1] + 54];
    const low = [sh[0] + F * 40, sh[1] + 86];

    let T;

    if (t < .30) {
      T = tkMix(rest, mouth, sm(t / .30));
    } else if (t < TK_TAKE) {
      const r = Math.sin(t * 42) * 1.3;
      T = [mouth[0] + r, mouth[1] + 2 + r * .6];
    } else if (t < .64) {
      const u = sm((t - TK_TAKE) / (.64 - TK_TAKE));
      T = tkMix(mouth, front, u);
      T[1] -= 9 * Math.sin(Math.PI * u);
    } else if (t < TK_PUT) {
      T = tkMix(front, low, sm((t - .8) / (TK_PUT - .8)));
    } else {
      T = tkMix(low, rest, sm((t - TK_PUT - .02) / .28));
    }

    const w = sm(t / .14) * (1 - sm((t - 1.1) / .2));
    const [ang, flex] = ikTo(sh, T[0], T[1], F);

    return [ang, flex, w];
  };

  // Draw coin in the hand
  const _dhi = drawHeldItem;
  drawHeldItem = function (F, S, now) {
    const it = P.puHeld;
    _dhi(F, S, now);

    if (!it || it.type !== 'coin') return;

    const A = P.armPts && P.armPts[0];
    if (!A) return;

    const el = A[0], wr = A[1];

    let dx = wr[0] - el[0], dy = wr[1] - el[1];
    const dl = Math.hypot(dx, dy) || 1;

    dx /= dl;
    dy /= dl;

    const x = wr[0] + dx * PALM * .95;
    const y = wr[1] + dy * PALM * .95 - 3;
    const fl = Math.abs(Math.cos(now * 11));

    ctx.save();
    ctx.translate(x, y);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.ellipse(0, 0, Math.max(1.2, 5 * fl), 5, 0, 0, 7);
    ctx.fillStyle = GOLD;
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = '#111';
    ctx.stroke();

    if (fl > .5) {
      ctx.beginPath();
      ctx.ellipse(0, 0, 3 * fl, 3, 0, 0, 7);
      ctx.strokeStyle = GOLD_D;
      ctx.lineWidth = .8;
      ctx.stroke();
    }

    ctx.restore();
  };

  // Lock movement while animation plays
  const _ddl = ddLock;
  ddLock = function () {
    return TK.on || _ddl();
  };

  // Tick animation every frame
  const _upd = update;
  update = function (dt) {
    tkTick(dt);
    return _upd(dt);
  };

  // Y key starts the animation
  addEventListener('keydown', e => {
    if (e.code !== 'KeyY' || e.repeat) return;
    if (/INPUT|TEXTAREA/.test(e.target.tagName || '')) return;

    tkStart();
  });


  // ================= COIN TOSS ANIMATION =================
  const CT = {
    wind: false, wt: 0,
    active: false, x: 0, z: 0, vx: 0, vz: 0,
    spin: 0, spinSpeed: 0, bounces: 0, F: 1
  };
  const CT_GRAVITY = 1100, CT_WIND = .16;
  const TOSS_KEY = 'KeyP';   // G is already used for revolver draw/holster, so using P

  function coinTossStart() {
    if (CT.active || CT.wind || TK.on || CC.on || PB.on) return;
    if (!P.puHeld || P.puHeld.type !== 'coin') return;
    if (P.z < 0 || P.mount || swim.on) return;
    CT.wind = true;
    CT.wt = 0;
    CT.F = Math.sign(P.face) || 1;
  }

  function coinRelease() {
    const F = CT.F;

    // start exactly where the coin is drawn in the hand
    let sx = P.x + F * 30, sz = 260;
    const A = P.armPts && P.armPts[0];
    if (A) {
      const el = A[0], wr = A[1];
      let dx = wr[0] - el[0], dy = wr[1] - el[1];
      const dl = Math.hypot(dx, dy) || 1;
      dx /= dl; dy /= dl;
      sx = P.x + wr[0] + dx * PALM * .95;
      sz = -(wr[1] + dy * PALM * .95 - 3);
    }

    P.puHeld = null;
    Object.assign(CT, {
      wind: false, active: true,
      x: sx, z: sz,
      vx: F * 35 + (P.vx || 0) * .5,   // almost straight up
      vz: 800,                          // high toss
      spin: 0, spinSpeed: F * 18, bounces: 0
    });
    ting();
  }

  function coinTossTick(dt) {
    if (CT.wind) {
      if (!P.puHeld || P.puHeld.type !== 'coin' || tkBlocked()) { CT.wind = false; return; }
      CT.wt += dt;
      if (CT.wt >= CT_WIND) coinRelease();
      return;
    }
    if (!CT.active) return;

    CT.x += CT.vx * dt;
    CT.z += CT.vz * dt;
    CT.vz -= CT_GRAVITY * dt;
    CT.spin += CT.spinSpeed * dt;

    if (CT.z <= 0 && CT.vz < 0) {
      CT.z = 0;
      CT.bounces++;
      if (CT.bounces === 1) {
        CT.vz = -CT.vz * .32; CT.vx *= .6; CT.spinSpeed *= .65;
      } else if (CT.bounces === 2 && -CT.vz > 35) {
        CT.vz = -CT.vz * .2; CT.vx *= .4; CT.spinSpeed *= .35;
      } else {
        CT.active = false;
        dropItem('coin', CT.x);
        ting();
      }
    }
  }

  function coinTossDraw() {
    if (!CT.active) return;
    const S = CSc();
    const sx = W / 2 + (CT.x - P.x) * S;
    const gy = groundY() + 4 - (P.dh || 0) - (P.mh || 0);
    const sy = gy - CT.z * S;
    const fw = Math.abs(Math.cos(CT.spin)) * 5;
    const cw = Math.max(1, fw);

    ctx.save();
    ctx.globalAlpha = Math.max(.08, .3 - CT.z / 500);
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.ellipse(sx, gy, 5 * S, 2 * S, 0, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;

    ctx.translate(sx, sy);
    ctx.scale(S, S);
    ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.ellipse(0, 0, cw, 5, 0, 0, 7);
    ctx.fillStyle = GOLD; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = '#111'; ctx.stroke();
    if (fw > 2.5) {
      ctx.beginPath(); ctx.ellipse(0, 0, fw * .6, 3, 0, 0, 7);
      ctx.strokeStyle = GOLD_D; ctx.lineWidth = .8; ctx.stroke();
    }
    ctx.restore();
  }

  // draw through the HUD hook (always runs, screen space)
  const _hudToss = drawInvHUD;
  drawInvHUD = function () {
    coinTossDraw();
    return _hudToss();
  };

  const _coinTossUpdate = update;
  update = function (dt) {
    coinTossTick(dt);
    return _coinTossUpdate(dt);
  };

  // throwing arm: low back swing -> fast flick up and forward
  const _coinArmY = window.coinArm;
  window.coinArm = function (i, sh, F, rot) {
    if (CT.wind && i === 0) {
      const u = sm(CT.wt / CT_WIND);
      const T = tkMix([sh[0] + F * 6, sh[1] + 70], [sh[0] + F * 44, sh[1] + 8], u);
      const [ang, flex] = ikTo(sh, T[0], T[1], F);
      return [ang, flex, sm(CT.wt / .05)];
    }
    return _coinArmY(i, sh, F, rot);
  };

  const _ddl2 = ddLock;
  ddLock = function () { return CT.wind || _ddl2(); };

  addEventListener('keydown', e => {
    if (e.code !== TOSS_KEY || e.repeat) return;
    if (/INPUT|TEXTAREA/.test(e.target.tagName || '')) return;
    coinTossStart();
  });

  // ================= COIN CATCH =================
  const CC = { on: false, t: 0, px: 0, py: 0, rw: 0 };
  const CC_DUR = .3;          // catch + cushion length
  const CC_RANGE = 80;        // how far sideways the player can reach
  const CC_SNAP = 18;         // hand-to-coin distance that counts as caught

  function coinHandLocal() {
    const A = P.armPts && P.armPts[0];
    if (!A) return null;
    const el = A[0], wr = A[1];
    let dx = wr[0] - el[0], dy = wr[1] - el[1];
    const dl = Math.hypot(dx, dy) || 1;
    dx /= dl; dy /= dl;
    return [wr[0] + dx * PALM * .95, wr[1] + dy * PALM * .95 - 3];
  }

  function coinCanReach() {
    if (!CT.active || CT.vz >= 0 || P.puHeld || CC.on || tkBlocked()) return false;
    return Math.abs(CT.x - P.x) < CC_RANGE && CT.z < 340 && CT.z > 20;
  }

  function coinCatchTick(dt) {
    if (CC.on) {
      CC.t += dt;
      if (CC.t >= CC_DUR || tkBlocked()) CC.on = false;
      return;
    }

    const can = coinCanReach();
    CC.rw = can ? Math.min(1, CC.rw + dt * 10) : Math.max(0, CC.rw - dt * 10);
    if (!can) return;

    const h = coinHandLocal();
    if (!h) return;

    const cx = CT.x - P.x, cy = -CT.z;
    const d = Math.hypot(cx - h[0], cy - h[1]);

    // caught: hand reached the coin, or it fell to waist height right beside the player
    if (d < CC_SNAP || (CT.z < 100 && Math.abs(cx) < 45)) {
      P.puHeld = { type: 'coin', seed: Math.random() * 99 };
      CT.active = false;
      Object.assign(CC, { on: true, t: 0, px: cx, py: cy });
      kick(.4);   // small jiggle of the sack
      ting();
    }
  }

  const _coinArmCatch = window.coinArm;
  window.coinArm = function (i, sh, F, rot) {
    if (i === 0) {
      if (CC.on) {
        // hand pulls down and in, absorbing the coin
        const u = sm(CC.t / CC_DUR);
        const T = tkMix([CC.px, CC.py], [sh[0] + F * 34, sh[1] + 62], u);
        T[1] += 7 * Math.sin(Math.PI * Math.min(1, CC.t / .14));
        const [ang, flex] = ikTo(sh, T[0], T[1], F);
        return [ang, flex, 1 - sm((CC.t - .2) / .1)];
      }
      if (CC.rw > .01 && CT.active) {
        // open hand tracks the falling coin
        const [ang, flex] = ikTo(sh, CT.x - P.x, -CT.z, F);
        return [ang, flex, CC.rw];
      }
    }
    return _coinArmCatch(i, sh, F, rot);
  };

  const _updCatch = update;
  update = function (dt) {
    coinCatchTick(dt);
    return _updCatch(dt);
  };

  // ================= PUT COIN BACK IN SACK (Y while holding a coin) =================
  const PB = { on: false, t: 0, done: false };
  const PB_REL = .36, PB_DUR = .72;

  function pbStart() {
    if (PB.on || TK.on || CT.wind || CT.active || CC.on) return;
    if (!P.puHeld || P.puHeld.type !== 'coin') return;
    if (tkBlocked()) return;
    Object.assign(PB, { on: true, t: 0, done: false });
    P.idle = 0; P.fid = 0; P.abuf = 0;
  }

  function pbTick(dt) {
    if (!PB.on) return;

    // interrupted: if the coin is still in the hand, it simply stays there
    if (tkBlocked()) { PB.on = false; return; }

    PB.t += dt;

    if (!PB.done && PB.t >= PB_REL) {
      PB.done = true;
      if (P.puHeld && P.puHeld.type === 'coin') {
        P.puHeld = null;
        INV.coin = (INV.coin || 0) + 1;   // HUD hook plays the jiggle + ting
      }
    }
    if (PB.t >= PB_DUR) PB.on = false;
  }

  const _coinArmPB = window.coinArm;
  window.coinArm = function (i, sh, F, rot) {
    if (PB.on && i === 0) {
      const t = PB.t;
      const a = rot(-F * 12, -12), g = SK.ang;
      const mouth = [a[0] - 5 * Math.sin(g), a[1] + 5 * Math.cos(g)];
      const front = [sh[0] + F * 46, sh[1] + 54];
      const rest = [sh[0] + F * 14, sh[1] + 80];

      let T;
      if (t < PB_REL) {
        T = tkMix(front, mouth, sm(t / PB_REL));
      } else {
        T = tkMix(mouth, rest, sm((t - PB_REL) / (PB_DUR - PB_REL)));
      }
      const [ang, flex] = ikTo(sh, T[0], T[1], F);
      const w = sm(t / .14) * (1 - sm((t - .5) / .2));
      return [ang, flex, w];
    }
    return _coinArmPB(i, sh, F, rot);
  };

  const _updPB = update;
  update = function (dt) {
    pbTick(dt);
    return _updPB(dt);
  };

  const _ddlPB = ddLock;
  ddLock = function () { return PB.on || _ddlPB(); };

  addEventListener('keydown', e => {
    if (e.code !== 'KeyY' || e.repeat) return;
    if (/INPUT|TEXTAREA/.test(e.target.tagName || '')) return;
    pbStart();
  });

  // ================= SAVE + CLOUD (Supabase) =================
  const SB_URL = 'https://ovnnchjubnlbdkitmegn.supabase.co';
  const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92bm5jaGp1Ym5sYmRraXRtZWduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5NTc4MDcsImV4cCI6MjEwOTUzMzgwN30.IAdGM8p9yGe4Opd88-oMwPU0WqXN_71nvg6TIuNgy-4';
  const sb = window.supabase ? window.supabase.createClient(SB_URL, SB_KEY) : null;
  window.sb = sb;
  // coins in the sack + in the hand + in the air
  const coinTotal = () =>
    (INV.coin || 0) +
    (P.puHeld && P.puHeld.type === 'coin' ? 1 : 0) +
    (CT.active ? 1 : 0);

  let uid = null, ready = false, timer = 0, pending = -1;
  let lastSaved = coinTotal();

  function saveCoins() {
    const n = coinTotal();
    if (n === lastSaved) return;
    lastSaved = n;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ coin: n })); } catch (e) { }
    if (!ready) return;               // never push before the cloud value has loaded
    pending = n;
    clearTimeout(timer);
    timer = setTimeout(flushCloud, 1500);
  }

  async function flushCloud() {
    if (!sb || !uid || pending < 0) return;
    const n = pending;
    pending = -1;
    try {
      const { error } = await sb.from('saves').upsert({
        user_id: uid, coin: n, updated_at: new Date().toISOString()
      });
      if (error) pending = n;
    } catch (e) { pending = n; }
  }

  async function cloudInit() {
    if (!sb) return;
    try {
      let { data: { session } } = await sb.auth.getSession();
      if (!session) {
        const r = await sb.auth.signInAnonymously();
        if (r.error) console.error('anon sign-in', r.error);
        session = r.data.session;
      }
      if (!session) return;
      uid = session.user.id;

      const { data } = await sb.from('saves').select('coin')
        .eq('user_id', uid).maybeSingle();

      const local = coinTotal();
      if (data && data.coin > local) {
        INV.coin = (INV.coin || 0) + (data.coin - local);   // cloud is higher: top up the sack
        SK.n = INV.coin;                                     // no jiggle/ting on load
      }
      lastSaved = coinTotal();
      try { localStorage.setItem(SAVE_KEY, JSON.stringify({ coin: lastSaved })); } catch (e) { }
      if (!data || local > data.coin) pending = lastSaved;  // first run, or offline progress
      ready = true;
      flushCloud();
    } catch (e) { console.error('cloudInit failed', e); }
  }

  const _updSave = update;
  update = function (dt) {
    saveCoins();
    return _updSave(dt);
  };

  addEventListener('beforeunload', saveCoins);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { saveCoins(); flushCloud(); }
  });

  cloudInit();
})();

// ================= RAGDOLL HELD BIRD =================
(() => {
  const cl = (v, a, b) => Math.max(a, Math.min(b, v));
  const mk = a => ({ a, v: 0, acc: 0 });
  const BR = {
    it: null, body: mk(0), head: mk(0), w1: mk(0), w2: mk(0),
    last: 0, init: false, t: 0, dr: 0,
    phx: 0, phy: 0, hvx: 0, hvy: 0, ahx: 0, ahy: 0, pvx: 0, axw: 0
  };
  const SB = .85;          // art scale
  const G = 900;           // gravity: higher = snappier swing
  const WIND = 1.5;        // how far it trails behind when you run

  // one pendulum step. a = angle from straight down, fx = sideways force on the bob
  function pend(s, L, fx, g, c, dt) {
    s.acc = (-g * Math.sin(s.a) + fx * Math.cos(s.a)) / L - c * s.v;
    s.v += s.acc * dt;
    s.a += s.v * dt;
    if (Math.abs(s.a) > 3.1) { s.a = Math.sign(s.a) * 3.1; s.v *= -.3; }
  }
  // keeps the swinging end above the ground, so it lies down when you crouch
  function floor(s, py, len) {
    const b = (-2 - py) / len;
    if (b >= 1 || b <= -1) return;
    const m = Math.acos(b);
    if (Math.abs(s.a) < m) { s.a = (s.a < 0 ? -1 : 1) * m; s.v *= -.15; }
  }

  const _dhiBird = drawHeldItem;
  drawHeldItem = function (F, S, now) {
    const it = P.puHeld, A = P.armPts && P.armPts[0];
    if (!it || it.type !== 'bird' || !A) { BR.it = null; return _dhiBird(F, S, now); }

    const el = A[0], wr = A[1];
    let dx = wr[0] - el[0], dy = wr[1] - el[1];
    const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
    const px = wr[0] + dx * PALM * .6, py = wr[1] + dy * PALM * .6;   // grip point inside the fist

    if (BR.it !== it) {                       // just picked up: starts lying like it did on the ground
      BR.it = it; BR.init = false; BR.t = 0; BR.dr = 0; BR.last = now;
      BR.body.a = 1.45 * F; BR.head.a = 1.2 * F; BR.w1.a = 1.3 * F; BR.w2.a = 1.6 * F;
      for (const s of [BR.body, BR.head, BR.w1, BR.w2]) { s.v = 0; s.acc = 0; }
    }

    const raw = now - BR.last;
    const vx = (P.mount && typeof HRS !== 'undefined') ? (HRS.vx || 0) : (P.vx || 0);

    if (raw > .004) {                         // physics step (once per frame)
      const dt = cl(raw, .004, .05); BR.last = now;
      if (!BR.init) { BR.init = true; BR.phx = px; BR.phy = py; BR.pvx = vx; BR.hvx = 0; BR.hvy = 0; }
      BR.t += dt;

      const hvx = (px - BR.phx) / dt, hvy = (py - BR.phy) / dt;
      const rax = cl((vx - BR.pvx) / dt, -4000, 4000) / S;
      const rahx = cl((hvx - BR.hvx) / dt, -7000, 7000), rahy = cl((hvy - BR.hvy) / dt, -7000, 7000);
      const k = Math.min(1, dt * 20);
      BR.axw += (rax - BR.axw) * k; BR.ahx += (rahx - BR.ahx) * k; BR.ahy += (rahy - BR.ahy) * k;
      BR.phx = px; BR.phy = py; BR.hvx = hvx; BR.hvy = hvy; BR.pvx = vx;

      const fx = cl(-(BR.axw + BR.ahx * .6 + WIND * vx / S), -8000, 8000);
      const gE = cl(G - BR.ahy * .5, 250, 2200);

      const n = 3, h = dt / n;
      for (let i = 0; i < n; i++) {
        pend(BR.body, 12, fx, gE, 2.2, h);
        floor(BR.body, py, 16);
        const th = BR.body.a, sn = Math.sin(th), cs = Math.cos(th);
        const nkY = py + SB * (19 * cs - (-4) * sn);
        const bacc = BR.body.acc * cs - BR.body.v * BR.body.v * sn;
        pend(BR.head, 9, cl(fx - 16 * bacc, -9000, 9000), gE, 3, h);
        floor(BR.head, nkY, 9);
        pend(BR.w1, 10, cl(fx * .9 - 10 * bacc, -9000, 9000), gE, 2.6, h);
        pend(BR.w2, 11, cl(fx * .8 - 10 * bacc, -9000, 9000), gE, 2.9, h);
      }
    }

    const th = BR.body.a, sn = Math.sin(th), cs = Math.cos(th);
    const loc = (x, y) => [px + SB * ((x + 8) * sn - (y - 3) * cs), py + SB * ((x + 8) * cs + (y - 3) * sn)];
    const neck = loc(11, -1), sh = loc(3, -2);
    const ps = BR.head.a;
    const H = [neck[0] + 9 * Math.sin(ps), neck[1] + 9 * Math.cos(ps)];

    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';

    const wing = (s, far) => {
      ctx.save();
      ctx.translate(sh[0], sh[1]); ctx.rotate(Math.PI / 2 - s.a); ctx.scale(SB * (far ? .9 : 1), SB);
      ctx.globalAlpha = far ? .75 : 1;
      ctx.fillStyle = '#111'; ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -3.2); ctx.quadraticCurveTo(9, -6, 17, -1.5);
      ctx.quadraticCurveTo(10, 3.2, 0, 3.2); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = PAPER; ctx.lineWidth = .7; ctx.globalAlpha *= .4;
      ctx.beginPath(); ctx.moveTo(4, -1.6); ctx.lineTo(13, -1.2); ctx.moveTo(4, 1); ctx.lineTo(11, .8); ctx.stroke();
      ctx.restore();
    };

    wing(BR.w2, true);

    // body (tail up at the hand, belly toward the head)
    ctx.save();
    ctx.translate(px, py); ctx.rotate(Math.PI / 2 - th); ctx.scale(SB, SB); ctx.translate(8, -3);
    ctx.fillStyle = '#111'; ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-11, -2); ctx.lineTo(-27, -6); ctx.lineTo(-26, 3); ctx.lineTo(-11, 3);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, 13, 6.5, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = PAPER; ctx.globalAlpha = .5;
    ctx.beginPath(); ctx.ellipse(1, 3, 7, 2, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = '#8c0d14';
    ctx.beginPath(); ctx.ellipse(1, 1.5, 5, 2.8, .2, 0, 7); ctx.fill();
    ctx.restore();

    // limp neck + head
    ctx.strokeStyle = '#111'; ctx.lineWidth = 3.2;
    ctx.beginPath(); ctx.moveTo(neck[0], neck[1]); ctx.lineTo(H[0], H[1]); ctx.stroke();
    ctx.save();
    ctx.translate(H[0], H[1]); ctx.rotate(Math.PI / 2 - ps);
    ctx.fillStyle = '#111'; ctx.strokeStyle = '#111'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(0, 0, 4.6, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c99a3a';
    ctx.beginPath(); ctx.moveTo(3.4, -1.8); ctx.lineTo(11, 0); ctx.lineTo(3.4, 1.5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = PAPER; ctx.lineWidth = .9;
    ctx.beginPath(); ctx.moveTo(-1, -3.2); ctx.lineTo(1.4, -.8); ctx.moveTo(1.4, -3.2); ctx.lineTo(-1, -.8); ctx.stroke();
    ctx.restore();

    wing(BR.w1, false);
    ctx.restore();

    // blood drips from the wound for the first few seconds
    BR.dr -= Math.max(0, raw > .004 ? Math.min(raw, .05) : 0);
    if (BR.dr <= 0 && BR.t < 20 && typeof bgDrop === 'function') {
      BR.dr = .15 + Math.random() * .25 + BR.t * .04;
      const w = loc(1, 1.5);
      bgDrop(P.x + w[0] * S, w[1] * S - (P.dh || 0) - (P.mh || 0),
        (Math.random() - .5) * 20, 10 + Math.random() * 30, 1 + Math.random() * 1.2);
    }

    // fist on top, so the feet look gripped
    const f = P.fistInfo && P.fistInfo[0];
    if (f && FIST.complete) {
      ctx.save(); ctx.translate(f.x, f.y); ctx.scale(f.F, 1); ctx.rotate(f.a - Math.PI / 2);
      ctx.drawImage(FIST, -FIST.naturalWidth / 2, -4); ctx.restore();
    }
  };
})();

// ================= RAGDOLL HELD BIRD =================
(() => {
  const cl = (v, a, b) => Math.max(a, Math.min(b, v));
  const mk = a => ({ a, v: 0, acc: 0 });
  const BR = {
    it: null, body: mk(0), head: mk(0), w1: mk(0), w2: mk(0),
    last: 0, init: false, t: 0, dr: 0,
    phx: 0, phy: 0, hvx: 0, hvy: 0, ahx: 0, ahy: 0, pvx: 0, axw: 0
  };
  const SB = .85;          // art scale
  const G = 900;           // gravity: higher = snappier swing
  const WIND = 1.5;        // how far it trails behind when you run

  // one pendulum step. a = angle from straight down, fx = sideways force on the bob
  function pend(s, L, fx, g, c, dt) {
    s.acc = (-g * Math.sin(s.a) + fx * Math.cos(s.a)) / L - c * s.v;
    s.v += s.acc * dt;
    s.a += s.v * dt;
    if (Math.abs(s.a) > 3.1) { s.a = Math.sign(s.a) * 3.1; s.v *= -.3; }
  }
  // keeps the swinging end above the ground, so it lies down when you crouch
  function floor(s, py, len) {
    const b = (-2 - py) / len;
    if (b >= 1 || b <= -1) return;
    const m = Math.acos(b);
    if (Math.abs(s.a) < m) { s.a = (s.a < 0 ? -1 : 1) * m; s.v *= -.15; }
  }

  const _dhiBird = drawHeldItem;
  drawHeldItem = function (F, S, now) {
    const it = P.puHeld, A = P.armPts && P.armPts[0];
    if (!it || it.type !== 'bird' || !A) { BR.it = null; return _dhiBird(F, S, now); }

    const el = A[0], wr = A[1];
    let dx = wr[0] - el[0], dy = wr[1] - el[1];
    const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
    const px = wr[0] + dx * PALM * .6, py = wr[1] + dy * PALM * .6;   // grip point inside the fist

    if (BR.it !== it) {                       // just picked up: starts lying like it did on the ground
      BR.it = it; BR.init = false; BR.t = 0; BR.dr = 0; BR.last = now;
      BR.body.a = 1.45 * F; BR.head.a = 1.2 * F; BR.w1.a = 1.3 * F; BR.w2.a = 1.6 * F;
      for (const s of [BR.body, BR.head, BR.w1, BR.w2]) { s.v = 0; s.acc = 0; }
    }

    const raw = now - BR.last;
    const vx = (P.mount && typeof HRS !== 'undefined') ? (HRS.vx || 0) : (P.vx || 0);

    if (raw > .004) {                         // physics step (once per frame)
      const dt = cl(raw, .004, .05); BR.last = now;
      if (!BR.init) { BR.init = true; BR.phx = px; BR.phy = py; BR.pvx = vx; BR.hvx = 0; BR.hvy = 0; }
      BR.t += dt;

      const hvx = (px - BR.phx) / dt, hvy = (py - BR.phy) / dt;
      const rax = cl((vx - BR.pvx) / dt, -4000, 4000) / S;
      const rahx = cl((hvx - BR.hvx) / dt, -7000, 7000), rahy = cl((hvy - BR.hvy) / dt, -7000, 7000);
      const k = Math.min(1, dt * 20);
      BR.axw += (rax - BR.axw) * k; BR.ahx += (rahx - BR.ahx) * k; BR.ahy += (rahy - BR.ahy) * k;
      BR.phx = px; BR.phy = py; BR.hvx = hvx; BR.hvy = hvy; BR.pvx = vx;

      const fx = cl(-(BR.axw + BR.ahx * .6 + WIND * vx / S), -8000, 8000);
      const gE = cl(G - BR.ahy * .5, 250, 2200);

      const n = 3, h = dt / n;
      for (let i = 0; i < n; i++) {
        pend(BR.body, 12, fx, gE, 2.2, h);
        floor(BR.body, py, 16);
        const th = BR.body.a, sn = Math.sin(th), cs = Math.cos(th);
        const nkY = py + SB * (19 * cs - (-4) * sn);
        const bacc = BR.body.acc * cs - BR.body.v * BR.body.v * sn;
        pend(BR.head, 9, cl(fx - 16 * bacc, -9000, 9000), gE, 3, h);
        floor(BR.head, nkY, 9);
        pend(BR.w1, 10, cl(fx * .9 - 10 * bacc, -9000, 9000), gE, 2.6, h);
        pend(BR.w2, 11, cl(fx * .8 - 10 * bacc, -9000, 9000), gE, 2.9, h);
      }
    }

    const th = BR.body.a, sn = Math.sin(th), cs = Math.cos(th);
    const loc = (x, y) => [px + SB * ((x + 8) * sn - (y - 3) * cs), py + SB * ((x + 8) * cs + (y - 3) * sn)];
    const neck = loc(11, -1), sh = loc(3, -2);
    const ps = BR.head.a;
    const H = [neck[0] + 9 * Math.sin(ps), neck[1] + 9 * Math.cos(ps)];

    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';

    const wing = (s, far) => {
      ctx.save();
      ctx.translate(sh[0], sh[1]); ctx.rotate(Math.PI / 2 - s.a); ctx.scale(SB * (far ? .9 : 1), SB);
      ctx.globalAlpha = far ? .75 : 1;
      ctx.fillStyle = '#111'; ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -3.2); ctx.quadraticCurveTo(9, -6, 17, -1.5);
      ctx.quadraticCurveTo(10, 3.2, 0, 3.2); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = PAPER; ctx.lineWidth = .7; ctx.globalAlpha *= .4;
      ctx.beginPath(); ctx.moveTo(4, -1.6); ctx.lineTo(13, -1.2); ctx.moveTo(4, 1); ctx.lineTo(11, .8); ctx.stroke();
      ctx.restore();
    };

    wing(BR.w2, true);

    // body (tail up at the hand, belly toward the head)
    ctx.save();
    ctx.translate(px, py); ctx.rotate(Math.PI / 2 - th); ctx.scale(SB, SB); ctx.translate(8, -3);
    ctx.fillStyle = '#111'; ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-11, -2); ctx.lineTo(-27, -6); ctx.lineTo(-26, 3); ctx.lineTo(-11, 3);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, 13, 6.5, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = PAPER; ctx.globalAlpha = .5;
    ctx.beginPath(); ctx.ellipse(1, 3, 7, 2, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = '#8c0d14';
    ctx.beginPath(); ctx.ellipse(1, 1.5, 5, 2.8, .2, 0, 7); ctx.fill();
    ctx.restore();

    // limp neck + head
    ctx.strokeStyle = '#111'; ctx.lineWidth = 3.2;
    ctx.beginPath(); ctx.moveTo(neck[0], neck[1]); ctx.lineTo(H[0], H[1]); ctx.stroke();
    ctx.save();
    ctx.translate(H[0], H[1]); ctx.rotate(Math.PI / 2 - ps);
    ctx.fillStyle = '#111'; ctx.strokeStyle = '#111'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(0, 0, 4.6, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c99a3a';
    ctx.beginPath(); ctx.moveTo(3.4, -1.8); ctx.lineTo(11, 0); ctx.lineTo(3.4, 1.5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = PAPER; ctx.lineWidth = .9;
    ctx.beginPath(); ctx.moveTo(-1, -3.2); ctx.lineTo(1.4, -.8); ctx.moveTo(1.4, -3.2); ctx.lineTo(-1, -.8); ctx.stroke();
    ctx.restore();

    wing(BR.w1, false);
    ctx.restore();

    // blood drips from the wound for the first few seconds
    BR.dr -= Math.max(0, raw > .004 ? Math.min(raw, .05) : 0);
    if (BR.dr <= 0 && BR.t < 20 && typeof bgDrop === 'function') {
      BR.dr = .15 + Math.random() * .25 + BR.t * .04;
      const w = loc(1, 1.5);
      bgDrop(P.x + w[0] * S, w[1] * S - (P.dh || 0) - (P.mh || 0),
        (Math.random() - .5) * 20, 10 + Math.random() * 30, 1 + Math.random() * 1.2);
    }

    // fist on top, so the feet look gripped
    const f = P.fistInfo && P.fistInfo[0];
    if (f && FIST.complete) {
      ctx.save(); ctx.translate(f.x, f.y); ctx.scale(f.F, 1); ctx.rotate(f.a - Math.PI / 2);
      ctx.drawImage(FIST, -FIST.naturalWidth / 2, -4); ctx.restore();
    }
  };
})();
