# CampusVoiceBox — Code Walkthrough

A plain-English tour of the code, file by file. For each file it answers three
questions: **what is this**, **what is it for**, and **why is it written this
way** — and it names the technical terms as they come up, so you can use the
right word for each thing when you explain it to somebody else.

It covers the files that make up the platform's workflow: the shared data
layer, the login system, the student board, the admin panel, the backend
API behind all of them, and the privacy and consent features. Files that are pure styling or one-off widgets
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
                    │  one copy of what the server  │ ◀──▶  backend/ (Express +
                    │  lets this person see         │       PostgreSQL)
                    └──────────────┬───────────────┘
                                   │  reads & writes
                                   ▼
                    ┌──────────────────────────────┐
   Admins    ─────▶ │  The admin panel  (/admin/…)  │
                    └──────────────────────────────┘
```

Both faces read and write **the same records** through one file,
`services/store.js`. That is the most important design decision in the
project: a student posting and an admin approving are two writes to the same
rows in one database, so nothing has to be "synced" — there is only one copy.

That copy lives on the **server**, in PostgreSQL (`backend/`). The store fetches
everything the signed-in person is allowed to see in one request, keeps it, and
sends every change back to the server — which checks the change is allowed
before saving it. What a browser shows can be edited by whoever is using it;
what the server checks cannot, and that is where every rule that matters is
enforced.

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

Every one of those moves is one request to the server, which writes an
**audit log** entry and a **notification** to the student in the same database
transaction as the change, so neither can be forgotten.

### Who is who

| Role | Lands on | May |
|---|---|---|
| `admin` | `/admin/dashboard` | everything — moderate, assign, resolve, manage users, change roles, export, reset |
| `student` | `/` (the board) | post and vote |
| `user` (staff / visitor without a student number) | `/` (the board) | post and vote |

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
  (`onClick={() => …}`, or the request handed to `change()` in `store.js`).
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
  - **`useSyncExternalStore(subscribe, getSnapshot)`** — read a value kept
    *outside* React (here, the store's copy of the records) and re-draw
    whenever it changes.
- **context** — a way to hand a value (here: the signed-in user) to every
  component below a `<Provider>` without passing it through each one.
- **custom hook** — your own `use…` function built from the built-in hooks
  (`useAuth`, `useStore`, `useApiFile`, `useFittingPlaceholder`).
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

- **`fetch(url, options)`** — send a request to a server and wait for the
  answer. Every request the site makes goes through `services/api.js`.
- **localStorage** — a per-site key/value store of strings that survives
  reloads. `getItem`, `setItem`, `removeItem`. Here it holds one thing: the
  sign-in token.
- **Blob / object URL** — a file's contents held in the browser, and a
  `blob:` address an `<img>` or a link can use to show it.
- **`ResizeObserver`** — be told whenever an element changes size, without
  checking over and over. The search box uses it to pick a placeholder that
  fits.
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
- **HTTP status codes** — 200 OK, 201 created, 204 done/no body, 304 not
  modified (use the copy you have), 400 bad input, 401 not signed in, 403
  forbidden, 404 not found, 409 it changed since you looked, 413 too large,
  429 too many attempts.
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
const STATUSES = {
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
const KINDS = {
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
const ROLES = {
  admin: { key: 'admin', label: 'Admin', permissions: ALL_PERMISSIONS, home: '/admin/dashboard', … },
  student: { …, permissions: [PERMISSIONS.SUBMIT_POSTS, PERMISSIONS.VOTE], home: '/' },
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
  { key: 'email', label: 'Email', type: 'email', adminOnly: true, required: true },
  …
];
export const STUDENT_EDITABLE_FIELDS = ACCOUNT_FIELDS.filter((field) => !field.adminOnly);
```
"Configuration as data": describe the fields once, draw them with `.map`.
`adminOnly` marks the email — a student may see it but not change it.
`required` marks a field that may not be left empty. The server checks every
save against its own copy of this list (`backend/src/models/accountRules.js`),
from either form, along with the email rule (`EMAIL_PATTERN`, also here and
also used by sign-up) and "no other account uses this email".

---

### B. The data layer — `frontend/src/services/store.js` and `services/api.js`

**What they are:** `api.js` sends every request to the server; `store.js`
keeps one copy of the records the server sends, and holds every action that
changes anything.

**What they're for:** both the student board and the admin panel go through
`store.js`, which is what makes them one system — and no screen ever calls the
server itself.

**Structure of `store.js`:** helpers → the copy of the records and how it is
kept up to date → selectors → the actions → the hooks.

Key lines, starting in `api.js`:

```js
const API_URL =
  process.env.REACT_APP_API_URL ||
  (process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:4000/api');
```
Where the server is. `REACT_APP_…` variables are baked in when the site is
built. Left unset, a production build uses `/api` on its own address — the
usual arrangement behind one web server — and development uses the backend's
own port.

```js
async function request(path, options) {
  const response = await send(path, options);
  const data = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data?.error || …, response.status, data ?? {});
  return data;
}
```
Every request ends here. `send()` adds the `Authorization: Bearer <token>`
header when somebody is signed in. A refusal becomes an `ApiError` carrying the
server's own words (`data.error`), its status code, and anything else it said —
a refused sign-up also says which `field` it is about.

```js
export function fileUrl(path) { … URL.createObjectURL(await response.blob()) … }
```
A stored photo or PDF, fetched *with the token* and turned into a `blob:`
address. An `<img src="/api/attachments/12">` could not send the token, and a
pending post's photo is for its author and staff only. Each file is fetched
once and kept.

