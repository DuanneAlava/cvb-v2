/*
 * The vocabulary of the moderation and concern workflow, in one file.
 *
 * Statuses, priorities, submission kinds and departments all live here so that
 * adding one is a single edit. Every table, filter dropdown, status badge,
 * chart and admin action reads from these lists rather than hard-coding
 * strings, which is what lets the admin panel absorb a new status or category
 * without being rewritten.
 *
 * WHAT YOU'LL MEET IN THIS FILE (plain-English notes)
 *
 * - `export const NAME = ...`  A value other files can import by name. "const"
 *   means the variable itself cannot be reassigned. This is how one file
 *   becomes the single source of truth for the whole app.
 * - An object keyed by id, e.g. STATUSES.pending. Think of it as a dictionary:
 *   look up the word ("pending") and get everything known about it (label,
 *   colours, what it may move to next).
 * - `Object.values(STATUSES)`  Turns that dictionary into a plain list of its
 *   entries, in the order they were written - which is what dropdowns and
 *   charts want to loop over.
 * - `.filter(...)` / `.map(...)`  Two ways of walking a list. filter keeps the
 *   entries that pass a test; map turns each entry into something else (here,
 *   usually just its `key`).
 * - `STATUSES[key] ?? STATUSES.pending`  The "nullish coalescing" operator.
 *   Read it as "the thing on the left, or if that is missing, the thing on the
 *   right". It is the safety net for an unknown key.
 * - `badgeClass` / `barClass`  Tailwind CSS class names stored as data, so a
 *   status carries its own colour and every screen draws it the same way.
 */

/* ------------------------------------------------------------------ *
 * STATUSES
 *
 * Six. The path a submission travels is:
 *
 *   pending -> under_review -> approved -> in_progress -> resolved
 *                           \-> rejected
 *
 * They are LISTED here in reading order rather than strictly that path:
 * the live states first, with rejected last because it is the exception
 * rather than a stage anything passes through. Every dropdown, legend and
 * chart reads this object directly, so changing the order here changes it
 * everywhere at once and nothing sorts a copy of its own.
 *
 * It used to be ten. Four were removed because each one cost more than it
 * earned:
 *
 *   needs_revision  A dead end. It told the student to revise and left the
 *                   post in the review queue - but nothing in the platform
 *                   lets a student edit a submission, so it sat there until
 *                   an admin approved or rejected it anyway. Removing it is
 *                   what actually closes that loop.
 *   assigned        Indistinguishable from in_progress in practice; handing
 *                   a concern to a department IS the work starting, and
 *                   assignConcern always moved it straight on.
 *   closed          A second ending after resolved, with no rule for which
 *                   to use.
 *   archived        A hiding place, and the only way in was a status change
 *                   that looked identical to progress on the board.
 *
 * `badgeClass` styles the pill; `barClass` is the solid version of the same
 * hue, so a status is the same colour on a chart as it is on a badge.
 *
 * `public` means: visible on the student-facing board.
 * `next` lists the statuses an admin may move to from here, and is what
 * draws the buttons in the review dialog - so it must only ever name a
 * status that still exists in this object.
 * ------------------------------------------------------------------ */

const STATUSES = {
  pending: {
    key: 'pending',
    label: 'Pending',
    badgeClass: 'bg-amber-100 text-amber-800',
    barClass: 'bg-amber-500',
    public: false,
    next: ['under_review', 'approved', 'rejected'],
  },
  under_review: {
    key: 'under_review',
    label: 'Under Review',
    badgeClass: 'bg-sky-100 text-sky-800',
    barClass: 'bg-sky-500',
    public: false,
    next: ['approved', 'rejected'],
  },
  in_progress: {
    key: 'in_progress',
    label: 'In Progress',
    badgeClass: 'bg-blue-100 text-blue-800',
    barClass: 'bg-blue-500',
    public: true,
    next: ['resolved'],
  },
  approved: {
    key: 'approved',
    label: 'Approved',
    badgeClass: 'bg-emerald-100 text-emerald-800',
    barClass: 'bg-emerald-500',
    public: true, // this is the point where the board shows it
    /*
     * `under_review` is the way back out, for an approval made in error.
     * It is the one backward move from a public status, and it has a real
     * consequence: under_review is not public, so taking it removes a post
     * students can already see. The review dialog warns before the click
     * rather than after it.
     */
    next: ['in_progress', 'resolved', 'under_review'],
  },
  resolved: {
    key: 'resolved',
    label: 'Resolved',
    badgeClass: 'bg-green-100 text-green-800',
    barClass: 'bg-green-600',
    public: true,
    // Reopening is the only move left, for something that came back.
    next: ['in_progress'],
  },
  rejected: {
    key: 'rejected',
    label: 'Rejected',
    badgeClass: 'bg-red-100 text-red-700',
    barClass: 'bg-red-500',
    public: false,
    // A way back, for a rejection somebody wants to reconsider.
    next: ['under_review'],
  },
};

