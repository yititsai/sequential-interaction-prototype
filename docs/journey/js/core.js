/*
 * Shared runtime for the sequence: canvas, theme colors, helpers, the monster
 * art (from the Wake the Monster study) and its ripple. Stages and the
 * sequencer hang off the single global `Seq`.
 */
(function () {
  var Seq = window.Seq = {};

  var canvas = document.getElementById('c');
  var ctx = canvas.getContext('2d');
  Seq.canvas = canvas;
  Seq.ctx = ctx;
  Seq.reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  Seq.W = 0; Seq.H = 0; Seq.DPR = 1;

  /* ---------- Helpers ---------- */
  Seq.clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  Seq.lerp = function (a, b, t) { return a + (b - a) * t; };
  Seq.easeInOut = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

  // CSS-style cubic-bezier easing (used for the Wake ripple: cubic-bezier(.15,.6,.3,1))
  Seq.bezier = function (x1, y1, x2, y2) {
    function at(a1, a2, t) { return 3 * a1 * t * (1 - t) * (1 - t) + 3 * a2 * t * t * (1 - t) + t * t * t; }
    return function (x) {
      var lo = 0, hi = 1, t = x;
      for (var i = 0; i < 24; i++) {
        t = (lo + hi) / 2;
        if (at(x1, x2, t) < x) lo = t; else hi = t;
      }
      return at(y1, y2, t);
    };
  };

  /* ---------- Canvas size ---------- */
  Seq.resizeCanvas = function () {
    Seq.DPR = Math.min(window.devicePixelRatio || 1, 2);
    Seq.W = window.innerWidth;
    Seq.H = window.innerHeight;
    canvas.width = Math.round(Seq.W * Seq.DPR);
    canvas.height = Math.round(Seq.H * Seq.DPR);
    ctx.setTransform(Seq.DPR, 0, 0, Seq.DPR, 0, 0);
  };
  Seq.resizeCanvas();

  /* ---------- Theme colors (read from CSS tokens) ---------- */
  var C = Seq.C = {};
  var NAMES = ['bg', 'fg', 'muted', 'platform', 'proj', 'ring', 'mark', 'edge', 'edge-awake', 'edge-hover', 'ripple', 'shadow-a', 'shadow-b'];
  Seq.dark = false;
  function readColors() {
    var cs = getComputedStyle(document.documentElement);
    NAMES.forEach(function (n) { C[n] = cs.getPropertyValue('--' + n).trim(); });
    C.shadowA = parseFloat(C['shadow-a']) || 0.2;
    C.shadowB = parseFloat(C['shadow-b']) || 0.08;
    Seq.dark = (cs.getPropertyValue('color-scheme').trim() === 'dark');
  }
  try {
    new MutationObserver(readColors).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', readColors);
  } catch (e) {}
  readColors();

  function hexToRgb(h) {
    h = (h || '#000').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  Seq.mixColor = function (a, b, t) {
    var x = hexToRgb(a), y = hexToRgb(b);
    return 'rgb(' + Math.round(Seq.lerp(x[0], y[0], t)) + ',' + Math.round(Seq.lerp(x[1], y[1], t)) + ',' + Math.round(Seq.lerp(x[2], y[2], t)) + ')';
  };

  /* ---------- Monster art (Wake the Monster study blob) ---------- */
  var BLOB = 'M205 58 C262 54 322 88 336 148 C350 208 338 262 298 306 C258 350 188 358 134 336 C80 314 52 258 56 200 C60 142 76 96 122 74 C150 62 178 60 205 58 Z';
  Seq.blobPath = new Path2D(BLOB);
  // Blob geometry inside its 400x400 box
  Seq.BLOB = {
    w: 286 / 400,              // drawn width as a fraction of the box
    cx: 198.6, cy: 202.7,      // bbox center
    feet: 347.8,               // lowest point
    wakeOx: 200, wakeOy: 208,  // Wake study transform-origin (50% 52%)
    rippleX: 203.2, rippleY: 205.2 // Wake study ripple center (50.8% 51.3%)
  };

  // The study dims the dormant body with a CSS filter. Canvas filters are not
  // available everywhere, so the same contrast/brightness is baked into a
  // second copy of the art with feComponentTransfer.
  function bodySvg(slope, intercept) {
    var filt = slope === 1 ? '' :
      '<filter id="dorm" color-interpolation-filters="sRGB"><feComponentTransfer>' +
      '<feFuncR type="linear" slope="' + slope + '" intercept="' + intercept + '"/>' +
      '<feFuncG type="linear" slope="' + slope + '" intercept="' + intercept + '"/>' +
      '<feFuncB type="linear" slope="' + slope + '" intercept="' + intercept + '"/>' +
      '</feComponentTransfer></filter>';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">' +
      '<defs>' +
      '<path id="blob" d="' + BLOB + '"/>' +
      '<clipPath id="blobClip"><use href="#blob"/></clipPath>' +
      '<radialGradient id="bodyFill" cx="38%" cy="30%" r="78%">' +
      '<stop offset="0" stop-color="#f0f0f0"/><stop offset="0.55" stop-color="#cdcdcd"/><stop offset="1" stop-color="#9e9e9e"/>' +
      '</radialGradient>' +
      '<linearGradient id="sag" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.16"/>' +
      '</linearGradient>' +
      '<filter id="soften" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="14"/></filter>' +
      filt +
      '</defs>' +
      '<g' + (filt ? ' filter="url(#dorm)"' : '') + '>' +
      '<use href="#blob" fill="url(#bodyFill)"/>' +
      '<g clip-path="url(#blobClip)">' +
      '<use href="#blob" fill="url(#sag)"/>' +
      '<ellipse cx="148" cy="130" rx="62" ry="36" fill="#fff" opacity="0.5" filter="url(#soften)" transform="rotate(-24 148 130)"/>' +
      '</g></g></svg>';
  }
  function makeImg(svg) {
    var img = new Image();
    img.ready = false;
    img.onload = function () { img.ready = true; };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    return img;
  }
  var imgAwake = makeImg(bodySvg(1, 0));
  // light: contrast(.76) brightness(1.04)   dark: contrast(.68) brightness(.66)
  var imgDormLight = makeImg(bodySvg(0.7904, 0.1248));
  var imgDormDark = makeImg(bodySvg(0.4488, 0.1056));

  /*
   * Draw the monster.
   * p: { x, y        screen point where the origin (ox, oy) lands
   *      box         size of the 400-unit art box in px
   *      ox, oy      origin in art units (default: bbox center)
   *      sx, sy      scale about the origin
   *      rot         degrees, skew (x shear)
   *      awake       0 = dormant, 1 = awake
   *      edge        outline color override, edgeW outline width in art units
   *      alpha }
   */
  Seq.drawMonster = function (p) {
    var u = p.box / 400;
    var sx = p.sx == null ? 1 : p.sx, sy = p.sy == null ? 1 : p.sy;
    var awake = p.awake == null ? 1 : p.awake;
    ctx.save();
    ctx.globalAlpha = p.alpha == null ? 1 : p.alpha;
    ctx.translate(p.x, p.y);
    if (p.rot) ctx.rotate(p.rot * Math.PI / 180);
    if (p.skew) ctx.transform(1, 0, p.skew, 1, 0, 0);
    ctx.scale(sx * u, sy * u);
    ctx.translate(-(p.ox == null ? Seq.BLOB.cx : p.ox), -(p.oy == null ? Seq.BLOB.cy : p.oy));

    var dorm = Seq.dark ? imgDormDark : imgDormLight;
    var base = ctx.globalAlpha;
    if (awake < 1 && dorm.ready) {
      ctx.drawImage(dorm, 0, 0, 400, 400);
    }
    if (imgAwake.ready && awake > 0) {
      ctx.globalAlpha = base * (dorm.ready ? awake : 1);
      ctx.drawImage(imgAwake, 0, 0, 400, 400);
      ctx.globalAlpha = base;
    }
    if (!imgAwake.ready && !dorm.ready) {
      ctx.fillStyle = '#cdcdcd';
      ctx.fill(Seq.blobPath);
    }
    // outline, never thinner than 1.5 screen px
    var w = p.edgeW == null ? 3 : p.edgeW;
    var minW = 1.5 / (u * Math.max(0.2, Math.min(Math.abs(sx), Math.abs(sy))));
    ctx.lineWidth = Math.max(w, minW);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = p.edge || Seq.mixColor(C.edge, C['edge-awake'], awake);
    ctx.stroke(Seq.blobPath);
    ctx.restore();
  };

  /* ---------- Ripple (Wake the Monster study) ---------- */
  var ripples = [];
  var rippleEase = Seq.bezier(0.15, 0.6, 0.3, 1);
  // A thin ring leaving the body: 74.5% of the art box out to 165% (96% reduced), fading from .32
  Seq.addRipple = function (x, y, box, delay) {
    ripples.push({ x: x, y: y, box: box, age: -(delay == null ? (Seq.reduce ? 0 : 0.14) : delay) });
  };
  Seq.clearRipples = function () { ripples = []; };
  Seq.updateRipples = function (dt) {
    var dur = Seq.reduce ? 0.5 : 1.7;
    for (var i = ripples.length - 1; i >= 0; i--) {
      ripples[i].age += dt;
      if (ripples[i].age >= dur) ripples.splice(i, 1);
    }
  };
  Seq.drawRipples = function () {
    var dur = Seq.reduce ? 0.5 : 1.7;
    var end = Seq.reduce ? 0.96 : 1.65;
    ctx.save();
    ctx.strokeStyle = C.ripple;
    ctx.lineWidth = 1;
    ripples.forEach(function (r) {
      if (r.age < 0) return;
      var k = rippleEase(Math.min(1, r.age / dur));
      var d = r.box * Seq.lerp(0.745, end, k);
      ctx.globalAlpha = 0.32 * (1 - k);
      ctx.beginPath();
      ctx.arc(r.x, r.y, d / 2, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.restore();
  };

  /* ---------- Visual cues (wordless hints) ---------- */
  // Seconds since load; drives the looping cue animations.
  Seq.time = 0;
  // Eases a cue's opacity toward 1 (wanted) or 0, so cues fade in and out.
  Seq.fadeCue = function (a, want, dt) {
    return a + ((want ? 1 : 0) - a) * (1 - Math.exp(-dt * (want ? 4 : 8)));
  };
  // A soft bounce 0..1 used to nudge arrows toward their target (still when reduced motion is on).
  Seq.nudge = function (period) {
    return Seq.reduce ? 0.5 : 0.5 - 0.5 * Math.cos(Seq.time * Math.PI * 2 / (period || 1.1));
  };
  // Open chevron pointing along `angle` (radians, 0 = right, -PI/2 = up), tip at (x, y).
  Seq.chevron = function (x, y, angle, size, alpha, width) {
    if (alpha <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.strokeStyle = C.mark;
    ctx.lineWidth = width || 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-size, -size);
    ctx.lineTo(0, 0);
    ctx.lineTo(-size, size);
    ctx.stroke();
    ctx.restore();
  };
  // Dashed guide line with a chevron at its end, from (x1, y1) to (x2, y2).
  Seq.arrow = function (x1, y1, x2, y2, alpha, size) {
    if (alpha <= 0.01) return;
    var ang = Math.atan2(y2 - y1, x2 - x1);
    ctx.save();
    ctx.globalAlpha = alpha * 0.55;
    ctx.strokeStyle = C.mark;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 6]);
    ctx.lineDashOffset = Seq.reduce ? 0 : -Seq.time * 22;    // dashes drift toward the tip
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2 - Math.cos(ang) * 4, y2 - Math.sin(ang) * 4);
    ctx.stroke();
    ctx.restore();
    Seq.chevron(x2, y2, ang, size || 8, alpha, 2.5);
  };
  // "Press here": a ring that closes onto a dot, looping.
  Seq.pressCue = function (x, y, r, alpha) {
    if (alpha <= 0.01) return;
    var k = Seq.reduce ? 0.6 : (Seq.time % 1.4) / 1.4;
    ctx.save();
    ctx.strokeStyle = C.mark;
    ctx.fillStyle = C.mark;
    ctx.lineWidth = 2;
    ctx.globalAlpha = alpha * (Seq.reduce ? 0.6 : Math.sin(Math.PI * Math.min(1, k * 1.25)));
    ctx.beginPath();
    ctx.arc(x, y, r * (1.8 - 1.2 * Math.min(1, k * 1.25)), 0, Math.PI * 2);
    ctx.stroke();
    var tap = k > 0.8 ? 1 - (k - 0.8) / 0.2 : Math.min(1, k * 1.25);
    ctx.globalAlpha = alpha * (0.35 + 0.45 * tap);
    ctx.beginPath();
    ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  // "Press and hold": a ring that fills clockwise, then restarts.
  Seq.holdCue = function (x, y, r, alpha) {
    if (alpha <= 0.01) return;
    var k = Seq.reduce ? 0.75 : Math.min(1, (Seq.time % 1.8) / 1.4);
    ctx.save();
    ctx.strokeStyle = C.mark;
    ctx.lineCap = 'round';
    ctx.globalAlpha = alpha * 0.3;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = alpha * 0.9;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
    ctx.stroke();
    ctx.fillStyle = C.mark;
    ctx.globalAlpha = alpha * 0.6;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  /* ---------- Hint + live region ---------- */
  var hintEl = document.getElementById('hint');
  var liveEl = document.getElementById('live');
  Seq.showHint = function (text) {
    hintEl.textContent = text;
    hintEl.classList.add('show');
  };
  Seq.hideHint = function () { hintEl.classList.remove('show'); };
  Seq.announce = function (text) { liveEl.textContent = text; };
})();
