/* ============================================================
   PhotoChange — 冒烟测试
   覆盖：启动自检 / 上传 / 裁剪坐标矩阵(旋转×镜像) / 免费额度
   / 目标体积导出 / 撤销 / BMP-ICO 编码器 / 格式联动 / 双屏切换
   ============================================================ */
const { test, expect } = require("@playwright/test");
const fs = require("node:fs");

/* 屏蔽数字字体 / busuanzi 等外链，保证测试封闭、快速、可离线跑 */
test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
});

/* 每个用例独立起点：清空额度状态后重新加载 */
async function freshPage(page) {
  await page.goto("/");
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload();
  await page.waitForLoadState("domcontentloaded");
}

/* 注入四象限测试图：位图左上红 / 右上绿 / 左下蓝 / 右下黄。
   等待 workingImage 恢复为 size×size（重复上传也准确） */
async function uploadQuad(page, size = 200) {
  return page.evaluate(async (size) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const c = document.createElement("canvas");
    c.width = size; c.height = size;
    const g = c.getContext("2d");
    const h = size / 2;
    g.fillStyle = "#ff0000"; g.fillRect(0, 0, h, h);
    g.fillStyle = "#00ff00"; g.fillRect(h, 0, h, h);
    g.fillStyle = "#0000ff"; g.fillRect(0, h, h, h);
    g.fillStyle = "#ffff00"; g.fillRect(h, h, h, h);
    const blob = await new Promise((res) => c.toBlob(res, "image/png"));
    const dt = new DataTransfer();
    dt.items.add(new File([blob], "quad.png", { type: "image/png" }));
    const input = document.getElementById("fileInput");
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    for (let i = 0; i < 100; i++) {
      const s = window.__pc_lastSrcCanvas;
      if (s && s.width === size && s.height === size) return true;
      await sleep(50);
    }
    return false;
  }, size);
}

/* 在屏幕右上象限拖选区并应用裁剪，返回裁后画布尺寸与中心像素 */
async function dragCropTopRight(page) {
  return page.evaluate(() => {
    const canvas = document.getElementById("canvas");
    const r = canvas.getBoundingClientRect();
    const ev = (type, fx, fy) => new PointerEvent("pointer" + type, {
      bubbles: true, pointerId: 1, isPrimary: true, pointerType: "mouse",
      clientX: r.left + r.width * fx, clientY: r.top + r.height * fy,
    });
    canvas.dispatchEvent(ev("down", 0.62, 0.38));
    canvas.dispatchEvent(ev("move", 0.82, 0.18));
    canvas.dispatchEvent(ev("up", 0.82, 0.18));
    document.getElementById("cropApply").click();
    const d = canvas.getContext("2d")
      .getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data;
    return { w: canvas.width, h: canvas.height, rgb: [d[0], d[1], d[2]] };
  });
}

function classify([r, g, b]) {
  if (r > 200 && g < 80 && b < 80) return "red";
  if (g > 200 && r < 80 && b < 80) return "green";
  if (b > 200 && r < 80 && g < 80) return "blue";
  return "other";
}

/* ---------- 启动自检 ---------- */
test.describe("启动", () => {
  test("页面加载，关键模块就位", async ({ page }) => {
    await freshPage(page);
    const boot = await page.evaluate(() => ({
      title: document.title,
      encoders: typeof window.__pcEncoders === "object",
      jspdf: typeof window.jspdf === "object" || typeof window.jspdf === "function",
      goToPage: typeof window.goToPage === "function",
      metaDesc: !!document.querySelector('meta[name="description"]'),
      exposeGone: !document.querySelector('script[src*="expose"]'),
      hasImage: window.__pcHasImage === true,
    }));
    expect(boot.title).toBe("PhotoChange");
    expect(boot.encoders).toBe(true);
    expect(boot.jspdf).toBe(true);
    expect(boot.goToPage).toBe(true);
    expect(boot.metaDesc).toBe(true);
    expect(boot.exposeGone).toBe(true);
    expect(boot.hasImage).toBe(false);
  });
});

/* ---------- 上传 ---------- */
test.describe("上传", () => {
  test("注入图片进入编辑态", async ({ page }) => {
    await freshPage(page);
    expect(await uploadQuad(page)).toBe(true);
    const state = await page.evaluate(() => ({
      lastSrc: window.__pc_lastSrcCanvas.width + "x" + window.__pc_lastSrcCanvas.height,
      bodyClass: document.body.classList.contains("has-image"),
      canvas: document.getElementById("canvas").width + "x" + document.getElementById("canvas").height,
      fileName: document.getElementById("fileName").value,
    }));
    expect(state.lastSrc).toBe("200x200");
    expect(state.bodyClass).toBe(true);
    expect(state.canvas).toBe("200x200");
    expect(state.fileName).toBe("quad");
  });
});

/* ---------- 裁剪坐标矩阵：屏幕右上象限拖选，位图映射必须跟手 ----------
   颜色即断言：无变换=绿(位图右上)，旋转90°=红(位图左上)，
   镜像=红，旋转+镜像=蓝(位图左下)。旧 bug 在最后一种组合裁出绿色。 */
test.describe("裁剪坐标矩阵", () => {
  for (const t of [
    { name: "无变换 → 绿", rot: 0, fx: 1, fy: 1, expected: "green" },
    { name: "旋转90° → 红", rot: 90, fx: 1, fy: 1, expected: "red" },
    { name: "水平镜像 → 红", rot: 0, fx: -1, fy: 1, expected: "red" },
    { name: "旋转90°+镜像 → 蓝", rot: 90, fx: -1, fy: 1, expected: "blue" },
  ]) {
    test(t.name, async ({ page }) => {
      await freshPage(page);
      expect(await uploadQuad(page)).toBe(true);
      await page.evaluate(({ rot, fx, fy }) => {
        window.resetViewTransform();
        if (rot) window.rotateImage(rot);
        if (fx === -1) window.toggleFlip("x");
        if (fy === -1) window.toggleFlip("y");
      }, { rot: t.rot, fx: t.fx, fy: t.fy });
      const res = await dragCropTopRight(page);
      expect(classify(res.rgb)).toBe(t.expected);
    });
  }
});

