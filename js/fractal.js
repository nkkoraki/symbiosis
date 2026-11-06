/* The Fractal Mind — mouse parallax for the embedded fractal.
 * Layers inside img/fractal.svg carry data-depth="px"; this script eases each
 * layer toward the cursor position (deeper layers drift less, nearer more).
 * Attaches to both the host page and the embedded SVG document so the response
 * does not freeze while the cursor is over the artwork itself.
 * Falls silent when the embed is unavailable or the visitor prefers reduced motion. */
(function () {
  'use strict';
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var AMPLITUDE = 0.66; /* keeps the drift within the intended ~1–6 px range */

  function setup(obj) {
    var layers = [], raf = 0, tx = 0, ty = 0, cx = 0, cy = 0;

    function onMove(e) {
      var host = obj.closest('.hero') || document.body;
      var r = host.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      if (!raf) raf = requestAnimationFrame(tick);
    }
    function onLeave() {
      tx = 0; ty = 0;
      if (!raf) raf = requestAnimationFrame(tick);
    }
    function tick() {
      cx += (tx - cx) * 0.055;
      cy += (ty - cy) * 0.055;
      for (var i = 0; i < layers.length; i++) {
        var d = parseFloat(layers[i].getAttribute('data-depth')) || 0;
        layers[i].style.transform =
          'translate(' + (cx * d * AMPLITUDE).toFixed(2) + 'px,' +
          (cy * d * AMPLITUDE).toFixed(2) + 'px)';
      }
      raf = (Math.abs(tx - cx) + Math.abs(ty - cy) > 0.04) ? requestAnimationFrame(tick) : 0;
    }

    var host = obj.closest('.hero');
    if (host) {
      host.addEventListener('mousemove', onMove, { passive: true });
      host.addEventListener('mouseleave', onLeave);
    }

    /* same-origin embed: also listen inside, so moves over the artwork count */
    var tries = 0;
    (function wait() {
      var doc;
      try { doc = obj.contentDocument; } catch (e) { return; } /* cross-origin: page listener only */
      if (doc && doc.querySelectorAll && doc.querySelectorAll('[data-depth]').length) {
        layers = Array.prototype.slice.call(doc.querySelectorAll('[data-depth]'));
        for (var i = 0; i < layers.length; i++) layers[i].style.willChange = 'transform';
        doc.addEventListener('mousemove', onMove, { passive: true });
        doc.addEventListener('mouseleave', onLeave);
        return;
      }
      if (++tries < 40) setTimeout(wait, 250);
    })();
  }

  var embeds = document.querySelectorAll('object.hero-fractal-embed');
  for (var i = 0; i < embeds.length; i++) setup(embeds[i]);
})();
