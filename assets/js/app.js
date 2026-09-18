/* ==========================================================================
   SkillBridge — app.js
   Runs on EVERY page. Responsibilities:

   1. Define BASE (root-relative path helper, because pages live in /pages/…)
   2. Seed sample data on first run (initializeData from storage.js)
   3. Guard the page using <body data-role="…"> and redirect if needed
   4. Render the shared layout: topbar + role-based sidebar navigation
   5. Wire the notification bell and logout buttons

   Pages declare who they belong to, e.g.:
     <body data-page="jobs" data-role="seeker">       (protected)
     <body data-page="home" data-role="public">       (landing/login/register)
   ========================================================================== */

/* Works both at root level and inside /pages/job-seeker/ etc. */
window.BASE = window.location.pathname.includes('/pages/') ? '../../' : './';

document.addEventListener('DOMContentLoaded', () => {

  initializeData();

  const body = document.body;
  const page = body.dataset.page || '';
  const requiredRole = body.dataset.role || 'public';
  let user = getCurrentUser();

  /* ---------------------------- access guard ----------------------------- */
  if ((page === 'login' || page === 'register') && user) {
    window.location.href = Auth.homeUrl(user.role); // already logged in
    return;
  }
  if (requiredRole !== 'public') {
    if (!user) { window.location.href = BASE + 'login.html'; return; }
    if (user.role !== requiredRole) {
      window.location.href = Auth.homeUrl(user.role); // wrong role → own dashboard
      return;
    }
  }

  renderTopbar(user);
  if (requiredRole !== 'public') renderSidebar(user, page);

  Notifications.refreshBellDot();

  initReveal();
});

/* ------------------------- subtle scroll reveal --------------------------- */
/* Elements with data-reveal fade-slide in the first time they enter view.   */
/* This is opt-in (progressive enhancement) and respects reduced-motion.     */
function initReveal() {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    return;
  const els = document.querySelectorAll('[data-reveal]');
  if (!els.length || !('IntersectionObserver' in window)) {
    els.forEach(el => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting) {
        en.target.classList.add('in');
        io.unobserve(en.target);
      }
    });
  }, { threshold: .12 });
  els.forEach(el => { el.classList.add('reveal'); io.observe(el); });
}

/* ------------------------------ topbar ----------------------------------- */
function renderTopbar(user) {
  const bar = document.getElementById('topbar');
  if (!bar) return;

  const brandTarget = user ? BASE + Auth.ROLE_HOME[user.role] : BASE + 'index.html';

  bar.innerHTML = `
    <button class="menu-btn" id="menu-btn" aria-label="Open menu"><i class="fa-solid fa-bars"></i></button>
    <a class="brand" href="${brandTarget}">
      <i class="fa-solid fa-bridge"></i><span class="brand-text">SkillBridge</span>
    </a>
    <span class="spacer"></span>
    ${!user ? `
      <a class="btn btn-outline-light btn-sm" href="${BASE}login.html"><i class="fa-solid fa-right-to-bracket"></i> Log In</a>
      <a class="btn btn-sky btn-sm" href="${BASE}register.html"><i class="fa-solid fa-user-plus"></i> Sign Up</a>
    ` : `
      <button class="icon-btn" id="bell-btn" aria-label="Notifications">
        <i class="fa-solid fa-bell"></i>
        <span class="notif-dot" id="notif-dot" style="display:none">0</span>
      </button>
      <span class="user-chip">
        <span>${UI.esc(user.fullName)}<small>${Auth.ROLE_LABEL[user.role]}</small></span>
        <span class="avatar">${UI.initials(user.fullName)}</span>
      </span>
      <button class="icon-btn" id="logout-btn-top" title="Log out"><i class="fa-solid fa-right-from-bracket"></i></button>
    `}
  `;

  const menuBtn = document.getElementById('menu-btn');
  if (menuBtn) menuBtn.onclick = () => document.body.classList.toggle('sidebar-open');

  const bellBtn = document.getElementById('bell-btn');
  if (bellBtn) {
    bellBtn.onclick = e => { e.stopPropagation(); Notifications.togglePanel(); };
  }

  const logoutTop = document.getElementById('logout-btn-top');
  if (logoutTop) logoutTop.onclick = confirmLogout;

  // click anywhere else closes the notification panel
  document.addEventListener('click', () => {
    const panel = document.getElementById('notif-panel');
    if (panel) panel.classList.remove('open');
  });
}

function confirmLogout() {
  UI.confirmDialog('Log out of SkillBridge?', 'Log out').then(ok => {
    if (ok) logoutUser(); // storage.js helper — clears session only
  });
}

