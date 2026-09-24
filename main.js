/* ============================================================
   PhotoChange — 核心编排（ES module 入口）
   三段式工作流：顶部工具条(裁剪/尺寸/水印/撤销/重置)
   + 画布 + 底部导出条(格式/质量/目标体积/文件名/导出)
   模块边界：纯编码器 js/exporters.js，会话存储 js/session.js，
   视图工具 js/view-tools.js，裁剪手势 js/crop.js，
   水印 js/watermark.js，共享可变状态 js/state.js。
   本文件持有绘制枢纽 drawScaled 与各工具的 UI 编排。
   ============================================================ */
import { bmpBlob, icoBlob, blobUnderKB, flattenForExport, loadJsPdf } from "./js/exporters.js?v=10";
import { sessionPut, sessionGet, sessionClear } from "./js/session.js?v=10";
import { showTools } from "./js/view-tools.js?v=10";
import { state, MAX_SIDE, HISTORY_MAX, HISTORY_BYTES_MAX } from "./js/state.js?v=10";
import { paintWatermark, wmActive, initWatermark } from "./js/watermark.js?v=10";
import { drawSelection, initCrop } from "./js/crop.js?v=10";

(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- 元素 ---------- */
  var fileInput = $("fileInput"), dropzone = $("dropzone");
  var canvas = $("canvas"), ctx = canvas.getContext("2d");
  var toolCrop = $("toolCrop"), toolSize = $("toolSize"), toolWm = $("toolWm"), toolAdjust = $("toolAdjust");
  var toolId = $("toolId"), toolDeco = $("toolDeco");
  var toolUndo = $("toolUndo"), toolReset = $("toolReset");
  var stripCrop = $("stripCrop"), stripSize = $("stripSize"), stripWm = $("stripWm"), stripAdjust = $("stripAdjust");
  var stripId = $("stripId"), stripDeco = $("stripDeco");
  var idOrig = $("idOrig"), idNew = $("idNew"), idTol = $("idTol");
  var applyBg = $("applyBg"), genLayout = $("genLayout");
  var decoRadius = $("decoRadius"), decoBorder = $("decoBorder"), decoColor = $("decoColor"), applyDecoBtn = $("applyDeco");
  var batchPanel = $("batchPanel"), batchList = $("batchList"), batchCount = $("batchCount");
  var batchResize = $("batchResize"), batchClear = $("batchClear");
  var restoreBar = $("restoreBar"), restoreYes = $("restoreYes"), restoreNo = $("restoreNo");
  var wmType = $("wmType"), wmMode = $("wmMode"), wmImgInput = $("wmImgInput"), wmImgBtn = $("wmImgBtn"), wmScale = $("wmScale");
  var adjBrightness = $("adjBrightness"), adjContrast = $("adjContrast"), adjSaturate = $("adjSaturate"), adjReset = $("adjReset");
  var stripAspect = $("stripAspect"), cropApply = $("cropApply");
  var widthInput = $("widthInput"), heightInput = $("heightInput");
  var presetSelect = $("presetSelect"), lockRatio = $("lockRatio"), applyResize = $("applyResize");
  var fitMode = $("fitMode");
  var wmEnable = $("wmEnable"), wmText = $("wmText"), wmPos = $("wmPos"), wmOpacity = $("wmOpacity");
  var formatSelect = $("formatSelect"), jpgOnlyRow = $("jpgOnlyRow");
  var qualityRange = $("qualityRange"), qualityValue = $("qualityValue");
  var targetKB = $("targetKB"), fileNameInput = $("fileName"), downloadBtn = $("downloadBtn");

  /* ---------- 工具函数 ---------- */
  function setCanvasSize(w, h) { canvas.width = w; canvas.height = h; }
  function fitToBox(nw, nh, maxW, maxH) {
    var r = Math.min(maxW / nw, maxH / nh, 1);
    return { w: Math.max(1, Math.round(nw * r)), h: Math.max(1, Math.round(nh * r)) };
  }
  function drawScaled() {
    if (!state.workingImage) return;
    /* 供信息徽章 / 额度判断直读当前位图（替代 drawImage 原型补丁） */
    window.__pc_lastSrcCanvas = state.workingImage;
    var fit = fitToBox(state.workingImage.width, state.workingImage.height,
      canvas.parentElement.clientWidth - 20, canvas.parentElement.clientHeight - 20);
    setCanvasSize(fit.w, fit.h);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.filter = isAdjustDefault() ? "none" : adjustFilter();
    ctx.drawImage(state.workingImage, 0, 0, canvas.width, canvas.height);
    ctx.filter = "none";
    /* 画布元素带 CSS 翻转：预览水印预先反向绘制，保证屏上观感与导出一致 */
    var flip = window.__pcFlip || { x: 1, y: 1 };
    if (flip.x !== 1 || flip.y !== 1) {
      ctx.save();
      ctx.translate(flip.x === -1 ? canvas.width : 0, flip.y === -1 ? canvas.height : 0);
      ctx.scale(flip.x, flip.y);
      paintWatermark(ctx, canvas.width, canvas.height);
      ctx.restore();
    } else {
      paintWatermark(ctx, canvas.width, canvas.height);
    }
    drawSelection(ctx);
  }
  function syncInputs() {
    if (!state.workingImage) return;
    widthInput.value = state.workingImage.width;
    heightInput.value = state.workingImage.height;
  }

  /* ---------- 历史（撤销） ---------- */
  function pushHistory() {
    if (!state.workingImage) return;
    var c = document.createElement("canvas");
    c.width = state.workingImage.width; c.height = state.workingImage.height;
    c.getContext("2d").drawImage(state.workingImage, 0, 0);
    var bytes = c.width * c.height * 4;
    state.history.push({ c: c, bytes: bytes });
    state.historyBytes += bytes;
    while (state.history.length > HISTORY_MAX || state.historyBytes > HISTORY_BYTES_MAX) {
      state.historyBytes -= state.history[0].bytes;
      state.history.shift();
    }
    toolUndo.disabled = false;
  }
  function undo() {
    var e = state.history.pop();
    if (!e) return;
    state.historyBytes -= e.bytes;
    state.workingImage = e.c;
    state.selection = null;
    drawScaled(); syncInputs();
    toolUndo.disabled = state.history.length === 0;
    scheduleSessionSave();
  }

  /* ---------- 选区遮罩绘制在 js/crop.js（drawSelection） ---------- */

  /* ---------- 加载图片 ---------- */
  function loadImage(file) {
    if (!file) return;
    if (isHeic(file)) {
      loadHeicLib()
        .then(function () { return window.heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 }); })
        .then(function (out) {
          if (Array.isArray(out)) out = out[0];
          decodeFile(out, (file.name || "image").replace(/\.hei[cf]$/i, ""));
        })
        .catch(function (err) { alert("图片加载失败：" + err.message); });
      return;
    }
    decodeFile(file, null);
  }
  /* HEIC / HEIF（iPhone 照片）：浏览器不能直接解码时按需加载转换库，转 JPG 进画布 */
  function isHeic(file) {
    var n = (file.name || "").toLowerCase();
    return file.type === "image/heic" || file.type === "image/heif" || /\.hei[cf]$/i.test(n);
  }
  function loadHeicLib() {
    if (window.heic2any) return Promise.resolve();
    /* 优先自托管，CDN 兜底：避免第三方脚本被墙或被劫持 */
    var sources = ["./vendor/heic2any.min.js",
      "https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js"];
    return new Promise(function (resolve, reject) {
      var attempt = 0;
      var s = document.createElement("script");
      s.onload = function () { resolve(); };
      s.onerror = function () {
        attempt += 1;
        if (attempt < sources.length) {
          s.src = sources[attempt];
          document.head.appendChild(s);
        } else {
          reject(new Error("HEIC 解码库加载失败，请检查网络后重试"));
        }
      };
      s.src = sources[0];
      document.head.appendChild(s);
    });
  }
  function decodeFile(file, nameOverride) {
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url);
      var scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
      state.baseW = Math.max(1, Math.round(img.naturalWidth * scale));
      state.baseH = Math.max(1, Math.round(img.naturalHeight * scale));
      state.originalImage = img;
      state.workingImage = document.createElement("canvas");
      state.workingImage.width = state.baseW;
      state.workingImage.height = state.baseH;
      state.workingImage.getContext("2d").drawImage(img, 0, 0, state.baseW, state.baseH);
      state.history.length = 0; state.historyBytes = 0;
      toolUndo.disabled = true;
      state.selection = null;
      window.__pcHasImage = true;
      showTools();
      drawScaled(); syncInputs();
      fileNameInput.value = (nameOverride || file.name || "output").replace(/\.[^.]+$/, "");
      scheduleSessionSave();
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      alert("图片解码失败：当前浏览器可能不支持此格式");
    };
    img.src = url;
  }
  /* 整个拖放区可点击选图（移动端主要点击路径）；按钮点击冒泡到此统一处理 */
  dropzone.addEventListener("click", function () { fileInput.click(); });
  dropzone.addEventListener("dragover", function (e) {
    e.preventDefault(); dropzone.classList.add("hover");
  });
  dropzone.addEventListener("dragleave", function () { dropzone.classList.remove("hover"); });
  dropzone.addEventListener("drop", function (e) {
    e.preventDefault(); dropzone.classList.remove("hover");
    var files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length > 1) { loadBatch(files); return; }
    if (files && files[0]) loadImage(files[0]);
  });
  fileInput.addEventListener("change", function (e) {
    var files = e.target.files;
    if (files && files.length > 1) { loadBatch(files); return; }
    if (files && files[0]) loadImage(files[0]);
  });
  /* 粘贴上传：截图后直接 Ctrl+V，无需先存文件 */
  window.addEventListener("paste", function (e) {
    var items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (var i = 0; i < items.length; i++) {
      if (items[i].type && items[i].type.indexOf("image/") === 0) {
        var f = items[i].getAsFile();
        if (f) { e.preventDefault(); loadImage(f); }
        return;
      }
    }
  });

  /* ---------- 工具条：切换操作条 ---------- */
  function toggleStrip(strip, btn) {
    var isOpen = !strip.classList.contains("hidden");
    [stripCrop, stripSize, stripWm, stripAdjust, stripId, stripDeco].forEach(function (s) { s.classList.add("hidden"); });
    [toolCrop, toolSize, toolWm, toolAdjust, toolId, toolDeco].forEach(function (b) { b.classList.remove("active"); });
    if (!isOpen) {
      strip.classList.remove("hidden");
      btn.classList.add("active");
    }
  }
  toolCrop.addEventListener("click", function () { toggleStrip(stripCrop, toolCrop); });
  toolSize.addEventListener("click", function () { toggleStrip(stripSize, toolSize); });
  toolWm.addEventListener("click", function () { toggleStrip(stripWm, toolWm); });
  toolAdjust.addEventListener("click", function () { toggleStrip(stripAdjust, toolAdjust); });
  toolId.addEventListener("click", function () {
    toggleStrip(stripId, toolId);
    /* 打开面板时自动探测原背景色(四角均色),可手动修正 */
    if (state.workingImage && !stripId.classList.contains("hidden")) {
      var bg = detectBgColor(state.workingImage);
      idOrig.value = "#" + ((1 << 24) + (bg.r << 16) + (bg.g << 8) + bg.b).toString(16).slice(1);
    }
  });
  toolDeco.addEventListener("click", function () { toggleStrip(stripDeco, toolDeco); });
  toolUndo.addEventListener("click", undo);
  toolReset.addEventListener("click", function () {
    if (!state.originalImage) return;
    pushHistory();
    state.workingImage = document.createElement("canvas");
    state.workingImage.width = state.baseW;
    state.workingImage.height = state.baseH;
    state.workingImage.getContext("2d").drawImage(state.originalImage, 0, 0, state.baseW, state.baseH);
    state.selection = null;
    if (window.resetViewTransform) window.resetViewTransform();
    adjust.brightness = 1; adjust.contrast = 1; adjust.saturate = 1;
    adjBrightness.value = "1"; adjContrast.value = "1"; adjSaturate.value = "1";
    drawScaled(); syncInputs();
    scheduleSessionSave();
  });

  /* ---------- 裁剪与画布手势在 js/crop.js（选区/键盘/捏合） ---------- */

  /* ---------- 尺寸 / 预设 ---------- */
  var PRESETS = [
    { n: "自定义", w: 0, h: 0 },
    { n: "头像 400×400", w: 400, h: 400 },
    { n: "一寸证件照 295×413", w: 295, h: 413 },
    { n: "二寸证件照 413×579", w: 413, h: 579 },
    { n: "公众号封面 900×383", w: 900, h: 383 },
    { n: "小红书 1080×1440", w: 1080, h: 1440 },
    { n: "HD 1280×720", w: 1280, h: 720 },
    { n: "FHD 1920×1080", w: 1920, h: 1080 }
  ];
  PRESETS.forEach(function (p, i) {
    var opt = document.createElement("option");
    opt.value = String(i); opt.textContent = p.n;
    presetSelect.appendChild(opt);
  });
  presetSelect.addEventListener("change", function () {
    var p = PRESETS[parseInt(presetSelect.value, 10)];
    if (p && p.w > 0) {
      widthInput.value = p.w; heightInput.value = p.h;
      lockRatio.checked = false;
    }
  });
  function syncLock(changed) {
    if (!state.workingImage || !lockRatio.checked) return;
    var w = parseInt(widthInput.value, 10), h = parseInt(heightInput.value, 10);
    var ar = state.workingImage.width / state.workingImage.height;
    if (changed === "w" && w > 0) heightInput.value = Math.round(w / ar);
    else if (changed === "h" && h > 0) widthInput.value = Math.round(h * ar);
  }
  widthInput.addEventListener("input", function () { syncLock("w"); presetSelect.value = "0"; });
  heightInput.addEventListener("input", function () { syncLock("h"); presetSelect.value = "0"; });
  /* 统一的缩放实现：单图"应用"与批量共用 */
  function resizeCanvas(src, w, h, mode) {
    var next = document.createElement("canvas");
    next.width = w; next.height = h;
    var nc = next.getContext("2d");
    nc.imageSmoothingEnabled = true;
    nc.imageSmoothingQuality = "high";
    /* 目标长宽比与图片不一致时：默认等比缩放（裁剪填满 / 留白适应），只有选"拉伸"才变形 */
    if (mode === "stretch") {
      nc.drawImage(src, 0, 0, src.width, src.height, 0, 0, w, h);
    } else {
      var scale = mode === "contain"
        ? Math.min(w / src.width, h / src.height)
        : Math.max(w / src.width, h / src.height);
      var dw = src.width * scale, dh = src.height * scale;
      nc.drawImage(src, (w - dw) / 2, (h - dh) / 2, dw, dh);
    }
    return next;
  }
  applyResize.addEventListener("click", function () {
    if (!state.workingImage) return;
    var w = parseInt(widthInput.value, 10), h = parseInt(heightInput.value, 10);
    if (!(w > 0 && h > 0)) return;
    /* 图片已是目标尺寸时三种模式输出完全相同：提示先撤销，避免"换模式没效果"的困惑 */
    if (state.workingImage.width === w && state.workingImage.height === h) {
      alert("图片已经是 " + w + "×" + h + "。想换一种适应方式（裁剪填满 / 留白适应 / 拉伸变形），请先点「撤销」恢复，再选模式应用。");
      return;
    }
    pushHistory();
    state.workingImage = resizeCanvas(state.workingImage, w, h, fitMode.value);
    drawScaled(); syncInputs();
    scheduleSessionSave();
  });

  /* ---------- 水印在 js/watermark.js（参数/绘制/图片源），此处仅导出烘焙 ---------- */
  function applyWatermark(cv) {
    if (!wmActive()) return cv;
    var out = document.createElement("canvas");
    out.width = cv.width; out.height = cv.height;
    var c = out.getContext("2d");
    c.drawImage(cv, 0, 0);
    paintWatermark(c, cv.width, cv.height);
    return out;
  }

  /* ---------- 调整（亮度/对比度/饱和度，非破坏式，导出时烘焙） ---------- */
  var adjust = { brightness: 1, contrast: 1, saturate: 1 };
  function isAdjustDefault() {
    return adjust.brightness === 1 && adjust.contrast === 1 && adjust.saturate === 1;
  }
  function adjustFilter() {
    return "brightness(" + adjust.brightness + ") contrast(" + adjust.contrast + ") saturate(" + adjust.saturate + ")";
  }
  function readAdjust() {
    adjust.brightness = parseFloat(adjBrightness.value) || 1;
    adjust.contrast = parseFloat(adjContrast.value) || 1;
    adjust.saturate = parseFloat(adjSaturate.value) || 1;
    drawScaled();
  }
  adjBrightness.addEventListener("input", readAdjust);
  adjContrast.addEventListener("input", readAdjust);
  adjSaturate.addEventListener("input", readAdjust);
  adjReset.addEventListener("click", function () {
    adjBrightness.value = "1"; adjContrast.value = "1"; adjSaturate.value = "1";
    readAdjust();
  });

  /* ---------- 证件照：换底色 + 六寸排版 ---------- */
  /* 四角取色探测背景色：证件照背景基本为纯色 */
  function detectBgColor(cv) {
    var c = cv.getContext("2d");
    var w = cv.width, h = cv.height, p = 8;
    var pts = [[0, 0], [w - p, 0], [0, h - p], [w - p, h - p]];
    var r = 0, g = 0, b = 0, n = 0;
    for (var i = 0; i < pts.length; i++) {
      var d = c.getImageData(Math.max(0, pts[i][0]), Math.max(0, pts[i][1]), p, p).data;
      for (var j = 0; j < d.length; j += 4) { r += d[j]; g += d[j + 1]; b += d[j + 2]; n++; }
    }
    n = n || 1;
    return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
  }
  function hexToRgb(s) {
    var m = /^#?([0-9a-f]{6})$/i.exec(s || "");
    if (!m) return { r: 255, g: 255, b: 255 };
    var v = parseInt(m[1], 16);
    return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
  }
  function applyBgReplace() {
    if (!state.workingImage) return;
    pushHistory();
    var w = state.workingImage.width, h = state.workingImage.height;
    var out = document.createElement("canvas");
    out.width = w; out.height = h;
    var c = out.getContext("2d");
    c.drawImage(state.workingImage, 0, 0);
    var frame = c.getImageData(0, 0, w, h);
    var d = frame.data;
    var orig = hexToRgb(idOrig.value), neu = hexToRgb(idNew.value);
    var tol = parseFloat(idTol.value) || 45;
    var soft = tol * 0.55;                 /* 边缘过渡带，smoothstep 混合消硬边 */
    for (var i = 0; i < d.length; i += 4) {
      var dr = d[i] - orig.r, dg = d[i + 1] - orig.g, db = d[i + 2] - orig.b;
      var dist = Math.sqrt(dr * dr + dg * dg + db * db);
      if (dist <= tol) {
        d[i] = neu.r; d[i + 1] = neu.g; d[i + 2] = neu.b;
      } else if (dist <= tol + soft) {
        var f = (dist - tol) / soft;
        var keep = f * f * (3 - 2 * f);
        d[i]     = Math.round(neu.r * (1 - keep) + d[i] * keep);
        d[i + 1] = Math.round(neu.g * (1 - keep) + d[i + 1] * keep);
        d[i + 2] = Math.round(neu.b * (1 - keep) + d[i + 2] * keep);
      }
    }
    c.putImageData(frame, 0, 0);
    state.workingImage = out;
    drawScaled(); syncInputs();
    scheduleSessionSave();
  }
  applyBg.addEventListener("click", applyBgReplace);
  /* 预设底色色板 */
  document.querySelectorAll("#stripId .swatch").forEach(function (btn) {
    btn.addEventListener("click", function () {
      idNew.value = btn.getAttribute("data-c");
    });
  });
  /* 六寸相纸(4×6" @300dpi)打印排版：自动计算行列，居中分布，方便裁切 */
  function generateLayout() {
    if (!state.workingImage) { alert("请先上传图片"); return; }
    var PAPER_W = 1800, PAPER_H = 1200, GAP = 24;
    var src = buildExportCanvas(state.workingImage);
    var cols = Math.floor((PAPER_W + GAP) / (src.width + GAP));
    var rows = Math.floor((PAPER_H + GAP) / (src.height + GAP));
    if (cols < 1 || rows < 1) { alert("照片大于六寸相纸，无法排版"); return; }
    var out = document.createElement("canvas");
    out.width = PAPER_W; out.height = PAPER_H;
    var c = out.getContext("2d");
    c.fillStyle = "#ffffff";
    c.fillRect(0, 0, PAPER_W, PAPER_H);
    var gridW = cols * src.width + (cols - 1) * GAP;
    var gridH = rows * src.height + (rows - 1) * GAP;
    var ox = (PAPER_W - gridW) / 2, oy = (PAPER_H - gridH) / 2;
    for (var r = 0; r < rows; r++) {
      for (var col = 0; col < cols; col++) {
        c.drawImage(src, ox + col * (src.width + GAP), oy + r * (src.height + GAP));
      }
    }
    out.toBlob(function (b) {
      if (!b) { alert("排版导出失败"); return; }
      var name = (fileNameInput.value || "output").replace(/[\\/:*?"<>|]+/g, "").trim() || "output";
      triggerNamed(b, "jpg", name + "-排版");
    }, "image/jpeg", 0.92);
  }
  genLayout.addEventListener("click", generateLayout);

  /* ---------- 装饰：圆角 / 边框 ---------- */
  function roundedRectPath(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  function applyDecoFn() {
    if (!state.workingImage) return;
    var rPct = parseFloat(decoRadius.value) || 0;
    var bw = Math.round(parseFloat(decoBorder.value)) || 0;
    if (rPct <= 0 && bw <= 0) { alert("圆角和边框都是 0，无需应用"); return; }
    pushHistory();
    /* 先扩边框，再整体切圆角：圆角作用于含边框的外轮廓 */
    var src = state.workingImage;
    var base = document.createElement("canvas");
    base.width = src.width + bw * 2; base.height = src.height + bw * 2;
    var bc = base.getContext("2d");
    if (bw > 0) {
      bc.fillStyle = decoColor.value || "#ffffff";
      bc.fillRect(0, 0, base.width, base.height);
    }
    bc.drawImage(src, bw, bw);
    var out = base;
    if (rPct > 0) {
      out = document.createElement("canvas");
      out.width = base.width; out.height = base.height;
      var oc = out.getContext("2d");
      oc.save();
      roundedRectPath(oc, 0, 0, out.width, out.height, Math.min(base.width, base.height) * rPct / 100);
      oc.clip();
      oc.drawImage(base, 0, 0);
      oc.restore();
    }
    state.workingImage = out;
    drawScaled(); syncInputs();
    scheduleSessionSave();
  }
  applyDecoBtn.addEventListener("click", applyDecoFn);

  /* ---------- 导出 ---------- */
  function uiFormatChange() {
    var v = formatSelect.value;
    jpgOnlyRow.classList.toggle("hidden", !(v === "jpg" || v === "webp"));
    /* 目标体积只对有损格式（PNG 走自动转 JPG）生效：PDF/BMP/ICO 选中时禁用输入，避免静默失效 */
    var kbApplies = (v === "jpg" || v === "webp" || v === "png");
    targetKB.disabled = !kbApplies;
    targetKB.placeholder = kbApplies ? "不限" : "不可用";
    if (!kbApplies) targetKB.value = "";
  }
  formatSelect.addEventListener("change", uiFormatChange);
  function applyQualityLabel() { qualityValue.textContent = Number(qualityRange.value).toFixed(2); }
  qualityRange.addEventListener("input", applyQualityLabel);

  function rotatedCanvas(src, angle) {
    var a = ((angle % 360) + 360) % 360;
    var isV = Math.abs(a % 180) === 90;
    var w = isV ? src.height : src.width;
    var h = isV ? src.width : src.height;
    var cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    var c = cv.getContext("2d");
    c.translate(w / 2, h / 2);
    c.rotate(a * Math.PI / 180);
    c.drawImage(src, -src.width / 2, -src.height / 2);
    return cv;
  }
  /* 调整烘焙：把滤镜参数写进实际像素（导出用，预览走 ctx.filter） */
  function applyAdjust(src) {
    if (isAdjustDefault()) return src;
    var out = document.createElement("canvas");
    out.width = src.width; out.height = src.height;
    var c = out.getContext("2d");
    c.filter = adjustFilter();
    c.drawImage(src, 0, 0);
    c.filter = "none";
    return out;
  }
  /* 镜像烘焙：fx/fy 为 -1 表示该轴翻转 */
  function flippedCanvas(cv, fx, fy) {
    if (fx === 1 && fy === 1) return cv;
    var out = document.createElement("canvas");
    out.width = cv.width; out.height = cv.height;
    var c = out.getContext("2d");
    c.translate(fx === -1 ? cv.width : 0, fy === -1 ? cv.height : 0);
    c.scale(fx, fy);
    c.drawImage(cv, 0, 0);
    return out;
  }
  /* PDF / BMP / ICO / 目标体积编码在 js/exporters.js（纯画布→Blob，无状态） */
  function triggerNamed(blob, ext, baseName) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = baseName + "." + ext;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }
  function trigger(blob, ext) {
    var name = (fileNameInput.value || "output").replace(/[\\/:*?"<>|]+/g, "").trim() || "output";
    triggerNamed(blob, ext, name);
  }
  function toBlob(cv, mime, q) {
    return new Promise(function (res) { cv.toBlob(res, mime, q); });
  }

  /* 组装导出画布：调整烘焙 → 旋转 → 镜像 → 水印（单图与批量共用） */
  function buildExportCanvas(src) {
    var flip = window.__pcFlip || { x: 1, y: 1 };
    return applyWatermark(flippedCanvas(rotatedCanvas(applyAdjust(src), window.currentRotation || 0), flip.x, flip.y));
  }
  /* 渲染回归测试钩子：固定操作序列的导出管线输出可被断言 */
  window.__pcBuildExportCanvas = buildExportCanvas;
  /* 按导出条设置编码；quiet=批量时不弹格式回退提示 */
  async function encodeCanvas(cv, quiet) {
    var fmt = formatSelect.value;
    var ext = fmt;
    var mime = fmt === "png" ? "image/png" : fmt === "webp" ? "image/webp" : "image/jpeg";
    var kb = parseFloat(targetKB.value) || 0;
    var q = Math.max(0.1, Math.min(1, Number(qualityRange.value) || 0.92));
    if (fmt === "pdf") {
      await loadJsPdf();
      cv = flattenForExport(cv);
      var dataUrl = cv.toDataURL("image/jpeg", 0.92);
      var pdf = new window.jspdf.jsPDF({ unit: "pt", format: "a4" });
      var pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
      var r = Math.min(pw / cv.width, ph / cv.height);
      pdf.addImage(dataUrl, "JPEG", (pw - cv.width * r) / 2, (ph - cv.height * r) / 2,
        cv.width * r, cv.height * r, "", "FAST");
      return { blob: pdf.output("blob"), ext: "pdf" };
    }
    if (fmt === "bmp") return { blob: bmpBlob(cv), ext: "bmp" };
    if (fmt === "ico") return { blob: await icoBlob(cv), ext: "ico" };
    if (kb > 0 && fmt === "png") {
      if (!quiet) alert("PNG 为无损格式，无法按体积压缩；已自动改用 JPG 压缩。");
      fmt = "jpg"; mime = "image/jpeg"; ext = "jpg";
    }
    if (fmt === "webp" && !CAN_WEBP) {
      if (!quiet) alert("当前浏览器不支持导出 WebP，已自动改用 JPG。");
      fmt = "jpg"; mime = "image/jpeg"; ext = "jpg";
    }
    if (fmt === "jpg") cv = flattenForExport(cv);
    var blob = kb > 0 ? await blobUnderKB(cv, mime, kb) : await toBlob(cv, mime, q);
    return { blob: blob, ext: ext };
  }

  /* ---------- 批量处理 ---------- */
  function loadBatch(files) {
    var all = Array.from(files);
    /* 批量上限 30：超出部分明确告知，不静默丢弃 */
    if (all.length > 30) alert("一次最多批量处理 30 张，已只取前 30 张（本次共选 " + all.length + " 张）");
    state.batchFiles = all.slice(0, 30);
    renderBatchList();
    batchPanel.classList.remove("hidden");
    /* 预览第一张：水印等效果照常实时可见 */
    decodeFile(state.batchFiles[0], null);
  }
  function renderBatchList() {
    batchList.innerHTML = "";
    batchCount.textContent = "已选 " + state.batchFiles.length + " 张";
    state.batchFiles.forEach(function (f, i) {
      var li = document.createElement("li");
      var nm = document.createElement("span");
      nm.textContent = (i + 1) + ". " + (f.name || "image");
      var st = document.createElement("span");
      st.className = "batch-status";
      st.textContent = "等待";
      li.appendChild(nm); li.appendChild(st);
      batchList.appendChild(li);
    });
  }
  function decodeToCanvas(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
        var cv = document.createElement("canvas");
        cv.width = Math.max(1, Math.round(img.naturalWidth * scale));
        cv.height = Math.max(1, Math.round(img.naturalHeight * scale));
        var c = cv.getContext("2d");
        c.imageSmoothingEnabled = true;
        c.imageSmoothingQuality = "high";
        c.drawImage(img, 0, 0, cv.width, cv.height);
        resolve(cv);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("解码失败：" + (file.name || "图片")));
      };
      img.src = url;
    });
  }
  async function exportBatch() {
    var n = state.batchFiles.length;
    var resizeOn = batchResize.checked;
    var tw = parseInt(widthInput.value, 10), th = parseInt(heightInput.value, 10);
    for (var i = 0; i < n; i++) {
      var st = batchList.children[i] && batchList.children[i].querySelector(".batch-status");
      try {
        var cv = await decodeToCanvas(state.batchFiles[i]);
        if (resizeOn && tw > 0 && th > 0 && (cv.width !== tw || cv.height !== th)) {
          cv = resizeCanvas(cv, tw, th, fitMode.value);
        }
        var res = await encodeCanvas(buildExportCanvas(cv), true);
        if (!res.blob) throw new Error("编码失败");
        var base = (state.batchFiles[i].name || "image").replace(/\.[^.]+$/, "");
        triggerNamed(res.blob, res.ext, base);
        if (st) st.textContent = "✓ " + Math.max(1, Math.round(res.blob.size / 1024)) + " KB";
      } catch (err) {
        if (st) st.textContent = "✗ " + ((err && err.message) || "失败");
      }
    }
  }
  batchClear.addEventListener("click", function () {
    state.batchFiles = [];
    batchPanel.classList.add("hidden");
    batchList.innerHTML = "";
  });

  downloadBtn.addEventListener("click", async function () {
    if (state.batchFiles.length > 1) { await exportBatch(); return; }
    if (!state.workingImage) { alert("请先上传并转换一张图片"); return; }
    try {
      var res = await encodeCanvas(buildExportCanvas(state.workingImage), false);
      if (res.blob) trigger(res.blob, res.ext);
    } catch (err) {
      alert("导出失败：" + err.message);
    }
  });

  /* ---------- 初始化 ---------- */
  uiFormatChange();
  applyQualityLabel();
  /* 老浏览器（如 iOS 17 及更早的 Safari）不支持 ctx.filter 时隐藏调整入口 */
  if (typeof ctx.filter !== "string" || !ctx.filter) toolAdjust.classList.add("hidden");
  /* WebP 编码能力探测（Safari 部分版本不支持 toBlob('image/webp')，会静默输出 PNG） */
  var CAN_WEBP = (function () {
    try {
      var p = document.createElement("canvas");
      p.width = 1; p.height = 1;
      return p.toDataURL("image/webp").indexOf("data:image/webp") === 0;
    } catch (_) { return false; }
  })();
  /* 模块初始化：水印监听 + 裁剪/手势（回调注入，模块不反向依赖本文件） */
  initWatermark(drawScaled);
  initCrop({
    canvas: canvas,
    stripAspect: stripAspect,
    cropApply: cropApply,
    redraw: drawScaled,
    pushHistory: pushHistory,
    onEdited: function () { syncInputs(); scheduleSessionSave(); }
  });

  /* ---------- 会话恢复（IndexedDB）：刷新/误关不丢正在编辑的图 ----------
     存储读写在 js/session.js；过期判断（7 天）在此处 */
  var SESSION_MAX_AGE = 7 * 24 * 3600 * 1000;
  var saveTimer = 0;
  function collectMeta() {
    return {
      fileName: fileNameInput.value,
      wmEnable: wmEnable.checked, wmText: wmText.value, wmPos: wmPos.value,
      wmOpacity: wmOpacity.value, wmType: wmType.value, wmMode: wmMode.value, wmScale: wmScale.value,
      adjB: adjBrightness.value, adjC: adjContrast.value, adjS: adjSaturate.value
    };
  }
  /* 视图变换一并入快照：恢复后旋转/镜像不丢 */
  function collectView() {
    return {
      r: window.currentRotation || 0,
      fx: (window.__pcFlip || { x: 1 }).x,
      fy: (window.__pcFlip || { y: 1 }).y
    };
  }
  function applyViewTransform(v) {
    if (!v) return;
    if (window.resetViewTransform) window.resetViewTransform();
    if (v.r && window.rotateImage) window.rotateImage(v.r);
    if (v.fx === -1 && window.toggleFlip) window.toggleFlip("x");
    if (v.fy === -1 && window.toggleFlip) window.toggleFlip("y");
  }
  function applyMeta(m) {
    fileNameInput.value = m.fileName || "";
    wmEnable.checked = !!m.wmEnable;
    wmText.value = m.wmText || "";
    wmPos.value = m.wmPos || "br";
    wmOpacity.value = m.wmOpacity || "0.5";
    wmType.value = m.wmType || "text";
    wmMode.value = m.wmMode || "single";
    wmScale.value = m.wmScale || "15";
    adjBrightness.value = m.adjB || "1";
    adjContrast.value = m.adjC || "1";
    adjSaturate.value = m.adjS || "1";
    adjust.brightness = parseFloat(adjBrightness.value) || 1;
    adjust.contrast = parseFloat(adjContrast.value) || 1;
    adjust.saturate = parseFloat(adjSaturate.value) || 1;
  }
  /* 位图落库（防抖）：改动停止 0.8s 后写快照。
     超 12MP 的大图改用 JPEG 0.85——PNG 编码在主线程要数百毫秒，滑杆会卡；
     恢复路径本来就走 decodeToCanvas，格式无感知 */
  function scheduleSessionSave() {
    if (!state.workingImage) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      var big = state.workingImage.width * state.workingImage.height > 12 * 1024 * 1024;
      state.workingImage.toBlob(function (b) {
        if (b) sessionPut({ blob: b, meta: collectMeta(), view: collectView(), ts: Date.now() });
      }, big ? "image/jpeg" : "image/png", big ? 0.85 : undefined);
    }, 800);
  }
  function initRestore() {
    sessionGet().then(function (rec) {
      if (!rec || !rec.blob || !rec.ts || Date.now() - rec.ts > SESSION_MAX_AGE) {
        if (rec) sessionClear();
        return;
      }
      restoreBar.classList.remove("hidden");
      restoreYes.addEventListener("click", function () {
        restoreBar.classList.add("hidden");
        decodeToCanvas(rec.blob).then(function (cv) {
          state.baseW = cv.width; state.baseH = cv.height;
          state.originalImage = cv;
          state.workingImage = cv;
          state.history.length = 0; state.historyBytes = 0;
          toolUndo.disabled = true;
          state.selection = null;
          window.__pcHasImage = true;
          showTools();
          applyMeta(rec.meta || {});
          applyViewTransform(rec.view);
          drawScaled(); syncInputs();
        }).catch(function () {
          sessionClear();
          alert("恢复失败，已丢弃上次会话");
        });
      });
      restoreNo.addEventListener("click", function () {
        restoreBar.classList.add("hidden");
        sessionClear();
      });
    });
  }
  /* 注意：必须在 SESSION_* 变量赋值之后调用（var 无暂时性死区，提前调用会打开名为 undefined 的库） */
  initRestore();

  /* 窗口尺寸 / 手机横竖屏变化后按新容器重新适配画布 */
  var resizeRaf = 0;
  window.addEventListener("resize", function () {
    if (resizeRaf) cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(function () {
      resizeRaf = 0;
      if (state.workingImage) drawScaled();
    });
  });
})();
