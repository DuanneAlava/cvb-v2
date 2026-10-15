# CampusVoiceBox - Guide

This guide explains what is built, how to run every part of it, how the website and the
server talk to each other, and what is still left to do.

---

## 1. What is built, item by item

### Planning & Setup

| Checklist item | Where it lives now |
|---|---|
| Project repo structure | `frontend/` and `backend/` as two independent apps, plus this guide at the root |
| Tech stack chosen | React (frontend) + Node.js/Express (backend) + PostgreSQL (database) |
| Folder structure & environment setup | `docker-compose.yml` brings up all three services with one command; `.env.example` files document every variable needed without Docker |
| CI/CD pipeline skeleton | `.github/workflows/ci.yml` - on every push/PR: lints both apps, checks the lists both apps keep still match, runs the API tests and the migrations against a real Postgres service container, boots the API, builds the website, and builds every Docker image, development and production (section 3) |
| Production setup | `docker-compose.prod.yml` - the built website behind nginx, the API and the database, with nothing exposed but the website (section 3b) |

> Your original requirements doc listed Supabase in the tech stack. What was actually built
> uses **plain PostgreSQL + a custom Express API with JWTs** instead - a more standard "learn
> the fundamentals yourself" backend, closer to what a capstone panel expects you to explain
> line by line.

### Frontend

| Checklist item | Where it lives now |
|---|---|
| Landing page with navbar & sections | `src/pages/Home.jsx` - hero, then the full "Browse suggestions" board. The category dropdown and search box live in the navbar |
| Routing | `src/App.js` using `react-router-dom` - the board, log-in and sign-up, the student pages and every admin page, each guarded by role |
| UI components | `src/components/` - `Button`, `TextField`, `Navbar`, `SearchBar`, `ProfileMenu`, `ConfirmDialog`, `Footer`, `Logo`, `AuthCard`, `SuggestionCard`, `PostModal`, `AttachmentList`, and the admin panel's in `src/components/admin/` |
| Responsive layout | Tailwind CSS throughout; below the `sm` breakpoint the navbar drops its search box onto a second row and shows the logo mark without the wordmark |
| Fade-in animation | See section 4 below |

### Backend

| Checklist item | Where it lives now |
|---|---|
| Database schema | `backend/src/models/schema.sql` - accounts, categories, posts and their attachments, votes, internal notes, notifications, the activity log, and the privacy records (what each person agreed to, privacy requests, the privacy log) |
| API endpoints | `backend/src/routes/` - see section 5 for the full list |
| Authentication | JWT-based - `backend/src/controllers/authController.js` + `backend/src/middleware/auth.js` |
| Local testing with Postman | `backend/postman/CampusVoiceBox.postman_collection.json` - import it and run top to bottom |

---

## 2. Running it (Docker - one command)

The website keeps nothing of its own: every account, post and vote is stored by the server,
in the database. So the website needs the backend and the database running beside it.

First choose the default administrator's login. Put these three lines in a file named
`.env` beside `docker-compose.yml` (it is git-ignored), with your own email, and your own
password after `ADMIN_PASSWORD=` - at least 8 characters, with a letter and a number. No
password is written anywhere in the repository:

```ini
ADMIN_NAME=CampusVoiceBox Admin
ADMIN_EMAIL=admin@ollcf.edu.ph
ADMIN_PASSWORD=
```

Then:

```bash
docker compose up --build
```

This starts three containers:
- **db** - Postgres 16, the schema (tables plus the six categories) loaded automatically on first run
- **backend** - Express API on **http://localhost:4000**
- **frontend** - React dev server on **http://localhost:3000**

Open **http://localhost:3000**. On its first start the backend creates **the default
administrator** from `ADMIN_EMAIL` and `ADMIN_PASSWORD` - log in with those to open the admin
panel. **Signing up is for students and users only**: an account with a student number is a
student, one without is a general user, and the sign-up page never makes an administrator.

To stop everything: `Ctrl+C`, then `docker compose down`. Add `-v` to also wipe the database
volume and start fresh next time.

> **If you ran an older version before:** the database volume keeps the tables it was first
> created with, and this version changed them. Run `docker compose down -v` once to wipe the
> old database, then `docker compose up --build`.

