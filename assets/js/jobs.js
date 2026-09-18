/* ==========================================================================
   SkillBridge — jobs.js
   Everything about JOB POSTINGS:

   Shared:      Jobs.get(), Jobs.isAvailable(), Jobs.card()
   Job seeker:  listing + search/filter/sort, details modal,
                Save/Unsave job (skillbridge_saved_jobs)
   Employer:    create / edit / close / delete own jobs (CRUD),
                dashboard stats

   Each job stores employerId so the system always knows who owns it.
   ========================================================================== */

const Jobs = {

  /* ----------------------------- data access ----------------------------- */
  get()            { return Storage.get(KEYS.JOBS); },
  byId(id)         { return Storage.get(KEYS.JOBS).find(j => j.id === id) || null; },
  byEmployer(uid)  { return Storage.get(KEYS.JOBS).filter(j => j.employerId === uid); },

  save(list)       { Storage.set(KEYS.JOBS, list); },
  update(id, patch) {
    const list = this.get();
    const i = list.findIndex(j => j.id === id);
    if (i > -1) { Object.assign(list[i], patch); this.save(list); }
  },

  /* A job is open for applications when Active, not past its deadline,
     and openings remain. */
  isExpired(job) {
    return job.deadline ? UI.daysLeft(job.deadline) < 0 : false;
  },
  isAvailable(job) {
    if (!job || job.status !== 'Active' || this.isExpired(job)) return false;
    const apps = Storage.get(KEYS.APPLICATIONS)
      .filter(a => a.jobId === job.id && ['Pending', 'Reviewed', 'Shortlisted'].includes(a.status));
    return apps.length < (job.openings || 99);
  },

  /* Increment view counter (used for employer analytics). */
  addView(id) {
    const job = this.byId(id);
    if (job) this.update(id, { views: (job.views || 0) + 1 });
  },

  /* ------------------------------ saved jobs ------------------------------ */
  isSaved(jobId, userId) {
    return Storage.get(KEYS.SAVED_JOBS)
      .some(s => s.jobId === jobId && s.userId === userId);
  },
  toggleSave(jobId, userId) {
    const list = Storage.get(KEYS.SAVED_JOBS);
    const i = list.findIndex(s => s.jobId === jobId && s.userId === userId);
    if (i > -1) { list.splice(i, 1); Storage.set(KEYS.SAVED_JOBS, list); return false; }
    list.push({ id: generateId('sv_'), jobId, userId, savedAt: new Date().toISOString() });
    Storage.set(KEYS.SAVED_JOBS, list);
    return true;
  },

  /* ------------------------------- rendering ------------------------------ */
  /* One job card. options: { showMatch:{score,reasons}, showSave:true } */
  card(job, options = {}) {
    const user = getCurrentUser();
    const expired = this.isExpired(job);
    const statusChip = job.status !== 'Active'
      ? UI.statusBadge(job.status)
      : (expired ? UI.statusBadge('Expired') : '');

    let matchHtml = '';
    if (options.showMatch) {
      matchHtml = `
        <div class="row-between mt-1">
          <div class="match-bar" style="flex:1"><div style="width:${options.showMatch.score}%"></div></div>
          <span class="score-pill">${options.showMatch.score}% Match</span>
        </div>`;
    }

    let saveBtn = '';
    if (options.showSave && user) {
      const saved = this.isSaved(job.id, user.id);
      saveBtn = `<button class="btn btn-ghost btn-sm js-save" data-id="${job.id}" title="Save job">
          <i class="fa-${saved ? 'solid' : 'regular'} fa-bookmark"></i>
        </button>`;
    }

    return `
      <div class="card job-card">
        <div class="row-between">
          <h3><a href="#" class="js-view" data-id="${job.id}">${UI.esc(job.title)}</a></h3>
          ${matchHtml ? '' : `${statusChip}${saveBtn}`}
        </div>
        ${matchHtml ? `<div class="row-between"><span class="muted small-text">${UI.esc(job.company)}</span><span>${statusChip}${saveBtn}</span></div>`
                    : `<div class="meta">${UI.esc(job.company)}</div>`}
        <div class="meta">
          📍 ${UI.esc(job.barangay)}, ${UI.esc(job.location)} &nbsp;·&nbsp;
          <i class="fa-regular fa-clock"></i> ${UI.esc(job.type)} &nbsp;·&nbsp;
          <i class="fa-solid fa-layer-group"></i> ${UI.esc(job.experienceLevel)}
        </div>
        <div class="salary">${UI.peso(job.salaryMin, job.salaryMax, job.salaryType)}</div>
        <div class="tag-list">${(job.skillsRequired || []).map(s => `<span class="chip skill">${UI.esc(s)}</span>`).join('')}</div>
        <div class="muted small-text">Posted ${UI.timeAgo(job.datePosted)} ·
          Deadline: ${UI.fmtDate(job.deadline)} · 👁 ${job.views || 0}</div>
        ${matchHtml}
        <div class="btn-row mt-2">
          <button class="btn btn-outline btn-sm js-view" data-id="${job.id}">
            <i class="fa-solid fa-eye"></i> View Details</button>
          <button class="btn btn-primary btn-sm js-apply" data-id="${job.id}"
                  ${this.isAvailable(job) ? '' : 'disabled'}>
            <i class="fa-solid fa-paper-plane"></i> Apply Now</button>
        </div>
        ${options.showMatch && options.showMatch.reasons ? `
          <ul class="match-explain">
            ${options.showMatch.reasons.map(r =>
              `<li class="${r.ok ? 'ok' : 'bad'}">${r.ok ? '✓' : '✗'} ${UI.esc(r.text)}</li>`).join('')}
          </ul>` : ''}
      </div>`;
  },

  /* --------------------------- details modal ------------------------------ */
  openDetails(jobId) {
    const job = this.byId(jobId);
    if (!job) return;

    // count the view unless the owner is looking at their own post
    const user = getCurrentUser();
    const empProfile = Auth.employerProfile();
    if (!empProfile || empProfile.userId !== job.employerId) this.addView(jobId);

    const alreadyApplied = Applications.hasApplied(jobId, user?.id);
    const saved = this.isSaved(jobId, user?.id);

    const m = UI.openModal(job.title, `
      <p class="muted small-text">${UI.esc(job.company)} · Posted ${UI.timeAgo(job.datePosted)} ·
        ${UI.statusBadge(job.status)}</p>

      <h3 class="mt-2">About the job</h3>
      <p>${UI.esc(job.description)}</p>

      <div class="grid-2">
        <div><strong><i class="fa-solid fa-money-bill-wave"></i> Salary</strong><br>${UI.peso(job.salaryMin, job.salaryMax, job.salaryType)}</div>
        <div><strong><i class="fa-solid fa-location-dot"></i> Location</strong><br>${UI.esc(job.barangay)}, ${UI.esc(job.location)}</div>
        <div><strong><i class="fa-regular fa-clock"></i> Job Type</strong><br>${UI.esc(job.type)}</div>
        <div><strong><i class="fa-solid fa-layer-group"></i> Experience</strong><br>${UI.esc(job.experienceLevel)}</div>
        <div><strong><i class="fa-solid fa-users"></i> Openings</strong><br>${job.openings}</div>
        <div><strong><i class="fa-regular fa-calendar"></i> Deadline</strong><br>${UI.fmtDate(job.deadline)}</div>
      </div>

      <h3 class="mt-2">Requirements</h3>
      <p>${UI.esc(job.requirements || 'None listed.')}</p>

      <h3>Skills needed</h3>
      <div class="tag-list">${(job.skillsRequired || []).map(s => `<span class="chip skill">${UI.esc(s)}</span>`).join('') || '<span class="muted">No specific skills listed.</span>'}</div>

      ${Applications.hasApplied(jobId, user?.id) ? `
        <div class="alert alert-success mt-2"><i class="fa-solid fa-check"></i>
          You already applied to this job. Track it in “My Applications”.</div>` : ''}

      <div class="btn-row mt-2">
        <button class="btn btn-primary" id="modal-apply"
          ${alreadyApplied || !this.isAvailable(job) ? 'disabled' : ''}>
          <i class="fa-solid fa-paper-plane"></i> Apply Now</button>
        <button class="btn btn-outline" id="modal-save">
          <i class="fa-${saved ? 'solid' : 'regular'} fa-bookmark"></i>
          ${saved ? 'Saved ✓' : 'Save Job'}</button>
      </div>
      ${!this.isAvailable(job) && !alreadyApplied
        ? '<p class="form-error mt-1">This job is no longer accepting applications.</p>' : ''}
    `);

    const applyBtn = m.root.querySelector('#modal-apply');
    if (applyBtn && !applyBtn.disabled) {
      applyBtn.onclick = () => {
        const result = Applications.applyToJob(jobId);
        if (result.ok) { m.close(); refreshCurrentJobsView(); }
      };
    }
    m.root.querySelector('#modal-save').onclick = e => {
      const nowSaved = this.toggleSave(jobId, getCurrentUser().id);
      e.currentTarget.innerHTML = nowSaved
        ? '<i class="fa-solid fa-bookmark"></i> Saved ✓'
        : '<i class="fa-regular fa-bookmark"></i> Save Job';
      UI.toast(nowSaved ? 'Job saved.' : 'Removed from saved jobs.');
      refreshCurrentJobsView();
    };
  }
};