export const STATUS_LIST = Object.values(STATUSES);

/*
 * There is deliberately no fixed "path" list here. The progress line in the
 * review dialog is built per submission kind from the steps an admin
 * actually takes (see pathFor in components/admin/SubmissionReview.jsx),
 * because a suggestion and a concern do not travel the same road.
 */

// The statuses whose posts appear on the public board.
export const PUBLIC_STATUSES = STATUS_LIST.filter((s) => s.public).map((s) => s.key);

// Waiting on an admin. Drives the "pending reviews" badge and the queue count.
export const AWAITING_REVIEW = ['pending', 'under_review'];

// A concern that is open: approved but not yet finished with.
export const OPEN_STATUSES = ['approved', 'in_progress'];
export const CLOSED_STATUSES = ['resolved'];

export function statusInfo(key) {
  return STATUSES[key] ?? STATUSES.pending;
}

/* ------------------------------------------------------------------ *
 * WHAT KIND OF SUBMISSION IS IT
 *
 * The one classification a submission has. Two things are read off it:
 *
 *   `group`           the family - suggestion or concern. The student site
 *                     calls a concern a "voice out"; the admin panel filters
 *                     by family on All Submissions.
 *   `needsAssignment` whether it is handed to a department and worked on.
 *                     This, not the family, is what puts an approved post in
 *                     the Open Work queue - a request is a suggestion that
 *                     somebody has to act on, so it is in that queue too.
 *
 * Add a kind here and it appears in the right places automatically.
 * ------------------------------------------------------------------ */

const KINDS = {
  suggestion: {
    key: 'suggestion',
    label: 'Suggestion',
    group: 'suggestion',
    badgeClass: 'bg-navy-100 text-navy-700',
    barClass: 'bg-navy-600',
    // Suggestions are ideas - they finish at "approved" rather than needing
    // a department to fix something.
    needsAssignment: false,
  },
  request: {
    key: 'request',
    label: 'Request',
    group: 'suggestion',
    badgeClass: 'bg-cyan-100 text-cyan-800',
    barClass: 'bg-sky-500',
    needsAssignment: true,
  },
  concern: {
    key: 'concern',
    label: 'Concern',
    group: 'concern',
    badgeClass: 'bg-amber-100 text-amber-800',
    barClass: 'bg-amber-500',
    needsAssignment: true,
  },
  complaint: {
    key: 'complaint',
    label: 'Complaint',
    group: 'concern',
    badgeClass: 'bg-orange-100 text-orange-800',
    barClass: 'bg-orange-500',
    needsAssignment: true,
  },
  report: {
    key: 'report',
    label: 'Report',
    group: 'concern',
    badgeClass: 'bg-red-100 text-red-700',
    barClass: 'bg-red-500',
    needsAssignment: true,
  },
};

export const KIND_LIST = Object.values(KINDS);

export function kindInfo(key) {
  return KINDS[key] ?? KINDS.suggestion;
}

export function kindsInGroup(group) {
  return KIND_LIST.filter((kind) => kind.group === group).map((kind) => kind.key);
}

// The kinds that get handed to a department - what the Open Work queue holds.
export const ASSIGNABLE_KINDS = KIND_LIST.filter((kind) => kind.needsAssignment).map(
  (kind) => kind.key
);

/*
 * IS THIS POST OPEN WORK? Approved, not finished, and of a kind a department
 * has to act on - by `needsAssignment`, not by family, so a request counts
 * the same as a concern. The one rule behind the admin sidebar's Open Work
 * badge, the dashboard's Open Work list and the "open work" statistic, so the
 * three can never disagree.
 */
export function isOpenWork(post) {
  return kindInfo(post.kind).needsAssignment && OPEN_STATUSES.includes(post.status);
}

/* ------------------------------------------------------------------ *
 * DEPARTMENTS - who a concern is handed to.
 *
 * The eleven academic colleges. A college is an office with a dean who can
 * actually act on a complaint, which is what makes it a valid owner; the
 * programmes inside each one (data/programs.js) are curricula and cannot
 * resolve anything, so the two lists stay separate.
 *
 * These replaced seven administrative offices - Facilities, IT, Security,
 * Registrar, Guidance, Student Affairs and Academic Affairs. Worth knowing
 * what that means in practice: a concern with no academic owner, a broken
 * walkway light or a wifi outage, now has no department on this list that
 * fits it. Such concerns stay Unassigned, which the Departments page counts
 * and flags rather than hiding.
 * ------------------------------------------------------------------ */

