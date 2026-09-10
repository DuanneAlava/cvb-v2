# CampusVoiceBox — Code Walkthrough

A plain-English tour of the code, file by file. For each file it answers three
questions: **what is this**, **what is it for**, and **why is it written this
way** — and it names the technical terms as they come up, so you can use the
right word for each thing when you explain it to somebody else.

It covers the files that make up the platform's workflow: the shared data
layer, the login system, the student board, the admin panel, and the backend
API that mirrors them. Files that are pure styling or one-off widgets
(`Button.jsx`, `Logo.jsx`, `Footer.jsx`, …) are not walked through here.

**How to read it.** Part 1 is the map. Part 2 is the glossary — skim it once,
then come back to it whenever a word in Part 3 is unfamiliar. Part 3 is the
file-by-file tour. Part 4 follows one submission all the way through the code,
which is the best way to see how the files fit together.

---

## Part 1 — The big picture

CampusVoiceBox is one website with two faces:

```
                    ┌──────────────────────────────┐
   Students  ─────▶ │  The board  (/ , /student/…)  │
                    └──────────────┬───────────────┘
                                   │  reads & writes
                                   ▼
                    ┌──────────────────────────────┐
                    │  services/store.js            │   ◀── the single data layer
                    │  users · posts · votes ·      │
                    │  notifications · audit log    │
                    └──────────────┬───────────────┘
                                   │  reads & writes
                                   ▼
                    ┌──────────────────────────────┐
   Admins    ─────▶ │  The admin panel  (/admin/…)  │
                    └──────────────────────────────┘
```

Both faces read and write **the same records** through one file,
`services/store.js`. That is the most important design decision in the
project: a student posting and an admin approving are two writes to one list,
so nothing has to be "synced" — there is only one copy.

Right now that one copy lives in the browser's **localStorage** (a small store
the browser keeps for the site). That is fine for building and demonstrating
the platform and not fine for real use, because anybody can edit their own
browser. A real backend exists in `backend/` for when that day comes; the
store is deliberately the only file that would have to change.

### The life of a submission

```
student posts ──▶ pending ──▶ approved ──▶ in_progress ──▶ resolved
                     │            ▲   (assigned to a       (summary sent
                     ▼            │    department)          to student)
                  rejected ───────┘
              (reason sent       (send back
               to student)        to review)
```

- **pending** — waiting for an admin. Not on the board.
- **approved** — on the board. A concern now needs a department.
- **in_progress** — a department has it. (The dialog calls this step "Assigned".)
- **resolved** — done; the student was told what was done.
- **rejected** — not published; the student was told why.

Every one of those moves is one function in `store.js`, and each of them
writes an **audit log** entry and a **notification** to the student as part of
the same save, so neither can be forgotten.

### Who is who

| Role | Lands on | May |
|---|---|---|
| `admin` | `/admin/dashboard` | everything — moderate, assign, resolve, manage users, change roles, export, reset |
| `student` | `/student/dashboard` | post and vote |
| `user` (staff / visitor without a student number) | `/student/dashboard` | post and vote |

There is one login for everybody. The **role** on the account decides where
they land and what they can do.

---

## Part 2 — Glossary

Grouped by where the word comes from. Each entry is one or two lines; the
file-by-file tour points back here.

### JavaScript

- **`const` / `let`** — declare a variable. `const` cannot be reassigned;
  `let` can.
- **arrow function** — `(a, b) => a + b`. A short way to write a function.
  If the body is one expression, it is returned automatically.
- **callback** — a function you hand to another function to be called later
  (`onClick={() => …}`, or the `mutate` given to `commit()`).
- **closure** — a function that "remembers" the variables around where it was
  written, even when called much later from somewhere else.
- **destructuring** — pulling named pieces out of an object or list:
  `const { user, can } = useAuth()` or `const [db, setDb] = useState(…)`.
- **rest / spread (`...`)** — `{ a, ...rest }` gathers the leftover properties
  into `rest`; `{ ...obj, x: 1 }` copies `obj` and adds `x`. On a list,
  `[...list]` makes a copy.
- **template literal** — a string in backticks with `${expression}` slots:
  `` `${prefix}-${id}` ``.
- **optional chaining `?.`** — `a?.b` reads `b` only if `a` exists; otherwise
  gives `undefined` instead of crashing.
- **nullish coalescing `??`** — `a ?? b` is `a` unless `a` is `null` or
  `undefined`, in which case it is `b`. A default value.
- **ternary `? :`** — `cond ? x : y` is "if cond then x else y", as a value.
- **`&&` in JSX** — `{cond && <p/>}` draws the element only when `cond` is
  true.
- **array methods** —
  - `.map(fn)` — make a new list by transforming each item.
  - `.filter(fn)` — keep the items where `fn` returns true.
  - `.find(fn)` / `.findIndex(fn)` — the first item (or its position) where
    `fn` is true.
  - `.some(fn)` / `.every(fn)` — is `fn` true for any item / for all items.
  - `.reduce(fn, start)` — boil a list down to one value (a total, a lookup).
  - `.sort(fn)` — order in place; `fn(a, b)` returns negative to put `a`
    first. `[...list].sort()` sorts a copy.
  - `.slice(0, n)` — the first `n` items, as a new list.
  - `.includes(x)` — does the list contain `x`.
  - `.unshift(x)` — add `x` to the front.
- **`Object.values(obj)` / `Object.keys(obj)`** — the values, or the property
  names, of an object as a list.
- **`Set` / `Map`** — a collection of unique values / a dictionary with any
  key. `[...new Set(list)]` de-duplicates a list.
- **`Date.now()` / `Date.parse(text)`** — the current time, or a date string,
  as a number of milliseconds since 1970. Subtracting two gives a duration.
- **ISO date** — `2026-09-10T07:58:34.591Z`. What `new Date().toISOString()`
  produces; sorts correctly as plain text.
- **`JSON.stringify` / `JSON.parse`** — object → text, text → object.
- **`try { … } catch (e) { … }`** — attempt something; if it throws, run the
  catch block instead of crashing.
- **`async` / `await`** — mark a function as one that waits for slow work
  (reading a file, a database query); `await` pauses at that line until the
  result is ready, without freezing everything else.
- **regular expression (regex)** — `/pattern/flags`. A pattern for matching
  text. `.test(str)` asks if it matches; `str.replace(/x/g, 'y')` replaces
  every match (`g` = global).
- **pure function** — same inputs, same output, no side effects.
  `can(user, permission)` is one.

### React

- **component** — a function that returns JSX. Written `function Name() {…}`
  and used as `<Name />`. Capitalised so React can tell it from an HTML tag.
- **JSX** — the HTML-looking syntax inside JavaScript. It compiles to
  function calls. `{expr}` drops a value into it; `className` is `class`.
- **props** — a component's inputs, passed as attributes and received as one
  object: `<Card votes={3} />` → `function Card({ votes })`.
- **`children`** — whatever is written between a component's opening and
  closing tags.
- **state** — values a component remembers between renders. Changing state
  re-draws the component.
- **render / re-render** — React calling your component function to work out
  what to draw. Happens on first load and whenever state or props change.
- **hook** — a function starting with `use` that can only be called at the
  top of a component or another hook. The ones used here:
  - **`useState(initial)`** — returns `[value, setValue]`. Passing a function
    as `initial` makes it a *lazy initialiser* (run once).
  - **`useEffect(fn, deps)`** — run `fn` after rendering, and again whenever
    something in `deps` changes. If `fn` returns a function, that runs on
    cleanup (before the next run, or when the component leaves).
  - **`useMemo(fn, deps)`** — cache the result of `fn` until `deps` change.
  - **`useCallback(fn, deps)`** — cache the function itself, so it stays the
    same object between renders.
  - **`useRef()`** — a box whose `.current` survives renders without causing
    one; attached to an element with `ref=`, it holds the real DOM node.
  - **`useContext(Ctx)`** — read a value provided higher up the tree.
