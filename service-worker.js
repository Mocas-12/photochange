/* ============================================================
   PhotoChange Service Worker
   页面：网络优先，离线回退缓存；
   静态资源：缓存优先 + 后台更新。
   预缓存清单在 install 时动态生成：解析 index.html 的本地资源
   （含 ?v= 版本号），并跟进入口 module 的静态 import——
   改版只动 index.html 一处，清单自动换新，无需手工同步。
   跨域资源（busuanzi）不拦截；自托管字体随 index.html 入清单。
   ============================================================ */
const CACHE = "photochange-v5";

/* 与版本号无关的固定资源（懒加载库也预缓存，保证离线 PDF/HEIC 可用） */
const STATIC = [
  "./vendor/jspdf.umd.min.js",
  "./vendor/heic2any.min.js",
  "./logo.svg",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];

/* 兜底清单：index.html 拉取失败时至少保证可离线打开 */
const FALLBACK = ["./", "./index.html"].concat(STATIC);

async function buildShell() {
  try {
    const html = await (await fetch("./index.html", { cache: "reload" })).text();
    const rel = [...html.matchAll(/(?:src|href)="\.\/([^"?]+(?:\?v=\d+)?)"/g)].map(m => "./" + m[1]);
    const shell = new Set(["./", "./index.html"].concat(rel).concat(STATIC));
    /* 入口 module 的静态 import（exporters/session 等不在 index.html 里），跟进一层 */
    const entry = rel.find(u => /main\.js/.test(u));
    if (entry) {
      try {
        const js = await (await fetch(entry, { cache: "reload" })).text();
        [...js.matchAll(/from\s*"\.\/([^"]+)"/g)].forEach(m => shell.add("./" + m[1]));
      } catch (_) {}
    }
    return [...shell];
  } catch (_) {
    return FALLBACK;
  }
}

self.addEventListener("install", (e) => {
  e.waitUntil(
    buildShell()
      .then((list) => caches.open(CACHE).then((c) => c.addAll(list)))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          caches.open(CACHE).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }
  e.respondWith(
    caches.match(req).then((hit) => {
      const fetching = fetch(req)
        .then((res) => {
          if (res && res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => hit);
      return hit || fetching;
    })
  );
});
