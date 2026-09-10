import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { PERMISSIONS, homeFor } from '../data/roles.js';

/*
 * Route guards.
 *
 * Wrapping a group of routes in one of these stops somebody reaching them by
 * typing the address, rather than only by hiding the link that leads there.
 *
 *   <Route element={<RequirePermission permission={PERMISSIONS.VIEW_ADMIN} />}>
 *     ...every admin page...
 *   </Route>
 *
 * A student who types /admin/users is bounced to their own dashboard, and a
 * signed-out visitor is sent to /login with a note of where they were trying
 * to go, so they land there after signing in instead of on a generic page.
 *
 *
 * WHAT A ROUTE GUARD CAN AND CANNOT DO - PLEASE READ
 * ==================================================
 * This decides which screens the app will DRAW. It is not security. Everything
 * here runs inside the visitor's own browser, where it can be edited, so it
 * stops an ordinary student wandering somewhere they should not be - it does
 * not stop somebody who is deliberately trying.
 *
 * Real enforcement belongs on the server, checking the role again on every
 * request, so that /api/admin/... refuses a student's token no matter what the
 * browser believes. That middleware is in ../../backend/src/middleware/auth.js
 * and has to stay switched on: treat these guards as the convenience layer on
 * top of it, never as the thing doing the protecting.
 */

/* Signed in as anybody. */
export function RequireAuth() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    // `state.from` is what lets /login send them onwards afterwards.
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return <Outlet />;
}

/* Signed in AND holding a particular permission. */
export function RequirePermission({ permission }) {
  const { user, can } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  /*
   * Somebody signed in but not allowed here is sent to their own dashboard
   * rather than shown a locked door. Announcing "an admin area exists and you
   * are not in it" tells a stranger more than it needs to.
   */
  if (!can(permission)) {
    return <Navigate to={homeFor(user)} replace />;
  }

  return <Outlet />;
}

/*
 * The opposite: for /login and /signup, which a signed-in person has no reason
 * to see. It sends them to whichever dashboard their role belongs to.
 */
export function RedirectIfSignedIn({ children }) {
  const { user } = useAuth();
  if (user) return <Navigate to={homeFor(user)} replace />;
  return children;
}

/*
 * THE BOARD IS NOT AN ADMINISTRATOR'S HOME.
 *
 * Signing in already sends an admin to /admin/dashboard, but the address "/"
 * was still the public board for everybody - so opening the site, clicking
 * the logo, or reloading a bookmark dropped a moderator onto the student
 * feed and left them to find their way back.
 *
 * This sends anyone who can open the admin panel to it. It is a redirect,
 * not a permission: nothing here decides what an admin may see, only where
 * they land by default. A student or a signed-out visitor is unaffected and
 * gets the board exactly as before.
 *
 * `to` names the admin-side equivalent of the wrapped page, when there is
 * one: /account forwards to /admin/profile rather than to the dashboard, so
 * an admin who asks for their account gets their account. Without it, the
 * admin's home.
 */
export function AdminHomeRedirect({ to, children }) {
  const { user, can } = useAuth();

  if (user && can(PERMISSIONS.VIEW_ADMIN)) {
    return <Navigate to={to ?? homeFor(user)} replace />;
  }

  return children;
}