- **context** — a way to hand a value (here: the signed-in user) to every
  component below a `<Provider>` without passing it through each one.
- **custom hook** — your own `use…` function built from the built-in hooks
  (`useAuth`, `useStore`, `useIsPhone`).
- **controlled input** — an input whose `value` is state and whose `onChange`
  sets that state, so React owns what the box shows.
- **`key`** — a unique, stable id on each item in a rendered list, so React
  can track which is which when the list changes.
- **conditional rendering** — `cond && <x/>`, `cond ? <x/> : <y/>`, or
  returning `null` to draw nothing.

### react-router

- **route** — "at this address, draw this component."
- **`<BrowserRouter>`** — connects the app to the browser's address bar.
- **`<Routes>` / `<Route path element>`** — the routing table.
- **nested routes** — a `<Route>` inside another. The parent draws a frame
  and puts **`<Outlet />`** where the child goes.
- **`index`** — the child to show when the address is exactly the parent's.
- **`<Link to>` / `<NavLink>`** — a link that changes the address without a
  page reload. NavLink also knows if it is the current address.
- **`<Navigate to replace />`** — a redirect. `replace` keeps it out of the
  Back history.
- **`useNavigate()`** — a function to change the address from code.
- **`useLocation()`** — the current address, plus any `state` passed along.
- **`useParams()`** — the variable parts of the path (`/users/:userId`).
- **`useSearchParams()`** — the query string (`?q=…&status=…`) as something
  you can read and set.
- **route guard** — a component that decides whether to draw the page or
  redirect.

### Tailwind CSS and layout

- **utility class** — one CSS rule per class name: `flex`, `gap-2`, `px-3`,
  `text-sm`, `bg-white`, `rounded-lg`, `shadow-sm`.
- **breakpoint prefix** — `sm:`, `md:`, `lg:`, `xl:` mean "from this screen
  width up" (640 / 768 / 1024 / 1280 px). Unprefixed = phones. This is
  "mobile first".
- **flexbox** — `flex` lays children in a row (or `flex-col`, a column).
  `items-center` aligns them across the row; `justify-between` spreads them
  along it; `gap-N` spaces them; `flex-1` takes leftover room; `shrink-0`
  refuses to be squeezed; `min-w-0` allows shrinking below content width;
  `ml-auto` pushes to the far end.
- **grid** — `grid grid-cols-4 gap-3`: a table-like layout; `col-span-2`
  makes an item two columns wide.
- **positioning** — `fixed` (pinned to the window), `sticky top-0` (scrolls
  until it reaches the top, then sticks), `absolute inset-0` (fill the
  nearest positioned parent), `relative` (become that parent). `z-40` etc.
  are stacking order.
- **`!px-2.5`** — the `!` makes the rule important, overriding one set
  elsewhere.
- **`hidden sm:block`** — hidden on phones, shown from `sm` up.
- **`truncate`** — cut long text with an ellipsis instead of wrapping.
- **`min-h-[44px]`** — a custom value in square brackets. 44px is the
  smallest control a finger can reliably hit; every button and link here
  meets it.
- **`aria-*` / `role=`** — accessibility attributes: `aria-label` names an
  icon-only control, `aria-hidden` hides decoration from screen readers,
  `aria-current` marks the current page or step, `role="alert"` announces
  an error, `role="status"` a message, `role="dialog"` a pop-up.

### Browser

- **localStorage** — a per-site key/value store of strings that survives
  reloads. `getItem`, `setItem`, `removeItem`.
- **BroadcastChannel** — send a message to the other open tabs of this site.
- **`window.matchMedia(query)`** — ask whether a CSS media query currently
  matches, and be told when that changes.
- **`document.addEventListener(type, fn)`** — listen for clicks/keys on the
  whole page.
- **`event.preventDefault()`** — stop the browser's default action (a form
  reloading the page). **`event.stopPropagation()`** — stop the event
  bubbling up to parent elements.
- **DOM** — the browser's tree of elements. React draws it for you; `ref`
  gives you a handle when you need one.

### Backend (Node / Express / PostgreSQL)

- **Express** — the web-server library. A **router** groups routes;
  **middleware** is a function that runs before the handler and can pass
  (`next()`) or refuse.
- **`req` / `res`** — the incoming request and the outgoing response.
  `req.params` (path parts), `req.query` (query string), `req.body` (JSON
  body). `res.status(404).json({…})` replies.
- **HTTP status codes** — 200 OK, 201 created, 204 done/no body, 400 bad
  input, 401 not signed in, 403 forbidden, 404 not found.
- **JWT / token** — a signed string proving who you are, sent with each
  request.
- **bcrypt** — one-way password hashing.
- **parameterised query** — `WHERE id = $1` with the value supplied
  separately, so user input can never be executed as SQL (**SQL injection**).
- **transaction** — `BEGIN … COMMIT`, or `ROLLBACK` if anything fails: all
  the statements succeed together or none do.
- **`RETURNING`** — make an `UPDATE`/`DELETE` hand back the affected row.
- **`CHECK` constraint** — a rule the database enforces on every write.

---

## Part 3 — File by file

### A. The vocabulary — `frontend/src/data/`

These files hold no logic to speak of. They are lists: what a status is, what
a role may do, what fields an account has. Every screen reads from them, which
is why adding a status or a role is "one edit here" rather than a search
through the app.

#### `data/workflow.js`

**What it is:** the dictionary of the moderation workflow — statuses, kinds,
departments, notification types, audit actions.

**What it's for:** so that every table, dropdown, badge and chart agrees on
the same words and colours, and so a new status appears everywhere by itself.

Key lines:

```js
export const STATUSES = {
  pending: {
    key: 'pending',
    label: 'Pending',
    badgeClass: 'bg-amber-100 text-amber-800',
    barClass: 'bg-amber-500',
    public: false,
    next: ['under_review', 'approved', 'rejected'],
  },
  …
```
An object used as a dictionary: look up `STATUSES.pending` and get everything
known about it. `badgeClass` and `barClass` are Tailwind class names stored
as data, so a status carries its own colour. `public` says whether students
can see it. `next` lists the statuses an admin may move it to — the review
dialog reads this to decide which buttons to offer, so the drawing and the
rules cannot disagree.

```js
export const STATUS_LIST = Object.values(STATUSES);
```
The same information as a plain list, for anything that loops (dropdowns,
charts).

```js
export const AWAITING_REVIEW = ['pending', 'under_review'];
export const OPEN_STATUSES = ['approved', 'in_progress'];
export const CLOSED_STATUSES = ['resolved'];
```
Named groups of statuses, so a screen can say `AWAITING_REVIEW.includes(post.status)`
instead of spelling the list out each time.

```js
export function statusInfo(key) {
  return STATUSES[key] ?? STATUSES.pending;
}
```
Look up a status by key, falling back to `pending` if the key is unknown —
so a bad value degrades to "needs looking at" rather than crashing.

```js
export const KINDS = {
  suggestion: { …, group: 'suggestion', needsAssignment: false },
  request:    { …, group: 'suggestion', needsAssignment: true },
  concern:    { …, group: 'concern',    needsAssignment: true },
  …
```
The one classification a post has. Two things are read off it: `group`
(the family — students call a concern a "voice out") and `needsAssignment`
(does a department have to act on it). The Open Work queue is built from the
second, not the first, which is why a Request is in it.

