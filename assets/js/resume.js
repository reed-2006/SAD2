/* ==========================================================================
   SkillBridge — resume.js
   Auto-generates a printable resume from the seeker's profile data
   (skillbridge_job_seekers) + a professional summary the user can edit.

   Uses the browser's print dialog (Ctrl+P → Save as PDF).
   ========================================================================== */

const ResumePage = {

  init() {
    const user = Auth.requireRole('seeker');
    if (!user) return;
    const profile = Auth.seekerProfile();

    document.getElementById('r-summary').value = profile.professionalSummary || '';

    /* Save summary into the profile so matching + employers can see it. */
    document.getElementById('r-save').onclick = () => {
      profile.professionalSummary = document.getElementById('r-summary').value.trim();
      Auth.saveSeekerProfile(profile);
      UI.toast('Resume summary saved!', 'success');
      this.renderPreview(profile, user);
    };

    document.getElementById('r-print').onclick = () => {
      profile.professionalSummary = document.getElementById('r-summary').value.trim();
      Auth.saveSeekerProfile(profile);
      window.print();   // print CSS (responsive.css) hides everything except #resume-sheet
    };

    this.renderPreview(profile, user);
  },

  renderPreview(profile, user) {
    const sheet = document.getElementById('resume-sheet');
    if (!sheet) return;

    const section = (title, body) => body
      ? `<h3>${title}</h3>${body}` : '';

    sheet.innerHTML = `
      <div class="rs-header">
        <h1>${UI.esc(user.fullName)}</h1>
        <p>
          ${profile.contactNumber ? UI.esc(profile.contactNumber) + ' · ' : ''}
          ${UI.esc(user.email)}<br>
          📍 ${UI.esc(profile.barangay || '')}${profile.barangay ? ', ' : ''}${UI.esc(profile.location || '')}
          ${profile.preferredJobType ? ` · Seeking: ${UI.esc(profile.preferredJobType)}` : ''}
        </p>
      </div>

      ${section('Professional Summary',
        `<p>${UI.esc(profile.professionalSummary || 'No summary written yet.')}</p>`)}

      ${section('Skills',
        `<div class="tag-list">${(profile.skills || [])
          .map(s => `<span class="chip skill">${UI.esc(s)}</span>`).join('') || ''}</div>`)}

      ${section('Work Experience', (profile.experience || []).map(x => `
        <div class="rs-item">
          <strong>${UI.esc(x.title)}</strong> — ${UI.esc(x.company)}
          <span class="muted">(${UI.esc(x.duration)})</span>
          ${x.description ? `<br><span class="small-text">${UI.esc(x.description)}</span>` : ''}
        </div>`).join(''))}

      ${section('Education', (profile.education || []).map(e2 => `
        <div class="rs-item">
          <strong>${UI.esc(e2.school)}</strong>
          ${e2.course ? ` — ${UI.esc(e2.course)}` : ''}
          <br><span class="muted small-text">${UI.esc(e2.level)}${e2.year ? ' · ' + UI.esc(e2.year) : ''}</span>
        </div>`).join(''))}

      ${section('Trainings & Seminars', (profile.trainings || []).map(t => `
        <div class="rs-item">
          <strong>${UI.esc(t.name)}</strong> — ${UI.esc(t.provider)}
          ${t.completionDate ? `<span class="muted">(${UI.esc(t.completionDate)})</span>` : ''}
        </div>`).join(''))}
    `;
  }
};