Now `store.js`:

```js
let db = EMPTY;
let connection = 'loading';
const listeners = new Set();
```
The copy of the records lives here, outside React, as one plain object —
`{ viewerId, users, posts, notifications, audit, auditTotal, privacy, … }` —
exactly what `GET /api/state` answers. `connection` is `'loading'` until the
first answer, then `'ready'` (or `'unreachable'` if the very first request
failed).

```js
async function refresh() {
  const ticket = ++requested;
  …
  answer = await api.state();
  …
  if (ticket <= applied) return true;
  applied = ticket;
  …
  publish({ ...answer, posts: answer.posts.filter((post) => checkFields(post.title, post.message).clean) });
```
Fetch the copy again. Three details:

- **A token the server no longer accepts** (expired, password changed, account
  deleted) answers `401`; the token is forgotten and the copy fetched again as a
  visitor — the person is simply signed out.
- **The tickets.** Requests can overtake each other; an answer older than the
  last one used is thrown away, so the screen never steps back.
- **The rudeness filter runs again on the way in,** so a word added to the list
  later still keeps older posts off the screen.

```js
const POLL_MS = 15000;
…
setInterval(refreshQuietly, POLL_MS);
window.addEventListener('focus', refreshQuietly);
document.addEventListener('visibilitychange', refreshQuietly);
```
Keeping up: every 15 seconds while the tab is in view, and at once when it
comes back into view. A tab nobody is looking at asks nothing. The server
answers an unchanged copy with `304 Not Modified`, so a quiet poll costs next
to nothing.

```js
export function findUser(data, userId) {
  return data.users.find((user) => user.id === userId) ?? null;
}
```
A **selector**: a plain function that answers a question about the data. The
screens call these rather than digging through `db` themselves.

```js
export function authorLabel(post, viewer) {
  if (!post.anonymous) return post.authorName ?? 'Deleted account';
  if (can(viewer, PERMISSIONS.VIEW_IDENTITY)) return `Anonymous · ${post.authorName ?? 'Deleted account'}`;
  return 'Anonymous student';
}
```
The name printed on a card. For a student the server never sent the name
behind an anonymous post at all, so `post.authorName` is `null` there — the
check here only decides how an administrator's view reads.

```js
export function platformStats(data) {
  …
  return {
    totalUsers: data.users.length,
    pendingPosts: byStatus(AWAITING_REVIEW),
    openWork: data.posts.filter(isOpenWork).length,
    unassignedPosts: needsAssigning(data).length,
    totalVotes: data.posts.reduce((sum, post) => sum + post.votes, 0),
    …
```
Every number a card could want, counted in one pass from the copy. The little
helpers (`byStatus`, `byGroup`) are closures defined inside the function so the
counting reads as English. `isOpenWork` (`data/workflow.js`) is the one rule for
"open work", shared by this count, the sidebar badge and the dashboard list.

```js
async function change(request) {
  try {
    const answer = await request();
    await refresh();
    return answer ?? {};
  } catch (problem) {
    await refresh();
    return { error: problem.message };
  }
}
```
**Every change goes through here.** `request` sends it; once the server has
accepted it, the copy is fetched again, so the new status, the audit entry and
the student's notification are all on screen by the time the button's handler
carries on. A refusal comes back as `{ error }` — the server's explanation —
which the screen shows. Returning rather than throwing is the convention for
"expected" failures.

```js
const actions = {
  createPost: (fields) => change(() => api.createPost(fields)),
  changeStatus: (postId, status, { reason = '' } = {}) =>
    change(() => api.admin.setPostStatus(postId, status, reason)),
  assignConcern: (postId, { department, assignedTo }) =>
    change(() => api.admin.assign(postId, department, assignedTo)),
  …
```
The actions — the complete list of things the website can change. Each is one
request. The rules (who may, which moves are legal, what the student is told)
are the server's; see `routes/admin/` in section F.

```js
function toggleVote(postId) {
  applied = requested;
  lastAnswer = '';
  publish({ ...db, posts: db.posts.map((post) => post.id === postId
    ? { ...post, hasVoted: !post.hasVoted, votes: post.votes + (post.hasVoted ? -1 : 1) }
    : post) });
  return change(() => api.toggleVote(postId));
}
```
The one action that shows its result *before* the server answers, because a
vote button that waits feels broken. The server's answer then confirms it — or
puts it back if it was refused.

```js
export function useStore() {
  const data = useSyncExternalStore(subscribe, getDb);
  return useMemo(() => ({ db: data, ...actions }), [data]);
}
```
**The hook.** `useSyncExternalStore` hands every component the same copy and
re-draws them all together when a new one is published. `{ db, ...actions }`
spreads the actions next to the data, so a screen can write `store.db.posts`
and `store.changeStatus(…)` from the same object.

---

### C. Who is signed in — auth and routing

#### `context/AuthContext.jsx`

**What it is:** the "who is logged in" context, plus `login`, `signup`,
`logout` and `can`.

**What it's for:** every screen can ask `useAuth()` for the current user
without the answer being passed down through each component by hand.

```js
export function AuthProvider({ children }) {
  const store = useStore();
  const connection = useConnection();
  const user = useMemo(() => findUser(store.db, store.db.viewerId), [store.db]);
```
Who is signed in is whatever the server says: the copy of the records carries
the signed-in account's id (`viewerId`) along with everything else, re-read
every few seconds. So when an admin suspends somebody, changes their role or
resets their password, it takes effect for that person straight away.

