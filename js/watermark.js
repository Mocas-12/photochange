/* ============================================================
   PhotoChange — 水印（ES module）
   文字/图片 × 单个九宫格/斜向平铺。绘制核心 paintWatermark
   被预览与导出共用，字号按画布短边比例计算保证两端观感一致。
   参数元素本模块自持；wmImage 存共享 state（导出管线要读）。
   ============================================================ */
import { state } from "./state.js?v=10";

var wmEnable = document.getElementById("wmEnable");
var wmText = document.getElementById("wmText");
var wmPos = document.getElementById("wmPos");
var wmOpacity = document.getElementById("wmOpacity");
var wmType = document.getElementById("wmType");
var wmMode = document.getElementById("wmMode");
var wmScale = document.getElementById("wmScale");
var wmImgInput = document.getElementById("wmImgInput");
var wmImgBtn = document.getElementById("wmImgBtn");

export function wmActive() {
  return wmEnable.checked &&
    ((wmType.value === "text" && wmText.value.trim()) || (wmType.value === "image" && state.wmImage));
}
function wmFontFor(w, h) {
  return Math.max(14, Math.round(Math.min(w, h) * 0.055));
}
function wmFontCss(fs) {
  return "600 " + fs + "px Inter,system-ui,'PingFang SC','Microsoft YaHei',sans-serif";
}
export function paintWatermark(c, w, h) {
  if (!wmActive()) return;
  var alpha = Math.max(0.05, Math.min(1, parseFloat(wmOpacity.value) || 0.5));
  var isText = wmType.value === "text";
  var text = isText ? wmText.value.trim() : "";
  var img = (!isText && state.wmImage) ? state.wmImage : null;
  var fs = wmFontFor(w, h);
  var tw = 0, th = 0, iw = 0, ih = 0;
  if (text) {
    c.font = wmFontCss(fs);
    tw = c.measureText(text).width; th = fs;
  } else if (img) {
    var pct = Math.max(2, parseFloat(wmScale.value) || 15) / 100;
    iw = Math.max(1, Math.round(Math.min(w, h) * pct));
    ih = Math.max(1, Math.round(iw * img.height / img.width));
  }
  var itemW = text ? tw : iw, itemH = text ? th : ih;
  var pad = Math.round(itemW * 0.4 + itemH * 0.3);
  if (wmMode.value === "tile") {
    /* 平铺：斜向 -30° 铺满全图，防盗图 */
    var stepX = itemW + pad * 2.2, stepY = itemH + pad * 2.4;
    var half = Math.sqrt(w * w + h * h) / 2 + Math.max(stepX, stepY);
    c.save();
    c.translate(w / 2, h / 2);
    c.rotate(-30 * Math.PI / 180);
    c.globalAlpha = alpha;
    for (var yy = -half; yy <= half; yy += stepY) {
      for (var xx = -half; xx <= half; xx += stepX) {
        if (text) {
          c.fillStyle = "#ffffff";
          c.shadowColor = "rgba(0,0,0,.45)";
          c.shadowBlur = fs * 0.12;
          c.font = wmFontCss(fs);
          c.textBaseline = "middle";
          c.fillText(text, xx - tw / 2, yy);
        } else {
          c.drawImage(img, xx - iw / 2, yy - ih / 2, iw, ih);
        }
      }
    }
    c.restore();
    return;
  }
  /* 单个：九宫格定位 */
  var pos = wmPos.value;
  var x = pos.indexOf("l") > -1 ? pad : pos.indexOf("r") > -1 ? w - itemW - pad : (w - itemW) / 2;
  var y = pos.charAt(0) === "t" ? pad + itemH / 2 : pos.charAt(0) === "b" ? h - pad - itemH / 2 : h / 2;
  c.save();
  c.globalAlpha = alpha;
  if (text) {
    c.fillStyle = "#ffffff";
    c.shadowColor = "rgba(0,0,0,.55)";
    c.shadowBlur = fs * 0.18;
    c.textBaseline = "middle";
    c.fillText(text, x, y);
  } else {
    c.drawImage(img, x, y - ih / 2, iw, ih);
  }
  c.restore();
}

/* 参数变动 → 实时重绘预览；图片水印源写入共享 state */
export function initWatermark(redraw) {
  wmEnable.addEventListener("change", redraw);
  wmText.addEventListener("input", redraw);
  wmPos.addEventListener("change", redraw);
  wmOpacity.addEventListener("input", redraw);
  wmType.addEventListener("change", redraw);
  wmMode.addEventListener("change", redraw);
  wmScale.addEventListener("input", redraw);
  wmImgBtn.addEventListener("click", function () { wmImgInput.click(); });
  wmImgInput.addEventListener("change", function () {
    var f = wmImgInput.files && wmImgInput.files[0];
    if (!f) return;
    var url = URL.createObjectURL(f);
    var img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url);
      state.wmImage = img;
      redraw();
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      alert("水印图片加载失败");
    };
    img.src = url;
  });
}