/* ---------- 免费额度 ---------- */
test.describe("免费额度", () => {
  test("导出成功扣 1 次", async ({ page }) => {
    await freshPage(page);
    expect(await uploadQuad(page)).toBe(true);
    await page.evaluate(() => document.getElementById("downloadBtn").click());
    await expect.poll(
      () => page.evaluate(() => localStorage.getItem("download_count")),
      { timeout: 8000 },
    ).toBe("1");
  });

  test("导出失败不扣次数", async ({ page }) => {
    await freshPage(page);
    expect(await uploadQuad(page)).toBe(true);
    await page.evaluate(() => {
      localStorage.setItem("download_count", "1");
      const fs = document.getElementById("formatSelect");
      fs.value = "pdf";
      fs.dispatchEvent(new Event("change", { bubbles: true }));
      delete window.jspdf; /* 模拟编码失败 */
      document.getElementById("downloadBtn").click();
    });
    await expect(page.locator("#alert-message")).toContainText("导出失败");
    expect(await page.evaluate(() => localStorage.getItem("download_count"))).toBe("1");
  });

  test("无图导出被拦截且不扣次数", async ({ page }) => {
    await freshPage(page);
    await page.evaluate(() => document.getElementById("downloadBtn").click());
    await expect(page.locator("#alert-message")).toContainText("请先上传");
    expect(await page.evaluate(() => localStorage.getItem("download_count"))).toBe("0");
  });
});

/* ---------- 导出 ---------- */
test.describe("导出", () => {
  test("按目标体积导出触发 .jpg 下载且不超过目标", async ({ page }) => {
    await freshPage(page);
    expect(await uploadQuad(page)).toBe(true);
    await page.evaluate(() => {
      const fs = document.getElementById("formatSelect");
      fs.value = "jpg";
      fs.dispatchEvent(new Event("change", { bubbles: true }));
      document.getElementById("targetKB").value = "50";
    });
    const dlPromise = page.waitForEvent("download", { timeout: 15000 });
    await page.evaluate(() => document.getElementById("downloadBtn").click());
    const dl = await dlPromise;
    expect(dl.suggestedFilename()).toMatch(/\.jpg$/);
    const size = fs.statSync(await dl.path()).size;
    expect(size).toBeGreaterThan(0);
    expect(size).toBeLessThanOrEqual(55 * 1024);
  });

  test("BMP/ICO 编码器输出合法文件头", async ({ page }) => {
    await freshPage(page);
    expect(await uploadQuad(page)).toBe(true);
    const bmp = await page.evaluate(async () => {
      const b = await window.__pcEncoders.bmp(window.__pc_lastSrcCanvas);
      const head = new Uint8Array(await b.slice(0, 2).arrayBuffer());
      return { size: b.size, magic: String.fromCharCode(head[0], head[1]) };
    });
    expect(bmp.magic).toBe("BM");
    expect(bmp.size).toBeGreaterThan(54);
    const ico = await page.evaluate(async () => {
      const b = await window.__pcEncoders.ico(window.__pc_lastSrcCanvas);
      const head = new Uint8Array(await b.slice(0, 6).arrayBuffer());
      const v = new DataView(head.buffer);
      return { size: b.size, type: v.getUint16(2, true), count: v.getUint16(4, true) };
    });
    expect(ico.type).toBe(1);
    expect(ico.count).toBeGreaterThanOrEqual(1);
    expect(ico.size).toBeGreaterThan(0);
  });
});

/* ---------- 编辑链路 ---------- */
test.describe("编辑", () => {
  test("裁剪后撤销恢复原尺寸", async ({ page }) => {
    await freshPage(page);
    expect(await uploadQuad(page)).toBe(true);
    const before = await page.evaluate(() => document.getElementById("canvas").width);
    expect(before).toBe(200);
    const res = await dragCropTopRight(page);
    expect(res.w).toBeLessThan(before);
    await page.evaluate(() => document.getElementById("toolUndo").click());
    const after = await page.evaluate(() => document.getElementById("canvas").width);
    expect(after).toBe(before);
  });

  test("目标体积输入框按格式启停", async ({ page }) => {
    await freshPage(page);
    const states = await page.evaluate(() => {
      const fs = document.getElementById("formatSelect");
      const kb = document.getElementById("targetKB");
      const out = {};
      for (const f of ["jpg", "png", "webp", "bmp", "ico", "pdf"]) {
        fs.value = f;
        fs.dispatchEvent(new Event("change", { bubbles: true }));
        out[f] = !kb.disabled;
      }
      return out;
    });
    expect(states).toEqual({ jpg: true, png: true, webp: true, bmp: false, ico: false, pdf: false });
  });
});

/* ---------- 双屏切换 ---------- */
test.describe("双屏切换", () => {
  test("位移等于首屏实际渲染高度", async ({ page }) => {
    await freshPage(page);
    const { heroH, ty } = await page.evaluate(() => {
      const track = document.getElementById("pageTrack");
      const heroH = track.children[0].getBoundingClientRect().height;
      window.goToPage(1);
      const m = /translateY\(-([\d.]+)px\)/.exec(track.style.transform || "");
      return { heroH, ty: m ? parseFloat(m[1]) : 0 };
    });
    expect(heroH).toBeGreaterThan(0);
    expect(Math.abs(ty - heroH)).toBeLessThan(1);
  });
});
