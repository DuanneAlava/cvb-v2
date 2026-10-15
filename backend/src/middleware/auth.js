const jwt = require('jsonwebtoken');
const pool = require('../config/db');

/*
 * ROLE AND PERMISSION CHECKS - THE ONES THAT ACTUALLY COUNT
 * ========================================================
 * The frontend has route guards and hides links an account may not use. Those
 * are conveniences: they run in the visitor's browser, where anybody can edit
 * them. These do not, which is why every endpoint that changes anything sits
 * behind them. If a check exists only in React, the endpoint is unprotected.
 *
 * The account is re-read from the database on every request rather than
 * trusted from the token, because a token issued an hour ago still says
 * "admin" after the account has been demoted, suspended or deleted. A stale
 * token must not outlive the decision to revoke access.
 */

/*
 * WHAT YOU'LL MEET IN THIS FILE (plain-English notes)
 *
 * - "Middleware"  In Express, a function that runs BEFORE the route handler
 *   and can either let the request continue (`next()`) or answer it itself
 *   (`res.status(403).json(...)`). Every function here is middleware: it sits
 *   in front of a route and decides whether the request gets through.
 * - `req`, `res`, `next`  The request (who is asking, with what), the
 *   response (what we send back), and "pass to the next step".
 * - A "token" (JWT)  A signed string the server hands out at login and the
 *   browser sends back with every request, in an "Authorization: Bearer ..."
 *   header. The signature proves the server issued it; `iat` inside it is
 *   when ("issued at"), in seconds.
 * - `async` / `await`  Talking to the database takes time; an async function
 *   can wait for the answer without blocking every other request.
 * - `pool.query('... WHERE id = $1', [value])`  A "parameterised" query.
 *   The `$1` is a placeholder the database fills in safely. Pasting the
 *   value into the SQL text yourself is how SQL injection happens; this is
 *   the rule that prevents it.
 * - `ROLE_PERMISSIONS[account.role] ?? []`  The permission list for the
 *   role, or an empty list if the role is unknown - so an unknown role can
 *   do nothing rather than crash the check.
 */

// Kept in step with frontend/src/data/roles.js. If a role is added there, add
// it here too, and to the CHECK on users.role in models/schema.sql - and
// prefer requirePermission below to naming roles directly. This is also the
// backend's one list of which roles exist: changing somebody's role
// (routes/adminRoutes.js) accepts exactly the roles named here.
const ROLE_PERMISSIONS = {
  // One admin role, holding everything. The self-checks in adminRoutes.js
  // (no changing your own role or status, no deleting yourself) are what
  // keep the reserved powers from being turned on the account using them.
  admin: [
    'view_admin', 'moderate_posts', 'manage_concerns', 'view_identity',
    'manage_users', 'delete_users', 'manage_admins', 'view_analytics',
    'view_audit_log', 'manage_privacy', 'submit_posts', 'vote',
  ],
  student: ['submit_posts', 'vote'],
  user: ['submit_posts', 'vote'],
};

/*
 * May this account do `permission`? A suspended account may do nothing, the
 * same rule as can() in frontend/src/data/roles.js. No account (a visitor
 * who is not signed in) may do nothing either.
 */
function can(account, permission) {
  if (!account || account.status === 'suspended') return false;
  return (ROLE_PERMISSIONS[account.role] ?? []).includes(permission);
}

/*
 * A sign-in token for an account - from logging in, signing up, or changing
 * one's own password. Only the account's id travels in it. Its role, its
 * status and whether it still exists are read fresh from the database on
 * every request (requireAuth below), so a token can never claim more than
 * the account currently holds.
 */
function signToken(account) {
  return jwt.sign({ sub: String(account.id) }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

// The token's contents, or null when there is no token or it is not valid.
function readToken(req) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null; // expired, or not signed with our JWT_SECRET
  }
}

/*
 * The account a token stands for, read fresh - or null when the account has
 * been deleted, or its password has changed since the token was issued. The
 * second is what makes a password reset lock out whoever held the old
 * password, instead of leaving them signed in for days.
 */
async function accountFor(payload) {
  const { rows } = await pool.query(
    'SELECT id, name, email, role, status, password_changed_at FROM users WHERE id = $1',
    [payload.sub]
  );
  const account = rows[0];
  if (!account) return null;

  if (account.password_changed_at) {
    const changedAt = Math.floor(new Date(account.password_changed_at).getTime() / 1000);
    if (payload.iat < changedAt) return null;
  }
  return account;
}

const SIGNED_OUT = 'You have been signed out. Please log in again.';

/*
 * Signed in, as an account that still exists. The account is put on
 * req.user for the handler - fresh from the database, so its role and status
 * are the current ones.
 */
async function requireAuth(req, res, next) {
  try {
    const payload = readToken(req);
    const account = payload && (await accountFor(payload));
    if (!account) return res.status(401).json({ error: SIGNED_OUT });

    req.user = account;
    next();
  } catch (err) {
    next(err);
  }
}

/*
 * The same, but a visitor who is not signed in is let through with
 * req.user = null - for what guests may see too, such as the board.
 *
 * A token that WAS sent but is no longer good (expired, or the password
 * changed) is not quietly treated as a guest: req.signedOut is set, so the
 * handler can answer 401 and the browser forgets the token.
 */
async function attachUserIfPresent(req, res, next) {
  try {
    const payload = readToken(req);
    req.user = payload ? await accountFor(payload) : null;
    req.signedOut = Boolean(req.headers.authorization) && !req.user;
    next();
  } catch (err) {
    next(err);
  }
}

/*
 * Signed in AND allowed to do `permission`. Goes after requireAuth, which
 * has already read the account fresh.
 */
function requirePermission(permission) {
  return function check(req, res, next) {
    // A suspended account keeps its token but loses its abilities.
    if (req.user.status === 'suspended') {
      return res.status(403).json({ error: 'This account has been suspended.' });
    }

    if (!can(req.user, permission)) {
      /*
       * 404, not 403. Telling an unauthorised caller that /admin/users
       * exists and they are merely not allowed in is more than they need to
       * know. As far as they are concerned there is nothing there.
       */
      return res.status(404).json({ error: 'Not found.' });
    }

    next();
  };
}

module.exports = {
  ROLE_PERMISSIONS,
  SIGNED_OUT,
  signToken,
  can,
  requireAuth,
  attachUserIfPresent,
  requirePermission,
};
