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
    paint(before, drawPhoto('#f4f2ee'));
    paint(after, drawPhoto('#438edb'));
    apply();
    setTimeout(drift, 1600);
  }
  if (document.readyState === 'complete') init();
  else window.addEventListener('load', init);
})();
