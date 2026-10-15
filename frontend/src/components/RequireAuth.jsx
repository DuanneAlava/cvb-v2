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
 *
 * WHAT YOU'LL MEET IN THIS FILE (plain-English notes)
 *
 * - A "route guard"  A component whose only job is to decide whether to show
 *   the page underneath it or send the visitor somewhere else.
 * - <Navigate to="..." replace />  From react-router: rendering this element
 *   performs a redirect. `replace` swaps the current history entry instead of
 *   adding one, so the Back button does not lead straight back into the
 *   guard and bounce again.
 * - <Outlet />  "Draw whichever child route matched here." A guard that
 *   wraps a group of routes in App.js renders <Outlet /> to let the real
 *   page through once the check passes.
 * - useLocation()  The current address - pathname, query string and any
 *   `state` that was handed along with a navigation.
 * - `state={{ from: ... }}`  A note attached to the redirect, invisible in
 *   the URL. The login page reads it to send the person back to where they
 *   were heading once they have signed in.
 * - `{ children }`  The elements written between a component's opening and
 *   closing tags. RedirectIfSignedIn either renders them or redirects.
 */

/*
 * Where somebody with no account goes from a page that needs one. Usually the
 * log-in page, with `state.from` - which is what lets /login send them
 * onwards afterwards. But somebody who just pressed "Log out" goes to the
 * board instead: they are leaving, not trying to get in.
 */
function SignInFirst() {
  const { signedOut } = useAuth();
  const location = useLocation();

  if (signedOut) return <Navigate to="/" replace />;
  return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
}

/* Signed in as anybody. */
export function RequireAuth() {
  const { user } = useAuth();
  if (!user) return <SignInFirst />;
  return <Outlet />;
}

/* Signed in AND holding a particular permission. */
export function RequirePermission({ permission }) {
  const { user, can } = useAuth();

  if (!user) return <SignInFirst />;

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
 * to see. It sends them on - to the page a guard turned them away from, if
 * one did (`state.from`, set above), otherwise to wherever their role
 * belongs.
 *
 * This is also what moves somebody on after they log in or sign up: the
 * moment the server confirms the account, `user` is set and this sends them
 * where they were going. The two forms do not redirect by themselves.
 */
export function RedirectIfSignedIn({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (user) return <Navigate to={location.state?.from ?? homeFor(user)} replace />;
  return children;
}

/*
 * A PAGE WHOSE ADMIN VERSION LIVES IN THE ADMIN PANEL.
 *
 * An administrator's own account page is their entry in the admin panel, so
 * /account sends anyone who can open the panel to `to` (/admin/profile). It
 * is a redirect, not a permission: nothing here decides what an admin may
 * see, only where that page is for them. A student is unaffected. The board
 * itself is open to administrators like everybody else.
 */
export function AdminHomeRedirect({ to, children }) {
  const { user, can } = useAuth();

  if (user && can(PERMISSIONS.VIEW_ADMIN)) {
    return <Navigate to={to} replace />;
  }

  return children;
}
