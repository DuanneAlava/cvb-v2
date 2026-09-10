# CampusVoiceBox - 30% Progress Guide

This guide explains what "30% done" actually contains in this codebase, how to run every
part of it, and what was added to fully round out that 30% checklist (some items existed
only as frontend mock behaviour before; they now have a real backend behind them too).

---

## 1. What "30%" means in this repo, item by item

### Planning & Setup (10%)

| Checklist item | Where it lives now |
|---|---|
| Project repo structure | `frontend/` and `backend/` as two independent apps, plus this guide at the root |
| Tech stack chosen | React (frontend) + Node.js/Express (backend) + PostgreSQL (database) |
| Folder structure & environment setup | `docker-compose.yml` brings up all three services with one command; `.env.example` files document every variable needed without Docker |
| CI/CD pipeline skeleton | `.github/workflows/ci.yml` - installs both apps, runs backend migrations against a real Postgres service container, boots the API, and builds both Docker images on every push/PR |

> Your original requirements doc listed Supabase in the tech stack. What was actually built
> and uploaded uses **plain PostgreSQL + a custom Express API with JWTs** instead - a more
> standard "learn the fundamentals yourself" backend, closer to what a capstone panel expects
> you to explain line by line. If you specifically need Supabase (for its hosted auth and
> instant REST API), say so and this backend can be swapped for a Supabase client instead;
> the database schema below maps onto Supabase's Postgres directly with no changes.

### Frontend Foundations (10%)

| Checklist item | Where it lives now |
|---|---|
| Landing page with navbar & sections | `src/pages/Home.jsx` - hero, then the full "Browse suggestions" board. The category pills and search box that used to sit between them now live in the navbar |
| Basic routing | `src/App.js` using `react-router-dom` (`/`, `/login`, `/signup`, catch-all redirect) |
| Initial UI components | `src/components/` - `Button`, `TextField`, `Navbar`, `SearchBar`, `ProfileMenu`, `ConfirmDialog`, `Footer`, `Logo`, `AuthCard`, `SuggestionCard`, `PostModal` |
| Responsive layout | Tailwind CSS throughout; below the `sm` breakpoint the navbar drops its search box onto a second row and shows the logo mark without the wordmark |
| **Fade-in animation (new)** | See section 4 below |

### Backend Foundations (10%)

Nothing in your uploaded build actually contained backend code - the tar you sent was a
Docker export of the **finished frontend only**. Everything in `backend/` was built to match
your requirements checklist exactly:

| Checklist item | Where it lives now |
|---|---|
| Database schema drafted | `backend/src/models/schema.sql` - `users`, `sessions`, `categories`, `posts`, `votes` |
| API endpoints for core CRUD | `backend/src/routes/` - register, login, list/create posts, toggle vote, list categories |
| Authentication flow skeleton | JWT-based - `backend/src/controllers/authController.js` + `backend/src/middleware/auth.js` |
| Local testing with Postman | `backend/postman/CampusVoiceBox.postman_collection.json` - import it and run top to bottom |

---

## 2. Running the frontend (no backend required)

The frontend still works completely on its own, using its built-in mock data and
`localStorage`-based accounts - exactly how it behaved before. This is the fastest way to
keep working on UI.

```bash
cd frontend
npm install
npm start
```

Opens on **http://localhost:3000**. Demo behaviour: sign up with any email/password (min 8
characters, one letter, one number) and you're logged in immediately - no real server needed.

---

## 3. Running the full stack (frontend + backend + database)

### Option A - Docker (recommended, one command)

```bash
docker compose up --build
```

This starts three containers:
- **db** - Postgres 16, schema and seed data loaded automatically on first run
- **backend** - Express API on **http://localhost:4000**
- **frontend** - React dev server on **http://localhost:3000**

A demo account is seeded automatically:
```
email:    demo@student.edu.ph
password: Demo1234
```

To stop everything: `Ctrl+C`, then `docker compose down` (add `-v` to also wipe the database
volume and start fresh next time).

### Option B - Running each piece manually (no Docker)

You'll need Postgres installed locally, or any hosted Postgres URL.

```bash
# 1. Backend
cd backend
cp .env.example .env       # edit PGUSER/PGPASSWORD/etc. to match your local Postgres
npm install
npm run db:migrate         # creates the tables
npm run db:seed            # loads categories + demo account + sample posts
npm run dev                # starts on http://localhost:4000

# 2. Frontend (separate terminal)
cd frontend
npm install
npm start                  # starts on http://localhost:3000
```