```js
  useEffect(() => {
    if (connection !== 'loading') hideSplash();
  }, [connection]);
  …
  if (connection === 'loading') return null;
  if (connection === 'unreachable') return <ServerUnavailable />;
```
The loading screen stays up until the server has answered once, so the first
screen drawn already knows who is signed in — otherwise reloading an admin page
would flash the log-in page. If the server cannot be reached at all, the app
says so, with a *Try again* button.

```js
      signup: (details) => startSession(store.register(details)),
      login: (credentials) => startSession(store.authenticate(credentials)),
      logout: async () => { setSignedOut(true); forgetWave(); await store.signOut(); },
```
Signing up and in answer `{ error }` or `{}`. Nothing needs sending anywhere
afterwards: once `user` is set, the `/login` and `/signup` routes forward the
person themselves. `signedOut` remembers that somebody left *on purpose*, so the
guards send them to the board rather than to the log-in page.

```js
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
| `RequireAuth` | anyone signed in | → `/login`, remembering where they were going (or the board, just after "Log out") |
| `RequirePermission` | signed in **and** holding the permission | → their own home page |
| `RedirectIfSignedIn` | signed out (for `/login`, `/signup`) | → where they were going, or their home page |
| `RedirectIfAdmin` | non-admins | admins → `to=` (their account page in the panel) |

```js
function SignInFirst() {
  const { signedOut } = useAuth();
  const location = useLocation();
  if (signedOut) return <Navigate to="/" replace />;
  return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
}
```
Rendering `<Navigate>` *is* the redirect. `state={{ from }}` travels with it,
invisibly, so `/login` can send the person on afterwards — `RedirectIfSignedIn`
reads it the moment the account is confirmed. Somebody signed in but not
allowed is sent home rather than shown a locked door — announcing "an admin
area exists" tells a stranger more than they need.

These guards decide what the app *draws*. They run in the visitor's browser
and are not security; the server checks again on every request (see
`middleware/auth.js`).

#### `App.js`

**What it is:** the routing table for the whole platform.

```jsx
<AuthProvider>
  <BrowserRouter …>
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
      </Route>
```
The board at `/`, inside the student site's frame — open to everybody, the
administrator included: they can read, post and vote like anyone else.
**View site** in the admin panel's top bar brings them here.

```jsx
      <Route element={<RequireAuth />}>
        <Route path="/student/dashboard" element={<StudentDashboard />} />
        <Route path="/account" element={<RedirectIfAdmin to="/admin/profile"><Account /></RedirectIfAdmin>} />
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
box, and either the auth buttons or the "Hi, Juan" greeting and the profile
circle.

```jsx
<div className="flex items-center gap-2 sm:gap-4">
  <Link to="/" className="flex min-h-[44px] min-w-[44px] shrink-0 items-center" aria-label="CampusVoiceBox home">
    <span className="hidden sm:block"><Logo tone="light" showSeal /></span>
    <span className="sm:hidden"><Logo tone="light" showSeal showText={false} /></span>
  </Link>
  <div className={`flex-1 sm:max-w-2xl ${user ? 'min-w-[7.5rem] md:min-w-[13rem]' : 'min-w-0'}`}>
    <SearchBar />
  </div>
  <div className={`ml-auto flex items-center gap-1.5 sm:gap-2 ${user ? 'min-w-0' : 'shrink-0'}`}>
    {user ? (
      <div className="flex min-w-0 items-center gap-1 md:gap-4"><NavGreeting /><ProfileMenu /></div>
    ) : (
      <>…Log in… <Link to="/signup" className="hidden min-[375px]:block">…Sign up…</Link></>
    )}
  </div>
</div>
```
One flex row at every width. The logo never shrinks; the search box takes
what is left (`flex-1`); the right-hand end is pushed right (`ml-auto`). Both
logo versions carry the school seal (`showSeal`); on phones only the wordmark
is dropped (`sm:hidden` / `hidden sm:block` swap the two versions). The marks
shrink from 36px to 32px on phones and the buttons lose 4px of padding
(`!px-2.5 sm:!px-3.5`).

Who gives way when the row is full depends on who is signed in:

- **Signed out**, the buttons never shrink (`shrink-0`) and the search box may
  (`min-w-0`). Below 375px "Sign up" is hidden, because the two buttons left
  the search box no room to type on a 320px screen; the log-in page links to
  sign-up.
- **Signed in**, the search box keeps a minimum width — 120px below `md`, 208px
  from `md` up, matching the dropdown's own width in `SearchBar.jsx` — and the
  greeting's name gives way instead (`min-w-0`, cut short with "…", see
  `NavGreeting.jsx`).

#### `components/SearchBar.jsx`

**What it is:** the category dropdown and the search field, as one control.

**Why the address bar:** both write to `?category=` and `?q=` rather than
React state, so the board can read them from anywhere, Back works, and a
filtered view can be shared as a link.

```js
const { searchParams, setFilter } = useFilterParams({ alsoClear: ['mine'] });
const category = searchParams.get('category') ?? '';
…
<select onChange={(event) => setFilter('category', event.target.value)}>
```
`useFilterParams` (`hooks/useFilterParams.js`) is the one way every filter
in the app changes the address — this box, the board's sort, and the admin
lists. `setFilter` copies the current params, changes one (an empty value
removes it), and writes them back with `replace: true`, so typing a search
does not add a history entry per letter. `alsoClear: ['mine']` means
searching always searches the whole board, not just the student's own
posts.

