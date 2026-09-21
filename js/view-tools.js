/* ============================================================
   PhotoChange — 视图工具（ES module）
   画布视图变换：缩放/旋转/镜像/标尺网格 + 工具条显隐 + Ctrl+Z
   （原 index.html 内联脚本收编；按钮统一 data-act 绑定）
   ============================================================ */

var tools = document.getElementById("image-tools");
var canvas = document.getElementById("canvas");
var zoomText = document.getElementById("zoom-text");
var gridBtn = document.getElementById("gridBtn");
var flipHBtn = document.getElementById("flipH");
var flipVBtn = document.getElementById("flipV");
if (!tools || !canvas || !zoomText) throw new Error("view-tools: 关键元素缺失");

var __zoom = 1, __angle = 0, __flipX = 1, __flipY = 1;

function applyTransform() {
  canvas.style.setProperty("--zoom-level", String(__zoom));
  canvas.style.setProperty("--rotation-angle", __angle + "deg");
  canvas.style.setProperty("--flip-x", String(__flipX));
  canvas.style.setProperty("--flip-y", String(__flipY));
  window.__pcZoom = __zoom;
  window.__pcFlip = { x: __flipX, y: __flipY };
  zoomText.textContent = Math.round(__zoom * 100) + "%";
  if (flipHBtn) flipHBtn.classList.toggle("active", __flipX === -1);
  if (flipVBtn) flipVBtn.classList.toggle("active", __flipY === -1);
}
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

window.changeZoom = function (delta) { __zoom = clamp(__zoom + delta, 0.2, 4); applyTransform(); };
/* 捏合缩放直接设定绝对倍率 */
window.setViewZoom = function (z) { __zoom = clamp(z, 0.2, 4); applyTransform(); };
window.rotateImage = function (deg) { __angle = (__angle + deg) % 360; window.currentRotation = __angle; applyTransform(); };
window.toggleFlip = function (axis) {
  if (axis === "y") { __flipY = -__flipY; } else { __flipX = -__flipX; }
  applyTransform();
};
window.resetViewTransform = function () { __zoom = 1; __angle = 0; __flipX = 1; __flipY = 1; window.currentRotation = 0; applyTransform(); };
window.toggleGrid = function () {
  var wrap = canvas.parentElement;
  var on = wrap.classList.toggle("grid-on");
  if (gridBtn) gridBtn.classList.toggle("active", on);
};

/* 按钮绑定（原 inline onclick → 统一 data-act，配合 CSP 禁内联脚本） */
var acts = {
  "zoom-out": function () { window.changeZoom(-0.1); },
  "zoom-in": function () { window.changeZoom(0.1); },
  "rotate-ccw": function () { window.rotateImage(-90); },
  "rotate-cw": function () { window.rotateImage(90); },
  "flip-x": function () { window.toggleFlip("x"); },
  "flip-y": function () { window.toggleFlip("y"); },
  "grid": function () { window.toggleGrid(); },
  "goto-app": function () { if (window.goToPage) window.goToPage(1); }
};
document.querySelectorAll("[data-act]").forEach(function (btn) {
  btn.addEventListener("click", function () {
    var fn = acts[btn.getAttribute("data-act")];
    if (fn) fn();
  });
});

applyTransform();
(function () {
  try {
    var on = canvas.parentElement.classList.contains("grid-on");
    if (gridBtn) gridBtn.classList.toggle("active", on);
  } catch (_) {}
})();

/* 工具条显隐唯一入口（main.js 与本模块共用，消除双处维护） */
export function showTools() {
  tools.style.display = "flex";
  document.body.classList.add("has-image");
}

/* Ctrl+Z 撤销 */
document.addEventListener("keydown", function (e) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    var tag = e.target && e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    var btn = document.getElementById("toolUndo");
    if (btn && !btn.disabled) btn.click();
  }
});
