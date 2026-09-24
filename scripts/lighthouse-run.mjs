/* Lighthouse 质量门禁
   用 Playwright 启动 Chromium（--remote-debugging-port），lighthouse() API 直连审计，
   内置阈值断言，任一不达标即退出码 1（CI 用作部署门禁之一）。
   绕开 chrome-launcher 在 Windows 上杀进程后临时目录锁死导致的 EPERM 崩溃。
   已知豁免：
   - is-on-https：审计对象是 http://localhost 静态服务器，线上由 GitHub Pages 强制 HTTPS
   - categories:performance：hero 标题用 background-clip:text，Chromium 不产生 LCP 候选，
     Lantern 报 NO_LCP 导致性能分为 null；性能改由 FCP/TBT/CLS 数值阈值约束 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const lhPkg = await import("lighthouse");
const lighthouse = lhPkg.default || lhPkg.lighthouse || lhPkg;

const ROOT = process.cwd();
/* 随机高位端口，避开本机常驻服务 */
const PORT = 9000 + Math.floor(Math.random() * 900);
const CDP = 9333;
const OUT = path.join(ROOT, ".lighthouseci");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const THRESHOLDS = {
  "categories:accessibility": 0.9,
  "categories:best-practices": 0.9,
  "categories:seo": 0.8,
  "first-contentful-paint": 3000,   /* ms */
  "total-blocking-time": 500,       /* ms */
  "cumulative-layout-shift": 0.1,
  "resource-summary:script:size": 120000,  /* bytes */
  "resource-summary:total:size": 800000    /* bytes */
};
/* 本地 http 审计环境下的固有误报 */
const EXEMPT = new Set(["is-on-https"]);

const GTE = (v, l) => v >= l;
const LTE = (v, l) => v <= l;

const failures = [];

function check(label, value, limit, cmp) {
  const ok = cmp(value, limit);
  console.log(`[lighthouse] ${label}: ${value} (阈值 ${cmp === GTE ? "≥" : "≤"} ${limit}) ${ok ? "✓" : "✗"}`);
  if (!ok) failures.push(`${label}=${value}`);
}

/* 按 LHCI 同款加权算法重算分类分（剔除豁免审计与权重 0 项） */
function categoryScoreExempt(lhr, key) {
  let sw = 0, acc = 0;
  for (const ref of lhr.categories[key].auditRefs) {
    if (EXEMPT.has(ref.id) || ref.weight === 0) continue;
    const a = lhr.audits[ref.id];
    if (!a || a.score === null || a.scoreDisplayMode === "informative") continue;
    acc += a.score * ref.weight;
    sw += ref.weight;
  }
  return sw ? Number((acc / sw).toFixed(4)) : null;
}

const server = spawn(process.execPath, ["tests/static-server.mjs"], {
  env: { ...process.env, TEST_PORT: String(PORT) },
  stdio: "ignore"
});
await new Promise((r) => setTimeout(r, 800));

/* 每个 run 独立浏览器：trace 引擎在同进程的第二次审计会因状态污染输出 NaN 指标 */
for (let i = 0; i < 3; i++) {
  const browser = await chromium.launch({
    args: ["--remote-debugging-port=" + CDP]
  });
  try {
    const result = await lighthouse(`http://localhost:${PORT}/`, {
      port: CDP,
      onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
      skipAudits: ["bf-cache", "can-preload-lcp-image"],
      output: "json",
      maxWaitForLoad: 45000
    });
    const lhr = result.lhr;
    fs.writeFileSync(
      path.join(OUT, `lighthouse-${Date.now()}-${i}.report.json`),
      JSON.stringify(lhr)
    );
    console.log(`[lighthouse] ===== run ${i + 1}/3 =====`);
    for (const key of ["accessibility", "best-practices", "seo"]) {
      const score = categoryScoreExempt(lhr, key);
      check("categories:" + key, score, THRESHOLDS["categories:" + key], GTE);
    }
    check("first-contentful-paint", Math.round(lhr.audits["first-contentful-paint"].numericValue), THRESHOLDS["first-contentful-paint"], LTE);
    check("total-blocking-time", Math.round(lhr.audits["total-blocking-time"].numericValue), THRESHOLDS["total-blocking-time"], LTE);
    check("cumulative-layout-shift", lhr.audits["cumulative-layout-shift"].numericValue, THRESHOLDS["cumulative-layout-shift"], LTE);
    const net = lhr.audits["network-requests"].details.items;
    const scriptSize = net.filter((x) => x.resourceType === "Script").reduce((s, x) => s + (x.resourceSize || 0), 0);
    const totalSize = net.reduce((s, x) => s + (x.resourceSize || 0), 0);
    check("resource-summary:script:size", scriptSize, THRESHOLDS["resource-summary:script:size"], LTE);
    check("resource-summary:total:size", totalSize, THRESHOLDS["resource-summary:total:size"], LTE);
    /* 分类内任何二进制审计失败（除豁免项）都算不过——阈值之外的一票否决 */
    for (const key of ["accessibility", "best-practices", "seo"]) {
      for (const ref of lhr.categories[key].auditRefs) {
        if (EXEMPT.has(ref.id)) continue;
        const a = lhr.audits[ref.id];
        if (a && a.score !== null && a.score < 1 && a.scoreDisplayMode !== "informative") {
          failures.push(`${key}/${a.id} 未通过`);
          console.log(`[lighthouse] ✗ ${key}/${a.id} ${a.displayValue || ""}`);
        }
      }
    }
  } finally {
    await browser.close();
  }
}
server.kill();

if (failures.length) {
  console.error("[lighthouse] 未达标项:\n  - " + failures.join("\n  - "));
  process.exit(1);
}
console.log("[lighthouse] 全部达标 ✓");
