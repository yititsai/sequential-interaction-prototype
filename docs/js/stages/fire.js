/*
 * Stage 3 — Steer + Fire.
 * Ported from interaction-studies/steer-and-fire. Arrow keys (or the on-screen
 * key caps) move and jump with coyote time and a jump buffer; Space fires a
 * projectile straight up with recoil. One-way platforms.
 * Success: stand on the top bar (this lights the target above it), then hit
 * the target with a shot.
 */
(function () {
  var S = Seq, B = S.BLOB;
  var reduce = S.reduce;
  var clamp = S.clamp;
  var TAU = Math.PI * 2;

  var stage = { name: 'fire', hint: 'Arrow keys move and jump, Space fires. Climb to the top bar, then hit the light above it.' };

  var keysEl = document.getElementById('keys');
  var keyEls = {};
  keysEl.querySelectorAll('.key').forEach(function (k) { keyEls[k.getAttribute('data-code')] = k; });

  var W = 0, H = 0, playH = 0, R = 24, s = 120, THICK = 14, gy = 0;
  var g = 3000, jumpV = 900, speed = 400;
  var plats = [];
  var px = 0, py = 0, vx = 0, vy = 0, grounded = true, coyote = 0, jumpBuf = 0;
  var sq = 0, sqv = 0, lean = 0, rc = 0, rcv = 0, lastFire = 0;
  var shots = [], rings = [], down = {};
  var onPlat = -1;
  var tgt = { x: 0, y: 0, r: 10, lit: false, litT: 0, hit: false, hitT: 0 };
  var prevPlayH = 0;
  var active = false;

  function layout() {
    W = S.W; H = S.H;
    var kr = keysEl.getBoundingClientRect();
    playH = Math.max(200, (kr.height ? kr.top : H - 80) - 14);
    R = clamp(Math.min(W, playH) * 0.062, 18, 38);
    s = Math.max(R * 2.8, Math.min(playH * 0.2, 150));
    gy = playH - THICK;
    g = Math.max(1800, playH * 5);
    jumpV = Math.sqrt(2 * g * s * 1.35);
    speed = clamp(W * 0.5, 300, 560);

    var minW = R * 4.6;
    plats = [
      { x: 0, y: gy, w: W, h: THICK },
      { x: W * 0.06, y: gy - s, w: Math.max(W * 0.22, minW), h: THICK },
      { x: W * 0.66, y: gy - s * 1.9, w: Math.max(W * 0.24, minW), h: THICK },
      { x: W * 0.2, y: gy - s * 2.8, w: Math.max(W * 0.22, minW), h: THICK }
    ];
    plats.forEach(function (p) { if (p.x + p.w > W) p.x = Math.max(0, W - p.w); });

    // The study's gaps scale with width but jump reach does not, so on wide
    // screens the top bar was out of reach. Keep the same heights and order,
    // but pull a bar closer whenever its gap is wider than a comfortable jump
    // (70% of the run covered while climbing one 0.9s step).
    var climb = 0.9 * s;
    var air = (jumpV + Math.sqrt(Math.max(0, jumpV * jumpV - 2 * g * climb))) / g;
    var gap = 0.7 * air * speed;
    var p1 = plats[1], p2 = plats[2], p3 = plats[3];
    if (p2.x - (p1.x + p1.w) > gap) p2.x = p1.x + p1.w + gap;
    if (p2.x - (p3.x + p3.w) > gap) p3.x = p2.x - gap - p3.w;

    // target: centered over the top bar, clear of the monster standing on it
    var top = plats[3];
    tgt.r = R * 0.75;
    tgt.x = top.x + top.w / 2;
    tgt.y = Math.max(top.y - 2 * R - s * 0.75, 64 + tgt.r);
  }

  stage.layout = function () {
    var fx = px / (W || 1), fy = py / (prevPlayH || 1);
    layout();
    px = clamp(fx * W, R, W - R);
    py = fy * playH;
    if (py + R > gy) { py = gy - R; vy = 0; }
    grounded = false;
    prevPlayH = playH;
  };

  function boxSize() { return R * 1.95 / B.w; }       // monster as wide as the study's circle
  function centerY(feetY) { return feetY - (B.feet - B.cy) * boxSize() / 400; }

  stage.enter = function (fromX) {
    keysEl.hidden = false;
    layout();
    prevPlayH = playH;
    px = clamp(fromX == null ? W / 2 : fromX, R, W - R);
    py = gy - R;
    vx = 0; vy = 0;
    grounded = true; coyote = 0.07; jumpBuf = 0;
    sq = 0; sqv = 0; lean = 0; rc = 0; rcv = 0;
    shots = []; rings = []; down = {};
    onPlat = 0;
    tgt.lit = false; tgt.litT = 0; tgt.hit = false; tgt.hitT = 0;
    Object.keys(keyEls).forEach(function (c) { keyEls[c].classList.remove('down'); });
    stage.started = false;
    stage.done = false;
    active = false;
    requestAnimationFrame(function () { keysEl.classList.add('show'); });
  };
  stage.activate = function () { active = true; };
  stage.leave = function () {
    active = false;
    setKeyCues({});
    keysEl.classList.remove('show');
    Object.keys(down).forEach(release);
    setTimeout(function () { if (!active && !keysEl.classList.contains('show')) keysEl.hidden = true; }, 650);
  };

  stage.startPose = function () { return { x: px, y: centerY(gy), box: boxSize() }; };
  stage.pose = function () { return { x: px, y: centerY(py + R), box: boxSize() }; };
  stage.x = function () { return px; };
  stage.debug = function () { return { px: px, py: py, R: R, grounded: grounded, onPlat: onPlat, plats: plats, tgt: tgt }; };

  /* ---------- Input ---------- */
  function press(code) {
    if (!active || stage.done || down[code]) return;
    down[code] = true;
    if (keyEls[code]) keyEls[code].classList.add('down');
    if (!stage.started) { stage.started = true; S.hideHint(); }
    if (code === 'ArrowUp') jumpBuf = 0.1;
    if (code === 'Space') fire();
  }
  function release(code) {
    if (!down[code]) return;
    down[code] = false;
    if (keyEls[code]) keyEls[code].classList.remove('down');
  }

  var HANDLED = { ArrowLeft: 1, ArrowRight: 1, ArrowUp: 1, Space: 1 };
  stage.keydown = function (e) {
    if (!HANDLED[e.code]) return;
    e.preventDefault();
    if (e.repeat) return;
    press(e.code);
  };
  stage.keyup = function (e) {
    if (!HANDLED[e.code]) return;
    e.preventDefault();
    release(e.code);
  };
  stage.blur = function () { Object.keys(down).forEach(release); };

  Object.keys(keyEls).forEach(function (code) {
    var k = keyEls[code];
    k.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      try { k.setPointerCapture(e.pointerId); } catch (err) {}
      press(code);
    });
    function up() { release(code); }
    k.addEventListener('pointerup', up);
    k.addEventListener('pointercancel', up);
    k.addEventListener('lostpointercapture', up);
  });

  function fire() {
    var now = performance.now();
    if (now - lastFire < 70) return;
    lastFire = now;
    var pr = Math.max(5, R * 0.2);
    shots.push({ x: px, y: py - R - pr, v: H * 2.8, burst: H * 2.8, cruise: H * 1.5, age: 0, r: pr });
    sq = grounded ? 1.25 : 0.7; sqv = 0;
    if (!grounded) { vy += R * 9; rc = 1; rcv = 0; }
    rings.push({ x: px, y: py - R, age: 0, dur: 0.16, from: R * 0.35, to: R * 0.95 });
  }

  /* ---------- Update ---------- */
  stage.update = function (dt) {
    var dir = (down.ArrowRight ? 1 : 0) - (down.ArrowLeft ? 1 : 0);
    var rate = dir ? 160 : 240;
    vx += (dir * speed - vx) * (1 - Math.exp(-dt * rate));
    if (!dir && Math.abs(vx) < 24) vx = 0;
    lean += (vx / speed - lean) * (1 - Math.exp(-dt * 40));
    px += vx * dt;
    if (px < R) { px = R; vx = 0; }
    if (px > W - R) { px = W - R; vx = 0; }

    var prevBottom = py + R;
    vy += g * dt;
    py += vy * dt;

    var wasGrounded = grounded;
    grounded = false;
    if (vy >= 0) {
      var bottom = py + R;
      for (var i = 0; i < plats.length; i++) {
        var p = plats[i];
        if (prevBottom <= p.y + 2 && bottom >= p.y &&
            px + R * 0.7 > p.x && px - R * 0.7 < p.x + p.w) {
          py = p.y - R;
          vy = 0;
          grounded = true;
          onPlat = i;
          break;
        }
      }
    }
    if (py + R > playH) { py = gy - R; vy = 0; grounded = true; onPlat = 0; }

    if (grounded) {
      coyote = 0.07;
      if (!wasGrounded) { sq = Math.max(sq, 0.65); sqv = 0; }
    } else {
      coyote = Math.max(0, coyote - dt);
    }

    jumpBuf = Math.max(0, jumpBuf - dt);
    if (jumpBuf > 0 && coyote > 0) {
      vy = -jumpV;
      grounded = false;
      coyote = 0;
      jumpBuf = 0;
      sq = -0.95; sqv = 0;
      rings.push({ x: px, y: py + R, age: 0, dur: 0.2, from: R * 0.3, to: R * 1.1 });
    }

    // reaching the top bar lights the target
    if (grounded && onPlat === 3 && !tgt.lit) {
      tgt.lit = true;
      S.announce('The light is on');
      rings.push({ x: tgt.x, y: tgt.y, age: 0, dur: 0.35, from: tgt.r, to: tgt.r * 1.8 });
    }
    if (tgt.lit) tgt.litT += dt;
    if (tgt.hit) tgt.hitT += dt;

    var h = 1 / 240, n = Math.max(1, Math.ceil(dt / h)), sh = dt / n;
    for (var j = 0; j < n; j++) {
      sqv += (-700 * sq - 34 * sqv) * sh;
      sq += sqv * sh;
      rcv += (-1100 * rc - 66 * rcv) * sh;
      rc += rcv * sh;
    }

    for (var a = shots.length - 1; a >= 0; a--) {
      var shot = shots[a];
      shot.age += dt;
      shot.v = shot.cruise + (shot.burst - shot.cruise) * Math.exp(-shot.age * 16);
      shot.y -= shot.v * dt;
      if (tgt.lit && !tgt.hit && Math.hypot(shot.x - tgt.x, shot.y - tgt.y) < tgt.r + shot.r) {
        shots.splice(a, 1);
        tgt.hit = true;
        stage.done = true;
        Object.keys(down).forEach(release);
        rings.push({ x: tgt.x, y: tgt.y, age: 0, dur: 0.5, from: tgt.r, to: tgt.r * 3 });
        S.announce('Hit');
        S.complete(reduce ? 0.4 : 1.0);
        continue;
      }
      if (shot.y + shot.r < 0) shots.splice(a, 1);
    }
    for (var b = rings.length - 1; b >= 0; b--) {
      rings[b].age += dt;
      if (rings[b].age >= rings[b].dur) rings.splice(b, 1);
    }
  };

  /* ---------- Draw ---------- */
  stage.drawScene = function (alpha) {
    var ctx = S.ctx, C = S.C;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = C.platform;
    plats.forEach(function (p) { ctx.fillRect(p.x, p.y, p.w, p.h); });

    // target: dashed and faint until lit; pops when hit
    if (!tgt.hit || tgt.hitT < 0.35) {
      var pop = tgt.hit ? 1 + tgt.hitT * 2 : 1;
      var breathe = tgt.lit && !reduce ? 1 + 0.06 * Math.sin(tgt.litT * 5) : 1;
      var fadeOut = tgt.hit ? 1 - tgt.hitT / 0.35 : 1;
      ctx.beginPath();
      ctx.arc(tgt.x, tgt.y, tgt.r * pop * breathe, 0, TAU);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = C.ring;
      if (!tgt.lit) {
        ctx.setLineDash([4, 4]);
        ctx.globalAlpha = alpha * 0.45;
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.fillStyle = C.mark;
        ctx.globalAlpha = alpha * 0.25 * fadeOut;
        ctx.fill();
        ctx.globalAlpha = alpha * fadeOut;
        ctx.stroke();
      }
      ctx.globalAlpha = alpha;
    }
    ctx.restore();
  };

  stage.drawMonster = function () {
    var ctx = S.ctx, C = S.C;
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = C.ring;
    rings.forEach(function (r) {
      var t = r.age / r.dur;
      ctx.globalAlpha = (1 - t) * (reduce ? 0.5 : 1);
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.from + (r.to - r.from) * t, 0, TAU);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;

    ctx.fillStyle = C.proj;
    ctx.strokeStyle = C.proj;
    ctx.lineCap = 'round';
    shots.forEach(function (sh) {
      var b = clamp((sh.v - sh.cruise) / (sh.burst - sh.cruise), 0, 1) * (reduce ? 0.5 : 1);
      if (b > 0.02) {
        ctx.globalAlpha = 0.35 * b;
        ctx.lineWidth = sh.r * 1.3;
        ctx.beginPath();
        ctx.moveTo(sh.x, sh.y);
        ctx.lineTo(sh.x, sh.y + sh.r * (2 + 7 * b));
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.beginPath();
      ctx.ellipse(sh.x, sh.y, sh.r * (1 - 0.12 * b), sh.r * (1 + 0.35 * b), 0, 0, TAU);
      ctx.fill();
    });
    ctx.restore();

    // monster, squashed and stretched from the feet
    var q = reduce ? sq * 0.4 : sq;
    var move = Math.min(1, Math.abs(lean));
    var air = grounded ? 0 : clamp(-vy / jumpV, -1, 1) * 0.05;
    var sy = (1 - 0.2 * q) * (1 - 0.04 * move) * (1 + air);
    var sx = (1 + 0.14 * q) * (1 + 0.08 * move) * (1 - air * 0.6);
    var skew = reduce ? 0 : -lean * 0.14;
    var dip = q > 0 ? q * R * 0.06 : 0;
    S.drawMonster({
      x: px, y: py + R + dip + rc * R * 0.16, box: boxSize(),
      ox: B.cx, oy: B.feet, sx: sx, sy: sy, skew: skew
    });
  };

  /* ---------- Wordless hints ---------- */
  // Works out the next useful key from where the monster is, then shows it:
  // an arrow bouncing over the next bar (or the target), a small arrow at the
  // monster for the move/jump/fire, and a pulse on the matching key cap.
  var cueA = 0, cueKeys = '';
  function setKeyCues(want) {
    var sig = Object.keys(want).sort().join(',');
    if (sig === cueKeys) return;
    cueKeys = sig;
    Object.keys(keyEls).forEach(function (c) { keyEls[c].classList.toggle('cue', !!want[c]); });
  }
  stage.drawCues = function (dt, live) {
    var show = live && active && !stage.done;
    cueA = S.fadeCue(cueA, show, dt);
    if (!show) { setKeyCues({}); if (cueA < 0.02) return; }

    var want = {};
    var s = Math.max(7, R * 0.3);
    var bob = S.nudge();
    var goalX, goalY;
    if (tgt.lit) {
      goalX = tgt.x; goalY = tgt.y - tgt.r - 10;
      if (Math.abs(px - tgt.x) > tgt.r * 0.6) {
        want[tgt.x > px ? 'ArrowRight' : 'ArrowLeft'] = 1;
      } else {
        want.Space = 1;
        S.arrow(px, py - R * 1.9, tgt.x, tgt.y + tgt.r + 8, cueA * 0.9, s);
      }
    } else {
      var next = plats[Math.min(3, onPlat + 1)];
      var here = plats[onPlat];
      goalX = next.x + next.w / 2; goalY = next.y - R * 2.2;
      var over = px + R * 0.5 > next.x && px - R * 0.5 < next.x + next.w;
      var dir = goalX > px ? 1 : -1;
      var atEdge = onPlat > 0 && (dir > 0 ? px > here.x + here.w - R * 1.2 : px < here.x + R * 1.2);
      if (!over) want[dir > 0 ? 'ArrowRight' : 'ArrowLeft'] = 1;
      if (grounded && (over || atEdge)) want.ArrowUp = 1;
    }
    setKeyCues(show ? want : {});

    // arrow bouncing down onto the next goal
    S.chevron(goalX, goalY - 10 - bob * 10, Math.PI / 2, s, cueA * 0.8, 2.5);
    // arrows at the monster for the suggested move / jump
    if (want.ArrowRight || want.ArrowLeft) {
      var d = want.ArrowRight ? 1 : -1;
      S.chevron(px + d * (R * 1.6 + bob * 8), py, d > 0 ? 0 : Math.PI, s * 0.8, cueA * 0.7, 2.5);
    }
    if (want.ArrowUp) S.chevron(px, py - R * 1.7 - bob * 8, -Math.PI / 2, s * 0.8, cueA * 0.7, 2.5);
  };

  S.stages = S.stages || {};
  S.stages.fire = stage;
})();
