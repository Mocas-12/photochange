/* 一次性工具：从 logo.svg 生成 PWA PNG 图标（node tests/gen-icons.mjs） */
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";
import { mkdirSync } from "node:fs";

mkdirSync("icons", { recursive: true });
const b64 = readFileSync("logo.svg").toString("base64");
const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of [192, 512, 180]) {
  const name = size === 180 ? "apple-touch-icon.png" : `icon-${size}.png`;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<body style="margin:0"><img src="data:image/svg+xml;base64,${b64}" style="width:${size}px;height:${size}px;display:block"></body>`
  );
  await page.screenshot({ path: `icons/${name}`, omitBackground: false });
  console.log("generated icons/" + name);
}
await browser.close();
