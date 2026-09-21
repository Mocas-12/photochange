/* ============================================================
   PhotoChange — 导出编码器（ES module）
   纯"画布→Blob"转换，不含应用状态：
   BMP/ICO 手写编码、目标体积二分、白底合成、jsPDF 按需加载
   ============================================================ */

function toBlob(cv, mime, q) {
  return new Promise(function (res) { cv.toBlob(res, mime, q); });
}

/* PDF 库按需加载：364KB 只在真正导出 PDF 时付出成本（自托管，无网络依赖）。
   并发去重：进行中的加载缓存为同一个 Promise，避免重复注入 script */
let jsPdfLoading = null;
export function loadJsPdf() {
  if (window.jspdf) return Promise.resolve();
  if (!jsPdfLoading) {
    jsPdfLoading = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.onload = function () { resolve(); };
      s.onerror = function () {
        jsPdfLoading = null; /* 允许下次重试 */
        reject(new Error("PDF 组件加载失败，请检查网络后重试"));
      };
      s.src = "./vendor/jspdf.umd.min.js";
      document.head.appendChild(s);
    });
  }
  return jsPdfLoading;
}
window.__pcLoadJsPdf = loadJsPdf;

/* 目标体积：二分搜索质量参数 */
export async function blobUnderKB(cv, mime, kb) {
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
export function flattenForExport(cv) {
  var out = document.createElement("canvas");
  out.width = cv.width; out.height = cv.height;
  var c = out.getContext("2d");
  c.fillStyle = "#ffffff";
  c.fillRect(0, 0, out.width, out.height);
  c.drawImage(cv, 0, 0);
  return out;
}

/* BMP（24 位无压缩）：透明区按白底合成，行尾按 4 字节对齐 */
export function bmpBlob(cv) {
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
export async function icoBlob(cv) {
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
    var png = await toBlob(tmp, "image/png");
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

/* 供信息徽章直用（BMP/ICO 选中时也能显示预估体积） */
window.__pcEncoders = { bmp: bmpBlob, ico: icoBlob };
