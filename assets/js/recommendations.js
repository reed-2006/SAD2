/* ==========================================================================
   SkillBridge — recommendations.js
   SkillBridge Job Recommendation System (RULE-BASED — no AI/ML).

   Match score = Skills(50) + Location(25) + Experience(15) + Job Type(10)

   calculateMatch() returns BOTH a percentage AND a human-readable
   explanation list, so users can see exactly WHY a job was recommended.
   ========================================================================== */

const Recommendations = {

  /* Map experience labels to numbers so they can be compared. */
  EXP_LEVELS: { 'No Experience Needed': 0, '1 Year': 1, '2 Years or More': 2 },

  /* Total years of work experience from a seeker profile's experience list.
     Each entry duration is expected like "1 year", "2 years", "6 months". */
  totalExperienceYears(profile) {
    let months = 0;
    (profile?.experience || []).forEach(e => {
      const m = String(e.duration || '').toLowerCase().match(/(\d+)\s*(year|month)/);
      if (m) months += Number(m[1]) * (m[2] === 'year' ? 12 : 1);
    });
    return Math.floor(months / 12);
  },

  /*
    Function: calculateMatch(profile, job)
    Compares the job seeker's profile against one job and returns:
      { score: 0–100, reasons: [{ok:true/false, text:'…'}] }
    Weights: skills 50% · location 25% · experience 15% · job type 10%
  */
  calculateMatch(profile, job) {
    const reasons = [];

    /* ---------- 1) SKILLS — up to 50 points ---------- */
    const required = (job.skillsRequired || []).map(s => s.toLowerCase());
    const mine = (profile.skills || []).map(s => s.toLowerCase());
    const matched = required.filter(r =>
      mine.some(m => m === r || m.includes(r) || r.includes(m)));

    // A job with no listed skills can still match on other criteria.
    const skillScore = required.length
      ? Math.round((matched.length / required.length) * 50)
      : 25;
    reasons.push({
      ok: skillScore >= 25,
      text: required.length
        ? `${matched.length} of ${required.length} required skills matched`
        : 'No specific skills required'
    });

    /* ---------- 2) LOCATION — up to 25 points ---------- */
    let locationScore = 0;
    if (profile.barangay && job.barangay &&
        profile.barangay.toLowerCase() === job.barangay.toLowerCase()) {
      locationScore = 25;
      reasons.push({ ok: true, text: `Same barangay (${job.barangay})` });
    } else if ((profile.location || '').toLowerCase() === (job.location || '').toLowerCase()) {
      locationScore = 15;
      reasons.push({ ok: true, text: `Same city (${job.location})` });
    } else {
      reasons.push({ ok: false, text: `Different location (${job.location})` });
    }

    /* ---------- 3) EXPERIENCE — up to 15 points ---------- */
    const neededExp = this.EXP_LEVELS[job.experienceLevel] ?? 0;
    const userYears = this.totalExperienceYears(profile);
    let expScore = 0;
    if (neededExp === 0) {
      expScore = 15;
      reasons.push({ ok: true, text: 'No experience required' });
    } else if (userYears >= neededExp) {
      expScore = 15;
      reasons.push({ ok: true, text: `Your ${userYears} yr(s) of experience meets the requirement` });
    } else {
      reasons.push({ ok: false, text: `Needs ${neededExp}+ year(s); you have ${userYears}` });
    }

    /* ---------- 4) JOB TYPE — up to 10 points ---------- */
    let typeScore = 0;
    if (profile.preferredJobType && profile.preferredJobType === job.type) {
      typeScore = 10;
      reasons.push({ ok: true, text: `Preferred job type (${job.type})` });
    } else {
      reasons.push({ ok: false,
        text: profile.preferredJobType ? `You prefer ${profile.preferredJobType}; this is ${job.type}`
                                        : 'Set your preferred job type in your profile' });
    }

    const score = Math.min(100, skillScore + locationScore + expScore + typeScore);
    return { score, reasons };
  },

  /* All Active jobs ranked best-match first for one seeker profile. */
  getRankedJobs(profile) {
    return Storage.get(KEYS.JOBS)
      .filter(j => j.status === 'Active')
      .map(job => ({ job, ...this.calculateMatch(profile, job) }))
      .sort((a, b) => b.score - a.score);
  }
};
