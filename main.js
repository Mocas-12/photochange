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
  var toolCrop = $("toolCrop"), toolSize = $("toolSize"), toolWm = $("toolWm");
  var toolUndo = $("toolUndo"), toolReset = $("toolReset");
  var stripCrop = $("stripCrop"), stripSize = $("stripSize"), stripWm = $("stripWm");
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
    ctx.drawImage(workingImage, 0, 0, canvas.width, canvas.height);
    paintWatermark(ctx, canvas.width, canvas.height);
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
    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
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
        fileNameInput.value = (file.name || "output").replace(/\.[^.]+$/, "");
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
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
    [stripCrop, stripSize, stripWm].forEach(function (s) { s.classList.add("hidden"); });
    [toolCrop, toolSize, toolWm].forEach(function (b) { b.classList.remove("active"); });
    if (!isOpen) {
      strip.classList.remove("hidden");
      btn.classList.add("active");
    }
  }
  toolCrop.addEventListener("click", function () { toggleStrip(stripCrop, toolCrop); });
  toolSize.addEventListener("click", function () { toggleStrip(stripSize, toolSize); });
  toolWm.addEventListener("click", function () { toggleStrip(stripWm, toolWm); });
  toolUndo.addEventListener("click", undo);
  toolReset.addEventListener("click", function () {
    if (!originalImage) return;
    pushHistory();
    workingImage = document.createElement("canvas");
    workingImage.width = baseW;
    workingImage.height = baseH;
    workingImage.getContext("2d").drawImage(originalImage, 0, 0, baseW, baseH);
    selection = null;
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
    return {
      x: (dx * cos - dy * sin) / z + canvas.width / 2,
      y: (dx * sin + dy * cos) / z + canvas.height / 2
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
    toggleStrip(stripCrop, toolCrop); // 用完收起
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
    toggleStrip(stripSize, toolSize); // 用完收起
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
    var cv = applyWatermark(rotatedCanvas(workingImage, window.currentRotation || 0));
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
      var mime = fmt === "png" ? "image/png" : fmt === "webp" ? "image/webp" : "image/jpeg";
      var ext = fmt;
      var q = Math.max(0.1, Math.min(1, Number(qualityRange.value) || 0.92));
      var blob;
      if (kb > 0 && fmt === "png") {
        alert("PNG 为无损格式，无法按体积压缩；已自动改用 JPG 压缩。");
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