export const DEPARTMENTS = [
  { key: 'college-education', label: 'College of Education' },
  { key: 'college-business-administration', label: 'College of Business Administration' },
  { key: 'college-criminal-justice', label: 'College of Criminal Justice Education' },
  { key: 'college-computer-studies', label: 'College of Computer Studies' },
  { key: 'college-psychology', label: 'College of Psychology' },
  { key: 'college-medical-laboratory-science', label: 'College of Medical Laboratory Science' },
  { key: 'college-nursing-midwifery', label: 'College of Nursing & Midwifery' },
  { key: 'college-hospitality-management', label: 'College of Hospitality Management' },
  { key: 'college-maritime-studies', label: 'College of Maritime Studies' },
  { key: 'college-law', label: 'College of Law' },
  { key: 'senior-high-school', label: 'Senior High School' },
];

export function departmentLabel(key) {
  return DEPARTMENTS.find((department) => department.key === key)?.label ?? 'Unassigned';
}

/* ------------------------------------------------------------------ *
 * NOTIFICATIONS
 *
 * `audience` decides who a notification of this type is delivered to:
 * 'admin' goes to everybody who can open the admin panel, 'author' goes to
 * the student who wrote the submission.
 *
 * A NOTIFICATION IS FOR SOMETHING THAT HAS NO QUEUE.
 * There is deliberately no "new submission" type for admins. A new post is
 * pending by definition, so it is already the newest row in Pending
 * Approval with the sidebar badge counting it; a notification for it was
 * the same fact on a second badge, and one that did not clear when the
 * post was approved. The only admin-audience type left is a new account,
 * which has no queue to sit in.
 * ------------------------------------------------------------------ */

export const NOTIFICATION_TYPES = {
  user_registered: { key: 'user_registered', audience: 'admin', tone: 'info', label: 'New user' },
  post_approved: { key: 'post_approved', audience: 'author', tone: 'good', label: 'Post approved' },
  post_rejected: { key: 'post_rejected', audience: 'author', tone: 'bad', label: 'Post rejected' },
  status_changed: { key: 'status_changed', audience: 'author', tone: 'info', label: 'Status updated' },
  concern_assigned: { key: 'concern_assigned', audience: 'author', tone: 'info', label: 'Concern assigned' },
  concern_resolved: { key: 'concern_resolved', audience: 'author', tone: 'good', label: 'Concern resolved' },
  account_suspended: { key: 'account_suspended', audience: 'author', tone: 'bad', label: 'Account suspended' },
  account_activated: { key: 'account_activated', audience: 'author', tone: 'good', label: 'Account activated' },
  privacy_request_updated: { key: 'privacy_request_updated', audience: 'author', tone: 'info', label: 'Privacy request' },
};

export function notificationInfo(key) {
  return (
    NOTIFICATION_TYPES[key] ?? { key, audience: 'admin', tone: 'info', label: 'Notification' }
  );
}

export const TONE_CLASS = {
  good: 'bg-emerald-100 text-emerald-700',
  bad: 'bg-red-100 text-red-700',
  info: 'bg-sky-100 text-sky-800',
};

/* ------------------------------------------------------------------ *
 * AUDIT LOG
 *
 * The administrative actions worth recording. Everything an admin does that
 * changes somebody else's data is done by the server, which writes one of
 * these as part of the same change, so the log cannot be forgotten at the
 * call site. The server writes them in backend/src/routes/admin/
 * and backend/src/controllers/ (authController.js, accountController.js) -
 * a new action there needs its label here.
 * ------------------------------------------------------------------ */

export const AUDIT_ACTIONS = {
  login: 'Logged in',
  logout: 'Logged out',
  post_approved: 'Approved submission',
  post_rejected: 'Rejected submission',
  status_changed: 'Changed status',
  concern_assigned: 'Assigned concern',
  concern_resolved: 'Resolved concern',
  admin_note_added: 'Added admin note',
  user_suspended: 'Suspended account',
  user_activated: 'Activated account',
  user_updated: 'Updated account',
  password_changed: 'Changed password',
  // Kept for older entries: until 2026-10-14 an administrator reset a
  // forgotten password. A forgotten one is now reset by its owner, by email.
  password_reset: 'Reset a password',
  user_deleted: 'Deleted account',
  role_changed: 'Changed account role',
  first_admin: 'Became the first administrator',
};

export function auditLabel(action) {
  return AUDIT_ACTIONS[action] ?? action;
}
