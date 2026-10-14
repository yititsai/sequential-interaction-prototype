/*
 * Stage 2 — Glide to Steer.
 * Ported from interaction-studies/glide-to-steer. The monster floats above an
 * invisible floor and glides toward the pointer's x on a soft spring, leaning
 * into travel; arrow keys shift the target by 9% of the width.
 * Success: hover over the marked spot on the floor for 1 s.
 */
(function () {
  var S = Seq, B = S.BLOB;
  var reduce = S.reduce;
  var clamp = S.clamp;
  var TAU = Math.PI * 2;

  var stage = { name: 'glide', hint: 'Move left or right to guide the monster over the mark' };

  var W = 0, H = 0, D = 0, R = 0, box = 0;
  var baseY = 0, groundY = 0, shW = 0, shH = 0, bobAmp = 8;
  var x = 0, vx = 0, tx = 0, txs = 0;
  var ang = 0, av = 0;
  var bobPhase = 0, swayPhase = 0, energy = 0;
  var rx = 0, cy = 0, sx = 1, sy = 1, rot = 0, speed = 0, bob = 0;
  var markF = 0.78, markX = 0, dwell = 0, pulse = -1;
  var DWELL = 1.0;

  function limitX(v) {
    var lo = R + 12, hi = W - R - 12;
    return hi < lo ? W / 2 : clamp(v, lo, hi);
  }

  stage.layout = function () {
    var fx = W ? x / W : 0.5, ftx = W ? tx / W : 0.5, ftxs = W ? txs / W : 0.5;
    W = S.W; H = S.H;
    D = Math.min(0.3 * Math.min(W, H), 200);          // --d: min(30vmin, 200px)
    R = D * 0.4856;
    box = D * 0.97 / B.w;                             // monster as wide as the study's circle
    baseY = H * 0.45;
    groundY = baseY + D * 0.85;
    shW = D * 0.75;
    shH = shW * 28 / 156;
    bobAmp = reduce ? 4 : clamp(D * 0.11, 12, 30);
    x = limitX(fx * W); tx = limitX(ftx * W); txs = limitX(ftxs * W);
    markX = limitX(markF * W);
  };

  stage.enter = function (fromX) {
    W = 0;
    stage.layout();
    x = tx = txs = limitX(fromX == null ? W / 2 : fromX);
    // put the mark on the side with more room
    markF = x < W / 2 ? 0.78 : 0.22;
    markX = limitX(markF * W);
    vx = 0; ang = 0; av = 0; energy = 0; bobPhase = 0; swayPhase = 0;
    dwell = 0; pulse = -1;
    stage.started = false;
    stage.done = false;
    stage.update(0);
  };

  stage.startPose = function () { return { x: x, y: baseY, box: box }; };
  stage.pose = function () { return { x: rx, y: cy, box: box }; };
  stage.x = function () { return rx; };
  stage.debug = function () { return { x: x, markX: markX, dwell: dwell }; };

  function aim(clientX) {
    if (stage.done) return;
    tx = limitX(clientX);
    if (!stage.started) { stage.started = true; S.hideHint(); }
  }
  stage.pointermove = function (e, px) { aim(px); };
  stage.pointerdown = function (e, px) { aim(px); };
  stage.keydown = function (e) {
    if (e.key === 'ArrowLeft')  { e.preventDefault(); aim(tx - W * 0.09); }
    if (e.key === 'ArrowRight') { e.preventDefault(); aim(tx + W * 0.09); }
  };

  stage.update = function (dt) {
    var kx = 13;
    var cx = reduce ? 2 * Math.sqrt(13) : 5.4;
    var ka = 45, ca = reduce ? 2 * Math.sqrt(45) : 5.5;
    var h = 1 / 240, n = Math.max(1, Math.ceil(dt / h)), sh = dt / n;
    for (var i = 0; i < n && dt > 0; i++) {
      txs += (tx - txs) * (1 - Math.exp(-sh * (reduce ? 20 : 7)));
      var ax = -kx * (x - txs) - cx * vx;
      vx += ax * sh;
      x += vx * sh;
      var lt = reduce ? 0 : clamp(vx * 0.024, -18, 18);
      var aa = -ka * (ang - lt) - ca * av;
      av += aa * sh;
      ang += av * sh;
    }

    var motion = clamp((Math.abs(vx) + Math.abs(tx - x) * 3) / (W * 0.35), 0, 1);
    energy += (motion - energy) * (1 - Math.exp(-dt * (motion > energy ? 6 : 0.9)));
    bobPhase += dt * TAU / (reduce ? 5 : 3.8 - 0.9 * energy);
    swayPhase += dt * TAU / 5.6;

    bob = Math.sin(bobPhase) + 0.18 * Math.sin(bobPhase * 2 + 1.2);
    var bobY = bob * bobAmp * (1 - 0.4 * energy);
    var swayX = reduce ? 0 : Math.sin(swayPhase) * D * 0.045 * (1 - 0.7 * energy);
    var idleLean = reduce ? 0 : Math.cos(swayPhase) * 2.4 * (1 - 0.7 * energy);

    rx = x + swayX;
    cy = baseY + bobY;
    speed = reduce ? 0 : Math.min(1, Math.abs(vx) / 900);
    sx = 1 + speed * 0.04;
    sy = 1 - speed * 0.04;
    rot = ang + idleLean;

    // the mark fills while the monster hangs over it; drains if it drifts off
    if (!stage.done) {
      var near = Math.abs(x - markX) < Math.max(D * 0.2, 14);
      dwell = near ? Math.min(DWELL, dwell + dt) : Math.max(0, dwell - dt * 1.5);
      if (dwell >= DWELL) {
        stage.done = true;
        pulse = 0;
        tx = markX;                 // settle onto the mark
        S.announce('On the mark');
        S.complete(reduce ? 0.4 : 1.0);
      }
    }
    if (pulse >= 0) pulse += dt;
  };

  stage.drawScene = function (alpha) {
    var ctx = S.ctx;
    var k = dwell / DWELL;
    ctx.save();
    ctx.globalAlpha = alpha;
    // the mark: a dashed oval on the invisible floor that fills with dwell time
    var mw = shW * 0.62, mh = shH * 0.9;
    ctx.beginPath();
    ctx.ellipse(markX, groundY, mw, mh, 0, 0, TAU);
    ctx.fillStyle = S.C.mark;
    ctx.globalAlpha = alpha * (0.05 + 0.4 * k);
    ctx.fill();
    ctx.globalAlpha = alpha * (0.45 + 0.4 * k);
    ctx.strokeStyle = S.C.ring;
    ctx.lineWidth = 1.5;
    if (k < 1) ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
    if (pulse >= 0 && pulse < 0.6) {
      var p = pulse / 0.6;
      ctx.globalAlpha = alpha * 0.5 * (1 - p);
      ctx.beginPath();
      ctx.ellipse(markX, groundY, mw * (1 + p * 0.8), mh * (1 + p * 0.8), 0, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  };

  stage.drawShadow = function (alpha) {
    // shadow shrinks and fades as the form rises, widens slightly with speed
    var ctx = S.ctx;
    var up = clamp(-bob, -1, 1);
    var ss = (1 - 0.16 * up) * (1 + speed * 0.1);
    var sv = 1 - 0.1 * up;
    var w = shW * ss / 2, hh = shH * sv / 2;
    ctx.save();
    ctx.globalAlpha = alpha * clamp(1 - 0.3 * up, 0, 1);
    ctx.translate(rx, groundY);
    ctx.scale(1, hh / w);
    var g = ctx.createRadialGradient(0, 0, 0, 0, 0, w);
    g.addColorStop(0, 'rgba(0,0,0,' + S.C.shadowA + ')');
    g.addColorStop(0.6, 'rgba(0,0,0,' + S.C.shadowB + ')');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, w, 0, TAU);
    ctx.fill();
    ctx.restore();
  };

  stage.drawMonster = function () {
    stage.drawShadow(1);
    S.drawMonster({ x: rx, y: cy, box: box, sx: sx, sy: sy, rot: rot });
  };

  S.stages = S.stages || {};
  S.stages.glide = stage;
})();
