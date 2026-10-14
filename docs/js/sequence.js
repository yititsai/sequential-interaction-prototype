/*
 * The sequencer: one linear run through the four stages.
 *   Wake -> Glide -> Fire -> Burst -> ending -> (Start over) -> Wake
 * Only the current stage receives input, and only once its handoff has
 * finished; the next stage starts only after the current one succeeds.
 */
(function () {
  var S = Seq;
  var reduce = S.reduce;
  var ORDER = [S.stages.wake, S.stages.glide, S.stages.fire, S.stages.burst];

  var index = 0;
  var cur = ORDER[0];
  var phase = 'play';                 // play | handoff | ending
  var nextTimer = -1;                 // seconds until the handoff after a success
  var hand = null;                    // { from, to, prev, next, k, dur }
  var endT = 0, endShown = false;

  var endingEl = document.getElementById('ending');
  var restartBtn = document.getElementById('restart');

  // Stages call this once when their action succeeds
  S.complete = function (delay) {
    if (nextTimer < 0) nextTimer = delay || 0;
  };

  function begin(stage) {
    phase = 'play';
    cur = stage;
    if (cur.activate) cur.activate();
    S.showHint(cur.hint);
  }

  function handoff(toIndex, enterArg) {
    var prev = cur;
    var from = prev.pose();
    if (prev.leave) prev.leave();
    S.hideHint();
    var next = ORDER[toIndex];
    next.enter(enterArg);
    index = toIndex;
    hand = { prev: prev, next: next, from: from, to: next.startPose(), k: 0, dur: reduce ? 0.3 : 1.0 };
    phase = 'handoff';
    nextTimer = -1;
  }

  function advance() {
    if (index < ORDER.length - 1) {
      var arg = cur.x ? cur.x() : S.W / 2;     // carry the monster's x into the next scene
      handoff(index + 1, arg);
    } else {
      phase = 'ending';
      nextTimer = -1;
      endT = 0;
      endShown = false;
      var m = cur.monsterCenter();
      S.addRipple(m.x, m.y, m.box * 1.6);       // the Wake ripple, one last time
    }
  }

  restartBtn.addEventListener('click', function () {
    endingEl.classList.remove('show');
    restartBtn.blur();
    setTimeout(function () { if (phase !== 'ending') endingEl.hidden = true; }, reduce ? 0 : 600);
    S.clearRipples();
    handoff(0, true);                           // the monster arrives awake and falls back asleep
  });

  /* ---------- Input routing ---------- */
  function routed() { return phase === 'play' ? cur : null; }
  function local(e) { return { x: e.clientX, y: e.clientY }; }
  function onUi(e) { return e.target && e.target.closest && e.target.closest('button, .key'); }

  window.addEventListener('pointerdown', function (e) {
    if (onUi(e)) return;
    window.focus();
    var st = routed(); if (st && st.pointerdown) { var p = local(e); st.pointerdown(e, p.x, p.y); }
  });
  window.addEventListener('pointermove', function (e) {
    var st = routed(); if (st && st.pointermove) { var p = local(e); st.pointermove(e, p.x, p.y); }
  });
  function pointerEnd(e) {
    // releases always reach the current stage so nothing stays stuck down
    if (cur.pointerup) cur.pointerup(e);
  }
  window.addEventListener('pointerup', pointerEnd);
  window.addEventListener('pointercancel', pointerEnd);
  window.addEventListener('keydown', function (e) {
    if (phase === 'ending') return;            // the Start over button handles its own keys
    if (e.code === 'Space' || e.key.indexOf('Arrow') === 0) e.preventDefault();
    var st = routed(); if (st && st.keydown) st.keydown(e);
  });
  window.addEventListener('keyup', function (e) {
    if (cur.keyup && phase !== 'ending') cur.keyup(e);
  });
  window.addEventListener('blur', function () { if (cur.blur) cur.blur(); });
  window.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  window.addEventListener('resize', function () {
    S.resizeCanvas();
    if (phase === 'handoff') {
      hand.prev.layout();
      hand.next.layout();
      hand.to = hand.next.startPose();
    } else {
      cur.layout();
    }
  });

  /* ---------- Loop ---------- */
  var last = performance.now();
  function frame(now) {
    var dt = S.clamp((now - last) / 1000, 0, 0.033);
    last = now;
    S.time += dt;
    var ctx = S.ctx;
    ctx.clearRect(0, 0, S.W, S.H);

    if (phase === 'handoff') {
      hand.k = Math.min(1, hand.k + dt / hand.dur);
      var e = S.easeInOut(hand.k);
      hand.prev.drawScene(1 - e);
      hand.next.drawScene(e);
      var hop = reduce ? 0 : Math.sin(Math.PI * e) * Math.min(S.H * 0.06, 48);
      var box = S.lerp(hand.from.box, hand.to.box, e);
      var squish = reduce ? 1 : 1 + 0.05 * Math.sin(Math.PI * e);
      S.drawMonster({
        x: S.lerp(hand.from.x, hand.to.x, e),
        y: S.lerp(hand.from.y, hand.to.y, e) - hop,
        box: box, sx: 1 / squish, sy: squish
      });
      S.updateRipples(dt);
      S.drawRipples();
      if (hand.k >= 1) {
        var n = hand.next;
        hand = null;
        n.update(0);
        begin(n);
      }
    } else {
      cur.update(dt);
      cur.drawScene(1);
      cur.drawMonster();
      if (cur.drawCues) cur.drawCues(dt, phase === 'play');
      S.updateRipples(dt);
      S.drawRipples();

      if (phase === 'play' && nextTimer >= 0) {
        nextTimer -= dt;
        if (nextTimer < 0) { nextTimer = 0; advance(); }
      }
      if (phase === 'ending') {
        endT += dt;
        if (!endShown && endT > (reduce ? 0.2 : 0.9)) {
          endShown = true;
          endingEl.hidden = false;
          // sit the closing line just above the monster on the upper platform
          var m = cur.monsterCenter();
          var top = m.y - m.box * 0.45 - endingEl.offsetHeight - 28;
          endingEl.style.top = Math.max(16, top) + 'px';
          requestAnimationFrame(function () {
            endingEl.classList.add('show');
            try { restartBtn.focus({ preventScroll: true }); } catch (err) {}
          });
        }
      }
    }
    requestAnimationFrame(frame);
  }

  // read-only snapshot for testing in the console
  S.debug = function () { return { stage: cur.name, phase: phase, data: cur.debug ? cur.debug() : null }; };

  /* ---------- Start: the dormant monster ---------- */
  S.stages.wake.layout();
  S.stages.wake.enter(false);
  begin(S.stages.wake);
  S.announce('Dormant');
  requestAnimationFrame(frame);
})();