```js
export const ASSIGNABLE_KINDS = KIND_LIST.filter((kind) => kind.needsAssignment).map(
  (kind) => kind.key
);
```
`filter` keeps the kinds that need assignment; `map` reduces each to its key.
The result is `['request', 'concern', 'complaint', 'report']` — what the
Open Work route passes as `lockedKinds`.

```js
export const NOTIFICATION_TYPES = {
  user_registered: { key: 'user_registered', audience: 'admin', … },
  post_approved:   { key: 'post_approved',   audience: 'author', … },
```
`audience` decides who a notification is delivered to. There is deliberately
no "new submission" type for admins: a new post is already the newest row in
Pending Approval, so a notification would be the same fact on a second badge.

#### `data/roles.js`

**What it is:** the permission system — what each role may do, and where it
lands after login.

**What it's for:** so screens ask "may this account do X?" rather than "is
this an admin?", which lets a new role be a list of strings.

```js
export const PERMISSIONS = {
  VIEW_ADMIN: 'view_admin',
  MODERATE_POSTS: 'moderate_posts',
  …
};
```
Each permission is a string. UPPER_CASE names are a convention for constants.

```js
export const ROLES = {
  admin: { key: 'admin', label: 'Admin', permissions: ALL_PERMISSIONS, home: '/admin/dashboard', … },
  student: { …, permissions: [PERMISSIONS.SUBMIT_POSTS, PERMISSIONS.VOTE], home: '/student/dashboard' },
  user: { … same as student … },
};
```
One admin role holding everything. There used to be a `super_admin` above
it; on a platform run by one office that was a tier nobody needed. What
stops an admin misusing the reserved powers is not a second tier but the
self-checks: nobody can change their own role, suspend or delete themselves.

```js
export function can(user, permission) {
  if (!user) return false;
  if (user.status === 'suspended') return false;
  return roleInfo(user.role).permissions.includes(permission);
}
```
The single question every guard and every button asks. A pure function: same
inputs, same answer, no side effects — which is what makes it safe to call
from anywhere.

#### `data/accountFields.js`

**What it is:** the list of fields on an account.

**What it's for:** the student's account form and the admin's user-profile
form both used to carry their own copy of this list. Now both loop over this
one, so a field added here appears in both forms and the read-only view.

```js
export const ACCOUNT_FIELDS = [
  { key: 'name', label: 'Full name', type: 'text', required: true },
  { key: 'email', label: 'Email', type: 'email', adminOnly: true },
  …
];
export const STUDENT_EDITABLE_FIELDS = ACCOUNT_FIELDS.filter((field) => !field.adminOnly);
```
"Configuration as data": describe the fields once, draw them with `.map`.
`adminOnly` marks the email — a student may see it but not change it.

#### `data/suggestions.js`

**What it is:** six sample posts written on the very first visit so the
board is not empty.

`store.js` turns these into full records — adding an author, a kind and a
status — which is why those fields are not here.

---

### B. The data layer — `frontend/src/services/store.js`

**What it is:** the one file that reads and writes the platform's records.

**What it's for:** both the student board and the admin panel go through it,
which is what makes them one system. It also means "move this to a server"
is a change to this file alone.

**Structure:** helpers → seed data → read/write → selectors → the `useStore`
hook (subscriptions, `commit`, and every action).

Key lines:

```js
const SCHEMA_VERSION = 12;
```
Bumping this wipes the stored data and re-seeds it. It is bumped whenever the
*shape* of a record changes (a field added or removed, a status retired), so
old data cannot half-load into new code. The comment above it is a changelog
of every bump and why.

```js
const KEYS = { version: 'cvb_schema_version', users: 'cvb_users', posts: 'cvb_posts', … };
```
The localStorage keys. Prefixed `cvb_` so they cannot collide with anything
else on the same domain.

```js
function readKey(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
```
localStorage holds strings, so `JSON.parse` turns the text back into an
object. The `try/catch` is because storage can be disabled (private browsing
on some phones) or hold something unparseable; either way the app gets a
usable fallback rather than crashing.

```js
export function readDb() {
  …
  if (Number(localStorage.getItem(KEYS.version)) !== SCHEMA_VERSION) {
    const fresh = seedDatabase();
    writeDb(fresh);
    …
```
On every read, check the stored version. If it does not match, start over
with the seed. This is what makes the version bump work.

```js
function writeDb(db) {
  localStorage.setItem(KEYS.users, JSON.stringify(db.users));
  …
  getChannel()?.postMessage('changed'); // other tabs
  notifyLocal();                        // and everything watching in this one
}
```
Save every list, then tell everybody: other tabs via BroadcastChannel, and
the other components on this page via a local listener list. This is why an
approval in the admin tab appears on the student tab without a reload.

```js
export function findUser(db, userId) {
  return db.users.find((user) => user.id === userId) ?? null;
}
```
A **selector**: a plain function that answers a question about the data. The
screens call these rather than digging through `db` themselves.

```js
export function needsAssigning(db) {
  return db.posts.filter(
    (post) =>
      OPEN_STATUSES.includes(post.status) &&
      !post.department &&
      kindInfo(post.kind).needsAssignment
  );
}
```
"Approved but handed to nobody." The dashboard card and the Departments page
both count from here, so they can never disagree.

```js
export function platformStats(db) {
  …
  return {
    totalUsers: db.users.length,
    pendingPosts: byStatus(AWAITING_REVIEW),
    openWork: db.posts.filter((post) => kindInfo(post.kind).needsAssignment && OPEN_STATUSES.includes(post.status)).length,
    unassignedPosts: needsAssigning(db).length,
    …
```
Every number a card could want, counted in one pass. The little helpers
(`byStatus`, `byGroup`) are closures defined inside the function so the
counting reads as English.

```js
export function useStore(actor = null) {
  const [db, setDb] = useState(readDb);
```
**The hook.** `useState(readDb)` — passing the function, not calling it — is a
lazy initialiser: storage is read once, on first render. `actor` is who is
performing actions, for the audit log; `= null` is the default when a screen
does not say.

```js
  useEffect(() => {
    function refresh() { setDb(readDb()); }
    const liveChannel = getChannel();
    if (liveChannel) liveChannel.addEventListener('message', refresh);
    localListeners.add(refresh);
    window.addEventListener('storage', handleStorage);
    return () => { …remove all three… };
  }, []);
```
Subscribe to changes from every source, and — in the returned cleanup — un-
subscribe when the component goes away. The empty `[]` means "set up once".

```js
  const commit = useCallback((mutate) => {
    const next = readDb();     // re-read first, so a change from another tab is not lost
    const result = mutate(next);
    try { writeDb(next); } catch { throw new Error('There is no room left to save this…'); }
    setDb(next);
    return result;
  }, []);
```
**Every write goes through here.** `mutate` is a callback that changes the
working copy in place. Doing the read → change → save → re-draw routine in
one place means no action can forget a step. `useCallback` keeps `commit` the
same function object across renders, which the `useMemo` below depends on.

```js
  function log(next, action, { targetType = '', targetId = '', details = '' } = {}, as = actor) {
    if (!as) return;
    next.audit.unshift({ id: newId('log'), adminId: as.id, adminName: as.name, action, … createdAt: nowIso() });
    next.audit = next.audit.slice(0, 500);
  }
```
Write an audit entry. `unshift` puts it at the front (newest first);
`slice(0, 500)` caps the log. Called by the actions themselves, never by
screens, so it cannot be skipped. The `{ … } = {}` in the parameter list is a
destructured options object with a default of "no options".

