/* ============================================================
   PhotoChange — 裁剪与画布手势（ES module）
   选区拖拽（Pointer Events，鼠标/触摸/触控笔通用）、键盘裁剪、
   双指捏合缩放。选区状态在共享 state 上；遮罩绘制由主编排的
   drawScaled 在每次重绘末尾调用 drawSelection 完成。
   ============================================================ */
import { state } from "./state.js?v=10";

export function normRect(s) {
  return {
    x: Math.min(s.x, s.x + s.w), y: Math.min(s.y, s.y + s.h),
    w: Math.abs(s.w), h: Math.abs(s.h)
  };
}

/* evenodd 镂空遮罩：选区外半透明压暗 */
export function drawSelection(ctx) {
  if (!state.selection) return;
  var canvas = ctx.canvas;
  var r = normRect(state.selection);
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.rect(0, 0, canvas.width, canvas.height);
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.fill("evenodd");
  ctx.strokeStyle = "#93c5fd";
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(r.x, r.y, r.w, r.h);
  ctx.restore();
}

/* 画布被 CSS 缩放/旋转/镜像过：以布局中心做逆变换，映射回位图坐标。
   CSS transform 组合为 Flip·Rotate·Zoom，逆变换必须按相反顺序
   un-flip → un-rotate → un-zoom，否则 90°/270° 旋转+镜像时选区错位 */
function canvasPoint(canvas, evt) {
  var wrap = canvas.parentElement.getBoundingClientRect();
  var cx = wrap.left + wrap.width / 2, cy = wrap.top + wrap.height / 2;
  var z = window.__pcZoom || 1;
  var dx = evt.clientX - cx, dy = evt.clientY - cy;
  var flip = window.__pcFlip || { x: 1, y: 1 };
  dx *= flip.x; dy *= flip.y;
  var a = ((window.currentRotation || 0) % 360) * Math.PI / 180;
  var cos = Math.cos(-a), sin = Math.sin(-a);
  return {
    x: (dx * cos - dy * sin) / z + canvas.width / 2,
    y: (dx * sin + dy * cos) / z + canvas.height / 2
  };
}

/* opts: { canvas, ctx, stripAspect, cropApply, redraw, pushHistory, onEdited } */
export function initCrop(opts) {
  var canvas = opts.canvas;
  var stripAspect = opts.stripAspect;
  var cropApply = opts.cropApply;
  var redraw = opts.redraw;
  var pushHistory = opts.pushHistory;
  var onEdited = opts.onEdited || function () {};

  /* 触屏捏合缩放：第二根手指落下进入捏合，按指距比例设定倍率；
     捏合期间取消裁剪拖拽，抬起到单指后重新按下才继续框选 */
  var activePtrs = new Map();
  var pinch = null;
  function ptrDist() {
    var pts = Array.from(activePtrs.values());
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }
  canvas.addEventListener("pointerdown", function (e) {
    if (!state.workingImage || !e.isPrimary) return;
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    activePtrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activePtrs.size === 2) {
      pinch = { startDist: ptrDist(), startZoom: window.__pcZoom || 1 };
      state.dragging = false;
      state.selection = null;
      redraw();
      return;
    }
    state.dragging = true;
    state.selection = { x: canvasPoint(canvas, e).x, y: canvasPoint(canvas, e).y, w: 0, h: 0 };
  });
  canvas.addEventListener("pointermove", function (e) {
    if (activePtrs.has(e.pointerId)) activePtrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && activePtrs.size >= 2) {
      var d = ptrDist();
      if (pinch.startDist > 0) window.setViewZoom(pinch.startZoom * (d / pinch.startDist));
      return;
    }
    if (!state.dragging || !state.selection || !e.isPrimary) return;
    var p = canvasPoint(canvas, e);
    var ax = p.x - state.selection.x, ay = p.y - state.selection.y;
    var mode = stripAspect.value;
    if (mode !== "free") {
      var parts = mode.split(":");
      var ar = parseFloat(parts[0]) / parseFloat(parts[1]);
      if (Math.abs(ax) >= Math.abs(ay)) ay = Math.sign(ay || 1) * Math.abs(ax) / ar;
      else ax = Math.sign(ax || 1) * Math.abs(ay) * ar;
    }
    state.selection.w = ax; state.selection.h = ay;
    redraw();
  });
  function endDrag(e) {
    if (e && e.pointerId != null) activePtrs.delete(e.pointerId);
    if (activePtrs.size < 2) pinch = null;
    if (!e || e.isPrimary) state.dragging = false;
  }
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  window.addEventListener("pointerup", endDrag);

  /* 键盘裁剪：方向键建/移选区，Shift+方向键调大小，Enter 应用，Esc 清除。
     stopPropagation 防止 page-switch 把方向键当翻页 */
  canvas.addEventListener("keydown", function (e) {
    if (!state.workingImage) return;
    var k = e.key;
    var isArrow = k.indexOf("Arrow") === 0;
    if (!isArrow && k !== "Enter" && k !== "Escape") return;
    e.stopPropagation();
    e.preventDefault();
    if (k === "Escape") { state.selection = null; redraw(); return; }
    if (k === "Enter") { if (state.selection) cropApply.click(); return; }
    var step = Math.max(4, Math.round(Math.min(canvas.width, canvas.height) * 0.01));
    var dx = k === "ArrowRight" ? step : k === "ArrowLeft" ? -step : 0;
    var dy = k === "ArrowDown" ? step : k === "ArrowUp" ? -step : 0;
    if (!state.selection) {
      var w0 = Math.round(canvas.width * 0.2), h0 = Math.round(canvas.height * 0.2);
      state.selection = { x: (canvas.width - w0) / 2, y: (canvas.height - h0) / 2, w: w0, h: h0 };
    } else if (e.shiftKey) {
      state.selection.w += dx;
      state.selection.h += dy;
    } else {
      var r = normRect(state.selection);
      r.x = Math.max(0, Math.min(canvas.width - r.w, r.x + dx));
      r.y = Math.max(0, Math.min(canvas.height - r.h, r.y + dy));
      state.selection = r;
    }
    redraw();
  });

  cropApply.addEventListener("click", function () {
    if (!state.selection || !state.workingImage) return;
    var r = normRect(state.selection);
    var sx = r.x * (state.workingImage.width / canvas.width);
    var sy = r.y * (state.workingImage.height / canvas.height);
    var sw = r.w * (state.workingImage.width / canvas.width);
    var sh = r.h * (state.workingImage.height / canvas.height);
    if (sw < 2 || sh < 2) return;
    pushHistory();
    var next = document.createElement("canvas");
    next.width = Math.round(sw); next.height = Math.round(sh);
    next.getContext("2d").drawImage(state.workingImage, sx, sy, sw, sh, 0, 0, next.width, next.height);
    state.workingImage = next;
    state.selection = null;
    redraw(); onEdited();
  });
}
