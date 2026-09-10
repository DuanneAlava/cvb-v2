import { useCallback, useEffect, useMemo, useState } from 'react';
import { SEED_SUGGESTIONS } from '../data/suggestions.js';
import { checkFields } from './moderation.js';
import { PERMISSIONS, can } from '../data/roles.js';
import {
  AWAITING_REVIEW,
  CLOSED_STATUSES,
  OPEN_STATUSES,
  PUBLIC_STATUSES,
  kindInfo,
  notificationInfo,
} from '../data/workflow.js';

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
 *
 * A student posting a suggestion and an admin approving it are two writes to
 * the same records, so a new submission shows up in the moderation queue at
 * once, and an approval appears on the board at once - including in another
 * open tab, because every write is broadcast.
 *
 *
 * WHERE THE DATA ACTUALLY LIVES - READ THIS BEFORE DEPLOYING
 * ==========================================================
 * Right now these records sit in the browser's localStorage, which makes the
 * whole platform runnable with no database and no setup. That is fine for
 * building and demonstrating, and it is NOT fine in production, for one
 * reason that matters more than the rest:
 *
 *   Anyone can open devtools and give themselves the admin role.
 *
 * Browser storage cannot enforce anything. The role checks in this file and
 * the route guards around the admin panel decide what the interface offers -
 * they cannot decide what a determined person is able to do. Real enforcement
 * has to happen on a server that the browser cannot edit.
 *
 * The backend for that already exists in ../../backend, and this file is
 * deliberately the only place the frontend touches storage, so the swap is
 * contained: replace the read/write helpers below with calls to
 * services/api.js and every screen keeps working unchanged. See GUIDE.md,
 * "Connecting frontend to backend".
 */

// Bumping this wipes the stored platform and re-seeds it. Do that whenever the
// shape of a record below changes, so old data cannot half-load.
/*
 * 5 - the status list went from ten to six. A stored post carrying a status
 *     that no longer exists is worse than no data at all: statusInfo() falls
 *     back to `pending`, so an old "archived" or "closed" record would
 *     quietly reappear at the top of the review queue as work waiting on an
 *     admin.
 * 6 - priority removed. Stale records would carry a `priority` field nothing
 *     reads, which is harmless in itself but leaves the stored shape and the
 *     code disagreeing about what a post is.
 * 7 - the departments became the eleven colleges and every programme was
 *     respelled ("BS Computer Science" -> "BS in Computer Science"). An
 *     account still holding an old spelling is not broken - the filter keeps
 *     unlisted courses so nobody's submissions become unfindable - but that
 *     safety net is exactly what makes a renamed programme linger in the
 *     dropdown as a second, near-identical entry. Reseeding clears it in
 *     every browser rather than only the one it was noticed in.
 * 8 - "BS of Science in X" respelled to "BS in X". Same reason as 7.
 * 9 - "BS of X" respelled to "BS in X", finishing the same pass.
 * 10 - the "new submission" notifications to admins were dropped, along
 *      with their two types. A stored one would still be delivered to the
 *      bell under a generic "Notification" label, counting a submission the
 *      queue already counts - the exact thing removing them was for.
 * 11 - the super_admin role and its seed account were removed. A stored
 *      account still holding that role would fall back to `student` in
 *      roleInfo() and lose the panel, with no way for anybody to give it
 *      back. Reseeding leaves one admin, holding every permission.
 * 12 - `type` ('suggestion' | 'voice', which hero button was pressed) was
 *      dropped from posts; `kind` is the one classification. Stored posts
 *      carrying the old field are harmless but leave the saved shape and the
 *      code disagreeing about what a post is.
 */
const SCHEMA_VERSION = 12;

const KEYS = {
  version: 'cvb_schema_version',
  users: 'cvb_users',
  posts: 'cvb_posts',
  votes: 'cvb_votes',
  notifications: 'cvb_notifications',
  audit: 'cvb_audit',
  session: 'cvb_session',
};

const CHANNEL_NAME = 'cvb_platform';

/*
 * VOTING IS UNCAPPED.
 *
 * There is deliberately no target a post is counted against. A fixed goal
 * answers "has this reached 50 yet", which is an arbitrary question; a board
 * exists to answer "which of these does the campus actually want most", and
 * that has no ceiling. So a post takes as many votes as students give it, and
 * the meter on each card shows its share of every vote cast on the board -
 * a bar past halfway is a literal majority.
 */

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */

