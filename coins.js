(() => {
  // ---- coin as a normal pick-up item (uses your existing T pickup) ----
  ITEM_DEFS.coin = { label: 'COIN', h: 3 };

  const GOLD = 'rgb(232,184,48)', GOLD_D = 'rgb(176,128,30)';
  let ac = null;

  function ting() {                                        // tiny synthesized "ting", no audio file needed
    if (!audioOn) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const t = ac.currentTime;
      [1318, 1760].forEach((f, i) => {
        const o = ac.createOscillator(), g = ac.createGain(), s = t + i * .06;
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(.0001, s);
        g.gain.exponentialRampToValueAtTime(.12, s + .01);
        g.gain.exponentialRampToValueAtTime(.0001, s + .35);
        o.connect(g); g.connect(ac.destination); o.start(s); o.stop(s + .4);
      });
    } catch (e) { }
  }

  // ---- coin art (wraps drawItemShape, so ground + in-hand both work) ----
  const _shape = drawItemShape;
  drawItemShape = function (it, now, inHand) {
    if (it.type !== 'coin') return _shape(it, now, inHand);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = '#111';
    if (inHand) {
      ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, 7); ctx.fillStyle = GOLD; ctx.fill(); ctx.lineWidth = 1.8; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 3.4, 0, 7); ctx.strokeStyle = GOLD_D; ctx.lineWidth = 1; ctx.stroke();
      return;
    }
    ctx.beginPath(); ctx.ellipse(0, 1, 6, 2, 0, 0, 7); ctx.fillStyle = GOLD_D; ctx.fill(); ctx.lineWidth = 1.6; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, 6, 2, 0, 0, 7); ctx.fillStyle = GOLD; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, 3.6, 1.1, 0, 0, 7); ctx.strokeStyle = GOLD_D; ctx.lineWidth = .8; ctx.stroke();
    const g = ((performance.now() / 1000 + it.seed) % 3) / 3;
    if (g < .25) {
      const k = Math.sin(Math.PI * g / .25) * 4;
      ctx.strokeStyle = '#fff6c0'; ctx.lineWidth = .9; ctx.beginPath();
      ctx.moveTo(-2 - k, -3); ctx.lineTo(-2 + k, -3); ctx.moveTo(-2, -3 - k); ctx.lineTo(-2, -3 + k); ctx.stroke();
    }
  };

  // ================= SACK: soft-body physics =================
  const SK = { ang: 0, vel: 0, pop: 0, last: 0, n: 0, pvx: 0, pvz: 0, pz: 0, ax: 0, az: 0, tail: 0, tailV: 0 };
  // outline nodes (normalized: x * width, y * height) - teardrop sack, mouth at the top
  const SHAPE = [[-.32, 0], [-.8, .22], [-1, .52], [-.9, .82], [-.5, .99], [0, 1.03], [.5, .99], [.9, .82], [1, .52], [.8, .22], [.32, 0]];
  const NN = SHAPE.length;
  const ND = SHAPE.map(() => ({ dx: 0, dy: 0, vx: 0, vy: 0 }));    // per-node offset + velocity
  const BR = 'rgb(176,128,76)', BR_D = 'rgb(150,105,60)';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function kick(s) {                                   // coin dropped in: sack hops + bulges
    SK.vel += 7 * s; SK.pop = 1;
    ND.forEach((d, i) => { d.vy -= 45 * s * SHAPE[i][1]; d.vx += SHAPE[i][0] * 35 * s; });
  }

  window.coinDrawSack = function (rot, F, now) {
    const dt = clamp(now - SK.last, .001, .05); SK.last = now;
    const n = INV.coin || 0, f = Math.min(1, n / 40);
    const w = 9 + 6 * f + SK.pop * 1.5, h = 19 + 7 * f;          // big sack, bulges when fuller
    SK.pop = Math.max(0, SK.pop - dt * 4);

    // --- player acceleration (drives inertia) ---
    const vx = P.vx || 0, z = P.z || 0, vz = (z - SK.pz) / dt;
    const rax = clamp((vx - SK.pvx) / dt, -4000, 4000), raz = clamp((vz - SK.pvz) / dt, -4000, 4000);
    const sm = Math.min(1, dt * 18);
    SK.ax += (rax - SK.ax) * sm; SK.az += (raz - SK.az) * sm;
    SK.pvx = vx; SK.pz = z; SK.pvz = vz;

    // --- whole-sack pendulum swing ---
    const tgt = z < 0 ? 0 : -clamp(vx / 700, -1, 1) * .55;
    SK.vel += (-55 * (SK.ang - tgt) - 4.5 * SK.vel - SK.ax * .0009) * dt; SK.ang += SK.vel * dt;
    SK.ang = clamp(SK.ang, -1.1, 1.1);

    // --- cord tail swing ---
    SK.tailV += (-70 * SK.tail - 6 * SK.tailV - SK.ax * .0025 + SK.vel * .5) * dt;
    SK.tail = clamp(SK.tail + SK.tailV * dt, -1, 1);

    // --- soft-body nodes: spring to rest + neighbour coupling + inertia ---
    const lim = w * .45;
    for (let s = 0; s < 2; s++) {
      const hs = dt / 2;
      for (let i = 0; i < NN; i++) {
        const d = ND[i], a = ND[Math.max(0, i - 1)], b = ND[Math.min(NN - 1, i + 1)];
        const wgt = .3 + SHAPE[i][1];                                 // lower nodes swing more
        const k = (i === 0 || i === NN - 1) ? 260 : 110;             // mouth is held tight by the cord
        const fx = -SK.ax * .012 * wgt, fy = -SK.az * .012 * wgt;
        d.vx += (-k * d.dx - 9 * d.vx + 30 * ((a.dx + b.dx) / 2 - d.dx) + fx) * hs;
        d.vy += (-k * d.dy - 9 * d.vy + 30 * ((a.dy + b.dy) / 2 - d.dy) + fy) * hs;
        d.dx = clamp(d.dx + d.vx * hs, -lim, lim); d.dy = clamp(d.dy + d.vy * hs, -lim, lim);
      }
    }

    const p = SHAPE.map((s, i) => [s[0] * w + ND[i].dx, s[1] * h + ND[i].dy]);
    const trace = () => {                                            // smooth closed outline through the nodes
      ctx.beginPath();
      let m = [(p[NN - 1][0] + p[0][0]) / 2, (p[NN - 1][1] + p[0][1]) / 2];
      ctx.moveTo(m[0], m[1]);
      for (let i = 0; i < NN; i++) {
        const q = p[(i + 1) % NN];
        ctx.quadraticCurveTo(p[i][0], p[i][1], (p[i][0] + q[0]) / 2, (p[i][1] + q[1]) / 2);
      }
      ctx.closePath();
    };

    const a = rot(-F * 12, -12);                                     // belt spot
    ctx.save(); ctx.translate(a[0], a[1]); ctx.rotate(SK.ang);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = '#111';

    // belt strap (leather loop the sack hangs from)
    ctx.fillStyle = BR_D; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.rect(-2, -3, 4, 8); ctx.fill(); ctx.stroke();
    ctx.translate(0, 4);

    // --- body ---
    trace(); ctx.fillStyle = BR; ctx.fill();
    ctx.save(); trace(); ctx.clip();
    ctx.fillStyle = 'rgba(255,230,170,.22)';                         // light side
    ctx.beginPath(); ctx.ellipse(-w * .4, h * .4, w * .45, h * .3, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(90,60,30,.3)';                             // shade side
    ctx.beginPath(); ctx.ellipse(w * .45, h * .68, w * .6, h * .38, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(60,35,15,.35)'; ctx.lineWidth = .8;      // hatching
    ctx.beginPath();
    for (let i = 0; i < 7; i++) { const x = w * (.1 + i * .13), y = h * (.5 + i * .06); ctx.moveTo(x, y); ctx.lineTo(x - 3.5, y + 5); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(70,45,20,.5)'; ctx.lineWidth = 1;        // folds running from the cord
    ctx.beginPath();
    for (const sx of [-.5, -.15, .3]) { ctx.moveTo(sx * w * .5, 2); ctx.quadraticCurveTo(sx * w * 1.1, h * .35, sx * w * 1.3, h * .7); }
    ctx.stroke();
    // coin bumps pushing against the cloth
    const bumps = Math.min(7, Math.ceil(n / 6));
    const bx = (ND[2].dx + ND[8].dx) * .25, by = (ND[4].dy + ND[6].dy) * .35;
    ctx.lineWidth = .9;
    for (let i = 0; i < bumps; i++) {
      const cx = bx + Math.sin(i * 2.3 + 1) * w * .55, cy = by + h * (.45 + (i % 4) * .13);
      ctx.strokeStyle = 'rgba(60,35,15,.45)'; ctx.beginPath(); ctx.arc(cx, cy, 2.7, 0, 7); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,235,180,.4)'; ctx.beginPath(); ctx.arc(cx - .4, cy - .4, 2, 3.5, 5); ctx.stroke();
    }
    // stitched patch
    ctx.save(); ctx.translate(F * w * .38, h * .5 + (ND[3].dy + ND[7].dy) * .2); ctx.rotate(.15 * F);
    ctx.fillStyle = BR_D; ctx.fillRect(-3, -3, 6, 6);
    ctx.setLineDash([1.6, 1.2]); ctx.strokeStyle = 'rgba(50,30,10,.8)'; ctx.lineWidth = .8; ctx.strokeRect(-3, -3, 6, 6);
    ctx.restore();
    ctx.restore();
    trace(); ctx.lineWidth = 2.4; ctx.strokeStyle = '#111'; ctx.stroke();

    // --- gathered, pleated neck (sways with motion) ---
    const sway = clamp(-SK.ax * .004, -3, 3) + SK.ang * 2;
    const l = p[0], r = p[NN - 1], top = -7;
    const zx = [l[0] - 3.4 + sway, l[0] + (r[0] - l[0]) * .25 + sway * 1.1, (l[0] + r[0]) / 2 + sway * 1.2, l[0] + (r[0] - l[0]) * .75 + sway * 1.1, r[0] + 3.4 + sway];
    ctx.beginPath(); ctx.moveTo(l[0], l[1] + 1);
    zx.forEach((x, i) => ctx.lineTo(x, i % 2 ? top + 2.8 : top));
    ctx.lineTo(r[0], r[1] + 1); ctx.closePath();
    ctx.fillStyle = BR; ctx.fill(); ctx.lineWidth = 1.8; ctx.strokeStyle = '#111'; ctx.stroke();
    ctx.strokeStyle = 'rgba(70,45,20,.55)'; ctx.lineWidth = .9; ctx.beginPath();   // pleats
    [1, 2, 3].forEach(i => { ctx.moveTo(zx[i], i % 2 ? top + 2.8 : top); ctx.lineTo(l[0] + (r[0] - l[0]) * (i / 4), 1.5); });
    ctx.stroke();

    // coins peeking out of the mouth
    if (n > 0) {
      const k = Math.min(3, Math.ceil(n / 12));
      for (let j = 0; j < k; j++) {
        const cx = (j - (k - 1) / 2) * 3.2 + sway * 1.1, cy = top + 1 + (j % 2) * .8;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(j * .6 - .5);
        ctx.beginPath(); ctx.ellipse(0, 0, 2.8, 1.9, 0, 0, 7); ctx.fillStyle = GOLD; ctx.fill(); ctx.lineWidth = 1.1; ctx.strokeStyle = '#111'; ctx.stroke();
        ctx.beginPath(); ctx.ellipse(0, 0, 1.4, .9, 0, 0, 7); ctx.strokeStyle = GOLD_D; ctx.lineWidth = .6; ctx.stroke();
        ctx.restore();
      }
    }

    // --- tie cord + dangling ends ---
    const cy0 = 1.6 + (ND[0].dy + ND[NN - 1].dy) * .25;
    ctx.beginPath(); ctx.moveTo(l[0] - 1, cy0); ctx.quadraticCurveTo(0, cy0 + 1.8, r[0] + 1, cy0);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 3.4; ctx.stroke();
    ctx.strokeStyle = 'rgb(215,185,120)'; ctx.lineWidth = 1.5; ctx.stroke();
    for (const [sgn, len] of [[1, 8], [.6, 6]]) {
      const sx = r[0] - 1, ex = sx + 2.5 * sgn + SK.tail * 6 * sgn, ey = cy0 + len;
      ctx.beginPath(); ctx.moveTo(sx, cy0); ctx.quadraticCurveTo(sx + 4 * sgn + SK.tail * 3, cy0 + len * .5, ex, ey);
      ctx.strokeStyle = '#111'; ctx.lineWidth = 2.4; ctx.stroke();
      ctx.strokeStyle = 'rgb(215,185,120)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.arc(ex, ey, 1.2, 0, 7); ctx.fillStyle = 'rgb(215,185,120)'; ctx.fill(); ctx.lineWidth = .9; ctx.strokeStyle = '#111'; ctx.stroke();
    }
    ctx.restore();
  };

  // ---- HUD: coin counter, plus bounce + ting when the count goes up ----
  const _inv = drawInvHUD;
  drawInvHUD = function () {
    const n = INV.coin || 0;
    if (n > SK.n) { kick(1); ting(); }
    SK.n = n;
    if (!n) return _inv();
    delete INV.coin; _inv(); INV.coin = n;
    ctx.save(); ctx.font = 'italic 20px Georgia,serif'; ctx.textAlign = 'right'; ctx.fillStyle = '#111'; ctx.globalAlpha = .85;
    const t = '×' + n, tw = ctx.measureText(t).width;
    ctx.fillText(t, W - 24, 58);
    ctx.beginPath(); ctx.arc(W - 24 - tw - 14, 52, 8, 0, 7); ctx.fillStyle = GOLD; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#111'; ctx.stroke();
    ctx.restore();
  };

  // ---- test coins on the ground around the treehouse (climb down to get them) ----
  for (const lx of [-330, -200, -120, 130, 210, 290]) dropItem('coin', TH_WX + lx * TH_SC);
})();