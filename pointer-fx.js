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
  /* 首屏视差:指针驱动 hero 核心层反向轻移(仅精确指针设备) */
  var root = document.documentElement;
  var par = { x: 0, y: 0, tx: 0, ty: 0, on: !!(window.matchMedia && window.matchMedia("(pointer: fine)").matches) };
  /* 流星:低频划过,与点阵同色系 */
  var meteors = [];
  var nextMeteor = 2600;
  var lastT = 0;

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dots.length = 0;
    meteors.length = 0;
    var cols = Math.ceil(W / SPACING) + 1;
    var rows = Math.ceil(H / SPACING) + 1;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        dots.push({ ox: c * SPACING, oy: r * SPACING, x: c * SPACING, y: r * SPACING });
      }
    }
  }

  function spawnMeteor(t) {
    var dir = Math.random() < 0.5 ? 1 : -1;
    var speed = 620 + Math.random() * 380;
    var rad = 0.3 + Math.random() * 0.2;             /* 与水平线的下潜角 */
    var len = Math.hypot(Math.cos(rad), Math.sin(rad));
    meteors.push({
      x: dir === 1 ? Math.random() * W * 0.55 : W * 0.45 + Math.random() * W * 0.55,
      y: Math.random() * H * 0.35,
      vx: Math.cos(rad) / len * speed * dir,
      vy: Math.sin(rad) / len * speed,
      born: t,
      life: 850 + Math.random() * 450
    });
  }

  function frame(t) {
    if (!running) return;
    var time = t * 0.001;
    var dt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 0;
    lastT = t;
    ctx.clearRect(0, 0, W, H);
    if (t > nextMeteor) {
      spawnMeteor(t);
      nextMeteor = t + 4500 + Math.random() * 5500;
    }
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
    /* 流星拖尾:头部亮、尾部渐隐,生命周期正弦淡入淡出 */
    for (var mi = meteors.length - 1; mi >= 0; mi--) {
      var m = meteors[mi];
      var age = t - m.born;
      if (age > m.life) { meteors.splice(mi, 1); continue; }
      m.x += m.vx * dt; m.y += m.vy * dt;
      var mA = Math.sin((age / m.life) * Math.PI) * 0.75;
      var spd = Math.hypot(m.vx, m.vy) || 1;
      var tail = 70 + 50 * mA;
      var ex = m.x - m.vx / spd * tail, ey = m.y - m.vy / spd * tail;
      var grad = ctx.createLinearGradient(m.x, m.y, ex, ey);
      grad.addColorStop(0, "rgba(205,228,255," + mA.toFixed(3) + ")");
      grad.addColorStop(1, "rgba(205,228,255,0)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }
    /* 视差缓动跟随:写入 CSS 变量,hero-core 消费 */
    if (par.on) {
      par.x += (par.tx - par.x) * 0.055;
      par.y += (par.ty - par.y) * 0.055;
      root.style.setProperty("--px", par.x.toFixed(4));
      root.style.setProperty("--py", par.y.toFixed(4));
    }
    rafId = requestAnimationFrame(frame);
  }

  function onMove(e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    if (par.on) {
      par.tx = (e.clientX / Math.max(1, W)) * 2 - 1;
      par.ty = (e.clientY / Math.max(1, H)) * 2 - 1;
    }
  }
  function onLeave() {
    mouse.x = -1e4;
    mouse.y = -1e4;
    par.tx = 0; par.ty = 0;
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
