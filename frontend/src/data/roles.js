/*
 * Who is allowed to do what.
 *
 * There is ONE account system for the whole platform. An account is not an
 * "admin account" or a "student account" - it is an account with a `role`, and
 * the role decides which dashboard it lands on and which actions it may take.
 * That is what keeps the student site and the admin panel from drifting into
 * two half-connected applications.
 *
 * ADDING A ROLE
 * Add it to ROLES with its permissions and its home page. Route guards, the
 * sidebar and the admin user list all read from here, so nothing else needs
 * touching.
 */

/*
 * Every action the system recognises. Screens ask "may this account do X?"
 * rather than "is this account an admin?", so a new role slots in without
 * every page having to be rewritten.
 */
export const PERMISSIONS = {
  VIEW_ADMIN: 'view_admin', // may open the admin panel at all
  MODERATE_POSTS: 'moderate_posts', // approve / reject / request revision
  MANAGE_CONCERNS: 'manage_concerns', // assign, progress, resolve
  VIEW_IDENTITY: 'view_identity', // see who wrote an anonymous post
  MANAGE_USERS: 'manage_users', // suspend, activate, edit
  DELETE_USERS: 'delete_users', // permanent removal
  MANAGE_ADMINS: 'manage_admins', // change somebody else's role
  VIEW_ANALYTICS: 'view_analytics',
  VIEW_AUDIT_LOG: 'view_audit_log',
  MANAGE_SETTINGS: 'manage_settings',
  SUBMIT_POSTS: 'submit_posts', // write to the board
  VOTE: 'vote',
};

const ALL_PERMISSIONS = Object.values(PERMISSIONS);

export const ROLES = {
  /*
   * ONE ADMIN ROLE.
   *
   * There used to be two - `super_admin`, which could change roles, delete
   * accounts and reset the platform, and `admin`, which could not. On a
   * campus suggestion box run by one office that was a tier nobody needed:
   * the same person wore both hats, and the split only meant the demo login
   * page listed two admin accounts and a student's profile said "only a
   * Super Admin can change this" to the only administrator there was.
   *
   * So there is one admin, holding everything. The permissions themselves
   * are kept as separate names rather than collapsed into "is admin",
   * because a narrower role added later - a moderator who may approve but
   * not delete, say - should be a list here and nothing else.
   *
   * What stops an admin abusing the powers that used to be reserved: the
   * self-checks. An account may never change its own role, suspend itself
   * or delete itself - see pages/admin/UserProfile.jsx and the matching
   * guards in backend/src/routes/adminRoutes.js.
   */
  admin: {
    key: 'admin',
    label: 'Admin',
    permissions: ALL_PERMISSIONS,
    home: '/admin/dashboard',
    badgeClass: 'bg-navy-100 text-navy-700',
  },

  student: {
    key: 'student',
    label: 'Student',
    permissions: [PERMISSIONS.SUBMIT_POSTS, PERMISSIONS.VOTE],
    home: '/student/dashboard',
    badgeClass: 'bg-emerald-100 text-emerald-800',
  },

  // A staff member or visitor without a student number. Same abilities as a
  // student on the board; kept separate so reporting can tell them apart.
  user: {
    key: 'user',
    label: 'User',
    permissions: [PERMISSIONS.SUBMIT_POSTS, PERMISSIONS.VOTE],
    home: '/student/dashboard',
    badgeClass: 'bg-slate-100 text-slate-700',
  },
};

export const ROLE_LIST = Object.values(ROLES);

// Roles that belong on the admin side of the platform.
export const ADMIN_ROLES = ROLE_LIST.filter((role) =>
  role.permissions.includes(PERMISSIONS.VIEW_ADMIN)
).map((role) => role.key);

export function roleInfo(key) {
  return ROLES[key] ?? ROLES.student;
}

/*
 * The single question every guard and every button asks.
 * Everything routes through here, so permissions can never drift between
 * "what the menu shows" and "what the action actually allows".
 */
export function can(user, permission) {
  if (!user) return false;
  if (user.status === 'suspended') return false; // a suspended account can do nothing
  return roleInfo(user.role).permissions.includes(permission);
}

// Where this account belongs after logging in.
export function homeFor(user) {
  return user ? roleInfo(user.role).home : '/login';
}

export function isAdminRole(role) {
  return ADMIN_ROLES.includes(role);
}