```js
  const actions = useMemo(() => {
    function createPost({ kind, category, title, message, anonymous, attachments, authorId }) {
      return commit((next) => {
        const post = { id: newId('post'), kind, category, title, message, authorId,
                       anonymous: Boolean(anonymous), status: 'pending', department: '', … };
        next.posts.unshift(post);
        return { post };
      });
    }
```
An **action**. Everything starts life `pending`; nothing reaches the board
without moderation. There is no notification to admins here on purpose — the
Pending Approval queue *is* the notification.

```js
    function changeStatus(postId, status, { reason = '' } = {}) {
      return commit((next) => {
        const post = next.posts.find((candidate) => candidate.id === postId);
        if (!post) return { error: 'That submission no longer exists.' };
        post.status = status;
        if (status === 'rejected') post.rejectionReason = reason;
        log(next, auditAction, { … });
        notify(next, notice.type, { userId: post.authorId, … });
        return { post };
      });
    }
```
One function behind Approve, Reject and every other status move, so the audit
entry and the student's notification are always written together with the
change. Returning `{ error }` rather than throwing is the convention for
"expected" failures the screen should show.

```js
    function assignConcern(postId, { department, assignedTo }) {
      …
        if (['approved', 'pending', 'under_review'].includes(post.status)) {
          post.status = 'in_progress';
        }
```
Assigning *is* the work starting — there used to be a separate `assigned`
status between the two, and nothing ever sat in it.

```js
    function resolveConcern(postId, resolution) {
      …
        const alreadyResolved = post.status === 'resolved' && Boolean(post.resolvedAt);
        post.status = 'resolved';
        post.resolution = resolution;
        if (!alreadyResolved) post.resolvedAt = nowIso();
```
Editing the summary of something already resolved keeps its original date —
otherwise every wording fix would move the date forward and inflate the
resolution-time figures.

```js
    return { register, authenticate, updateUser, …, recordLogin, recordLogout };
  }, [commit, actor?.id, actor?.name, actor?.role]);

  return { db, ...actions };
}
```
The actions are cached with `useMemo` and rebuilt only when the actor
changes. `{ db, ...actions }` spreads them next to the data, so a screen can
write `store.db.posts` and `store.approve(…)` from the same object.

---

### C. Who is signed in — auth and routing

#### `context/AuthContext.jsx`

**What it is:** the "who is logged in" context, plus `login`, `signup`,
`logout` and `can`.

**What it's for:** every screen can ask `useAuth()` for the current user
without the answer being passed down through each component by hand.

```js
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [sessionId, setSessionId] = useState(readSessionId);
  const store = useStore(null);
```
Only the *id* of the signed-in account is held in state; the account itself
is looked up from the store on every render. So when an admin suspends
somebody, it takes effect for that person immediately — there is no stale
copy.

```js
  const user = useMemo(() => {
    const found = store.db.users.find((candidate) => candidate.id === sessionId);
    if (!found) return null;
    const { password, ...safe } = found;
    return { ...safe, initials: initialsOf(found.name) };
  }, [store.db.users, sessionId]);
```
`const { password, ...safe } = found` — destructure `password` out and gather
everything else into `safe`. The password never leaves the store.

```js
  const value = useMemo(() => ({
    user, signup, login, logout,
    can: (permission) => roleCan(user, permission),
    home: homeFor(user),
  }), [user, signup, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.');
  return context;
}
```
The provider fills the context slot; `useAuth` reads it. The `throw` catches
the mistake of using a screen outside the provider, loudly, at development
time.

#### `components/RequireAuth.jsx`

**What it is:** four route guards.

| Guard | Lets through | Otherwise |
|---|---|---|
| `RequireAuth` | anyone signed in | → `/login`, remembering where they were going |
| `RequirePermission` | signed in **and** holding the permission | → their own dashboard |
| `RedirectIfSignedIn` | signed out (for `/login`, `/signup`) | → their dashboard |
| `AdminHomeRedirect` | non-admins | admins → the panel (or `to=`) |

```js
export function RequirePermission({ permission }) {
  const { user, can } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (!can(permission)) return <Navigate to={homeFor(user)} replace />;
  return <Outlet />;
}
```
Rendering `<Navigate>` *is* the redirect. `state={{ from }}` travels with it,
invisibly, so `/login` can send the person on afterwards. `<Outlet />` draws
whichever child route matched, once the check passes. Somebody signed in but
not allowed is sent home rather than shown a locked door — announcing "an
admin area exists" tells a stranger more than they need.

These guards decide what the app *draws*. They run in the visitor's browser
and are not security; the server has to check again (see `middleware/auth.js`).

#### `App.js`

**What it is:** the routing table for the whole platform.

```jsx
<AuthProvider>
  <BrowserRouter …>
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<AdminHomeRedirect><Home /></AdminHomeRedirect>} />
      </Route>
```
The board at `/`, inside the student site's frame. An admin who lands here is
forwarded to the panel.

```jsx
      <Route element={<RequireAuth />}>
        <Route path="/student/dashboard" element={<StudentDashboard />} />
        <Route path="/account" element={<AdminHomeRedirect to="/admin/profile"><Account /></AdminHomeRedirect>} />
      </Route>
```
A guard with no `path` wraps a group: both routes inside need a signed-in
user. `/account` forwards admins to their admin-side profile, so there is
one account page per person.

```jsx
      <Route element={<RequirePermission permission={PERMISSIONS.VIEW_ADMIN} />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route element={<RequirePermission permission={PERMISSIONS.MODERATE_POSTS} />}>
            <Route path="queue/pending" element={<Submissions title="Pending Approval" lockedStatuses={AWAITING_REVIEW} queue />} />
            <Route path="queue/open" element={<Submissions title="Open Work" lockedKinds={ASSIGNABLE_KINDS} lockedStatuses={OPEN_STATUSES} queue />} />
          </Route>
          <Route path="posts" element={<Submissions title="All Submissions" … />} />
```
Three levels of nesting: a permission guard, then the admin frame
(`AdminLayout` draws the sidebar and an `<Outlet />`), then the pages. Both
queues and All Submissions are the **same component** with different props —
which is why adding a queue costs a route and nothing else.

```jsx
      <Route path="*" element={<Navigate to="/" replace />} />
```
The catch-all. Eight redirect routes for retired addresses used to sit above
it "for bookmarks"; nothing linked to them and the build had never shipped,
so they were removed.

---

### D. The student side

#### `components/Navbar.jsx`

**What it is:** the navy bar at the top of the student site: logo, search
box, and either the auth buttons or the profile circle.

```jsx
<div className="flex items-center gap-2 sm:gap-4">
  <Link to="/" className="flex min-h-[44px] min-w-[44px] shrink-0 items-center" aria-label="CampusVoiceBox home">
    <span className="hidden sm:block"><Logo tone="light" /></span>
    <span className="sm:hidden"><Logo tone="light" showText={false} /></span>
  </Link>
  <div className="min-w-0 flex-1 sm:max-w-2xl"><SearchBar /></div>
  <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">…buttons…</div>
</div>
```
One flex row at every width. The logo never shrinks; the search box takes
what is left (`flex-1`) but may shrink to fit (`min-w-0`); the buttons are
pushed right (`ml-auto`). On phones the wordmark is dropped (`sm:hidden` /
`hidden sm:block` swap the two logo versions) and the buttons lose 4px of
padding (`!px-2.5 sm:!px-3.5`) so all three fit on a 360px screen.

#### `components/SearchBar.jsx`

**What it is:** the category dropdown and the search field, as one control.

