import { useMemo, useSyncExternalStore } from 'react';
import { checkFields } from './moderation.js';
import { PERMISSIONS, can } from '../data/roles.js';
import {
  AWAITING_REVIEW,
  CLOSED_STATUSES,
  OPEN_STATUSES,
  PUBLIC_STATUSES,
  isOpenWork,
  kindInfo,
} from '../data/workflow.js';
import { api, forgetFiles, isTokenKey, readToken, writeToken } from './api.js';
import { POLICY_VERSIONS } from '../data/policies.js';

/*
 * THE SHARED DATA LAYER
 *
 * One store. The student board and the admin panel both read and write through
 * this file, which is what makes them the same system rather than two
 * applications that happen to look alike:
 *
 *     Student site  ──┐                ┌──  Admin panel
 *                     ├──  store.js  ──┤
 *     useStore()    ──┘                └──  useStore()
 *                            │
 *                     the server (services/api.js)
 *
 * WHERE THE DATA LIVES
 * On the server, in its database. This file holds one copy of everything the
 * signed-in person is allowed to see - fetched in one request from
 * GET /api/state - and every screen reads that copy. A change (approve, vote,
 * post) is sent to the server, which checks it, saves it, writes the audit
 * entry and notifies the student; then the copy is fetched again, so the
 * screen shows exactly what the server now holds.
 *
 * The copy is also fetched every few seconds, and whenever the tab comes back
 * into view, so an approval made by one administrator reaches the student's
 * board - and the other administrators' queues - without anybody reloading.
 *
 * WHAT THE COPY HOLDS IS THE SERVER'S DECISION, not this file's. A student's
 * copy has no other accounts in it, no internal notes, no activity log, and
 * no name behind an anonymous post; an administrator's has everything (see
 * backend/src/controllers/stateController.js). Nothing here can widen that.
 *
 *
 * WHAT YOU'LL MEET IN THIS FILE (plain-English notes)
 * =================================================
 * - "the db"       One plain object holding what the server sent: users,
 *                  posts, notifications and the audit log, plus who is
 *                  signed in (viewerId). Every screen reads it; nothing
 *                  edits it in place - a new one replaces it.
 * - a "hook"       Any React function whose name starts with `use`. Hooks let
 *                  a component remember values and react to changes. They
 *                  may only be called from a component or another hook.
 * - useStore()     The custom hook every screen calls. It hands back the db
 *                  plus the actions (approve, assign, vote...) that change it.
 * - useSyncExternalStore  React's way of reading a value kept OUTSIDE React -
 *                  here, the db in this file. Every component that reads it
 *                  re-draws the moment a new copy arrives, all together.
 * - a "selector"   A plain function that answers a question about the db
 *                  (findUser, platformStats...). It reads, never writes.
 * - an "action"    A function that asks the server to change something
 *                  (createPost, changeStatus). Each one answers with an
 *                  object: `{ error }` if the server refused - with the
 *                  server's own explanation - or what the server sent back.
 * - async / await  A request takes time. An `async` function can `await` the
 *                  answer without freezing the page; the screen calling an
 *                  action awaits it too, before saying "done".
 * - ISO date       A date as text like 2026-09-10T07:58:34.591Z - the format
 *                  the server sends. It sorts correctly as plain text and is
 *                  what every `createdAt` holds.
 */

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */

function daysAgo(count) {
  const date = new Date();
  date.setDate(date.getDate() - count);
  return date.toISOString();
}

/*
 * Turn "Juan Dela Cruz" into "Juan", for the navbar's "Hi, Juan" and the
 * student dashboard's "Welcome back, Juan". Extra spaces are ignored, and a
 * blank or missing name gives '' - so the caller decides what to say
 * instead, rather than printing "Welcome back, " with nothing after it.
 *
 * A leading abbreviation is skipped: "Ma. Cristina Reyes" (Ma. for Maria, as
 * many names here are written) gives "Cristina", not "Ma.", and likewise
 * "Dr. Jose Rizal" gives "Jose". A name made only of abbreviations keeps its
 * first word.
 */