```jsx
<div className="relative shrink-0 border-r border-slate-200">
  <span aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center text-navy-700 md:hidden">
    <svg …filter icon…/>
    {category && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-mustard ring-2 ring-white" />}
  </span>
  <select … className="w-11 md:w-32 … opacity-0 md:opacity-100">
```
Below `md` (768px) the dropdown is an icon: the real `<select>` is still
there, 44px wide at zero opacity, laid over a filter icon. A tap on the icon
is a tap on the select, so the device's own picker opens with every label at
full size. `pointer-events-none` on the icon lets the tap through; the
mustard dot says a category is applied. From `md` up the select shows its own
text. The icon lasts past phones on purpose: from 640px the wordmark returns
beside the logo, and a 128px dropdown on top of it left the field about 15px
to type in.

```js
function useFittingPlaceholder(ref) {
  const [placeholder, setPlaceholder] = useState(FULL_PROMPT);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const room = entry.contentRect.width;
      setPlaceholder(room >= 160 ? 'Search suggestions...' : room >= 60 ? 'Search' : '');
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);
  return placeholder;
}
```
A custom hook that measures the search field and picks the longest prompt
that fits: the full "Search suggestions..." (140px of text) on a wide field,
"Search" (45px) on a phone, and nothing at all where even that would be cut
off - the magnifying glass says "search" on its own. It measures the field
itself, not the screen, because the field's width also depends on what else
shares the navbar: the profile circle leaves more room than the two Log in /
Sign up buttons. **ResizeObserver** is the browser feature that reports when
an element changes size; `contentRect.width` is the room inside the padding.
The cut-offs (160 and 60) are the words' widths plus about 12px that Chrome
and Safari keep free for the search box's clear (×) button, even while it is
hidden, and a little slack for other platforms' slightly wider fonts.

#### `components/ProfileMenu.jsx`

