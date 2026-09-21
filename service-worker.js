/* ============================================================
   PhotoChange Service Worker
   页面：网络优先，离线回退缓存；
   静态资源：缓存优先 + 后台更新（带 ?v= 版本号，改版自动换新）
   跨域资源（字体/busuanzi）不拦截
   ============================================================ */
const CACHE = "photochange-v2";
const SHELL = [
  "./",
  "./index.html",
  "./style.css?v=6",
  "./main.js?v=7",
  "./quota.js?v=3",
  "./page-switch.js?v=7",
  "./info-badge.js?v=3",
  "./pointer-fx.js?v=3",
  "./vendor/jspdf.umd.min.js",
  "./vendor/heic2any.min.js",
  "./logo.svg",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL))
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
