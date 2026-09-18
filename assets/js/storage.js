/* ==========================================================================
   SkillBridge — storage.js
   The "simulated database". Every collection gets its own localStorage key.
   All pages read/write data ONLY through this file's functions.

   How it works (for the defense):
   1. Storage.get(key)  → reads the JSON string and converts it back to an
                          array/object. Returns [] if missing or broken.
   2. Storage.set(key)  → converts the array/object to JSON text and saves it.
   3. Data survives page refresh because localStorage is persistent.
   ========================================================================== */

const KEYS = {
  USERS:         'skillbridge_users',
  SEEKERS:       'skillbridge_job_seekers',
  EMPLOYERS:     'skillbridge_employers',
  JOBS:          'skillbridge_jobs',
  APPLICATIONS:  'skillbridge_applications',
  SKILLS:        'skillbridge_skills',
  TRAININGS:     'skillbridge_trainings',
  LIVELIHOODS:   'skillbridge_livelihoods',
  ENROLLMENTS:   'skillbridge_enrollments',
  NOTIFICATIONS: 'skillbridge_notifications',
  SAVED_JOBS:    'skillbridge_saved_jobs',
  REPORTS:       'skillbridge_reports',
  SETTINGS:      'skillbridge_settings',
  CURRENT_USER:  'skillbridge_current_user'
};

const Storage = {
  get(key, fallback = []) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  },
  remove(key) {
    localStorage.removeItem(key);
  },
  clear() {
    // wipes every SkillBridge key (used by "Reset demo data")
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
  }
};

/* ==========================================================================
   Data — export / import every collection as a JSON file.
   Lets users back up their local prototype data and restore it later
   (handy for demos, or moving work between browsers/devices).
   ========================================================================== */
