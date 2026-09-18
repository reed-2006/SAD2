# SkillBridge — Study & Defense Notes

Use this to prepare for your professor's progress check. Everything here matches the
actual code in the repo, so you can point to files/lines during the demo.

---

## 1. One-line pitch

> **SkillBridge** is a job-matching and livelihood platform for **Toledo City, Cebu**
> that connects residents to **local jobs, free skills training, and livelihood
> programs** — built in support of **UN SDG 1: No Poverty**.

Frontend prototype only — no server. All data lives in the browser (`localStorage`).

---

## 2. The three user roles (demo accounts)

All passwords are `123456`.

| Role        | Email                    | What they can do                                                        |
|-------------|--------------------------|-------------------------------------------------------------------------|
| **Seeker**  | `seeker@skillbridge.demo`| Browse jobs, get match scores, apply, track status, enroll in training, build resume |
| **Employer**| `employer@skillbridge.demo` | Post jobs, view applicants, move them through a status pipeline      |
| **Admin**   | `admin@skillbridge.demo` | Verify employers, approve/reject jobs, add programs, view reports       |

Extra seeded accounts: `maria@`, `carlo@` (seekers), `construction@`,
`computershop@` (employers).

Quick demo path: on `login.html` there is a **demo-account quick-fill** button —
click it, pick a role, done.

---

## 3. What the professor will see (the "wow" points)

1. **Smart matching with explanations.** Every job gets a **0–100 match score bar**
   plus a **✓ / ✗ reason list** ("2 of 2 required skills matched", "Same barangay"…).
   This is transparent, explainable logic — easy to defend. (`assets/js/recommendations.js`)
2. **Full application pipeline.** Pending → Reviewed → Shortlisted → Accepted/Rejected.
   Both applicant and employer get an in-app notification at every step.
   (`assets/js/applications.js`)
3. **Role-based apps with access guard.** Each role gets its own dashboard and
   sidebar; you can't open another role's pages. (`assets/js/app.js`)
4. **Zero setup demo.** Open `index.html` directly — seed data, demo accounts, and
   "Reset demo data" button are built in. (`assets/js/storage.js`)
5. **JSON backup/restore.** Export the whole "database" as a file and import it back.

---

## 4. Recommendation engine (memorize these numbers)

`Recommendations.calculateMatch(profile, job)` — **approved rule-based design, no AI/ML:**

| Criterion  | Weight | Rule |
|------------|-------:|------|
| **Skills**     | **50%** | % of the job's required skills found in the seeker's skills |
| **Location**   | **25%** | same barangay = 25 · same city = 15 · different = 0 |
| **Experience** | **15%** | seeker's total years ≥ job requirement (or job needs none) |
| **Job Type**   | **10%** | equals the seeker's preferred job type |

Other behaviors worth mentioning:
- Only **Active** jobs are ranked (`getRankedJobs` filters them).
- Exp year strings map to numbers: "No Experience Needed"=0, "1 Year"=1, "2 Years or More"=2.
- Returns `{ score, reasons }` — that's how the UI shows WHY.
- Score is capped at 100.

---

## 5. The simulated database (localStorage)

One storage key per collection (`storage.js → KEYS`, all prefixed `skillbridge_`):

- `users`, `job_seekers`, `employers`, `jobs`, `applications`
- `skills`, `trainings`, `livelihoods`, `enrollments`
- `notifications`, `saved_jobs`, `reports`, `settings`, `current_user`

Core helpers you can quote:
- `Storage.get(key)` → read a JSON string and parse it back to an array/object.
- `Storage.set(key, data)` → JSON.stringify + save. Persistent across refreshes.
- `Storage.clear()` → wipes everything (used by "Reset demo data").
- `initializeData()` runs on **every page load** and seeds sample data **only if a
  collection is empty**, so user-created records survive refreshes.

---

## 6. Tech stack (know why, not just what)

| Layer     | Choice | Why / talking point |
|-----------|--------|---------------------|
| Structure | Semantic **HTML5** | accessible, `main`/`section`, skip link |
| Styling   | **CSS3** custom props + grid/flexbox | no framework needed; `responsive.css` handles mobile drawer |
| Logic     | **Vanilla JS (ES6+)** | no framework → logic is easy to read/explain |
| "DB"      | **localStorage** | perfect for a client-only prototype |
| JS file split | one module per concern | `storage`, `auth`, `jobs`, `applications`, `recommendations`, `profile`, `resume`, `programs`, `admin`, `notifications`, `ui` |

---

## 7. Architecture / how a page loads

`<body data-page="jobs" data-role="seeker">` marks who a page belongs to.

On every page, `app.js`:
1. Sets `BASE` so links work from `/pages/...` subfolders.
2. Runs `initializeData()` (seed sample data).
3. **Access guard:** not logged in → send to `login.html`; wrong role → send to that
   role's dashboard.
4. Renders the shared **topbar** + role **sidebar** and the notification bell.

So "authentication" here = checking `skillbridge_current_user` in localStorage.
(**Honest caveat, say it first:** passwords are plain text and anyone can open
DevTools — this is a prototype, a real system needs a backend with hashed passwords.)

---

## 8. Core workflows (practice these)

**Seeker:** login → Dashboard stats → Recommendations (read the reasons) → Apply →
"My Applications" status badge → enrol in a Training → generate Resume.

**Employer:** login → Post a Job (goes to **Pending**) → Admin approves it →
applicant applies → Employer marks **Shortlisted** → seeker gets notification.

**Admin:** verify a pending employer → approve/reject jobs → add a program →
Reports page → download JSON snapshot.

---

## 9. Honest limitations (say these — professors love honesty)

- Plain-text passwords, simulated login (prototype scope).
- No email/SMS; notifications are in-app only.
- Data is single-browser — no sync between devices/users.
- Employer verification is an admin judgment call, no document upload.
- These are **by design** and documented in the README.

---

## 10. Anticipated professor questions + answers

**Q: "Why is there no backend?"**
> A: The spec asked for a proof-of-concept of the workflows and the matching logic.
> localStorage lets us demo the full experience with zero setup, and clearly separates
> what a future backend would own: real authentication, shared data, email.

**Q: "How does the matching work?"**
> A: A weighted rule-based score, 50% skills / 25% location / 15% experience / 10%
> job type. Each job also returns the list of matched/missed criteria so it's fully
> explainable — deliberately not a black-box model.

**Q: "What would Phase 2 / production look like?"**
> A: A real backend with hashed passwords, real email/SMS, a server DB, and document
> uploads for employer verification. (Also a natural place for actual ML if wanted.)

**Q: "How is this related to SDG 1?"**
> A: SDG targets 1.3/1.4 — access to employment and economic resources. SkillBridge
> centralizes scattered job posts, free training, and livelihood help for Toledo City,
> reducing the information gap that keeps people out of work.

**Q: "Why vanilla JS instead of React?"**
> A: For a prototype this size it keeps the code transparent, dependency-free, and
> openable from `file://` with no build step — and the logic is easier to defend.

---

## 11. 2-minute demo script

1. Open `index.html` → show hero stats are **live** (counts from localStorage).
2. Login as **seeker** (`seeker@skillbridge.demo` / `123456`) → dashboard stats.
3. Open **Recommendations** → point at a high score and read the ✓ reasons out loud.
4. **Apply** to a job → show the toast + go to **Applications** (Pending).
5. Log out → login as **employer** → **Applicants** → move one to **Shortlisted**.
6. Log out → login as **admin** → approve a pending job / check **Reports**.
7. Close with limitations + next steps (real backend).