/* Homepage behaviour: menu, reveal-on-scroll, counters, campaigns, enquiries. */
(function () {
  'use strict';

  const esc = RN.esc;

  // ---- Mobile menu ----
  const toggle = document.querySelector('.nav-toggle');
  const links = document.getElementById('navLinks');
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      const open = links.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      document.body.classList.toggle('menu-open', open);
    });
    links.addEventListener('click', e => {
      if (e.target.closest('a')) {
        links.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('menu-open');
      }
    });
  }

  // ---- Reveal on scroll ----
  const revealObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            revealObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' })
    : null;

  function observeReveals(root) {
    (root || document).querySelectorAll('.reveal:not(.is-visible)').forEach((el, i) => {
      el.style.transitionDelay = (i % 4) * 90 + 'ms';
      if (revealObserver) revealObserver.observe(el);
      else el.classList.add('is-visible');
    });
  }

  // ---- Animated counters ----
  function animateCount(el) {
    const target = Number(el.dataset.count) || 0;
    const start = performance.now();
    const dur = 1800;
    function frame(now) {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(target * eased).toLocaleString('en-IN');
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  const counterObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            animateCount(entry.target);
            counterObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.6 })
    : null;

  // ---- Campaigns ----
  const CATEGORY_ART = {
    Reforestation: { cls: 'art-forest', icon: '<path d="M24 4l10 14h-6l9 12h-7l8 10H10l8-10h-7l9-12h-6z"/><rect x="22" y="40" width="4" height="6"/>' },
    Water: { cls: 'art-water', icon: '<path d="M24 4C16 16 10 23 10 30a14 14 0 0028 0c0-7-6-14-14-26z"/>' },
    Wildlife: { cls: 'art-wildlife', icon: '<path d="M8 30c4-12 14-18 26-16 4 1 7 4 8 8-5-2-9-1-12 2 5 1 8 4 9 8-6-3-12-3-18 0-4 2-9 1-13-2z"/>' },
    Education: { cls: 'art-education', icon: '<path d="M24 8L2 18l22 10 18-8v12h4V18z"/><path d="M12 25v9c0 3 6 6 12 6s12-3 12-6v-9l-12 5z"/>' },
    Other: { cls: 'art-other', icon: '<circle cx="24" cy="24" r="10"/><path d="M24 2v8M24 38v8M2 24h8M38 24h8"/>' }
  };
  const MODE_LABEL = { online: 'Online', offline: 'In the field', hybrid: 'Hybrid' };

  function campaignCard(c) {
    const art = CATEGORY_ART[c.category] || CATEGORY_ART.Other;
    const taken = RN.seatsTaken(c.id);
    const cap = Number(c.capacity) || 0;
    const left = cap ? Math.max(0, cap - taken) : null;
    const pct = cap ? Math.min(100, Math.round((taken / cap) * 100)) : 0;
    const full = cap && left === 0;
    return (
      '<article class="campaign-card reveal" data-mode="' + esc(c.mode) + '">' +
        '<div class="campaign-art ' + art.cls + '">' +
          '<svg viewBox="0 0 48 48" aria-hidden="true">' + art.icon + '</svg>' +
          '<span class="tag tag-' + esc(c.mode) + '">' + esc(MODE_LABEL[c.mode] || c.mode) + '</span>' +
        '</div>' +
        '<div class="campaign-body">' +
          '<p class="campaign-meta">' + esc(c.category) + ' · ' + esc(RN.fmtDate(c.date, { day: 'numeric', month: 'short', year: 'numeric' })) + (c.time ? ' · ' + esc(c.time) : '') + '</p>' +
          '<h3>' + esc(c.title) + '</h3>' +
          '<p>' + esc(c.description) + '</p>' +
          '<p class="campaign-loc"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 00-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 00-7-7zm0 9.5A2.5 2.5 0 1112 6a2.5 2.5 0 010 5.5z"/></svg>' + esc(c.location) + '</p>' +
          (cap ? '<div class="seats"><div class="seats-bar"><span style="width:' + pct + '%"></span></div><small>' + (full ? 'Fully booked' : left + ' of ' + cap + ' places left') + '</small></div>' : '') +
          (full
            ? '<span class="btn btn-disabled">Fully booked</span>'
            : '<a class="btn btn-leaf" href="register.html?c=' + encodeURIComponent(c.id) + '">Register now</a>') +
        '</div>' +
      '</article>'
    );
  }

  function renderCampaigns(filter) {
    const grid = document.getElementById('campaignGrid');
    if (!grid) return;
    const list = RN.openCampaigns().filter(c => filter === 'all' || c.mode === filter);
    grid.innerHTML = list.length
      ? list.map(campaignCard).join('')
      : '<p class="empty">No campaigns in this category right now — check back soon.</p>';
    observeReveals(grid);
  }

  document.querySelectorAll('.filter-chips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chips .chip').forEach(c => {
        c.classList.toggle('is-active', c === chip);
        c.setAttribute('aria-selected', String(c === chip));
      });
      renderCampaigns(chip.dataset.filter);
    });
  });

  // ---- Private wealth enquiry ----
  const form = document.getElementById('enquiryForm');
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const msg = form.querySelector('.form-msg');
      if (!form.checkValidity()) {
        form.classList.add('was-validated');
        msg.textContent = 'Please complete the highlighted fields.';
        msg.className = 'form-msg is-error';
        return;
      }
      const data = Object.fromEntries(new FormData(form));
      delete data.consent;
      RN.addEnquiry(data);
      form.reset();
      form.classList.remove('was-validated');
      msg.textContent = 'Thank you. Your enquiry has been received in confidence — a relationship director will be in touch shortly.';
      msg.className = 'form-msg is-success';
    });
  }

  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  RN.ready.then(() => {
    renderCampaigns('all');
    const live = document.querySelector('[data-live="certificates"]');
    if (live) live.dataset.count = String(RN.certificates().filter(c => !c.revoked).length);
    document.querySelectorAll('[data-count]').forEach(el => {
      if (counterObserver) counterObserver.observe(el);
      else el.textContent = Number(el.dataset.count).toLocaleString('en-IN');
    });
    observeReveals();
  });
})();
