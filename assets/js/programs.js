/* ==========================================================================
   SkillBridge — programs.js
   Skills Training & Livelihood programs (skillbridge_trainings /
   skillbridge_livelihoods / skillbridge_enrollments).

   training.html  → category "Skills Training" + "Seminar"
   livelihood.html→ categories "Livelihood" + "Assistance"

   Seekers can enroll (trainings) or express interest (livelihood).
   Admin manages the catalog through admin.js using the same helpers.
   ========================================================================== */

const Programs = {

  get()      { return Storage.get(KEYS.TRAININGS).concat(Storage.get(KEYS.LIVELIHOODS)); },
  trainings()   { return Storage.get(KEYS.TRAININGS); },
  livelihoods() { return Storage.get(KEYS.LIVELIHOODS); },

  byId(id) {
    return this.get().find(p => p.id === id) || null;
  },

  saveTraining(list)    { Storage.set(KEYS.TRAININGS, list); },
  saveLivelihood(list)  { Storage.set(KEYS.LIVELIHOODS, list); },

  enrollments(uid) {
    return Storage.get(KEYS.ENROLLMENTS).filter(e => e.userId === uid);
  },
  isEnrolled(programId, userId) {
    return this.enrollments(userId).some(e => e.programId === programId);
  },

  /* Enroll in a training or express interest in a livelihood program. */
  enroll(programId) {
    const user = getCurrentUser();
    if (!user || user.role !== 'seeker') {
      UI.toast('Please log in as a job seeker first.', 'error');
      return;
    }
    if (this.isEnrolled(programId, user.id)) {
      UI.toast('You are already enrolled/registered in this program.');
      return;
    }

    const list = Storage.get(KEYS.ENROLLMENTS);
    list.push({
      id: generateId('enr_'),
      userId: user.id,
      programId,
      enrolledAt: new Date().toISOString(),
      status: 'Enrolled'
    });
    Storage.set(KEYS.ENROLLMENTS, list);

    const p = this.byId(programId);
    Notifications.notify(user.id, 'Successfully enrolled ✓',
      `You are registered for ${p.title}. Check the schedule details.`, 'training');

    UI.toast('Successfully enrolled! Check “My Trainings” for details.', 'success');
    ProgramsPage.render();
  },

  /* One program card. */
  card(p, enrolled) {
    const catIcon = { 'Skills Training': 'fa-graduation-cap',
                      'Seminar': 'fa-chalkboard-user',
                      'Livelihood': 'fa-seedling',
                      'Assistance': 'fa-handshake-angle' }[p.category] || 'fa-circle-info';

    const actionLabel = p.category === 'Livelihood' || p.category === 'Assistance'
      ? 'Express Interest' : 'Enroll Now';

    return `
      <div class="card">
        <div class="row-between">
          <h3><i class="fa-solid ${catIcon}"></i> ${UI.esc(p.title)}</h3>
          <span class="chip">${UI.esc(p.category)}</span>
        </div>
        <p class="muted">${UI.esc(p.description)}</p>
        <div class="meta muted small-text">
          🏢 Organizer: ${UI.esc(p.organizer)}<br>
          📅 ${p.schedule ? 'Schedule: ' + UI.esc(p.schedule) : ''}
          ${p.duration ? ` · Duration: ${UI.esc(p.duration)}` : ''}<br>
          📍 Venue: ${UI.esc(p.venue)}
          ${p.slots ? ` · Slots: ${p.slots}` : ''}
          ${p.beneficiaryNote ? `<br>🎁 ${UI.esc(p.beneficiaryNote)}` : ''}
        </div>
        ${enrolled
          ? '<div class="alert alert-success mt-1"><i class="fa-solid fa-check"></i> You are enrolled in this program.</div>'
          : `<button class="btn btn-primary btn-sm mt-2 js-enroll" data-id="${p.id}">
               <i class="fa-solid fa-user-plus"></i> ${actionLabel}</button>`}
      </div>`;
  }
};

/* --------------------- seeker: training/livelihood pages -------------------- */
const ProgramsPage = {

  init(mode) { // mode: 'training' | 'livelihood'
    Auth.requireRole('seeker');
    this.mode = mode;

    const search = document.getElementById('prog-search');
    search.oninput = UI.debounce(() => this.render());

    this.render();

    document.addEventListener('click', e => {
      if (e.target.closest('.js-enroll'))
        Programs.enroll(e.target.closest('.js-enroll').dataset.id);
    });
  },

  render() {
    const wrap = document.getElementById('programs-list');
    const q = (document.getElementById('prog-search').value || '').toLowerCase();
    const user = getCurrentUser();

    let programs = this.mode === 'training'
      ? Programs.trainings().filter(p => ['Skills Training', 'Seminar'].includes(p.category))
      : Programs.livelihoods().filter(p => ['Livelihood', 'Assistance'].includes(p.category));

    if (q) programs = programs.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q));

    wrap.innerHTML = programs.length === 0
      ? UI.emptyState('fa-graduation-cap', 'No programs found',
          'Try a different keyword.')
      : programs.map(p => Programs.card(p, Programs.isEnrolled(p.id, user.id))).join('');
  }
};
