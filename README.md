# SkillBridge — Livelihood & Job Matching Platform

A **frontend-only** web prototype connecting Toledo City, Cebu residents with local jobs,
skills training, and livelihood programs (UN **SDG 1: No Poverty**).
Built for a student Systems Analysis & Design project — no server required.

> **Prototype disclaimer:** authentication is simulated in the browser and passwords are
> stored as plain text in `localStorage`. This is intentionally NOT production secure.
> A real deployment needs a backend with hashed credentials.

---

## Quick Start

1. Download / clone this folder.
2. Double-click **`index.html`** (or serve it with any static file host).
   - Everything works from `file://` — no PHP, MySQL, Node, or Firebase needed.
3. Log in with a demo account (password for all: **`123456`**):

   | Role       | Email                        |
   |------------|------------------------------|
   | Job Seeker | `seeker@skillbridge.demo`    |
   | Employer   | `employer@skillbridge.demo`  |
   | Admin      | `admin@skillbridge.demo`     |

4. To wipe all data and restore the demo dataset: use **“Reset demo data”**
   at the bottom of any sidebar (or DevTools → Clear localStorage).

## Tech Stack

| Layer      | Technology                                        |
|------------|---------------------------------------------------|
| Structure  | Semantic HTML5                                    |
| Styling    | CSS3 (custom properties, grid/flexbox) + Poppins font & Font Awesome via CDN (system fallbacks work offline) |
| Logic      | Vanilla JavaScript (ES6+) — no frameworks         |
| Database   | Browser `localStorage` (one key per collection)   |

## Folder Structure

```
skillbridge/
├── index.html                  # Landing page
├── login.html                  # Login (+ demo-account quick fill)
├── register.html               # Sign-up with role picker
├── assets/
│   ├── css/
│   │   ├── style.css           # Palette, base, topbar/sidebar shell, utilities
│   │   ├── components.css      # Buttons, cards, forms, tables, badges, modals…
│   │   └── responsive.css      # Breakpoints, mobile drawer, print styles
│   └── js/
│       ├── storage.js          # “Database”: keys, Storage util, seed data
│       ├── auth.js             # Register/login/profile CRUD/role guards
│       ├── app.js              # Layout chrome, access guard, sidebar config
│       ├── ui.js               # esc/format/toast/modal/confirm helpers
│       ├── notifications.js    # In-app notification system
│       ├── jobs.js             # Job cards, search/filter, employer CRUD
│       ├── applications.js     # Apply workflow + status pipeline
│       ├── recommendations.js  # Rule-based matching engine (50/25/15/10)
│       ├── profile.js          # Seeker & employer profile builders
│       ├── resume.js           # Auto-generated printable resume
│       ├── programs.js         # Skills training & livelihood catalog
│       └── admin.js            # Dashboards, verification, moderation, reports
└── pages/
    ├── job-seeker/   dashboard · jobs · recommendations · applications ·
    │                 resume · profile · training · livelihood · notifications
    ├── employer/     dashboard · jobs · post-job · applicants · profile
    └── admin/        dashboard · users · employers · jobs · programs · reports
```

## How the Recommendation System Works

`Recommendations.calculateMatch(profile, job)` scores every active job:

| Criterion  | Weight | Rule                                             |
|------------|-------:|--------------------------------------------------|
| Skills     | 50%    | % of the job’s required skills found in the seeker’s skill list |
| Location   | 25%    | Same barangay = 25 · same city = 15              |
| Experience | 15%    | Seeker’s total years ≥ job requirement           |
| Job Type   | 10%    | Equals the seeker’s preferred job type           |

The result is shown as a score bar **plus a ✓/✗ explanation list**, so users can see exactly
why each job was recommended. This is a transparent **rule-based** system — no AI/ML — chosen
so the logic is explainable and easy to defend.

## Data Stored in LocalStorage

One key per collection (`storage.js → KEYS`):
`skillbridge_users`, `skillbridge_job_seekers`, `skillbridge_employers`,
`skillbridge_jobs`, `skillbridge_applications`, `skillbridge_skills`,
`skillbridge_trainings`, `skillbridge_livelihoods`, `skillbridge_enrollments`,
`skillbridge_notifications`, `skillbridge_saved_jobs`, `skillbridge_reports`,
`skillbridge_settings`, `skillbridge_current_user`.

Seed sample data (Toledo City barangays, demo employers, TESDA-style trainings) is inserted
only when a collection is empty, so user-created records survive refreshes.

## Key Workflows to Demo

1. **Seeker:** log in → Dashboard stats → Recommendations (with explanations) → Apply →
   track status under My Applications → enroll in a Training.
2. **Employer:** log in → Post a Job (goes to *Pending*) → Admin approves it → applicant applies →
   Employer marks *Shortlisted* → seeker receives notification.
3. **Admin:** verify pending employer → approve/reject jobs → add a program → view Reports and download JSON snapshot.

## Known Limitations (by design)

- Plain-text passwords; no real security (prototype scope).
- No email/SMS — notifications are in-app only.
- Single-browser data: records do not sync between devices or users.
- Employer “verification” is an admin judgment call (no document uploads).

## SDG Alignment

SDG target 1.3 & 1.4 — access to employment opportunities and economic resources.
SkillBridge reduces information asymmetry for Toledo City residents by centralizing
jobs, free training, and livelihood assistance in one accessible platform.