## 3. Running each piece manually (no Docker)

You'll need Postgres installed locally, or any hosted Postgres.

```bash
# 1. Backend
cd backend
cp .env.example .env       # edit PGUSER/PGPASSWORD/etc. to match your Postgres, set JWT_SECRET,
                           # and set ADMIN_EMAIL and ADMIN_PASSWORD (the default administrator)
npm install
npm run db:migrate         # creates the tables and fills in the six categories
npm run dev                # starts on http://localhost:4000, creating the default administrator

# 2. Frontend (separate terminal)
cd frontend
npm install
npm start                  # starts on http://localhost:3000
```

Check the backend is alive: `curl http://localhost:4000/api/health` should return
`{"status":"ok"}`. If the website cannot reach the server it says so - *Cannot reach
CampusVoiceBox* - with a **Try again** button.

### Testing the API with Postman

1. Open Postman -> Import -> select `backend/postman/CampusVoiceBox.postman_collection.json`.
2. Set the collection's `adminEmail` and `adminPassword` variables to the `ADMIN_EMAIL` and
   `ADMIN_PASSWORD` in `backend/.env`. **Auth -> Log in as the default administrator** saves
   its token as `adminToken`, which the admin requests send.
3. Run **Auth -> Register a student account** (or **Login** once that account exists) - it
   saves the returned token into the collection's `token` variable, and the other requests
   send `Authorization: Bearer {{token}}` for you. Signing up needs `"acceptTerms": true` and
   the current `termsVersion` and `privacyVersion`, as the sign-up page sends them; the
   collection's requests already carry them.
4. **State** shows everything that account may see.

### Locked out of the admin panel?

A forgotten password is reset with **Forgot password?** on the log-in page, which emails a
one-time link (section 5). If that is not possible - email is not set up, or the
administrator's mailbox is gone - register a new account on the sign-up page, then promote it
on the server:

```bash
cd backend && npm run make-admin -- someone@school.edu.ph
# or, with Docker:
docker compose exec backend npm run make-admin -- someone@school.edu.ph
```

Sign in with it to manage the panel again. The promotion is written to the activity log as
"Command line".

### Checking a change

Three checks run in CI on every push (`.github/workflows/ci.yml`). Run them yourself
first:

| Check | Command | What it proves |
|---|---|---|
| Lint | `npm run lint`, in `frontend/` and in `backend/` | No ESLint errors or warnings. `frontend/.env` turns ESLint off inside the dev server and the build, so this is where it runs |
| The shared lists | `node scripts/check-shared-lists.mjs`, from the project folder, once the backend's packages are installed | Every list the website and the server both keep - statuses and moves, kinds, departments, categories, roles, policy versions, privacy request types, account fields, the password and email rules, the blocked words and the filter itself - still matches |
| The API tests | `npm test`, in `backend/` - see below | The real server and database, driven through sign-up, posting, review, voting, the privacy tools, password resets and account management - checking what each answers *and* what the activity log records |

The API tests (`backend/test/api.test.js`) wipe the database they run on and load
`schema.sql` afresh, so they refuse to run unless its name ends in `_test`. With Docker
running:

```bash
docker compose exec db createdb -U cvb_user campusvoicebox_test    # once
docker compose exec -e PGDATABASE=campusvoicebox_test backend npm test
```

Without Docker, create a `campusvoicebox_test` database in your Postgres and run
`npm test` in `backend/` with `PGDATABASE=campusvoicebox_test` and the other `PG*`
settings pointing at it. Nothing is emailed: the tests catch the reset email themselves.

---

## 3b. Running it for real (production)

`docker compose up` (section 2) is for development: dev servers, hot reload, the code
mounted from this folder. `docker-compose.prod.yml` runs the same system the way a live
site should:

| Container | What runs | Reachable from |
|---|---|---|
| **web** | nginx serving the *built* website (`frontend/Dockerfile.prod`, `frontend/nginx/`), and passing `/api` on to the backend | Outside, on `HTTP_PORT` (80) |
| **backend** | The API with only its runtime packages, `NODE_ENV=production`, as a non-root user (`backend/Dockerfile.prod`). It brings the database up to date at every start | nginx only |
| **db** | Postgres 16, with a password of its own | The backend only |

