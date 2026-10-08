// ============ zoom.js：图片点击放大 ============
(function(){
  if (window.__imgZoom) return;
  window.__imgZoom = true;

  function bindImg(img) {
    if (img._zoomBound) return;
    img._zoomBound = true;
    img.style.cursor = 'zoom-in';

    img.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      const src = img.src;
      if (src && typeof viewImage === 'function') viewImage(src);
    }, true);

    let timer = null;
    img.addEventListener('touchstart', function() {
      clearTimeout(timer);
      timer = setTimeout(function() {
        const bubble = img.closest('.bubble[data-idx]');
        if (!bubble) return;
        const idx = +bubble.getAttribute('data-idx');
        if (isNaN(idx)) return;
        if (typeof showMsgActions === 'function') showMsgActions(idx);
      }, 600);
    }, { passive: true, capture: true });
    img.addEventListener('touchend', function() { clearTimeout(timer); }, true);
    img.addEventListener('touchmove', function() { clearTimeout(timer); }, true);
    img.addEventListener('touchcancel', function() { clearTimeout(timer); }, true);
  }

  function scanAll() {
    const bubbles = document.getElementById('bubbles');
    if (!bubbles) return;
    bubbles.querySelectorAll('img').forEach(bindImg);
  }

  setTimeout(scanAll, 500);
  setInterval(scanAll, 400);

  function attachObserver() {
    const bubbles = document.getElementById('bubbles');
    if (!bubbles || bubbles._imgObs) return;
    bubbles._imgObs = true;
    const obs = new MutationObserver(function() {
      bubbles.querySelectorAll('img').forEach(bindImg);
    });
    obs.observe(bubbles, { childList: true, subtree: true });
  }
  setTimeout(attachObserver, 800);
  setInterval(attachObserver, 2000);

  console.log('✅ zoom.js 已加载');
})();