const Data = {
  export() {
    const snapshot = {};
    Object.values(KEYS).forEach(k => {
      const raw = localStorage.getItem(k);
      if (raw !== null) snapshot[k] = JSON.parse(raw);
    });
    return snapshot;
  },

  /* Download all SkillBridge data as a .json file. */
  download(filename = `skillbridge-backup-${new Date().toISOString().slice(0, 10)}.json`) {
    const blob = new Blob([JSON.stringify(this.export(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  },

  /* Replace current data with a previously exported snapshot (JSON text). */
  import(jsonText) {
    const snapshot = JSON.parse(jsonText);
    if (!snapshot || typeof snapshot !== 'object')
      throw new Error('Invalid backup file.');
    let count = 0;
    Object.values(KEYS).forEach(k => {
      if (k in snapshot) { localStorage.setItem(k, JSON.stringify(snapshot[k])); count++; }
    });
    if (count === 0) throw new Error('No SkillBridge data found in this file.');
    return count;
  }
};

/* Generates a unique numeric-style id per collection, e.g. "job_17244..." */
function generateId(prefix = '') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* Current logged-in user helpers (kept here so every module can use them). */
function getCurrentUser() {
  return Storage.get(KEYS.CURRENT_USER, null);
}
function setCurrentUser(user) {
  Storage.set(KEYS.CURRENT_USER, user);
}
/* Logout clears only the session — registered data stays in localStorage. */
function logoutUser() {
  Storage.remove(KEYS.CURRENT_USER);
  window.location.href = BASE + 'login.html';
}

/* ==========================================================================
   INITIALIZE DATA — runs on every page load.
   Seeds realistic sample data ONLY when a collection is empty, so whatever
   the user creates persists across refreshes (PLAN Phase 2 requirement).
   Demo accounts all use password: 123456
   ========================================================================== */
function initializeData() {

  /* ---- master skills list (used for datalist suggestions + filters) ---- */
  if (!localStorage.getItem(KEYS.SKILLS)) {
    Storage.set(KEYS.SKILLS, [
      'Customer Service', 'Welding', 'Cooking', 'Computer Literacy',
      'Electrical Installation', 'Driving', 'Sales', 'Communication',
      'Carpentry', 'Plumbing', 'Baking', 'Encoding / MS Office'
    ]);
  }

  /* ---- settings ---- */
  if (!localStorage.getItem(KEYS.SETTINGS)) {
    Storage.set(KEYS.SETTINGS, { appName: 'SkillBridge', city: 'Toledo City', initializedAt: new Date().toISOString() });
  }

  /* ---- users (accounts) ---- */
  // SECURITY NOTE (prototype): passwords are stored as plain text for demo
  // purposes only. This is NOT production-secure — see README limitations.
  if (!localStorage.getItem(KEYS.USERS)) {
    Storage.set(KEYS.USERS, [
      { id: 'u_admin', fullName: 'System Administrator', email: 'admin@skillbridge.demo',
        password: '123456', role: 'admin', status: 'Active', createdAt: iso(-30) },

      { id: 'u_seeker1', fullName: 'Juan Dela Cruz', email: 'seeker@skillbridge.demo',
        password: '123456', role: 'seeker', status: 'Active', createdAt: iso(-20) },
      { id: 'u_seeker2', fullName: 'Maria Santos', email: 'maria@skillbridge.demo',
        password: '123456', role: 'seeker', status: 'Active', createdAt: iso(-18) },
      { id: 'u_seeker3', fullName: 'Carlo Reyes', email: 'carlo@skillbridge.demo',
        password: '123456', role: 'seeker', status: 'Active', createdAt: iso(-15) },

      { id: 'u_emp1', fullName: 'Demo Local Restaurant', email: 'employer@skillbridge.demo',
        password: '123456', role: 'employer', status: 'Active', createdAt: iso(-25) },
      { id: 'u_emp2', fullName: 'Demo Construction Services', email: 'construction@skillbridge.demo',
        password: '123456', role: 'employer', status: 'Active', createdAt: iso(-22) },
      { id: 'u_emp3', fullName: 'Demo Computer Shop', email: 'computershop@skillbridge.demo',
        password: '123456', role: 'employer', status: 'Active', createdAt: iso(-10) }
    ]);
  }

  /* ---- job seeker profiles ---- */
  if (!localStorage.getItem(KEYS.SEEKERS)) {
    Storage.set(KEYS.SEEKERS, [
      { id: 'sp_juan', userId: 'u_seeker1', contactNumber: '0917-111-2222',
        location: 'Toledo City', barangay: 'Poblacion',
        preferredJobType: 'Full-time',
        professionalSummary: 'Hardworking service crew member with customer service experience, looking for full-time work near Poblacion.',
        education: [{ school: 'Toledo National High School', course: 'General Academic Strand', level: 'Senior High School', year: '2023' }],
        experience: [{ title: 'Service Crew', company: 'Family Food Stall', duration: '1 year', description: 'Took orders, served customers, handled cash.' }],
        skills: ['Customer Service', 'Communication', 'Sales'],
        trainings: [{ name: 'Food Safety Seminar', provider: 'Barangay Health Office', completionDate: '2024-01-15' }] },
      { id: 'sp_maria', userId: 'u_seeker2', contactNumber: '0917-333-4444',
        location: 'Toledo City', barangay: 'Talavera',
        preferredJobType: 'Full-time',
        professionalSummary: 'Friendly sales assistant with strong communication skills and retail experience.',
        education: [{ school: 'Cebu Technological University', course: 'BS Business Administration', level: 'College Undergraduate', year: '2022' }],
        experience: [{ title: 'Store Attendant', company: 'Talavera Sari-sari Store', duration: '2 years', description: 'Managed daily sales and inventory.' }],
        skills: ['Sales', 'Customer Service', 'Communication'],
        trainings: [] },
      { id: 'sp_carlo', userId: 'u_seeker3', contactNumber: '0917-555-6666',
        location: 'Toledo City', barangay: 'Sangi',
        preferredJobType: 'Full-time',
        professionalSummary: 'Skilled welder with hands-on construction site experience and safety training.',
        education: [{ school: 'Sangi Elementary School', course: '', level: 'Elementary', year: '2015' }],
        experience: [{ title: 'Welder Helper', company: 'Cebu Shipyard Agency', duration: '3 years', description: 'Assisted welders, prepared metal surfaces, followed safety protocols.' }],
        skills: ['Welding', 'Electrical Installation', 'Carpentry'],
        trainings: [{ name: 'Welding Skills Program', provider: 'TESDA', completionDate: '2023-06-20' }] }
    ]);
  }

  /* ---- employer profiles ---- */
  if (!localStorage.getItem(KEYS.EMPLOYERS)) {
    Storage.set(KEYS.EMPLOYERS, [
      { id: 'ep_resto', userId: 'u_emp1', companyName: 'Demo Local Restaurant',
        description: 'A family restaurant in downtown Toledo serving Filipino dishes.',
        contactNumber: '032-111-2222', address: '12 Natl. Hwy',
        barangay: 'Poblacion', city: 'Toledo City', verificationStatus: 'Verified' },
      { id: 'ep_constr', userId: 'u_emp2', companyName: 'Demo Construction Services',
        description: 'Small construction firm doing house builds and repairs around Toledo City.',
        contactNumber: '032-333-4444', address: '8 Mabini St',
        barangay: 'Bato', city: 'Toledo City', verificationStatus: 'Verified' },
      { id: 'ep_compshop', userId: 'u_emp3', companyName: 'Demo Computer Shop',
        description: 'Computer shop offering printing, repair, and encoding services.',
        contactNumber: '032-555-6666', address: '5 P. Burgos St',
        barangay: 'Poblacion', city: 'Toledo City', verificationStatus: 'Pending' }
    ]);
  }

  /* ---- jobs ---- */
  // Status values: Pending | Active | Closed | Expired | Rejected
  if (!localStorage.getItem(KEYS.JOBS)) {
    Storage.set(KEYS.JOBS, [
      { id: 'job_crew', employerId: 'u_emp1', title: 'Service Crew', company: 'Demo Local Restaurant',
        description: 'Greet customers, take orders, serve food, and keep the dining area clean. Training provided for new hires.',
        salaryMin: 12000, salaryMax: 15000, salaryType: 'month',
        location: 'Toledo City', barangay: 'Poblacion',
        type: 'Full-time', requirements: 'At least high school graduate; willing to work shifts.',
        skillsRequired: ['Customer Service', 'Communication'], experienceLevel: 'No Experience Needed',
        openings: 3, deadline: iso(+21, true), status: 'Active', views: 24, datePosted: iso(-7) },
      { id: 'job_sales', employerId: 'u_emp1', title: 'Sales Assistant', company: 'Demo Local Restaurant',
        description: 'Assist customers at the counter, upsell meal promos, and balance the cash register at closing.',
        salaryMin: 11000, salaryMax: 13000, salaryType: 'month',
        location: 'Toledo City', barangay: 'Poblacion',
        type: 'Full-time', requirements: 'Honest and courteous; basic math skills.',
        skillsRequired: ['Sales', 'Customer Service'], experienceLevel: '1 Year',
        openings: 2, deadline: iso(+14, true), status: 'Active', views: 11, datePosted: iso(-5) },
      { id: 'job_welder', employerId: 'u_emp2', title: 'Welder', company: 'Demo Construction Services',
        description: 'Perform SMAW welding for steel structures on housing projects. Own welding mask preferred.',
        salaryMin: 45000, salaryMax: 60000, salaryType: 'month',
        location: 'Toledo City', barangay: 'Bato',
        type: 'Full-time', requirements: 'TESDA Welding NC II an advantage; safety boots required.',
        skillsRequired: ['Welding'], experienceLevel: '2 Years or More',
        openings: 4, deadline: iso(+30, true), status: 'Active', views: 40, datePosted: iso(-9) },
      { id: 'job_constr', employerId: 'u_emp2', title: 'Construction Worker', company: 'Demo Construction Services',
        description: 'Help masons and carpenters on site: mixing cement, carrying materials, and general labor.',
        salaryMin: 550, salaryMax: 650, salaryType: 'day',
        location: 'Toledo City', barangay: 'Dumlog',
        type: 'Contract', requirements: 'Physically fit and reliable.',
        skillsRequired: ['Carpentry'], experienceLevel: 'No Experience Needed',
        openings: 6, deadline: iso(+25, true), status: 'Active', views: 33, datePosted: iso(-4) },
      { id: 'job_tech', employerId: 'u_emp3', title: 'Computer Technician', company: 'Demo Computer Shop',
        description: 'Diagnose and repair desktops/laptops, install software, and assist walk-in customers.',
        salaryMin: 14000, salaryMax: 18000, salaryType: 'month',
        location: 'Toledo City', barangay: 'Poblacion',
        type: 'Part-time', requirements: 'Knows hardware troubleshooting and Windows installation.',
        skillsRequired: ['Computer Literacy', 'Communication'], experienceLevel: '1 Year',
        openings: 1, deadline: iso(+18, true), status: 'Pending', views: 0, datePosted: iso(-1) },
      { id: 'job_office', employerId: 'u_emp3', title: 'Office Assistant (Encoder)', company: 'Demo Computer Shop',
        description: 'Encode documents, print/scan files, and maintain client records.',
        salaryMin: 10000, salaryMax: 12000, salaryType: 'month',
        location: 'Toledo City', barangay: 'Poblacion',
        type: 'Part-time', requirements: 'Fast and accurate typing.',
        skillsRequired: ['Encoding / MS Office', 'Computer Literacy'], experienceLevel: 'No Experience Needed',
        openings: 2, deadline: iso(+12, true), status: 'Active', views: 9, datePosted: iso(-6) },
      { id: 'job_rider', employerId: 'u_emp1', title: 'Delivery Rider', company: 'Demo Local Restaurant',
        description: 'Deliver food orders around Toledo City using your own motorcycle. Gas allowance provided.',
        salaryMin: 8000, salaryMax: 12000, salaryType: 'month',
        location: 'Toledo City', barangay: 'Poblacion',
        type: 'Freelance', requirements: 'Valid driver license; knows Toledo routes.',
        skillsRequired: ['Driving', 'Customer Service'], experienceLevel: 'No Experience Needed',
        openings: 2, deadline: iso(+10, true), status: 'Active', views: 17, datePosted: iso(-3) },
      { id: 'job_electrician', employerId: 'u_emp2', title: 'Electrician Helper', company: 'Demo Construction Services',
        description: 'Assist the lead electrician in wiring installations for residential projects.',
        salaryMin: 500, salaryMax: 600, salaryType: 'day',
        location: 'Toledo City', barangay: 'Awihao',
        type: 'Temporary', requirements: 'Comfortable working at heights with supervision.',
        skillsRequired: ['Electrical Installation'], experienceLevel: 'No Experience Needed',
        openings: 3, deadline: iso(+16, true), status: 'Closed', views: 21, datePosted: iso(-14) }
    ]);
  }

  /* ---- applications (sample so employer/admin screens are not empty) ---- */
  if (!localStorage.getItem(KEYS.APPLICATIONS)) {
    Storage.set(KEYS.APPLICATIONS, [
      { id: 'app_maria1', jobId: 'job_sales', applicantId: 'u_seeker2', employerId: 'u_emp1',
        status: 'Shortlisted', appliedAt: iso(-3), message: 'I have 2 years of store experience and I live near Poblacion.' },
      { id: 'app_carlo1', jobId: 'job_welder', applicantId: 'u_seeker3', employerId: 'u_emp2',
        status: 'Reviewed', appliedAt: iso(-2), message: 'TESDA NC II holder with 3 years of shipyard experience.' }
    ]);
  }

  /* ---- trainings (Skills Training + Seminar categories) ---- */
  // Schema shared by skills-training & livelihood catalogs:
  // { id, title, organizer, category, description, venue, schedule,
  //   duration, slots, beneficiaryNote, contact, eligibility, requirements }
  if (!localStorage.getItem(KEYS.TRAININGS)) {
    Storage.set(KEYS.TRAININGS, [
      { id: 'trn_computer', title: 'Computer Literacy Training', organizer: 'Demo Community Learning Center',
        category: 'Skills Training', description: 'Free 10-session basics: using a computer, MS Word/Excel, email, and safe internet use.',
        venue: 'Poblacion Learning Center', schedule: 'Mon & Wed, 1PM–4PM · starts next month', duration: '10 sessions',
        slots: 25, beneficiaryNote: '', contact: '0917-000-0001',
        eligibility: 'Open to all residents 18+, no experience needed', requirements: 'Bring one valid ID', datePosted: iso(-8) },
      { id: 'trn_welding', title: 'Welding Skills Program (SMAW NC II)', organizer: 'TESDA (demo listing)',
        category: 'Skills Training', description: 'Hands-on SMAW welding training with assessment and certificate upon completion.',
        venue: 'Bato Training Annex', schedule: 'Daily, 8AM–5PM', duration: '45 days',
        slots: 20, beneficiaryNote: 'Uniform fee waived for the first 20 enrollees', contact: '0917-000-0002',
        eligibility: '18 years old and above', requirements: 'Closed shoes; tools provided', datePosted: iso(-12) },
      { id: 'trn_entrep', title: 'Entrepreneurship Training', organizer: 'DTI (demo listing)',
        category: 'Seminar', description: 'Learn how to start and price a small business, plus simple bookkeeping.',
        venue: 'Toledo City Hall Session Hall', schedule: 'Saturdays, 9AM–12NN', duration: '6 sessions',
        slots: 40, beneficiaryNote: '', contact: '0917-000-0003',
        eligibility: 'Aspiring micro-entrepreneurs', requirements: 'None', datePosted: iso(-6) },
      { id: 'trn_cooking', title: 'Cooking & Food Business Basics', organizer: 'Demo Culinary Hub',
        category: 'Skills Training', description: 'Basic cooking techniques plus how to turn cooking skills into income (carinderia/catering).',
        venue: 'Sam-ang Barangay Hall Kitchen', schedule: 'Tue & Thu, 2PM–5PM', duration: '8 sessions',
        slots: 15, beneficiaryNote: 'Take-home recipes included', contact: '0917-000-0004',
        eligibility: 'Open to all', requirements: 'Apron and food containers', datePosted: iso(-4) }
    ]);
  }

  /* ---- livelihoods (Livelihood + Assistance categories) ---- */
  if (!localStorage.getItem(KEYS.LIVELIHOODS)) {
    Storage.set(KEYS.LIVELIHOODS, [
      { id: 'liv_starter', title: 'Livelihood Starter Kit Program', organizer: 'LGU Toledo (demo listing)',
        category: 'Livelihood', description: 'Qualified applicants receive a starter kit (e.g., sari-sari store package or food cart) plus basic business mentoring.',
        venue: 'City Social Welfare Office', schedule: 'Rolling intake · orientation every Friday', duration: 'Ongoing',
        slots: 30, beneficiaryNote: 'Includes starter kit worth ₱5,000', contact: 'City Social Welfare Office',
        eligibility: 'Low-income families identified by the barangay', requirements: 'Barangay certificate of indigency', datePosted: iso(-10) },
      { id: 'liv_smallbiz', title: 'Small Business Assistance Grant', organizer: 'DTI (demo listing)',
        category: 'Livelihood', description: 'Small capital grant and mentoring for existing micro-businesses affected by emergencies.',
        venue: 'DTI Toledo Satellite Office', schedule: 'Open until end of quarter', duration: 'One-time grant',
        slots: 50, beneficiaryNote: 'Capital grant up to ₱10,000', contact: '0917-000-0005',
        eligibility: 'Registered sari-sari stores / micro-business owners', requirements: 'Business permit or barangay registration', datePosted: iso(-7) },
      { id: 'liv_jobassist', title: 'Community Employment Assistance', organizer: 'DOLE (demo listing)',
        category: 'Assistance', description: 'Job referral support, free resume printing, and emergency employment (TUPAD-style) placement.',
        venue: 'Public Employment Service Office (PESO)', schedule: 'Weekdays, 8AM–5PM', duration: 'Walk-in service',
        slots: 100, beneficiaryNote: 'Free resume printing', contact: 'PESO Toledo City',
        eligibility: 'Displaced workers and first-time job seekers', requirements: 'Valid ID', datePosted: iso(-5) },
      { id: 'liv_comassure', title: 'Barangay Livelihood Assistance (Grocery Package)', organizer: 'Barangay Council (demo listing)',
        category: 'Assistance', description: 'One-time grocery and hygiene package for indigent households referred by barangay workers.',
        venue: 'Your Barangay Hall', schedule: 'Distribution every 2nd Saturday', duration: 'One-time',
        slots: 200, beneficiaryNote: 'Grocery & hygiene package', contact: 'Your Barangay Hall',
        eligibility: 'Indigent households per barangay list', requirements: 'Endorsement from kagawad', datePosted: iso(-3) }
    ]);
  }

  /* ---- enrollments ---- */
  if (!localStorage.getItem(KEYS.ENROLLMENTS)) {
    Storage.set(KEYS.ENROLLMENTS, [
      { id: 'enr_maria1', programType: 'training', programId: 'trn_computer', userId: 'u_seeker2',
        status: 'Enrolled', enrolledAt: iso(-2) }
    ]);
  }

  /* ---- saved jobs ---- */
  if (!localStorage.getItem(KEYS.SAVED_JOBS)) {
    Storage.set(KEYS.SAVED_JOBS, [
      { id: 'sv_juan1', jobId: 'job_welder', userId: 'u_seeker1', savedAt: iso(-2) }
    ]);
  }

  /* ---- notifications (welcome messages for demo accounts) ---- */
  if (!localStorage.getItem(KEYS.NOTIFICATIONS)) {
    Storage.set(KEYS.NOTIFICATIONS, [
      notif('u_seeker1', 'Welcome to SkillBridge!', 'Complete your profile to get better job matches.', 'system', true),
      notif('u_emp1', 'Welcome to SkillBridge!', 'Your employer account is verified. You can now post jobs.', 'employer', true),
      notif('u_emp1', 'New application received', 'Maria Santos applied for Sales Assistant.', 'application'),
      notif('u_seeker2', 'Application update', 'Your application for Sales Assistant was shortlisted.', 'application')
    ]);
  }
}

/* ------------------------------ small helpers ---------------------------- */
// iso(-7) → ISO timestamp 7 days ago · iso(+14, true) → YYYY-MM-DD in 14 days
function iso(daysOffset, dateOnly = false) {
  const d = new Date(Date.now() + daysOffset * 864e5);
  return dateOnly ? d.toISOString().slice(0, 10) : d.toISOString();
}

function notif(userId, title, message, type = 'system', read = false) {
  return { id: generateId('ntf'), userId, title, message, type, read, createdAt: new Date().toISOString() };
}