/* Re-render whatever jobs list is currently on screen (used after actions). */
function refreshCurrentJobsView() {
  const page = document.body.dataset.page;
  if (page === 'jobs')              SeekerJobsPage.renderList();
  if (page === 'recommendations')   RecommendationsPage.render();
  if (page === 'saved-jobs')        SeekerJobsPage.renderSaved();
  if (page === 'dashboard')         SeekerDashboardPage.renderRecommendations();
}

/* ==========================================================================
   SEEKER — Find Jobs page (search · filter · sort · saved tab)
   ========================================================================== */
const SeekerJobsPage = {
  filters: { q: '', city: '', barangay: '', type: '', exp: '', skill: '', minSalary: '', sort: 'newest', savedOnly: false },

  init() {
    Auth.requireRole('seeker');
    this.bindFilters();
    this.renderList();

    document.addEventListener('click', e => {
      const view = e.target.closest('.js-view');
      const apply = e.target.closest('.js-apply');
      const save = e.target.closest('.js-save');
      if (view) { e.preventDefault(); Jobs.openDetails(view.dataset.id); }
      if (apply) Applications.applyToJob(apply.dataset.id);
      if (save) {
        const saved = Jobs.toggleSave(save.dataset.id, getCurrentUser().id);
        UI.toast(saved ? 'Job saved. Find it under Saved.' : 'Removed from saved jobs.');
        this.renderList();
      }
    });
  },

  bindFilters() {
    const ids = ['f-q', 'f-city', 'f-barangay', 'f-type', 'f-exp', 'f-skill', 'f-salary', 'f-sort'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.oninput = UI.debounce(() => this.readAndRender());
      el.onchange = () => this.readAndRender();
    });
    document.querySelectorAll('[data-tab]').forEach(btn =>
      btn.onclick = () => {
        document.querySelectorAll('[data-tab]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.filters.savedOnly = btn.dataset.tab === 'saved';
        this.renderList();
      });
  },

  readAndRender() {
    const g = id => document.getElementById(id)?.value || '';
    this.filters = { q: g('f-q'), city: g('f-city'), barangay: g('f-barangay'),
                     type: g('f-type'), exp: g('f-exp'), skill: g('f-skill'),
                     minSalary: Number(g('f-salary')) || 0, sort: g('f-sort') || 'newest',
                     savedOnly: this.filters.savedOnly };
    this.renderList();
  },

  filteredJobs(profile) {
    const f = this.filters;
    let jobs = Jobs.get().filter(j => j.status === 'Active');

    if (f.savedOnly) {
      const savedIds = Storage.get(KEYS.SAVED_JOBS)
        .filter(s => s.userId === getCurrentUser().id).map(s => s.jobId);
      jobs = jobs.filter(j => savedIds.includes(j.id));
    }

    if (f.q) {
      const q = f.q.toLowerCase();
      jobs = jobs.filter(j =>
        j.title.toLowerCase().includes(q) ||
        j.company.toLowerCase().includes(q) ||
        (j.skillsRequired || []).some(s => s.toLowerCase().includes(q)));
    }
    if (f.city)     jobs = jobs.filter(j => j.location === f.city);
    if (f.barangay) jobs = jobs.filter(j => j.barangay === f.barangay);
    if (f.type)     jobs = jobs.filter(j => j.type === f.type);
    if (f.exp)      jobs = jobs.filter(j => j.experienceLevel === f.exp);
    if (f.skill)    jobs = jobs.filter(j => (j.skillsRequired || []).includes(f.skill));
    if (f.minSalary)jobs = jobs.filter(j => Math.max(j.salaryMax || 0, j.salaryMin || 0) >= f.minSalary);

    switch (f.sort) {
      case 'salary':
        jobs.sort((a, b) => (b.salaryMax || b.salaryMin || 0) - (a.salaryMax || a.salaryMin || 0));
        break;
      case 'match': {
        const ranked = new Map(Recommendations.getRankedJobs(profile).map(r => [r.job.id, r.score]));
        jobs.sort((a, b) => (ranked.get(b.id) || 0) - (ranked.get(a.id) || 0));
        break;
      }
      default:
        jobs.sort((a, b) => b.datePosted.localeCompare(a.datePosted)); // newest first
    }
    return jobs;
  },

  renderList() {
    const profile = Auth.seekerProfile();
    const jobs = this.filteredJobs(profile || {});
    const wrap = document.getElementById('jobs-list');
    if (!wrap) return;

    wrap.innerHTML = jobs.length === 0
      ? UI.emptyState('fa-magnifying-glass', 'No jobs found',
          this.filters.savedOnly ? 'You have no saved jobs yet. Tap the bookmark on any job.' :
          'Try changing your search or filters.')
      : jobs.map(j => Jobs.card(j, { showMatch: Recommendations.calculateMatch(profile || {}, j), showSave: true })).join('');
  },

  renderSaved() { /* handled via savedOnly filter tab above */ }
};