The website and the API share one address - nginx sends `/api/...` to the backend - so
the browser never needs CORS, and the backend sees each visitor's own address through
`TRUST_PROXY` for the rate limits and the activity log.

On the server (any machine with Docker):

1. Copy `.env.production.example` to `.env` beside `docker-compose.prod.yml` and fill it
   in. Compose refuses to start without `POSTGRES_PASSWORD`, `JWT_SECRET` and `APP_URL`,
   and names the one missing. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` for the first
   administrator, and the `SMTP_*` settings so "Forgot password?" can send its link.
2. Start it:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```
3. After changing the code, run the same command again: the code is inside the images, so
   they have to be rebuilt.

Its containers and its database volume are named `campusvoicebox-production`, apart from
the development ones, so both can live on one computer.

**What it does not do for you:**

- **HTTPS.** nginx listens on plain HTTP. Put it behind whatever provides HTTPS - the
  hosting platform, or a proxy such as Caddy or a load balancer with a certificate - and
  set `TRUST_PROXY=2`, since that is a second proxy in front of the backend.
- **Backups.** The database lives in a Docker volume. Back it up regularly, for example:
  ```bash
  docker compose -f docker-compose.prod.yml exec -T db pg_dump -U cvb_user campusvoicebox > backup.sql
  ```
- **Choosing the host.** Any server that runs Docker will do. The deploy job in `ci.yml`
  stays an outline until one is chosen.

---

## 4. The fade-in animation

Two things animate on the landing page:

1. **The hero** (`src/components/Header.jsx`) - the quote, the description, and the two
   buttons fade in one after another on page load, using a `fade-in-up` keyframe animation
   defined in `tailwind.config.js` and small `reveal-delay-*` helper classes in `index.css`
   to stagger the timing.
2. **The suggestion cards** (`src/pages/Home.jsx`) - each card is wrapped in
   `src/components/Reveal.jsx`, which uses `IntersectionObserver` to fade the card up into
   place the moment it scrolls into view, staggered card by card so a whole page of results
   doesn't pop in all at once. It only plays once per card, and it's automatically disabled
   for anyone with `prefers-reduced-motion` turned on at the OS level.

No dependencies were needed - both effects are plain CSS keyframes plus one small React
component.

---

## 4b. The Admin Panel

One account system, two dashboards. There is no separate admin login: everybody
signs in at `/login`, and the `role` on the account decides where they land.

```
LOGIN -> verify email + password (on the server) -> read role
           |
           +-- admin          --> /admin/dashboard
           +-- student / user --> /  (the board)
```

A student lands on the board, not on their dashboard: the board is what the
site is to them. Their dashboard - their own submissions and notifications -
is in the profile menu.

The administrator can use the student side too - the board, posting and
voting. **View site** in the admin panel's top bar opens it, and **Admin
panel** in the profile menu there goes back.

There is one admin role, and it holds every permission - changing roles and
deleting accounts included. What keeps those powers in check is not a second
tier above it but the self-checks: an account can never change its own role,
suspend itself or delete itself. Nobody changes or resets another person's
password: everybody changes their own from their account, and resets a
forgotten one with the emailed link. The server enforces every one of these;
the panel only hides the buttons.

**The administrator is the default account.** When the server starts and the
database has no administrator, it creates one from `ADMIN_NAME`, `ADMIN_EMAIL`
and `ADMIN_PASSWORD` (`backend/src/config/defaultAdmin.js`). Signing up only
ever makes student and user accounts (`register()` in
`backend/src/controllers/authController.js`); administrators promote other
accounts from the user profile page.

### What is where

For a plain-English, file-by-file explanation of the code - what each thing
is, what it is called, and why it is written that way - see
[`docs/CODE-WALKTHROUGH.md`](docs/CODE-WALKTHROUGH.md). Each of the files
below also opens with a "What you'll meet in this file" note.

For how the whole thing is structured - the tiers, the layers, the data
model, the security model - and how it is built - the methodology, the daily
loop, branching, CI and testing - see
[`docs/SYSTEM-ARCHITECTURE.md`](docs/SYSTEM-ARCHITECTURE.md).

