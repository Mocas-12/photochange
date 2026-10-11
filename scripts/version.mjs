/* 资产指纹化：把 index.html 与 ES module import 链上的 ?v= 全部改写为
   「文件内容 SHA-256 前 8 位」。零依赖（仅 Node 内置模块），幂等。
   CI 部署前自动执行（ci.yml deploy 首步）；本地也可手动跑：node scripts/version.mjs

   为什么必须扫 import 链：main.js/crop.js/watermark.js 的静态 import 也带 ?v=，
   只改 index.html 会让同一文件出现两个 URL → ES Module 双执行；
   而改 B 的版本号会改变 B 的内容哈希、进而要求引用 B 的地方再改——
   所以用不动点循环：反复改写直到一轮内零变化（实际 2〜3 轮收敛）。
   service-worker.js 的 CACHE 名随 index.html 指纹变化：index.html 含全部 ?v=，
   任何资源更新都会换缓存名，旧缓存随 activate 全量清理。 */
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

const root = process.cwd();
const HTML = "index.html";
const hash = (buf) => createHash("sha256").update(buf).digest("hex").slice(0, 8);

/* HTML 属性引用与 JS import 引用两种形态 */
const HTML_RE = /((?:src|href)=")(\.\/[^"?]+)\?v=[^"]*(")/g;
const JS_RE = /(from\s*")(\.\/[^"?]+)\?v=[^"]*(")/g;

async function rewriteFile(relPath) {
  const full = join(root, relPath);
  const isHtml = relPath.endsWith(".html");
  const src = await readFile(full, "utf8");
  const re = isHtml ? HTML_RE : JS_RE;
  let out = src;
  const discovered = [];
  let changed = 0;
  const jobs = [...src.matchAll(re)];
  for (const m of jobs) {
    const target = m[2];
    /* import 相对路径以「引用方文件所在目录」为基准（./state.js 在 js/ 内）；
       HTML 引用恰好在根目录，同一规则适用 */
    const base = join(root, relPath, "..");
    if (target.endsWith(".js")) {
      /* 发现队列统一存根相对路径（正斜杠），保证队列里的路径可被 rewriteFile 直接读取 */
      discovered.push(join(relPath, "..", target).split("\\").join("/"));
    }
    let buf;
    try {
      buf = await readFile(join(base, target));
    } catch {
      throw new Error(`[version] ${relPath} 引用了不存在的文件: ${target}`);
    }
    const v = hash(buf);
    if (out.includes(`${target}?v=${v}`)) continue; /* 幂等：已是当前哈希则不动 */
    out = out.replace(m[0], `${m[1]}${target}?v=${v}${m[3]}`);
    changed++;
  }
  if (changed) await writeFile(full, out);
  return { changed, discovered };
}

/* 第一段：发现遍历——从 index.html 出发沿 JS import 走完整条依赖链（途中顺手改写）。
   第二段：不动点轮——每轮把所有失配引用改写为「目标文件当前内容哈希」，
   一轮零改写即收敛。为什么需要多轮：改写 main.js 的 import 会改变 main.js
   内容，index.html 里 main.js 自己的指纹随之失配——下一轮补齐（实测 2〜4 轮）。 */
const queue = [HTML];
const seen = new Set(queue);
while (queue.length) {
  const f = queue.shift();
  const r = await rewriteFile(f);
  r.discovered.forEach((d) => {
    if (!seen.has(d)) { seen.add(d); queue.push(d); }
  });
}
let rounds = 0;
let changed;
do {
  rounds++;
  changed = 0;
  for (const f of seen) {
    const r = await rewriteFile(f);
    changed += r.changed;
  }
} while (changed > 0 && rounds < 8);
if (changed > 0) throw new Error("[version] 未收敛：?v= 改写超过 8 轮");
console.log(`[version] 覆盖文件 ${seen.size} 个，收敛轮数 ${rounds}`);

/* SW 缓存名随 index.html 指纹变化 */
try {
  let sw = await readFile(join(root, "service-worker.js"), "utf8");
  const cm = sw.match(/const CACHE = "([^"]*)";/);
  if (cm) {
    const indexHash = hash(await readFile(HTML, "utf8"));
    const nextName = `photochange-${indexHash}`;
    if (cm[1] !== nextName) {
      sw = sw.replace(cm[0], `const CACHE = "${nextName}";`);
      await writeFile(join(root, "service-worker.js"), sw);
      console.log(`[version] service-worker.js CACHE: ${cm[1]} -> ${nextName}`);
    } else {
      console.log("[version] service-worker.js CACHE 未变化");
    }
  }
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
console.log("[version] 完成（收敛轮数 " + rounds + "）");
