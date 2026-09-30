/* Admin console: campaigns, registrations, certificates, enquiries, settings. */
(function () {
  'use strict';

  const esc = RN.esc;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const MODE_LABEL = { online: 'Online', offline: 'Field', hybrid: 'Hybrid' };
  const STATUS_LABEL = { open: 'Open', closed: 'Closed', completed: 'Completed', registered: 'Registered', attended: 'Attended', certified: 'Certified', new: 'New', contacted: 'Contacted', onboarded: 'Onboarded', declined: 'Closed' };
  const TITLES = { overview: 'Overview', campaigns: 'Campaigns', registrations: 'Registrations', certificates: 'Certificates', enquiries: 'Private wealth enquiries', settings: 'Settings' };

  if (!RN.session()) { location.replace('login.html'); return; }

  // ---------- Utilities ----------
  let toastTimer;
  function toast(text) {
    const t = $('#toast');
    t.textContent = text;
    t.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-visible'), 2800);
  }

  function pill(status) {
    return '<span class="pill pill-' + esc(status) + '">' + esc(STATUS_LABEL[status] || status) + '</span>';
  }

  function short(iso) {
    return RN.fmtDate(iso, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function downloadFile(name, content, type) {
    const blob = new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  function toCSV(rows) {
    return rows.map(r => r.map(v => {
      let s = String(v == null ? '' : v);
      if (/^[=+\-@]/.test(s)) s = "'" + s; // guard against spreadsheet formula injection
      return '"' + s.replace(/"/g, '""') + '"';
    }).join(',')).join('\r\n');
  }

  function verifyURL(id) {
    return new URL('../verify.html?id=' + encodeURIComponent(id), location.href).href;
  }

  // ---------- Navigation ----------
  let currentView = 'overview';
  function show(view) {
    currentView = view;
    $$('.side-nav button').forEach(b => b.classList.toggle('is-active', b.dataset.view === view));
    $$('.view').forEach(v => v.classList.toggle('is-active', v.dataset.view === view));
    $('#viewTitle').textContent = TITLES[view];
    document.body.classList.remove('nav-open');
    render();
  }
  $$('.side-nav button').forEach(b => b.addEventListener('click', () => show(b.dataset.view)));
  document.addEventListener('click', e => {
    const go = e.target.closest('[data-goto]');
    if (go) show(go.dataset.goto);
    if (e.target.closest('[data-action="new-campaign"]')) openCampaign();
  });
  $('#menuBtn').addEventListener('click', () => document.body.classList.toggle('nav-open'));
  $('#logoutBtn').addEventListener('click', () => { RN.logout(); location.replace('login.html'); });

  // ---------- Overview ----------
  function renderOverview() {
    const campaigns = RN.campaigns();
    const regs = RN.registrations();
    const certs = RN.certificates().filter(c => !c.revoked);
    const enq = RN.enquiries();
    const tiles = [
      ['Open campaigns', campaigns.filter(c => c.status === 'open').length, campaigns.length + ' total'],
      ['Registrations', regs.length, regs.filter(r => r.participation === 'online').length + ' online · ' + regs.filter(r => r.participation !== 'online').length + ' in person'],
      ['Certificates issued', certs.length, regs.filter(r => r.status === 'attended').length + ' attendees awaiting'],
      ['New wealth enquiries', enq.filter(e => e.status === 'new').length, enq.length + ' total']
    ];
    $('#tiles').innerHTML = tiles.map(t =>
      '<div class="tile"><span>' + t[0] + '</span><strong>' + t[1] + '</strong><small>' + esc(t[2]) + '</small></div>'
    ).join('');

    const today = new Date().toISOString().slice(0, 10);
    const upcoming = campaigns.filter(c => c.date >= today && c.status !== 'completed').slice(0, 5);
    $('#upcoming').innerHTML = upcoming.length
      ? '<ul class="list">' + upcoming.map(c => {
          const n = RN.seatsTaken(c.id);
          const cap = Number(c.capacity) || 0;
          return '<li><div><strong>' + esc(c.title) + '</strong><small>' + short(c.date) + ' · ' + MODE_LABEL[c.mode] + '</small></div>' +
            '<div class="mini-bar" title="' + n + (cap ? ' / ' + cap : '') + ' registered"><span style="width:' + (cap ? Math.min(100, n / cap * 100) : 0) + '%"></span><em>' + n + (cap ? '/' + cap : '') + '</em></div></li>';
        }).join('') + '</ul>'
      : '<p class="muted">No upcoming campaigns. Create one to open registrations.</p>';

    const latest = regs.slice(0, 6);
    $('#latestRegs').innerHTML = latest.length
      ? '<ul class="list">' + latest.map(r => {
          const c = RN.campaign(r.campaignId);
          return '<li><div><strong>' + esc(r.name) + '</strong><small>' + esc(c ? c.title : '—') + '</small></div>' + pill(r.status) + '</li>';
        }).join('') + '</ul>'
      : '<p class="muted">No registrations yet. Share the website’s registration link to start collecting sign-ups.</p>';
  }

  // ---------- Campaigns ----------
  function renderCampaigns() {
    const q = $('#campaignSearch').value.trim().toLowerCase();
    const st = $('#campaignStatusFilter').value;
    const list = RN.campaigns().filter(c =>
      (!st || c.status === st) && (!q || (c.title + ' ' + c.location + ' ' + c.category).toLowerCase().includes(q)));
    $('#campaignTable').innerHTML =
      '<thead><tr><th>Campaign</th><th>Date</th><th>Format</th><th>Registered</th><th>Status</th><th class="right">Actions</th></tr></thead><tbody>' +
      (list.length ? list.map(c => {
        const n = RN.seatsTaken(c.id);
        return '<tr data-id="' + esc(c.id) + '">' +
          '<td><strong>' + esc(c.title) + '</strong><small>' + esc(c.category) + ' · ' + esc(c.location) + '</small></td>' +
          '<td>' + short(c.date) + (c.time ? '<small>' + esc(c.time) + '</small>' : '') + '</td>' +
          '<td>' + MODE_LABEL[c.mode] + '</td>' +
          '<td><button class="link-btn" data-act="view-regs">' + n + (Number(c.capacity) ? ' / ' + esc(c.capacity) : '') + '</button></td>' +
          '<td>' + pill(c.status) + '</td>' +
          '<td class="right actions-cell">' +
            '<button class="icon-btn" data-act="edit">Edit</button>' +
            (c.status === 'open'
              ? '<button class="icon-btn" data-act="close">Close reg.</button>'
              : '<button class="icon-btn" data-act="reopen">Reopen</button>') +
            (c.status !== 'completed' ? '<button class="icon-btn" data-act="complete">Complete</button>' : '') +
            '<button class="icon-btn danger" data-act="delete">Delete</button>' +
          '</td></tr>';
      }).join('') : '<tr><td colspan="6" class="empty-row">No campaigns match.</td></tr>') + '</tbody>';
  }

  $('#campaignTable').addEventListener('click', e => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const id = btn.closest('tr').dataset.id;
    const c = RN.campaign(id);
    switch (btn.dataset.act) {
      case 'edit': openCampaign(c); break;
      case 'close': RN.saveCampaign({ id, status: 'closed' }); toast('Registration closed'); break;
      case 'reopen': RN.saveCampaign({ id, status: 'open' }); toast('Registration reopened'); break;
      case 'complete': RN.saveCampaign({ id, status: 'completed' }); toast('Marked as completed — you can now certify attendees'); break;
      case 'view-regs': $('#regCampaign').value = id; show('registrations'); return;
      case 'delete': {
        const n = RN.seatsTaken(id);
        if (!confirm('Delete “' + c.title + '”' + (n ? ' and its ' + n + ' registration(s)' : '') + '? Issued certificates stay valid. This cannot be undone.')) return;
        RN.deleteCampaign(id);
        toast('Campaign deleted');
        break;
      }
    }
    render();
  });
  $('#campaignSearch').addEventListener('input', renderCampaigns);
  $('#campaignStatusFilter').addEventListener('change', renderCampaigns);

  const campaignDialog = $('#campaignDialog');
  const campaignForm = $('#campaignForm');

  function syncLinkField() {
    const mode = campaignForm.mode.value;
    $('[data-online-only]', campaignForm).hidden = mode === 'offline';
  }
  campaignForm.mode.addEventListener('change', syncLinkField);

  function openCampaign(c) {
    campaignForm.reset();
    campaignForm.classList.remove('was-validated');
    $('.form-msg', campaignForm).textContent = '';
    $('#campaignDialogTitle').textContent = c ? 'Edit campaign' : 'New campaign';
    const data = c || { status: 'open', capacity: 100, hours: 4, date: new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10) };
    ['id', 'title', 'category', 'mode', 'date', 'time', 'location', 'link', 'capacity', 'hours', 'description', 'status'].forEach(k => {
      if (campaignForm[k] && data[k] != null) campaignForm[k].value = data[k];
    });
    if (!c) campaignForm.id.value = '';
    syncLinkField();
    campaignDialog.showModal();
  }

  campaignForm.addEventListener('submit', e => {
    e.preventDefault();
    if (e.submitter && e.submitter.value === 'cancel') { campaignDialog.close(); return; }
    const msg = $('.form-msg', campaignForm);
    if (!campaignForm.checkValidity()) {
      campaignForm.classList.add('was-validated');
      msg.textContent = 'Please fill in the required fields.';
      return;
    }
    const data = Object.fromEntries(new FormData(campaignForm));
    if (data.mode !== 'offline' && !data.link) {
      msg.textContent = 'Online and hybrid campaigns need a joining link.';
      campaignForm.link.focus();
      return;
    }
    data.capacity = Number(data.capacity) || 0;
    data.hours = Number(data.hours) || 0;
    if (!data.id) delete data.id;
    RN.saveCampaign(data);
    campaignDialog.close();
    toast(data.id ? 'Campaign updated' : 'Campaign created and published');
    render();
  });

  // ---------- Registrations ----------
  function fillCampaignSelects() {
    const campaigns = RN.campaigns();
    const regSel = $('#regCampaign');
    const keep = regSel.value;
    regSel.innerHTML = '<option value="">All campaigns</option>' +
      campaigns.map(c => '<option value="' + esc(c.id) + '">' + esc(c.title) + '</option>').join('');
    if (campaigns.some(c => c.id === keep)) regSel.value = keep;
    $('#walkInCampaign').innerHTML = campaigns
      .map(c => '<option value="' + esc(c.id) + '">' + esc(c.title) + ' (' + short(c.date) + ')</option>').join('');
  }

  function filteredRegs() {
    const cid = $('#regCampaign').value;
    const st = $('#regStatus').value;
    const q = $('#regSearch').value.trim().toLowerCase();
    return RN.registrations(cid || undefined).filter(r =>
      (!st || r.status === st) &&
      (!q || (r.name + ' ' + r.email + ' ' + r.id + ' ' + r.phone).toLowerCase().includes(q)));
  }

  function renderRegs() {
    fillCampaignSelects();
    const list = filteredRegs();
    $('#regTable').innerHTML =
      '<thead><tr><th>Participant</th><th>Contact</th><th>Campaign</th><th>Mode</th><th>Status</th><th class="right">Actions</th></tr></thead><tbody>' +
      (list.length ? list.map(r => {
        const c = RN.campaign(r.campaignId);
        const cert = RN.certificateForRegistration(r.id);
        return '<tr data-id="' + esc(r.id) + '">' +
          '<td><strong>' + esc(r.name) + '</strong><small>' + esc(r.id) + ' · ' + short(r.createdAt) + (r.source === 'walk-in' ? ' · walk-in' : '') + '</small></td>' +
          '<td>' + esc(r.email) + '<small>' + esc(r.phone) + (r.city ? ' · ' + esc(r.city) : '') + '</small></td>' +
          '<td>' + esc(c ? c.title : '—') + '</td>' +
          '<td>' + (r.participation === 'online' ? 'Online' : 'In person') + '</td>' +
          '<td>' + pill(r.status) + '</td>' +
          '<td class="right actions-cell">' +
            (r.status === 'registered' ? '<button class="icon-btn" data-act="attend">Mark attended</button>' : '') +
            (r.status === 'attended' ? '<button class="icon-btn" data-act="unattend">Undo</button>' : '') +
            (cert
              ? '<button class="icon-btn" data-act="view-cert" data-cert="' + esc(cert.id) + '">View certificate</button>'
              : '<button class="icon-btn primary" data-act="certify">Issue certificate</button>') +
            '<button class="icon-btn danger" data-act="delete">Remove</button>' +
          '</td></tr>';
      }).join('') : '<tr><td colspan="6" class="empty-row">No registrations match these filters.</td></tr>') + '</tbody>';
  }

  $('#regTable').addEventListener('click', e => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const id = btn.closest('tr').dataset.id;
    const r = RN.registration(id);
    switch (btn.dataset.act) {
      case 'attend': RN.updateRegistration(id, { status: 'attended' }); toast(r.name + ' marked as attended'); break;
      case 'unattend': RN.updateRegistration(id, { status: 'registered' }); break;
      case 'certify': {
        if (r.status === 'registered' && !confirm(r.name + ' has not been marked as attended. Issue a certificate anyway?')) return;
        const cert = RN.issueCertificate(id);
        toast('Certificate ' + cert.id + ' issued');
        showCert(cert);
        break;
      }
      case 'view-cert': showCert(RN.certificate(btn.dataset.cert)); return;
      case 'delete':
        if (!confirm('Remove registration for ' + r.name + '?')) return;
        RN.deleteRegistration(id);
        toast('Registration removed');
        break;
    }
    render();
  });

  ['#regCampaign', '#regStatus'].forEach(s => $(s).addEventListener('change', renderRegs));
  $('#regSearch').addEventListener('input', renderRegs);

  $('#certifyAllBtn').addEventListener('click', () => {
    const cid = $('#regCampaign').value;
    const pending = RN.registrations(cid || undefined).filter(r => r.status === 'attended');
    if (!pending.length) { toast('No attendees awaiting certificates' + (cid ? ' for this campaign' : '')); return; }
    if (!confirm('Issue certificates to ' + pending.length + ' attendee(s)?')) return;
    pending.forEach(r => RN.issueCertificate(r.id));
    toast(pending.length + ' certificate(s) issued');
    render();
  });

  $('#exportRegs').addEventListener('click', () => {
    const rows = [['Registration ID', 'Name', 'Email', 'Phone', 'City', 'Age group', 'Campaign', 'Campaign date', 'Participation', 'Status', 'Source', 'Registered at']];
    filteredRegs().forEach(r => {
      const c = RN.campaign(r.campaignId) || {};
      rows.push([r.id, r.name, r.email, r.phone, r.city, r.ageGroup, c.title, c.date, r.participation, r.status, r.source, r.createdAt]);
    });
    downloadFile('registrations-' + new Date().toISOString().slice(0, 10) + '.csv', toCSV(rows), 'text/csv');
  });

  // Walk-in
  const walkInDialog = $('#walkInDialog');
  const walkInForm = $('#walkInForm');
  $('#walkInBtn').addEventListener('click', () => {
    fillCampaignSelects();
    walkInForm.reset();
    walkInForm.classList.remove('was-validated');
    $('.form-msg', walkInForm).textContent = '';
    if ($('#regCampaign').value) walkInForm.campaignId.value = $('#regCampaign').value;
    syncWalkInMode();
    walkInDialog.showModal();
  });
  // Default the participation mode to what the chosen campaign supports.
  function syncWalkInMode() {
    const c = RN.campaign(walkInForm.campaignId.value);
    if (!c) return;
    const sel = walkInForm.participation;
    Array.from(sel.options).forEach(o => { o.disabled = c.mode !== 'hybrid' && o.value !== c.mode; });
    if (c.mode !== 'hybrid') sel.value = c.mode;
  }
  walkInForm.campaignId.addEventListener('change', syncWalkInMode);
  walkInForm.addEventListener('submit', e => {
    e.preventDefault();
    if (e.submitter && e.submitter.value === 'cancel') { walkInDialog.close(); return; }
    const msg = $('.form-msg', walkInForm);
    if (!walkInForm.checkValidity()) {
      walkInForm.classList.add('was-validated');
      msg.textContent = 'Please fill in the required fields.';
      return;
    }
    const data = Object.fromEntries(new FormData(walkInForm));
    const c = RN.campaign(data.campaignId);
    // Admins may add walk-ins even after online registration closes.
    const wasStatus = c && c.status;
    if (c && c.status !== 'open') RN.saveCampaign({ id: c.id, status: 'open' });
    const res = RN.register(Object.assign({}, data, { source: 'walk-in' }));
    if (c && wasStatus !== 'open') RN.saveCampaign({ id: c.id, status: wasStatus });
    if (!res.ok) { msg.textContent = res.error; return; }
    if (data.markAttended) RN.updateRegistration(res.registration.id, { status: 'attended' });
    walkInDialog.close();
    toast(res.registration.name + ' added (' + res.registration.id + ')');
    render();
  });

  // ---------- Certificates ----------
  function renderCerts() {
    const q = $('#certSearch').value.trim().toLowerCase();
    const list = RN.certificates().filter(c => !q || (c.id + ' ' + c.name + ' ' + c.campaignTitle).toLowerCase().includes(q));
    $('#certTable').innerHTML =
      '<thead><tr><th>Certificate ID</th><th>Recipient</th><th>Campaign</th><th>Issued</th><th>Status</th><th class="right">Actions</th></tr></thead><tbody>' +
      (list.length ? list.map(c =>
        '<tr data-id="' + esc(c.id) + '">' +
          '<td><code>' + esc(c.id) + '</code></td>' +
          '<td><strong>' + esc(c.name) + '</strong></td>' +
          '<td>' + esc(c.campaignTitle) + '</td>' +
          '<td>' + short(c.issuedAt) + '</td>' +
          '<td>' + (c.revoked ? '<span class="pill pill-revoked">Revoked</span>' : '<span class="pill pill-certified">Valid</span>') + '</td>' +
          '<td class="right actions-cell">' +
            '<button class="icon-btn" data-act="view">View / print</button>' +
            (c.revoked ? '' : '<button class="icon-btn danger" data-act="revoke">Revoke</button>') +
          '</td></tr>'
      ).join('') : '<tr><td colspan="6" class="empty-row">No certificates yet. Mark participants as attended, then issue certificates from Registrations.</td></tr>') + '</tbody>';
  }
  $('#certSearch').addEventListener('input', renderCerts);
  $('#certTable').addEventListener('click', e => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const id = btn.closest('tr').dataset.id;
    if (btn.dataset.act === 'view') showCert(RN.certificate(id));
    if (btn.dataset.act === 'revoke' && confirm('Revoke certificate ' + id + '? Verification will show it as revoked.')) {
      RN.revokeCertificate(id);
      toast('Certificate revoked');
      render();
    }
  });
  $('#exportCerts').addEventListener('click', () => {
    const rows = [['Certificate ID', 'Name', 'Campaign', 'Campaign date', 'Hours', 'Issued at', 'Status', 'Verification URL']];
    RN.certificates().forEach(c => rows.push([c.id, c.name, c.campaignTitle, c.campaignDate, c.hours, c.issuedAt, c.revoked ? 'revoked' : 'valid', verifyURL(c.id)]));
    downloadFile('certificates-' + new Date().toISOString().slice(0, 10) + '.csv', toCSV(rows), 'text/csv');
  });

  const certDialog = $('#certDialog');
  let shownCert = null;
  function showCert(cert) {
    if (!cert) return;
    shownCert = cert;
    $('#certPreview').innerHTML = RN.certificateHTML(cert);
    certDialog.showModal();
  }
  $('#closeCert').addEventListener('click', () => certDialog.close());
  $('#printCert').addEventListener('click', () => window.print());
  $('#copyVerify').addEventListener('click', () => {
    if (!shownCert) return;
    const url = verifyURL(shownCert.id);
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject())
      .then(() => toast('Verification link copied'))
      .catch(() => prompt('Copy this verification link:', url));
  });

  // ---------- Enquiries ----------
  function renderEnquiries() {
    const list = RN.enquiries();
    const fresh = list.filter(e => e.status === 'new').length;
    const badge = $('#enqBadge');
    badge.hidden = !fresh;
    badge.textContent = fresh;
    $('#enqTable').innerHTML =
      '<thead><tr><th>Client</th><th>Contact</th><th>Interest</th><th>Assets</th><th>Received</th><th>Status</th><th class="right"></th></tr></thead><tbody>' +
      (list.length ? list.map(e =>
        '<tr data-id="' + esc(e.id) + '">' +
          '<td><strong>' + esc(e.name) + '</strong></td>' +
          '<td>' + esc(e.email) + '<small>' + esc(e.phone) + '</small></td>' +
          '<td>' + esc(e.interest) + '</td>' +
          '<td>' + esc(e.assets) + '</td>' +
          '<td>' + short(e.createdAt) + '</td>' +
          '<td><select class="status-select" data-act="status">' +
            ['new', 'contacted', 'onboarded', 'declined'].map(s => '<option value="' + s + '"' + (e.status === s ? ' selected' : '') + '>' + STATUS_LABEL[s] + '</option>').join('') +
          '</select></td>' +
          '<td class="right"><button class="icon-btn" data-act="view">Open</button></td>' +
        '</tr>'
      ).join('') : '<tr><td colspan="7" class="empty-row">No enquiries yet.</td></tr>') + '</tbody>';
  }
  $('#enqTable').addEventListener('change', e => {
    if (e.target.dataset.act !== 'status') return;
    RN.updateEnquiry(e.target.closest('tr').dataset.id, { status: e.target.value });
    toast('Enquiry updated');
    renderEnquiries();
  });
  $('#enqTable').addEventListener('click', e => {
    const btn = e.target.closest('[data-act="view"]');
    if (!btn) return;
    const enq = RN.enquiries().find(x => x.id === btn.closest('tr').dataset.id);
    $('#enqDetail').innerHTML =
      '<h2>' + esc(enq.name) + '</h2>' +
      '<dl class="detail">' +
        '<dt>Email</dt><dd><a href="mailto:' + esc(enq.email) + '">' + esc(enq.email) + '</a></dd>' +
        '<dt>Phone</dt><dd>' + esc(enq.phone || '—') + '</dd>' +
        '<dt>Interest</dt><dd>' + esc(enq.interest) + '</dd>' +
        '<dt>Investable assets</dt><dd>' + esc(enq.assets) + '</dd>' +
        '<dt>Received</dt><dd>' + esc(new Date(enq.createdAt).toLocaleString()) + '</dd>' +
      '</dl>' +
      '<h3>Message</h3><p class="message">' + (esc(enq.message) || '<em class="muted">No message</em>') + '</p>';
    $('#enqDialog').showModal();
  });

  // ---------- Settings ----------
  const credForm = $('#credForm');
  credForm.addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('.form-msg', credForm);
    msg.className = 'form-msg';
    const d = Object.fromEntries(new FormData(credForm));
    if (!credForm.checkValidity()) { msg.textContent = 'Enter a valid email, and your current password. New passwords need 10+ characters.'; msg.classList.add('is-error'); return; }
    if (d.newPassword && d.newPassword !== d.confirm) { msg.textContent = 'New passwords do not match.'; msg.classList.add('is-error'); return; }
    const ok = await RN.changeCredentials(d.current, d.email, d.newPassword);
    if (!ok) { msg.textContent = 'Current password is incorrect.'; msg.classList.add('is-error'); return; }
    credForm.reset();
    credForm.email.value = RN.admin().email;
    msg.textContent = 'Account updated.';
    msg.classList.add('is-success');
    renderWho();
  });

  $('#backupBtn').addEventListener('click', () => {
    const data = {
      exportedAt: new Date().toISOString(),
      campaigns: RN.campaigns(),
      registrations: RN.registrations(),
      certificates: RN.certificates(),
      enquiries: RN.enquiries()
    };
    downloadFile('royalty-nexus-backup-' + data.exportedAt.slice(0, 10) + '.json', JSON.stringify(data, null, 2), 'application/json');
  });
  $('#resetBtn').addEventListener('click', async () => {
    if (!confirm('Erase ALL campaigns, registrations, certificates and enquiries in this browser and restore the demo data? The admin password is also reset to the default.')) return;
    await RN.resetAll();
    RN.logout();
    location.replace('login.html');
  });

  function renderWho() {
    const a = RN.admin();
    $('#whoami').textContent = a ? a.email : '';
    if (a && !credForm.email.value) credForm.email.value = a.email;
  }

  // ---------- Render ----------
  function render() {
    renderEnquiries(); // keeps the sidebar badge current
    switch (currentView) {
      case 'overview': renderOverview(); break;
      case 'campaigns': renderCampaigns(); break;
      case 'registrations': renderRegs(); break;
      case 'certificates': renderCerts(); break;
    }
  }

  // Refresh when another tab (e.g. the public site) changes data.
  window.addEventListener('storage', e => { if (e.key && e.key.startsWith('rn.')) render(); });

  RN.ready.then(() => {
    renderWho();
    fillCampaignSelects();
    render();
  });
})();