**What it is:** the profile circle at the right of the navbar and its
drop-down: who is signed in, links to the dashboard / account / admin panel,
"Your Suggestions" and "Your Voice Outs", and Log out. (The categories are
not repeated here — the search box's dropdown already offers them.)

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

```jsx
function myPostsLink(group) {
  return `/?mine=${group}`;
}
…
<Link to={myPostsLink('concern')} role="menuitem">Your Voice Outs</Link>
```
These are links, not buttons, so they work from any page: they always land
on the board with the filter set, and the board scrolls down to the results
once it is on screen. "Your Voice Outs" is `?mine=concern` — the concern *family* from
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
setSending(true);
const result = await onSubmit({ kind, category, title: trimmedTitle, message: trimmedMessage, anonymous, attachments: … });
setSending(false);
if (result.error) { setError(result.error); return; }
onClose();
```
Nothing is sent until it passes the rudeness filter in
`services/moderation.js` (the server runs the same filter again). The finished
post is handed to whoever opened the modal via the `onSubmit` callback — the
modal does not know about the store — and the modal *waits for the answer*:
only a post the server accepted closes it. A refusal, or no connection, keeps it
open with the reason, so nothing the student typed is lost.

The pop-up itself — the dark backdrop, Escape, the page behind not scrolling,
the ✕ — is `components/PopupFrame.jsx`, the one frame the post form, the "are
you sure?" box (`ConfirmDialog`) and the admin dialogs (`admin/Modal.jsx`) all
sit in. Each keeps its own look; only the behaviour is shared, so the three
cannot drift apart.

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

The photos and PDFs on a card are drawn by `components/AttachmentList.jsx`
(the review dialog uses it too): each file is fetched from the server on its
own (`hooks/useApiFile.js`), a photo as a square thumbnail and anything else as
its file name, and a click opens it full size in a new tab.

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
  if (!can(PERMISSIONS.SUBMIT_POSTS)) { setError('Your account is suspended, so posting is turned off.'); return; }
  setModalMode(mode);
}
```
Posting requires an account, so guests are sent to log in — and a suspended
account is told why, rather than handed a form the server would refuse.

```jsx
<SuggestionCard … votes={post.votes} hasVoted={post.hasVoted} … />
```
The server sends each post's vote *count* and whether *this* person voted —
never who else did.

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
async function handleSubmit(event) {
  event.preventDefault();
  …
  setBusy(true);
  const result = await login({ email: form.email.trim(), password: form.password });
  if (!result.error) return;
  setBusy(false);
  setError(result.error);
}
```
`preventDefault` stops the browser reloading the page on submit. The form waits
for the server, with the button showing it is busy. On success it does nothing
more: `RedirectIfSignedIn`, around this route, sends the person where they were
heading (`from`) the moment the account is confirmed.

The sign-up form never chooses a role — the server decides it. Signing up is
for students and users only: `register()` in
`backend/src/controllers/authController.js` makes a student account (with a
student number) or a user account (without), never an administrator:

```js
await client.query('SELECT pg_advisory_xact_lock(470700)');
…
const role = values.student_id ? 'student' : 'user';
```
The lock makes sign-ups take turns, so two people registering at the same
moment cannot both claim one email. The administrator is the default account:
when the server starts and the database has none, `ensureDefaultAdmin()` in
`backend/src/config/defaultAdmin.js` creates it from `ADMIN_NAME`,
`ADMIN_EMAIL` and `ADMIN_PASSWORD` — under the same lock — and logs it as
*Became the first administrator*. An admin is only ever made after that by an
admin, from the user profile.

#### `pages/ForgotPassword.jsx` and `pages/ResetPassword.jsx`

**What they are:** a forgotten password, reset by its owner with an emailed
link — reached from "Forgot password?" under the log-in form. Nobody else ever
sets anybody's password.

```js
const result = await store.requestPasswordReset(email.trim());
```
The server answers the same whether or not the email has an account ("if it
does, a link is on its way"), and sends the email only after answering, so
neither the words nor the time taken tell anybody who has an account
(`forgotPassword` in `backend/src/controllers/authController.js`). The email
goes out through the school's mail server (`backend/src/config/mail.js`);
while developing without one, it is printed in the server's console instead.

```js
const fromLink = () => new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '';
```
The link is `/reset-password#token=…`. The part after `#` is never sent to a
server, so the secret stays out of every web server's log; the page reads it
once and takes it off the address bar. The server keeps only a SHA-256 of it,
lets it work once within an hour, then signs the account out everywhere.

#### `components/ChangePasswordForm.jsx`

**What it is:** changing a password you know, signed in — on the student's
account page and on an administrator's own profile.

```js
const result = await store.changeOwnPassword(passwords.current, passwords.next);
```
The current password is still asked for: a session left open on a shared
computer must not be enough to take an account over. The server signs out
every other device and answers with a new token, which `changeOwnPassword` in
`services/store.js` stores — so the person stays signed in here.

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
editable — and the server ignores an email sent from this form anyway
(`PATCH /api/account` accepts the name and school details only). The profile
photo is saved on its own, with `PUT /api/account/photo`, and the password
in its own panel below the form (`components/ChangePasswordForm.jsx`). The
school fields are greyed out until the
person allows CampusVoiceBox to keep them, in the *Privacy & Data* panel at
the foot of the page — see [section G](#g-privacy-consent-and-the-policies).

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
  openWork: db.posts.filter(isOpenWork).length,
  unread: unreadCountFor(db, user),
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
async function run(action, done) {
  if (busy) return false;
  setBusy(true);
  const result = await action();
  setBusy(false);
  if (result.error) { setError(result.error); return false; }
  setError('');
  setJustDid(done);
  setReassigning(false);
  setResolvingUnassigned(false);
  return true;
}
```
Every action funnels through here. `busy` means a double-click cannot send the
same move twice. On success the dialog **stays open**: the page re-reads `post`
from the store's fresh copy, so the progress line and the next-step section
redraw for the new status, and `justDid` says what just happened. On a refusal
— another admin got there first, say — the server's reason is shown and the
dialog shows the submission as it now stands.
It used to close on every click, which meant an approved concern vanished
from the queue and had to be found again elsewhere before it could be
assigned.

```js
async function handleReject() {
  if (!reason.trim()) { setError('Please give a reason. …'); return; }
  const rejected = await run(() => store.changeStatus(post.id, 'rejected', { reason: reason.trim() }), 'Rejected. …');
  if (rejected) setReason('');
}
```
A rejection with no reason is the thing students complain about most, so the
form insists on one — and so does the server. This is the *only* reject button
— the old progress line had a second one that skipped the reason. The reason is
kept if the rejection did not go through, so it need not be retyped.

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
role. (The server refuses all three as well.) Nobody's password is set from
here — on your own profile, the *Password* panel changes yours.

```js
const confirmCopy = {
  suspend: { title: `Suspend ${account.name}?`, … },
  activate: { … },
  delete: { … },
}[confirming];
```
An object used as a lookup table: one `ConfirmDialog`, three sets of wording,
picked by which string is in `confirming`. Every change on the page goes
through one `act()` helper — one request at a time, the server's reason shown
if it refuses.

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
where each is defined, with a note on where the records are kept and what
actually protects them.

It was called "Settings", which promised something it does not offer: there
is nothing here to set. Everything drawn is `.map` over a list imported from
`data/`, so the page cannot disagree with the rest of the app.

---

### F. The backend — `backend/src/`

The server everything is checked and kept on: Express for the requests,
PostgreSQL for the records.

#### `middleware/auth.js`

```js
const ROLE_PERMISSIONS = {
  admin: ['view_admin', 'moderate_posts', 'manage_concerns', 'view_identity', 'manage_users',
          'delete_users', 'manage_admins', 'view_analytics', 'view_audit_log',
          'submit_posts', 'vote'],
  student: ['submit_posts', 'vote'],
  user: ['submit_posts', 'vote'],
};
```
The server's copy of `roles.js` — the same eleven permissions. This copy is the
one that actually counts: the frontend's guards decide what to *draw*; this
decides what the API will *do*.

```js
async function accountFor(payload) {
  const { rows } = await pool.query(
    'SELECT id, name, email, role, status, password_changed_at FROM users WHERE id = $1', [payload.sub]);
  const account = rows[0];
  if (!account) return null;
  if (account.password_changed_at) {
    const changedAt = Math.floor(new Date(account.password_changed_at).getTime() / 1000);
    if (payload.iat < changedAt) return null;
  }
  return account;
}
```
The account a token stands for, read fresh on **every** request rather than
trusted from the token — a token issued an hour ago would still say "admin"
after the account was demoted. A token for a deleted account, or one issued
before the password last changed (`iat` is when it was issued, in seconds), is
refused: that is what makes a password reset lock out whoever held the old
password. `$1` is a parameterised placeholder: the id is supplied separately,
never pasted into the SQL.

```js
function requirePermission(permission) {
  return function check(req, res, next) {
    if (req.user.status === 'suspended') return res.status(403).json({ error: 'This account has been suspended.' });
    if (!can(req.user, permission)) return res.status(404).json({ error: 'Not found.' });
    next();
  };
}
```
Goes after `requireAuth`, which has just read the account. An unauthorised
caller gets 404, not 403 — telling them the endpoint exists is more than they
need to know.

#### `controllers/stateController.js`

```js
const isAdmin = can(viewer, 'view_admin');
…
`SELECT p.*, u.name AS author_name, … FROM posts p LEFT JOIN users u ON u.id = p.author_id
  WHERE $1::boolean OR p.author_id = $2 OR p.status = ANY($3)`
…
authorId: isAdmin || own ? str(row.author_id) || null : null,
authorName: !row.is_anonymous || seesIdentity || own ? row.author_name : null,
```
`GET /api/state` — everything one person may see, in one answer. An
administrator gets every post; anybody else the published ones and their own.
And this is where anonymity is kept: the name behind an anonymous post is only
put into the answer for somebody with `view_identity`, or for the author. To
everybody else it simply is not there.

#### `routes/admin/` — the admin API

```js
// index.js
router.use(requireAuth);
router.use(usersRoutes); // /users/:id - details, status, role, deletion
router.use(postsRoutes); // /posts/:id - status, assign, resolve, notes
…
```
One file per area — `users.js`, `posts.js`, `privacyRequests.js`,
`activityLogs.js`, with `helpers.js` for what two of them share — all mounted
by `index.js` behind one `router.use(requireAuth)`, so a route cannot be added
to any of them without at least being authenticated.

```js
// posts.js
router.patch('/posts/:id/status', requirePermission('moderate_posts'), async (req, res, next) => {
  …
  const result = await inTransaction(async (client) => {
    const post = await lockPost(client, id);
    if (!post) return { status: 404, error: MISSING_POST };
    if (!STATUSES[post.status].next.includes(status)) {
      return { status: 409, error: cannotMove(post, `moved to ${STATUSES[status].label}`) };
    }
    await client.query('UPDATE posts SET status = $1, rejection_reason = $2, updated_at = now() WHERE id = $3', …);
    await logAs(client, req.user, action, { targetType: 'post', targetId: post.id, details, req });
    await notifyAuthor(client, post, notice.type, notice);
```
Every route carries its own `requirePermission(…)`. Then, in one transaction:
hold the row (`FOR UPDATE`, so two admins acting at once take turns), refuse a
move the workflow does not allow — the same `next` lists the review dialog
draws its buttons from (`models/workflow.js`) — make the change, write the
audit entry, tell the student. All of it, or none.

`logAs()` (`models/activityLog.js`) is how every audit entry is written, here
and in the controllers: it copies who did it — id, name, role — from their
account, and the address from the request, in one place, so no handler can
record half an entry.

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
told — is worse than a failed one. It lives in `models/transaction.js`.

The self-checks — no changing your own role or status, no deleting yourself
(`users.js`), no handling a privacy request about your own account
(`privacyRequests.js`) — are here too, as the server-side twin of `isSelf` in
`UserProfile.jsx`, and the thing that keeps the one admin role honest.

#### `controllers/authController.js`

```js
const passwordHash = await bcrypt.hash(req.body.password, 10);
…
const role = values.student_id ? 'student' : 'user';
```
bcrypt turns the password into a one-way hash; the plain password is never
stored. The role is decided here and nowhere else — registration can never
choose one. A wrong email and a wrong password get the same message, and take
the same time to answer (the password is checked against a dummy hash when no
account matches), so the log-in form cannot be used to find out which emails
have accounts.

#### `controllers/suggestionsController.js`

```js
if (!checkFields(title, message).clean) {
  return res.status(400).json({ error: rejectionMessage() });
}
…
const { files, error } = readAttachments(req.body.attachments);
```
Posting checks everything the form checked, again — the lengths, the type, the
category, the rudeness filter (`models/moderation.js`, the same code as the
website's) — because a request sent without the form skips the form. Each file
must be a photo or a PDF within its size limit, and its first bytes must really
be that kind of file (`models/files.js`); then the post and its files are
written in one transaction.

#### `models/schema.sql`

```sql
role VARCHAR(20) NOT NULL DEFAULT 'student'
     CHECK (role IN ('admin', 'student', 'user')),
```
`VARCHAR(20)`: text up to 20 characters. `NOT NULL`: must have a value.
`DEFAULT 'student'`: what it gets when left out. `CHECK (…)`: a rule the
database enforces on every write — a row with any other role is refused
outright, whatever the application tried. The statuses and kinds are checked
the same way, against exactly the six statuses and five kinds the website uses.

#### `test/api.test.js` and `scripts/check-shared-lists.mjs` — the checks

```js
test('an administrator reviewing', async (t) => {
  await t.test('approving publishes it, tells the author and is logged', async () => {
    const { status } = await call('PATCH', `/admin/posts/${concernId}/status`, { token: admin.token, body: { status: 'approved' } });
    assert.equal(status, 204);
    …
```
The API tests start the real server on a free port, against a real database,
and send it what the website would: HTTP requests with JSON. They run top to
bottom as one story — sign up, post, review, vote, reset a password, handle a
privacy request, manage accounts — checking each answer, and reading the
activity log rows straight from the database to check who each entry names.
The run wipes its database first, so it refuses one whose name does not end in
`_test`.

`check-shared-lists.mjs` loads the website's copy and the server's copy of
every list kept on both sides (SYSTEM-ARCHITECTURE.md section 11)
and fails if any two differ — the two rudeness filters are run on the same
inputs, so a change to one filter's code is caught as well as a change to its
words. CI runs both on every push.

### G. Privacy, consent and the policies

#### `services/consent.js`

**What it is:** the one list of everything the site keeps in the browser, and
the person's answer about it.

```js
export const STORAGE_ITEMS = [
  { name: STORAGE_KEYS.token, category: 'necessary', where: 'Local storage', … },
  { name: STORAGE_KEYS.consent, category: 'necessary', … },
  { name: STORAGE_KEYS.greetingWaved, category: 'functional', …,
    clear: () => sessionStorage.removeItem(STORAGE_KEYS.greetingWaved) },
];
```
A **registry**: the code that writes an item takes its name from
`STORAGE_KEYS`, and the Cookie Policy's table is drawn from `STORAGE_ITEMS`
(`pages/legal/CookiePolicy.jsx`) — so the policy cannot describe storage that
does not exist, or miss storage that does. There are no cookies.

```js
export function isAllowed(category) {
  if (category === 'necessary') return true;
  return snapshot.choice?.categories?.[category] === true;
}
```
Anything optional asks `isAllowed()` before writing (`services/greeting.js`
does). `removeRefused()` runs when the file loads and after every choice, and
calls each refused item's `clear` — so saying no *deletes*, it does not just
stop new writes. A choice is stored with `COOKIE_CONSENT_VERSION`; a choice
for any other version counts as no choice at all, so changing what a category
covers asks everybody again.

#### `components/CookieConsent.jsx`

**What it is:** the banner on a first visit and the settings window, drawn once
for the whole site in `App.js`, beside `<Routes>` — so it appears on the log-in
pages and in the admin panel too.

```js
async function decide(categories) {
  const made = saveChoice(categories);
  closeCookieSettings();
  if (!user) return;
  const result = await store.saveCookieConsent(made);
  …
}
```
The choice applies on this device at once; if somebody is signed in it is also
saved with their account (`PUT /api/account/cookie-consent`). Logging in on a
device with no choice — or an older one — takes the account's. A choice made
while signed *out* is never copied onto the next person's account: on a shared
computer, that would be somebody else's answer. *Accept All* and *Reject
Optional* are the same size and colour on purpose — neither is dressed up as
the right answer.

#### `data/policies.js` and `components/PolicyPage.jsx`

**What they are:** the policies' versions, the facts only the school can
supply, and the frame the three policy pages share.

```js
export const ORGANIZATION = {
  dpoEmail: { value: null, describe: 'the Data Protection Officer\'s email address' },
  …
};
```
```jsx
<ToConfirm fact="dpoEmail" />
```
A fact that is still `null` is drawn as a highlighted *[To be confirmed: …]*;
fill in `value` and the real text appears everywhere it is used. Legal
questions are wrapped in `<ForReview>`. While any fact is unconfirmed, every
policy says at the top that it is a draft. The versions are dates and exist
twice — here and in `backend/src/models/policies.js` — because the server
must only accept the current ones.

#### `pages/Signup.jsx` — the two tick boxes

```js
schoolConsent: false,
acceptTerms: false,
…
termsVersion: POLICY_VERSIONS.terms,
privacyVersion: POLICY_VERSIONS.privacy,
```
Both boxes start unticked — only the person ticks them. School details have
their own box, separate from the Terms, because agreeing to the rules is not
agreeing to share more information. The versions the page showed are sent
with the account; the server refuses old ones (`409`, "reload"), so nobody
accepts text they were never shown. A refusal carries `field: 'email'` when it
is about the email, so the message lands beside the right box.

#### `components/TermsGate.jsx`

**What it is:** the "please accept the Terms" dialog, for an account whose
accepted Terms are older than the version it now needs.

```js
useEffect(() => {
  const bringBack = () => setPutOff(false);
  window.addEventListener(TERMS_REQUIRED_EVENT, bringBack);
  …
}, []);
```
It can be put off with *Not now* — reading is never blocked. But the **server**
refuses posts and votes until the Terms are accepted
(`backend/src/middleware/terms.js`, `403` with `mustAcceptTerms`), and
`change()` in `store.js` turns that answer into `TERMS_REQUIRED_EVENT`, which
brings the dialog back. An account holding school details from before consent
was asked gets a second, unticked box: leave it, and accepting removes them.

#### `components/PrivacyData.jsx`

**What it is:** the *Privacy & Data* panel on `/account` — and on an
administrator's own profile, since `/account` forwards admins there.

Every part is one server call on the signed-in person's own account: allowing
or withdrawing school-details consent (`PUT /api/account/school-consent`),
opening the cookie window, *Download my data* (`GET /api/account/export`, saved
with `saveFile` from `services/csv.js`), and privacy requests
(`POST /api/privacy-requests`). `Account.jsx` greys out the school fields and
leaves them out of the save until consent is given:

```js
STUDENT_EDITABLE_FIELDS.filter((field) => schoolAllowed || !field.school)
```

#### `pages/admin/PrivacyRequests.jsx`

**What it is:** handling those requests, behind `manage_privacy` — kept apart
from the submission queues, because a deletion request is not moderation.

```js
const isOwn = request.userId === user.id;
…
{isOpen && !isOwn && ( /* the reply box and the buttons */ )}
```
A request about the signed-in admin's own account is shown but cannot be
acted on — another administrator must, so nobody is the only witness to what
was done with their own data. The server refuses it too. Completing a
deletion request deletes the account in the same step, keeping or deleting
the person's submissions as chosen, and asks first.

#### Backend: `controllers/privacyController.js`, `middleware/terms.js`, `models/policies.js`

```js
if (req.body.acceptTerms !== true) {
  return res.status(400).json({ error: 'Please accept the Terms & Conditions to create your account.' });
}
```
`=== true`, not "truthy": the text `"true"` is not acceptance. Every privacy
route acts on `req.user` — never on an id from the request — so nobody can see
or change another person's choices. What was agreed to goes into
`policy_acceptances` in the same transaction as the change it records; the
privacy log (`privacy_events`) is insert-only, like the activity log, and
records no network address. `schoolDetailsRefused()` in
`models/accountRules.js` is the one rule for school details, used by sign-up,
the account page and the admin's edit alike.

---

## Part 4 — Following one submission through the code

The clearest way to see how the files fit is to trace one concern from a
student's phone to "resolved".

**1. The student posts.** On the board, `Header.jsx` calls
`Home.openModal('voice')`. `PostModal` opens with kind pre-set to `concern`.
On submit it checks `moderation.js`, then calls `onSubmit({ kind, category,
title, … })` and waits. `Home.addSubmission` hands that to
`store.createPost(…)`, which sends `POST /api/posts`.

**2. The server saves it.** `createPost` in `suggestionsController.js` checks
it all again — the filter, the files — and inserts the post with the column's
default `status: 'pending'`, and its files, in one transaction. No
notification to admins — the queue will show it. The store fetches
`/api/state` again; the form closes and the board says the post is waiting for
review.

**3. The admin sees it.** Within 15 seconds the admin panel's own copy is
fetched again. `AdminLayout` recounts `counts.pending` from it, so the Pending
Approval badge reads 1. The dashboard's "Waiting for review" panel lists it
(oldest first). Both link to `/admin/queue/pending?highlight=<id>`.

**4. The admin decides.** `Submissions` (with `lockedStatuses=AWAITING_REVIEW`)
sees `?highlight=` and opens `SubmissionReview`. The progress line shows
*Submitted* (step 1 of 4, because `kind.needsAssignment` is true). The
"Next step: decide" section offers **Approve**. Clicking it calls
`store.changeStatus(id, 'approved')` → `PATCH /api/admin/posts/:id/status`,
which checks the move is allowed, sets the status, writes the audit entry
(`post_approved`) and the student's notification (`post_approved`) in one
transaction. The dialog stays open; the line ticks *Submitted* and moves to
*Approved*; the green line says "…in the Open Work queue. Next: assign it…";
the assign form is already below.

**5. The admin assigns.** Still in the dialog, they pick a department
(pre-suggested from the student's course by `collegeForProgram`) and click
**Assign to department**. `PATCH …/assign` sets the department and moves the
status to `in_progress` — assigning *is* the work starting — and notifies the
student. The line moves to *Assigned*. The post now appears in Open Work
(built from `ASSIGNABLE_KINDS`) with the department in its column, and on the
Departments page under that college.

**6. The student is told.** `student/Dashboard.jsx` reads the same post from
the student's own copy: status badge *In Progress*, "Being handled by: College
of …", and the notifications panel shows "Your concern has been assigned".

**7. The work is done.** From Open Work, the admin opens it; the only primary
button is **Mark resolved**. They write the summary and click.
`PATCH …/resolve` sets `resolved`, stamps `resolved_at`, notifies the student
with the summary. The line reaches *Resolved*; Close becomes the primary
button; the post leaves Open Work; Analytics' "Avg. Resolution Time" and the
department's average both pick it up.

**8. The student reads the outcome.** Their dashboard shows *Resolved* with the
summary; the board card shows the Resolved badge.

Every step above was one action in `store.js`, one request the server checked
and recorded, and one screen reading the result — no copying of data anywhere.

---

## Part 5 — "Why is it done this way?" — the short answers

- **Why one store file?** So both halves of the site are the same system.
  Two copies of the data drift apart; one copy cannot.
- **Why fetch everything in one request?** So every screen reads one
  consistent copy, and the server decides — in one place — what each person may
  see. An unchanged answer costs next to nothing (`304`).
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
  second admin account and a message telling the only admin that "only a Super
  Admin" could do something. The self-checks (never your own account) are
  what keep the powers safe.
- **Why do some lists exist on both sides?** The website needs them to draw
  its screens, and the server must not trust the website's copy. Each file
  names its twin; see section 11 of `SYSTEM-ARCHITECTURE.md`.
- **Why are the filters in the address bar?** So a filtered view is a link
  you can copy, Back works, and no state has to be threaded through
  components.
- **Why is the cookie choice not copied to the account when you log in?**
  A choice made on a shared computer before logging in may be the last
  visitor's. Only a choice the person makes while signed in is saved to their
  account.
- **Why are school details a separate tick, not part of the Terms?** Agreeing
  to the rules is not agreeing to share more information. Bundling them would
  make the extra data a condition of having an account.
- **Why can a person not cancel a request once it is being handled?** Somebody
  may already have acted on it. Cancelling is for a request nobody has touched.
- **Why 44px on every button?** It is the smallest control a finger can hit
  reliably (Apple, Google and WCAG all land there). `min-h-[44px]` enforces
  it everywhere.
