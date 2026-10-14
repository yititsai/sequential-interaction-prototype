/*
 * Stage 4 — Charge + Burst.
 * Ported from interaction-studies/charge-and-burst. Hold two fingers, the
 * mouse button, or Space: the monster swells, pulses faster, vibrates and a
 * ring fills over 1 s; at full charge it bursts upward. Releasing early lets
 * the charge ease back. A fresh press is needed for each charge.
 * Success: landing on the upper platform.
 */
(function () {
  var S = Seq, B = S.BLOB;
  var reduce = S.reduce;
  var clamp = S.clamp;
  var TAU = Math.PI * 2;

  var stage = { name: 'burst', hint: 'Hold to charge: two fingers, the mouse button, or Space' };

  var W = 0, H = 0;
  var W0 = 80, box = 116, h0 = 63, THICK = 12;
  var cx = 0, lowTop = 0, upTop = 0, rise = 0, g = 3000;
  var plats = [];

  var HOLD = 1.0, MAX_GROW = 0.45;
  var state = 'idle', idx = 0, py = 0, vy = 0;
  var charge = 0, grow = 0, sq = 0, sqv = 0, sqT = 0;
  var contact = 0, markY = 0, armed = false;
  var trail = [], rings = [], trailAcc = 0;
  var pulsePh = 0, pulseRate = TAU / 2.6, pulseAmp = 0.018;
  var jumpV = 800;
  var calm = 0;                      // 0 -> 1 after arrival: contact markers fade away
  var t = 0;
  var dx = 0, dy = 0, sx = 1, sy = 1;

  var touches = {}, mouse = false, space = false;

  function layout() {
    W = S.W; H = S.H;
    W0 = clamp(Math.min(W, H) * 0.17, 60, 120);
    box = W0 / B.w;
    h0 = box * (290 / 400);          // the monster's drawn height
    cx = W / 2;
    lowTop = H * 0.74;
    rise = h0 * 2.6;
    upTop = lowTop - rise;
    g = Math.max(3600, H * 4.8);
    plats = [
      { x: cx - W0 * 2.0, y: lowTop, w: W0 * 4.0 },
      { x: cx - W0 * 1.2, y: upTop, w: W0 * 2.4 }
    ];
  }
  function platTop(i) { return i === 0 ? lowTop : upTop; }

  stage.layout = function () {
    layout();
    state = 'idle';
    vy = 0;
    py = platTop(idx);
    charge = 0; grow = 0; sq = 0; sqv = 0; sqT = 0;
    trail = []; rings = [];
    markY = py - h0 * 0.5;
  };

  stage.enter = function () {
    layout();
    state = 'idle'; idx = 0; py = lowTop; vy = 0;
    charge = 0; grow = 0; sq = 0; sqv = 0; sqT = 0;
    contact = 0; markY = lowTop - h0 * 0.5;
    trail = []; rings = []; trailAcc = 0;
    armed = false;                     // anything still held from the last stage must be released first
    touches = {}; mouse = false; space = false;
    calm = 0;
    stage.started = false;
    stage.done = false;
  };

  function centerY(feetY) { return feetY - (B.feet - B.cy) * box / 400; }
  stage.startPose = function () { return { x: cx, y: centerY(lowTop), box: box }; };
  stage.pose = function () { return { x: cx + dx, y: centerY(py + dy), box: box }; };
  // where the closing ripple leaves from
  stage.monsterCenter = function () { return { x: cx, y: centerY(py), box: box }; };

  /* ---------- Input: two touches, with press-and-hold as the fallback ---------- */
  function holdingNow() { return Object.keys(touches).length >= 2 || mouse || space; }
  stage.pointerdown = function (e) {
    if (e.pointerType === 'touch') touches[e.pointerId] = true;
    else if (e.button === 0) mouse = true;
  };
  stage.pointerup = function (e) {
    if (e.pointerType === 'touch') delete touches[e.pointerId];
    else mouse = false;
  };
  stage.keydown = function (e) { if (e.code === 'Space') { e.preventDefault(); space = true; } };
  stage.keyup = function (e) { if (e.code === 'Space') { e.preventDefault(); space = false; } };
  stage.blur = function () { touches = {}; mouse = false; space = false; };

  /* ---------- Launch and landing ---------- */
  function launch() {
    state = 'flight';
    armed = false;
    var jumpH = idx === 0 ? rise + h0 * 0.5 : rise * 0.9;
    jumpV = Math.sqrt(2 * g * jumpH);
    vy = -jumpV;
    grow = 1; charge = 0;
    sq = -1.2; sqv = 0; sqT = 0;
    trailAcc = 0;
    rings.push({ x: cx, y: py, from: W0 * 0.3, to: W0 * 1.3, age: 0, dur: 0.35 });
    if (!reduce) trail.push({ x: cx, y: py, w: W0 * 1.2, h: h0 * 1.3, age: 0, life: 0.35 });
  }
  function land(i) {
    var from = idx;
    idx = i;
    py = platTop(i);
    vy = 0;
    state = 'idle';
    sq = 0.85; sqv = 0;
    rings.push({ x: cx, y: py, from: W0 * 0.3, to: W0 * 1.0, age: 0, dur: 0.3 });
    if (i === 1 && from === 0 && !stage.done) {
      stage.done = true;
      S.announce('The monster made it');
      S.complete(reduce ? 0.3 : 0.6);
    }
  }

  /* ---------- Update ---------- */
  stage.update = function (dt) {
    t += dt;
    var holding = holdingNow() && !stage.done;
    if (!holding) armed = true;
    var active = holding && armed && state === 'idle';
    if (active && !stage.started) { stage.started = true; S.hideHint(); }

    contact += ((active ? 1 : 0) - contact) * (1 - Math.exp(-dt * (active ? 30 : 6)));
    if (stage.done) calm = Math.min(1, calm + dt * 0.8);

    var building = state === 'idle' && (active || charge > 0);
    var rateT = building ? TAU * (1.8 + 10 * charge) : TAU / 2.6;
    var ampT = reduce ? 0.006 : (building ? 0.015 + 0.05 * charge : 0.018);
    pulseRate += (rateT - pulseRate) * (1 - Math.exp(-dt * 10));
    pulseAmp += (ampT - pulseAmp) * (1 - Math.exp(-dt * 10));
    pulsePh += pulseRate * dt;

    if (state === 'idle') {
      if (active) {
        charge = Math.min(1, charge + dt / HOLD);
        if (charge >= 1) launch();
      } else if (charge > 0) {
        charge = Math.max(0, charge - dt * 0.8);
      }
      if (state === 'idle') {
        if (charge > 0 || active) grow = charge;
        else grow *= Math.exp(-dt * 7);
        sqT = active ? 1 - 0.85 * charge : 0;
      }
    }

    if (state === 'flight') {
      var prev = py;
      vy += g * dt;
      py += vy * dt;
      grow *= Math.exp(-dt * 5);
      sqT = 0;
      if (vy >= 0) {
        if (prev <= upTop + 2 && py >= upTop) land(1);
        else if (prev <= lowTop + 2 && py >= lowTop) land(0);
      }
      if (state === 'flight' && py > lowTop + 4) land(0);
      if (state === 'flight' && !reduce && vy < 0.35 * jumpV) {
        trailAcc += Math.abs(vy) * dt;
        if (trailAcc > h0 * 0.3) {
          trailAcc = 0;
          var gs0 = 1 + MAX_GROW * Math.pow(grow, 1.3);
          trail.push({ x: cx, y: py, w: W0 * gs0 * 0.9, h: h0 * gs0 * 0.9, age: 0, life: 0.35 });
          if (trail.length > 8) trail.shift();
        }
      }
    }

    var hstep = 1 / 240, n = Math.max(1, Math.ceil(dt / hstep)), sh = dt / n;
    for (var j = 0; j < n; j++) {
      sqv += (-480 * (sq - sqT) - 34 * sqv) * sh;
      sq += sqv * sh;
    }

    markY += ((platTop(idx) - h0 * 0.5) - markY) * (1 - Math.exp(-dt * 8));

    for (var a = trail.length - 1; a >= 0; a--) {
      trail[a].age += dt;
      if (trail[a].age >= trail[a].life) trail.splice(a, 1);
    }
    for (var b = rings.length - 1; b >= 0; b--) {
      rings[b].age += dt;
      if (rings[b].age >= rings[b].dur) rings.splice(b, 1);
    }

    // body transform values used by draw and pose
    var gs = 1 + MAX_GROW * Math.pow(grow, 1.3);
    var pulse = state === 'idle' ? 1 + pulseAmp * Math.sin(pulsePh) : 1;
    var fl = state === 'flight' ? clamp(-vy / jumpV, -1, 1) : 0;
    var vs = Math.abs(fl) * (fl > 0 ? 0.38 : 0.16);
    var q = reduce ? sq * 0.4 : sq;
    sx = gs * pulse * (1 + 0.08 * q) * (1 - 0.55 * vs);
    sy = gs * pulse * (1 - 0.14 * q) * (1 + vs);
    var vib = (!reduce && state === 'idle') ? Math.pow(grow, 1.2) * W0 * 0.055 : 0;
    dx = vib ? Math.sin(t * (40 + 100 * grow)) * vib : 0;
    dy = vib ? Math.cos(t * (52 + 110 * grow)) * vib * 0.4 : 0;
  };

  /* ---------- Draw ---------- */
  stage.drawScene = function (alpha) {
    var ctx = S.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = S.C.platform;
    plats.forEach(function (p) { ctx.fillRect(p.x, p.y, p.w, THICK); });
    // contact markers: faint at rest, dark and slightly smaller while pressed
    var mr = W0 * 0.16 * (1 - 0.1 * contact);
    var mx = W0 * 1.05;
    var fade = alpha * (1 - calm);
    ctx.lineWidth = 1.5;
    [-1, 1].forEach(function (side) {
      ctx.beginPath();
      ctx.arc(cx + side * mx, markY, mr, 0, TAU);
      ctx.globalAlpha = fade * (0.06 + 0.5 * contact);
      ctx.fillStyle = S.C.mark;
      ctx.fill();
      ctx.globalAlpha = fade * (0.28 + 0.62 * contact);
      ctx.strokeStyle = S.C.mark;
      ctx.stroke();
    });
    ctx.restore();
  };

  stage.drawMonster = function () {
    var ctx = S.ctx, C = S.C;
    ctx.save();
    // motion trail
    ctx.strokeStyle = C.mark;
    trail.forEach(function (tr) {
      ctx.globalAlpha = (1 - tr.age / tr.life) * 0.55;
      ctx.beginPath();
      var so = tr.y + 6 + tr.age * 50;
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.moveTo(tr.x - tr.w * 0.28, so); ctx.lineTo(tr.x - tr.w * 0.28, so + tr.h * 0.3);
      ctx.moveTo(tr.x, so);               ctx.lineTo(tr.x, so + tr.h * 0.55);
      ctx.moveTo(tr.x + tr.w * 0.28, so); ctx.lineTo(tr.x + tr.w * 0.28, so + tr.h * 0.3);
      ctx.stroke();
    });
    // burst and landing rings
    rings.forEach(function (r) {
      var k = r.age / r.dur;
      ctx.globalAlpha = (1 - k) * 0.5;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      var rr = r.from + (r.to - r.from) * k;
      ctx.ellipse(r.x, r.y, rr, rr * 0.22, 0, 0, TAU);
      ctx.stroke();
    });
    ctx.restore();

    S.drawMonster({ x: cx + dx, y: py + dy, box: box, ox: B.cx, oy: B.feet, sx: sx, sy: sy });

    // charge ring: thin, fills as the hold builds
    if (state === 'idle' && charge > 0.003) {
      var curW = W0 * sx, curH = h0 * sy;
      var rx = curW / 2 + 14, ry = curH / 2 + 14;
      var ringY = py - curH / 2 - 4;
      ctx.save();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = C.mark;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.ellipse(cx, ringY, rx, ry, 0, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 0.95;
      var ea = -Math.PI / 2 + TAU * charge;
      ctx.fillStyle = C.mark;
      ctx.beginPath();
      ctx.arc(cx + rx * Math.cos(ea), ringY + ry * Math.sin(ea), 4, 0, TAU);
      ctx.fill();
      ctx.lineWidth = 3.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.ellipse(cx, ringY, rx, ry, 0, -Math.PI / 2, -Math.PI / 2 + TAU * charge);
      ctx.stroke();
      ctx.restore();
    }
  };

  S.stages = S.stages || {};
  S.stages.burst = stage;
})();
