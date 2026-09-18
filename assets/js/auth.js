/* ==========================================================================
   SkillBridge — auth.js
   SIMULATED authentication for this frontend prototype.

   ⚠️ SECURITY DISCLAIMER (required by project spec):
   This is frontend prototype authentication — NOT production secure.
   Accounts live in localStorage; anyone using the same browser can inspect
   them. A real system needs a backend server with hashed passwords.
   ========================================================================== */

const Auth = {

  ROLE_HOME: {
    seeker:  'pages/job-seeker/dashboard.html',
    employer:'pages/employer/dashboard.html',
    admin:   'pages/admin/dashboard.html'
  },

  ROLE_LABEL: { seeker: 'Job Seeker', employer: 'Employer', admin: 'Admin' },

  homeUrl(role) {
    return BASE + (this.ROLE_HOME[role] || 'index.html');
  },

  /* ---------------------------- REGISTER -------------------------------- */
  // Creates: 1 account in skillbridge_users + 1 profile record in
  // skillbridge_job_seekers OR skillbridge_employers.
  register({ fullName, email, password, confirmPassword, role,
             companyName = '', companyDescription = '', contactNumber = '',
             location = '', barangay = '' }) {

    fullName = (fullName || '').trim();
    email    = (email || '').trim().toLowerCase();

    if (!fullName)                 return { ok: false, message: 'Please enter your full name.' };
    if (!email.includes('@'))      return { ok: false, message: 'Please enter a valid email address.' };
    if ((password || '').length < 6) return { ok: false, message: 'Password must be at least 6 characters.' };
    if (password !== confirmPassword) return { ok: false, message: 'Passwords do not match.' };
    if (!role)                     return { ok: false, message: 'Please choose an account type.' };
    if (role === 'employer' && !companyName.trim())
                                   return { ok: false, message: 'Please enter your business name.' };

    const users = Storage.get(KEYS.USERS);
    if (users.some(u => u.email.toLowerCase() === email))
      return { ok: false, message: 'That email is already registered. Try logging in instead.' };

    const userId = generateId('usr_');
    users.push({
      id: userId, fullName, email, password, role,
      status: 'Active', createdAt: new Date().toISOString()
    });
    Storage.set(KEYS.USERS, users);

    if (role === 'seeker') {
      const profiles = Storage.get(KEYS.SEEKERS);
      profiles.push({
        id: generateId('sp_'), userId, contactNumber, location, barangay,
        preferredJobType: '', professionalSummary: '',
        education: [], experience: [], skills: [], trainings: []
      });
      Storage.set(KEYS.SEEKERS, profiles);
    }

    if (role === 'employer') {
      const profiles = Storage.get(KEYS.EMPLOYERS);
      profiles.push({
        id: generateId('ep_'), userId, companyName,
        description: companyDescription, contactNumber,
        address: '', barangay, city: location || 'Toledo City',
        verificationStatus: 'Pending'   // admin must verify before jobs are trusted
      });
      Storage.set(KEYS.EMPLOYERS, profiles);
    }

    Notifications.notify(userId, 'Welcome to SkillBridge! 🎉',
      role === 'employer'
        ? 'Your account is pending verification by the SkillBridge team.'
        : 'Complete your profile so we can match you with nearby jobs.',
      'system');

    const user = users.find(u => u.id === userId);
    setCurrentUser(user);
    return { ok: true, user };
  },

  /* ------------------------------ LOGIN ---------------------------------- */
  login(email, password) {
    email = (email || '').trim().toLowerCase();
    const user = Storage.get(KEYS.USERS)
      .find(u => u.email.toLowerCase() === email);

    if (!user || user.password !== password)
      return { ok: false, message: 'Incorrect email or password.' };
    if (user.status !== 'Active')
      return { ok: false, message: 'This account is deactivated. Contact the administrator.' };

    setCurrentUser(user);
    return { ok: true, user };
  },

  /* ------------------------- PROFILE LOOKUPS ----------------------------- */
  seekerProfile(userId = null) {
    const uid = userId ?? getCurrentUser()?.id;
    return Storage.get(KEYS.SEEKERS).find(p => p.userId === uid) || null;
  },
  employerProfile(userId = null) {
    const uid = userId ?? getCurrentUser()?.id;
    return Storage.get(KEYS.EMPLOYERS).find(p => p.userId === uid) || null;
  },

  /* Save updated seeker profile record back to localStorage. */
  saveSeekerProfile(profile) {
    const list = Storage.get(KEYS.SEEKERS);
    const i = list.findIndex(p => p.id === profile.id);
    if (i > -1) { list[i] = profile; Storage.set(KEYS.SEEKERS, list); }
  },
  saveEmployerProfile(profile) {
    const list = Storage.get(KEYS.EMPLOYERS);
    const i = list.findIndex(p => p.id === profile.id);
    if (i > -1) { list[i] = profile; Storage.set(KEYS.EMPLOYERS, list); }
  },

  /* Page guard — call at the top of protected pages. */
  requireRole(role) {
    const user = getCurrentUser();
    if (!user) { window.location.href = BASE + 'login.html'; return null; }
    if (role && user.role !== role) {
      window.location.href = this.homeUrl(user.role);
      return null;
    }
    return user;
  }
};