**Why the address bar:** both write to `?category=` and `?q=` rather than
React state, so the board can read them from anywhere, Back works, and a
filtered view can be shared as a link.

```js
const [searchParams, setSearchParams] = useSearchParams();
const category = searchParams.get('category') ?? '';

function updateParam(key, value) {
  const next = new URLSearchParams(searchParams);
  if (value) next.set(key, value); else next.delete(key);
  next.delete('mine');
  setSearchParams(next, { replace: true });
}
```
Copy the current params, change one, write them back. `replace: true` means
typing a search does not add a history entry per letter. Clearing `mine`
means searching always searches the whole board.

```jsx
<div className="relative shrink-0 border-r border-slate-200">
  <span aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center text-navy-700 sm:hidden">
    <svg …filter icon…/>
    {category && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-mustard ring-2 ring-white" />}
  </span>
  <select … className="w-11 sm:w-32 … opacity-0 sm:opacity-100">
```
On phones the dropdown is an icon: the real `<select>` is still there, 44px
wide at zero opacity, laid over a filter icon. A tap on the icon is a tap on
the select, so the phone's own picker opens with every label at full size.
`pointer-events-none` on the icon lets the tap through; the mustard dot says
a category is applied. From `sm` up the select shows its own text.

```js
function useIsPhone() {
  const [isPhone, setIsPhone] = useState(() => window.matchMedia(PHONE_QUERY).matches);
  useEffect(() => {
    const media = window.matchMedia(PHONE_QUERY);
    const update = (event) => setIsPhone(event.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return isPhone;
}
```
A custom hook: is the CSS "phone" media query matching right now? Used only
to shorten the placeholder to "Search" on phones.

#### `components/ProfileMenu.jsx`

**What it is:** the profile circle at the right of the navbar and its
drop-down: who is signed in, links to the dashboard / account / admin panel,
"Your Suggestions" and "Your Voice Outs", category shortcuts, and Log out.

```js
const menuRef = useRef(null);
useEffect(() => {
  if (!open) return undefined;
  function handleClickOutside(event) {
    if (menuRef.current && !menuRef.current.contains(event.target)) setOpen(false);
  }
  document.addEventListener('mousedown', handleClickOutside);
  document.addEventListener('keydown', handleKey);
  return () => { …remove both… };
}, [open]);
```
`useRef` holds the menu's DOM node so a click can be tested for "inside or
outside". The listeners are only attached while the menu is open (the effect
depends on `open`) and removed in the cleanup.

```js
function showMyPosts(group) {
  const next = new URLSearchParams();
  next.set('mine', group);
  setSearchParams(next);
  …
}
…
<button onClick={() => showMyPosts('concern')}>Your Voice Outs</button>
```
"Your Voice Outs" is `?mine=concern` — the concern *family* from
`workflow.js`. It used to be a separate stored field, `type`; now the kind is
the one classification and this filter reads off it.

Log out is a two-step action on purpose: the button opens a `ConfirmDialog`,
and only confirming ends the session.

#### `components/PostModal.jsx`

**What it is:** the pop-up for writing a post.

```js
function PostModal({ mode, onClose, onSubmit }) {
  const [category, setCategory] = useState(CATEGORIES[0].slug);
  const [kind, setKind] = useState(mode === 'voice' ? 'concern' : 'suggestion');
  const [title, setTitle] = useState('');
  …
```
`mode` is which hero button was pressed. It picks the wording and the
*starting* kind, and that is all — it is not stored. The `kind` the student
ends up with is the one classification a post has.

```js
if (!checkFields(trimmedTitle, trimmedMessage).clean) {
  setError(rejectionMessage());
  return;
}
onSubmit({ kind, category, title: trimmedTitle, message: trimmedMessage, anonymous, attachments });
onClose();
```
Nothing is saved until it passes the rudeness filter in
`services/moderation.js`. On success the finished post is handed to whoever
opened the modal via the `onSubmit` callback — the modal does not know about
the store.

#### `components/SuggestionCard.jsx`

**What it is:** one post on the board.

