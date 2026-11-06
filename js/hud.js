/* The Fractal Mind — HUD micro-script (content-neutral).
   1) thin neon scroll-progress bar at the top of the viewport;
   2) highlights the current TOC entry on doc pages.
   No external dependencies, no DOM text changes. */
(function () {
  "use strict";

  /* --- scroll progress bar --- */
  var bar = document.createElement("div");
  bar.className = "hud-progress";
  bar.setAttribute("aria-hidden", "true");
  document.documentElement.appendChild(bar);

  var ticking = false;
  function update() {
    ticking = false;
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    var p = max > 0 ? (h.scrollTop || document.body.scrollTop) / max : 0;
    bar.style.setProperty("--hud-p", String(Math.min(1, Math.max(0, p))));
  }
  addEventListener("scroll", function () {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  addEventListener("resize", update, { passive: true });
  update();

  /* --- active TOC link --- */
  var toc = document.querySelector(".toc");
  if (!toc || !("IntersectionObserver" in window)) return;

  var links = {};
  toc.querySelectorAll('a[href^="#"]').forEach(function (a) {
    links[a.getAttribute("href").slice(1)] = a;
  });
  var targets = Object.keys(links)
    .map(function (id) { return document.getElementById(id); })
    .filter(Boolean);
  if (!targets.length) return;

  var visible = new Set();
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) visible.add(e.target.id);
      else visible.delete(e.target.id);
    });
    for (var k in links) links[k].classList.remove("hud-active");
    for (var v of visible) { if (links[v]) links[v].classList.add("hud-active"); }
  }, { rootMargin: "-15% 0px -70% 0px" });

  targets.forEach(function (t) { io.observe(t); });
})();
