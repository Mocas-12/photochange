/* ============================================================
   PhotoChange — 共享编辑状态（ES module）
   main(编排) / crop(裁剪) / watermark(水印) 三方的最小公共面。
   字段全部可变，各模块 import 同一对象引用后直接读写。
   ============================================================ */
export const state = {
  originalImage: null,   /* 原始位图（重置基准） */
  workingImage: null,    /* 当前工作位图 */
  baseW: 0, baseH: 0,    /* 原始尺寸 */
  selection: null,       /* 裁剪选区（画布坐标，宽高可为负） */
  dragging: false,
  history: [],           /* 撤销栈元素 {c, bytes} */
  historyBytes: 0,
  batchFiles: [],        /* 批量待导出文件 */
  wmImage: null          /* 图片水印源 */
};

/* 加载上限：最长边超过则等比缩小，避免移动端画布超限 */
export const MAX_SIDE = 4096;

var COARSE = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
/* 触屏设备撤销步数收紧：多份全尺寸位图易撑爆移动端内存 */
export const HISTORY_MAX = COARSE ? 8 : 20;
/* 历史总字节数封顶：4096² 图单份约 64MB，只限步数时高分辨率下会 OOM 崩标签页 */
export const HISTORY_BYTES_MAX = (COARSE ? 192 : 512) * 1024 * 1024;