export function firstNameOf(fullName) {
  const words = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  return words.find((word) => !word.endsWith('.')) ?? words[0] ?? '';
}

// Turn "Juan Dela Cruz" into "JD" for the profile circle.
export function initialsOf(fullName = '') {
  return (
    fullName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

/* ------------------------------------------------------------------ *
 * The copy of the server's records, and keeping it up to date
 * ------------------------------------------------------------------ */

// What the screens see before the first answer - nobody signed in, nothing
// on the board. The app waits for the first answer before drawing anything
// that depends on it (see context/AuthContext.jsx).
const EMPTY = Object.freeze({
  viewerId: null,
  users: [],
  posts: [],
  notifications: [],
  audit: [],
  auditTotal: 0,
  // The signed-in person's own privacy picture (null for a visitor), and -
  // for a holder of manage_privacy only - the privacy requests and log.
  privacy: null,
  privacyRequests: [],
  privacyEvents: [],
});

let db = EMPTY;

/*
 * Where the connection stands: 'loading' until the first answer, 'ready'
 * once there has been one, and 'unreachable' when the very first request
 * failed - the app then says so, with a "Try again" button. After the first
 * answer a failed refresh changes nothing: the last copy stays on screen and
 * the next refresh tries again.
 */
let connection = 'loading';

const listeners = new Set();

function publish(next) {
  db = next;
  listeners.forEach((listener) => listener());
}

// The last answer, as text, so an unchanged one is not published again -
// which would re-draw every screen for nothing every few seconds.
let lastAnswer = '';

/*
 * Requests can overtake each other: a refresh started before an approval can
 * arrive after the one started just after it. Each refresh takes a number,
 * and an answer is only used if its number is higher than `applied` - the
 * last one used - so the screen never steps back to a state the server has
 * already left.
 */
let requested = 0;
let applied = 0;

/*
 * Fetch the copy again. Answers true if it arrived.
 *
 * A token the server no longer accepts - it expired, the password was
 * changed or reset, the account was deleted - is forgotten, and the copy is
 * fetched again as a visitor: the person is simply signed out.
 */
async function refresh() {
  const ticket = ++requested;
  try {
    let answer;
    try {
      answer = await api.state();
    } catch (problem) {
      if (problem.status !== 401 || !readToken()) throw problem;
      writeToken(null);
      answer = await api.state();
    }

    if (ticket <= applied) return true;
    applied = ticket;
    connection = 'ready';

    const text = JSON.stringify(answer);
    if (text === lastAnswer) return true;
    lastAnswer = text;

    /*
     * The rudeness filter runs again on the way in, not just when a post is
     * written. A word added to the list later still keeps every older post
     * using it off the screen.
     */
    publish({ ...answer, posts: answer.posts.filter((post) => checkFields(post.title, post.message).clean) });
    return true;
  } catch {
    if (connection === 'loading') {
      connection = 'unreachable';
      listeners.forEach((listener) => listener());
    }
    return false;
  }
}

/*
 * KEEPING UP. Every POLL_MS while the tab is in view, and at once when it
 * comes back into view. A tab nobody is looking at asks nothing. The server
 * answers an unchanged copy with "304 Not Modified" and no body, so a poll
 * that finds nothing new costs next to nothing.
 */
const POLL_MS = 15000;
let lastPassiveRefresh = 0;

// The refreshes nobody asked for, at most one every two seconds - switching
// windows fires both "focus" and "visibilitychange" at once.
function refreshQuietly() {
  if (document.visibilityState !== 'visible') return;
  if (Date.now() - lastPassiveRefresh < 2000) return;
  lastPassiveRefresh = Date.now();
  refresh();
}

let started = false;
function start() {
  if (started) return;
  started = true;

  refresh();
  setInterval(refreshQuietly, POLL_MS);
  window.addEventListener('focus', refreshQuietly);
  document.addEventListener('visibilitychange', refreshQuietly);

  // Signing in or out in another tab of this site: follow it here too.
  window.addEventListener('storage', (event) => {
    if (!isTokenKey(event.key)) return;
    forgetFiles();
    refresh();
  });
}

function subscribe(listener) {
  start();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getDb = () => db;
const getConnection = () => connection;

/* ------------------------------------------------------------------ *
 * Selectors - questions the screens ask about the data
 * ------------------------------------------------------------------ */

export function findUser(data, userId) {
  return data.users.find((user) => user.id === userId) ?? null;
}

// The posts the public board is allowed to show.
export function publicPosts(data) {
  return data.posts.filter((post) => PUBLIC_STATUSES.includes(post.status));
}

/*
 * The name to print for a submission's author.
 *
 * Anonymous posting has to mean something, so the author's real name is only
 * ever sent to somebody holding VIEW_IDENTITY - an admin - and only shown to
 * them. Everyone else gets "Anonymous student": the server never sent them
 * the name in the first place.
 */
export function authorLabel(post, viewer) {
  if (!post.anonymous) return post.authorName ?? 'Deleted account';
  if (can(viewer, PERMISSIONS.VIEW_IDENTITY)) {
    return `Anonymous · ${post.authorName ?? 'Deleted account'}`;
  }
  return 'Anonymous student';
}

// Everything an admin needs to know about one account's activity, in one pass.
export function userActivity(data, userId) {
  const posts = data.posts.filter((post) => post.authorId === userId);
  const inGroup = (group) => posts.filter((post) => kindInfo(post.kind).group === group);

  return {
    total: posts.length,
    suggestions: inGroup('suggestion').length,
    concerns: inGroup('concern').length,
    approved: posts.filter((post) => PUBLIC_STATUSES.includes(post.status)).length,
    rejected: posts.filter((post) => post.status === 'rejected').length,
    pending: posts.filter((post) => AWAITING_REVIEW.includes(post.status)).length,
    resolved: posts.filter((post) => CLOSED_STATUSES.includes(post.status)).length,
    votesCast: findUser(data, userId)?.votesCast ?? 0,
  };
}

/*
 * Approved but handed to nobody - work that is not being carried by anyone.
 *
 * `needsAssignment` is what makes this count true. Without it, it swept in
 * plain suggestions - things that by design never get a department - and
 * read 3 while exactly one submission was actually waiting for an owner.
 *
 * The dashboard card and the Departments page both count from here, so the
 * two cannot disagree.
 */
export function needsAssigning(data) {
  return data.posts.filter(
    (post) =>
      OPEN_STATUSES.includes(post.status) &&
      !post.department &&
      kindInfo(post.kind).needsAssignment
  );
}

// The numbers on the admin dashboard and analytics cards.
export function platformStats(data) {
  /*
   * STUDENTS, not "everyone who is not an admin".
   *
   * This counted every non-admin account, which swept in the `user` role -
   * staff and visitors who signed up without a student number. The whole
   * reason that role exists is to tell those people apart from students, and
   * the one figure reporting on it put them back together: the dashboard
   * read "5 students" while four were enrolled.
   */
  const students = data.users.filter((user) => user.role === 'student');
  const thirtyDaysAgo = Date.parse(daysAgo(30));
  const sevenDaysAgo = Date.parse(daysAgo(7));

  const byStatus = (statuses) => data.posts.filter((post) => statuses.includes(post.status)).length;
  const byGroup = (group) =>
    data.posts.filter((post) => kindInfo(post.kind).group === group).length;

  // A kind-group and a set of statuses at once, e.g. concerns that are open.
  const byGroupStatus = (group, statuses) =>
    data.posts.filter(
      (post) => kindInfo(post.kind).group === group && statuses.includes(post.status)
    ).length;

  return {
    totalUsers: data.users.length,
    totalStudents: students.length,
    activeUsers: data.users.filter(
      (user) => user.status === 'active' && Date.parse(user.lastLogin || 0) > thirtyDaysAgo
    ).length,
    newUsers: data.users.filter((user) => Date.parse(user.createdAt || 0) > sevenDaysAgo).length,
    suspendedUsers: data.users.filter((user) => user.status === 'suspended').length,

    totalPosts: data.posts.length,

    /*
     * OUTCOMES OF THE APPROVAL QUEUE, counted as exact statuses so that each
     * one matches the list of that name in the panel. An approved count used to
     * sit here too, counting every public status - which quietly folded in
     * everything that had already moved on to in progress or resolved, so its
     * tile read 5 while the page it opened listed 3. Nothing shows an
     * approved-only figure any more, so it is gone.
     *
     * The wider figure is still worth having; it is just a different
     * question, so it has its own name below.
     */
    pendingPosts: byStatus(AWAITING_REVIEW),
    rejectedPosts: byStatus(['rejected']),

    // Everything a student can actually see on the board, at any stage.
    publishedPosts: byStatus(PUBLIC_STATUSES),

    totalSuggestions: byGroup('suggestion'),
    totalConcerns: byGroup('concern'),

    /*
     * CONCERNS ONLY. These two counted by status alone, which meant a
     * suggestion sitting at "approved" was tallied as an open CONCERN - the
     * dashboard tile said 4 while the sidebar badge beside it, which does
     * filter by group, said 2. Two numbers for the same thing on the same
     * screen. The group filter is what makes the name true.
     */
    openConcerns: byGroupStatus('concern', OPEN_STATUSES),
    resolvedConcerns: byGroupStatus('concern', CLOSED_STATUSES),

    /*
     * OPEN WORK - what the queue of that name holds: everything approved
     * that a department has to act on, whatever family it is in. Counted by
     * `needsAssignment` rather than by family so a request is in it; the
     * concern-only figures above stay for the summary export, where
     * "concerns" is the family being reported on.
     */
    openWork: data.posts.filter(isOpenWork).length,
    unassignedPosts: needsAssigning(data).length,

    // Votes are counted per post by the server; an account that was deleted
    // keeps its votes, so the tally means what it said.
    totalVotes: data.posts.reduce((sum, post) => sum + post.votes, 0),
  };
}

/*
 * Average time from submission to resolution, in days, across the posts it
 * is given - the one place this sum is worked out:
 *   Analytics and Exports pass every post, so it covers EVERY kind of
 *     submission - a resolved suggestion counts just as a resolved concern
 *     does. Worth stating, because the figure sits beside concern counts on
 *     those two screens and reads as though it were concerns-only.
 *   Departments passes one department's posts, for that row's average.
 *
 * Returns null when none of them has been resolved yet, so the screen can
 * say "no data" rather than printing a misleading zero.
 */
export function averageResolutionDays(posts) {
  const resolved = posts.filter((post) => post.resolvedAt && post.createdAt);
  if (resolved.length === 0) return null;

  const totalMs = resolved.reduce(
    (sum, post) => sum + (Date.parse(post.resolvedAt) - Date.parse(post.createdAt)),
    0
  );
  return totalMs / resolved.length / (1000 * 60 * 60 * 24);
}

// Notifications addressed to this account: their own, plus the admin feed if
// they can open the admin panel.
export function notificationsFor(data, user) {
  if (!user) return [];
  const seesAdminFeed = can(user, PERMISSIONS.VIEW_ADMIN);

  return data.notifications
    .filter((note) => note.userId === user.id || (seesAdminFeed && note.audience === 'admin'))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

// How many of those are still unread - the one number behind the student
// navbar's bell, the badge on the phone profile circle, the dashboard's
// Notifications panel and the admin header's bell, so they always agree.
export function unreadCountFor(data, user) {
  return notificationsFor(data, user).filter((note) => !note.read).length;
}

/* ------------------------------------------------------------------ *
 * ACTIONS - every change goes to the server
 * ------------------------------------------------------------------ */

/*
 * A request whose refusal is answered as `{ error }` - the server's own
 * explanation - instead of thrown: what every action hands back to the
 * screen that called it.
 */
async function orError(request) {
  try {
    return await request();
  } catch (problem) {
    return { error: problem.message };
  }
}

/*
 * Every change goes through here. `request` sends it; once the server has
 * accepted it, the copy is fetched again, so whatever the change did - the
 * new status, the audit entry, the student's notification - is on screen by
 * the time the button's handler carries on. A refusal fetches the copy too:
 * "That submission no longer exists" usually means this screen was behind.
 *
 * Answers `{ error }` with the server's explanation, or what the server sent.
 */
async function change(request) {
  try {
    const answer = await request();
    await refresh();
    return answer ?? {};
  } catch (problem) {
    // Refused because the current Terms are not accepted yet: bring the
    // "Terms updated" dialog back, even if it was put off (components/TermsGate.jsx).
    if (problem.data?.mustAcceptTerms) window.dispatchEvent(new Event(TERMS_REQUIRED_EVENT));
    await refresh();
    return { error: problem.message };
  }
}

// The event change() sends when the server wants the Terms accepted first.
export const TERMS_REQUIRED_EVENT = 'cvb:terms-required';

/*
 * Signing up or in: the server hands back a token, which is kept, and the
 * copy is fetched again - now as that account. `field` names the form box a
 * refusal is about - 'email' when the email is taken.
 */
async function signIn(request) {
  try {
    const { token } = await request();
    writeToken(token);
    if (!(await refresh())) {
      return { error: 'Could not reach the server. Check your connection and try again.' };
    }
    return {};
  } catch (problem) {
    return {
      error: problem.message,
      field: problem.data?.field ?? null,
    };
  }
}

/*
 * A FORGOTTEN PASSWORD - asking for the emailed link, then using it. Nobody
 * is signed in for either, so there is nothing to fetch again afterwards.
 * Each answers `{ error }`, or what the server said.
 */
function requestPasswordReset(email) {
  return orError(() => api.forgotPassword(email));
}

function resetPassword(token, newPassword) {
  return orError(async () => {
    await api.resetPassword(token, newPassword);
    return {};
  });
}

/*
 * Changing your own password, signed in. The server signs out every other
 * device and hands this one a new token, which replaces the old one - so the
 * person stays signed in here, in every tab of this browser.
 */
function changeOwnPassword(currentPassword, newPassword) {
  return orError(async () => {
    const { token } = await api.changeOwnPassword(currentPassword, newPassword);
    writeToken(token);
    await refresh();
    return {};
  });
}

/*
 * Signing out. The server is told first, while the token still works - it
 * records an administrator's sign-out in the activity log - and then the
 * token is forgotten whatever the server said: nobody stays signed in
 * because a request failed. If the copy cannot be fetched again as a
 * visitor, the signed-in person's records are cleared off the screen anyway.
 */
async function signOut() {
  const token = readToken();
  if (token) await api.logout(token).catch(() => {});
  writeToken(null);

  if (!(await refresh())) {
    applied = requested;
    lastAnswer = '';
    publish(EMPTY);
  }
}

/*
 * Voting shows at once rather than after the round trip: the card flips to
 * "Voted" and the count moves straight away, and the answer from the server
 * then confirms it - or puts it back, if the vote was refused. Anything
 * still on its way from before the click is ignored (`applied`), so it
 * cannot briefly undo the flip; and the last answer is forgotten, so the
 * server's reply is used even if it matches what was there before the click.
 */
function toggleVote(postId) {
  applied = requested;
  lastAnswer = '';
  publish({
    ...db,
    posts: db.posts.map((post) =>
      post.id === postId
        ? { ...post, hasVoted: !post.hasVoted, votes: post.votes + (post.hasVoted ? -1 : 1) }
        : post
    ),
  });
  return change(() => api.toggleVote(postId));
}

// The whole activity log, for the export - the copy holds the latest 500.
function fullActivityLog() {
  return orError(() => api.admin.activityLog());
}

// The signed-in person's data, as { blob, filename } for the page to save.
function exportMyData() {
  return orError(() => api.exportMyData());
}

/*
 * The actions, one object for the whole app - they act on the server, not on
 * any one screen, so every component shares them. `useStore()` spreads them
 * into what it returns, so a screen can write `store.changeStatus(...)`.
 */
const actions = {
  /* ACCOUNTS */
  register: (details) => signIn(() => api.register(details)),
  authenticate: (credentials) => signIn(() => api.login(credentials)),
  signOut,
  requestPasswordReset,
  resetPassword,
  changeOwnPassword,
  // A person's own details and photo, from /account.
  updateOwnAccount: (fields) => change(() => api.updateAccount(fields)),
  updateOwnPhoto: (photo) => change(() => api.updatePhoto(photo)),
  // An administrator acting on somebody's account, from their profile page.
  updateUser: (userId, fields) => change(() => api.admin.updateUser(userId, fields)),
  setUserStatus: (userId, status) => change(() => api.admin.setUserStatus(userId, status)),
  setUserRole: (userId, role) => change(() => api.admin.setUserRole(userId, role)),
  deleteUser: (userId) => change(() => api.admin.deleteUser(userId)),

  /* SUBMISSIONS */
  createPost: (fields) => change(() => api.createPost(fields)),
  // One action behind Approve, Reject, Mark as under review and every later
  // status move; the server writes the audit entry and tells the student.
  changeStatus: (postId, status, { reason = '' } = {}) =>
    change(() => api.admin.setPostStatus(postId, status, reason)),
  assignConcern: (postId, { department, assignedTo }) =>
    change(() => api.admin.assign(postId, department, assignedTo)),
  resolveConcern: (postId, resolution) => change(() => api.admin.resolve(postId, resolution)),
  addAdminNote: (postId, text) => change(() => api.admin.addNote(postId, text)),

  /* VOTING */
  toggleVote,

  /* NOTIFICATIONS AND THE AUDIT LOG */
  markNotificationRead: (notificationId) => change(() => api.markNotificationRead(notificationId)),
  markAllNotificationsRead: () => change(() => api.markAllNotificationsRead()),
  fullActivityLog,

  /* PRIVACY - the person's own choices and rights, and handling requests.
     The versions sent are the ones this site shows (data/policies.js); the
     server refuses any that are no longer current. */
  acceptTerms: (keepSchoolDetails) =>
    change(() => api.acceptTerms(POLICY_VERSIONS.terms, keepSchoolDetails)),
  setSchoolConsent: (granted) =>
    change(() => api.setSchoolConsent(granted, POLICY_VERSIONS.privacy)),
  saveCookieConsent: (choice) => change(() => api.setCookieConsent(choice)),
  exportMyData,
  submitPrivacyRequest: (type, details) => change(() => api.createPrivacyRequest(type, details)),
  cancelPrivacyRequest: (id) => change(() => api.cancelPrivacyRequest(id)),
  updatePrivacyRequest: (id, changes) => change(() => api.admin.updatePrivacyRequest(id, changes)),
};

/* ------------------------------------------------------------------ *
 * THE HOOKS
 *
 * Every page - student and admin alike - reads the platform through these.
 * ------------------------------------------------------------------ */

export function useStore() {
  const data = useSyncExternalStore(subscribe, getDb);
  return useMemo(() => ({ db: data, ...actions }), [data]);
}

// 'loading', 'ready' or 'unreachable' - see `connection` above - and the way
// to try again from the "cannot reach the server" screen.
export function useConnection() {
  return useSyncExternalStore(subscribe, getConnection);
}

export const retryConnection = refresh;
