/* ============================================================
   PhotoChange — 引导（ES module）
   Service Worker 注册（访问计数已移除，页面无任何第三方脚本）
   ============================================================ */

if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("./service-worker.js").catch(function () {});
  });
}
