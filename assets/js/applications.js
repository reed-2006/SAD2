/* ==========================================================================
   SkillBridge — applications.js
   The complete job application workflow.

   Apply Now performs these checks (PLAN Phase 7):
     logged in? → is a Job Seeker? → job Active? → deadline ok?
     → openings left? → not already applied? → create application
     → save to LocalStorage → notify both sides.

   Application object shape:
   { id, jobId, applicantId, employerId, status:"Pending", appliedAt, message }
   Status flow: Pending → Reviewed → Shortlisted → Accepted / Rejected
   ========================================================================== */

const Applications = {

  STATUSES: ['Pending', 'Reviewed', 'Shortlisted', 'Accepted', 'Rejected'],

  get()            { return Storage.get(KEYS.APPLICATIONS); },
  byId(id)         { return this.get().find(a => a.id === id) || null; },
  byApplicant(uid) { return this.get().filter(a => a.applicantId === uid); },
  byEmployer(uid)  { return this.get().filter(a => a.employerId === uid); },
  save(list)       { Storage.set(KEYS.APPLICATIONS, list); },

  hasApplied(jobId, userId) {
    if (!userId) return false;
    return this.get().some(a => a.jobId === jobId && a.applicantId === userId);
  },

  /* ------------------------------ APPLY NOW ------------------------------- */
  applyToJob(jobId) {
    /* Check 1 — logged in? */
    const user = getCurrentUser();
    if (!user) {
      UI.toast('Please log in first.', 'error');
      setTimeout(() => window.location.href = BASE + 'login.html', 900);
      return { ok: false };
    }

    /* Check 2 — is a Job Seeker? */
    if (user.role !== 'seeker') {
      UI.toast('Only job seeker accounts can apply.', 'error');
      return { ok: false };
    }

    const job = Jobs.byId(jobId);
    if (!job) { UI.toast('Job not found.', 'error'); return { ok: false }; }

    /* Check 3 — is the job still open? */
    if (job.status !== 'Active') {
      UI.toast('This job is not accepting applications right now.', 'error');
      return { ok: false };
    }
    /* Check 4 — past the deadline? */
    if (Jobs.isExpired(job)) {
      UI.toast('The deadline for this job has passed.', 'error');
      return { ok: false };
    }

    /* Check 5 — already applied? (prevents duplicates) */
    if (this.hasApplied(jobId, user.id)) {
      UI.toast('You already applied to this job.', 'error');
      return { ok: false };
    }

    /* All good — create + persist the application. */
    const list = this.get();
    list.push({
      id: generateId('app_'),
      jobId,
      applicantId: user.id,
      employerId: job.employerId,
      status: 'Pending',
      appliedAt: new Date().toISOString(),
      message: ''
    });
    this.save(list);

    Notifications.notify(user.id, 'Application submitted ✓',
      `You successfully applied for ${job.title}.`, 'application');
    Notifications.notify(job.employerId, 'New application received',
      `${user.fullName} applied for ${job.title}.`, 'application');

    UI.toast('Application submitted successfully! Good luck!', 'success');
    return { ok: true };
  },

  /* --------------------- employer: update the status ---------------------- */
  updateStatus(appId, newStatus) {
    /* IMPORTANT: mutate the SAME array instance we persist — reading the key
       twice returns two independent parsed copies in localStorage workflows. */
    const list = this.get();
    const app = list.find(a => a.id === appId);
    if (!app || !this.STATUSES.includes(newStatus)) return false;

    app.status = newStatus;
    this.save(list);

    const job = Jobs.byId(app.jobId);
    const title = newStatus === 'Accepted' ? 'Congratulations! 🎉'
                : newStatus === 'Rejected' ? 'Application update'
                : 'Application update';
    const msgMap = {
      Pending:     `Your application for ${job.title} was moved back to pending.`,
      Reviewed:    `Your application for ${job.title} has been reviewed.`,
      Shortlisted: `Good news! You were shortlisted for ${job.title}.`,
      Accepted:    `You were ACCEPTED for ${job.title}! Contact the employer for next steps.`,
      Rejected:    `Your application for ${job.title} was not accepted this time. Keep going — better matches await!`
    };
    Notifications.notify(app.applicantId, title, msgMap[newStatus], 'status');
  },

  /* -------------------- seeker: “My Applications” page -------------------- */
  renderSeekerPage() {
    Auth.requireRole('seeker');
    const wrap = document.getElementById('apps-list');

    const render = () => {
      const filter = document.getElementById('app-filter').value;
      let apps = this.byApplicant(getCurrentUser().id)
        .sort((a, b) => b.appliedAt.localeCompare(a.appliedAt));
      if (filter) apps = apps.filter(a => a.status === filter);

      if (apps.length === 0) {
        wrap.innerHTML = UI.emptyState('fa-file-lines', 'No applications yet',
          'Start exploring jobs and apply for an opportunity.');
        return;
      }

      wrap.innerHTML = apps.map(a => {
        const job = Jobs.byId(a.jobId);
        if (!job) return '';
        return `
        <div class="card job-card">
          <div class="row-between">
            <h3>${UI.esc(job.title)}</h3>
            ${UI.statusBadge(a.status)}
          </div>
          <div class="meta muted small-text">
            ${UI.esc(job.company)} · Applied ${UI.timeAgo(a.appliedAt)}
            · Deadline was ${UI.fmtDate(job.deadline)}
          </div>
          <div class="muted small-text">
            Status guide: Pending = waiting · Reviewed = seen · Shortlisted =
            strong candidate · Accepted = you got it 🎉 · Rejected = not chosen.
          </div>
        </div>`;
      }).join('');
    };

    document.getElementById('app-filter').onchange = render;
    render();
  },

  /* --------------- employer: applicant management page -------------------- */
  renderApplicantsPage() {
    Auth.requireRole('employer');
    const user = getCurrentUser();
    const myJobs = Jobs.byEmployer(user.id);
    const jobFilter = document.getElementById('applicant-job-filter');

    // fill the job dropdown once
    jobFilter.innerHTML = '<option value="">All jobs</option>' +
      myJobs.map(j => `<option value="${j.id}">${UI.esc(j.title)}</option>`).join('');

    const render = () => {
      const selectedJob = jobFilter.value;
      let apps = this.byEmployer(user.id)
        .sort((a, b) => b.appliedAt.localeCompare(a.appliedAt));
      if (selectedJob) apps = apps.filter(a => a.jobId === selectedJob);

      const wrap = document.getElementById('applicants-list');
      if (apps.length === 0) {
        wrap.innerHTML = UI.emptyState('fa-users', 'No applicants yet',
          'Share your job posting so people can apply.');
        return;
      }

      wrap.innerHTML = `
        <div class="card table-wrap">
          <table class="data-table">
            <thead><tr>
              <th>Applicant</th><th>Skills</th><th>Location</th>
              <th>Experience</th><th>Applied</th><th>Status</th><th>Action</th>
            </tr></thead>
            <tbody>
              ${apps.map(a => {
                const seeker = Storage.get(KEYS.USERS).find(u => u.id === a.applicantId);
                const profile = Auth.seekerProfile(a.applicantId) || {};
                const job = Jobs.byId(a.jobId);
                return `<tr>
                  <td><strong>${UI.esc(seeker?.fullName || 'Unknown')}</strong><br>
                      <span class="muted small-text">${UI.esc(job?.title || '')}</span></td>
                  <td>${(profile.skills || []).map(s => `<span class="chip skill">${UI.esc(s)}</span>`).join(' ')}</td>
                  <td>${UI.esc(profile.barangay || '')}, ${UI.esc(profile.location || '')}</td>
                  <td>${Recommendations.totalExperienceYears(profile)} yr(s)</td>
                  <td>${UI.timeAgo(a.appliedAt)}</td>
                  <td>${UI.statusBadge(a.status)}</td>
                  <td>
                    <select class="js-status" data-id="${a.id}" style="min-width:120px">
                      ${this.STATUSES.map(s =>
                        `<option ${s === a.status ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                    <button class="btn btn-ghost btn-sm js-view-app" data-id="${a.id}" title="View details">
                      <i class="fa-solid fa-eye"></i></button>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`;

      // status changes create notifications for the applicant
      wrap.querySelectorAll('.js-status').forEach(sel =>
        sel.onchange = () => {
          const appId = sel.dataset.id;
          this.updateStatus(appId, sel.value);
          UI.toast(`Marked as ${sel.value}. Applicant notified.`, 'success');
          render();
        });

      // applicant detail modal
      wrap.querySelectorAll('.js-view-app').forEach(btn =>
        btn.onclick = () => {
          const a = this.byId(btn.dataset.id);
          const seeker = Storage.get(KEYS.USERS).find(u => u.id === a.applicantId);
          const profile = Auth.seekerProfile(a.applicantId) || {};
          const job = Jobs.byId(a.jobId);

          const m = UI.openModal(seeker?.fullName || 'Applicant', `
            <p class="muted small-text">Applied for <strong>${UI.esc(job?.title || '')}</strong>
              on ${UI.fmtDate(a.appliedAt)}</p>

            <h3>Contact</h3>
            <p>${UI.esc(profile.contactNumber || 'No contact number')}<br>
               ${UI.esc(seeker?.email || '')}<br>
               📍 ${UI.esc(profile.barangay || '')}, ${UI.esc(profile.location || '')}</p>

            <h3>Skills</h3>
            <div class="tag-list">${(profile.skills || []).map(s => `<span class="chip skill">${UI.esc(s)}</span>`).join('')}</div>

            <h3 class="mt-2">Experience (${Recommendations.totalExperienceYears(profile)} yr total)</h3>
            ${(profile.experience || []).map(x => `
              <p><strong>${UI.esc(x.title)}</strong> — ${UI.esc(x.company)}
                 (${UI.esc(x.duration)})<br><span class="muted small-text">${UI.esc(x.description || '')}</span></p>`).join('')
              || '<p class="muted">None listed.</p>'}

            <h3>Education</h3>
            ${(profile.education || []).map(e2 => `
              <p><strong>${UI.esc(e2.school)}</strong> — ${UI.esc(e2.level)}
                 ${e2.course ? '· ' + UI.esc(e2.course) : ''} (${UI.esc(e2.year)})</p>`).join('')
              || '<p class="muted">None listed.</p>'}

            ${a.message ? `<div class="alert alert-info mt-2">“${UI.esc(a.message)}”</div>` : ''}
          `);
        });
    };

    jobFilter.onchange = render;
    render();
  }
};
