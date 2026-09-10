import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import {
  RequireAuth,
  RequirePermission,
  RedirectIfSignedIn,
  AdminHomeRedirect,
} from './components/RequireAuth.jsx';
import { PERMISSIONS } from './data/roles.js';
import { AWAITING_REVIEW, OPEN_STATUSES } from './data/workflow.js';

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
import Settings from './pages/admin/Settings.jsx';
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
            <Route path="/account" element={<Account />} />
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
                <Route
                  path="queue/open"
                  element={
                    <Submissions
                      title="Open Concerns"
                      description="Oldest first - approved and still being worked on, with a student waiting on each."
                      lockedGroup="concern"
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
              {/*
                "Suggestions" and "Concerns" were two more copies of the page
                above with a family pinned. The type dropdown does that job
                now, so these survive only to keep existing links working.
              */}
              <Route
                path="suggestions"
                element={<Navigate to="/admin/posts?group=suggestion" replace />}
              />
              <Route
                path="concerns"
                element={<Navigate to="/admin/posts?group=concern" replace />}
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
                RETIRED ADDRESSES.
                Five nav entries were folded into filters on the pages above.
                Their addresses are kept as redirects rather than deleted, so a
                bookmark or a link in someone's notes still lands somewhere
                useful instead of bouncing off the catch-all to the board.
              */}
              <Route path="accounts" element={<Navigate to="/admin/users" replace />} />
              <Route path="reports" element={<Navigate to="/admin/posts?kind=report" replace />} />
              <Route path="moderation/pending" element={<Navigate to="/admin/queue/pending" replace />} />
              <Route path="moderation/approved" element={<Navigate to="/admin/posts?status=approved" replace />} />
              <Route path="moderation/rejected" element={<Navigate to="/admin/posts?status=rejected" replace />} />
              <Route path="moderation/archived" element={<Navigate to="/admin/posts" replace />} />

              <Route path="settings" element={<Settings />} />
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