let idCounter = 0;
function newId(prefix) {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}${idCounter.toString(36)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function daysAgo(count) {
  const date = new Date();
  date.setDate(date.getDate() - count);
  return date.toISOString();
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
 * Seed data - the platform as it looks on a fresh install
 * ------------------------------------------------------------------ */

/*
 * DEMO ACCOUNTS. These exist so the panel can be opened and judged without
 * anybody having to register first. The password is stored in plain text
 * because this is browser storage - see the warning at the top of the file.
 * Delete these seeds and hash passwords on the server before going live.
 */
const DEMO_PASSWORD = 'campus123';

function seedUsers() {
  return [
    // The one administrator. See the note on ROLES in data/roles.js.
    {
      id: 'user-admin',
      name: 'Kenn Dave Alava',
      email: 'admin@ollcf.edu.ph',
      password: DEMO_PASSWORD,
      role: 'admin',
      studentId: '',
      course: '',
      yearLevel: '',
      section: '',
      status: 'active',
      createdAt: daysAgo(120),
      lastLogin: daysAgo(0),
    },
    {
      id: 'user-juan',
      name: 'Juan Dela Cruz',
      email: 'juan.delacruz@ollcf.edu.ph',
      password: DEMO_PASSWORD,
      role: 'student',
      studentId: '2023-00145',
      course: 'BS in Computer Science',
      yearLevel: '3rd Year',
      section: 'A',
      status: 'active',
      createdAt: daysAgo(64),
      lastLogin: daysAgo(0),
    },
    {
      id: 'user-ana',
      name: 'Ana Santos',
      email: 'ana.santos@ollcf.edu.ph',
      password: DEMO_PASSWORD,
      role: 'student',
      studentId: '2023-00871',
      course: 'BS in Secondary Education major in Mathematics',
      yearLevel: '2nd Year',
      section: 'B',
      status: 'active',
      createdAt: daysAgo(51),
      lastLogin: daysAgo(2),
    },
    {
      id: 'user-mark',
      name: 'Mark Villanueva',
      email: 'mark.villanueva@ollcf.edu.ph',
      password: DEMO_PASSWORD,
      role: 'student',
      studentId: '2024-01203',
      course: 'BS in Business Administration major in Financial Management',
      yearLevel: '1st Year',
      section: 'C',
      status: 'active',
      createdAt: daysAgo(28),
      lastLogin: daysAgo(5),
    },
    {
      id: 'user-liza',
      name: 'Liza Mendoza',
      email: 'liza.mendoza@ollcf.edu.ph',
      password: DEMO_PASSWORD,
      role: 'student',
      studentId: '2022-00098',
      course: 'BS in Nursing',
      yearLevel: '4th Year',
      section: 'A',
      status: 'suspended',
      createdAt: daysAgo(140),
      lastLogin: daysAgo(19),
    },
    {
      id: 'user-staff',
      name: 'Roberto Cruz',
      email: 'roberto.cruz@ollcf.edu.ph',
      password: DEMO_PASSWORD,
      role: 'user',
      studentId: '',
      course: '',
      yearLevel: '',
      section: '',
      status: 'active',
      createdAt: daysAgo(33),
      lastLogin: daysAgo(3),
    },
  ];
}

/*
 * The starter board. The six sample suggestions become real submissions owned
 * by real seed accounts, with a spread of statuses so the moderation queue,
 * the concern tracker and the analytics all have something to show on a fresh
 * install rather than being empty.
 */
function seedPosts() {
  const owners = ['user-juan', 'user-ana', 'user-mark', 'user-juan', 'user-ana', 'user-mark'];
  const kinds = ['suggestion', 'complaint', 'report', 'request', 'suggestion', 'suggestion'];
  const statuses = ['approved', 'in_progress', 'approved', 'pending', 'approved', 'resolved'];

  return SEED_SUGGESTIONS.map((seed, index) => ({
    id: seed.id,
    kind: kinds[index], // suggestion / request / concern / complaint / report
    category: seed.category,
    title: seed.title,
    message: seed.message,

    authorId: owners[index],
    anonymous: index % 2 === 1, // a mix, so the identity column has both to show
    attachments: [],

    status: statuses[index],

    department: statuses[index] === 'in_progress' ? 'college-hospitality-management' : '',
    assignedTo: statuses[index] === 'in_progress' ? 'Dean, College of Hospitality Management' : '',
    assignedAt: statuses[index] === 'in_progress' ? daysAgo(4) : '',

    resolution:
      statuses[index] === 'resolved'
        ? 'Two additional covered waiting sheds were installed beside the quadrangle, and four bins were added along the walkway.'
        : '',
    resolvedAt: statuses[index] === 'resolved' ? daysAgo(2) : '',

    rejectionReason: '',
    adminNotes: [],

    createdAt: daysAgo(14 - index),
    updatedAt: daysAgo(14 - index),
  }));
}

function seedDatabase() {
  return {
    users: seedUsers(),
    posts: seedPosts(),
    votes: {},
    notifications: [],
    audit: [],
  };
}

/* ------------------------------------------------------------------ *
 * Reading and writing
 *
 * These four functions are the ONLY place the frontend touches storage.
 * Point them at services/api.js and the whole platform moves to the server.
 * ------------------------------------------------------------------ */

let channel = null;
function getChannel() {
  if (channel) return channel;
  if (typeof BroadcastChannel === 'undefined') return null;
  channel = new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

/*
 * Everything in THIS tab that is watching the store.
 *
 * A BroadcastChannel deliberately does not deliver to the tab that posted the
 * message, so it keeps other tabs in step but not this one. Several parts of a
 * single page read the store at once - the auth context, the page itself, the
 * notification bell - and they all have to see a write immediately. This list
 * is what tells them.
 */
const localListeners = new Set();

function notifyLocal() {
  localListeners.forEach((listener) => listener());
}

function readKey(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function readDb() {
  try {
    if (Number(localStorage.getItem(KEYS.version)) !== SCHEMA_VERSION) {
      const fresh = seedDatabase();
      writeDb(fresh);
      localStorage.setItem(KEYS.version, String(SCHEMA_VERSION));
      return fresh;
    }

    const db = {
      users: readKey(KEYS.users, []),
      posts: readKey(KEYS.posts, []),
      votes: readKey(KEYS.votes, {}),
      notifications: readKey(KEYS.notifications, []),
      audit: readKey(KEYS.audit, []),
    };

    /*
     * The rudeness filter runs again on the way out, not just when a post is
     * written. Anything rude that was saved by an older build, or typed
     * straight into storage by hand, still never reaches a screen.
     */
    db.posts = db.posts.filter((post) => checkFields(post.title, post.message).clean);

    return db;
  } catch {
    // Storage unavailable (private browsing on some phones). The platform
    // still runs for this visit, it just cannot save.
    return seedDatabase();
  }
}

function writeDb(db) {
  localStorage.setItem(KEYS.users, JSON.stringify(db.users));
  localStorage.setItem(KEYS.posts, JSON.stringify(db.posts));
  localStorage.setItem(KEYS.votes, JSON.stringify(db.votes));
  localStorage.setItem(KEYS.notifications, JSON.stringify(db.notifications));
  localStorage.setItem(KEYS.audit, JSON.stringify(db.audit));
  getChannel()?.postMessage('changed'); // other tabs
  notifyLocal(); // and everything watching in this one
}

/* ------------------------------------------------------------------ *
 * The session - who is logged in on this browser
 * ------------------------------------------------------------------ */

export function readSessionId() {
  try {
    return localStorage.getItem(KEYS.session);
  } catch {
    return null;
  }
}

export function writeSessionId(userId) {
  if (userId) localStorage.setItem(KEYS.session, userId);
  else localStorage.removeItem(KEYS.session);
  getChannel()?.postMessage('changed');
  notifyLocal();
}

/* ------------------------------------------------------------------ *
 * Selectors - questions the screens ask about the data
 * ------------------------------------------------------------------ */

export function findUser(db, userId) {
  return db.users.find((user) => user.id === userId) ?? null;
}

// The posts the public board is allowed to show.
export function publicPosts(db) {
  return db.posts.filter((post) => PUBLIC_STATUSES.includes(post.status));
}

export function voteCount(db, postId) {
  return db.votes[postId]?.length ?? 0;
}

/*
 * The name to print for a submission's author.
 *
 * Anonymous posting has to mean something, so the author's real name is only
 * ever returned to somebody holding VIEW_IDENTITY - an admin. Everyone else
 * gets "Anonymous student", whatever they do to the page.
 */
export function authorLabel(db, post, viewer) {
  const author = findUser(db, post.authorId);

  if (!post.anonymous) return author?.name ?? 'Deleted account';
  if (can(viewer, PERMISSIONS.VIEW_IDENTITY)) {
    return `Anonymous · ${author?.name ?? 'Deleted account'}`;
  }
  return 'Anonymous student';
}

// Everything an admin needs to know about one account's activity, in one pass.
export function userActivity(db, userId) {
  const posts = db.posts.filter((post) => post.authorId === userId);
  const inGroup = (group) => posts.filter((post) => kindInfo(post.kind).group === group);

  return {
    total: posts.length,
    suggestions: inGroup('suggestion').length,
    concerns: inGroup('concern').length,
    approved: posts.filter((post) => PUBLIC_STATUSES.includes(post.status)).length,
    rejected: posts.filter((post) => post.status === 'rejected').length,
    pending: posts.filter((post) => AWAITING_REVIEW.includes(post.status)).length,
    resolved: posts.filter((post) => CLOSED_STATUSES.includes(post.status)).length,
    votesCast: Object.values(db.votes).filter((voters) => voters.includes(userId)).length,
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
export function needsAssigning(db) {
  return db.posts.filter(
    (post) =>
      OPEN_STATUSES.includes(post.status) &&
      !post.department &&
      kindInfo(post.kind).needsAssignment
  );
}

// The numbers on the admin dashboard and analytics cards.
export function platformStats(db) {
  /*
   * STUDENTS, not "everyone who is not an admin".
   *
   * This counted every non-admin account, which swept in the `user` role -
   * staff and visitors who signed up without a student number. The whole
   * reason that role exists is to tell those people apart from students, and
   * the one figure reporting on it put them back together: the dashboard
   * read "5 students" while four were enrolled.
   */
  const students = db.users.filter((user) => user.role === 'student');
  const thirtyDaysAgo = Date.parse(daysAgo(30));
  const sevenDaysAgo = Date.parse(daysAgo(7));

  const byStatus = (statuses) => db.posts.filter((post) => statuses.includes(post.status)).length;
  const byGroup = (group) =>
    db.posts.filter((post) => kindInfo(post.kind).group === group).length;

  // A kind-group and a set of statuses at once, e.g. concerns that are open.
  const byGroupStatus = (group, statuses) =>
    db.posts.filter(
      (post) => kindInfo(post.kind).group === group && statuses.includes(post.status)
    ).length;

  return {
    totalUsers: db.users.length,
    totalStudents: students.length,
    activeUsers: db.users.filter(
      (user) => user.status === 'active' && Date.parse(user.lastLogin || 0) > thirtyDaysAgo
    ).length,
    newUsers: db.users.filter((user) => Date.parse(user.createdAt || 0) > sevenDaysAgo).length,
    suspendedUsers: db.users.filter((user) => user.status === 'suspended').length,

    totalPosts: db.posts.length,

    /*
     * THE THREE OUTCOMES OF THE APPROVAL QUEUE, counted as exact statuses so
     * that each one matches the page its dashboard tile opens. `approvedPosts`
     * used to count every public status, which quietly folded in everything
     * that had already moved on to assigned, in progress, resolved or closed -
     * so the tile read 5 while the page it opened listed 3.
     *
     * That wider figure is still worth having; it is just a different
     * question, so it has its own name below.
     */
    pendingPosts: byStatus(AWAITING_REVIEW),
    approvedPosts: byStatus(['approved']),
    rejectedPosts: byStatus(['rejected']),

    // Everything a student can actually see on the board, at any stage.
    publishedPosts: byStatus(PUBLIC_STATUSES),

    totalSuggestions: byGroup('suggestion'),
    pendingSuggestions: db.posts.filter(
      (post) => kindInfo(post.kind).group === 'suggestion' && AWAITING_REVIEW.includes(post.status)
    ).length,

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
    openWork: db.posts.filter(
      (post) => kindInfo(post.kind).needsAssignment && OPEN_STATUSES.includes(post.status)
    ).length,
    unassignedPosts: needsAssigning(db).length,

    totalReports: db.posts.filter((post) => post.kind === 'report').length,
    totalVotes: Object.values(db.votes).reduce((sum, voters) => sum + voters.length, 0),
  };
}

/*
 * Average time from submission to resolution, in days, across EVERY kind of
 * submission - a resolved suggestion counts here just as a resolved concern
 * does. Worth stating, because the figure sits beside concern counts on two
 * screens and reads as though it were concerns-only.
 *
 * Returns null when nothing has been resolved yet, so the screen can say
 * "no data" rather than printing a misleading zero.
 */
export function averageResolutionDays(db) {
  const resolved = db.posts.filter((post) => post.resolvedAt && post.createdAt);
  if (resolved.length === 0) return null;

  const totalMs = resolved.reduce(
    (sum, post) => sum + (Date.parse(post.resolvedAt) - Date.parse(post.createdAt)),
    0
  );
  return totalMs / resolved.length / (1000 * 60 * 60 * 24);
}

// Notifications addressed to this account: their own, plus the admin feed if
// they can open the admin panel.
export function notificationsFor(db, user) {
  if (!user) return [];
  const seesAdminFeed = can(user, PERMISSIONS.VIEW_ADMIN);

  return db.notifications
    .filter((note) => note.userId === user.id || (seesAdminFeed && note.audience === 'admin'))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

/* ------------------------------------------------------------------ *
 * THE HOOK
 *
 * Every page - student and admin alike - reads the platform through this.
 * ------------------------------------------------------------------ */

export function useStore(actor = null) {
  const [db, setDb] = useState(readDb);

  // Pull in changes made in any other tab, so an approval lands on the
  // student's board without anybody refreshing.
  useEffect(() => {
    function refresh() {
      setDb(readDb());
    }

    const liveChannel = getChannel();
    if (liveChannel) liveChannel.addEventListener('message', refresh);

    // Other readers in this same tab.
    localListeners.add(refresh);

    // Covers browsers with no BroadcastChannel.
    function handleStorage(event) {
      if (Object.values(KEYS).includes(event.key)) refresh();
    }
    window.addEventListener('storage', handleStorage);

    return () => {
      if (liveChannel) liveChannel.removeEventListener('message', refresh);
      localListeners.delete(refresh);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  /*
   * Every write goes through here.
   *
   * `mutate` receives a working copy of the database and changes it in place.
   * Doing it in one place means an action cannot forget to save, cannot forget
   * to tell the other tabs, and - importantly - cannot forget to write its
   * audit entry.
   */
  const commit = useCallback((mutate) => {
    const next = readDb(); // re-read first, so a change from another tab is not lost
    const result = mutate(next);

    try {
      writeDb(next);
    } catch {
      throw new Error(
        'There is no room left to save this. Try posting with fewer or smaller photos.'
      );
    }

    setDb(next);
    return result;
  }, []);

  /* -------------------------------------------------------------- *
   * Writing helpers used by the actions below
   * -------------------------------------------------------------- */

  // Record an administrative action. Called by the actions themselves rather
  // than by the screens, so the log cannot be skipped.
  function log(next, action, { targetType = '', targetId = '', details = '' } = {}, as = actor) {
    if (!as) return;
    next.audit.unshift({
      id: newId('log'),
      adminId: as.id,
      adminName: as.name,
      adminRole: as.role,
      action,
      targetType,
      targetId,
      details,
      createdAt: nowIso(),
    });
    next.audit = next.audit.slice(0, 500); // keep the log from growing forever
  }

  // Deliver a notification. `audience` comes from the type, so a new type is
  // routed correctly without every caller having to know who it is for.
  function notify(next, type, { userId = null, title, body = '', link = '' }) {
    const info = notificationInfo(type);
    next.notifications.unshift({
      id: newId('note'),
      type,
      audience: info.audience,
      userId: info.audience === 'author' ? userId : null,
      title,
      body,
      link,
      read: false,
      createdAt: nowIso(),
    });
    next.notifications = next.notifications.slice(0, 300);
  }

  const actions = useMemo(() => {
    /* ------------------------------------------------------------ *
     * ACCOUNTS
     * ------------------------------------------------------------ */

    function register({ name, email, password, studentId, course, yearLevel, section }) {
      return commit((next) => {
        const taken = next.users.some(
          (user) => user.email.toLowerCase() === email.toLowerCase()
        );
        if (taken) return { error: 'An account with that school email already exists.' };

        const user = {
          id: newId('user'),
          name,
          email,
          password,
          role: studentId ? 'student' : 'user',
          studentId: studentId ?? '',
          course: course ?? '',
          yearLevel: yearLevel ?? '',
          section: section ?? '',
          status: 'active',
          createdAt: nowIso(),
          lastLogin: nowIso(),
        };

        next.users.push(user);
        notify(next, 'user_registered', {
          title: 'New user registered',
          body: `${name} (${email}) created an account.`,
          link: `/admin/users/${user.id}`,
        });

        return { user };
      });
    }

    function authenticate({ email, password }) {
      return commit((next) => {
        const user = next.users.find(
          (candidate) => candidate.email.toLowerCase() === email.trim().toLowerCase()
        );

        // Deliberately vague, so the form never reveals which accounts exist.
        if (!user || user.password !== password) {
          return { error: 'That email and password do not match an account.' };
        }

        if (user.status === 'suspended') {
          return {
            error: 'This account has been suspended. Please contact the Student Affairs office.',
          };
        }

        user.lastLogin = nowIso();
        return { user };
      });
    }

    function updateUser(userId, changes) {
      return commit((next) => {
        const user = findUser(next, userId);
        if (!user) return { error: 'That account no longer exists.' };

        Object.assign(user, changes);
        log(next, 'user_updated', {
          targetType: 'user',
          targetId: userId,
          details: `Updated ${Object.keys(changes).join(', ')} on ${user.name}`,
        });
        return { user };
      });
    }

    function setUserStatus(userId, status) {
      return commit((next) => {
        const user = findUser(next, userId);
        if (!user) return { error: 'That account no longer exists.' };

        user.status = status;
        const suspended = status === 'suspended';

        log(next, suspended ? 'user_suspended' : 'user_activated', {
          targetType: 'user',
          targetId: userId,
          details: user.name,
        });
        notify(next, suspended ? 'account_suspended' : 'account_activated', {
          userId,
          title: suspended ? 'Your account has been suspended' : 'Your account is active again',
          body: suspended
            ? 'You can still read the board, but posting and voting are turned off.'
            : 'You can post and vote again.',
        });

        return { user };
      });
    }

    function setUserRole(userId, role) {
      return commit((next) => {
        const user = findUser(next, userId);
        if (!user) return { error: 'That account no longer exists.' };

        const previous = user.role;
        user.role = role;
        log(next, 'role_changed', {
          targetType: 'user',
          targetId: userId,
          details: `${user.name}: ${previous} to ${role}`,
        });
        return { user };
      });
    }

    function deleteUser(userId) {
      return commit((next) => {
        const user = findUser(next, userId);
        if (!user) return { error: 'That account no longer exists.' };

        next.users = next.users.filter((candidate) => candidate.id !== userId);

        /*
         * The person's submissions stay on the board. Deleting an account
         * should not silently erase concerns that staff may still be working
         * on, so the posts are kept and simply lose their owner.
         */
        next.posts.forEach((post) => {
          if (post.authorId === userId) post.authorId = null;
        });

        /*
         * Their VOTES are deliberately left alone too - `next.votes` is not
         * touched here.
         *
         * A vote is a record that somebody backed a suggestion, and that
         * happened whether or not the account still exists. Removing it would
         * quietly change a result after the fact: a suggestion that won on
         * fifty votes would drop to forty-nine because one student graduated
         * and their account was closed. The tally has to mean what it said.
         */

        log(next, 'user_deleted', {
          targetType: 'user',
          targetId: userId,
          details: `${user.name} (${user.email}) - their submissions were kept`,
        });
        return { deleted: true };
      });
    }

    /* ------------------------------------------------------------ *
     * SUBMISSIONS
     * ------------------------------------------------------------ */

    function createPost({ kind, category, title, message, anonymous, attachments, authorId }) {
      return commit((next) => {
        const post = {
          id: newId('post'),
          // The one classification a post has. Which hero button opened the
          // form is not recorded - see the note on `mode` in PostModal.jsx.
          kind,
          category,
          title,
          message,
          authorId,
          anonymous: Boolean(anonymous),
          attachments: attachments ?? [],

          // Everything starts life waiting for an admin. Nothing reaches the
          // public board without passing through moderation.
          status: 'pending',

          department: '',
          assignedTo: '',
          assignedAt: '',
          resolution: '',
          resolvedAt: '',
          rejectionReason: '',
                adminNotes: [],

          createdAt: nowIso(),
          updatedAt: nowIso(),
        };

        next.posts.unshift(post);

        /*
         * NO NOTIFICATION TO ADMINS. THE QUEUE IS THE NOTIFICATION.
         *
         * This used to write a "new submission" notification for every
         * admin as well. A brand-new post is pending by definition, so it
         * is already the newest row in Pending Approval, whose sidebar badge
         * already counts it - the notification said the same thing a second
         * time, on a second badge, and the two then disagreed: approving the
         * post drained the queue but left its notification unread, so the
         * bell went on showing work that had been done.
         *
         * Admins are still told about the things that have no queue to sit
         * in - a new account, say - and about their own submissions like
         * anybody else. Everything waiting on a decision is in Pending
         * Approval, once.
         */
        return { post };
      });
    }

    // One function behind Approve, Reject, Request Revision and every later
    // status move, so the audit entry and the student's notification are
    // always written together with the change.
    function changeStatus(postId, status, { reason = '' } = {}) {
      return commit((next) => {
        const post = next.posts.find((candidate) => candidate.id === postId);
        if (!post) return { error: 'That submission no longer exists.' };

        post.status = status;
        post.updatedAt = nowIso();

        if (status === 'rejected') post.rejectionReason = reason;

        const auditAction =
          { approved: 'post_approved', rejected: 'post_rejected' }[status] ?? 'status_changed';

        log(next, auditAction, {
          targetType: 'post',
          targetId: postId,
          details: `${post.title} to ${status}${reason ? ` - ${reason}` : ''}`,
        });

        const notice = {
          approved: {
            type: 'post_approved',
            title: 'Your submission was approved',
            body: `"${post.title}" is now visible on the board.`,
          },
          rejected: {
            type: 'post_rejected',
            title: 'Your submission was not approved',
            body: reason || 'It did not meet the posting guidelines.',
          },
        }[status] ?? {
          type: 'status_changed',
          title: 'Your submission was updated',
          body: `"${post.title}" is now marked ${status.replace('_', ' ')}.`,
        };

        notify(next, notice.type, {
          userId: post.authorId,
          title: notice.title,
          body: notice.body,
          link: '/student/dashboard',
        });

        return { post };
      });
    }

    function assignConcern(postId, { department, assignedTo }) {
      return commit((next) => {
        const post = next.posts.find((candidate) => candidate.id === postId);
        if (!post) return { error: 'That submission no longer exists.' };

        post.department = department;
        post.assignedTo = assignedTo;
        post.assignedAt = nowIso();

        /*
         * Assigning IS the work starting. There used to be an "assigned"
         * status between this and "in_progress", but nothing ever sat in it -
         * handing a concern to a department and that department beginning
         * were the same event, and the extra step only asked the admin for a
         * second click to say so.
         */
        if (['approved', 'pending', 'under_review'].includes(post.status)) {
          post.status = 'in_progress';
        }
        post.updatedAt = nowIso();

        log(next, 'concern_assigned', {
          targetType: 'post',
          targetId: postId,
          details: `${post.title} to ${department}${assignedTo ? ` (${assignedTo})` : ''}`,
        });
        notify(next, 'concern_assigned', {
          userId: post.authorId,
          title: 'Your concern has been assigned',
          body: `"${post.title}" was passed to the department handling it.`,
          link: '/student/dashboard',
        });

        return { post };
      });
    }

    function resolveConcern(postId, resolution) {
      return commit((next) => {
        const post = next.posts.find((candidate) => candidate.id === postId);
        if (!post) return { error: 'That submission no longer exists.' };

        /*
         * Correcting the summary of something already resolved keeps its
         * original resolution date. Otherwise every edit to the wording
         * would move the date forward and quietly inflate the resolution-
         * time figures on the dashboard and the Departments page.
         */
        const alreadyResolved = post.status === 'resolved' && Boolean(post.resolvedAt);

        post.status = 'resolved';
        post.resolution = resolution;
        if (!alreadyResolved) post.resolvedAt = nowIso();
        post.updatedAt = nowIso();

        log(next, 'concern_resolved', {
          targetType: 'post',
          targetId: postId,
          details: alreadyResolved ? `${post.title} - summary updated` : post.title,
        });
        notify(next, 'concern_resolved', {
          userId: post.authorId,
          title: alreadyResolved
            ? 'The resolution of your concern was updated'
            : 'Your concern has been resolved',
          body: resolution,
          link: '/student/dashboard',
        });

        return { post };
      });
    }

    function addAdminNote(postId, text) {
      return commit((next) => {
        const post = next.posts.find((candidate) => candidate.id === postId);
        if (!post) return { error: 'That submission no longer exists.' };

        post.adminNotes = post.adminNotes ?? [];
        post.adminNotes.push({
          id: newId('note'),
          author: actor?.name ?? 'Admin',
          text,
          createdAt: nowIso(),
        });
        post.updatedAt = nowIso();

        log(next, 'admin_note_added', {
          targetType: 'post',
          targetId: postId,
          details: post.title,
        });
        return { post };
      });
    }

    /* ------------------------------------------------------------ *
     * VOTING
     * ------------------------------------------------------------ */

    function toggleVote(postId, voterId) {
      return commit((next) => {
        if (!voterId) return { error: 'Please log in to vote.' };

        const voters = next.votes[postId] ?? [];
        next.votes[postId] = voters.includes(voterId)
          ? voters.filter((id) => id !== voterId)
          : [...voters, voterId];

        return { votes: next.votes[postId].length };
      });
    }

    /* ------------------------------------------------------------ *
     * NOTIFICATIONS AND THE AUDIT LOG
     * ------------------------------------------------------------ */

    function markNotificationRead(notificationId) {
      return commit((next) => {
        const note = next.notifications.find((candidate) => candidate.id === notificationId);
        if (note) note.read = true;
        return { note };
      });
    }

    function markAllNotificationsRead(user) {
      return commit((next) => {
        const seesAdminFeed = can(user, PERMISSIONS.VIEW_ADMIN);
        next.notifications.forEach((note) => {
          if (note.userId === user.id || (seesAdminFeed && note.audience === 'admin')) {
            note.read = true;
          }
        });
        return {};
      });
    }

    /*
     * ONLY ADMIN SESSIONS ARE RECORDED.
     *
     * The activity log calls itself a record of administrative action, and
     * every screen that reads it - the page, the CSV export - repeats that.
     * It was recording EVERY sign-in, students included, which on a real
     * campus means a few hundred student logins a week burying the handful
     * of moderation decisions the log exists to show. The "Administrator"
     * column heading was wrong on those rows too.
     *
     * Students are not untracked by this: `lastLogin` on the account is what
     * the Users page reads for "last active", and it is still written for
     * everybody. This only decides what belongs in the AUDIT trail.
     *
     * Sign-in and sign-out are recorded as the person doing them, not as
     * whoever the hook was built around - at the moment of logging in, that
     * is still nobody.
     */
    function recordLogin(user) {
      if (!can(user, PERMISSIONS.VIEW_ADMIN)) return {};

      return commit((next) => {
        log(next, 'login', { targetType: 'user', targetId: user.id, details: user.email }, user);
        return {};
      });
    }

    function recordLogout(user) {
      if (!can(user, PERMISSIONS.VIEW_ADMIN)) return {};

      return commit((next) => {
        log(next, 'logout', { targetType: 'user', targetId: user.id, details: user.email }, user);
        return {};
      });
    }

    return {
      register,
      authenticate,
      updateUser,
      setUserStatus,
      setUserRole,
      deleteUser,
      createPost,
      changeStatus,
      assignConcern,
      resolveConcern,
      addAdminNote,
      toggleVote,
      markNotificationRead,
      markAllNotificationsRead,
      recordLogin,
      recordLogout,
    };
    // `actor` is who is performing these actions - it decides what the audit
    // log records, so the actions are rebuilt when the logged-in admin changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commit, actor?.id, actor?.name, actor?.role]);

  return { db, ...actions };
}

export { DEMO_PASSWORD, SCHEMA_VERSION };