For how to *use* the platform rather than how it is built, there are two
illustrated manuals: [`docs/STUDENT-MANUAL.md`](docs/STUDENT-MANUAL.md)
for the board, posting, voting and tracking a submission, and
[`docs/ADMIN-MANUAL.md`](docs/ADMIN-MANUAL.md) for the review queues, the
assignment and resolution workflow, user management and exports. The
screenshots they use are in `docs/images/`.

| Area | File |
|---|---|
| Roles and permissions | `frontend/src/data/roles.js` (and `ROLE_PERMISSIONS` in `backend/src/middleware/auth.js`) |
| Statuses, types, departments, notification types | `frontend/src/data/workflow.js` (and `backend/src/models/workflow.js`) |
| The data layer every screen reads | `frontend/src/services/store.js` |
| Every request to the server | `frontend/src/services/api.js` |
| Route guards | `frontend/src/components/RequireAuth.jsx` |
| Admin shell and sidebar | `frontend/src/components/admin/AdminLayout.jsx` |
| Reusable table / modal / charts / badges | `frontend/src/components/admin/` |
| Admin pages | `frontend/src/pages/admin/` |
| Admin API | `backend/src/routes/admin/` - one file per area: users, posts, privacy requests, the activity log |
| The policy pages | `frontend/src/pages/legal/` and `frontend/src/components/PolicyPage.jsx` |
| Policy versions, and the facts still to be confirmed | `frontend/src/data/policies.js` (and `backend/src/models/policies.js`) |
| What the site stores in the browser, and the cookie choice | `frontend/src/services/consent.js`, `frontend/src/components/CookieConsent.jsx` |
| A person's own privacy choices and rights | `frontend/src/components/PrivacyData.jsx`, `backend/src/controllers/privacyController.js` |
| Handling privacy requests | `frontend/src/pages/admin/PrivacyRequests.jsx`, the privacy-request route in `backend/src/routes/admin/privacyRequests.js` |

### Adding things later

The panel is driven by data files rather than hard-coded lists. Several lists
exist twice - once for the website to draw, once for the server to enforce -
and both copies must change together:

- **A new category** goes in `frontend/src/data/categories.js` and in the
  `INSERT INTO categories` rows of `backend/src/models/schema.sql`. It then
  appears in the post form, the navbar dropdown, the admin filters and the
  analytics charts.
- **A new status** goes in `frontend/src/data/workflow.js` and
  `backend/src/models/workflow.js` (with the same `next` moves), and in the
  CHECK on `posts.status` in `schema.sql`. It gets a badge colour, a place in
  the filter dropdowns, and its own "move it to" buttons in the review dialog.
- **A new submission type** goes in both `workflow.js` files and the CHECK on
  `posts.kind`. It joins the right monitoring page through its `group`, and
  gets the assignment controls if `needsAssignment` is true.
- **A new account field** goes in `ACCOUNT_FIELDS` in
  `frontend/src/data/accountFields.js` - both account forms are built from it -
  and in `ACCOUNT_FIELDS` in `backend/src/models/accountRules.js`, plus a
  column in the `users` table.
- **A new blocked word** goes in both `blockedWords.js` files -
  `frontend/src/data/` and `backend/src/models/`.
- **A new admin page** is a `<Route>` inside the existing
  `<RequirePermission>` block in `App.js`, so it cannot be added unguarded.
- **A change to a policy's text** changes its version - the date - in
  `POLICY_VERSIONS` in both `policies.js` files (`frontend/src/data/` and
  `backend/src/models/`). Sign-up then records the new version. If everybody
  must accept the new Terms, also raise `TERMS_REQUIRED_VERSION` in
  `backend/src/models/policies.js`: each account is asked once, and cannot post
  or vote until it accepts.
- **Something new kept in the browser** goes in `STORAGE_ITEMS` in
  `frontend/src/services/consent.js`, with its category. The Cookie Policy's
  table and the cookie window list it from there. If it is optional, raise
  `COOKIE_CONSENT_VERSION` in both `policies.js` files, so everybody is asked
  again about what is now in that category.

A copy changed on one side only is caught: `node scripts/check-shared-lists.mjs`
compares every pair, and CI runs it on every push (section 3, "Checking a change").

