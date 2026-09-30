/*
 * Landscape generation + scroll-driven parallax.
 * Trees and reeds are generated procedurally (seeded, so the scene is the
 * same on every load) to keep the HTML light.
 */
(function () {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';

  function rng(seed) {
    return function () {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
  }

  // Pine silhouette: stacked, jagged tiers plus a trunk.
  function pinePath(x, base, h, w) {
    const top = base - h;
    const tiers = 5;
    const body = h * 0.86;
    const right = [];
    for (let i = 1; i <= tiers; i++) {
      const y = top + body * (i / tiers);
      const half = (w / 2) * (0.35 + 0.65 * (i / tiers));
      right.push([x + half, y]);
      if (i < tiers) right.push([x + half * 0.38, y - body * 0.035]);
    }
    const trunk = w * 0.06;
    let d = 'M' + x.toFixed(1) + ' ' + top.toFixed(1);
    right.forEach(p => { d += 'L' + p[0].toFixed(1) + ' ' + p[1].toFixed(1); });
    d += 'L' + (x + trunk).toFixed(1) + ' ' + (top + body).toFixed(1);
    d += 'L' + (x + trunk).toFixed(1) + ' ' + base.toFixed(1);
    d += 'L' + (x - trunk).toFixed(1) + ' ' + base.toFixed(1);
    d += 'L' + (x - trunk).toFixed(1) + ' ' + (top + body).toFixed(1);
    right.slice().reverse().forEach(p => { d += 'L' + (2 * x - p[0]).toFixed(1) + ' ' + p[1].toFixed(1); });
    return d + 'Z';
  }

  function addTrees(groupId, count, opts, seed) {
    const g = document.getElementById(groupId);
    if (!g) return;
    const r = rng(seed);
    let d = '';
    for (let i = 0; i < count; i++) {
      const x = opts.xMin + r() * (opts.xMax - opts.xMin);
      const h = opts.hMin + r() * (opts.hMax - opts.hMin);
      const base = opts.baseMin + r() * (opts.baseMax - opts.baseMin);
      d += pinePath(x, base, h, h * (0.32 + r() * 0.12));
    }
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    g.appendChild(path);
  }

  function addReeds(groupId, seed) {
    const g = document.getElementById(groupId);
    if (!g) return;
    const r = rng(seed);
    let d = '';
    const clusters = [[0, 260], [1180, 1440]];
    clusters.forEach(([a, b]) => {
      for (let i = 0; i < 60; i++) {
        const x = a + r() * (b - a);
        const h = 60 + r() * 150;
        const bend = (r() - 0.5) * 50;
        d += 'M' + x.toFixed(1) + ' 600Q' + (x + bend * 0.3).toFixed(1) + ' ' + (600 - h * 0.6).toFixed(1) + ' ' + (x + bend).toFixed(1) + ' ' + (600 - h).toFixed(1);
      }
    });
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    g.appendChild(path);
  }

  function sprinkle(selector, count, className, seed) {
    const host = document.querySelector(selector);
    if (!host) return;
    const r = rng(seed);
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const s = document.createElement('span');
      s.className = className;
      s.style.left = (r() * 100).toFixed(2) + '%';
      s.style.top = (r() * 100).toFixed(2) + '%';
      s.style.animationDelay = (r() * 8).toFixed(2) + 's';
      s.style.animationDuration = (5 + r() * 7).toFixed(2) + 's';
      frag.appendChild(s);
    }
    host.appendChild(frag);
  }

  // ---- Build scene elements ----
  // Distant forested hills
  addTrees('treesHills', 140, { xMin: -20, xMax: 1460, hMin: 26, hMax: 58, baseMin: 450, baseMax: 600 }, 7);
  // Foreground framing forest (tall at the edges, low in the middle)
  addTrees('treesFront', 18, { xMin: -60, xMax: 150, hMin: 200, hMax: 400, baseMin: 600, baseMax: 600 }, 11);
  addTrees('treesFront', 22, { xMin: 1210, xMax: 1480, hMin: 240, hMax: 470, baseMin: 600, baseMax: 600 }, 13);
  addTrees('treesFront', 50, { xMin: 180, xMax: 1260, hMin: 40, hMax: 110, baseMin: 545, baseMax: 580 }, 17);
  addTrees('treesSunset', 90, { xMin: -20, xMax: 1460, hMin: 24, hMax: 64, baseMin: 440, baseMax: 520 }, 23);
  addReeds('reeds', 29);
  sprinkle('.fireflies', 34, 'firefly', 31);
  sprinkle('.stars', 90, 'star', 37);

  // ---- Scroll effects ----
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const layers = Array.from(document.querySelectorAll('[data-speed]')).map(el => ({
    el,
    speed: parseFloat(el.dataset.speed) || 0,
    host: el.closest('.hero, .scene-band') || document.body
  }));
  const heroFade = document.querySelector('[data-hero-fade]');
  const hero = document.querySelector('.hero');
  const nav = document.getElementById('siteNav');
  const progress = document.querySelector('.scroll-progress span');

  let ticking = false;

  function update() {
    ticking = false;
    const vh = window.innerHeight;
    const y = window.scrollY;

    if (!reduceMotion) {
      layers.forEach(l => {
        const rect = l.host.getBoundingClientRect();
        if (rect.bottom < -100 || rect.top > vh + 100) return; // off-screen
        l.el.style.transform = 'translate3d(0,' + (-rect.top * l.speed).toFixed(1) + 'px,0)';
      });

      if (hero && heroFade) {
        const p = Math.min(1, Math.max(0, y / (hero.offsetHeight * 0.7)));
        heroFade.style.opacity = String(1 - p);
        heroFade.style.transform = 'translate3d(0,' + (y * 0.35).toFixed(1) + 'px,0) scale(' + (1 - p * 0.06).toFixed(3) + ')';
        hero.style.setProperty('--dawn', p.toFixed(3));
      }
    }

    if (nav) nav.classList.toggle('is-solid', y > (hero ? hero.offsetHeight - 90 : 40));
    if (progress) {
      const max = document.documentElement.scrollHeight - vh;
      progress.style.transform = 'scaleX(' + (max > 0 ? y / max : 0).toFixed(4) + ')';
    }
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();
})();
