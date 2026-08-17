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
| Landing page with navbar & sections | `src/pages/Home.jsx` - hero, category filter pills, search box, post list |
| Basic routing | `src/App.js` using `react-router-dom` (`/`, `/login`, `/signup`, catch-all redirect) |
| Initial UI components | `src/components/` - `Button`, `TextField`, `Navbar`, `Footer`, `Logo`, `AuthCard`, `SuggestionCard`, `PostModal` |
| Responsive layout | Tailwind CSS throughout; the navbar collapses into a burger menu below the `lg` breakpoint |
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

## 5. Connecting frontend to backend (the next step after 30%)

Right now the frontend and backend run side by side but the frontend doesn't call the
backend yet - it still uses its mock data, exactly as it did in your upload. This was
intentional: it keeps the frontend demoable with zero setup for a panel presentation.

When you're ready to wire them together, a small API client is already prepared at
`frontend/src/services/api.js` (register, login, me, getCategories, getPosts, createPost,
toggleVote - matching every backend endpoint 1:1). The swap is:

1. Copy `frontend/.env.example` to `.env.local` and set `REACT_APP_API_URL`.
2. In `AuthContext.jsx`, replace the `localStorage` read/write in `signup`/`login`/`logout`
   with calls to `api.register` / `api.login`, and store the returned JWT under
   `localStorage.setItem('cvb_token', token)` instead of the current session key.
3. In `Home.jsx`, replace `useState(SEED_SUGGESTIONS)` with an `api.getPosts()` call inside a
   `useEffect`, and point `addSuggestion`/`toggleVote` at `api.createPost` /
   `api.toggleVote`.

Everything on the backend already returns data shaped exactly like `SEED_SUGGESTIONS` (same
field names: `type`, `category`, `author`, `message`, `votes`, `createdAt`, plus `hasVoted`),
so this should be a drop-in swap rather than a rewrite.

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
│   │   ├── data/                 # categories.js, suggestions.js (mock data)
│   │   ├── services/api.js       # ready for when the frontend switches to the real API
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

- **No real image/file attachments yet** - your memory notes mention this is in progress
  elsewhere; the schema here has no `attachments` table yet.
- **No admin/staff role** - `users` table has no `role` column; every account is a student.
  Add a `role VARCHAR(20) DEFAULT 'student'` column when you build the staff-reply feature.
- **No post status transitions in the UI** - the `posts.status` column
  (`open` / `in_review` / `resolved`) exists in the schema and is ready for an admin panel to
  update, but no endpoint or screen changes it yet.
- **No rate limiting or email verification** - fine for a capstone demo, worth adding before
  any real deployment.