### The moderation flow

Everything a student submits starts at `pending` and is invisible on the public
board. An administrator approves it or rejects it with a reason. Approving
publishes it; both notify the student and write an audit entry, in the same
database transaction as the status change.

Requests, concerns, complaints and reports go further: approved -> assigned to a
department (which puts them *in progress*) -> resolved with a written summary,
which is sent to the student. The server refuses any move the review dialog
would not offer.

## 4c. Privacy, consent and the policies

- **Three policy pages**, open to everybody: `/privacy-policy`,
  `/terms-and-conditions` and `/cookie-policy`. They describe what the system
  actually does. Facts only the school can supply - who is responsible for the
  data, the Data Protection Officer's contact, how long records are kept, where
  the server is - are highlighted as *To be confirmed* until they are filled in
  in `ORGANIZATION` in `frontend/src/data/policies.js`. Questions for a lawyer are
  highlighted as *For legal review*. While anything is unconfirmed, every policy
  says it is a draft.
- **The cookie choice.** The site sets no cookies. It keeps three small items in
  the browser - the sign-in token, the cookie choice itself, and one optional
  convenience (whether the greeting hand has waved this visit). A banner on the
  first visit offers *Accept All*, *Reject Optional* and *Customize Preferences*,
  equally weighted. Nothing optional is written before a yes, and saying no
  deletes it. *Cookie settings* at the foot of every page reopens the choice. A
  choice made while signed in is also kept with the account.
- **Signing up** needs a tick on the Terms (never pre-ticked), and records the
  Terms and Privacy Policy versions with the time. School details are optional
  and have their own separate tick.
- **When the Terms change** in a way everybody must accept, each account is asked
  once. Until they accept, the server refuses their posts and votes; reading is
  never blocked.
