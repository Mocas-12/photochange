/* ============================================================
   PhotoChange — 引导（ES module）
   访问计数兜底（busuanzi 加载失败时的占位与分隔线显隐）
   + Service Worker 注册
   ============================================================ */

(function () {
  function visible(el) { if (!el) return false; const s = getComputedStyle(el); return s.display !== "none" && s.visibility !== "hidden"; }
  function ensureVisible() {
    const pvC = document.getElementById("busuanzi_container_site_pv");
    const uvC = document.getElementById("busuanzi_container_site_uv");
    const pvV = document.getElementById("busuanzi_value_site_pv");
    const uvV = document.getElementById("busuanzi_value_site_uv");
    if (pvC) pvC.style.display = "inline";
    if (uvC) uvC.style.display = "inline";
    if (pvV && (!pvV.textContent || pvV.textContent.trim() === "")) pvV.textContent = "加载中...";
    if (uvV && (!uvV.textContent || uvV.textContent.trim() === "")) uvV.textContent = "加载中...";
  }
  function finalizeFallback() {
    const pvV = document.getElementById("busuanzi_value_site_pv");
    const uvV = document.getElementById("busuanzi_value_site_uv");
    if (pvV && pvV.textContent === "加载中...") pvV.textContent = "暂不可用";
    if (uvV && uvV.textContent === "加载中...") uvV.textContent = "暂不可用";
  }
  function updateSep() {
    const pv = document.getElementById("busuanzi_container_site_pv");
    const uv = document.getElementById("busuanzi_container_site_uv");
    const sep = document.getElementById("busuanzi_sep");
    if (!sep) return;
    sep.style.display = (visible(pv) && visible(uv)) ? "inline" : "none";
  }
  const pv = document.getElementById("busuanzi_container_site_pv");
  const uv = document.getElementById("busuanzi_container_site_uv");
  const obsCfg = { attributes: true, attributeFilter: ["style", "class"] };
  if (pv) new MutationObserver(function () { ensureVisible(); updateSep(); }).observe(pv, obsCfg);
  if (uv) new MutationObserver(function () { ensureVisible(); updateSep(); }).observe(uv, obsCfg);
  document.addEventListener("DOMContentLoaded", function () { ensureVisible(); updateSep(); });
  window.addEventListener("load", function () { ensureVisible(); updateSep(); });
  setTimeout(function () { ensureVisible(); updateSep(); }, 1200);
  setTimeout(finalizeFallback, 5000);
})();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("./service-worker.js").catch(function () {});
  });
}
