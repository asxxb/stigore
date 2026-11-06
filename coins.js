(() => {
  // ---- coin as a normal pick-up item (uses your existing T pickup) ----
  ITEM_DEFS.coin = { label: 'COIN', h: 3 };

  // TEMP TEST STARTING BALANCE
  // Remove this line after confirming the Y animation works.
  INV.coin = Math.max(INV.coin || 0, 5);

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
    ang: 0, vel: 0, pop: 0, last: 0, n: 0,
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
    if (TK.took && !TK.put) {
      dropItem('coin', P.x + P.face * 20 * CSc());
    }

    if (P.puHeld && P.puHeld.type === 'coin') {
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

  // Test coins on the ground near treehouse
  for (const lx of [-330, -200, -120, 130, 210, 290]) {
    dropItem('coin', TH_WX + lx * TH_SC);
  }


  // ================= COIN TOSS ANIMATION =================
  const CT = {
    wind: false, wt: 0,
    active: false, x: 0, z: 0, vx: 0, vz: 0,
    spin: 0, spinSpeed: 0, bounces: 0, F: 1
  };
  const CT_GRAVITY = 1100, CT_WIND = .16;
  const TOSS_KEY = 'KeyP';   // G is already used for revolver draw/holster, so using P

  function coinTossStart() {
    if (CT.active || CT.wind || TK.on) return;
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
})();