/* ============================================================
   PhotoChange — Hero Before/After 演示
   证件照换底色对比滑块：两张程序化绘制的画布（白底/蓝底），
   拖动分界线或用键盘方向键对比。零外部资源（dataURL/CSP data: 放行）；
   prefers-reduced-motion 时不做自动引导漂移。
   交互全权交给覆盖全卡的透明 range：点击跳转、拖动、键盘、读屏都是原生行为。
   ============================================================ */
(function () {
  var card = document.getElementById('baCard');
  if (!card) return;
  var before = card.querySelector('.ba-before');
  var after = card.querySelector('.ba-after');
  var divider = card.querySelector('.ba-divider');
  var range = document.getElementById('baRange');
  var reduced = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var W = 720, H = 480, dpr = Math.min(window.devicePixelRatio || 1, 2);

  /* ---------- 程序化证件照：抽象人像（头部/颈肩/衣领），换底色只改背景 ---------- */
  function drawPhoto(bg) {
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d');
    /* 背景 + 轻微渐晕，贴近证件照翻拍质感 */
    var base = g.createRadialGradient(W / 2, H * 0.42, H * 0.2, W / 2, H / 2, H * 0.85);
    base.addColorStop(0, bg);
    base.addColorStop(1, shade(bg, -0.05));
    g.fillStyle = base;
    g.fillRect(0, 0, W, H);
    /* 身体：西装肩线 */
    g.fillStyle = '#2b3038';
    g.beginPath();
    g.moveTo(W * 0.16, H);
    g.quadraticCurveTo(W * 0.2, H * 0.66, W * 0.38, H * 0.6);
    g.lineTo(W * 0.62, H * 0.6);
    g.quadraticCurveTo(W * 0.8, H * 0.66, W * 0.84, H);
    g.closePath();
    g.fill();
    /* 衬衫领口 */
    g.fillStyle = '#e9edf2';
    g.beginPath();
    g.moveTo(W * 0.43, H * 0.62);
    g.lineTo(W * 0.5, H * 0.74);
    g.lineTo(W * 0.57, H * 0.62);
    g.quadraticCurveTo(W * 0.5, H * 0.6, W * 0.43, H * 0.62);
    g.closePath();
    g.fill();
    /* 颈部 */
    g.fillStyle = '#e0b08e';
    g.fillRect(W * 0.455, H * 0.5, W * 0.09, H * 0.14);
    /* 头部 */
    g.fillStyle = '#edbd98';
    g.beginPath();
    g.ellipse(W * 0.5, H * 0.36, W * 0.105, H * 0.145, 0, 0, Math.PI * 2);
    g.fill();
    /* 头发 */
    g.fillStyle = '#20242b';
    g.beginPath();
    g.ellipse(W * 0.5, H * 0.285, W * 0.108, H * 0.088, 0, Math.PI, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(W * 0.415, H * 0.3, W * 0.02, H * 0.06, 0.2, 0, Math.PI * 2);
    g.ellipse(W * 0.585, H * 0.3, W * 0.02, H * 0.06, -0.2, 0, Math.PI * 2);
    g.fill();
    /* 轻噪点（纯视觉纹理，非加密用途） */
    for (var i = 0; i < 900; i++) {
      g.fillStyle = 'rgba(0,0,0,' + (Math.random() * 0.025) + ')';
      g.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5);
    }
    return c.toDataURL('image/png');
  }
  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = (n >> 16) + amt * 255, g2 = ((n >> 8) & 255) + amt * 255, b = (n & 255) + amt * 255;
    return 'rgb(' + Math.round(r) + ',' + Math.round(g2) + ',' + Math.round(b) + ')';
  }

  /* ---------- 程序化风景照：山与落日（呼应 hero 字标的照片层） ---------- */
  function drawLandscape() {
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d');
    /* 黄昏天空（与 hero-art 照片层同一族配色） */
    var sky = g.createLinearGradient(0, 0, 0, H * 0.72);
    sky.addColorStop(0, '#0e2036'); sky.addColorStop(0.45, '#2b5f8f');
    sky.addColorStop(0.75, '#7fb0d8'); sky.addColorStop(1, '#e8c27a');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H * 0.72);
    /* 落日 */
    var sun = g.createRadialGradient(W * 0.62, H * 0.56, 4, W * 0.62, H * 0.56, H * 0.16);
    sun.addColorStop(0, 'rgba(255,214,140,.95)');
    sun.addColorStop(1, 'rgba(255,214,140,0)');
    g.fillStyle = sun;
    g.fillRect(0, 0, W, H * 0.72);
    g.fillStyle = '#ffd68a';
    g.beginPath();
    g.arc(W * 0.62, H * 0.56, H * 0.055, 0, Math.PI * 2);
    g.fill();
    /* 远山两层 */
    g.fillStyle = '#23425f';
    g.beginPath();
    g.moveTo(0, H * 0.6);
    g.lineTo(W * 0.22, H * 0.44);
    g.lineTo(W * 0.4, H * 0.58);
    g.lineTo(W * 0.58, H * 0.47);
    g.lineTo(W * 0.78, H * 0.6);
    g.lineTo(W, H * 0.52);
    g.lineTo(W, H * 0.72);
    g.lineTo(0, H * 0.72);
    g.closePath();
    g.fill();
    g.fillStyle = '#16293c';
    g.beginPath();
    g.moveTo(0, H * 0.68);
    g.lineTo(W * 0.3, H * 0.56);
    g.lineTo(W * 0.55, H * 0.68);
    g.lineTo(W * 0.8, H * 0.58);
    g.lineTo(W, H * 0.66);
    g.lineTo(W, H * 0.72);
    g.lineTo(0, H * 0.72);
    g.closePath();
    g.fill();
    /* 湖面：映色 + 波光横纹 */
    var lake = g.createLinearGradient(0, H * 0.72, 0, H);
    lake.addColorStop(0, '#3d5a74'); lake.addColorStop(1, '#0c1622');
    g.fillStyle = lake;
    g.fillRect(0, H * 0.72, W, H * 0.28);
    g.fillStyle = 'rgba(255,214,140,.28)';
    for (var y = H * 0.74; y < H; y += H * 0.035) {
      var wob = (Math.sin(y * 0.09) + 1) * W * 0.012;
      g.fillRect(W * 0.62 - H * 0.05 + wob, y, H * 0.1, 1.6);
    }
    g.fillStyle = 'rgba(255,255,255,.14)';
    for (var y2 = H * 0.75; y2 < H; y2 += H * 0.05) {
      g.fillRect(W * (0.08 + (y2 % 0.1) * 2), y2, W * 0.18, 1.2);
      g.fillRect(W * 0.7, y2 + H * 0.012, W * 0.16, 1.2);
    }
    /* 飞鸟 */
    g.strokeStyle = 'rgba(20,30,42,.8)';
    g.lineWidth = 2;
    [[0.3, 0.2], [0.36, 0.16], [0.42, 0.21]].forEach(function (p) {
      g.beginPath();
      g.arc(W * p[0], H * p[1], H * 0.016, Math.PI * 1.15, Math.PI * 1.85);
      g.stroke();
    });
    /* 轻噪点（纯视觉纹理，非加密用途） */
    for (var i = 0; i < 900; i++) {
      g.fillStyle = 'rgba(0,0,0,' + (Math.random() * 0.03) + ')';
      g.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5);
    }
    return c;
  }
  /* 斜向平铺文字水印（同工具「平铺」模式观感） */
  function stampWatermark(src) {
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d');
    g.drawImage(src, 0, 0);
    g.save();
    g.translate(W / 2, H / 2);
    g.rotate(-Math.PI / 6);
    g.font = '600 ' + Math.round(H * 0.052) + 'px Inter, system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    var stepX = W * 0.46, stepY = H * 0.2;
    for (var y = -H; y <= H; y += stepY) {
      for (var x = -W; x <= W; x += stepX) {
        g.fillStyle = 'rgba(255,255,255,.16)';
        g.fillText('PhotoChange', x + (y / stepY % 2 ? stepX / 2 : 0), y);
      }
    }
    g.restore();
    return c.toDataURL('image/png');
  }

  function paint(canvas, url) {
    var img = new Image();
    img.onload = function () {
      canvas.width = W * dpr; canvas.height = H * dpr;
      var g = canvas.getContext('2d');
      g.scale(dpr, dpr);
      g.drawImage(img, 0, 0, W, H);
    };
    img.src = url;
  }

  /* ---------- 演示目录：页签 → 两帧画面 / 角标 / 说明 ---------- */
  var DEMOS = {
    bg: {
      chipR: '换底色',
      caption: '证件照一键换底色 · 拖动分界线对比',
      paint: function () {
        paint(before, drawPhoto('#f4f2ee'));
        paint(after, drawPhoto('#438edb'));
      }
    },
    wm: {
      chipR: '加水印',
      caption: '斜向平铺水印 · 防盗用，透明度大小可调',
      paint: function () {
        var src = drawLandscape();
        paint(before, src.toDataURL('image/png'));
        paint(after, stampWatermark(src));
      }
    }
  };
  var tabs = card.querySelectorAll('.ba-tab');
  var chipR = card.querySelector('.ba-chip-r');
  var caption = card.querySelector('.ba-caption');
  tabs.forEach(function (t) {
    t.addEventListener('click', function () {
      if (t.classList.contains('on')) return;
      interacted = true; /* 切换演示即视为已上手，取消引导漂移 */
      tabs.forEach(function (x) {
        var on = x === t;
        x.classList.toggle('on', on);
        x.setAttribute('aria-selected', String(on));
      });
      var d = DEMOS[t.getAttribute('data-demo')];
      card.setAttribute('data-demo', t.getAttribute('data-demo'));
      chipR.textContent = d.chipR;
      caption.textContent = d.caption;
      d.paint();
    });
  });


  /* ---------- 分界线同步 ---------- */
  var interacted = false;
  function apply() {
    var pos = parseFloat(range.value);
    after.style.clipPath = 'inset(0 0 0 ' + pos + '%)';
    divider.style.left = pos + '%';
    range.setAttribute('aria-valuetext', '分界线在 ' + Math.round(pos) + '%');
  }
  range.addEventListener('input', function () {
    interacted = true;
    apply();
  });
  range.addEventListener('focus', function () { card.classList.add('ba-focus'); });
  range.addEventListener('blur', function () { card.classList.remove('ba-focus'); });

  /* 自动引导漂移一次（50 → 37 → 63 → 50），演示可拖动；用户先动手则取消 */
  function drift() {
    if (interacted || reduced) return;
    var t0 = performance.now(), D = 2400;
    function step(now) {
      if (interacted) return;
      var p = Math.min(1, (now - t0) / D);
      range.value = String(Math.round(50 - Math.sin(p * Math.PI * 2) * 13 * (1 - p)));
      apply();
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function init() {
    DEMOS.bg.paint();
    apply();
    setTimeout(drift, 1600);
  }
  if (document.readyState === 'complete') init();
  else window.addEventListener('load', init);
})();
