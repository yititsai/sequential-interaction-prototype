/*
 * Stage 1 — Wake the Monster.
 * Ported from interaction-studies/wake-the-monster. Press the blob (only its
 * shape counts) or Space/Enter: stiff squash spring; release relaxes with one
 * soft overshoot, a quick tap still squashes to 70% first. The first release
 * wakes it (contrast fades back over 0.9 s) and a ripple leaves 140 ms later.
 * Success: the monster is awake.
 */
(function () {
  var S = Seq, B = S.BLOB;
  var reduce = S.reduce;

  var stage = { name: 'wake', hint: 'Press the monster to wake it' };

  var cx = 0, cy = 0, box = 300;
  var q, qv, target, k, c;
  var pressed, pendingRelease, activeId, awake, hover, focusKey;
  var awakeMix = 0, edgeW = 3;
  var phase = 0, period = 4.6, amp = reduce ? 0 : 0.03;
  var sx = 1, sy = 1;
  var MIN_SQUASH = 0.7;

  stage.layout = function () {
    // --size: min(64vmin, 360px), never wider than the 16px gutters allow
    box = Math.min(0.64 * Math.min(S.W, S.H), 360, S.W - 32);
    cx = S.W / 2;
    cy = S.H / 2;
  };

  // `fromAwake`: on Start over the monster arrives awake and falls back asleep
  stage.enter = function (fromAwake) {
    q = 0; qv = 0; target = 0; k = 160; c = 2 * Math.sqrt(k);
    pressed = false; pendingRelease = false; activeId = null;
    awake = false; hover = false; focusKey = false;
    awakeMix = fromAwake ? 1 : 0;
    stage.started = false;
    stage.done = false;
    S.clearRipples();
  };

  // origin of the art inside the box -> where its bbox center sits on screen
  function centerOffset() { return { x: (B.cx - B.wakeOx) * box / 400, y: (B.cy - B.wakeOy) * box / 400 }; }

  stage.startPose = function () {
    var o = centerOffset();
    return { x: cx + o.x, y: cy + o.y, box: box };
  };
  stage.pose = function () {
    var o = centerOffset();
    return { x: cx + o.x * sx, y: cy + o.y * sy, box: box };
  };

  function press() {
    if (pressed || stage.done) return;
    pressed = true;
    pendingRelease = false;
    target = 1;
    k = 380;
    c = 30;
    if (!stage.started) { stage.started = true; S.hideHint(); }
  }
  function requestRelease() {
    if (!pressed) return;
    if (q < MIN_SQUASH && !reduce) { pendingRelease = true; return; }
    doRelease();
  }
  function doRelease() {
    pendingRelease = false;
    pressed = false;
    activeId = null;
    target = 0;
    k = 80;
    c = reduce ? 2 * Math.sqrt(k) : 7.6;        // soft and slow: one gentle overshoot, then settles
    if (!awake) wake();
    S.addRipple(cx + (B.rippleX - B.wakeOx) * box / 400, cy + (B.rippleY - B.wakeOy) * box / 400, box);
  }
  function wake() {
    awake = true;
    S.announce('Awake');
    // let the wake fade and the first ripple play before moving on
    S.complete(reduce ? 0.5 : 1.5);
  }

  // Contact only counts on the character's shape
  function onBlob(x, y) {
    var u = box / 400;
    var ax = B.wakeOx + (x - cx) / (u * sx);
    var ay = B.wakeOy + (y - cy) / (u * sy);
    var ctx = S.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    var hit = ctx.isPointInPath(S.blobPath, ax, ay);
    ctx.restore();
    return hit;
  }

  stage.pointerdown = function (e, x, y) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    focusKey = false;
    if (pressed || !onBlob(x, y)) return;
    activeId = e.pointerId;
    press();
  };
  stage.pointermove = function (e, x, y) {
    hover = e.pointerType === 'mouse' && onBlob(x, y);
    S.canvas.style.cursor = hover ? 'pointer' : '';
  };
  stage.pointerup = function (e) {
    if (activeId !== null && e.pointerId === activeId) requestRelease();
  };
  stage.keydown = function (e) {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      focusKey = true;
      if (!e.repeat) press();
    }
  };
  stage.keyup = function (e) {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); requestRelease(); }
  };
  stage.blur = function () { requestRelease(); };
  stage.leave = function () { hover = false; S.canvas.style.cursor = ''; };

  stage.update = function (dt) {
    var H = 1 / 240, n = Math.ceil(dt / H), h = dt / n;
    for (var i = 0; i < n; i++) {
      var a = -k * (q - target) - c * qv;
      qv += a * h;
      q += qv * h;
    }
    if (pendingRelease && q >= MIN_SQUASH) doRelease();

    // dormant filter fades out over 0.9 s once awake, back in on restart
    var fade = reduce ? 100 : 1 / 0.9;
    awakeMix = awake ? Math.min(1, awakeMix + dt * fade) : Math.max(0, awakeMix - dt * fade);
    // outline: 3 -> 5.5 on hover / press / keyboard focus, eased like the .35 s transition
    var ew = (hover || pressed || focusKey) ? 5.5 : 3;
    edgeW += (ew - edgeW) * (1 - Math.exp(-dt * (reduce ? 100 : 9)));

    // Breathing: slow while dormant, a little livelier once awake
    var tp = awake ? 3.2 : 4.6;
    var ta = reduce ? 0 : (awake ? 0.038 : 0.03);
    var ease = Math.min(1, dt * 1.5);
    period += (tp - period) * ease;
    amp += (ta - amp) * ease;
    phase += dt * Math.PI * 2 / period;
    var calm = 1 - Math.min(1, Math.abs(q) * 1.5);
    var br = Math.sin(phase) * amp * calm;

    var pop = 1 + Math.max(0, -q) * 0.1;           // rebound lands slightly larger than rest
    sy = (1 - 0.27 * q) * (1 + br * 1.2) * pop;
    sx = (1 + 0.16 * q) * (1 + br * 0.8) * pop;
  };

  stage.drawScene = function () { /* an empty field */ };

  stage.drawMonster = function () {
    var hot = hover || pressed || focusKey;
    var base = S.mixColor(S.C.edge, S.C['edge-awake'], awakeMix);
    S.drawMonster({
      x: cx, y: cy, box: box, ox: B.wakeOx, oy: B.wakeOy,
      sx: sx, sy: sy, awake: awakeMix,
      edge: hot ? S.C['edge-hover'] : base, edgeW: edgeW
    });
  };

  S.stages = S.stages || {};
  S.stages.wake = stage;
})();