Check the backend is alive: `curl http://localhost:4000/api/health` should return
`{"status":"ok"}`.

### Testing the API with Postman

1. Open Postman -> Import -> select `backend/postman/CampusVoiceBox.postman_collection.json`.
2. Run **Auth -> Login (demo account)** first - it automatically saves the returned token into
   the collection's `token` variable.
3. Run any other request; the ones that need login (creating a post, voting) already send
   `Authorization: Bearer {{token}}` for you.

---

## 4. The fade-in animation you asked for

Two things now animate on the landing page:

1. **The hero** (`src/components/Header.jsx`) - the quote, the description, and the two
   buttons fade in one after another on page load, using a `fade-in-up` keyframe animation
   defined in `tailwind.config.js` and small `reveal-delay-*` helper classes in `index.css`
   to stagger the timing.
2. **The suggestion cards** (`src/pages/Home.jsx`) - each card is wrapped in a new
   `src/components/Reveal.jsx` component that uses `IntersectionObserver` to fade the card up
   into place the moment it scrolls into view, staggered card by card so a whole page of
   results doesn't pop in all at once. It only plays once per card (scrolling away and back
   does not replay it), and it's automatically disabled for anyone with
   `prefers-reduced-motion` turned on at the OS level.

No new dependencies were needed - both effects are plain CSS keyframes plus one small React
component.

---

## 4b. The Admin Panel

One account system, two dashboards. There is no separate admin login: everybody
signs in at `/login`, and the `role` on the account decides where they land.

```
LOGIN -> verify email + password -> read role
           |
           +-- super_admin / admin --> /admin/dashboard
           +-- student / user      --> /student/dashboard
```

**Demo accounts** (seeded by `frontend/src/services/store.js`, password
`campus123` for all of them - delete them before this is used for real):

| Role | Email |
|---|---|
| Super Admin | superadmin@ollcf.edu.ph |
| Admin | admin@ollcf.edu.ph |
| Student | juan.delacruz@ollcf.edu.ph |

### What is where

| Area | File |
|---|---|
| Roles and permissions | `frontend/src/data/roles.js` |
| Statuses, priorities, types, departments, notification types | `frontend/src/data/workflow.js` |
| The shared data layer both sides read | `frontend/src/services/store.js` |
| Route guards | `frontend/src/components/RequireAuth.jsx` |
| Admin shell and sidebar | `frontend/src/components/admin/AdminLayout.jsx` |
| Reusable table / modal / charts / badges | `frontend/src/components/admin/` |
| Admin pages | `frontend/src/pages/admin/` |
| Admin API | `backend/src/routes/adminRoutes.js` |

### Adding things later

The panel is driven by data files rather than hard-coded lists, so:

- **A new category** in `data/categories.js` appears in the post form, the
  navbar dropdown, the admin filters and the analytics charts.
- **A new status** in `data/workflow.js` gets a badge colour, a place in the
  filter dropdowns, and its own set of "move it to" buttons in the review
  dialog - the dialog builds those from the status's own `next` list.
- **A new submission type** joins the right monitoring page through its
  `group`, and gets the assignment controls if `needsAssignment` is true.
- **A new profile field** goes in two lists - `PROFILE_FIELDS` in
  `pages/student/Account.jsx` and `EDITABLE_FIELDS` in
  `pages/admin/UserProfile.jsx` - and both sides handle it.
- **A new admin page** is a `<Route>` inside the existing
  `<RequirePermission>` block in `App.js`, so it cannot be added unguarded.

### The moderation flow

Everything a student submits starts at `pending` and is invisible on the public
board. An administrator approves it, rejects it with a reason, or asks for a
revision. Approving publishes it; all three notify the student and write an
audit entry, in the same transaction as the status change.

Concerns go further: approved -> assigned to a department -> in progress ->
resolved with a written summary, which is sent to the student.

---

## 5. Connecting frontend to backend (the next step after 30%)

Right now the frontend and backend run side by side but the frontend doesn't call the
backend yet - it still uses its mock data, exactly as it did in your upload. This was
intentional: it keeps the frontend demoable with zero setup for a panel presentation.

When you're ready to wire them together, a small API client is already prepared at
`frontend/src/services/api.js` - the student endpoints, plus an `api.admin.*` group
matching every route in `backend/src/routes/adminRoutes.js` one for one. The swap is:

1. Copy `frontend/.env.example` to `.env.local` and set `REACT_APP_API_URL`.
2. In `AuthContext.jsx`, replace the `localStorage` read/write in `signup`/`login`/`logout`
   with calls to `api.register` / `api.login`, and store the returned JWT under
   `localStorage.setItem('cvb_token', token)` instead of the current session key.
