import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import {
  RequireAuth,
  RequirePermission,
  RedirectIfSignedIn,
  AdminHomeRedirect,
} from './components/RequireAuth.jsx';
import { PERMISSIONS } from './data/roles.js';
import { ASSIGNABLE_KINDS, AWAITING_REVIEW, OPEN_STATUSES } from './data/workflow.js';

import Layout from './components/Layout.jsx';
import AdminLayout from './components/admin/AdminLayout.jsx';

import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';

import StudentDashboard from './pages/student/Dashboard.jsx';
import Account from './pages/student/Account.jsx';

import AdminDashboard from './pages/admin/Dashboard.jsx';
import Submissions from './pages/admin/Submissions.jsx';
import Users from './pages/admin/Users.jsx';
import UserProfile from './pages/admin/UserProfile.jsx';
import Analytics from './pages/admin/Analytics.jsx';
import Notifications from './pages/admin/Notifications.jsx';
import ActivityLogs from './pages/admin/ActivityLogs.jsx';
import Departments from './pages/admin/Departments.jsx';
import Exports from './pages/admin/Exports.jsx';
import System from './pages/admin/System.jsx';
import AdminProfile from './pages/admin/AdminProfile.jsx';

/*
 * THE WHOLE PLATFORM'S ROUTING, IN ONE PLACE.
 *
 *   /                      the public board       - open to everyone
 *   /login, /signup        one door for everybody - signed-out only
 *   /student/dashboard     a person's own submissions
 *   /account               a person's own details
 *   /admin/...             the management side    - VIEW_ADMIN only
 *
 * Every admin route sits inside a single <RequirePermission> wrapper, so there
 * is no way to add an admin page and forget to protect it - a new <Route>
 * inside that block is guarded by existing.
 *
 * The Monitoring pages and both Work queues are all the same <Submissions />
 * component looking at a different slice, which is why adding a queue costs a
 * route and nothing else.
 *
 *
 * A NOTE ON WHAT THIS PROTECTS
 * These guards decide which screens the app draws. They run in the visitor's
 * own browser, so they keep an ordinary student out of the admin panel - they
 * do not stop somebody determined to get in. The server has to check the role
 * again on every request; see backend/src/middleware/auth.js.
 *
 * WHAT YOU'LL MEET IN THIS FILE (plain-English notes)
 *
 * - "Routing"  Deciding which screen to draw for which address. This is a
 *   single-page app: the browser loads one HTML page and react-router swaps
 *   components in and out as the address changes, with no full reload.
 * - <BrowserRouter>  Turns the browser's address bar into something the app
 *   can read and change. Everything routed must sit inside it.
 * - <Routes> / <Route path="..." element={...}>  The table of addresses.
 *   Each Route says "at this path, draw this element".
 * - Nested routes  A <Route> with other <Route>s inside it. The parent's
 *   element draws a frame (a layout, or a guard) and puts <Outlet /> where
 *   the matching child should appear. That is how every /admin/... page
 *   shares one sidebar without each page importing it.
 * - `index`  The child to show when the address is exactly the parent's
 *   path and nothing more - here it redirects /admin to /admin/dashboard.
 * - <Navigate to="..." replace />  A redirect, expressed as an element.
 * - The `*` path  Matches anything nothing else matched: the catch-all.
 * - <AuthProvider>  Wraps everything so every page can ask who is signed in.
 */
