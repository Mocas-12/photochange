/* ============================================================
   PhotoChange — Hero 照片字标（ES module）
   程序化绘制一幅"山与落日"照片填入标题字形（background-clip:text），
   扫光周期性沿字形流过，指针驱动照片层微视差，全页铺胶片颗粒。
   零外部资源（canvas 生成 dataURL，CSP img-src data: 放行）；
   prefers-reduced-motion 时为静态照片填充，无扫光无视差。
   ============================================================ */

(function () {
  var title = document.querySelector(".hero-title");
  if (!title) return;
  var reduced = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- 胶片颗粒层 ---------- */
  var grain = document.createElement("div");
  grain.className = "hero-grain";
  grain.setAttribute("aria-hidden", "true");
  document.body.appendChild(grain);

  /* ---------- 程序化照片：900×300 暗夜山与落日 ---------- */
  function paintScene() {
    var c = document.createElement("canvas");
    c.width = 900; c.height = 300;
    var g = c.getContext("2d");
    var sky = g.createLinearGradient(0, 0, 0, 300);
    sky.addColorStop(0, "#0e2036"); sky.addColorStop(0.45, "#2b5f8f");
    sky.addColorStop(0.75, "#7fb0d8"); sky.addColorStop(1, "#e8c27a");
    g.fillStyle = sky; g.fillRect(0, 0, 900, 300);
    g.fillStyle = "rgba(255,255,255,.8)";
    for (var i = 0; i < 46; i++) {
      g.globalAlpha = 0.15 + Math.random() * 0.5;
      g.fillRect(Math.random() * 900, Math.random() * 90, 1.4, 1.4);
    }
    g.globalAlpha = 1;
    var sun = g.createRadialGradient(640, 172, 0, 640, 172, 120);
    sun.addColorStop(0, "rgba(255,214,140,.95)");
    sun.addColorStop(0.18, "rgba(255,190,102,.85)");
    sun.addColorStop(0.5, "rgba(255,170,90,.28)");
    sun.addColorStop(1, "rgba(255,170,90,0)");
    g.fillStyle = sun; g.fillRect(520, 52, 240, 240);
    g.fillStyle = "#ffd9a0";
    g.beginPath(); g.arc(640, 172, 34, 0, 6.2832); g.fill();
    g.fillStyle = "#3a5571";
    g.beginPath();
    g.moveTo(0, 210); g.lineTo(150, 96); g.lineTo(300, 210);
    g.lineTo(430, 128); g.lineTo(560, 214); g.lineTo(900, 168);
    g.lineTo(900, 300); g.lineTo(0, 300); g.closePath(); g.fill();
    g.fillStyle = "#22364c";
    g.beginPath(); g.moveTo(0, 300); g.lineTo(120, 196); g.lineTo(260, 300); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(420, 300); g.lineTo(610, 176); g.lineTo(820, 300); g.closePath(); g.fill();
    g.fillStyle = "#16283c"; g.fillRect(0, 268, 900, 32);
    return c;
  }

  var url = paintScene().toDataURL("image/png");
  /* 三层背景：1 扫光（300% 宽以便位移）· 2 照片 · 3 明暗塑形 */
  title.style.backgroundImage =
    "linear-gradient(100deg,transparent 45%,rgba(255,255,255,.4) 47.5%,transparent 50%)," +
    "url(" + url + ")," +
    "linear-gradient(180deg,rgba(255,255,255,.34),rgba(120,160,220,.06) 42%,rgba(0,0,0,.4))";
  title.style.backgroundRepeat = "no-repeat";
  title.style.backgroundSize = "300% 100%, cover, 100% 100%";

  /* ---------- 扫光 + 指针视差 ---------- */
  var SWEEP_PERIOD = 6000, EXIT = 600, ENTER = 1000;
  var rest = 50;                 /* 驻留位（%） */
  var last = performance.now(), acc = 0, phase = 0; /* 0=驻留 1=出场 2=入场 */
  var tPhase = 0;
  var pageActive = true;         /* 工作台页时暂停循环省电（与 pointer-fx 同机制） */
  window.addEventListener("pcpage", function (e) {
    pageActive = !(e.detail && e.detail.page > 0);
  }, { passive: true });

  function positions(sweepP, px, py) {
    return sweepP.toFixed(1) + "% 0%," +
      " calc(50% + " + (px * 16).toFixed(1) + "px) calc(82% + " + (py * 10).toFixed(1) + "px)," +
      " 0% 0%";
  }

  if (reduced) {
    title.style.backgroundPosition = "50% 0%, center 82%, 0% 0%";
    return;
  }

  function frame(now) {
    if (!pageActive) { last = now; requestAnimationFrame(frame); return; }
    var dt = Math.min(64, now - last); last = now;
    var p = rest;
    if (phase === 0) {
      acc += dt;
      if (acc > SWEEP_PERIOD) { phase = 1; tPhase = 0; }
    } else {
      tPhase += dt;
      if (phase === 1) {                     /* 50 → 150：向左离场 */
        var k1 = Math.min(1, tPhase / EXIT);
        p = rest + (150 - rest) * (k1 * k1);
        if (k1 >= 1) { phase = 2; tPhase = 0; }
      } else {                               /* -50 → 50：从右入场 */
        var k2 = Math.min(1, tPhase / ENTER);
        var e = 1 - Math.pow(1 - k2, 3);
        p = -50 + (rest + 50) * e;
        if (k2 >= 1) { phase = 0; acc = 0; }
      }
    }
    var px = parseFloat(document.documentElement.style.getPropertyValue("--px")) || 0;
    var py = parseFloat(document.documentElement.style.getPropertyValue("--py")) || 0;
    title.style.backgroundPosition = positions(p, px, py);
    requestAnimationFrame(frame);
  }
  title.style.backgroundPosition = positions(rest, 0, 0);
  requestAnimationFrame(frame);
})();
