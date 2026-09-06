/* ============================================================
   PhotoChange — 核心逻辑 v2
   三段式工作流：顶部工具条(裁剪/尺寸/水印/撤销/重置)
   + 画布 + 底部导出条(格式/质量/目标体积/文件名/导出)
   ============================================================ */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- 元素 ---------- */
  var fileInput = $("fileInput"), dropzone = $("dropzone");
  var canvas = $("canvas"), ctx = canvas.getContext("2d");
  var toolCrop = $("toolCrop"), toolSize = $("toolSize"), toolWm = $("toolWm"), toolAdjust = $("toolAdjust");
  var toolUndo = $("toolUndo"), toolReset = $("toolReset");
  var stripCrop = $("stripCrop"), stripSize = $("stripSize"), stripWm = $("stripWm"), stripAdjust = $("stripAdjust");
  var adjBrightness = $("adjBrightness"), adjContrast = $("adjContrast"), adjSaturate = $("adjSaturate"), adjReset = $("adjReset");
  var stripAspect = $("stripAspect"), cropApply = $("cropApply");
  var widthInput = $("widthInput"), heightInput = $("heightInput");
  var presetSelect = $("presetSelect"), lockRatio = $("lockRatio"), applyResize = $("applyResize");
  var wmEnable = $("wmEnable"), wmText = $("wmText"), wmPos = $("wmPos"), wmOpacity = $("wmOpacity");
  var formatSelect = $("formatSelect"), jpgOnlyRow = $("jpgOnlyRow");
  var qualityRange = $("qualityRange"), qualityValue = $("qualityValue");
  var targetKB = $("targetKB"), fileNameInput = $("fileName"), downloadBtn = $("downloadBtn");

  /* ---------- 状态 ---------- */
  var originalImage = null, workingImage = null;
  var selection = null, dragging = false;
  var history = [];
  /* 触屏设备撤销步数收紧：多份全尺寸位图易撑爆移动端内存 */
  var HISTORY_MAX = (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) ? 8 : 20;
  /* 加载上限：最长边超过则等比缩小，避免移动端画布超限 */
  var MAX_SIDE = 4096;
  var baseW = 0, baseH = 0;

  /* ---------- 工具函数 ---------- */
  function setCanvasSize(w, h) { canvas.width = w; canvas.height = h; }
  function fitToBox(nw, nh, maxW, maxH) {
    var r = Math.min(maxW / nw, maxH / nh, 1);
    return { w: Math.max(1, Math.round(nw * r)), h: Math.max(1, Math.round(nh * r)), r: r };
  }
  function drawScaled() {
    if (!workingImage) return;
    var fit = fitToBox(workingImage.width, workingImage.height,
      canvas.parentElement.clientWidth - 20, canvas.parentElement.clientHeight - 20);
    setCanvasSize(fit.w, fit.h);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.filter = isAdjustDefault() ? "none" : adjustFilter();
    ctx.drawImage(workingImage, 0, 0, canvas.width, canvas.height);
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
    drawSelection();
  }
  function syncInputs() {
    if (!workingImage) return;
    widthInput.value = workingImage.width;
    heightInput.value = workingImage.height;
  }

  /* ---------- 历史（撤销） ---------- */
  function pushHistory() {
    if (!workingImage) return;
    var c = document.createElement("canvas");
    c.width = workingImage.width; c.height = workingImage.height;
    c.getContext("2d").drawImage(workingImage, 0, 0);
    history.push(c);
    if (history.length > HISTORY_MAX) history.shift();
    toolUndo.disabled = false;
  }
  function undo() {
    var c = history.pop();
    if (!c) return;
    workingImage = c;
    selection = null;
    drawScaled(); syncInputs();
    toolUndo.disabled = history.length === 0;
  }

  /* ---------- 选区绘制（evenodd 镂空遮罩） ---------- */
  function normRect(s) {
    return {
      x: Math.min(s.x, s.x + s.w), y: Math.min(s.y, s.y + s.h),
      w: Math.abs(s.w), h: Math.abs(s.h)
    };
  }
  function drawSelection() {
    if (!selection) return;
    var r = normRect(selection);
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
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js";
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error("HEIC 解码库加载失败，请检查网络后重试")); };
      document.head.appendChild(s);
    });
  }
  function decodeFile(file, nameOverride) {
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url);
      var scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
      baseW = Math.max(1, Math.round(img.naturalWidth * scale));
      baseH = Math.max(1, Math.round(img.naturalHeight * scale));
      originalImage = img;
      workingImage = document.createElement("canvas");
      workingImage.width = baseW;
      workingImage.height = baseH;
      workingImage.getContext("2d").drawImage(img, 0, 0, baseW, baseH);
      history.length = 0;
      toolUndo.disabled = true;
      selection = null;
      document.body.classList.add("has-image");
      var tools = $("image-tools");
      if (tools) tools.style.display = "flex";
      drawScaled(); syncInputs();
      fileNameInput.value = (nameOverride || file.name || "output").replace(/\.[^.]+$/, "");
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
    var f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) loadImage(f);
  });
  fileInput.addEventListener("change", function (e) {
    var f = e.target.files && e.target.files[0];
    if (f) loadImage(f);
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
    [stripCrop, stripSize, stripWm, stripAdjust].forEach(function (s) { s.classList.add("hidden"); });
    [toolCrop, toolSize, toolWm, toolAdjust].forEach(function (b) { b.classList.remove("active"); });
    if (!isOpen) {
      strip.classList.remove("hidden");
      btn.classList.add("active");
    }
  }
  toolCrop.addEventListener("click", function () { toggleStrip(stripCrop, toolCrop); });
  toolSize.addEventListener("click", function () { toggleStrip(stripSize, toolSize); });
  toolWm.addEventListener("click", function () { toggleStrip(stripWm, toolWm); });
  toolAdjust.addEventListener("click", function () { toggleStrip(stripAdjust, toolAdjust); });
  toolUndo.addEventListener("click", undo);
  toolReset.addEventListener("click", function () {
    if (!originalImage) return;
    pushHistory();
    workingImage = document.createElement("canvas");
    workingImage.width = baseW;
    workingImage.height = baseH;
    workingImage.getContext("2d").drawImage(originalImage, 0, 0, baseW, baseH);
    selection = null;
    if (window.resetViewTransform) window.resetViewTransform();
    adjust.brightness = 1; adjust.contrast = 1; adjust.saturate = 1;
    adjBrightness.value = "1"; adjContrast.value = "1"; adjSaturate.value = "1";
    drawScaled(); syncInputs();
  });

  /* ---------- 裁剪（Pointer Events：鼠标 / 触摸 / 触控笔通用） ---------- */
  function canvasPoint(evt) {
    // 画布被 CSS 缩放/旋转过：以布局中心做逆变换，映射回位图坐标
    var wrap = canvas.parentElement.getBoundingClientRect();
    var cx = wrap.left + wrap.width / 2, cy = wrap.top + wrap.height / 2;
    var z = window.__pcZoom || 1;
    var a = ((window.currentRotation || 0) % 360) * Math.PI / 180;
    var dx = evt.clientX - cx, dy = evt.clientY - cy;
    var cos = Math.cos(-a), sin = Math.sin(-a);
    var flip = window.__pcFlip || { x: 1, y: 1 };
    return {
      x: ((dx * cos - dy * sin) / z) * flip.x + canvas.width / 2,
      y: ((dx * sin + dy * cos) / z) * flip.y + canvas.height / 2
    };
  }
  canvas.addEventListener("pointerdown", function (e) {
    if (!workingImage || !e.isPrimary) return;
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    dragging = true;
    selection = { x: canvasPoint(e).x, y: canvasPoint(e).y, w: 0, h: 0 };
  });
  canvas.addEventListener("pointermove", function (e) {
    if (!dragging || !selection || !e.isPrimary) return;
    var p = canvasPoint(e);
    var ax = p.x - selection.x, ay = p.y - selection.y;
    var mode = stripAspect.value;
    if (mode !== "free") {
      var parts = mode.split(":");
      var ar = parseFloat(parts[0]) / parseFloat(parts[1]);
      if (Math.abs(ax) >= Math.abs(ay)) ay = Math.sign(ay || 1) * Math.abs(ax) / ar;
      else ax = Math.sign(ax || 1) * Math.abs(ay) * ar;
    }
    selection.w = ax; selection.h = ay;
    drawScaled();
  });
  function endDrag(e) { if (!e || e.isPrimary) dragging = false; }
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", function () { dragging = false; });
  window.addEventListener("pointerup", endDrag);
  cropApply.addEventListener("click", function () {
    if (!selection || !workingImage) return;
    var r = normRect(selection);
    var sx = r.x * (workingImage.width / canvas.width);
    var sy = r.y * (workingImage.height / canvas.height);
    var sw = r.w * (workingImage.width / canvas.width);
    var sh = r.h * (workingImage.height / canvas.height);
    if (sw < 2 || sh < 2) return;
    pushHistory();
    var next = document.createElement("canvas");
    next.width = Math.round(sw); next.height = Math.round(sh);
    next.getContext("2d").drawImage(workingImage, sx, sy, sw, sh, 0, 0, next.width, next.height);
    workingImage = next;
    selection = null;
    drawScaled(); syncInputs();
  });

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
    if (!workingImage || !lockRatio.checked) return;
    var w = parseInt(widthInput.value, 10), h = parseInt(heightInput.value, 10);
    var ar = workingImage.width / workingImage.height;
    if (changed === "w" && w > 0) heightInput.value = Math.round(w / ar);
    else if (changed === "h" && h > 0) widthInput.value = Math.round(h * ar);
  }
  widthInput.addEventListener("input", function () { syncLock("w"); presetSelect.value = "0"; });
  heightInput.addEventListener("input", function () { syncLock("h"); presetSelect.value = "0"; });
  applyResize.addEventListener("click", function () {
    if (!workingImage) return;
    var w = parseInt(widthInput.value, 10), h = parseInt(heightInput.value, 10);
    if (!(w > 0 && h > 0)) return;
    pushHistory();
    var next = document.createElement("canvas");
    next.width = w; next.height = h;
    var nc = next.getContext("2d");
    nc.imageSmoothingEnabled = true;
    nc.imageSmoothingQuality = "high";
    nc.drawImage(workingImage, 0, 0, workingImage.width, workingImage.height, 0, 0, w, h);
    workingImage = next;
    drawScaled(); syncInputs();
  });

  /* ---------- 水印 ---------- */
  /* 水印绘制核心：预览与导出共用，字号按画布短边比例计算，保证两端观感一致 */
  function paintWatermark(c, w, h) {
    var text = wmText.value.trim();
    if (!wmEnable.checked || !text) return;
    var fs = Math.max(14, Math.round(Math.min(w, h) * 0.055));
    c.font = "600 " + fs + "px Inter,system-ui,'PingFang SC','Microsoft YaHei',sans-serif";
    var tw = c.measureText(text).width, th = fs;
    var pad = Math.round(fs * 0.6);
    var pos = wmPos.value;
    var x = pos.indexOf("l") > -1 ? pad : pos.indexOf("r") > -1 ? w - tw - pad : (w - tw) / 2;
    var y = pos.charAt(0) === "t" ? pad + th / 2 : pos.charAt(0) === "b" ? h - pad - th / 2 : h / 2;
    c.save();
    c.globalAlpha = parseFloat(wmOpacity.value);
    c.fillStyle = "#ffffff";
    c.shadowColor = "rgba(0,0,0,.55)";
    c.shadowBlur = fs * 0.18;
    c.textBaseline = "middle";
    c.fillText(text, x, y);
    c.restore();
  }
  function applyWatermark(cv) {
    if (!wmEnable.checked || !wmText.value.trim()) return cv;
    var out = document.createElement("canvas");
    out.width = cv.width; out.height = cv.height;
    var c = out.getContext("2d");
    c.drawImage(cv, 0, 0);
    paintWatermark(c, cv.width, cv.height);
    return out;
  }
  /* 水印参数变动时实时重绘画布预览 */
  wmEnable.addEventListener("change", drawScaled);
  wmText.addEventListener("input", drawScaled);
  wmPos.addEventListener("change", drawScaled);
  wmOpacity.addEventListener("input", drawScaled);

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

  /* ---------- 导出 ---------- */
  function uiFormatChange() {
    var v = formatSelect.value;
    jpgOnlyRow.classList.toggle("hidden", !(v === "jpg" || v === "webp"));
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
  function trigger(blob, ext) {
    var name = (fileNameInput.value || "output").replace(/[\\/:*?"<>|]+/g, "").trim() || "output";
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = name + "." + ext;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }
  function toBlob(cv, mime, q) {
    return new Promise(function (res) { cv.toBlob(res, mime, q); });
  }
  /* BMP（24 位无压缩）：透明区按白底合成，行尾按 4 字节对齐 */
  function bmpBlob(cv) {
    var w = cv.width, h = cv.height;
    var img = cv.getContext("2d").getImageData(0, 0, w, h).data;
    var rowSize = Math.floor((24 * w + 31) / 32) * 4;
    var pixSize = rowSize * h;
    var fileSize = 54 + pixSize;
    var buf = new ArrayBuffer(fileSize);
    var view = new DataView(buf);
    var u8 = new Uint8Array(buf);
    u8[0] = 0x42; u8[1] = 0x4D;                       /* "BM" */
    view.setUint32(2, fileSize, true);
    view.setUint32(10, 54, true);                     /* 像素数据偏移 */
    view.setUint32(14, 40, true);                     /* BITMAPINFOHEADER */
    view.setInt32(18, w, true);
    view.setInt32(22, -h, true);                      /* 负高度 = 自上而下存储 */
    view.setUint16(26, 1, true);                      /* 位面数 */
    view.setUint16(28, 24, true);                     /* 24 bpp */
    view.setUint32(34, pixSize, true);
    view.setUint32(38, 2835, true); view.setUint32(42, 2835, true); /* 72 DPI */
    for (var y = 0; y < h; y++) {
      var row = 54 + y * rowSize;
      var src = y * w * 4;
      for (var x = 0; x < w; x++) {
        var i = src + x * 4;
        var a = img[i + 3] / 255, inv = 255 * (1 - a);
        u8[row + x * 3]     = Math.round(img[i + 2] * a + inv); /* B */
        u8[row + x * 3 + 1] = Math.round(img[i + 1] * a + inv); /* G */
        u8[row + x * 3 + 2] = Math.round(img[i]     * a + inv); /* R */
      }
    }
    return new Blob([buf], { type: "image/bmp" });
  }
  /* ICO（favicon）：16/32/48/64/128/256 多尺寸打包，PNG 压缩条目，非方形图居中裁方 */
  async function icoBlob(cv) {
    var max = Math.max(cv.width, cv.height);
    var sizes = [16, 32, 48, 64, 128, 256].filter(function (s) { return s <= max; });
    if (!sizes.length) sizes = [16];
    var entries = [];
    for (var i = 0; i < sizes.length; i++) {
      var s = sizes[i];
      var tmp = document.createElement("canvas");
      tmp.width = s; tmp.height = s;
      var c = tmp.getContext("2d");
      c.imageSmoothingEnabled = true;
      c.imageSmoothingQuality = "high";
      var scale = Math.max(s / cv.width, s / cv.height);
      var dw = cv.width * scale, dh = cv.height * scale;
      c.drawImage(cv, (s - dw) / 2, (s - dh) / 2, dw, dh);
      var png = await new Promise(function (res) { tmp.toBlob(res, "image/png"); });
      if (png) entries.push({ size: s, blob: png });
    }
    if (!entries.length) throw new Error("ICO 编码失败");
    var headSize = 6 + entries.length * 16;
    var buf = new ArrayBuffer(headSize);
    var view = new DataView(buf);
    view.setUint16(0, 0, true);
    view.setUint16(2, 1, true);                       /* 类型：图标 */
    view.setUint16(4, entries.length, true);
    var off = headSize;
    var parts = [];
    for (var k = 0; k < entries.length; k++) {
      var e = entries[k], base = 6 + k * 16;
      view.setUint8(base, e.size === 256 ? 0 : e.size);     /* 0 表示 256 */
      view.setUint8(base + 1, e.size === 256 ? 0 : e.size);
      view.setUint16(base + 4, 1, true);              /* 位面数 */
      view.setUint16(base + 6, 32, true);             /* 色深 */
      view.setUint32(base + 8, e.blob.size, true);
      view.setUint32(base + 12, off, true);
      parts.push(e.blob);
      off += e.blob.size;
    }
    return new Blob([buf].concat(parts), { type: "image/x-icon" });
  }
  /* 目标体积：二分搜索质量参数 */
  async function blobUnderKB(cv, mime, kb) {
    var limit = kb * 1024;
    var lo = 0.05, hi = 0.95, best = null;
    for (var i = 0; i < 9; i++) {
      var mid = (lo + hi) / 2;
      var b = await toBlob(cv, mime, mid);
      if (!b) break;
      if (b.size <= limit) { best = b; lo = mid; }
      else hi = mid;
    }
    if (!best) best = await toBlob(cv, mime, 0.05);
    return best;
  }
  /* JPG/PDF 不支持透明通道：导出前合成白底，避免透明区域变黑 */
  function flattenForExport(cv) {
    var out = document.createElement("canvas");
    out.width = cv.width; out.height = cv.height;
    var c = out.getContext("2d");
    c.fillStyle = "#ffffff";
    c.fillRect(0, 0, out.width, out.height);
    c.drawImage(cv, 0, 0);
    return out;
  }

  downloadBtn.addEventListener("click", async function () {
    if (!workingImage) { alert("请先上传并转换一张图片"); return; }
    var flip = window.__pcFlip || { x: 1, y: 1 };
    var cv = applyWatermark(flippedCanvas(rotatedCanvas(applyAdjust(workingImage), window.currentRotation || 0), flip.x, flip.y));
    var fmt = formatSelect.value;
    var kb = parseFloat(targetKB.value) || 0;
    try {
      if (fmt === "pdf") {
        cv = flattenForExport(cv);
        var dataUrl = cv.toDataURL("image/jpeg", 0.92);
        var pdf = new window.jspdf.jsPDF({ unit: "pt", format: "a4" });
        var pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
        var r = Math.min(pw / cv.width, ph / cv.height);
        pdf.addImage(dataUrl, "JPEG", (pw - cv.width * r) / 2, (ph - cv.height * r) / 2,
          cv.width * r, cv.height * r, "", "FAST");
        trigger(pdf.output("blob"), "pdf");
        return;
      }
      if (fmt === "bmp") {
        trigger(bmpBlob(cv), "bmp");
        return;
      }
      if (fmt === "ico") {
        trigger(await icoBlob(cv), "ico");
        return;
      }
      var mime = fmt === "png" ? "image/png" : fmt === "webp" ? "image/webp" : "image/jpeg";
      var ext = fmt;
      var q = Math.max(0.1, Math.min(1, Number(qualityRange.value) || 0.92));
      var blob;
      if (kb > 0 && fmt === "png") {
        alert("PNG 为无损格式，无法按体积压缩；已自动改用 JPG 压缩。");
        fmt = "jpg"; mime = "image/jpeg"; ext = "jpg";
      }
      if (fmt === "webp" && !CAN_WEBP) {
        alert("当前浏览器不支持导出 WebP，已自动改用 JPG。");
        fmt = "jpg"; mime = "image/jpeg"; ext = "jpg";
      }
      if (fmt === "jpg") cv = flattenForExport(cv);
      if (kb > 0) blob = await blobUnderKB(cv, mime, kb);
      else blob = await toBlob(cv, mime, q);
      if (blob) trigger(blob, ext);
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
  /* 供状态徽章复用编码器，BMP/ICO 选中时也能显示预估体积 */
  window.__pcEncoders = { bmp: bmpBlob, ico: icoBlob };

  /* 窗口尺寸 / 手机横竖屏变化后按新容器重新适配画布 */
  var resizeRaf = 0;
  window.addEventListener("resize", function () {
    if (resizeRaf) cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(function () {
      resizeRaf = 0;
      if (workingImage) drawScaled();
    });
  });
})();