function App() {
  return (
    <AuthProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          {/* ---------------------------------------------------------- *
           * PUBLIC - the student-facing board
           * ---------------------------------------------------------- */}
          <Route element={<Layout />}>
            {/*
              The board, for students and signed-out visitors. An admin who
              lands here is forwarded to the admin panel instead - the board
              is not their home, and dropping a moderator onto the student
              feed on every reload made them navigate back by hand.
            */}
            <Route
              index
              element={
                <AdminHomeRedirect>
                  <Home />
                </AdminHomeRedirect>
              }
            />
          </Route>

          {/* ---------------------------------------------------------- *
           * AUTH - full-screen navy cards, outside the site frame
           * ---------------------------------------------------------- */}
          <Route
            path="/login"
            element={
              <RedirectIfSignedIn>
                <Login />
              </RedirectIfSignedIn>
            }
          />
          <Route
            path="/signup"
            element={
              <RedirectIfSignedIn>
                <Signup />
              </RedirectIfSignedIn>
            }
          />

          {/* ---------------------------------------------------------- *
           * SIGNED IN - any role
           * ---------------------------------------------------------- */}
          <Route element={<RequireAuth />}>
            <Route path="/student/dashboard" element={<StudentDashboard />} />
            {/*
              An admin's account page is their own entry in the admin panel,
              which shows the same fields with the admin controls beside them.
              Sending them there means one account page per person, and one
              field list - see data/accountFields.js.
            */}
            <Route
              path="/account"
              element={
                <AdminHomeRedirect to="/admin/profile">
                  <Account />
                </AdminHomeRedirect>
              }
            />
          </Route>

          {/* ---------------------------------------------------------- *
           * ADMIN - everything below needs VIEW_ADMIN
           * ---------------------------------------------------------- */}
          <Route element={<RequirePermission permission={PERMISSIONS.VIEW_ADMIN} />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />

              {/*
                WORK - the two live queues.
                Both are the same <Submissions /> component with the statuses
                fixed, which is why adding a queue costs a route and nothing
                else.
              */}
              <Route element={<RequirePermission permission={PERMISSIONS.MODERATE_POSTS} />}>
                <Route
                  path="queue/pending"
                  element={
                    <Submissions
                      title="Pending Approval"
                      description="Oldest first - these are the students who have been waiting longest. Nothing here is visible on the student board yet."
                      lockedStatuses={AWAITING_REVIEW}
                      queue
                    />
                  }
                />
                {/*
                  Pinned by KIND, not by family. This was "Open Concerns",
                  locked to the concern family - which silently left out
                  requests: a request needs a department exactly like a
                  concern does, but is a suggestion, so an approved one
                  reached no queue at all and could only be found by
                  browsing All Submissions. `needsAssignment` is the real
                  question this queue asks, so that is what pins it.
                */}
                <Route
                  path="queue/open"
                  element={
                    <Submissions
                      title="Open Work"
                      description="Oldest first - approved and waiting on a department, or being worked on by one. A student is waiting on each."
                      lockedKinds={ASSIGNABLE_KINDS}
                      lockedStatuses={OPEN_STATUSES}
                      queue
                    />
                  }
                />
              </Route>

              {/* MONITORING - the whole record, for looking things up. */}
              <Route
                path="posts"
                element={
                  <Submissions
                    title="All Submissions"
                    description="Every submission on the platform, whatever its type or status."
                  />
                }
              />
              {/* PEOPLE. */}
              <Route element={<RequirePermission permission={PERMISSIONS.MANAGE_USERS} />}>
                <Route path="users" element={<Users />} />
                <Route path="users/:userId" element={<UserProfile />} />
              </Route>

              {/* INSIGHTS. */}
              <Route element={<RequirePermission permission={PERMISSIONS.VIEW_ANALYTICS} />}>
                <Route path="analytics" element={<Analytics />} />
                <Route path="exports" element={<Exports />} />
              </Route>

              {/* Departments reports on assignment, so that is what guards it. */}
              <Route element={<RequirePermission permission={PERMISSIONS.MANAGE_CONCERNS} />}>
                <Route path="departments" element={<Departments />} />
              </Route>

              <Route path="notifications" element={<Notifications />} />

              <Route element={<RequirePermission permission={PERMISSIONS.VIEW_AUDIT_LOG} />}>
                <Route path="activity" element={<ActivityLogs />} />
              </Route>

              {/*
                No redirects for retired addresses. Eight of them used to sit
                here - /admin/suggestions, /admin/reports, /admin/moderation/*
                and so on - "so a bookmark still works". Nothing in the code
                links to any of them and this build has never shipped, so
                there are no bookmarks to protect; they were eight routes of
                dead weight. An unknown address falls through to the catch-all
                below, which is what it is for.
              */}

              <Route path="system" element={<System />} />
              <Route path="profile" element={<AdminProfile />} />
            </Route>
          </Route>

          {/* Any unknown address goes back to the board. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
