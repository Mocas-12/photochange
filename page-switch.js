/* ============================================================
   PhotoChange — Page Switch
   双屏整页切换：滚轮一档 / 触摸滑动 / 键盘 / 箭头按钮
   transform 轨道位移 + easeOutQuint 缓动；切屏期间加锁
   ============================================================ */
(function () {
  var track = document.getElementById('pageTrack');
  if (!track) return;
  var pages = track.children;
  if (pages.length < 2) return;

  var current = 0;
  var animating = false;
  var DURATION = 900;
  var WHEEL_THRESHOLD = 40;
  var reduced = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) track.style.transition = 'none';

  function overlayOpen() {
    try {
      var a = document.getElementById('custom-alert');
      var m = document.getElementById('proModal');
      if (a && getComputedStyle(a).display !== 'none') return true;
      if (m && getComputedStyle(m).display !== 'none') return true;
    } catch (_) {}
    return false;
  }

  function apply() {
    track.style.transform = 'translateY(-' + (current * window.innerHeight) + 'px)';
    for (var k = 0; k < pages.length; k++) {
      if (pages[k].classList) pages[k].classList.toggle('is-active', k === current);
    }
  }
  window.addEventListener('resize', function () { apply(); });

  function goTo(i) {
    i = Math.max(0, Math.min(pages.length - 1, i));
    if (i === current || animating) return;
    animating = true;
    current = i;
    apply();
    setTimeout(function () { animating = false; }, reduced ? 60 : DURATION + 80);
  }
  window.goToPage = goTo;

  /* 元素在指定方向上是否还能继续滚动 */
  function canScroll(el, dir) {
    if (!el || el.scrollHeight <= el.clientHeight + 1) return false;
    if (dir > 0) return el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    return el.scrollTop > 1;
  }

  /* 事件目标是否处于可滚动区域且该方向仍有空间 → 交给原生滚动 */
  function insideScrollable(t, dir) {
    var app = document.getElementById('app');
    var node = t;
    while (node && node !== app) {
      if (node.nodeType === 1) {
        var s;
        try { s = getComputedStyle(node); } catch (_) { s = null; }
        if (s && /(auto|scroll)/.test(s.overflowY) && canScroll(node, dir)) return true;
      }
      node = node.parentNode;
    }
    return false;
  }

  /* ---- 滚轮：一档直接切屏 ---- */
  var acc = 0, accReset = 0;
  function attempt(dir, mag) {
    if (animating || overlayOpen()) return;
    acc += mag;
    clearTimeout(accReset);
    accReset = setTimeout(function () { acc = 0; }, 240);
    if (Math.abs(acc) >= WHEEL_THRESHOLD) {
      acc = 0;
      goTo(current + dir);
    }
  }
  window.addEventListener('wheel', function (e) {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    var mag = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
    if (Math.abs(mag) < 2) return;
    var dir = mag > 0 ? 1 : -1;
    if (overlayOpen()) return;
    if (current === 1) {
      if (insideScrollable(e.target, dir)) return;      /* 面板等内部滚动 */
      e.preventDefault();
      attempt(dir, Math.abs(mag));
    } else {
      if (dir > 0) { e.preventDefault(); attempt(1, Math.abs(mag)); }
    }
  }, { passive: false });

  /* ---- 触摸滑动 ---- */
  var tsX = 0, tsY = 0, tracking = false;
  window.addEventListener('touchstart', function (e) {
    if (!e.touches || !e.touches[0]) return;
    tsX = e.touches[0].clientX;
    tsY = e.touches[0].clientY;
    tracking = true;
  }, { passive: true });
  window.addEventListener('touchend', function (e) {
    if (!tracking || !e.changedTouches || !e.changedTouches[0]) return;
    tracking = false;
    var dy = tsY - e.changedTouches[0].clientY;
    var dx = tsX - e.changedTouches[0].clientX;
    if (Math.abs(dy) < 60 || Math.abs(dy) < Math.abs(dx)) return;
    if (overlayOpen()) return;
    var dir = dy > 0 ? 1 : -1;
    goTo(current + dir);
  }, { passive: true });

  /* ---- 键盘 ---- */
  window.addEventListener('keydown', function (e) {
    var tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    var step = 0;
    if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') step = 1;
    else if (e.key === 'ArrowUp' || e.key === 'PageUp') step = -1;
    else if (e.key === 'Home') { e.preventDefault(); goTo(0); return; }
    else if (e.key === 'End') { e.preventDefault(); goTo(pages.length - 1); return; }
    if (step) { e.preventDefault(); goTo(current + step); }
  });

  /* ---- 初始化 ---- */
  track.dataset.pageSwitch = 'v3-px';
  apply();
})();
