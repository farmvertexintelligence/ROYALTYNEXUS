/* Public campaign registration page. */
(function () {
  'use strict';

  const esc = RN.esc;
  const MODE_LABEL = { online: 'Online', offline: 'In the field', hybrid: 'Hybrid (online or in the field)' };

  const form = document.getElementById('regForm');
  const select = document.getElementById('campaignSelect');
  const summary = document.getElementById('summary');
  const participation = document.getElementById('participation');
  const msg = form.querySelector('.form-msg');
  document.getElementById('year').textContent = new Date().getFullYear();

  function renderParticipation(c) {
    const opts = c.mode === 'hybrid' ? ['offline', 'online'] : [c.mode];
    participation.innerHTML = opts.map((m, i) =>
      '<label><input type="radio" name="participation" value="' + m + '"' + (i === 0 ? ' checked' : '') + '> ' +
      (m === 'online' ? 'Online' : 'In person') + '</label>'
    ).join('');
  }

  function renderSummary(c) {
    if (!c) {
      summary.innerHTML = '<h3>No open campaigns</h3><p class="muted">There are no campaigns open for registration right now. Please check back soon.</p>';
      return;
    }
    const cap = Number(c.capacity) || 0;
    const left = cap ? Math.max(0, cap - RN.seatsTaken(c.id)) : null;
    summary.innerHTML =
      '<p class="eyebrow">' + esc(c.category) + '</p>' +
      '<h3>' + esc(c.title) + '</h3>' +
      '<p class="muted">' + esc(c.description) + '</p>' +
      '<dl>' +
        '<dt>Date</dt><dd>' + esc(RN.fmtDate(c.date)) + '</dd>' +
        (c.time ? '<dt>Time</dt><dd>' + esc(c.time) + '</dd>' : '') +
        '<dt>Format</dt><dd>' + esc(MODE_LABEL[c.mode] || c.mode) + '</dd>' +
        '<dt>Location</dt><dd>' + esc(c.location) + '</dd>' +
        (c.hours ? '<dt>Service hours</dt><dd>' + esc(c.hours) + '</dd>' : '') +
        (cap ? '<dt>Places left</dt><dd>' + left + ' of ' + cap + '</dd>' : '') +
        '<dt>Fee</dt><dd>Free</dd>' +
      '</dl>';
  }

  function current() {
    return RN.campaign(select.value);
  }

  function onChange() {
    const c = current();
    renderSummary(c);
    if (c) renderParticipation(c);
  }

  function showSuccess(reg, c) {
    const online = reg.participation === 'online';
    document.getElementById('formCard').innerHTML =
      '<div class="success-panel">' +
        '<div class="tick"><svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg></div>' +
        '<h2 class="display" style="font-size:2.2rem">You’re registered, ' + esc(reg.name.split(' ')[0]) + '!</h2>' +
        '<p class="muted">Keep your registration ID — you’ll need it ' + (online ? 'when joining online' : 'at the field registration desk') + '.</p>' +
        '<div class="reg-id">' + esc(reg.id) + '</div>' +
        (online && c.link
          ? '<p>Your joining link: <a href="' + esc(c.link) + '" target="_blank" rel="noopener">' + esc(c.link) + '</a></p>'
          : '<p>Report to: <strong>' + esc(c.location) + '</strong>' + (c.time ? ' by <strong>' + esc(c.time) + '</strong>' : '') + ' on ' + esc(RN.fmtDate(c.date)) + '.</p>') +
        '<p class="muted">After the campaign, your Certificate of Participation will be issued by the Foundation Trust.</p>' +
        '<div class="actions"><a class="btn btn-leaf" href="register.html">Register someone else</a><a class="btn btn-outline" href="index.html#campaigns">Browse campaigns</a></div>' +
      '</div>';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!form.checkValidity()) {
      form.classList.add('was-validated');
      msg.textContent = 'Please complete the highlighted fields.';
      msg.className = 'form-msg is-error';
      const firstInvalid = form.querySelector(':invalid');
      if (firstInvalid) firstInvalid.focus();
      return;
    }
    const data = Object.fromEntries(new FormData(form));
    const res = RN.register(data);
    if (!res.ok) {
      msg.textContent = res.error;
      msg.className = 'form-msg is-error';
      onChange();
      return;
    }
    showSuccess(res.registration, current());
  });

  select.addEventListener('change', onChange);

  RN.ready.then(() => {
    const open = RN.openCampaigns();
    if (!open.length) {
      form.querySelectorAll('input, select, button').forEach(el => { el.disabled = true; });
      renderSummary(null);
      return;
    }
    select.innerHTML = open.map(c =>
      '<option value="' + esc(c.id) + '">' + esc(c.title) + ' — ' + esc(RN.fmtDate(c.date, { day: 'numeric', month: 'short' })) + '</option>'
    ).join('');
    const wanted = new URLSearchParams(location.search).get('c');
    if (wanted && open.some(c => c.id === wanted)) select.value = wanted;
    onChange();
  });
})();
