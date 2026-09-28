/* ============================================================
   PhotoChange — 安装到主屏幕（ES module）
   桌面/安卓 Chromium：捕获 beforeinstallprompt，点击按钮唤起原生安装框；
   iOS Safari：无该事件，点击给出「分享 → 添加到主屏幕」手动指引；
   已在 standalone 模式（或 iOS 非 Safari 无法安装）时隐藏按钮。
   ============================================================ */

(function () {
  var btn = document.getElementById("installBtn");
  if (!btn) return;
  var deferred = null;

  function isStandalone() {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
      window.navigator.standalone === true;
  }
  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }
  /* 排除 CriOS/Fxios 等套壳，只认真 Safari（只有它有"添加到主屏幕"） */
  function isSafari() {
    return /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(navigator.userAgent);
  }

  function updateVisibility() {
    var show = !isStandalone() && (deferred || (isIOS() && isSafari()));
    btn.classList.toggle("hidden", !show);
  }

  window.addEventListener("beforeinstallprompt", function (e) {
    if (!e || typeof e.prompt !== "function") return;
    e.preventDefault();
    deferred = e;
    updateVisibility();
  });
  window.addEventListener("appinstalled", function () {
    deferred = null;
    updateVisibility();
  });

  btn.addEventListener("click", function () {
    if (isStandalone()) return;
    if (deferred) {
      var d = deferred;
      deferred = null;
      d.prompt();
      if (d.userChoice && d.userChoice.then) {
        d.userChoice.then(function () { updateVisibility(); });
      }
      return;
    }
    if (isIOS()) {
      alert("添加到主屏幕：点击 Safari 底部工具栏的「分享」按钮，在菜单中选择「添加到主屏幕」即可像 App 一样打开。");
      return;
    }
    alert("安装到桌面：点击浏览器地址栏右侧的「安装」图标，或在菜单中找到「安装应用 / 添加到主屏幕」。");
  });

  updateVisibility();
})();