/* ==========================================================================
   EMPLOYER — Post / Edit job form + My Jobs management
   ========================================================================== */
const EmployerJobsPage = {

  initForm() {
    Auth.requireRole('employer');

    const editId = UI.getParam('id');
    if (editId) {
      const job = Jobs.byId(editId);
      if (!job) { window.location.href = BASE + 'pages/employer/jobs.html'; return; }
      this.fillForm(job);
      document.getElementById('form-title').textContent = 'Edit Job Posting';
    } else {
      document.getElementById('form-title').textContent = 'Post a New Job';
    }

    document.getElementById('job-form').onsubmit = e => {
      e.preventDefault();
      this.submit(editId);
    };
  },

  fillForm(job) {
    const set = (id, v) => document.getElementById(id).value = v ?? '';
    set('j-title', job.title);       set('j-company', job.company);
    set('j-desc', job.description);  set('j-min', job.salaryMin);
    set('j-max', job.salaryMax);     set('j-stype', job.salaryType);
    set('j-city', job.location);     set('j-brgy', job.barangay);
    set('j-type', job.type);         set('j-req', job.requirements);
    set('j-skills', (job.skillsRequired || []).join(', '));
    set('j-exp', job.experienceLevel); set('j-openings', job.openings);
    set('j-deadline', job.deadline);
  },

  submit(editId) {
    const v = id => document.getElementById(id)?.value.trim() || '';
    const n = id => Number(document.getElementById(id)?.value) || null;

    /* ---- validation with simple messages (PLAN Phase 17) ---- */
    if (!v('j-title'))   return UI.toast('Please enter a job title.', 'error');
    if (!v('j-company')) return UI.toast('Please enter the company name.', 'error');
    if (!v('j-desc'))    return UI.toast('Please describe the job.', 'error');
    if (v('j-min') && n('j-min') <= 0) return UI.toast('Salary must be a positive number.', 'error');
    if (n('j-min') && n('j-max') && n('j-min') > n('j-max'))
      return UI.toast('Minimum salary cannot be higher than maximum.', 'error');
    if (!v('j-city'))    return UI.toast('Please enter the location.', 'error');
    if (!v('j-deadline'))return UI.toast('Please set an application deadline.', 'error');
    if (UI.daysLeft(v('j-deadline')) < 0 && !editId)
      return UI.toast('Deadline must be in the future.', 'error');

    const skills = v('j-skills')
      .split(',').map(s => s.trim()).filter(Boolean);

    const data = {
      title: v('j-title'), company: v('j-company'),
      description: v('j-desc'),
      salaryMin: n('j-min'), salaryMax: n('j-max'), salaryType: v('j-stype') || 'month',
      location: v('j-city'), barangay: v('j-brgy'),
      type: v('j-type'), requirements: v('j-req'), skillsRequired: skills,
      experienceLevel: v('j-exp'), openings: n('j-openings') || 1,
      deadline: v('j-deadline')
    };

    const user = getCurrentUser();

    if (editId) {
      Jobs.update(editId, data);
      UI.toast('Job posting updated!', 'success');
    } else {
      const job = {
        id: generateId('job_'), employerId: user.id, ...data,
        status: 'Pending', views: 0, datePosted: new Date().toISOString()
      };
      const list = Jobs.get(); list.push(job); Jobs.save(list);

      // notify admins that a job needs approval
      Storage.get(KEYS.USERS).filter(u => u.role === 'admin').forEach(admin =>
        Notifications.notify(admin.id, 'New job needs approval',
          `“${job.title}” by ${job.company} is waiting for review.`, 'job'));

      UI.toast('Job posted! It will appear publicly once approved.', 'success');
    }

    setTimeout(() => window.location.href = BASE + 'pages/employer/jobs.html', 900);
  },

  /* ---- My Jobs list (edit / close-reopen / delete) ---- */
  initList() {
    Auth.requireRole('employer');
    this.renderList();

    document.addEventListener('click', async e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const id = btn.dataset.id;
      const action = btn.dataset.action;

      if (action === 'view')  Jobs.openDetails(id);

      if (action === 'close' || action === 'reopen') {
        const job = Jobs.byId(id);
        Jobs.update(id, { status: job.status === 'Closed' ? 'Active' : 'Closed' });
        UI.toast(action === 'close' ? 'Job closed.' : 'Job re-opened.', 'success');
        this.renderList();
      }

      if (action === 'delete') {
        const ok = await UI.confirmDialog('Delete this job posting and all of its applications? This cannot be undone.');
        if (!ok) return;
        Jobs.save(Jobs.get().filter(j => j.id !== id));
        Storage.set(KEYS.APPLICATIONS,
          Storage.get(KEYS.APPLICATIONS).filter(a => a.jobId !== id));
        UI.toast('Job deleted.');
        this.renderList();
      }
    });
  },

  renderList() {
    const user = getCurrentUser();
    const jobs = Jobs.byEmployer(user.id).sort((a, b) => b.datePosted.localeCompare(a.datePosted));
    const wrap = document.getElementById('my-jobs-list');
    if (!wrap) return;

    wrap.innerHTML = jobs.length === 0
      ? UI.emptyState('fa-briefcase', 'No job postings yet', 'Click “Post a Job” to create your first one.')
      : jobs.map(j => `
        <div class="card job-card">
          <div class="row-between">
            <h3>${UI.esc(j.title)}</h3>
            ${UI.statusBadge(j.status)}
          </div>
          <div class="meta muted small-text">
            📍 ${UI.esc(j.barangay)}, ${UI.esc(j.location)} · ${UI.esc(j.type)} ·
            👁 ${j.views || 0} views ·
            ${Storage.get(KEYS.APPLICATIONS).filter(a => a.jobId === j.id).length} applicant(s) ·
            Deadline ${UI.fmtDate(j.deadline)}
          </div>
          <div class="btn-row mt-1">
            <a class="btn btn-outline btn-sm" href="post-job.html?id=${j.id}"><i class="fa-solid fa-pen"></i> Edit</a>
            ${j.status !== 'Pending' && j.status !== 'Rejected' ? `
              <button class="btn btn-warning btn-sm" data-action="${j.status === 'Closed' ? 'reopen' : 'close'}" data-id="${j.id}">
                <i class="fa-solid fa-${j.status === 'Closed' ? 'lock-open' : 'lock'}"></i>
                ${j.status === 'Closed' ? 'Re-open' : 'Close'}</button>` : ''}
            <button class="btn btn-danger btn-sm" data-action="delete" data-id="${j.id}">
              <i class="fa-solid fa-trash"></i> Delete</button>
          </div>
        </div>`).join('');
  }
};
