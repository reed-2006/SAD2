/* ==========================================================================
   SkillBridge — profile.js
   Profile builder for BOTH roles.

   Job seeker profile (feeds matching + resume + recommendations):
     Personal info · Preferred job type · Skills · Education ·
     Experience · Trainings

   Employer profile: company information.
   Everything persists in LocalStorage via Storage.set().
   ========================================================================== */

const ProfilePage = {

  /* ------------------------------ SEEKER ---------------------------------- */
  initSeeker() {
    const user = Auth.requireRole('seeker');
    if (!user) return;
    const profile = Auth.seekerProfile();
    if (!profile) { UI.toast('Profile missing — creating a new one.', 'error'); return; }

    /* ---------- personal info ---------- */
    document.getElementById('p-fullname').value = user.fullName;
    document.getElementById('p-email').value = user.email;
    document.getElementById('p-contact').value = profile.contactNumber || '';
    document.getElementById('p-city').value = profile.location || 'Toledo City';
    document.getElementById('p-barangay').value = profile.barangay || '';
    this.fillJobTypes(profile.preferredJobType);
    this.renderSkills(profile);

    /* skills input with suggestions from skillbridge_skills */
    const datalist = document.getElementById('skills-suggestions');
    Storage.get(KEYS.SKILLS).forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      datalist.appendChild(opt);
    });

    document.getElementById('p-add-skill').onclick = () => {
      const input = document.getElementById('p-new-skill');
      const value = input.value.trim();
      if (!value) { UI.toast('Type a skill first.'); return; }
      if (profile.skills.some(s => s.toLowerCase() === value.toLowerCase())) {
        UI.toast('That skill is already in your list.'); return;
      }
      profile.skills.push(value);
      Auth.saveSeekerProfile(profile);   // persist immediately so matching stays fresh
      input.value = '';
      this.renderSkills(profile);
      UI.toast('Skill added!', 'success');
    };

    /* repeatable sections */
    this.renderRepeatable('education', profile.education, profile, [
      ['school', 'School'], ['course', 'Course'], ['level', 'Education Level'], ['year', 'Year']
    ]);
    this.renderRepeatable('experience', profile.experience, profile, [
      ['title', 'Job Title'], ['company', 'Company'], ['duration', 'Duration'], ['description', 'Description']
    ]);
    this.renderRepeatable('trainings', profile.trainings, profile, [
      ['name', 'Training Name'], ['provider', 'Provider'], ['completionDate', 'Completion Date']
    ]);

    document.getElementById('p-summary').value = profile.professionalSummary || '';

    document.getElementById('profile-form').onsubmit = e => {
      e.preventDefault();
      const g = id => document.getElementById(id)?.value.trim() || '';

      profile.contactNumber = g('p-contact');
      profile.location = g('p-city');
      profile.barangay = g('p-barangay');
      profile.preferredJobType = g('p-jobtype');
      profile.professionalSummary = g('p-summary');

      Auth.saveSeekerProfile(profile);
      UI.toast('Profile saved! Your job matches were updated.', 'success');
    };
  },

  fillJobTypes(selected) {
    const sel = document.getElementById('p-jobtype');
    sel.innerHTML = '<option value="">— Select preferred job type —</option>' +
      ['Full-time', 'Part-time', 'Contract', 'Temporary', 'Internship', 'Freelance']
        .map(t => `<option ${t === selected ? 'selected' : ''}>${t}</option>`).join('');
  },

  renderSkills(profile) {
    const wrap = document.getElementById('p-skills-list');
    wrap.innerHTML = profile.skills.length === 0
      ? '<span class="muted small-text">No skills yet — add the ones you have (cooking, driving…).</span>'
      : profile.skills.map((s, i) =>
          `<span class="chip skill">${UI.esc(s)}
             <span class="chip-remove" data-i="${i}" title="Remove">✕</span></span>`).join('');

    wrap.querySelectorAll('.chip-remove').forEach(x =>
      x.onclick = () => {
        profile.skills.splice(Number(x.dataset.i), 1);
        Auth.saveSeekerProfile(profile);
        this.renderSkills(profile);
      });
  },

  /* Generic editable rows for education / experience / trainings.
     Each row saves on change; "Add" appends a blank entry. */
  renderRepeatable(sectionName, items, ownerProfile, fields) {
    const listEl = document.getElementById(`list-${sectionName}`);
    const addBtn = document.getElementById(`add-${sectionName}`);

    const draw = () => {
      listEl.innerHTML = items.length === 0
        ? '<span class="muted small-text">Nothing added yet.</span>'
        : items.map((item, idx) => `
            <div class="card" style="box-shadow:none;background:#F8FAFC;margin-bottom:8px">
              <div class="form-grid-2">
                ${fields.map(([key, label]) => `
                  <div class="form-group">
                    <label>${label}</label>
                    <input type="text" data-idx="${idx}"
                           data-key="${key}" value="${UI.esc(item[key] || '')}">
                  </div>`).join('')}
              </div>
              <button type="button" class="btn btn-danger btn-sm js-del-row" data-idx="${idx}">
                <i class="fa-solid fa-trash"></i> Remove</button>
            </div>`).join('');

      // live-save on typing
      listEl.querySelectorAll('input[data-key]').forEach(inp =>
        inp.onchange = () => {
          items[Number(inp.dataset.idx)][inp.dataset.key] = inp.value.trim();
          Auth.saveSeekerProfile(ownerProfile);
        });

      listEl.querySelectorAll('.js-del-row').forEach(btn =>
        btn.onclick = () => {
          items.splice(Number(btn.dataset.idx), 1);
          Auth.saveSeekerProfile(ownerProfile);
          draw();
        });
    };

    addBtn.onclick = () => {
      const blank = {};
      fields.forEach(([key]) => blank[key] = '');
      items.push(blank);
      Auth.saveSeekerProfile(ownerProfile);
      draw();
    };

    draw();
  },

  /* ----------------------------- EMPLOYER --------------------------------- */
  initEmployer() {
    Auth.requireRole('employer');
    const user = getCurrentUser();
    const profile = Auth.employerProfile() || {};

    document.getElementById('e-company').value = profile.companyName || user.fullName;
    document.getElementById('e-desc').value = profile.description || '';
    document.getElementById('e-contact').value = profile.contactNumber || '';
    document.getElementById('e-address').value = profile.address || '';
    document.getElementById('e-barangay').value = profile.barangay || '';
    document.getElementById('e-city').value = profile.city || 'Toledo City';

    const badgeWrap = document.getElementById('verification-badge');
    if (badgeWrap) {
      const s = profile.verificationStatus || 'Pending';
      badgeWrap.innerHTML = `Verification status: ${UI.statusBadge(s)}` +
        (s === 'Pending'
          ? ' <span class="muted small-text">— an admin reviews new employers before your jobs appear publicly.</span>'
          : '');
    }

    document.getElementById('employer-profile-form').onsubmit = e => {
      e.preventDefault();
      const g = id => document.getElementById(id)?.value.trim() || '';
      if (!g('e-company')) { UI.toast('Please enter your business name.', 'error'); return; }

      profile.companyName = g('e-company');
      profile.description = g('e-desc');
      profile.contactNumber = g('e-contact');
      profile.address = g('e-address');
      profile.barangay = g('e-barangay');
      profile.city = g('e-city');

      Auth.saveEmployerProfile(profile);

      // keep account display name in sync with the company name
      const users = Storage.get(KEYS.USERS);
      const u = users.find(x => x.id === user.id);
      if (u) { u.fullName = profile.companyName; Storage.set(KEYS.USERS, users); setCurrentUser(u); }

      UI.toast('Company profile saved!', 'success');
    };
  }
};
