/* The Fractal Mind — mouse parallax + neon FX for the embedded fractal.
 * Layers inside img/fractal.svg carry data-depth="px"; this script eases each
 * layer toward the cursor position (deeper layers drift less, nearer more).
 * On top of that, same-origin embeds get a small canvas of interactive light:
 *   • pointer sparks that fade like neon dust;
 *   • a click shockwave + a brief brightness surge;
 *   • a hover state that makes the whole hero feel alive.
 * Attaches to both the host page and the embedded SVG document so the response
 * does not freeze while the cursor is over the artwork itself.
 * Falls silent when the embed is unavailable or the visitor prefers reduced motion. */
(function () {
  'use strict';
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var AMPLITUDE = 0.66; /* keeps the drift within the intended ~1–6 px range */
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var VIEW = 900;       /* img/fractal.svg viewBox is 0 0 900 900 */
  var MAX_FX = 90;      /* hard cap so a fast cursor cannot flood the DOM */
  var SPARK_COLORS = ['#22d3ee', '#a78bfa', '#f472b6', '#d7e2f2'];

  function setup(obj) {
    var layers = [], raf = 0, tx = 0, ty = 0, cx = 0, cy = 0, svgDoc = null;

    function onMove(e) {
      var host = obj.closest('.hero') || document.body;
      var r = host.getBoundingClientRect();
      var clientX = e.clientX, clientY = e.clientY;
      /* Events inside the embedded SVG document are measured from the
         artwork's own viewport, so translate them back into page space
         before normalising against the hero. */
      if (svgDoc && e.currentTarget === svgDoc) {
        var o = obj.getBoundingClientRect();
        clientX = o.left + e.clientX;
        clientY = o.top + e.clientY;
      }
      tx = ((clientX - r.left) / r.width - 0.5) * 2;
      ty = ((clientY - r.top) / r.height - 0.5) * 2;
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
        svgDoc = doc;
        doc.addEventListener('mousemove', onMove, { passive: true });
        doc.addEventListener('mouseleave', onLeave);
        initFX(obj, host, doc);
        return;
      }
      if (++tries < 40) setTimeout(wait, 250);
    })();
  }

  /* Neon dust, rings and the click surge live in a dedicated <g> inside the
     SVG document, so they scale with the artwork and inherit its screen blend. */
  function initFX(obj, host, doc) {
    if (!host) return;

    var fx = doc.createElementNS(SVG_NS, 'g');
    fx.setAttribute('id', 'fx-layer');
    fx.setAttribute('pointer-events', 'none');
    doc.documentElement.appendChild(fx);

    var bits = [];
    var fxRaf = 0;
    var lastTime = 0;
    var lastSpark = 0;
    var lastDown = 0;
    var pulseTimer = 0;

    function rectOf() {
      var r = obj.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom,
               width: r.width || 1, height: r.height || 1 };
    }
    function docRect() {
      var r = doc.documentElement.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom,
               width: r.width || 1, height: r.height || 1 };
    }
    function mapPoint(clientX, clientY, r) {
      return {
        x: ((clientX - r.left) / r.width) * VIEW,
        y: ((clientY - r.top) / r.height) * VIEW
      };
    }
    function inRect(clientX, clientY, r) {
      return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
    }

    function makeCircle(x, y, radius, fill) {
      var c = doc.createElementNS(SVG_NS, 'circle');
      c.setAttribute('cx', x.toFixed(2));
      c.setAttribute('cy', y.toFixed(2));
      c.setAttribute('r', radius.toFixed(2));
      c.setAttribute('fill', fill);
      c.setAttribute('opacity', '1');
      fx.appendChild(c);
      return c;
    }

    function addRing(x, y, color, maxR, delay) {
      var c = doc.createElementNS(SVG_NS, 'circle');
      c.setAttribute('cx', x.toFixed(2));
      c.setAttribute('cy', y.toFixed(2));
      c.setAttribute('r', '6');
      c.setAttribute('fill', 'none');
      c.setAttribute('stroke', color);
      c.setAttribute('stroke-width', '2.4');
      c.setAttribute('opacity', '0');
      fx.appendChild(c);
      bits.push({
        el: c, type: 'ring', x: x, y: y, life: 0, delay: delay || 0,
        maxLife: 720, maxR: maxR, color: color
      });
    }

    function addSpark(x, y, burst) {
      if (bits.length >= MAX_FX) {
        var old = bits.shift();
        if (old.el.parentNode) old.el.parentNode.removeChild(old.el);
      }
      var color = SPARK_COLORS[(Math.random() * SPARK_COLORS.length) | 0];
      var radius = burst ? 1.4 + Math.random() * 2.4 : 0.9 + Math.random() * 1.9;
      var el = makeCircle(x, y, radius, color);
      var a = Math.random() * Math.PI * 2;
      var s = burst ? 1.6 + Math.random() * 3.4 : 0.35 + Math.random() * 1.35;
      bits.push({
        el: el, type: 'spark', x: x, y: y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s - (burst ? 0 : 0.5),
        life: 0, maxLife: 520 + Math.random() * 520
      });
      start();
    }

    function start() {
      if (!fxRaf) {
        lastTime = 0;
        fxRaf = requestAnimationFrame(tick);
      }
    }

    function tick(now) {
      if (!lastTime) lastTime = now;
      var dtMs = Math.min(34, now - lastTime);
      var dt = dtMs / 16.67;
      lastTime = now;

      var alive = [];
      for (var i = 0; i < bits.length; i++) {
        var b = bits[i];
        b.life += dtMs;
        var t = (b.life - (b.delay || 0)) / b.maxLife;
        if (t >= 1) {
          if (b.el.parentNode) b.el.parentNode.removeChild(b.el);
          continue;
        }
        if (t < 0) { b.el.setAttribute('opacity', '0'); alive.push(b); continue; }

        if (b.type === 'ring') {
          var ease = 1 - Math.pow(1 - t, 3);
          b.el.setAttribute('r', (6 + b.maxR * ease).toFixed(2));
          b.el.setAttribute('opacity', (0.85 * (1 - t)).toFixed(3));
          b.el.setAttribute('stroke-width', (2.4 * (1 - t) + 0.3).toFixed(2));
        } else {
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          b.vy += 0.012 * dt;
          b.el.setAttribute('cx', b.x.toFixed(2));
          b.el.setAttribute('cy', b.y.toFixed(2));
          b.el.setAttribute('opacity', (1 - t).toFixed(3));
          b.el.setAttribute('r', (parseFloat(b.el.getAttribute('r')) * (1 - 0.008 * dt)).toFixed(2));
        }
        alive.push(b);
      }
      bits = alive;

      if (bits.length) {
        fxRaf = requestAnimationFrame(tick);
      } else {
        fxRaf = 0;
      }
    }

    function shockwave(x, y) {
      addRing(x, y, '#22d3ee', 230, 0);
      addRing(x, y, '#f472b6', 170, 90);
      for (var i = 0; i < 14; i++) addSpark(x, y, true);
      start();
    }

    function surge() {
      obj.classList.remove('fx-pulse');
      void obj.offsetWidth;
      obj.classList.add('fx-pulse');
      clearTimeout(pulseTimer);
      pulseTimer = setTimeout(function () { obj.classList.remove('fx-pulse'); }, 780);
    }

    function handleDown(x, y) {
      var now = performance.now();
      if (now - lastDown < 150) return;
      lastDown = now;
      shockwave(x, y);
      surge();
    }

    /* host-page pointer: brighten the art, spark only while over the artwork */
    function onHostMove(e) {
      obj.classList.add('is-live');
      if (e.pointerType && e.pointerType !== 'mouse') return;
      var r = rectOf();
      if (!inRect(e.clientX, e.clientY, r)) return;
      var now = performance.now();
      if (now - lastSpark < 45) return;
      lastSpark = now;
      var p = mapPoint(e.clientX, e.clientY, r);
      addSpark(p.x, p.y, false);
    }
    function onHostLeave() {
      obj.classList.remove('is-live');
    }
    function onHostDown(e) {
      var r = rectOf();
      if (!inRect(e.clientX, e.clientY, r)) return;
      var p = mapPoint(e.clientX, e.clientY, r);
      handleDown(p.x, p.y);
    }

    /* embedded-document pointer: the artwork itself is a separate document */
    function onDocMove(e) {
      obj.classList.add('is-live');
      if (e.pointerType && e.pointerType !== 'mouse') return;
      var now = performance.now();
      if (now - lastSpark < 45) return;
      lastSpark = now;
      var p = mapPoint(e.clientX, e.clientY, docRect());
      addSpark(p.x, p.y, false);
    }
    function onDocLeave() {
      obj.classList.remove('is-live');
    }
    function onDocDown(e) {
      var p = mapPoint(e.clientX, e.clientY, docRect());
      handleDown(p.x, p.y);
    }

    host.addEventListener('pointermove', onHostMove, { passive: true });
    host.addEventListener('pointerleave', onHostLeave);
    host.addEventListener('pointerdown', onHostDown);
    doc.addEventListener('pointermove', onDocMove, { passive: true });
    doc.addEventListener('pointerleave', onDocLeave);
    doc.addEventListener('pointerdown', onDocDown);
  }

  var embeds = document.querySelectorAll('object.hero-fractal-embed');
  for (var i = 0; i < embeds.length; i++) setup(embeds[i]);
})();
