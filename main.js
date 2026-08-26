/* ============================================================
   PhotoChange — 核心逻辑 v2
   三段式工作流：顶部工具条(裁剪/尺寸/水印/撤销/重置)
   + 画布 + 底部导出条(格式/质量/目标体积/文件名/导出)
   ============================================================ */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- 元素 ---------- */
  var fileInput = $("fileInput"), dropzone = $("dropzone"), chooseBtn = $("chooseBtn");
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
    if (history.length > 20) history.shift();
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
        originalImage = img;
        workingImage = document.createElement("canvas");
        workingImage.width = img.naturalWidth;
        workingImage.height = img.naturalHeight;
        workingImage.getContext("2d").drawImage(img, 0, 0);
        history.length = 0;
        toolUndo.disabled = true;
        selection = null;
        drawScaled(); syncInputs();
        fileNameInput.value = (file.name || "output").replace(/\.[^.]+$/, "");
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
  chooseBtn.addEventListener("click", function () { fileInput.click(); });
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
    workingImage.width = originalImage.naturalWidth;
    workingImage.height = originalImage.naturalHeight;
    workingImage.getContext("2d").drawImage(originalImage, 0, 0);
    selection = null;
    drawScaled(); syncInputs();
  });

  /* ---------- 裁剪 ---------- */
  function canvasPoint(evt) {
    var rect = canvas.getBoundingClientRect();
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
  }
  canvas.addEventListener("mousedown", function (e) {
    if (!workingImage) return;
    dragging = true;
    selection = { x: canvasPoint(e).x, y: canvasPoint(e).y, w: 0, h: 0 };
  });
  canvas.addEventListener("mousemove", function (e) {
    if (!dragging || !selection) return;
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
  window.addEventListener("mouseup", function () { dragging = false; });
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
  function applyWatermark(cv) {
    if (!wmEnable.checked) return cv;
    var text = wmText.value.trim();
    if (!text) return cv;
    var out = document.createElement("canvas");
    out.width = cv.width; out.height = cv.height;
    var c = out.getContext("2d");
    c.drawImage(cv, 0, 0);
    var fs = Math.max(14, Math.round(Math.min(cv.width, cv.height) * 0.055));
    c.font = "600 " + fs + "px Inter,system-ui,'PingFang SC','Microsoft YaHei',sans-serif";
    var metr = c.measureText(text);
    var tw = metr.width, th = fs;
    var pad = Math.round(fs * 0.6);
    var pos = wmPos.value;
    var x = pos.indexOf("l") > -1 ? pad : pos.indexOf("r") > -1 ? cv.width - tw - pad : (cv.width - tw) / 2;
    var y = pos.charAt(0) === "t" ? pad + th / 2 : pos.charAt(0) === "b" ? cv.height - pad - th / 2 : cv.height / 2;
    c.save();
    c.globalAlpha = parseFloat(wmOpacity.value);
    c.fillStyle = "#ffffff";
    c.shadowColor = "rgba(0,0,0,.55)";
    c.shadowBlur = fs * 0.18;
    c.textBaseline = "middle";
    c.fillText(text, x, y);
    c.restore();
    return out;
  }

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
  downloadBtn.addEventListener("click", async function () {
    if (!workingImage) { alert("请先上传并转换一张图片"); return; }
    var cv = applyWatermark(rotatedCanvas(workingImage, window.currentRotation || 0));
    var fmt = formatSelect.value;
    var kb = parseFloat(targetKB.value) || 0;
    try {
      if (fmt === "pdf") {
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
})();