/* ------------------------------ sidebar ---------------------------------- */
const SIDEBAR_NAV = {
  seeker: [
    ['Dashboard',        'pages/job-seeker/dashboard.html',       'fa-house'],
    ['Find Jobs',        'pages/job-seeker/jobs.html',            'fa-magnifying-glass'],
    ['Recommendations',  'pages/job-seeker/recommendations.html', 'fa-wand-magic-sparkles'],
    ['My Applications',  'pages/job-seeker/applications.html',    'fa-file-lines'],
    ['Resume',           'pages/job-seeker/resume.html',          'fa-file-pdf'],
    ['Profile',          'pages/job-seeker/profile.html',         'fa-user'],
    ['Training',         'pages/job-seeker/training.html',        'fa-graduation-cap'],
    ['Livelihood & Assistance', 'pages/job-seeker/livelihood.html','fa-seedling']
  ],
  employer: [
    ['Dashboard',       'pages/employer/dashboard.html',  'fa-chart-line'],
    ['My Jobs',         'pages/employer/jobs.html',       'fa-briefcase'],
    ['Post a Job',      'pages/employer/post-job.html',   'fa-circle-plus'],
    ['Applicants',      'pages/employer/applicants.html', 'fa-users'],
    ['Company Profile', 'pages/employer/profile.html',    'fa-building']
  ],
  admin: [
    ['Dashboard',  'pages/admin/dashboard.html',  'fa-chart-pie'],
    ['Users',      'pages/admin/users.html',      'fa-users-gear'],
    ['Employers',  'pages/admin/employers.html',  'fa-building-shield'],
    ['Jobs',       'pages/admin/jobs.html',       'fa-list-check'],
    ['Programs',   'pages/admin/programs.html',   'fa-hand-holding-heart'],
    ['Reports',    'pages/admin/reports.html',    'fa-file-export']
  ]
};

function renderSidebar(user, activePage) {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  const links = SIDEBAR_NAV[user.role] || [];
  sidebar.innerHTML = `
    <div class="side-label">${Auth.ROLE_LABEL[user.role].toUpperCase()} MENU</div>
    ${links.map(([label, href, icon]) => `
      <a class="side-link ${href.endsWith(activePage + '.html') ? 'active' : ''}"
         href="${BASE}${href}">
        <i class="fa-solid ${icon}"></i> ${label}
      </a>`).join('')}
    <div class="side-label mt-2">ACCOUNT</div>
    <a class="side-link" href="#" id="logout-link"><i class="fa-solid fa-right-from-bracket"></i> Log out</a>

    <div class="side-tools">
      <button class="btn btn-ghost btn-sm" id="export-data"
              title="Download all SkillBridge data as a JSON backup file">
        <i class="fa-solid fa-download"></i> Export data
      </button>
      <button class="btn btn-ghost btn-sm" id="import-data"
              title="Restore data from a backup JSON file">
        <i class="fa-solid fa-upload"></i> Import data
      </button>
      <button class="btn btn-ghost btn-sm" id="reset-demo-data"
              title="Wipe all local data and restore the original demo dataset">
        <i class="fa-solid fa-rotate-left"></i> Reset demo data
      </button>
    </div>
  `;

  sidebar.querySelector('#logout-link').onclick = e => { e.preventDefault(); confirmLogout(); };

  sidebar.querySelector('#export-data').onclick = () => {
    Data.download();
    UI.toast('Backup downloaded!');
  };

  sidebar.querySelector('#import-data').onclick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const text = await file.text();
      const ok = await UI.confirmDialog(
        'Importing replaces ALL current SkillBridge data with the contents of this backup. Continue?',
        'Import & replace');
      if (!ok) return;
      try {
        const count = Data.import(text);
        UI.toast(`Imported ${count} collections. Reloading…`, 'success');
        setTimeout(() => window.location.reload(), 700);
      } catch (err) {
        UI.toast(err.message, 'error');
      }
    };
    input.click();
  };

  // handy during demos: wipe everything and start fresh
  sidebar.querySelector('#reset-demo-data').onclick = async () => {
    if (await UI.confirmDialog(
        'This deletes ALL local SkillBridge data (accounts, jobs, applications…) and restores the demo dataset. Continue?',
        'Reset everything')) {
      Storage.clear();
      window.location.href = BASE + 'index.html';
    }
  };

  // tap outside closes the mobile drawer
  if (!document.querySelector('.sidebar-backdrop')) {
    const backdrop = document.createElement('div');
    backdrop.className = 'sidebar-backdrop';
    backdrop.onclick = () => document.body.classList.remove('sidebar-open');
    document.body.appendChild(backdrop);
  }
}
