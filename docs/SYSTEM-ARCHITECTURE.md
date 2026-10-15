# CampusVoiceBox — System Architecture & Development Process

How the whole website is put together, and how it is built. Part A is the
**architecture**: the pieces, what each one is responsible for, and where the
boundaries between them sit. Part B is the **development process**: how the
project moves from an idea to running code — the methodology, the daily loop,
the branching and CI, the testing, and what has to be true before this is
allowed near a real campus.

This document is about *structure and practice*. For a line-by-line tour of
the files, read [`CODE-WALKTHROUGH.md`](./CODE-WALKTHROUGH.md); for how to run
things, [`../GUIDE.md`](../GUIDE.md); for how to *use* the platform, the
[`STUDENT-MANUAL.md`](./STUDENT-MANUAL.md) and
[`ADMIN-MANUAL.md`](./ADMIN-MANUAL.md).

---

## Contents

**Part A — System architecture**

1. [Architectural overview](#1-architectural-overview)
2. [Deployment view](#2-deployment-view)
3. [How the client and the server talk](#3-how-the-client-and-the-server-talk)
4. [Technology stack](#4-technology-stack)
5. [Logical layers](#5-logical-layers)
6. [Frontend architecture](#6-frontend-architecture)
7. [Backend architecture](#7-backend-architecture)
8. [Data architecture](#8-data-architecture)
9. [Security architecture](#9-security-architecture)
10. [Cross-cutting concerns](#10-cross-cutting-concerns)
11. [Lists kept in two places](#11-lists-kept-in-two-places)

**Part B — Development process**

12. [Methodology](#12-methodology)
13. [Phases and milestones](#13-phases-and-milestones)
14. [Environment setup](#14-environment-setup)
15. [The daily development loop](#15-the-daily-development-loop)
16. [Branching, commits and review](#16-branching-commits-and-review)
17. [Coding standards](#17-coding-standards)
18. [Change recipes — the definition of done](#18-change-recipes--the-definition-of-done)
19. [Testing strategy](#19-testing-strategy)
20. [Continuous integration](#20-continuous-integration)
21. [Documentation practice](#21-documentation-practice)
22. [Release and deployment path](#22-release-and-deployment-path)
23. [Risk register](#23-risk-register)
24. [Roadmap](#24-roadmap)

**Appendices**

- [A. Directory map](#appendix-a--directory-map)
- [B. Ports, environment variables and accounts](#appendix-b--ports-environment-variables-and-accounts)
- [C. Where each fact lives](#appendix-c--where-each-fact-lives)

---
---

# Part A — System architecture

## 1. Architectural overview

CampusVoiceBox is a **three-tier web application**: a single-page React client,
a stateless REST API, and a relational database.

```
   ┌────────────────────────────────────────────────────────────┐
   │  TIER 1 — CLIENT (the browser)                             │
   │  React single-page app. Two faces, one build:              │
   │  the student board (/) and the admin panel (/admin/…)      │
   └──────────────────────────┬─────────────────────────────────┘
                              │  HTTPS · JSON · Bearer token
   ┌──────────────────────────▼─────────────────────────────────┐
   │  TIER 2 — APPLICATION (Node.js / Express)                  │
   │  Stateless REST API. Authenticates, authorises, validates, │
   │  and is the only thing that may touch the database.        │
   └──────────────────────────┬─────────────────────────────────┘
                              │  SQL over a connection pool
   ┌──────────────────────────▼─────────────────────────────────┐
   │  TIER 3 — DATA (PostgreSQL 16)                             │
   │  One database. Twelve tables. Constraints enforced here,   │
   │  not only in application code.                             │
   └────────────────────────────────────────────────────────────┘
```

### The five decisions that shape everything else

**1. One website, two faces.** The student board and the admin panel are not
two applications. They are one React build, one router, one account system and
one set of records. A student posting and an administrator approving are two
writes to the same row — so nothing ever has to be "synced", and the two sides
cannot drift into disagreeing about what exists.

**2. One account system, with a role.** There is no separate admin login. Every
person signs in at `/login`; the `role` column on their account decides where
they land and what they may do. That is what keeps "who submitted this" a real
foreign key instead of two account lists that slowly stop matching.

**3. Permissions, not roles, at the point of use.** Screens and endpoints ask
*"may this account do `moderate_posts`?"* — never *"is this account an admin?"*.
A permission is just a string. Adding a narrower role later (a moderator who
may approve but not delete) is a list of strings in one file, not a rewrite of
every page.

**4. One data layer, one seam.** Every screen in the frontend reads and writes
through a single module, `services/store.js`, which holds one copy of the
records the server sends and sends every change to the server
(`services/api.js`). No screen calls the server itself — see
[section 3](#3-how-the-client-and-the-server-talk).

**5. The vocabulary lives in data files, not in code.** Statuses, submission
kinds, categories, departments, roles, permissions, notification types and
audit actions are each defined once, as data, in `frontend/src/data/`. Forms,
filters, badges, charts, queues and exports all read from those definitions —
so a new category or status appears everywhere at once, from one edit.

### Quality attributes this architecture is optimising for

| Attribute | How the architecture serves it |
|---|---|
| **Explainability** | One data layer, one router file, one file per concept — the whole system can be traced by a reader in an afternoon |
| **Changeability** | Data-driven vocabulary; adding a status, kind, category or admin page is a single-file edit |
| **Enforcement where it counts** | Every permission is checked on the server, against the account as it is in the database at that moment — never against what the browser shows or what a token claims |
| **Accountability** | Every administrative action writes an audit entry and a student notification *in the same database transaction*, so neither can be forgotten |
| **Least surprise for students** | Nothing is published without review; a rejection always carries a reason; anonymity is enforced at the data boundary, not by hiding a column in the UI |

---

## 2. Deployment view

Development and demonstration run as three containers, brought up together by
`docker-compose.yml`:

```
   docker compose up --build
   ┌──────────────────────────────────────────────────────────────┐
   │  HOST MACHINE                                                │
   │                                                              │
   │   ┌────────────────┐   ┌────────────────┐   ┌─────────────┐  │
   │   │  frontend      │   │  backend       │   │  db         │  │
   │   │  node:24-alpine│   │  node:24-alpine│   │  postgres:16│  │
   │   │  CRA dev server│──▶│  Express API   │──▶│  -alpine    │  │
   │   │  :3000         │   │  :4000         │   │  :5432      │  │
   │   └────────────────┘   └────────────────┘   └──────┬──────┘  │
   │          ▲                     ▲                   │         │
   │      bind mount            bind mount        named volume    │
   │      ./frontend            ./backend         cvb_pg_data     │
   └──────────────────────────────────────────────────────────────┘
                     │
                 browser  →  http://localhost:3000
```

Details that matter:

- **Start order is enforced, not hoped for.** `db` has a `pg_isready`
  healthcheck; `backend` declares `depends_on: db: condition: service_healthy`,
  so the API never starts against a database that is not accepting connections.
- **The schema loads itself.** `schema.sql` is mounted into Postgres's
  `/docker-entrypoint-initdb.d/`, so the very first `up` on a fresh volume
  creates every table and fills in the six categories. There are no sample
  accounts or posts. Wiping and starting clean is `docker compose down -v`.
- **Source is bind-mounted, `node_modules` is not.** `./backend:/app` plus an
  anonymous volume at `/app/node_modules` gives hot reload without the host's
  (possibly macOS-built) modules overwriting the container's Linux ones.
- **These images are development images.** Both `Dockerfile`s run dev servers
  (`npm run dev`, `npm start`) with no build step and no optimisation. The
  production images are separate — `Dockerfile.prod` in each app, brought up by
  `docker-compose.prod.yml`: the built website served by nginx, which passes
  `/api` on to an API holding only its runtime packages, with only nginx
  published — see [section 22](#22-release-and-deployment-path).

---

## 3. How the client and the server talk

```
   React screens ──▶ services/store.js ──▶ services/api.js ──▶ Express API ──▶ Postgres
        ▲            (one copy of what                         (auth, permission,
        │             you may see)                              validation, audit)
        └───────── GET /api/state: re-read after every change,
                   every 15 s while the tab is in view, and on return to the tab
```

**One request for everything you may see.** `GET /api/state` answers with the
signed-in person's whole view of the platform — accounts, posts, notifications,
the activity log — and `store.js` keeps it as one object that every screen reads.
What goes into it is decided on the server (`controllers/stateController.js`):

| Who | Sent |
|---|---|
| A visitor | Published posts only; no author behind an anonymous post |
| A student or user | The same, plus their own posts in every status, their own account and their own notifications, and their own privacy picture — what they accepted, their consents, their privacy requests |
| An administrator | Every post with its author and internal notes, every account, the admin notifications, the latest 500 activity-log entries, and their own privacy picture; with `manage_privacy`, every privacy request and the latest 300 privacy-log entries |
| A suspended account | What a student is sent, whatever its role |

Votes arrive as a count per post plus whether *you* voted — never who else did.

**Every change goes to the server.** An action in `store.js` (approve, vote,
post) sends one request; the server checks the permission and the workflow,
saves the change, writes the audit entry and the student's notification in one
transaction, and the store fetches `/api/state` again — so the screen shows what
the server now holds. A refusal comes back with the server's explanation, which
the screen shows.

**Keeping up.** The store re-fetches every 15 seconds while the tab is in view,
when it comes back into view, and when somebody signs in or out in another tab.
Unchanged state is answered `304 Not Modified` with no body, so a quiet poll
costs next to nothing. Two refinements: a vote shows at once and is then
confirmed by the server, and an answer that arrives after a newer one is
discarded rather than shown.

**Signing in.** The server hands out a JWT, kept in `localStorage['cvb_token']`
and sent as `Authorization: Bearer …`. Only the account's id is in it; the role,
the status and whether the account still exists are read from the database on
every request. Changing or resetting a password invalidates every token issued
before it.

## 4. Technology stack

### Frontend

| Technology | Version | Why it is here |
|---|---|---|
| React | 19.2 | Component model; the whole UI is one build serving two faces |
| react-router-dom | 6.30 | Nested routes are how one `<RequirePermission>` wrapper guards every admin page at once |
| Create React App (react-scripts) | 5.0.1 | Zero-config toolchain — no bundler configuration to explain or maintain |
| Tailwind CSS | 3.4 | Utility classes keep styling next to the markup; the brand palette is defined once in `tailwind.config.js` |
| PostCSS + Autoprefixer | 8.5 / 10.5 | Run Tailwind and add browser prefixes. They come with react-scripts, which sets them up itself, so the project lists neither and has no `postcss.config.js` |

**No state-management library, no component library, no chart library.** The
store is ~600 lines of plain JavaScript and one React hook
(`useSyncExternalStore`); the charts in the admin panel are
hand-drawn divs and SVG in `components/admin/Charts.jsx`. Every dependency
added is a dependency a reviewer has to be taught, and none of these earned
their place.

### Backend

| Technology | Version | Why it is here |
|---|---|---|
| Node.js | 20 (LTS) | Same language as the frontend — one mental model across the stack |
| Express | 4.21 | Minimal routing and middleware; the request pipeline is readable top to bottom |
| PostgreSQL | 16 | Real constraints — `CHECK`, `REFERENCES`, `UNIQUE` — enforced by the database, not just by application code |
| pg | 8.13 | Postgres driver, used with a connection pool and parameterised queries only |
| jsonwebtoken | 9.0 | Stateless auth token, signed server-side |
| bcryptjs | 2.4 | Password hashing — plain passwords are never stored |
| cors | 2.8 | Explicit allow-list of origins, from `CORS_ORIGIN` |
| dotenv | 16.4 | Configuration from the environment, never committed |
| nodemon | 3.1 (dev) | Restart on save |

### Infrastructure

| Technology | Role |
|---|---|
| Docker + Docker Compose | One-command local stack; also the CI's proof that both images build |
| GitHub Actions | CI on every push and PR to `main` |
| Postman collection | Manual API testing, importable from `backend/postman/` |

> **A note on Supabase.** The original requirements named Supabase. What was
> actually built is plain PostgreSQL behind a custom Express API with JWTs — a
> backend whose every line can be explained to a panel. The schema maps onto
> Supabase's Postgres unchanged if that decision is ever revisited.

---

## 5. Logical layers

Physical tiers say where code runs. Logical layers say what it is responsible
for. Every request crosses these in order:

```
  ┌───────────────────────────────────────────────────────────────┐
  │ PRESENTATION   pages/ · components/                            │
  │ Draws screens. Holds form state. Knows nothing about storage.  │
  ├───────────────────────────────────────────────────────────────┤
  │ ACCESS CONTROL context/AuthContext · components/RequireAuth    │
  │ Who is signed in; which screens they may open.                 │
  ├───────────────────────────────────────────────────────────────┤
  │ DOMAIN         data/roles · data/workflow · data/categories    │
  │ The vocabulary: statuses, kinds, permissions, departments.     │
  │ Pure data and pure functions. No React, no storage.            │
  ├───────────────────────────────────────────────────────────────┤
  │ APPLICATION    services/store.js                               │
  │ One copy of what the server sent; the actions that ask the     │
  │ server to change something, then fetch the copy again.         │
  ├───────────────────────────────────────────────────────────────┤
  │ INTEGRATION    services/api.js · moderation · attachments · csv│
  │ Talking to the outside: the API, the filter, files, exports.   │
  ├═══════════════════════════════════════════════════════════════┤
  │ TRANSPORT      routes/ · middleware/                           │
  │ Express: authenticate, authorise, validate, dispatch.          │
  ├───────────────────────────────────────────────────────────────┤
  │ BUSINESS LOGIC controllers/                                    │
  │ What an endpoint actually does, in transactions.               │
  ├───────────────────────────────────────────────────────────────┤
  │ PERSISTENCE    config/db.js · models/schema.sql                │
  │ Connection pool, parameterised SQL, table constraints.         │
  └───────────────────────────────────────────────────────────────┘
```

The rule that keeps this honest: **a layer may only call the layer below it.**
A page never calls the server itself; a controller never formats a badge colour.
When those two rules were broken during development, the symptom was always
the same — the same fact written down in two places, drifting apart.

---

## 6. Frontend architecture

### 6.1 Routing — one file, one wrapper

`frontend/src/App.js` is the whole platform's address book. Its structure is
the access-control model expressed as nesting:

```
<AuthProvider>                        ← everyone can ask "who is signed in?"
 └ <BrowserRouter>
    ├ <Layout>                        ← navbar + footer frame
    │   └ /                           the board (open to admins too)
    ├ /login · /signup                signed-out only
    ├ /forgot-password                anyone - asks for an emailed reset link
    ├ /reset-password                 anyone - the emailed link proves who it is
    ├ <RequireAuth>                   any signed-in role
    │   ├ /student/dashboard
    │   └ /account                    (admins are sent to /admin/profile)
    └ <RequirePermission VIEW_ADMIN>   ← ONE wrapper around the entire panel
        └ /admin  <AdminLayout>        sidebar frame
           ├ dashboard
           ├ <RequirePermission MODERATE_POSTS>
           │   ├ queue/pending        ┐ both are the same <Submissions />
           │   └ queue/open           ┘ component, pinned to a slice
           ├ posts                     All Submissions
           ├ <RequirePermission MANAGE_USERS>    users · users/:userId
           ├ <RequirePermission VIEW_ANALYTICS>  analytics · exports
           ├ <RequirePermission MANAGE_CONCERNS> departments
           ├ notifications
           ├ <RequirePermission VIEW_AUDIT_LOG>  activity
           ├ system · profile
           └ *                         → back to the board
```

Two consequences worth naming:

- **An admin page cannot be added unguarded.** A new `<Route>` inside the
  existing `<RequirePermission>` block is protected by *existing* — there is no
  per-page guard to forget.
- **A new queue costs a route and nothing else.** Pending Approval and Open
  Work are the same `<Submissions />` component with different `lockedStatuses`
  / `lockedKinds` props. Open Work pins on `needsAssignment` rather than on the
  concern family, which is what stopped approved *requests* falling into no
  queue at all.

### 6.2 State and data flow

There is no Redux, no Zustand, no query cache. There are exactly two pieces of
shared state:

| | What it holds | Who reads it |
|---|---|---|
| `AuthContext` | The signed-in account (read from the store's copy), and `login` / `signup` / `logout` | Guards, navbar, every page that greets somebody |
| `useStore()` | The copy of the records the server sent, plus the actions | Every page that reads or changes data |

`useStore()` returns `{ db, ...actions }`. Its internals are the architecture in
miniature:

- **One copy, kept outside React.** `store.js` holds the last answer from
  `GET /api/state` as one object; `useSyncExternalStore` hands it to every
  component, so they all re-draw together when a new one arrives.
- **One change path.** Every action sends one request and then fetches the copy
  again (`change()`), so an action cannot forget to bring the screen up to
  date. The audit entry and the student's notification are written by the
  server, in the same transaction as the change — no screen can skip them.
- **Answers are objects, not exceptions.** An action answers `{ error }` with
  the server's own explanation, or what the server sent back, and the screen
  shows it.
- **Live across devices.** The copy is re-fetched every 15 seconds while the
  tab is in view and when it comes back into view; a sign-in or sign-out in
  another tab is followed through the `storage` event.
- **Nothing to load before it is ready.** `AuthProvider` keeps the loading
  screen up until the first answer, so the first screen drawn already knows
  who is signed in; if the server cannot be reached at all it says so, with a
  *Try again* button (`components/ServerUnavailable.jsx`).

The actions, which are the complete list of things the website can change:

```
ACCOUNTS   register · authenticate · signOut
           requestPasswordReset · resetPassword · changeOwnPassword
           updateOwnAccount · updateOwnPhoto
           updateUser · setUserStatus · setUserRole · deleteUser
CONTENT    createPost · changeStatus · assignConcern · resolveConcern
           addAdminNote · toggleVote
INBOX      markNotificationRead · markAllNotificationsRead · fullActivityLog
```

### 6.3 The vocabulary files

`frontend/src/data/` is the domain model, as plain data:

| File | Defines | Size |
|---|---|---|
| `roles.js` | 11 permissions, 3 roles, `can(user, permission)`, each role's home page | — |
| `workflow.js` | 6 statuses (with `public` flag and legal `next` moves), 5 submission kinds, 11 departments, 8 notification types, audit action labels, badge/bar colour classes | — |
| `categories.js` | 6 board categories with their chart colours | — |
| `accountFields.js` | The account field list shared by the student account page and the admin user profile, and the password and email rules | — |
| `programs.js` | Course / year / section options for signup | — |
| `blockedWords.js` | Profanity, insults, Filipino terms, phrases, and an always-allowed list | — |

The pattern that makes this pay off: **a status carries its own rules.**
`STATUSES.approved.next` lists the moves an admin may make from it, and the
review dialog builds its buttons from that list. `STATUSES[x].public` decides
board visibility, and `PUBLIC_STATUSES` is *derived* from it rather than typed
out a second time. A status is added by adding an object.

### 6.4 Component architecture

```
components/
  Layout.jsx        the student frame: Navbar + page + Footer
  Navbar.jsx        brand, category pills, SearchBar, ProfileMenu
  Header.jsx        the landing hero (staggered fade-in)
  SuggestionCard.jsx  one submission on the board
  PostModal.jsx     the post / voice-out form
  RequireAuth.jsx   RequireAuth · RequirePermission · RedirectIfSignedIn · RedirectIfAdmin
  Reveal.jsx        IntersectionObserver fade-in, honours prefers-reduced-motion
  PopupFrame.jsx    the frame every pop-up sits in: backdrop, Escape, scroll lock, ✕
  AttachmentList.jsx  a post's photos and PDFs, each fetched from the server
  ServerUnavailable.jsx  "Cannot reach CampusVoiceBox", with Try again
  icons.js          the icons drawn in more than one place
  Button · TextField · ConfirmDialog · AuthCard · SearchBar · ProfileMenu
  BackButton · Logo · Footer
  admin/
    AdminLayout.jsx      sidebar shell; the sidebar is built from permissions
    DataTable.jsx        one table: sorting, filtering, paging, empty states
    SubmissionReview.jsx the review dialog — the workflow's control surface
    Modal.jsx · Charts.jsx · ui.jsx (badges, stat tiles, tone classes)
```

Eleven admin pages sit on top of the six files in `components/admin/`. `DataTable` and
`SubmissionReview` are doing most of the work: every queue is `DataTable` with
a different slice, and every status move in the system goes through one dialog,
which is why the workflow rules only had to be written once.

### 6.5 Styling

Tailwind utilities throughout, with the brand defined once in
`tailwind.config.js`: a nine-step `navy` palette, `cream`, `mustard`, and three
keyframe animations (`fade-up`, `fade-in-up`, and `wave` for the greeting's
hand). Status and category
colours are *not* written into components — each status and category object
carries its own `badgeClass` and `barClass`, so a status is the same hue on a
chart as it is on a badge, from one definition.

Responsiveness is mobile-first: the navbar stays one row at every width — below
the `sm` breakpoint it drops the wordmark, and below `md` the category dropdown
becomes a filter icon — tables scroll horizontally inside their container, and
the admin sidebar collapses.

---

## 7. Backend architecture

### 7.1 Request lifecycle

```
  HTTP request
      │
      ▼
  app.js ── security headers ── cors(allow-list) ── express.json(size limit)
      │
      ▼
  routes/index.js        /api/health · /api/state · /api/auth/* · /api/* · /api/admin/*
      │
      ▼
  middleware/rateLimit.js  password guessing, posting floods (where it applies)
      │
      ▼
  middleware/auth.js     requireAuth        → is the token valid, and is it for an
                                              account that still exists and whose
                                              password has not changed since?
                                              The account is read FROM THE DB.
                         requirePermission  → not suspended, and holds the permission
      │
      ▼
  controllers/ · routes/admin/
                         the actual work, in a transaction where a change must
                         also write a notification and an audit row
      │
      ▼
  config/db.js           pool.query('… WHERE id = $1', [value])   ← parameterised, always
      │
      ▼
  middleware/errorHandler.js   anything thrown lands here, once
```

### 7.2 Folder responsibilities

| Folder | Responsibility | Must never |
|---|---|---|
| `routes/` | Map a URL to middleware + handler (the admin handlers live in `routes/admin/`, one file per area) | Skip a permission check |
| `controllers/` | Do the work; own the transaction | Read `req.headers` for auth |
| `middleware/` | Authenticate, authorise, limit, handle errors | Know about specific tables |
| `config/` | Pool, migrate, make-admin | Be imported by a route directly |
| `models/` | `schema.sql` — the tables and the six categories; `workflow.js` — statuses and their legal moves, kinds, departments; `accountRules.js` — account fields, email and password rules; `files.js` — checking and sending stored files; `moderation.js` + `blockedWords.js` — the rudeness filter (the frontend's, copied); `shape.js` — how records leave the API; `activityLog.js` — the one INSERT every log entry goes through; `transaction.js` — `inTransaction`, all-or-nothing changes | — |

### 7.3 API surface

**Everyone, and a person's own things**

| Method | Path | Auth |
|---|---|---|
| GET | `/api/health` | none |
| GET | `/api/state` | optional — what you are sent depends on who you are ([section 3](#3-how-the-client-and-the-server-talk)) |
| POST | `/api/auth/register` | none — makes a student or user account, never an administrator |
| POST | `/api/auth/login` | none |
| POST | `/api/auth/forgot-password` | none — emails a one-time reset link; the same answer whether or not the email has an account |
| POST | `/api/auth/reset-password` | none — proved by the emailed link, which works once, for one hour |
| POST | `/api/auth/logout` | `requireAuth` — recorded for administrators |
| POST | `/api/posts` | `requireAuth` + `submit_posts` + `requireCurrentTerms`; the rudeness filter and the file checks run here |
| POST | `/api/posts/:id/vote` | `requireAuth` + `vote` + `requireCurrentTerms`; public posts only |
| GET | `/api/attachments/:id` | optional — anyone for a published post; the author and staff otherwise |
| PATCH | `/api/account` | `requireAuth` — own name and school details only |
| PUT | `/api/account/photo` | `requireAuth` |
| PUT | `/api/account/password` | `requireAuth` + the current password; answers a new token for this device |
| GET | `/api/users/:id/photo` | `requireAuth` — that account, or `view_admin` |
| PATCH | `/api/notifications/:id/read` | `requireAuth` — only your own, or the admin feed if you see it |
| POST | `/api/notifications/read-all` | `requireAuth` |
| POST | `/api/account/terms` | `requireAuth` — accept the current Terms |
| PUT | `/api/account/school-consent` | `requireAuth` — give or withdraw; withdrawing deletes the school details |
| PUT | `/api/account/cookie-consent` | `requireAuth` — the cookie choice, kept with the account |
| GET | `/api/account/export` | `requireAuth` — everything held about the account, as a JSON file |
| POST | `/api/privacy-requests` | `requireAuth` — one open request per type |
| POST | `/api/privacy-requests/:id/cancel` | `requireAuth` — your own, while nobody has started on it |

None of the privacy routes needs a permission beyond being signed in: a
suspended account keeps its rights over its own information.

**Admin — each route with its own permission**

| Method | Path | Permission |
|---|---|---|
| PATCH | `/api/admin/users/:id` | `manage_users` |
| PATCH | `/api/admin/users/:id/status` | `manage_users` (not yourself) |
| PATCH | `/api/admin/users/:id/role` | `manage_admins` (not yourself) |
| DELETE | `/api/admin/users/:id` | `delete_users` (not yourself) |
| PATCH | `/api/admin/posts/:id/status` | `moderate_posts` — only a move the workflow allows |
| PATCH | `/api/admin/posts/:id/assign` | `manage_concerns` |
| PATCH | `/api/admin/posts/:id/resolve` | `manage_concerns` |
| POST | `/api/admin/posts/:id/notes` | `moderate_posts` |
| GET | `/api/admin/activity-logs` | `view_audit_log` — the whole log, for the export |
| PATCH | `/api/admin/privacy-requests/:id` | `manage_privacy` (never a request about yourself); completing a deletion also needs `delete_users` |

Mounting them under `/admin` does not protect them. The `requirePermission`
call on each line does — which is why the permission is written on every route
rather than applied once to the router.

---

## 8. Data architecture

### 8.1 The tables

```
                        ┌───────────┐
                        │  users    │  role · status · school details
                        └─────┬─────┘
                              ├───────────────────┬──────────────┐
                              │                   │              │
                       ┌──────▼──────┐     ┌──────▼──────┐  ┌────▼─────────┐
                       │   posts     │     │   votes     │  │ activity_logs│
                       │ (author_id) │     │ (user,post) │  │  insert-only │
                       └──────┬──────┘     └─────────────┘  └──────────────┘
                              │
         ┌────────────────────┼────────────────────┬───────────────┐
    ┌────▼────────┐    ┌──────▼──────┐     ┌───────▼───────┐ ┌─────▼──────┐
    │ attachments │    │ admin_notes │     │ notifications │ │ categories │
    └─────────────┘    │ staff only  │     │ author│admin   │ │ (slug FK)  │
                       └─────────────┘     └───────────────┘ └────────────┘
```

And three for privacy, beside them:

```
   users ──┬── policy_acceptances   what each person agreed to, which version, when
           ├── privacy_requests     access / correction / deletion / other, and the answer
           └── privacy_events       the privacy log — insert-only
```

And one for forgotten passwords: `users ── password_resets` (the emailed links).

Twelve tables. The ones whose design carries a rule:

**`users`** — one table for students, staff and administrators. `role` is
`CHECK`-constrained to `admin` / `student` / `user`. Registration never lets the
person choose it, and only ever makes a student or a user. The administrator is
the default account the server creates at start-up, from `ADMIN_EMAIL` and
`ADMIN_PASSWORD`, when the database has none (`config/defaultAdmin.js`). `status` of
`suspended` keeps the account and its history while blocking posting and
voting. The profile photo is stored on the row (`photo`, `photo_type`,
`photo_updated_at`). `password_changed_at` is what signs out every token
issued before a password change or reset. `school_consent_at` (with the Privacy
Policy version in `school_consent_version`) is the person's consent to keeping
their school details — without it, the server refuses to store new ones, and
withdrawing it deletes them. `cookie_consent` is the cookie choice made while
signed in: the version, a yes or no per optional category, and the time — no
device or address.

**No `sessions` table.** A sign-in is a signed token (JWT), and nothing is
stored per login. Suspension and deletion still take effect on the very next
request, because every request re-reads the account, and a password change or
reset invalidates older tokens through `password_changed_at`.

**`posts`** — the centre of the system. `status` defaults to `pending`, which
is the single line of SQL that guarantees nothing reaches the public board
unreviewed. `author_id` is kept even for anonymous posts, because anonymity is
a promise that the *board* will not show a name — not that nobody is
accountable. `kind` and `status` are `CHECK`-constrained to the five kinds and
six statuses; `title` is 5–80 characters and `message` 10–5000, the posting
form's limits.

**`attachments`** — the photos and PDFs on a post, kept in the database itself
(`data BYTEA`), so a backup of the database is a backup of everything. The
server checks each file's type, size and contents before storing it.

**`votes`** — `UNIQUE (user_id, post_id)`: one person, one vote, enforced by
the database; taking a vote back deletes the row. Deleting an account keeps its
votes (`user_id` becomes `NULL`), so a result never changes after the fact.
Counts are derived by counting rows, never stored on the post, which is what
stops counts drifting.

**`activity_logs`** — insert-only by design, with no update or delete path,
because a log administrators can edit is not evidence of anything.
`admin_name` is *copied* rather than joined, so an entry still reads correctly
after the account that made it is deleted.

**`notifications`** — `audience` routes the row: `author` delivers to
`user_id`, `admin` delivers to everyone holding `view_admin` (and `user_id` is
`NULL`). A new notification type is a new string, not a schema change.

**`policy_acceptances`** — the evidence of consent: `terms` *accepted*, the
`privacy_notice` *acknowledged* at sign-up, `school_details` *granted* or
*withdrawn*, each with the version and the time. Written in the same
transaction as the sign-up or the change it records. A partial unique index
stops one acceptance of one version being recorded twice; grants and
withdrawals may repeat, because a person may change their mind. Deleted with the
account.

**`privacy_requests`** — the requester's name and email are *copied* onto the
row, so the request still shows who asked after their account is deleted
(`user_id` becomes `NULL`). A partial unique index allows one open request per
person per type — the database settles two requests sent at the same moment.
`posts_outcome` records whether a deletion kept or deleted the person's
submissions.

**`privacy_events`** — the privacy log: every request made, cancelled and
handled, and every data download. Insert-only, names copied, like
`activity_logs` — but kept apart from it, because it is about people's rights
over their information rather than moderation, and is read by whoever holds
`manage_privacy`. It records no network address.

**`password_resets`** — one row per emailed "forgot password" link. Only the
SHA-256 of the link's secret is stored, so reading the table does not let
anybody reset a password. A link expires after an hour; asking again replaces
it, and using it deletes every link the account has.

### 8.2 Indexes

Chosen from the queries the two sides actually run, not added speculatively:

```sql
idx_posts_status        -- what the board may show, on every request
idx_posts_created_at    -- newest first
idx_posts_author        -- a person's own submissions
idx_votes_post_id       -- vote counts
idx_attachments_post    -- each post's files
idx_admin_notes_post    -- each post's internal notes
idx_users_role          -- "is there an administrator yet?"
idx_notifications_user  -- (user_id, is_read) — the unread badge
idx_activity_created    -- the audit log, newest first
idx_policy_acceptances_user, idx_privacy_requests_created, idx_privacy_events_created,
idx_password_resets_user
uniq_policy_acceptance  -- (user, document, version) for accepted/acknowledged rows
uniq_open_privacy_request -- (user, type) while pending or in progress
```

### 8.3 The submission lifecycle

```
   student posts
        │
        ▼
    pending ──────▶ under_review ──────▶ approved ──────▶ in_progress ──────▶ resolved
        │                 │              (on the board)    (a department       (summary
        │                 │                    │            has it)             sent)
        └────▶ rejected ◀─┘                    │                                  │
              (reason sent                     └── back to under_review           │
               to the student)                     (an approval made in error)    │
                                                                                  │
                                              reopened ◀──────────────────────────┘
```

Three properties are enforced rather than hoped for:

1. **Nothing is published without review.** `pending` is the column default.
2. **No move is silent.** Every status change writes an audit entry *and* a
   notification to the student in the same database transaction.
3. **Legal moves are data.** Each status's `next` list draws the buttons in the
   review dialog, and the server holds the same lists
   (`backend/src/models/workflow.js`), so an illegal transition has no button
   to click and is refused if it is sent anyway.

Suggestions finish at `approved` — they are ideas. Requests, concerns,
complaints and reports carry `needsAssignment: true` and travel the full road
through a department to a written resolution.

---

## 9. Security architecture

### 9.1 Authentication

Passwords are hashed with bcrypt and never stored in plain text. Login returns
a JWT signed with `JWT_SECRET`, expiring per `JWT_EXPIRES_IN` (7 days by
default), carrying only the account's id. The browser sends it as
`Authorization: Bearer <token>`; `requireAuth` verifies the signature, then
reads the account from the database — refusing a token for a deleted account,
or one issued before the account's password last changed. A wrong email and a
wrong password get the same answer, in the same time, so the log-in form cannot
be used to find out which emails have accounts. The server refuses to start
without a `JWT_SECRET`, and in production with a short one or the example's.

A forgotten password is reset by its owner, never by an administrator:
**Forgot password?** emails a link carrying a 256-bit random secret, in the
link's `#` part so it never reaches a web server's logs. It works once, for an
hour, and the reply to "send me a link" is the same whether or not the email
has an account. A signed-in person changes their own password only by giving
the current one; that signs out every other device and hands this one a new
token.

### 9.2 Authorisation — and where it actually happens

```
   ┌──────────────────────────────────────────────────────────┐
   │  IN THE BROWSER — decides what is DRAWN                   │
   │  RequireAuth · RequirePermission · can(user, permission)  │
   │  Keeps an ordinary student out of a screen they should    │
   │  not see. Does NOT stop anybody determined.               │
   └──────────────────────────────────────────────────────────┘
   ┌──────────────────────────────────────────────────────────┐
   │  ON THE SERVER — decides what HAPPENS                     │
   │  requireAuth + requirePermission(p) on every route that   │
   │  changes anything:                                        │
   │    • re-reads the account FROM THE DATABASE, not the token│
   │    • refuses a suspended account                          │
   │    • refuses an account that no longer exists             │
   │    • answers 404, not 403, to an unauthorised caller      │
   │  and GET /api/state sends each person only what they may  │
   │  see                                                      │
   └──────────────────────────────────────────────────────────┘
```

Three deliberate choices in that second box:

- **The account is re-read every request.** A token issued an hour ago would
  still say `admin` after the account was demoted or suspended. A stale token
  must not outlive the decision to revoke access.
- **404, not 403.** Telling an unauthorised caller that `/admin/users` exists
  and they are merely not allowed in is more than they need to know.
- **Self-checks instead of a second admin tier.** There is one admin role
  holding every permission. What keeps those powers in check is that an account
  may never change its own role, suspend itself, or delete itself — enforced in
  `routes/admin/users.js` as well as in the UI. Nobody can set another person's
  password at all.

### 9.3 Anonymity

Anonymity is enforced at the data boundary. `author_id` stays on the row so an
administrator can follow a concern up, but `GET /api/state` sends the author's
name and id behind an anonymous post only to somebody holding `view_identity` —
and to the author, about their own post. To everybody else the name is simply
not in what the browser receives, whatever the interface might try to display.
A named post's author *name* is public; its account id is never sent to other
students. The same rule governs exports: the identity columns in a CSV are
opt-in, offered only on the Reports & Exports page behind a tick box, and never
on the quick export beside a search box.

### 9.4 Injection and input handling

Every database call is parameterised (`$1`, `$2`), with no string
concatenation into SQL anywhere. Ids in addresses are checked to be whole
numbers before they reach a query. Category slugs are validated against real
rows in `categories` rather than trusted as strings, and kinds, statuses and
departments against the server's own lists. Enum-like columns carry `CHECK`
constraints, so a bad value is refused by the database even if application code
lets it through. Request bodies are size-limited (3 MB for a post with files,
1 MB for a profile photo, 100 KB for everything else). Uploaded files must be a
photo or a PDF whose first bytes match the type claimed, and they are served
back with `X-Content-Type-Options: nosniff`. CSV exports guard against formula
injection — a cell starting with `=`, `+`, `-` or `@` is written as text.

### 9.5 Privacy and consent

Consent is enforced where it cannot be skipped — on the server:

- **Sign-up** is refused without `acceptTerms: true`, and with any Terms or
  Privacy Policy version other than the current one (the page was left open
  while a policy changed: reload). What was accepted is recorded in the same
  transaction as the account.
- **Newer Terms** (`TERMS_REQUIRED_VERSION` in `models/policies.js`): until an
  account accepts them, `requireCurrentTerms` (`middleware/terms.js`) refuses
  its posts and votes with `403` and `mustAcceptTerms`, which brings the
  website's dialog back. Reading is never blocked.
- **School details** are refused without the person's consent, from sign-up,
  from the account page and from an administrator alike. A value sent back
  unchanged is not refused, so an account from before consent was asked can
  still be edited until its owner decides.
- **Nobody else's consent records are sent to anybody**, administrators
  included; each person receives only their own.
- **Privacy requests** are handled by `manage_privacy`, never by the person the
  request is about, and every step is in the insert-only privacy log.

In the browser, `services/consent.js` lists every item the site stores — there
are no cookies — and writes an optional one only after the person said yes to
its category; saying no deletes it.

### 9.6 Current security gaps

Stated plainly, because a build that oversells its own safety is the dangerous
kind:

| Gap | Consequence | Fix |
|---|---|---|
| The default administrator's password is in the server's settings | Anyone who can read `backend/.env` knows it until it is changed | Keep `.env` readable only by the server; change the password from the admin's own profile after the first log-in |
| Password resets depend on email | Whoever controls a person's mailbox can reset their password; with no mail server set up, nobody can reset a forgotten password | Use school mailboxes; set `SMTP_*` in production; keep a second administrator |
| No email verification | Anyone can register with any address | Verification mail before first post |
| Logging out does not revoke the token | A copied token stays valid until it expires (7 days by default) | A table of revoked tokens, or shorter-lived tokens with refresh |
| Rate limits are counted in one server's memory | Several servers would each count separately; a restart forgets | A shared store (Redis) for the counts |
| HTTPS is not configured by the app | Tokens and passwords cross the network in clear over plain HTTP | Terminate TLS at the reverse proxy in front of the app |

---

## 10. Cross-cutting concerns

**Moderation (`services/moderation.js`).** A five-step normaliser, applied
before anything is compared: undo lookalike characters (`p0t4ng1na` →
`potangina`), flatten stretched spelling (`fuuuuck` → `fuck`), drop the
Filipino texting `h` (`moh` → `mo`), fold the Filipino `u`/`o` and `i`/`e`
drift so `putangina` and `potangina` are one word — applied to the Filipino
list *only*, because folding English would turn `deck` into `dick` — and strip
common endings (`shitty` → `shit`). `ALWAYS_ALLOWED` is checked before any of
it, so `assignment`, `sheet` and `leche flan` survive untouched. It runs three
times: the post form checks before sending, the server checks again when the
post arrives (`backend/src/models/moderation.js`, an identical copy — a request
sent without the form skips the browser's check), and the store checks the
records as they arrive, so a word added to the list later still keeps older
posts off the screen.

**Attachments (`services/attachments.js`, `backend/src/models/files.js`).** Up
to 3 files per post, photos or PDFs only, 8 MB before shrinking. Photos are
drawn onto a canvas scaled so the longest edge is 1000 px and re-exported as
JPEG at quality 0.7 — a 4000 px phone photo lands around 150 KB. A PDF cannot be
shrunk, so it is capped at 400 KB. Nothing is ever scaled *up*. The server checks
each file again and stores it in the database; the board fetches each one on
its own (`hooks/useApiFile.js`) and a click opens it full size in a new tab.

**Notifications.** Written by the same action that made the change, routed by
the type's own `audience`. A rejection is never unexplained; a resolution
always carries the summary the student is told.

**Audit logging.** Written by the server as part of the change, not by the
screen. Insert-only in the database. The panel shows the latest 500 entries;
the export downloads the whole log.

**Exports (`services/csv.js`).** One module builds both the full export and the
filtered one, so the two files differ in their *rows*, never their *columns* —
a spreadsheet built on one does not break when someone sends the other. Values
are quoted and inner quotes doubled, and a cell that would start a formula is
written as text; dates are written as local `YYYY-MM-DD HH:mm`; the file carries
a UTF-8 BOM so Excel does not mangle accents; delivery is a Blob object URL,
let go of a few seconds after the click.

**Live updates.** The copy of the records is re-fetched every 15 seconds while
the tab is in view and whenever it comes back into view; an unchanged answer
is a `304` with no body.

**Accessibility and motion.** `Reveal.jsx` disables its fade entirely under
`prefers-reduced-motion`, and plays once per card rather than replaying on
every scroll.

**Error handling.** One `errorHandler` middleware on the server, which explains
the problems a person can fix and answers everything else with a general
message - no SQL or stack trace reaches the browser. On the client, every
action answers `{ error }` with the server's explanation, shown where the
button was; a form that fails keeps what was typed; and a server that cannot
be reached at all gets its own screen with *Try again*.

---

## 11. Lists kept in two places

Some facts have to exist on both sides: the website needs them to draw its
screens, and the server must not trust the website's copy. They are kept as
two deliberate copies, and a change to one must be made to the other:

| Fact | Website | Server |
|---|---|---|
| Roles and their permissions | `frontend/src/data/roles.js` | `ROLE_PERMISSIONS` in `backend/src/middleware/auth.js` |
| Statuses and their legal moves, kinds, departments | `frontend/src/data/workflow.js` | `backend/src/models/workflow.js` (+ the `CHECK`s in `schema.sql`) |
| Categories | `frontend/src/data/categories.js` | the `INSERT INTO categories` rows in `schema.sql` |
| Account fields, email and password rules | `frontend/src/data/accountFields.js` | `backend/src/models/accountRules.js` |
| Title and message limits | `components/PostModal.jsx` | `controllers/suggestionsController.js` (+ the `CHECK`s) |
| Attachment rules | `services/attachments.js` | `models/files.js` |
| The rudeness filter and its word lists | `services/moderation.js`, `data/blockedWords.js` | `models/moderation.js`, `models/blockedWords.js` — the same code |
| Policy versions, the cookie-choice version, privacy request types | `data/policies.js` | `models/policies.js` |
| The optional storage categories | `services/consent.js` | `OPTIONAL_COOKIE_CATEGORIES` in `models/policies.js` |

Each file says which other file is its twin, and `scripts/check-shared-lists.mjs`
loads both copies and fails if they differ — CI runs it on every push. It covers
the roles and permissions, the workflow lists, the categories, the account
fields and the email and password rules, the policy versions and privacy
request types, the word lists, and the filter itself (both copies are run on
the same inputs). The title and message limits, the attachment rules and the
storage categories are not checked yet: for those, the twin's name in each file
is still the only guard.

---
---

# Part B — Development process

## 12. Methodology

The project runs an **iterative, incremental process built around vertical
slices**. Not Scrum with ceremonies — there is no team to hold them — but the
parts of an agile process that do real work for a single developer with a
panel to satisfy:

```
   ┌──────────────────────────────────────────────────────────────┐
   │                                                              │
   │   Pick one slice        Build it end to end      Write it    │
   │   ("a student can  ──▶  data file → store   ──▶  down as it  │
   │    post and an          → screen → route         is built    │
   │    admin approves")     → API → schema             │         │
   │            ▲                                       │         │
   │            │                                       ▼         │
   │            └─────  Demo it, find what is    ◀──  Commit      │
   │                    wrong, fold it back          the slice    │
   └──────────────────────────────────────────────────────────────┘
```

The four working rules:

**1. Slice vertically, never horizontally.** A unit of work is a *capability a
person can use*, carried through every layer — not "build all the components,
then build all the pages". The admin panel arrived as one slice because a
half-built moderation queue tells you nothing; a working one immediately told
us that Open Work was pinned to the wrong thing.

**2. Prototype-first on the data layer.** The browser-storage store was written
before the API was wired in, deliberately. It made the entire workflow
demonstrable in week one and let the *shape* of the data be found by using it,
rather than guessed at in a schema up front. The cost of that choice was the
later move onto the API ([section 3](#3-how-the-client-and-the-server-talk)) — a
cost accepted knowingly, and contained to the data layer: the screens kept
reading the same shape of records.

**3. Simplify by deletion, in its own pass.** Every feature increment is
followed by a pass that removes what the increment proved unnecessary. Two
admin roles became one. Ten statuses became six. Eight redirect routes for
bookmarks that never existed were deleted outright. The commit
`b7ca8d9` — *"Add admin panel; simplify review workflow, queues and roles"* —
removed 21,658 lines while adding 31,939.

**4. Document while the reasoning is still warm.** Every non-obvious decision
is written down *in the file it affects*, as a comment, at the moment it is
made — not reconstructed later for a report. This is why the codebase carries
"What you'll meet in this file" notes and why the walkthrough could be written
at all.

---

## 13. Phases and milestones

| Phase | Milestone | Evidence | Date |
|---|---|---|---|
| **1 — Foundation** | Repo structure, stack chosen, React frontend with board, auth screens, routing, Tailwind brand, mock data | `2ef1cc2` — 60 files, 21,753 lines | 2026-08-16 |
| **2 — Backend foundations** | Schema drafted, CRUD endpoints, JWT auth, Postman collection, Docker Compose, CI skeleton | `backend/`, `docker-compose.yml`, `.github/workflows/ci.yml` | — |
| **3 — Admin panel** | Eleven admin pages, review dialog, queues, user management, analytics, exports, audit log; student board reworked around the workflow | `e3fd948` — 57 files, +10,612 | 2026-09-10 |
| **4 — Simplification** | Two admin roles → one; ten statuses → six; queues re-pinned on `needsAssignment`; dead routes deleted | `b7ca8d9` — 97 files, +31,939 / −21,658 | 2026-09-11 |
| **5 — Documentation** | Plain-English code walkthrough plus inline notes across the codebase | `c42daf2` — 34 files, +2,237 | 2026-09-11 |
| **6 — Manuals** | Illustrated student and admin manuals, 35 screenshots, this architecture document | `docs/` | 2026-09-14 |
| **7 — Connection** | Frontend switched from browser storage to the live API; the API completed (state, accounts, files, notifications), hardened (server-side filter, workflow and file checks, rate limits, headers) | `frontend/src/services/store.js`, `backend/src/` | 2026-10-13 |

Phases 1–3 map onto the "30% progress" checklist the project was scoped
against: Planning & Setup, Frontend Foundations, Backend Foundations.
[`../GUIDE.md`](../GUIDE.md) tracks that checklist item by item.

---

## 14. Environment setup

Two ways to run the project. The website keeps nothing of its own, so both
run the database and the API beside it.

### A. Full stack via Docker — the usual way

```bash
docker compose up --build      # db + backend + frontend, http://localhost:3000
docker compose down -v         # stop and wipe the database
```

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` first (a `.env` beside `docker-compose.yml`, or the
shell): the backend creates that default administrator on its first start. Signing up only
makes student and user accounts.

### B. Each piece by hand — for debugging the backend

```bash
cd backend
cp .env.example .env           # set PGUSER/PGPASSWORD/etc. and JWT_SECRET
npm install
npm run db:migrate             # create the tables and the six categories
npm run dev                    # http://localhost:4000

cd ../frontend && npm start    # separate terminal
```

Health check: `curl http://localhost:4000/api/health` → `{"status":"ok"}`.
If the only administrator is ever locked out, `npm run make-admin -- <email>`
promotes a newly registered account from the server.

---

## 15. The daily development loop

```
  1. Read the vocabulary        Does this change need a new status / kind /
                                permission? Start in data/ — that is where
                                the system's nouns are defined.
        │
  2. Change the server first    The route, its permission check, the schema;
                                the audit entry and the notification in the
                                same transaction as the change.
        │
     ... and the store          The action in store.js that calls it.
        │
  3. Change the screen          The page should only need the new action; if
                                a page is reaching past the store, something
                                is in the wrong layer.
        │
  4. Run the manual matrix      Sign in as an admin and as a student. Do the
                                thing. Check the board, the student's
                                dashboard, the notification, the audit log.
        │
  5. Check the other side       Any admin action is also a student-visible
                                event. Two browsers (or a normal and a
                                private window) signed in as two people.
        │
  6. Write the comment          Why it is this way, in the file, now.
        │
  7. Commit the slice           One capability per commit.
```

Step 5 is the one that catches the most. The two faces share records, so a
change to one is nearly always a change to the other — an approval publishes a
card, a suspension blocks a vote, a role change moves somebody's home page.

---

## 16. Branching, commits and review

**Branching.** `main` is the integration branch and is what CI runs against.
Work happens on short-lived branches merged by pull request; the project is
small enough that a branch lives hours, not weeks.

**Commit messages.** Written in the imperative, naming the *capability*, not
the files:

```
Add admin panel; simplify review workflow, queues and roles
Add plain-English code walkthrough and inline notes
Build the admin panel and rework the student board
```

A commit that does two things names both, separated by a semicolon — a feature
increment and its simplification pass belong together when the second only
makes sense because of the first.

**Pull requests.** Every PR triggers the full CI pipeline
([section 20](#20-continuous-integration)). A PR is ready when CI is green, the
manual matrix for the affected slice has been run in both faces, and any new
non-obvious decision has a comment explaining it in the file it affects.

**Review focus, in order.** Does a write still log and notify? Is any check
that matters running only in the browser? Did a new fact get written down in
two places — and if it must be (section 11), are both copies changed? Is there
a data file this should have gone into instead of code?

---

## 17. Coding standards

**Naming.** Full words, no abbreviations — `submissions`, not `subs`;
`requirePermission`, not `reqPerm`. Permission constants are `UPPER_SNAKE`,
components `PascalCase`, everything else `camelCase`. Database columns are
`snake_case`; the frontend uses `camelCase` and maps at the boundary.

**Comments explain *why*, never *what*.** A comment that restates the code is
deleted. A comment that records a decision — why there is one admin role, why
the queue pins on `needsAssignment`, why the audit log copies `admin_name`
instead of joining — stays forever, because that reasoning is not recoverable
from the code.

**"What you'll meet in this file."** Every substantial file opens with a short
note naming the techniques it uses in plain English. The project is a capstone;
a reader who has to be able to *explain* the code is a first-class audience,
and this is cheaper than a separate tutorial that goes stale.

**One fact, one place.** The single rule that generated most of the
architecture. If a status colour, a permission list, or a CSV column set
appears twice, one of them is deleted and the other imported.

**Derive, don't restate.** `PUBLIC_STATUSES` is computed by filtering
`STATUS_LIST` on `public`. `ASSIGNABLE_KINDS` is computed from
`needsAssignment`. Neither is a hand-written list that can fall out of step.

**Every write goes through one path.** No screen calls the server itself;
every action goes through `change()` in `store.js`, which sends the request and
fetches the records again.

---

## 18. Change recipes — the definition of done

These are the changes that come up repeatedly. Each is one edit, *because* of
the architecture — and each list is the definition of done for that change.

| To add… | Edit | What follows automatically |
|---|---|---|
| **A category** | `data/categories.js` **and** the `INSERT INTO categories` rows in `schema.sql` | Post form, navbar pills, admin filters, analytics charts, CSV column values |
| **A status** | `data/workflow.js` — key, label, `badgeClass`, `barClass`, `public`, `next` — **and** `backend/src/models/workflow.js` and the `CHECK` on `posts.status` | Badge colour, filter dropdowns, the "move it to" buttons in the review dialog, chart series; the server allows exactly the same moves |
| **A submission kind** | Both `workflow.js` files — with `group` and `needsAssignment` — and the `CHECK` on `posts.kind` | Lands in the right monitoring page; gains assignment controls if it needs a department; joins the Open Work queue if `needsAssignment` |
| **A department** | `DEPARTMENTS` in both `workflow.js` files | Assignment dropdown, Departments page counts, exports |
| **A role** | `data/roles.js`, `ROLE_PERMISSIONS` in `backend/src/middleware/auth.js`, **and** the `CHECK` on `users.role` in `backend/src/models/schema.sql` | Route guards, sidebar, user list, role dropdown; the API accepts it as soon as `ROLE_PERMISSIONS` names it |
| **An account field** | `ACCOUNT_FIELDS` in `data/accountFields.js` **and** in `backend/src/models/accountRules.js`, plus a column on `users`, the `/api/state` query and `shapeUser` (`backend/src/models/shape.js`) | Both account forms render it; the server's routes validate and save it |
| **An admin page** | A `<Route>` inside the existing `<RequirePermission>` block in `App.js`, plus a sidebar entry | Guarded by existing; sidebar entry hides itself for roles without the permission |
| **A notification type** | `NOTIFICATION_TYPES` in `data/workflow.js`, and the server code that writes it | Routed to the right audience with the right tone; no schema change needed |
| **An admin endpoint** | A route in the right area file in `routes/admin/` **with its own `requirePermission`**, and an action in `store.js` | Nothing is automatic here — the permission on the line *is* the protection |

---

## 19. Testing strategy

Stated honestly: **the API is tested automatically; the screens are tested by
hand.** The server — where every rule is actually enforced — has an automated
suite that runs on every push. The website has no automated tests of its own
yet; it is checked with the manual matrix below.

### What exists

| Level | Mechanism | What it proves |
|---|---|---|
| **API tests** | `backend/test/api.test.js` (`npm test`, Node's built-in test runner), run in CI against a real Postgres 16. It wipes its database first, so it only runs on one whose name ends in `_test` | Sign-up, log-in, posting, the whole review workflow, voting, a person's own account, password resets, the privacy tools and account management answer what they should and refuse what they should not — and the activity log records who, from where and to what |
| **List parity** | `scripts/check-shared-lists.mjs`, in CI | The lists kept on both sides (section 11) still match, and both copies of the rudeness filter give the same answers |
| **Lint** | `npm run lint` in both apps, in CI, with no warnings allowed | Unused code, missing hook dependencies and the like never accumulate |
| **API contract** | Postman collection (`backend/postman/`), run top to bottom — login first, which stores the token for every later request | Each endpoint, tried by hand |
| **Integration smoke** | CI boots the API against a real Postgres and hits `/api/health` | Migrations apply, the server starts, the database is reachable |
| **Build** | CI runs `npm run build` for the frontend and `docker build` for every image, development and production | Nothing is broken at the compile or packaging level |
| **Manual matrix** | Run per slice, in two browsers — one signed in as an admin, one as a student | The workflow behaves end to end and both faces agree |

### The manual matrix

Run for any change that touches the workflow:

```
  As a student:  post a suggestion · post a concern · try a rude word
                 vote and un-vote · check the dashboard · read notifications
  As an admin:   see it in Pending · approve one · reject one with a reason
                 assign a concern · resolve it with a summary
                 suspend an account · change a role · export a CSV
  Then check:    the board shows what it should and hides what it should not
                 the student got the notification
                 the audit log recorded the admin action
                 the other browser updated within 15 seconds, unprompted
                 an anonymous post shows no name anywhere a student can see
```

### What is missing, in priority order

1. **Unit tests for `services/moderation.js`** — highest value per line of test
   code in the whole project. It is a pure function with a list of known
   inputs (`p0t4ng1naMoh` blocked, `assignment` allowed) and no dependencies.
2. **Unit tests for `data/workflow.js` derivations** — that every status in a
   `next` list exists; that `PUBLIC_STATUSES` and `ASSIGNABLE_KINDS` derive
   correctly.
3. **React Testing Library tests for `SubmissionReview`** — the dialog every
   status change passes through.
4. **Parity checks for the last three twin lists** (section 11) — the title
   and message limits, the attachment rules and the storage categories.

---

## 20. Continuous integration

`.github/workflows/ci.yml`, on every push and pull request to `main`:

```
   ┌──────────────────────┐     ┌────────────────────────────────┐
   │ frontend             │     │ backend                        │
   │ node 24 · npm ci     │     │ node 24 · npm ci               │
   │ npm run lint         │     │ postgres:16 service container  │
   │ npm run build        │     │ npm run lint                   │
   │                      │     │ check-shared-lists.mjs         │
   │                      │     │ npm run db:migrate             │
   │                      │     │ npm start & wait-on /api/health│
   │                      │     │ npm test (the API tests)       │
   └──────────┬───────────┘     └───────────────┬────────────────┘
              └──────────┬──────────────────────┘
                         ▼
              ┌────────────────────────┐
              │ docker-build           │   needs: [frontend, backend]
              │ dev + production images│
              └────────────────────────┘
                         ▼
              ┌────────────────────────┐
              │ deploy  (skeleton)     │   commented out until hosting
              └────────────────────────┘      is chosen
```

What each job is actually buying:

- **frontend** — `npm run lint` fails on any ESLint error or warning, so an
  unused import or a missing hook dependency fails the job rather than
  accumulating. (`frontend/.env` turns ESLint off inside the build itself, which
  is why it is a step of its own.) Then the production build.
- **backend** — this is the job that matters. It lints, checks the lists kept
  on both sides still match (section 11), runs the migrations against a *real*
  Postgres 16 service container with a `pg_isready` healthcheck (which also
  fills in the six categories), boots the server and curls `/api/health`, then
  runs the API tests against the same Postgres. A schema change that does not
  apply cleanly, or a change that breaks a rule the tests check, cannot reach
  `main`.
- **docker-build** — proves every image builds from a clean checkout — the two
  development images and the two production ones (`Dockerfile.prod`) — which is
  what catches a dependency that only exists on the developer's machine.
- **deploy** — a documented stub, with the Vercel/Netlify and
  Docker-on-a-server shapes sketched in comments. It stays commented until
  hosting is decided, rather than pretending to a deployment that does not
  happen.

---

## 21. Documentation practice

Five documents, each owning one question. The rule is that a fact lives in
exactly one of them, and the others link to it.

| Document | Question it answers | Audience |
|---|---|---|
| [`README.md`](../README.md) | What is this, and how do I start it? | Anyone opening the repo |
| [`GUIDE.md`](../GUIDE.md) | What is built, how do I run each part, what is still missing? | The developer, the panel |
| [`CODE-WALKTHROUGH.md`](./CODE-WALKTHROUGH.md) | What is each file, and why is it written that way? | Someone who must explain the code |
| [`STUDENT-MANUAL.md`](./STUDENT-MANUAL.md) | How do I use the board? | Students |
| [`ADMIN-MANUAL.md`](./ADMIN-MANUAL.md) | How do I run the review workflow? | The office running it |
| **This document** | How is it structured, and how is it built? | Developers joining; the panel |

Two practices hold it together:

- **Inline notes are part of the deliverable.** The "What you'll meet in this
  file" headers are written with the code, not after it.
- **Screenshots live in `docs/images/`** with numbered, prefixed names
  (`admin-04-review-pending.png`, `student-05-post-form.png`) so a manual's
  images stay in reading order and a replacement is obvious.

---

## 22. Release and deployment path

Nothing has been deployed. Connecting the website to the API, hardening the
server and the production setup (`docker-compose.prod.yml`, GUIDE.md section
3b) are done; what is left before real use:

```
  1. CONFIGURE   On the server, copy .env.production.example to .env:
                 POSTGRES_PASSWORD, a real JWT_SECRET (openssl rand -hex 32)
                 - the server refuses to start without one - APP_URL, the
                 default administrator and the school's SMTP settings.
                 ↓
  2. START       docker compose -f docker-compose.prod.yml up -d --build:
                 the built website behind nginx, /api passed on to the API
                 (NODE_ENV=production, runtime packages only), Postgres -
                 with only the website published.
                 ↓
  3. TLS         Put it behind HTTPS - the host's, or a proxy such as Caddy -
                 and set TRUST_PROXY=2. Schedule database backups.
                 ↓
  4. ADMIN       Log in as the default administrator and change that
                 password from the admin profile.
                 ↓
  5. DEPLOY      Fill in the commented deploy job in ci.yml, if wanted.
```

### Pre-production checklist

- [x] The website reads and writes through the API — no platform data in
      `localStorage`
- [x] Every admin action is refused by the *server* for a non-admin account
- [x] Author identity behind an anonymous post never reaches a caller without
      `view_identity`
- [x] The moderation filter runs on the server
- [x] Rate limiting on log-in and posting; security headers set
- [x] Attachments checked server-side for type, size and contents
- [x] The status and kind lists in the schema, the server and the website agree
      — and CI fails if any shared list stops agreeing
- [x] Automated API tests run in CI against a real Postgres
- [x] A production setup: the built website behind nginx, the API without
      development tools and not as root, the database unpublished
- [ ] `JWT_SECRET` is a generated secret, set in the environment, not in git
- [ ] `APP_URL` is the real address (the production setup also makes it the
      only `CORS_ORIGIN`); `TRUST_PROXY=2` if HTTPS is a proxy in front of nginx
- [ ] `SMTP_*` set to the school's mail server and `APP_URL` to the website's
      address — then "Forgot password?" tried once for real
- [ ] The default administrator's password set in `.env` only, and changed
      after the first log-in; no test accounts left
- [ ] Database backups configured and a restore actually tested
- [ ] TLS enforced

---

## 23. Risk register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | The default administrator's password is left as the one in the server's settings | Medium | **Critical** — the panel in the wrong hands | The password rule is enforced when it is created; change it after the first log-in (section 22); `make-admin` and the role controls to recover |
| 2 | A list kept in two places drifts (section 11) | Low | High — the server refuses what the website offers, or the other way round | Each file names its twin; `scripts/check-shared-lists.mjs` fails CI when any list it covers differs (section 11 names the three it does not cover yet) |
| 3 | Anonymous author identity leaked in an API response or export | Low | High — breaks the platform's core promise to students | Stripped in `/api/state` itself; identity columns opt-in on exports |
| 4 | The only administrator loses their password | Low | High — locked out of the panel | "Forgot password?" emails a reset link; keep a second administrator; `npm run make-admin` on the server |
| 5 | The database is lost | Low | **Critical** — every record, file and log entry | Managed Postgres with tested backups (section 22) |
| 6 | No automated regression safety net | High | Medium — a workflow change silently breaks another path | Test priorities in section 19 |
| 7 | Single maintainer; knowledge concentrated | High | Medium | The walkthrough, the inline notes, and this document exist for exactly this reason |

---

## 24. Roadmap

**In order of value:**

- The moderation and workflow unit tests, and the parity tests (section 19)
- Production build, configuration and deploy job (section 22)
- Email: verification at sign-up, and a password-reset link that does not need
  an administrator
- Revoking a token at log-out — with a table of sign-ins (one row per login,
  holding a hash of the token, never the token)
- A narrower moderator role, to prove the permission model pays off
- Admin replies on a submission thread, not only a resolution summary
- Websockets in place of polling, if 15-second updates ever feel slow

---
---

# Appendix A — Directory map

```
campusVoiceBox/
├── README.md                       what this is, how to start it
├── GUIDE.md                        what is built · how to run it · what is missing
├── docker-compose.yml              db + backend + frontend, one command (development)
├── docker-compose.prod.yml         the same for real use: nginx + API + db
├── .env.production.example         the settings the production setup reads
├── .github/workflows/ci.yml        CI: lint · lists · API tests · migrate · boot · builds
├── scripts/check-shared-lists.mjs  fails if the two sides' lists differ
│
├── docs/
│   ├── SYSTEM-ARCHITECTURE.md      this document
│   ├── CODE-WALKTHROUGH.md         file-by-file, in plain English
│   ├── STUDENT-MANUAL.md           using the board
│   ├── ADMIN-MANUAL.md             running the review workflow
│   └── images/                     35 numbered screenshots
│
├── frontend/
│   ├── Dockerfile                  dev image (CRA dev server)
│   ├── Dockerfile.prod             production image: the built site, served by nginx
│   ├── nginx/                      nginx's settings: /api to the backend, caching, headers
│   ├── tailwind.config.js          brand palette + fade keyframes
│   └── src/
│       ├── App.js                  every route, and every guard
│       ├── index.js · index.css
│       ├── assets/                 OllcfLogo.jpg (campus photo) · OllcfSeal.png · CampusVoiceBoxLogo.png
│       ├── context/AuthContext.jsx who is signed in
│       ├── data/                   THE VOCABULARY — 7 files
│       │   roles · workflow · categories · accountFields
│       │   programs · blockedWords · policies
│       ├── services/               THE PLUMBING — 8 files
│       │   store.js      the single data layer: the server's copy + the actions
│       │   api.js        every request to the server, the token, file fetching
│       │   moderation.js the rudeness filter (the server has an identical copy)
│       │   attachments.js photo shrinking (posts and profile photos)
│       │   csv.js        export column definitions
│       │   splash.js     the loading screen's exit
│       │   greeting.js   whether the navbar hand has waved this visit
│       │   consent.js    every item kept in the browser, and the cookie choice
│       ├── hooks/                  shared behaviour — 3 files
│       │   useApiFile.js      a stored photo or PDF, fetched with the token
│       │   useEscapeKey.js    Escape closes a pop-up
│       │   useFilterParams.js filters kept in the address bar
│       ├── components/             29 shared + icons.js + admin/ (6)
│       └── pages/
│           ├── Home · Login · Signup · ForgotPassword · ResetPassword
│           ├── legal/              PrivacyPolicy · TermsAndConditions · CookiePolicy
│           ├── student/            Dashboard · Account
│           └── admin/              12 pages
│
└── backend/
    ├── Dockerfile                  dev image (nodemon)
    ├── Dockerfile.prod             production image: runtime packages only, not root
    ├── .env.example                every variable, documented
    ├── test/api.test.js            the API tests (npm test)
    ├── postman/                    importable API collection
    └── src/
        ├── server.js · app.js
        ├── config/                 db.js (pool) · migrate.js · make-admin.js · defaultAdmin.js
        ├── models/                 schema.sql (11 tables + the categories) · workflow.js
        │                           accountRules.js · files.js · shape.js
        │                           moderation.js · blockedWords.js
        │                           activityLog.js · transaction.js
        │                           policies.js · privacyEvents.js
        ├── middleware/             auth.js (JWT + permissions) · terms.js · rateLimit.js
        │                           errorHandler.js
        ├── controllers/            authController · stateController
        │                           suggestionsController · accountController
        │                           privacyController
        └── routes/                 index · authRoutes · suggestionsRoutes
            │                       accountRoutes · privacyRoutes
            └── admin/              index (requireAuth for all) · users · posts
                                    privacyRequests · activityLogs · helpers
```

---

# Appendix B — Ports, environment variables and accounts

**Ports**

| Service | Port | URL |
|---|---|---|
| Frontend (CRA dev server) | 3000 | http://localhost:3000 |
| Backend (Express) | 4000 | http://localhost:4000/api/health |
| PostgreSQL | 5432 | — |
| Production (`docker-compose.prod.yml`): nginx — the only published port | `HTTP_PORT`, default 80 | the website, and the API at `/api` |

**Backend environment variables** (`backend/.env.example`)

| Variable | Default | Notes |
|---|---|---|
| `PORT` | 4000 | |
| `NODE_ENV` | development | `production` turns on the strict `JWT_SECRET` check |
| `CORS_ORIGIN` | `http://localhost:3000` | Comma-separated allow-list |
| `TRUST_PROXY` | *(unset)* | `1` behind a reverse proxy |
| `PGHOST` / `PGPORT` / `PGUSER` / `PGPASSWORD` / `PGDATABASE` | local Postgres | `cvb_user` / `campusvoicebox` in Docker |
| `JWT_SECRET` | *(must be set)* | Generate with `openssl rand -hex 32`; the server will not start without it |
| `JWT_EXPIRES_IN` | `7d` | |
| `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | *(set them)* | The default administrator, created at start-up when the database has none; ignored once it exists |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` / `MAIL_FROM` | *(empty)* | The mail server for "Forgot password?" links. Empty while developing: the email is printed in the console. Required in production |
| `APP_URL` | `http://localhost:3000` | The website's address, which reset links point to |

**Frontend environment variable** (read when the site is built)

| Variable | Default |
|---|---|
| `REACT_APP_API_URL` | `/api` in a production build; `http://localhost:4000/api` in development |

**One built-in account: the default administrator.** The database starts with
no posts and no other accounts. When the server starts and finds no
administrator, it creates one from `ADMIN_NAME`, `ADMIN_EMAIL` and
`ADMIN_PASSWORD` (`src/config/defaultAdmin.js`). Signing up only makes student
and user accounts (`register()` in `backend/src/controllers/authController.js`);
if every administrator is ever lost, `npm run make-admin -- <email>` promotes a
registered account from the server (`src/config/make-admin.js`).

---

# Appendix C — Where each fact lives

When something needs changing, this is the shortest path to the right file.

| The fact | Lives in |
|---|---|
| Who may do what | `frontend/src/data/roles.js` **and** `backend/src/middleware/auth.js` |
| Statuses, kinds, departments, notification types, audit labels | `frontend/src/data/workflow.js` (statuses, kinds and departments **also** in `backend/src/models/workflow.js`) |
| Board categories | `frontend/src/data/categories.js` **and** `backend/src/models/schema.sql` |
| Banned words | `frontend/src/data/blockedWords.js` **and** `backend/src/models/blockedWords.js` |
| What each person is sent | `backend/src/controllers/stateController.js` |
| Every route and every guard | `frontend/src/App.js` |
| Every action that changes data | `frontend/src/services/store.js` → `services/api.js` → `backend/src/routes/` |
| Export columns | `frontend/src/services/csv.js` |
| Brand colours and animations | `frontend/tailwind.config.js` |
| Table definitions and constraints | `backend/src/models/schema.sql` |
| API routes and their permissions | `backend/src/routes/` — admin ones in `routes/admin/` |
| Policy versions, and the facts the school still has to confirm | `frontend/src/data/policies.js` (versions **also** in `backend/src/models/policies.js`) |
| What the site keeps in the browser | `frontend/src/services/consent.js` |
| The policy texts | `frontend/src/pages/legal/` |
| Container topology | `docker-compose.yml` (development), `docker-compose.prod.yml` (production) |
| Pipeline | `.github/workflows/ci.yml` |
