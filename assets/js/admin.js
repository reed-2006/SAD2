/* ==========================================================================
   SkillBridge — admin.js
   Platform administration:

   dashboard  — live counts from every collection
   users      — view / activate / deactivate job seekers
   employers  — verify (approve) or reject employer accounts
   jobs       — approve / reject job postings
   programs   — create & delete training/livelihood catalog entries
   reports    — platform statistics + download JSON snapshot

   All actions write straight to LocalStorage and notify affected users.
   ========================================================================== */

const AdminPage = {

  requireAdmin() { return Auth.requireRole('admin'); },

  /* ------------------------------ DASHBOARD ------------------------------- */
  initDashboard() {
    if (!this.requireAdmin()) return;

    const jobs = Jobs.get();
    const apps = Applications.get();
    const users = Storage.get(KEYS.USERS);

    const stats = [
      ['Total Users', users.length, 'fa-users', '#2563EB'],
      ['Job Seekers', users.filter(u => u.role === 'seeker').length, 'fa-user-tie', '#38BDF8'],
      ['Employers', users.filter(u => u.role === 'employer').length, 'fa-building', '#0F172A'],
      ['Jobs Posted', jobs.length, 'fa-briefcase', '#2563EB'],
      ['Active Jobs', jobs.filter(j => j.status === 'Active').length, 'fa-circle-check', '#10B981'],
      ['Pending Approval', jobs.filter(j => j.status === 'Pending').length, 'fa-hourglass-half', '#F59E0B'],
      ['Applications', apps.length, 'fa-file-lines', '#38BDF8'],
      ['Trainings/Livelihoods',
        Storage.get(KEYS.TRAININGS).length + Storage.get(KEYS.LIVELIHOODS).length,
        'fa-graduation-cap', '#0F172A']
    ];

    document.getElementById('admin-stats').innerHTML = stats.map(([label, val, icon, color]) => `
      <div class="stat-card">
        <div class="stat-icon" style="background:${color}"><i class="fa-solid ${icon}"></i></div>
        <div><div class="stat-value">${val}</div><div class="stat-label">${label}</div></div>
      </div>`).join('');

    // quick action lists
    const pendingJobs = jobs.filter(j => j.status === 'Pending');
    const pendWrap = document.getElementById('admin-pending-jobs');
    pendWrap.innerHTML = pendingJobs.length === 0
      ? '<p class="muted small-text">No job postings waiting for approval. 🎉</p>'
      : pendingJobs.map(j => `
          <div class="notif-item">
            <strong>${UI.esc(j.title)}</strong> <span class="muted small-text">by ${UI.esc(j.company)}</span>
            <div class="btn-row mt-1">
              <button class="btn btn-success btn-sm js-approve" data-id="${j.id}">Approve</button>
              <button class="btn btn-danger btn-sm js-reject" data-id="${j.id}">Reject</button>
            </div>
          </div>`).join('');

    const pendingEmps = Storage.get(KEYS.USERS).filter(u => u.role === 'employer' &&
      (Auth.employerProfile(u.id)?.verificationStatus || 'Pending') !== 'Verified');
    const empWrap = document.getElementById('admin-pending-employers');
    empWrap.innerHTML = pendingEmps.length === 0
      ? '<p class="muted small-text">No employers waiting for verification.</p>'
      : pendingEmps.map(u => `
          <div class="notif-item">
            <strong>${UI.esc(u.fullName)}</strong>
            <span class="muted small-text">${UI.esc(u.email)}</span>
            <div class="btn-row mt-1">
              <a class="btn btn-outline btn-sm" href="employers.html">Review</a>
            </div>
          </div>`).join('');

    document.querySelectorAll('.js-approve').forEach(b => b.onclick = () => this.moderateJob(b.dataset.id, 'Active'));
    document.querySelectorAll('.js-reject').forEach(b => b.onclick = () => this.moderateJob(b.dataset.id, 'Rejected'));
  },

  /* ------------------------------ USERS PAGE ------------------------------ */
  initUsers() {
    if (!this.requireAdmin()) return;
    this.renderUsers();

    document.addEventListener('click', async e => {
      const btn = e.target.closest('[data-uaction]');
      if (!btn) return;
      const id = btn.dataset.id, act = btn.dataset.uaction;
      const users = Storage.get(KEYS.USERS);
      const u = users.find(x => x.id === id);
      if (!u) return;

      if (act === 'toggle') {
        u.active = !u.active;
        Storage.set(KEYS.USERS, users);
        UI.toast(`Account ${u.active ? 'activated' : 'deactivated'}.`, 'success');
        this.renderUsers();
      }
      if (act === 'delete') {
        const ok = await UI.confirmDialog(`Delete ${u.fullName}'s account permanently?`);
        if (!ok) return;
        Storage.set(KEYS.USERS, users.filter(x => x.id !== id));
        UI.toast('Account deleted.');
        this.renderUsers();
      }
    });
  },

  renderUsers() {
    const wrap = document.getElementById('users-list');
    const q = (document.getElementById('user-search')?.value || '').toLowerCase();
    let users = Storage.get(KEYS.USERS).filter(u => u.role !== 'admin');
    if (q) users = users.filter(u =>
      u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));

    wrap.innerHTML = `
      <div class="card table-wrap">
        <table class="data-table">
          <thead><tr><th>Name</th><th>Role</th><th>Email</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            ${users.map(u => `<tr>
              <td><strong>${UI.esc(u.fullName)}</strong></td>
              <td>${Auth.ROLE_LABEL[u.role] || u.role}</td>
              <td class="small-text">${UI.esc(u.email)}</td>
              <td>${u.active !== false ? '<span class="badge badge-active">Active</span>' : '<span class="badge badge-closed">Deactivated</span>'}</td>
              <td class="btn-row">
                <button class="btn btn-outline btn-sm" data-uaction="toggle" data-id="${u.id}">
                  ${u.active !== false ? 'Deactivate' : 'Activate'}</button>
                <button class="btn btn-danger btn-sm" data-uaction="delete" data-id="${u.id}">
                  <i class="fa-solid fa-trash"></i></button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  },

  /* ---------------------------- EMPLOYERS PAGE ---------------------------- */
  initEmployers() {
    if (!this.requireAdmin()) return;
    this.renderEmployers();

    document.addEventListener('click', e => {
      const btn = e.target.closest('[data-vaction]');
      if (!btn) return;
      this.setVerification(btn.dataset.id, btn.dataset.vaction);
    });
  },

  renderEmployers() {
    const wrap = document.getElementById('employers-list');
    const emps = Storage.get(KEYS.USERS).filter(u => u.role === 'employer');

    wrap.innerHTML = emps.length === 0
      ? UI.emptyState('fa-building', 'No employer accounts yet')
      : emps.map(u => {
          const profile = Auth.employerProfile(u.id) || {};
          const status = profile.verificationStatus || 'Pending';
          const myJobs = Jobs.byEmployer(u.id);
          return `
          <div class="card">
            <div class="row-between">
              <h3>${UI.esc(profile.companyName || u.fullName)}</h3>
              ${UI.statusBadge(status)}
            </div>
            <div class="meta muted small-text">
              📧 ${UI.esc(u.email)} · ☎ ${UI.esc(profile.contactNumber || '—')}<br>
              📍 ${UI.esc([profile.address, profile.barangay, profile.city].filter(Boolean).join(', ') || '—')}<br>
              📋 ${myJobs.length} job posting(s) ·
              ${Applications.byEmployer(u.id).length} application(s)
            </div>
            ${profile.description ? `<p class="mt-1">${UI.esc(profile.description)}</p>` : ''}
            <div class="btn-row mt-2">
              ${status !== 'Verified'
                ? `<button class="btn btn-success btn-sm" data-vaction="Verified" data-id="${u.id}">
                     <i class="fa-solid fa-check"></i> Verify Employer</button>`
                : ''}
              ${status !== 'Rejected'
                ? `<button class="btn btn-warning btn-sm" data-vaction="Rejected" data-id="${u.id}">
                     <i class="fa-solid fa-xmark"></i> Reject</button>`
                : ''}
              <button class="btn btn-outline btn-sm" data-vaction="Pending" data-id="${u.id}">Reset to Pending</button>
            </div>
          </div>`;
        }).join('');
  },

  setVerification(userId, status) {
    const profiles = Storage.get(KEYS.EMPLOYERS);
    const p = profiles.find(x => x.userId === userId);
    if (!p) return;
    p.verificationStatus = status;
    Storage.set(KEYS.EMPLOYERS, profiles);

    const user = Storage.get(KEYS.USERS).find(u => u.id === userId);
    Notifications.notify(userId,
      status === 'Verified' ? 'Employer account verified ✓' : 'Verification update',
      status === 'Verified'
        ? `Your business “${p.companyName}” is now verified. You can post jobs!`
        : `Your verification is now marked “${status}”. Contact the admin for details.`,
      'status');

    UI.toast(`Marked as ${status}.`, 'success');
    this.renderEmployers();
  },

  /* ------------------------------ JOBS PAGE ------------------------------- */
  initJobsModeration() {
    if (!this.requireAdmin()) return;
    this.renderModeration();

    document.addEventListener('click', e => {
      const view = e.target.closest('.js-view');
      if (view) { Jobs.openDetails(view.dataset.id); }
    });
  },

  renderModeration() {
    const wrap = document.getElementById('moderation-list');
    const filter = document.getElementById('job-status-filter');
    filter.onchange = () => this.renderModeration();

    let jobs = Jobs.get().sort((a, b) =>
      ({ Pending: 0, Active: 1, Closed: 2, Expired: 2, Rejected: 3 })[a.status] -
      ({ Pending: 0, Active: 1, Closed: 2, Expired: 2, Rejected: 3 })[b.status]);
    if (filter.value) jobs = jobs.filter(j => j.status === filter.value);

    wrap.innerHTML = jobs.length === 0
      ? UI.emptyState('fa-clipboard-check', 'Nothing here')
      : jobs.map(j => `
        <div class="card job-card">
          <div class="row-between">
            <h3><a href="#" class="js-view" data-id="${j.id}">${UI.esc(j.title)}</a></h3>
            ${UI.statusBadge(j.status)}
          </div>
          <div class="meta muted small-text">
            ${UI.esc(j.company)} · ${UI.esc(j.barangay)}, ${UI.esc(j.location)} ·
            Posted ${UI.timeAgo(j.datePosted)} · 👁 ${j.views || 0}
          </div>
          <div class="salary">${UI.peso(j.salaryMin, j.salaryMax, j.salaryType)}</div>
          <div class="btn-row mt-2">
            ${(j.status === 'Pending' || j.status === 'Rejected')
              ? `<button class="btn btn-success btn-sm js-mod" data-id="${j.id}" data-st="Active">
                   <i class="fa-solid fa-check"></i> Approve</button>` : ''}
            ${(j.status === 'Pending' || j.status === 'Active')
              ? `<button class="btn btn-danger btn-sm js-mod" data-id="${j.id}" data-st="Rejected">
                   <i class="fa-solid fa-xmark"></i> Reject</button>` : ''}
            ${j.status === 'Active'
              ? `<button class="btn btn-warning btn-sm js-mod" data-id="${j.id}" data-st="Closed">Close</button>` : ''}
            <button class="btn btn-outline btn-sm js-del-job" data-id="${j.id}">
              <i class="fa-solid fa-trash"></i></button>
          </div>
        </div>`).join('');

    wrap.querySelectorAll('.js-mod').forEach(b =>
      b.onclick = () => this.moderateJob(b.dataset.id, b.dataset.st));

    wrap.querySelectorAll('.js-del-job').forEach(async b => {
      b.onclick = async () => {
        const ok = await UI.confirmDialog('Delete this job posting permanently?');
        if (!ok) return;
        Jobs.save(Jobs.get().filter(j => j.id !== b.dataset.id));
        UI.toast('Job deleted.');
        this.renderModeration();
      };
    });
  },

  moderateJob(jobId, status) {
    Jobs.update(jobId, { status });
    const job = Jobs.byId(jobId);

    const msgMap = {
      Active:   `Your job “${job.title}” was approved and is now visible to job seekers.`,
      Rejected: `Your job “${job.title}” was not approved. Please review the details and post again.`,
      Closed:   `Your job “${job.title}” was closed by the admin.`
    };
    if (msgMap[status])
      Notifications.notify(job.employerId,
        status === 'Active' ? 'Job approved ✓' : 'Job update', msgMap[status], 'job');

    UI.toast(`Job marked as ${status}.`, 'success');
    this.initPageRefresh();
  },

  initPageRefresh() {
    const page = document.body.dataset.page;
    if (page === 'jobs-moderation') this.renderModeration();
    else this.initDashboard(); // dashboard quick-action refresh
  },

  /* --------------------------- PROGRAMS (catalog) -------------------------- */
  initPrograms() {
    if (!this.requireAdmin()) return;
    this.renderProgramCatalog();

    const typeSel = document.getElementById('prog-type');
    const catSel = document.getElementById('prog-category');
    typeSel.onchange = () => {
      const cats = typeSel.value === 'training'
        ? ['Skills Training', 'Seminar'] : ['Livelihood', 'Assistance'];
      catSel.innerHTML = cats.map(c => `<option>${c}</option>`).join('');
    };

    document.getElementById('program-form').onsubmit = async e => {
      e.preventDefault();
      const v = id => document.getElementById(id)?.value.trim() || '';
      const n = id => Number(document.getElementById(id)?.value) || null;

      if (!v('prog-title')) return UI.toast('Please enter a program title.', 'error');

      const entry = {
        title: v('prog-title'),
        category: v('prog-category'),
        description: v('prog-desc'),
        organizer: v('prog-organizer') || 'Public Employment Service Office (PESO)',
        venue: v('prog-venue'),
        schedule: v('prog-schedule'),
        duration: v('prog-duration'),
        slots: n('prog-slots'),
        beneficiaryNote: v('prog-note')
      };

      if (typeSel.value === 'training') {
        const list = Programs.trainings();
        list.push({ id: generateId('trn_'), ...entry });
        Programs.saveTraining(list);
      } else {
        const list = Programs.livelihoods();
        list.push({ id: generateId('liv_'), ...entry });
        Programs.saveLivelihood(list);
      }

      // announce to all seekers
      Storage.get(KEYS.USERS).filter(u => u.role === 'seeker').forEach(s =>
        Notifications.notify(s.id, 'New program available!',
          `${entry.category}: ${entry.title}. Check the ${typeSel.value === 'training' ? 'Skills Training' : 'Livelihood'} page.`, 'training'));

      UI.toast('Program added to the catalog!', 'success');
      e.target.reset();
      this.renderProgramCatalog();
    };

    document.addEventListener('click', async ev => {
      const del = ev.target.closest('[data-progdel]');
      if (!del) return;
      const ok = await UI.confirmDialog('Remove this program from the catalog?');
      if (!ok) return;

      const [kind, id] = del.dataset.progdel.split('|');
      if (kind === 'trn') Programs.saveTraining(Programs.trainings().filter(p => p.id !== id));
      else Programs.saveLivelihood(Programs.livelihoods().filter(p => p.id !== id));

      UI.toast('Program removed.');
      this.renderProgramCatalog();
    });
  },

  renderProgramCatalog() {
    const wrap = document.getElementById('program-catalog-list');
    const all = [
      ...Programs.trainings().map(p => ['trn', p]),
      ...Programs.livelihoods().map(p => ['liv', p])
    ];
    wrap.innerHTML = all.length === 0
      ? '<p class="muted small-text">The catalog is empty. Add your first program above.</p>'
      : all.map(([kind, p]) => `
        <div class="notif-item row-between">
          <span><strong>${UI.esc(p.title)}</strong>
            <span class="chip">${UI.esc(p.category)}</span><br>
            <span class="muted small-text">${UI.esc(p.organizer)} · 📍${UI.esc(p.venue)}</span></span>
          <button class="btn btn-danger btn-sm" data-progdel="${kind}|${p.id}">
            <i class="fa-solid fa-trash"></i></button>
        </div>`).join('');
  },

  /* ------------------------------ REPORTS ---------------------------------- */
  initReports() {
    if (!this.requireAdmin()) return;
    this.renderReports();

    document.getElementById('dl-report').onclick = () => {
      const report = {
        generatedAt: new Date().toISOString(),
        platform: 'SkillBridge — Toledo City',
        statistics: this.buildStats(),
        topJobs: this.topJobsByApplicants(5),
        recentApplications: Applications.get()
          .slice(-10).reverse().map(a => ({
            applicant: Storage.get(KEYS.USERS).find(u => u.id === a.applicantId)?.fullName,
            job: Jobs.byId(a.jobId)?.title,
            status: a.status,
            date: a.appliedAt
          }))
      };

      Storage.set(KEYS.REPORTS, report); // keep latest snapshot in LocalStorage too
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `skillbridge-report-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      UI.toast('Report downloaded!', 'success');
    };
  },

  buildStats() {
    const users = Storage.get(KEYS.USERS);
    const jobs = Jobs.get();
    const apps = Applications.get();
    const enrolled = Storage.get(KEYS.ENROLLMENTS);

    const countBy = arr => arr.reduce((acc, x) => { acc[x] = (acc[x] || 0) + 1; return acc; }, {});
    return {
      totalUsers: users.length,
      jobSeekers: users.filter(u => u.role === 'seeker').length,
      employers: users.filter(u => u.role === 'employer').length,
      verifiedEmployers: Storage.get(KEYS.EMPLOYERS).filter(e => e.verificationStatus === 'Verified').length,
      totalJobs: jobs.length,
      activeJobs: jobs.filter(j => j.status === 'Active').length,
      pendingJobs: jobs.filter(j => j.status === 'Pending').length,
      totalApplications: apps.length,
      applicationsByStatus: countBy(apps.map(a => a.status)),
      savedJobsCount: Storage.get(KEYS.SAVED_JOBS).length,
      trainingEnrollments: enrolled.length,
      trainingsOffered: Programs.trainings().length,
      livelihoodPrograms: Programs.livelihoods().length
    };
  },

  topJobsByApplicants(n) {
    const counts = {};
    Applications.get().forEach(a => counts[a.jobId] = (counts[a.jobId] || 0) + 1);
    return Object.entries(counts)
      .sort((x, y) => y[1] - x[1]).slice(0, n)
      .map(([jobId, c]) => ({ job: Jobs.byId(jobId)?.title || jobId, applicants: c }));
  },

  renderReports() {
    const s = this.buildStats();

    document.getElementById('report-stats').innerHTML = `
      <div class="grid-2 mt-2">
        ${Object.entries({
          'Total users': s.totalUsers,
          'Job seekers': s.jobSeekers,
          'Employers': s.employers,
          'Verified employers': s.verifiedEmployers,
          'Total job postings': s.totalJobs,
          'Active postings': s.activeJobs,
          'Postings awaiting approval': s.pendingJobs,
          'Total applications': s.totalApplications,
          'Saved jobs': s.savedJobsCount,
          'Training enrollments': s.trainingEnrollments,
          'Trainings offered': s.trainingsOffered,
          'Livelihood programs': s.livelihoodPrograms
        }).map(([k, v]) => `
          <div class="stat-card"><div class="stat-icon" style="background:#2563EB"><i class="fa-solid fa-chart-simple"></i></div>
            <div><div class="stat-value">${v}</div><div class="stat-label">${k}</div></div></div>`).join('')}
      </div>

      <h3 class="mt-2">Applications per status</h3>
      <ul>${Object.entries(s.applicationsByStatus).map(([st, c]) =>
        `<li>${UI.statusBadge(st)} — ${c} application(s)</li>`).join('')
        || '<li class="muted">No applications yet.</li>'}</ul>

      <h3 class="mt-2">Top 5 jobs by applicants</h3>
      <ol>${this.topJobsByApplicants(5).map(t =>
        `<li>${UI.esc(t.job)} — ${t.applicants} applicant(s)</li>`).join('')
        || '<li class="muted">No data yet.</li>'}</ol>`;
  }
};
