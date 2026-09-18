/* ==========================================================================
   SkillBridge — ui.js
   Small reusable UI helpers used by every page: safe HTML escaping,
   formatting, toasts, modals, confirmation dialogs, badges, empty states.
   ========================================================================== */

const UI = {
  /* Escape user content before putting it inside innerHTML (prevents broken
     layout and basic XSS when users type < > " characters). */
  esc(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  },

  /* ₱12,000 – ₱15,000/month */
  peso(min, max, type = 'month') {
    const f = n => '₱' + Number(n || 0).toLocaleString('en-PH');
    if (!min && !max) return 'Salary negotiable';
    if (min && max) return `${f(min)} – ${f(max)}/${type}`;
    return `${f(min || max)}/${type}`;
  },

  /* "Aug 23, 2026" */
  fmtDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
  },

  /* "3 days ago" */
  timeAgo(dateStr) {
    const sec = Math.max(1, Math.floor((Date.now() - new Date(dateStr)) / 1000));
    if (sec < 3600) return Math.floor(sec / 60) + ' min ago';
    if (sec < 86400) return Math.floor(sec / 3600) + ' hr ago';
    const d = Math.floor(sec / 86400);
    return d === 1 ? 'yesterday' : `${d} days ago`;
  },

  initials(name = '?') {
    return String(name).trim().split(/\s+/).slice(0, 2)
      .map(w => w[0] || '').join('').toUpperCase();
  },

  /* Colored badge matching any known status word */
  statusBadge(status) {
    const cls = String(status || '').toLowerCase().replace(/\s+/g, '-');
    return `<span class="badge badge-${UI.esc(cls)}">${UI.esc(status)}</span>`;
  },

  /* Subtitle may contain trusted HTML (e.g. quick links) — callers control it. */
  emptyState(icon, title, subtitle = '') {
    return `
      <div class="empty-state">
        <i class="fa-solid ${icon}"></i>
        <strong>${UI.esc(title)}</strong>
        ${subtitle ? `<span>${subtitle}</span>` : ''}
      </div>`;
  },

  /* Floating message. type: '' | 'success' | 'error' */
  toast(message, type = '') {
    let wrap = document.getElementById('toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'toast-wrap';
      document.body.appendChild(wrap);
    }
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = message;
    wrap.appendChild(t);
    setTimeout(() => t.remove(), 3400);
  },

  /* Modal helper. Returns {root, close}. Bottom-sheet on mobile by default. */
  openModal(title, bodyHtml) {
    let backdrop = document.getElementById('sb-modal');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'sb-modal';
      backdrop.className = 'modal-backdrop';
      backdrop.innerHTML = `<div class="modal" role="dialog" aria-modal="true">
        <div class="modal-head">
          <h2 class="m-title"></h2>
          <button class="modal-close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="m-body"></div>
      </div>`;
      document.body.appendChild(backdrop);
    }
    backdrop.querySelector('.m-title').textContent = title;
    backdrop.querySelector('.m-body').innerHTML = bodyHtml;
    backdrop.classList.add('open');
    const close = () => backdrop.classList.remove('open');
    backdrop.querySelector('.modal-close').onclick = close;
    backdrop.onclick = e => { if (e.target === backdrop) close(); };
    return { root: backdrop.querySelector('.modal'), close };
  },

  /* Promise-based confirm dialog: await confirmDialog('Delete?') → true/false */
  confirmDialog(message, okLabel = 'Yes, continue') {
    return new Promise(resolve => {
      const m = UI.openModal('Please confirm', `
        <p>${UI.esc(message)}</p>
        <div class="btn-row mt-2">
          <button class="btn btn-danger" id="cfOk">${UI.esc(okLabel)}</button>
          <button class="btn btn-ghost" id="cfNo">Cancel</button>
        </div>`);
      m.root.querySelector('#cfOk').onclick = () => { m.close(); resolve(true); };
      m.root.querySelector('#cfNo').onclick = () => { m.close(); resolve(false); };
    });
  },

  /* Read URL query parameter, e.g. getParam('id') */
  getParam(name) {
    return new URLSearchParams(location.search).get(name);
  },

  debounce(fn, ms = 250) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
  },

  /* Days left until a deadline string (YYYY-MM-DD); negative = past */
  daysLeft(deadline) {
    if (!deadline) return Infinity;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.ceil((new Date(deadline) - today) / 864e5);
  }
};
