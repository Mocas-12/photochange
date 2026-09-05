/* ============================================================
   PhotoChange — Pointer FX
   深空点阵场：鼠标靠近时点亮/放大/轻推，闲置时波浪呼吸
   纯原生 Canvas 2D，无依赖；尊重 prefers-reduced-motion
   ============================================================ */
(function () {
  var canvas = document.getElementById('fx-canvas');
  if (!canvas || !canvas.getContext) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var ctx = canvas.getContext('2d');
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var SPACING = 28;          // 点阵间距（px）
  var INFLUENCE = 150;       // 鼠标影响半径（px）
  var PUSH = 14;             // 最大推离距离（px）
  var dots = [];
  var W = 0, H = 0, running = true, rafId = 0;
  var mouse = { x: -1e4, y: -1e4 };

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dots.length = 0;
    var cols = Math.ceil(W / SPACING) + 1;
    var rows = Math.ceil(H / SPACING) + 1;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        dots.push({ ox: c * SPACING, oy: r * SPACING, x: c * SPACING, y: r * SPACING });
      }
    }
  }

  function frame(t) {
    if (!running) return;
    var time = t * 0.001;
    ctx.clearRect(0, 0, W, H);
    var inf2 = INFLUENCE * INFLUENCE;
    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];
      var f = 0;
      var dx = d.x - mouse.x;
      var dy = d.y - mouse.y;
      var d2 = dx * dx + dy * dy;
      if (d2 < inf2) {
        var dist = Math.sqrt(d2) || 1;
        f = 1 - dist / INFLUENCE;
        f = f * f; // 平滑衰减
        var push = f * PUSH * 0.16;
        d.x += (dx / dist) * push;
        d.y += (dy / dist) * push;
      }
      // 弹簧回位
      d.x += (d.ox - d.x) * 0.085;
      d.y += (d.oy - d.y) * 0.085;
      // 闲置波浪呼吸
      var wave = Math.sin(d.ox * 0.012 + time * 1.05) + Math.cos(d.oy * 0.014 - time * 0.85);
      var alpha = 0.05 + 0.035 * (wave * 0.5 + 0.5) + f * 0.6;
      if (alpha <= 0.02) continue;
      var size = 1.1 + f * 1.6;
      if (f > 0.03) {
        // 受亮点：蓝 → 靛紫渐变提亮
        var g = Math.round(163 + (180 - 163) * f);
        var b = Math.round(255 - (252 - 255) * f);
        ctx.fillStyle = 'rgba(' + Math.round(85 + 80 * f) + ',' + g + ',' + b + ',' + Math.min(alpha, 0.9).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(d.x, d.y, size, 0, 6.2832);
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(85,163,255,' + alpha.toFixed(3) + ')';
        ctx.fillRect(d.x - size / 2, d.y - size / 2, size, size);
      }
    }
    rafId = requestAnimationFrame(frame);
  }

  function onMove(e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  }
  function onLeave() {
    mouse.x = -1e4;
    mouse.y = -1e4;
  }
  function onVisibility() {
    if (document.hidden) {
      running = false;
      cancelAnimationFrame(rafId);
    } else if (!running) {
      running = true;
      rafId = requestAnimationFrame(frame);
    }
  }

  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  });
  window.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerleave', onLeave);
  window.addEventListener('blur', onLeave);
  /* 触摸没有"移出页面"：抬手/取消时松开点阵，恢复呼吸状态 */
  window.addEventListener('pointerup', function (e) {
    if (e.pointerType === 'touch') onLeave();
  }, { passive: true });
  window.addEventListener('pointercancel', onLeave, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);

  resize();
  rafId = requestAnimationFrame(frame);
})();