3. In `services/boardStore.js`, replace the `localStorage` reads and writes inside
   `readBoard` / `writeBoard` with `api.getPosts()` and `api.createPost` / `api.toggleVote`.
   `Home.jsx` only talks to the `useBoard()` hook, so it does not change at all - and the
   BroadcastChannel wiring can stay, or be swapped for websockets to get live votes across
   different computers rather than just across tabs.

Two things to carry over to the server when you do:

- **The rudeness filter must run there too.** `services/moderation.js` runs in the browser,
  which is fine for telling a student off politely, but anyone can bypass a client-side
  check by calling the API directly. Port the same word lists into the `POST /posts`
  handler.
- **`authorEmail` must never leave the server.** Anonymous posts carry it so that
  "Your Suggestions" can still find them; if the API returns it, anonymous posting is
  anonymous in name only.

The backend returns posts with the same core field names (`type`, `category`, `author`,
`message`, `createdAt`, plus `hasVoted`), so this stays a contained swap rather than a
rewrite. Note the frontend no longer keeps a `votes` number on the post itself - it counts
the vote records instead, which is what stops counts drifting.

---

## 6. Project structure

```
campusvoicebox/
├── docker-compose.yml          # brings up db + backend + frontend together
├── .github/workflows/ci.yml    # CI/CD pipeline skeleton
├── frontend/
│   ├── src/
│   │   ├── components/         # Navbar, Header, Button, PostModal, SuggestionCard, Reveal...
│   │   ├── pages/               # Home, Login, Signup
│   │   ├── context/AuthContext.jsx
│   │   ├── data/                 # categories.js, suggestions.js (seed), blockedWords.js
│   │   ├── services/             # boardStore.js (saved + live votes), moderation.js
│   │   │                         # (rudeness filter), attachments.js (photo shrinking),
│   │   │                         # api.js (ready for the real API)
│   │   └── assets/campus-hero.jpg
│   ├── tailwind.config.js
│   └── package.json
└── backend/
    ├── src/
    │   ├── server.js / app.js
    │   ├── config/               # db.js, migrate.js, seed.js
    │   ├── models/schema.sql, seed.sql
    │   ├── controllers/          # authController.js, suggestionsController.js
    │   ├── middleware/           # auth.js (JWT), errorHandler.js
    │   └── routes/
    ├── postman/CampusVoiceBox.postman_collection.json
    ├── Dockerfile
    └── package.json
```

---

## 7. What's genuinely still missing beyond 30%

Being upfront about scope, so this isn't oversold as more finished than it is:

- **Attachments are frontend-only** - students can attach photos and files, and photos are
  shrunk to roughly 1000px before being saved so they fit in browser storage
  (`frontend/src/services/attachments.js`). The database schema has no `attachments` table
  yet, so nothing is stored server-side.
- **The rudeness filter is frontend-only** - `frontend/src/services/moderation.js` blocks
  swearing and name-calling in English and Filipino before a post is saved, and the board
  filters anything rude out again when it loads. A client-side check can be bypassed by
  calling the API directly, so the same word lists need porting into `POST /posts`.
- **Everything is live across tabs, not across computers** -
  `frontend/src/services/store.js` keeps the whole platform in browser storage and
  pushes every change to other open tabs instantly, so an approval in the admin
  panel lands on the student's board without a refresh. Two people on two laptops
  still see separate copies until the backend is wired in.
- **The admin panel's permission checks are frontend-only in this build** - and
  that is the one item on this list that must not ship. The route guards and role
  checks run in the visitor's browser, where a stored account can simply be edited,
  so they decide what the interface DRAWS and nothing more. The server-side half
  already exists - `requirePermission` in `backend/src/middleware/auth.js`, applied
  to all 14 routes in `adminRoutes.js`, re-reading the role from the database on
  every request - and it is what actually protects anything. Point `store.js` at
  the API before this is used for real.
- **No admin/staff role** - `users` table has no `role` column; every account is a student.
  Add a `role VARCHAR(20) DEFAULT 'student'` column when you build the staff-reply feature.
- **No post status transitions in the UI** - the `posts.status` column
  (`open` / `in_review` / `resolved`) exists in the schema and is ready for an admin panel to
  update, but no endpoint or screen changes it yet.
- **No rate limiting or email verification** - fine for a capstone demo, worth adding before
  any real deployment.
