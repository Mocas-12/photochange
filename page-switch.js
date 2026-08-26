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

  /* ---- 滚轮：仅首页向下滚一档进入功能页；功能页滚轮不切页 ---- */
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
    if (overlayOpen()) return;
    if (current === 0 && mag > 0) { e.preventDefault(); attempt(1, Math.abs(mag)); }
    /* 功能页：滚轮不返回首页（避免移动端滑到顶部误触） */
  }, { passive: false });

  /* ---- 触摸滑动：仅首页上滑进入功能页 ---- */
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
    if (current === 0 && dy > 0) goTo(1);
  }, { passive: true });

  /* ---- 键盘：向下进入；Home 显式返回 ---- */
  window.addEventListener('keydown', function (e) {
    var tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (overlayOpen()) return;
    if (current === 0 && (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ')) { e.preventDefault(); goTo(1); }
    else if (e.key === 'End') { e.preventDefault(); goTo(pages.length - 1); }
    else if (e.key === 'Home') { e.preventDefault(); goTo(0); }
  });

  /* ---- 移动端功能标签 ---- */
  var mtabs = document.querySelectorAll('.mtab');
  if (mtabs.length) {
    mtabs.forEach(function (btn) {
      btn.addEventListener('click', function () {
        mtabs.forEach(function (b) { b.classList.toggle('active', b === btn); });
        document.body.classList.remove('m-tab-canvas', 'm-tab-tools');
        document.body.classList.add(btn.dataset.tab === 'tools' ? 'm-tab-tools' : 'm-tab-canvas');
      });
    });
  }

  /* ---- 初始化 ---- */
  track.dataset.pageSwitch = 'v5-tabs';
  var brand = document.getElementById('brandHome');
  if (brand) {
    brand.addEventListener('click', function () { goTo(0); });
    brand.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goTo(0); }
    });
  }
  apply();
})();
