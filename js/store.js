/*
 * Royalty Nexus — data layer.
 *
 * All data lives in the browser's localStorage so the site runs as plain
 * static files. Every read/write goes through the RN object, so swapping in
 * a real backend (Supabase, Firebase, a REST API) only means reimplementing
 * the functions below — the pages never touch localStorage directly.
 */
(function () {
  'use strict';

  const PREFIX = 'rn.';
  const KEYS = {
    campaigns: 'campaigns',
    registrations: 'registrations',
    certificates: 'certificates',
    enquiries: 'enquiries',
    admin: 'admin',
    seeded: 'seeded.v1'
  };

  // Default admin account. The password is stored only as a SHA-256 hash.
  // Default password: RoyalNexus@2026 — change it from Admin → Settings.
  const DEFAULT_ADMIN = {
    email: 'admin@royaltynexus.org',
    name: 'Foundation Administrator'
  };
  const DEFAULT_PASSWORD = 'RoyalNexus@2026';

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('Royalty Nexus: storage unavailable', e);
      return false;
    }
  }

  function uid(prefix) {
    const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
    const time = Date.now().toString(36).slice(-4).toUpperCase();
    return prefix + '-' + time + rand;
  }

  async function sha256(text) {
    const data = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fmtDate(iso, opts) {
    if (!iso) return '';
    const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('en-GB', opts || { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function daysFromNow(n) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }

  const SEED_CAMPAIGNS = [
    {
      title: 'Million Roots Reforestation Drive',
      category: 'Reforestation',
      mode: 'offline',
      date: daysFromNow(18),
      time: '07:00',
      location: 'Western Ghats Buffer Zone, Base Camp 3',
      link: '',
      capacity: 400,
      hours: 6,
      description: 'Join field teams planting native saplings across degraded slopes. Tools, saplings, breakfast and transport from the city pickup points are provided.'
    },
    {
      title: 'Clean Rivers Citizen Science Week',
      category: 'Water',
      mode: 'hybrid',
      date: daysFromNow(26),
      time: '09:30',
      location: 'Riverside Commons + Live Online',
      link: 'https://meet.example.org/clean-rivers',
      capacity: 250,
      hours: 4,
      description: 'Learn to test water quality, log samples and map pollution sources. Attend the river walk in person, or join the online lab session and test with a home kit.'
    },
    {
      title: 'Climate Literacy Masterclass',
      category: 'Education',
      mode: 'online',
      date: daysFromNow(9),
      time: '18:00',
      location: 'Online',
      link: 'https://meet.example.org/climate-literacy',
      capacity: 1000,
      hours: 3,
      description: 'A three-part live masterclass on climate science, local adaptation and practical household action, led by foundation fellows. Certificate on completion.'
    },
    {
      title: 'Coastal Mangrove Restoration',
      category: 'Wildlife',
      mode: 'offline',
      date: daysFromNow(40),
      time: '06:30',
      location: 'Estuary Field Station, North Shore',
      link: '',
      capacity: 150,
      hours: 5,
      description: 'Restore mangrove belts that shelter fish nurseries and protect coastal villages. Suitable for ages 14+; waders and gloves provided.'
    }
  ];

  const RN = {
    esc,
    fmtDate,
    uid,
    sha256,

    async init() {
      if (read(KEYS.seeded, false)) return;
      const now = new Date().toISOString();
      const campaigns = SEED_CAMPAIGNS.map(c => Object.assign({ id: uid('CMP'), status: 'open', createdAt: now }, c));
      write(KEYS.campaigns, campaigns);
      write(KEYS.registrations, []);
      write(KEYS.certificates, []);
      write(KEYS.enquiries, []);
      const admin = Object.assign({}, DEFAULT_ADMIN, { passwordHash: await sha256(DEFAULT_PASSWORD) });
      write(KEYS.admin, admin);
      write(KEYS.seeded, true);
    },

    async resetAll() {
      Object.values(KEYS).forEach(k => localStorage.removeItem(PREFIX + k));
      await RN.init();
    },

    /* ---------- Campaigns ---------- */
    campaigns() {
      return read(KEYS.campaigns, []).slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    },
    campaign(id) {
      return read(KEYS.campaigns, []).find(c => c.id === id) || null;
    },
    openCampaigns() {
      return RN.campaigns().filter(c => c.status === 'open');
    },
    saveCampaign(data) {
      const list = read(KEYS.campaigns, []);
      if (data.id) {
        const i = list.findIndex(c => c.id === data.id);
        if (i >= 0) list[i] = Object.assign({}, list[i], data);
      } else {
        data = Object.assign({ id: uid('CMP'), status: 'open', createdAt: new Date().toISOString() }, data);
        list.push(data);
      }
      write(KEYS.campaigns, list);
      return data;
    },
    deleteCampaign(id) {
      write(KEYS.campaigns, read(KEYS.campaigns, []).filter(c => c.id !== id));
      write(KEYS.registrations, read(KEYS.registrations, []).filter(r => r.campaignId !== id));
    },

    /* ---------- Registrations ---------- */
    registrations(campaignId) {
      const all = read(KEYS.registrations, []);
      return (campaignId ? all.filter(r => r.campaignId === campaignId) : all)
        .slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    registration(id) {
      return read(KEYS.registrations, []).find(r => r.id === id) || null;
    },
    seatsTaken(campaignId) {
      return read(KEYS.registrations, []).filter(r => r.campaignId === campaignId).length;
    },
    /** Returns { ok, registration } or { ok:false, error } */
    register(data) {
      const campaign = RN.campaign(data.campaignId);
      if (!campaign) return { ok: false, error: 'That campaign no longer exists.' };
      if (campaign.status !== 'open') return { ok: false, error: 'Registration for this campaign is closed.' };
      const list = read(KEYS.registrations, []);
      const email = String(data.email || '').trim().toLowerCase();
      if (list.some(r => r.campaignId === campaign.id && r.email === email)) {
        return { ok: false, error: 'This email is already registered for this campaign.' };
      }
      if (campaign.capacity && list.filter(r => r.campaignId === campaign.id).length >= Number(campaign.capacity)) {
        return { ok: false, error: 'This campaign is fully booked.' };
      }
      const reg = {
        id: uid('REG'),
        campaignId: campaign.id,
        name: String(data.name || '').trim(),
        email,
        phone: String(data.phone || '').trim(),
        city: String(data.city || '').trim(),
        participation: data.participation || (campaign.mode === 'online' ? 'online' : 'offline'),
        ageGroup: data.ageGroup || '',
        source: data.source || 'website',
        status: 'registered',
        createdAt: new Date().toISOString()
      };
      list.push(reg);
      write(KEYS.registrations, list);
      return { ok: true, registration: reg };
    },
    updateRegistration(id, patch) {
      const list = read(KEYS.registrations, []);
      const i = list.findIndex(r => r.id === id);
      if (i < 0) return null;
      list[i] = Object.assign({}, list[i], patch);
      write(KEYS.registrations, list);
      return list[i];
    },
    deleteRegistration(id) {
      write(KEYS.registrations, read(KEYS.registrations, []).filter(r => r.id !== id));
    },

    /* ---------- Certificates ---------- */
    certificates() {
      return read(KEYS.certificates, []).slice().sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
    },
    certificate(id) {
      const key = String(id || '').trim().toUpperCase();
      return read(KEYS.certificates, []).find(c => c.id === key) || null;
    },
    certificateForRegistration(regId) {
      return read(KEYS.certificates, []).find(c => c.registrationId === regId && !c.revoked) || null;
    },
    issueCertificate(regId, opts) {
      const reg = RN.registration(regId);
      if (!reg) return null;
      const existing = RN.certificateForRegistration(regId);
      if (existing) return existing;
      const campaign = RN.campaign(reg.campaignId) || {};
      const cert = {
        id: 'RN-' + new Date().getFullYear() + '-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
        registrationId: reg.id,
        campaignId: reg.campaignId,
        name: reg.name,
        campaignTitle: campaign.title || 'Environmental Campaign',
        category: campaign.category || '',
        campaignDate: campaign.date || '',
        hours: (opts && opts.hours) || campaign.hours || '',
        participation: reg.participation,
        issuedAt: new Date().toISOString(),
        revoked: false
      };
      const list = read(KEYS.certificates, []);
      list.push(cert);
      write(KEYS.certificates, list);
      RN.updateRegistration(reg.id, { status: 'certified' });
      return cert;
    },
    revokeCertificate(id) {
      const list = read(KEYS.certificates, []);
      const c = list.find(x => x.id === id);
      if (!c) return;
      c.revoked = true;
      c.revokedAt = new Date().toISOString();
      write(KEYS.certificates, list);
      RN.updateRegistration(c.registrationId, { status: 'attended' });
    },

    /* ---------- Private wealth enquiries ---------- */
    enquiries() {
      return read(KEYS.enquiries, []).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    addEnquiry(data) {
      const list = read(KEYS.enquiries, []);
      const e = Object.assign({ id: uid('ENQ'), status: 'new', createdAt: new Date().toISOString() }, data);
      list.push(e);
      write(KEYS.enquiries, list);
      return e;
    },
    updateEnquiry(id, patch) {
      const list = read(KEYS.enquiries, []);
      const i = list.findIndex(e => e.id === id);
      if (i >= 0) {
        list[i] = Object.assign({}, list[i], patch);
        write(KEYS.enquiries, list);
      }
    },

    /* ---------- Admin auth (client-side demo) ---------- */
    admin() {
      return read(KEYS.admin, null);
    },
    async login(email, password) {
      const admin = RN.admin();
      if (!admin) return false;
      const hash = await sha256(password);
      if (admin.email.toLowerCase() === String(email).trim().toLowerCase() && admin.passwordHash === hash) {
        sessionStorage.setItem(PREFIX + 'session', JSON.stringify({ email: admin.email, at: Date.now() }));
        return true;
      }
      return false;
    },
    logout() {
      sessionStorage.removeItem(PREFIX + 'session');
    },
    session() {
      try {
        const s = JSON.parse(sessionStorage.getItem(PREFIX + 'session') || 'null');
        // Sessions expire after 8 hours.
        if (s && Date.now() - s.at < 8 * 3600 * 1000) return s;
      } catch (e) { /* ignore */ }
      return null;
    },
    async changeCredentials(currentPassword, newEmail, newPassword) {
      const admin = RN.admin();
      if (!admin || admin.passwordHash !== await sha256(currentPassword)) return false;
      if (newEmail) admin.email = newEmail.trim();
      if (newPassword) admin.passwordHash = await sha256(newPassword);
      write(KEYS.admin, admin);
      return true;
    },

    /* ---------- Certificate markup (shared by admin, certificate & verify pages) ---------- */
    certificateHTML(cert) {
      const e = esc;
      const hours = cert.hours ? ' contributing <strong>' + e(cert.hours) + ' hours</strong> of service' : '';
      const mode = cert.participation === 'online' ? 'online' : 'in the field';
      return (
        '<div class="certificate' + (cert.revoked ? ' is-revoked' : '') + '">' +
          '<div class="cert-border">' +
            '<svg class="cert-leaf" viewBox="0 0 64 64" aria-hidden="true"><path d="M32 6c14 10 20 22 18 34-2 10-10 16-18 18-8-2-16-8-18-18C12 28 18 16 32 6z" fill="currentColor" opacity=".18"/><path d="M32 12v46M32 26l-8-7M32 34l10-9M32 44l-10-8" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>' +
            '<p class="cert-org">Royalty Nexus Foundation Trust</p>' +
            '<h2 class="cert-title">Certificate of Participation</h2>' +
            '<p class="cert-sub">This certificate is proudly presented to</p>' +
            '<p class="cert-name">' + e(cert.name) + '</p>' +
            '<p class="cert-body">for participating ' + mode + ' in <strong>' + e(cert.campaignTitle) + '</strong>' +
              (cert.campaignDate ? ' on ' + e(fmtDate(cert.campaignDate)) : '') + hours +
              ' towards the restoration and protection of our natural world.</p>' +
            '<div class="cert-foot">' +
              '<div><span class="cert-line"></span><span>Chair, Board of Trustees</span></div>' +
              '<div class="cert-seal" aria-hidden="true"><span>RN</span></div>' +
              '<div><span class="cert-line"></span><span>Issued ' + e(fmtDate(cert.issuedAt)) + '</span></div>' +
            '</div>' +
            '<p class="cert-id">Certificate ID <strong>' + e(cert.id) + '</strong> · verify at royaltynexus.org/verify</p>' +
            (cert.revoked ? '<div class="cert-void">REVOKED</div>' : '') +
          '</div>' +
        '</div>'
      );
    }
  };

  window.RN = RN;
  RN.ready = RN.init();
})();
