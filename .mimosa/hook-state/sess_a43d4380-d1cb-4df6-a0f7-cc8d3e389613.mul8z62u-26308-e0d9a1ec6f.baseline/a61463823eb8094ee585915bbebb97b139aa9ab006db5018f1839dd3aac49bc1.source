/* ============================================================
   PhotoChange — 弹层提示（ES module）
   自定义 alert 替身：window.alert 重定向 + 焦点进出 + Esc 关闭
   + 背景 inert 圈禁（Tab 焦点不会落到弹窗背后）
   ============================================================ */

var overlay = document.getElementById("custom-alert");
var msgEl = document.getElementById("alert-message");
var lastFocus = null;

/* 背景圈禁：pageTrack 整体 inert，Tab 只能在弹窗内循环。
   inert 不支持的旧浏览器优雅降级（仅少键盘保障） */
function setTrackInert(on) {
  var t = document.getElementById("pageTrack");
  if (t && "inert" in t) t.inert = on;
}

function showAlert(msg) {
  if (msgEl) msgEl.innerText = String(msg);
  if (overlay && overlay.style.display !== "flex") {
    lastFocus = document.activeElement;
    overlay.style.display = "flex";
    setTrackInert(true);
    var b = overlay.querySelector(".alert-btn");
    if (b) setTimeout(function () { b.focus(); }, 30);
  }
}

function closeAlert() {
  if (overlay) overlay.style.display = "none";
  setTrackInert(false);
  if (lastFocus && lastFocus.focus) { lastFocus.focus(); lastFocus = null; }
}

window.alert = function (msg) { showAlert(msg); };

overlay.querySelector(".alert-btn").addEventListener("click", closeAlert);
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape" && overlay && overlay.style.display === "flex") closeAlert();
});