```jsx
{kind.group === 'concern' && (
  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${kind.badgeClass}`}>
    {kind.label}
  </span>
)}
```
A concern-family post gets its kind as a tag — Concern, Complaint or Report —
in the same colour the admin panel uses. Suggestions get no tag.

```js
const share = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
const hasMajority = share > 50;
```
The vote meter shows the post's share of *every* vote on the board. There is
no target and no maximum — the question a suggestion box answers is "which of
these does the campus want most", and that has no ceiling.

#### `pages/Home.jsx`

**What it is:** the public board.

```js
const visiblePosts = useMemo(() => {
  const search = query.trim().toLowerCase();
  return publicPosts(store.db)
    .filter((post) => {
      const matchesCategory = !activeCategory || post.category === activeCategory;
      const matchesSearch = !search || post.message.toLowerCase().includes(search) || …;
      const matchesMine = !mine || (user && post.authorId === user.id && kindInfo(post.kind).group === mine);
      return matchesCategory && matchesSearch && matchesMine;
    })
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}, [store.db, activeCategory, query, mine, user]);
```
Start from `publicPosts()` — only statuses students may see — then apply the
three filters read from the address bar, then newest first. `useMemo` re-runs
this only when one of the listed inputs changes.

```js
function openModal(mode) {
  if (!user) { navigate('/login'); return; }
  setModalMode(mode);
}
```
Posting requires an account, so guests are sent to log in.

#### `pages/Login.jsx` and `pages/Signup.jsx`

**What they are:** the one login and the one sign-up for every role.

```js
const [form, setForm] = useState({ email: '', password: '' });
function handleChange(field) {
  return (event) => { setForm({ ...form, [field]: event.target.value }); setError(''); };
}
```
One state object for the whole form. `handleChange('email')` *returns* the
change handler for that field — a function that makes a function — so both
inputs share one piece of code. `[field]` in square brackets means "the
property whose name is in the variable".

```js
function handleSubmit(event) {
  event.preventDefault();
  …
  const result = login({ email: form.email.trim(), password: form.password });
  if (result.error) { setError(result.error); return; }
  navigate(from ?? result.home, { replace: true });
}
```
`preventDefault` stops the browser reloading the page on submit. On success,
go to where the route guard said the person was heading (`from`), or to the
dashboard for their role.

Sign-up never sets a role: registering produces a student or user account,
and an admin can only be made afterwards by an admin, from the user profile.

#### `pages/student/Dashboard.jsx`

**What it is:** "everything you have sent in, and where each one has got to."

It closes the loop: a student who hears nothing assumes the box is a bin. This
page reads the same records the admin worked on — status, department,
resolution — from the student's side.

```jsx
{post.department && (
  <p …><strong>Being handled by:</strong> {departmentLabel(post.department)}{post.assignedTo && ` · ${post.assignedTo}`}</p>
)}
{post.resolution && (<p …><strong>Resolved:</strong> {post.resolution}</p>)}
```
Each line appears only when there is something to tell them.

#### `pages/student/Account.jsx`

**What it is:** the student's own account form.

```js
const [draft, setDraft] = useState(() => {
  const seed = {};
  STUDENT_EDITABLE_FIELDS.forEach((field) => { seed[field.key] = user[field.key] ?? ''; });
  return seed;
});
```
A lazy initialiser builds the draft from the shared field list, seeded from
the signed-in account. The email is drawn as a `disabled` input — shown, not
editable.

---

### E. The admin side

#### `components/admin/AdminLayout.jsx`

**What it is:** the frame every admin page sits in — sidebar, header, and an
`<Outlet />` for the page.

```js
function buildNav(counts) {
  return [
    { items: [{ to: '/admin/dashboard', label: 'Dashboard', icon: ICONS.dashboard }] },
    { title: 'Work', permission: PERMISSIONS.MODERATE_POSTS, items: [
        { to: '/admin/queue/pending', label: 'Pending Approval', icon: ICONS.approval, badge: counts.pending },
        { to: '/admin/queue/open',    label: 'Open Work',        icon: ICONS.progress, badge: counts.openWork },
    ]},
    …
```
The sidebar as data. Adding a page is adding one object here.

```js
const nav = useMemo(() =>
  buildNav(counts)
    .filter((section) => !section.permission || can(section.permission))
    .map((section) => ({ ...section, items: section.items.filter((item) => !item.permission || can(item.permission)) }))
    .filter((section) => section.items.length > 0),
  [counts, can]);
```
Drop any section or row the signed-in admin has no permission for. Today's
one admin role holds everything; a narrower role added later gets a shorter
sidebar without any page checking the role itself.

```js
const counts = useMemo(() => ({
  pending: db.posts.filter((post) => AWAITING_REVIEW.includes(post.status)).length,
  openWork: db.posts.filter((post) => kindInfo(post.kind).needsAssignment && OPEN_STATUSES.includes(post.status)).length,
  unread: notificationsFor(db, user).filter((note) => !note.read).length,
}), [db, user]);
```
The badge numbers, recounted whenever the data changes. `{item.badge > 0 && <Badge>…}`
— a badge showing "0" is noise that trains people to ignore badges.

```jsx
<aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">{sidebar}</aside>
{menuOpen && (<div className="fixed inset-0 z-50 lg:hidden">…{sidebar}…</div>)}
<div className="lg:pl-64">
  <header className="sticky top-0 z-30 …">
    …bell… 
    <Link to="/admin/profile" …><Avatar …/><span …>{user?.name}</span><RoleBadge …/></Link>
  </header>
  <main><Outlet /></main>
</div>
```
Desktop: the sidebar is fixed on the left and the content is padded by its
width. Below `lg` it becomes a slide-over drawn only while `menuOpen`. The
same `sidebar` markup is used in both places. The header holds the one bell
(the only unread count) and the one identity link.

#### `pages/admin/Dashboard.jsx`

**What it is:** "what needs doing right now." Four cards that drain to zero,
each opening the queue that clears it, plus the front of both queues and
recent activity. Every total lives on Analytics instead.

```js
const longestWait = reviewQueue.length
  ? Math.floor((Date.now() - Date.parse(reviewQueue[0].createdAt)) / 86400000)
  : null;
```
Days the oldest pending item has waited: milliseconds between now and its
creation, divided by a day's milliseconds, rounded down. `null` (not 0) when
the queue is empty, so the card can print a dash.

```jsx
<StatCard label="Longest Wait" value={longestWait === null ? '—' : `${longestWait}d`}
  tone={longestWait === null ? 'good' : longestWait >= 7 ? 'bad' : 'warn'} to="/admin/queue/pending" />
```
A chained ternary picks the colour: green when clear, red past a week, amber
in between.

#### `pages/admin/Analytics.jsx`

**What it is:** "how big, and how well." Every total, rate and breakdown,
and nothing that is on the dashboard.

```js
const byStatus = useMemo(() =>
  STATUS_LIST.map((status) => ({ label: status.label, color: status.barClass, value: db.posts.filter((post) => post.status === status.key).length }))
    .filter((row) => row.value > 0),
  [db.posts]);
```
Chart data as `{ label, color, value }` rows, built from the vocabulary so a
new status appears on its own. `BarChart` draws whatever it is given and knows
nothing about statuses.

```js
const handledRate = stats.totalPosts ? Math.round((handled / stats.totalPosts) * 100) : 0;
```
"Reviewed %" — the plainest measure of keeping up. The guard avoids dividing
by zero on an empty board.

#### `components/admin/Charts.jsx`

**What it is:** one horizontal bar chart, drawn as plain markup. No charting
library — the site's own colours, no dependency to maintain.

```jsx
const max = Math.max(...data.map((item) => item.value), 1);
…
<div className={`h-full rounded-full ${item.color ?? 'bg-navy-600'}`} style={{ width: `${(item.value / max) * 100}%` }} />
```
Bars are sized against the *largest* value, not the total, so a small set of
numbers still fills the width. The `1` stops a divide-by-zero. Width is an
inline style because it is a calculated number.

#### `pages/admin/Submissions.jsx`

**What it is:** one page, three routes — All Submissions, Pending Approval,
Open Work — differing only in the props the route passes.

```js
function Submissions({ title, description, lockedGroup = null, lockedKinds = null, lockedStatuses = null, queue = false }) {
```
Anything a route *locks* is removed from the filter bar rather than shown
fixed, so there is no control on screen that can contradict the page. `queue`
sorts oldest first: the top of a queue should be whoever has waited longest.

```js
const scoped = useMemo(() => {
  let posts = db.posts;
  if (lockedGroup) posts = posts.filter((post) => kindsInGroup(lockedGroup).includes(post.kind));
  if (lockedKinds) posts = posts.filter((post) => lockedKinds.includes(post.kind));
  if (lockedStatuses) posts = posts.filter((post) => lockedStatuses.includes(post.status));
  return posts;
}, [db.posts, lockedGroup, lockedKinds, lockedStatuses]);
```
The records this route may show, before the user's own filters.

```js
const haystack = [post.title, post.message, post.id, author?.name, author?.email, author?.studentId]
  .filter(Boolean).join(' ').toLowerCase();
return haystack.includes(search);
```
Search reaches the author's name and student number too — "find everything
this student submitted" is a question admins ask constantly. `filter(Boolean)`
drops the empty entries before joining.

```js
const assignsWork = queue && kindOptions.every((item) => item.needsAssignment);
…
assignsWork ? { key: 'department', header: 'Department', … } : { key: 'author', header: 'Submitted by', … },
```
On a queue where everything gets a department, the table shows *who owns it*;
elsewhere, *who raised it*. One column, never both — both together pushed the
table past its container.

```js
const [reviewingId, setReviewingId] = useState(searchParams.get('highlight'));
const highlight = searchParams.get('highlight');
useEffect(() => { if (highlight) setReviewingId(highlight); }, [highlight]);
```
A `?highlight=` link opens that submission's dialog. The effect is needed
because a click elsewhere can change the address while this page is already
on screen, and `useState`'s initial value only runs once.

#### `components/admin/SubmissionReview.jsx`

**What it is:** the dialog for reading one submission and acting on it. The
busiest screen in the panel, laid out in the order an admin works:

1. **Progress** — where it stands (pinned to the top while scrolling)
2. **Submission** — what was written
3. **Submitted by** — who wrote it (admins only)
4. **Next step** — ONE section, chosen by the current status
5. **Internal notes**

```js
function pathFor(kind) {
  return kind.needsAssignment
    ? [ { label: 'Submitted', statuses: ['pending', 'under_review'] },
        { label: 'Approved',  statuses: ['approved'] },
        { label: 'Assigned',  statuses: ['in_progress'] },
        { label: 'Resolved',  statuses: ['resolved'] } ]
    : [ { label: 'Submitted', statuses: ['pending', 'under_review'] },
        { label: 'Approved',  statuses: ['approved', 'in_progress'] },
        { label: 'Resolved',  statuses: ['resolved'] } ];
}
```
The progress line is built from the steps an admin actually takes, per kind,
and named after the buttons. A suggestion has no "Assigned" step because it
is never handed to a department. Because a later step is unreachable without
the earlier ones, a tick on the line always means "this happened".

```js
const currentIndex = rejected ? -1 : path.findIndex((step) => step.statuses.includes(post.status));
…
const done = index <= currentIndex;
const isCurrent = index === currentIndex;
{done && !isCurrent ? <CheckIcon /> : index + 1}
```
Which step is current; ticks behind it, numbers ahead. Rejected is not a
step — it is announced above the line with nothing ticked.

```js
const allows = (next) => status.next.includes(next);
```
Is this a legal move from here? Every status button asks before it is drawn,
so a change to `next` in `workflow.js` removes a button rather than leaving
one that performs a forbidden move.

```js
function run(action, done) {
  try {
    const result = action();
    if (result?.error) { setError(result.error); return; }
    setError('');
    setJustDid(done);
    setReassigning(false);
    setResolvingUnassigned(false);
  } catch (failure) { setError(failure.message); }
}
```
Every action funnels through here. On success the dialog **stays open**: the
page re-reads `post` from the store, so the progress line and the next-step
section redraw for the new status, and `justDid` says what just happened.
It used to close on every click, which meant an approved concern vanished
from the queue and had to be found again elsewhere before it could be
assigned.

```js
function handleReject() {
  if (!reason.trim()) { setError('Please give a reason. …'); return; }
  run(() => store.changeStatus(post.id, 'rejected', { reason: reason.trim() }), 'Rejected. …');
}
```
A rejection with no reason is the thing students complain about most, so the
form insists on one. This is the *only* reject button — the old progress line
had a second one that skipped the reason.

```js
const assignForm = (buttonLabel, size = 'md') => (<>…<Select id="assign-department" …/>…<Button onClick={handleAssign}>{buttonLabel}</Button></>);
```
A plain function returning JSX, called as `{assignForm('Assign to department')}`.
If it were a *component*, React would rebuild its inputs on every keystroke
and the cursor would jump out of the box.

```js
let nextStep = null;
if (AWAITING_REVIEW.includes(post.status) && mayModerate) {
  nextStep = (<Section title="Next step: decide" tone="admin">…Approve…Or reject it…</Section>);
} else if (post.status === 'approved' && mayManageConcerns) {
  nextStep = kind.needsAssignment ? (<Section title="Next step: assign it" …/>) : (<Section title="Next step: resolve it" …/>);
} else if (post.status === 'in_progress' && mayManageConcerns) { … }
else if (post.status === 'resolved' && mayManageConcerns) { … }
else if (post.status === 'rejected') { … }
```
One section per status, with one primary button. Side paths — Reassign,
Resolve without assigning, Send back to review, Reopen — are small
`SideAction` buttons with their consequence written beside them, folded away
until asked for.

```jsx
<div className="sm:sticky sm:top-0 sm:z-10 sm:-mx-1 sm:bg-white sm:px-1 sm:pb-1">
  <Section title="Progress">
    <StatusSteps post={post} path={path} />
    {justDid ? <p role="status" …>{justDid}</p> : <p …>{stageCaption(post, kind)}</p>}
  </Section>
</div>
```
The map stays pinned to the top of the scrolling area so it is in view when
the button at the bottom is pressed and the line moves. Under it, either what
just happened or a one-line caption of what this stage means.

#### `pages/admin/UserProfile.jsx`

**What it is:** one account in full — details, activity, every submission —
with the controls for acting on it.

```js
const { userId } = useParams();
const account = findUser(store.db, userId);
if (!account) { return (<>…"This account no longer exists"…</>); }
const isSelf = account.id === user.id;
```
`useParams` reads `:userId` from the address. The early return means nothing
below has to keep checking for a missing account. `isSelf` guards the
controls you must never be able to use on yourself: suspend, delete, change
role.

```js
const confirmCopy = {
  suspend: { title: `Suspend ${account.name}?`, … },
  activate: { … },
  delete: { … },
}[confirming];
```
An object used as a lookup table: one `ConfirmDialog`, three sets of wording,
picked by which string is in `confirming`.

```jsx
<DetailList items={[
  ...ACCOUNT_FIELDS.map((field) => ({ label: field.label, value: field.key === 'email' && !maySeeIdentity ? 'Hidden' : account[field.key] })),
  { label: 'Account ID', value: account.id },
  { label: 'Registered', value: formatDate(account.createdAt) },
  { label: 'Last login', value: account.lastLogin ? `${formatDateTime(account.lastLogin)} (${timeAgo(account.lastLogin)})` : 'Never' },
]} />
```
The read-only view is built from the same field list as the edit form, so it
cannot show a field the form forgot. Last login is printed once, as a date
with how long ago beside it.

#### `pages/admin/Departments.jsx`

**What it is:** who is carrying what, and how long it is taking them. It adds
no new data; it reads what the assignment step has been writing all along.

```js
const rows = useMemo(() => DEPARTMENTS.map((department) => {
  const assigned = db.posts.filter((post) => post.department === department.key);
  const open = assigned.filter((post) => OPEN_STATUSES.includes(post.status));
  const timed = assigned.filter((post) => post.resolvedAt && post.createdAt);
  const avgDays = timed.length
    ? timed.reduce((sum, post) => sum + (Date.parse(post.resolvedAt) - Date.parse(post.createdAt)), 0) / timed.length / 86400000
    : null;
  const oldestOpen = open.length ? Math.floor((Date.now() - Math.min(...open.map((p) => Date.parse(p.createdAt)))) / 86400000) : null;
  return { id: department.key, label: department.label, open: open.length, resolved: …, avgDays, oldestOpen };
}), [db.posts]);
```
One row per department. `avgDays` is `null`, not 0, when nothing has been
resolved — a department that has never closed anything has no average, and
"0.0d" would read as *instant*. The figure that matters most is that last
column: four open concerns is busy; eleven days to close one is a problem,
and those are not the same thing.

```js
{ key: 'avgDays', sortValue: (row) => row.avgDays ?? Infinity, … }
```
When sorting by average, treat "no average" as infinitely large so those rows
sink rather than sorting as zero to the top.

#### `pages/admin/Notifications.jsx`

**What it is:** the notification centre for the things that have no queue —
a new account, and anything about the admin's own posts.

```js
const all = useMemo(() => notificationsFor(store.db, user), [store.db, user]);
const typeOptions = useMemo(() => {
  const present = [...new Set(all.map((note) => note.type))];
  return present.map((type) => ({ value: type, label: notificationInfo(type).label }));
}, [all]);
```
Only offer a type in the dropdown if something of that type has arrived —
a filter that can only return nothing is clutter. `[...new Set(…)]`
de-duplicates.

New submissions are *not* here: they go straight to Pending Approval and are
counted there, once. That is why the bell's count never duplicates a queue
badge.

#### `pages/admin/System.jsx`

**What it is:** a read-only description of what the platform recognises —
categories, kinds, statuses, departments, notification types, roles — and
where each is defined, plus one button to reset the demo data.

It was called "Settings", which promised something it does not offer: there
is nothing here to set. Everything drawn is `.map` over a list imported from
`data/`, so the page cannot disagree with the rest of the app.

---

### F. The backend — `backend/src/`

The backend is a real Express + PostgreSQL API that mirrors the frontend's
model. **The frontend does not call it yet** — `store.js` reads localStorage —
so these files are the shape of the future, not the running system. Only the
parts touched in this pass are covered.

#### `middleware/auth.js`

```js
const ROLE_PERMISSIONS = {
  admin: ['view_admin', 'moderate_posts', 'manage_concerns', 'view_identity', 'manage_users',
          'delete_users', 'manage_admins', 'view_analytics', 'view_audit_log', 'manage_settings',
          'submit_posts', 'vote'],
  student: ['submit_posts', 'vote'],
  user: ['submit_posts', 'vote'],
};
```
The server's copy of `roles.js` — the same twelve permissions, checked
programmatically to match. This copy is the one that actually counts: the
frontend's guards decide what to *draw*; this decides what the API will *do*.

```js
function requirePermission(permission) {
  return async function check(req, res, next) {
    const { rows } = await pool.query('SELECT id, role, status FROM users WHERE id = $1', [req.user.id]);
    const account = rows[0];
    if (!account) return res.status(401).json({ error: 'This account no longer exists.' });
    if (account.status === 'suspended') return res.status(403).json({ error: 'This account has been suspended.' });
    const allowed = ROLE_PERMISSIONS[account.role] ?? [];
    if (!allowed.includes(permission)) return res.status(404).json({ error: 'Not found.' });
    req.user.role = account.role;
    next();
  };
}
```
Middleware that re-reads the account's role from the database on **every**
request rather than trusting the token — a token issued an hour ago still
says "admin" after the account has been demoted. `$1` is a parameterised
placeholder: the id is supplied separately, never pasted into the SQL. An
unauthorised caller gets 404, not 403 — telling them the endpoint exists is
more than they need to know.

#### `routes/adminRoutes.js`

```js
const router = express.Router();
router.use(requireAuth);
…
router.patch('/users/:id/role', requirePermission('manage_admins'), async (req, res, next) => {
  const { role } = req.body;
  if (!['admin', 'student', 'user'].includes(role)) return res.status(400).json({ error: 'Unknown role.' });
  if (String(req.user.id) === String(req.params.id)) return res.status(400).json({ error: 'You cannot change your own role.' });
```
Every route carries its own `requirePermission(…)`; `router.use(requireAuth)`
makes it impossible to add one that is not at least authenticated. The
self-check — "you cannot change your own role" — is the server-side twin of
`isSelf` in `UserProfile.jsx`, and the thing that keeps the one admin role
honest.

```js
async function inTransaction(handler) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await handler(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally { client.release(); }
}
```
Changing a status, writing the audit entry and notifying the student must
succeed or fail *together*. A half-applied approval — published but nobody
told — is worse than a failed one.

#### `controllers/authController.js`

```js
const passwordHash = await bcrypt.hash(password, 10);
const result = await pool.query(
  `INSERT INTO users (name, email, password_hash, student_id, course, year_level, section)
   VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING …`, [ … ]);
```
bcrypt turns the password into a one-way hash; the plain password is never
stored. The `role` column is deliberately absent from the INSERT so it takes
its `'student'` default — registration must never be able to choose a role.

#### `models/schema.sql`

```sql
role VARCHAR(20) NOT NULL DEFAULT 'student'
     CHECK (role IN ('admin', 'student', 'user')),
```
`VARCHAR(20)`: text up to 20 characters. `NOT NULL`: must have a value.
`DEFAULT 'student'`: what it gets when left out. `CHECK (…)`: a rule the
database enforces on every write — a row with any other role is refused
outright, whatever the application tried.

> **Known drift.** The rest of `schema.sql` and `adminRoutes.js` still carry
> the older workflow — ten statuses, a `priority` field, a `feedback` kind, an
> `assigned` status. That is the one piece of work to do in a single pass
> when the API is wired up; see `GUIDE.md`.

---

## Part 4 — Following one submission through the code

The clearest way to see how the files fit is to trace one concern from a
student's phone to "resolved".

**1. The student posts.** On the board, `Header.jsx` calls
`Home.openModal('voice')`. `PostModal` opens with kind pre-set to `concern`.
On submit it checks `moderation.js`, then calls `onSubmit({ kind, category,
title, … })`. `Home.addSubmission` hands that to `store.createPost(…)`.

**2. The store saves it.** `createPost` runs inside `commit()`: read the db,
add the post at the front with `status: 'pending'`, save to localStorage,
message the other tabs, re-draw. No notification to admins — the queue will
show it.

**3. The admin sees it.** `AdminLayout` recounts `counts.pending` from the
same `db`, so the Pending Approval badge reads 1. The dashboard's "Waiting
for review" panel lists it (oldest first). Both link to
`/admin/queue/pending?highlight=<id>`.

**4. The admin decides.** `Submissions` (with `lockedStatuses=AWAITING_REVIEW`)
sees `?highlight=` and opens `SubmissionReview`. The progress line shows
*Submitted* (step 1 of 4, because `kind.needsAssignment` is true). The
"Next step: decide" section offers **Approve**. Clicking it calls
`store.changeStatus(id, 'approved')`, which sets the status, writes the audit
entry (`post_approved`) and the student's notification (`post_approved`) in
one save. The dialog stays open; the line ticks *Submitted* and moves to
*Approved*; the green line says "…in the Open Work queue. Next: assign it…";
the assign form is already below.

**5. The admin assigns.** Still in the dialog, they pick a department
(pre-suggested from the student's course by `collegeForProgram`) and click
**Assign to department**. `store.assignConcern` sets the department and moves
the status to `in_progress` — assigning *is* the work starting — and notifies
the student. The line moves to *Assigned*. The post now appears in Open Work
(built from `ASSIGNABLE_KINDS`) with the department in its column, and on the
Departments page under that college.

**6. The student is told.** `student/Dashboard.jsx` reads the same post:
status badge *In Progress*, "Being handled by: College of …", and the
notifications panel shows "Your concern has been assigned".

**7. The work is done.** From Open Work, the admin opens it; the only primary
button is **Mark resolved**. They write the summary and click.
`store.resolveConcern` sets `resolved`, stamps `resolvedAt`, notifies the
student with the summary. The line reaches *Resolved*; Close becomes the
primary button; the post leaves Open Work; Analytics' "Avg. Resolution Time"
and the department's average both pick it up.

**8. The student reads the outcome.** Their dashboard shows *Resolved* with the
summary; the board card shows the Resolved badge.

Every step above was one function in `store.js`, one screen reading the
result, and no copying of data anywhere.

---

## Part 5 — "Why is it done this way?" — the short answers

- **Why one store file?** So both halves of the site are the same system.
  Two copies of the data drift apart; one copy cannot.
- **Why localStorage?** To run with no server during development and demos.
  It is not for production; the store is the one file to swap.
- **Why are statuses, roles and fields in data files?** So adding one is one
  edit, and every screen picks it up. No screen hard-codes a status name.
- **Why does the review dialog have only one primary button?** It used to
  offer the same move in up to five places, and one of them skipped the rules
  (rejecting without a reason). One next step per stage removes both the
  confusion and the bug.
- **Why does the progress line differ per kind?** A suggestion is never
  assigned, so drawing an "Assigned" step for it would be a step that could
  never be reached — or worse, ticked when it never happened.
- **Why no "new submission" notification for admins?** The Pending Approval
  badge already counts it. Two badges for one event, one of which never
  cleared, was worse than one.
- **Why one admin role?** One office runs this. A second tier only meant a
  second demo account and a message telling the only admin that "only a Super
  Admin" could do something. The self-checks (never your own account) are
  what keep the powers safe.
- **Why is the backend not connected?** It exists so the design has somewhere
  to go. Wiring it — and syncing its older status list first — is the next
  big piece of work, and a deliberate decision rather than a default.
- **Why are the filters in the address bar?** So a filtered view is a link
  you can copy, Back works, and no state has to be threaded through
  components.
- **Why 44px on every button?** It is the smallest control a finger can hit
  reliably (Apple, Google and WCAG all land there). `min-h-[44px]` enforces
  it everywhere.
