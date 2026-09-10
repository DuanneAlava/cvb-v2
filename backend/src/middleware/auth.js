const jwt = require('jsonwebtoken');
const pool = require('../config/db');

/*
 * Reads the "Authorization: Bearer <token>" header, checks the JWT is
 * valid, and attaches { id, email } to req.user so later route handlers
 * know who is making the request. Responds 401 if the token is missing,
 * expired, or was not signed with our JWT_SECRET.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
  }
}

/*
 * Same idea, but never blocks the request - it just attaches req.user
 * when a valid token is present. Used on routes that behave slightly
 * differently for guests vs logged-in students (e.g. voting shows who
 * voted only when logged in) without forcing a login.
 */
function attachUserIfPresent(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme === 'Bearer' && token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      req.user = { id: payload.sub, email: payload.email, role: payload.role };
    } catch {
      // Invalid token on an optional-auth route - just proceed as a guest.
    }
  }
  next();
}

/*
 * ROLE AND PERMISSION CHECKS - THE ONES THAT ACTUALLY COUNT
 * ========================================================
 * The frontend has route guards and hides links an account may not use. Those
 * are conveniences: they run in the visitor's browser, where anybody can edit
 * them. These do not, which is why every admin endpoint has to sit behind one
 * of them. If a check exists only in React, the endpoint is unprotected.
 *
 * The role is re-read from the database on every request rather than trusted
 * from the token, because a token issued an hour ago still says "admin" after
 * the account has been demoted or suspended. A stale token must not outlive
 * the decision to revoke access.
 */

// Kept in step with frontend/src/data/roles.js. If a role is added there, add
// it here too - and prefer requirePermission below to naming roles directly.
const ROLE_PERMISSIONS = {
  super_admin: [
    'view_admin', 'moderate_posts', 'manage_concerns', 'view_identity',
    'manage_users', 'delete_users', 'manage_admins', 'view_analytics',
    'view_audit_log', 'manage_settings', 'submit_posts', 'vote',
  ],
  admin: [
    'view_admin', 'moderate_posts', 'manage_concerns', 'view_identity',
    'manage_users', 'view_analytics', 'view_audit_log', 'submit_posts', 'vote',
  ],
  student: ['submit_posts', 'vote'],
  user: ['submit_posts', 'vote'],
};

/*
 * Load the account fresh and check it may do `permission`.
 * Runs after requireAuth, which has already established who is asking.
 */
function requirePermission(permission) {
  return async function check(req, res, next) {
    try {
      const { rows } = await pool.query(
        'SELECT id, role, status FROM users WHERE id = $1',
        [req.user.id]
      );
      const account = rows[0];

      // The account was deleted while its token was still valid.
      if (!account) {
        return res.status(401).json({ error: 'This account no longer exists.' });
      }

      // A suspended account keeps its token but loses its abilities.
      if (account.status === 'suspended') {
        return res.status(403).json({ error: 'This account has been suspended.' });
      }

      const allowed = ROLE_PERMISSIONS[account.role] ?? [];
      if (!allowed.includes(permission)) {
        /*
         * 404, not 403. Telling an unauthorised caller that /admin/users
         * exists and they are merely not allowed in is more than they need to
         * know. As far as they are concerned there is nothing there.
         */
        return res.status(404).json({ error: 'Not found.' });
      }

      // Hand the freshly-read role on, so handlers use it rather than the token's.
      req.user.role = account.role;
      next();
    } catch (err) {
      next(err);
    }
  };
}

// Shorthand for "any account that may open the admin panel".
const requireAdmin = requirePermission('view_admin');

module.exports = { requireAuth, attachUserIfPresent, requirePermission, requireAdmin, ROLE_PERMISSIONS };
