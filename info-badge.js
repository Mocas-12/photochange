(() => {
  const canvas = document.getElementById("canvas");
  const badge = document.getElementById("infoBadge");
  const formatSelect = document.getElementById("formatSelect");
  const qualityRange = document.getElementById("qualityRange");
  const fileInput = document.getElementById("fileInput");
  const cropBtn = document.getElementById("cropBtn");
  const resetBtn = document.getElementById("resetBtn");
  const applyResize = document.getElementById("applyResize");

  if (!canvas || !badge) return;

  function fmtBytes(b) {
    if (b == null || isNaN(b)) return "- KB";
    const kb = b / 1024;
    if (kb < 1024) return kb.toFixed(1) + " KB";
    return (kb / 1024).toFixed(2) + " MB";
  }

  function getSrcCanvas() {
    const src = window.__pc_lastSrcCanvas;
    if (src && src.width > 0 && src.height > 0) return src;
    return canvas; // fallback to preview (scaled) when not available yet
  }

  function getFormat() {
    const sel = formatSelect ? formatSelect.value : "png";
    if (sel === "jpg" || sel === "png" || sel === "pdf") return sel;
    return "png";
    }

  function makePdfBlobFromCanvas(srcCanvas) {
    try {
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ unit: "pt", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const iw = srcCanvas.width, ih = srcCanvas.height;
      if (iw === 0 || ih === 0) return Promise.resolve(null);
      const r = Math.min(pageW / iw, pageH / ih);
      const w = iw * r, h = ih * r;
      const x = (pageW - w) / 2, y = (pageH - h) / 2;
      const dataUrl = srcCanvas.toDataURL("image/jpeg", 0.92);
      pdf.addImage(dataUrl, "JPEG", x, y, w, h, "", "FAST");
      return Promise.resolve(pdf.output("blob"));
    } catch {
      return Promise.resolve(null);
    }
  }

  function blobFrom(srcCanvas, fmt, quality) {
    return new Promise((resolve) => {
      if (!srcCanvas || srcCanvas.width === 0 || srcCanvas.height === 0) {
        resolve(null);
        return;
      }
      if (fmt === "png") {
        srcCanvas.toBlob((b) => resolve(b), "image/png");
      } else if (fmt === "jpg") {
        const q = Math.max(0.1, Math.min(1, Number(quality) || 0.92));
        srcCanvas.toBlob((b) => resolve(b), "image/jpeg", q);
      } else if (fmt === "pdf") {
        makePdfBlobFromCanvas(srcCanvas).then(resolve);
      } else {
        resolve(null);
      }
    });
  }

  let raf = 0, pending = false;
  async function updateBadge() {
    if (pending) return;
    pending = true;
    const src = getSrcCanvas();
    const fmt = getFormat();
    const q = qualityRange ? qualityRange.value : 0.92;
    const blob = await blobFrom(src, fmt, q);
    const bytes = blob ? blob.size : 0;
    const w = src.width, h = src.height;
    const fmtText = fmt.toUpperCase();
    const sizeText = fmtBytes(bytes);
    if (w > 0 && h > 0) {
      badge.classList.remove("hidden");
      badge.innerHTML = `<em>${fmtText}</em> · <span class="num">${w}×${h}</span> · <span class="num">${sizeText}</span>`;
    } else {
      badge.classList.add("hidden");
      badge.textContent = "未加载";
    }
    pending = false;
  }

  function schedule() {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(updateBadge);
  }

  const events = [
    [fileInput, "change"],
    [formatSelect, "change"],
    [qualityRange, "input"],
    [cropBtn, "click"],
    [resetBtn, "click"],
    [applyResize, "click"],
    [window, "mouseup"],
  ];
  events.forEach(([el, ev]) => {
    if (el && el.addEventListener) el.addEventListener(ev, schedule);
  });

  // Also update on load and when the preview canvas resizes due to layout.
  window.addEventListener("load", schedule);
  new ResizeObserver(schedule).observe(canvas);
})();