- **Privacy & Data** on the account page (and on an administrator's own profile):
  the policies, what was accepted and when, the school-details consent (given or
  withdrawn in one click - withdrawing deletes the details), the cookie choice,
  *Download my data* (one JSON file, at once), and privacy requests - access,
  correction, deletion or other.
- **Privacy Requests** in the admin panel (`/admin/privacy`, the `manage_privacy`
  permission): start, complete or decline each request with a reply the person
  sees. Completing a deletion request deletes the account, and the administrator
  chooses whether the person's submissions go too. Nobody handles a request about
  their own account. Every step is in the privacy log, which cannot be edited.

---

## 5. How the website talks to the server

The website holds one copy of everything the signed-in person is allowed to see,
fetched in one request - `GET /api/state` - and every screen reads that copy
(`frontend/src/services/store.js`). A change - approve, vote, post - is sent to the
server, which checks it, saves it, writes the audit entry and notifies the student; then
the copy is fetched again. The copy is also re-fetched every 15 seconds while the tab is
in view, and whenever it comes back into view, so an approval reaches a student's board
without anybody reloading.

**What each person is sent is the server's decision** (`backend/src/controllers/stateController.js`):

| Who | What `/api/state` sends |
|---|---|
| A visitor | The published posts. No author behind an anonymous post. |
| A student or user | The same, plus their own posts in every status, their own account, their own notifications, and their own privacy picture - what they accepted, their consents and their privacy requests. |
| An administrator | Everything - every post with its author (anonymous or not) and internal notes, every account, the admin notifications and the latest 500 activity-log entries - plus their own privacy picture. With `manage_privacy`, also every privacy request and the latest 300 privacy-log entries. Nobody else's consents are sent to anybody. |

Votes arrive as a count per post plus whether *you* voted - never who else did.

The sign-in token is kept in the browser's `localStorage` under `cvb_token` and sent with
every request. It is not a cookie, so the browser never sends it by itself - every item
the site keeps in the browser is listed in `frontend/src/services/consent.js`. The server re-reads the account on every request, so a suspension, a role
change or a password reset takes effect at once - a password reset signs that person out
on every device.

### The API

| Method | Path | Who |
|---|---|---|
| GET | `/api/health` | anyone |
| GET | `/api/state` | anyone (what you get depends on who you are) |
| POST | `/api/auth/register`, `/api/auth/login` | anyone |
| POST | `/api/auth/forgot-password`, `/api/auth/reset-password` | anyone - email a one-time reset link, then use it |
| POST | `/api/auth/logout` | signed in |
| POST | `/api/posts` | signed in, not suspended, current Terms accepted - with up to three photos or PDFs |
| POST | `/api/posts/:id/vote` | signed in, not suspended, current Terms accepted - toggles your vote |
| GET | `/api/attachments/:id` | anyone for a published post; the author and staff otherwise |
| PATCH | `/api/account` | signed in - your own name and school details (school details only with your consent) |
| PUT | `/api/account/photo` | signed in - your own profile photo |
| PUT | `/api/account/password` | signed in - change your own password (needs the current one) |
| POST | `/api/account/terms` | signed in - accept the current Terms |
| PUT | `/api/account/school-consent`, `/api/account/cookie-consent` | signed in - your own consents |
| GET | `/api/account/export` | signed in - everything held about you, as a JSON file |
| POST | `/api/privacy-requests`, `/api/privacy-requests/:id/cancel` | signed in - your own requests |
| GET | `/api/users/:id/photo` | that account, and staff |
| PATCH | `/api/notifications/:id/read`, POST `/api/notifications/read-all` | signed in |
| PATCH | `/api/admin/users/:id` (details), `/status`, `/role` | admin |
| DELETE | `/api/admin/users/:id` | admin |
| PATCH | `/api/admin/posts/:id/status`, `/assign`, `/resolve` | admin |
| POST | `/api/admin/posts/:id/notes` | admin |
| GET | `/api/admin/activity-logs` | admin - the whole log, for the export |
| PATCH | `/api/admin/privacy-requests/:id` | `manage_privacy` - start, complete or decline; never your own |

### Protections on the server

- **Every permission is checked on the server**, against the account as it is in the
  database right now - not against the token, and never against what the website shows.
- **The rudeness filter runs on the server too** - `backend/src/models/moderation.js` is the
  same filter as the website's. Keep the two copies identical.
- **Files are checked**: only photos and PDFs, at most three per post, within the size
  limits, and the contents must really be the type they claim.
- **Limits on repeated attempts** (`backend/src/middleware/rateLimit.js`): ten wrong
  passwords for one account in 15 minutes, ten posts per account per hour, and a generous
  ceiling per network address.
- **Security headers** on every answer, and the server **refuses to start** without a
  `JWT_SECRET` - or, in production, with a short one or the example's placeholder.
- **Consent is checked on the server**: no account without accepting the current Terms, no
  posting or voting while newer Terms are waiting to be accepted, and no school details
  without the person's consent - whoever sends them.

### Settings the server and website read

| Setting | Where | What it is |
|---|---|---|
| `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` | backend | The database |
| `JWT_SECRET` | backend | What makes sign-in tokens impossible to forge. A long random value - `openssl rand -hex 32`. Required. |
| `JWT_EXPIRES_IN` | backend | How long a sign-in lasts (default `7d`) |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | backend | The default administrator, created when the server starts if the database has none. The password needs at least 8 characters, with a letter and a number. Once the account exists, changing these does nothing - its password is changed from the admin's own profile, or with "Forgot password?" |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | backend | The mail server that sends "Forgot password?" links - for example the school's Google Workspace (an *app password* as `SMTP_PASS`). Left empty while developing, the email is printed in the server's console instead. Required in production; like `ADMIN_PASSWORD`, `SMTP_PASS` belongs only in your own `.env` |
| `APP_URL` | backend | The website's address, which the emailed reset link points to (default `http://localhost:3000`). Set it in production |
| `CORS_ORIGIN` | backend | The website's address(es), comma-separated, if the website is on a different address from the API |
| `TRUST_PROXY` | backend | Set to `1` when a reverse proxy sits in front of the API, so the activity log and the rate limits see the visitor's address rather than the proxy's. `docker-compose.prod.yml` sets `1` for its nginx; `2` when HTTPS is handled by another proxy in front of that |
| `POSTGRES_PASSWORD`, `HTTP_PORT` | `docker-compose.prod.yml` | The production database's password (required), and the port the website is published on (default `80`) - see `.env.production.example` |
| `NODE_ENV` | backend | `production` turns on the strict `JWT_SECRET` check |
| `PORT` | backend | Default `4000` |
| `REACT_APP_API_URL` | frontend, when it is **built** | The API's address. Left unset, a production build uses `/api` on the website's own address, and development uses `http://localhost:4000/api` |

---

## 6. Project structure

```
campusvoicebox/
├── docker-compose.yml          # brings up db + backend + frontend together (development)
├── docker-compose.prod.yml     # the same for real use: nginx + API + db (section 3b)
├── .env.production.example     # the settings docker-compose.prod.yml reads
├── .github/workflows/ci.yml    # CI: lint, shared lists, API tests, builds
├── scripts/check-shared-lists.mjs  # fails if the frontend's and backend's lists differ
├── docs/                       # manuals, architecture, code walkthrough, screenshots
├── frontend/
│   ├── src/
│   │   ├── components/         # Navbar, Header, PostModal, SuggestionCard, AttachmentList...
│   │   │   └── admin/          # the admin panel's layout, table, modal, charts, badges
│   │   ├── pages/              # Home, Login, Signup, ForgotPassword, ResetPassword
│   │   │   ├── legal/          # Privacy Policy, Terms & Conditions, Cookie Policy
│   │   │   ├── student/        # Dashboard, Account
│   │   │   └── admin/          # Dashboard, Submissions, Users, Analytics, Exports...
│   │   ├── context/AuthContext.jsx
│   │   ├── data/               # categories, roles, workflow, account fields, word lists,
│   │   │                       # policy versions and the facts still to be confirmed
│   │   ├── hooks/              # useApiFile, useFilterParams, useEscapeKey
│   │   └── services/           # store.js (the data layer), api.js (every request),
│   │                           # moderation.js (rudeness filter), attachments.js
│   │                           # (photo shrinking), csv.js (exports), consent.js
│   │                           # (browser storage and the cookie choice)
│   ├── nginx/                  # the production web server's settings
│   ├── tailwind.config.js
│   ├── Dockerfile              # development image (React dev server)
│   ├── Dockerfile.prod         # production image: the built site, served by nginx
│   └── package.json
└── backend/
    ├── src/
    │   ├── server.js / app.js
    │   ├── config/             # db.js, migrate.js, make-admin.js, defaultAdmin.js
    │   ├── controllers/        # auth, state, suggestions (posts, votes, files), account, privacy
    │   ├── middleware/         # auth.js (who may do what), terms.js, rateLimit.js, errorHandler.js
    │   ├── models/             # schema.sql, workflow, account rules, policies, files, moderation...
    │   └── routes/
    │       └── admin/          # the admin API: users, posts, privacy requests, activity log
    ├── test/api.test.js        # the API tests (npm test)
    ├── postman/CampusVoiceBox.postman_collection.json
    ├── Dockerfile              # development image (nodemon)
    ├── Dockerfile.prod         # production image: runtime packages only, not root
    └── package.json
```

---

## 7. What is still not built

Being upfront about scope, so this isn't oversold as more finished than it is:

- **Email is used for one thing only:** the "Forgot password?" link. There is no email
  verification at sign-up, and no notification is emailed - notifications stay on the site.
  The school's mail server has to be set up (`SMTP_*`, section 5) for reset links to be
  sent.
- **Rate limits are counted in one server's memory.** Enough for one server; they reset when
  it restarts, and several servers behind a load balancer would each count separately.
- **The tests cover the API, not the screens.** `backend/test/` drives the real server and
  database; nothing clicks through the website itself in a browser.
- **Going live still needs a host, HTTPS and backups.** `docker-compose.prod.yml` runs the
  whole system the production way (section 3b), but where it runs, the certificate in
  front of it and the database backups are the school's to arrange, and the deploy job in
  `ci.yml` is an outline until then.
- **The policies are drafts.** They follow the principles of the Data Privacy Act of 2012
  (RA 10173) but do not claim compliance. The school must fill in the facts marked *To be
  confirmed* and have the parts marked *For legal review* checked by its lawyer or Data
  Protection Officer before relying on them.
- **Privacy requests are answered on the site only.** The reply is not emailed, so a person
  whose account was deleted at their request cannot read it; the administrator has their
  email address on the request if they need to be told.
