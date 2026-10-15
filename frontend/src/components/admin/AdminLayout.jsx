import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { PERMISSIONS } from '../../data/roles.js';
import { AWAITING_REVIEW, isOpenWork } from '../../data/workflow.js';
import { OPEN_PRIVACY_STATUSES } from '../../data/policies.js';
import { useStore, unreadCountFor } from '../../services/store.js';
import Logo from '../Logo.jsx';
import ConfirmDialog from '../ConfirmDialog.jsx';
import PolicyLinks from '../PolicyLinks.jsx';
import { UnreadBadge } from '../NotificationBell.jsx';
import { BELL_PATH, DASHBOARD_PATH, LOGOUT_PATH } from '../icons.js';
import { Avatar, Badge, RoleBadge } from './ui.jsx';

/*
 * The frame every admin page sits inside: sidebar down the left, a slim bar
 * across the top, and the page itself in the remaining space.
 *
 * LAYOUT
 * Desktop first, because moderating a queue of submissions is desk work - the
 * sidebar is always open from the `lg` breakpoint up. Below that it becomes a
 * panel that slides in over the page, which is the pattern the student site's
 * own menus already use.
 *
 * WHAT APPEARS IN THE SIDEBAR
 * Each entry names the permission it needs, and an entry whose permission the
 * signed-in admin does not hold is simply not built. Today's one admin role
 * holds everything, so it sees every entry; a narrower role added later - a
 * moderator without MANAGE_USERS, say - gets a shorter sidebar without any
 * page having to check the role itself.
 *
 * Hiding a link is a tidiness measure, not a security one - the route guards
 * in components/RequireAuth.jsx are what stop somebody typing the address, and
 * the server is what has to stop them for real.
 *
 * WHAT YOU'LL MEET IN THIS FILE (plain-English notes)
 *
 * - A "layout" component  A frame that draws the parts every page shares
 *   (sidebar, header) and puts <Outlet /> where the current page goes.
 *   App.js nests every /admin route inside it.
 * - Navigation as data  buildNav() returns a list of sections, each a list
 *   of items { to, label, icon, permission }. The sidebar is drawn by looping
 *   over that list, so adding a page is adding one object, not new markup.
 * - `.filter(...)` then `.map(...)` on that list  Drop the sections and rows
 *   the signed-in admin may not use, then draw what is left.
 * - <NavLink>  A <Link> that also knows whether it points at the current
 *   address, for highlighting the active row. This file works that out by
 *   hand (see NavItem) because it also has to compare the query string.
 * - An SVG icon  `<svg viewBox="0 0 24 24"><path d="..." /></svg>` draws an
 *   icon from a string of coordinates. The strings live in ICONS; `d` is
 *   the path data, `stroke="currentColor"` makes it take the text colour.
 * - `fixed inset-y-0 left-0 w-64`  Pin the sidebar to the left edge, full
 *   height, 16rem wide; `lg:pl-64` on the content leaves exactly that much
 *   room from the large breakpoint up. Below it the sidebar becomes a
 *   slide-over drawn only while `menuOpen` is true.
 * - `z-40` / `z-50`  Stacking order: which layer sits on top of which.
 * - `aria-current="page"`  Marks the link for the page you are on, for
 *   assistive technology.
 */

/* ------------------------------------------------------------------ *
 * Icons, kept small and in one place
 * ------------------------------------------------------------------ */

const ICONS = {
  dashboard: DASHBOARD_PATH,
  monitor: 'M4 5h16v11H4zM9 20h6M12 16v4',
  users: 'M16 19a4 4 0 0 0-8 0M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM20 19a3 3 0 0 0-4-2.8',
  // A shield being stamped: the approval gate nothing reaches the board without.
  approval: 'm9 12 2 2 4-4M12 3l7.5 3.5v5c0 4.5-3 8.2-7.5 9.5-4.5-1.3-7.5-5-7.5-9.5v-5L12 3Z',
  // A wrench: already approved, somebody is working on it.
  progress:
    'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9l-3.8 3.8Z',
  analytics: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  // The same bell as the student navbar's - see icons.js.
  bell: BELL_PATH,
  logs: 'M8 6h11M8 12h11M8 18h11M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  departments: 'M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4M9 11h.01M15 11h.01',
  // A plain shield: people's rights over their own information.
  privacy: 'M12 3l7.5 3.5v5c0 4.5-3 8.2-7.5 9.5-4.5-1.3-7.5-5-7.5-9.5v-5L12 3Z',
  exports: 'M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.5-2-3.4-2.4 1a7.5 7.5 0 0 0-2-1.2L14.5 3h-4l-.4 2.7c-.7.3-1.4.7-2 1.2l-2.4-1-2 3.4 2 1.5a7.4 7.4 0 0 0 0 2.4l-2 1.5 2 3.4 2.4-1c.6.5 1.3.9 2 1.2l.4 2.7h4l.4-2.7c.7-.3 1.4-.7 2-1.2l2.4 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z',
};

function Icon({ path, className = 'h-4 w-4' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={path} />
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * The navigation, described as data
 *
 * Adding a page means adding a line here. Nothing else in the layout has to
 * change, which is the point: the sidebar should not be a place future
 * features have to fight with.
 * ------------------------------------------------------------------ */

function buildNav(counts) {
  return [
    {
      items: [{ to: '/admin/dashboard', label: 'Dashboard', icon: ICONS.dashboard }],
    },

    /*
     * WORK - what the office owes students right now.
     *
     * Both entries carry a live count and both drain to zero when the team is
     * caught up. This is the morning check, and it is kept apart from
     * Monitoring on purpose: "what needs doing" and "where do I look that up"
     * are different questions, and mixing them buried the first in a list of
     * the second.
     *
     * These are TEAM queues, not personal ones - the system assigns work to a
     * department, not to an individual admin, so nothing here says "mine".
     *
     * "Open Work", not "Open Concerns": the second queue holds every approved
     * post a department has to act on, and that includes a request, which is
     * not a concern. Naming it after the family it mostly holds hid the ones
     * it did not.
     *
     * The two icons are deliberately different. They used to share one glyph,
     * which made the icon column pure decoration - two rows stacked directly
     * on top of each other with the same mark cannot tell you which is which,
     * so the eye has to read the label every time. A shield for the gate a
     * post has to pass, a wrench for the work that starts once it has.
     */
    {
      title: 'Work',
      permission: PERMISSIONS.MODERATE_POSTS,
      items: [
        {
          to: '/admin/queue/pending',
          label: 'Pending Approval',
          icon: ICONS.approval,
          badge: counts.pending,
        },
        {
          to: '/admin/queue/open',
          label: 'Open Work',
          icon: ICONS.progress,
          badge: counts.openWork,
        },
      ],
    },

    /*
     * MONITORING - the whole record, for looking things up.
     *
     * One row, and it took three goes to get there. "Reports" went first: a
     * report is a KIND of concern, so every row it listed was already under
     * Concerns. Then "Suggestions" and "Concerns" themselves - each was the
     * same page with a family pinned, kept alive only because the type
     * dropdown could pick one kind at a time and so had no way to say "every
     * concern". It can now, so all three are filters on this page rather
     * than destinations beside it.
     *
     * No counts in this group. A count is a thing to be done, and these are
     * for looking things up - that work lives under Work, above.
     */
    {
      title: 'Monitoring',
      permission: PERMISSIONS.VIEW_ADMIN,
      items: [{ to: '/admin/posts', label: 'All Submissions', icon: ICONS.monitor }],
    },

    /*
     * PEOPLE - accounts, and nothing else.
     *
     * "Students" was this page with ?role=student on it, and "Account
     * Management" was quite literally the same component again under a second
     * name. Both are gone; the role dropdown on the Users page does that job.
     *
     * "Departments" sat here too and did not belong: it never reads a single
     * user record, only posts. It answers "where is the work and how long is
     * it taking", which is an Insights question, so that is where it now is.
     *
     * Privacy Requests are people asking about their own information - kept
     * apart from the submission queues on purpose: a deletion request is
     * not moderation, and is not handled by whoever approves posts unless
     * they also hold MANAGE_PRIVACY. Its count is the open requests this
     * admin may handle (not ones about their own account).
     */
    {
      title: 'People',
      items: [
        {
          to: '/admin/users',
          label: 'Users',
          icon: ICONS.users,
          end: true,
          permission: PERMISSIONS.MANAGE_USERS,
        },
        {
          to: '/admin/privacy',
          label: 'Privacy Requests',
          icon: ICONS.privacy,
          badge: counts.privacy,
          permission: PERMISSIONS.MANAGE_PRIVACY,
        },
      ],
    },

    {
      title: 'Insights',
      items: [
        {
          to: '/admin/analytics',
          label: 'Analytics',
          icon: ICONS.analytics,
          permission: PERMISSIONS.VIEW_ANALYTICS,
        },
        {
          /*
           * Guarded by MANAGE_CONCERNS, not MANAGE_USERS. Assigning work to a
           * department is what this page reports on, and that is the
           * permission gating it in the review dialog. Both admin roles hold
           * both today so nothing changes now - it matters the first time
           * somebody adds a narrower role, where the old guard would have let
           * a moderator hand work to Facilities and then never see Facilities'
           * backlog.
           */
          to: '/admin/departments',
          label: 'Departments',
          icon: ICONS.departments,
          permission: PERMISSIONS.MANAGE_CONCERNS,
        },
        {
          to: '/admin/exports',
          label: 'Reports & Exports',
          icon: ICONS.exports,
          permission: PERMISSIONS.VIEW_ANALYTICS,
        },
      ],
    },

    /*
     * No "Notifications" row. The bell in the header is the one way in, with
     * the one unread count; a second copy here put the same number on two
     * badges a few centimetres apart - and beside the Pending Approval
     * badge, which for a new submission was counting the same event a third
     * time. The header bell is visible on every page at every width, so the
     * page lost nothing by leaving the sidebar.
     */
    {
      title: 'System',
      items: [
        {
          to: '/admin/activity',
          label: 'Activity Logs',
          icon: ICONS.logs,
          permission: PERMISSIONS.VIEW_AUDIT_LOG,
        },
        { to: '/admin/system', label: 'System', icon: ICONS.settings },
      ],
    },
  ];
}

/* ------------------------------------------------------------------ *
 * One sidebar row
 * ------------------------------------------------------------------ */

function NavItem({ item, onNavigate }) {
  const location = useLocation();

  /*
   * NavLink's own matching compares the path only, so "/admin/users" and
   * "/admin/users?role=student" would both light up at once. Anything with a
   * query string is matched against the full address instead.
   */
  const [path, query] = item.to.split('?');
  const isActive = query
    ? location.pathname === path && location.search === `?${query}`
    : location.pathname.startsWith(path) && (!item.end || location.search === '');

  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={`flex min-h-[44px] items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
        isActive
          ? 'bg-white/15 font-semibold text-white'
          : 'text-white/70 hover:bg-white/10 hover:text-white'
      }`}
    >
      <Icon path={item.icon} />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>

      {/* A count only appears when there is something waiting. A badge showing
          "0" is noise that trains people to ignore badges. */}
      {item.badge > 0 && (
        <Badge className="bg-red-500 text-white">{item.badge > 99 ? '99+' : item.badge}</Badge>
      )}
    </NavLink>
  );
}

/* ------------------------------------------------------------------ *
 * The layout
 * ------------------------------------------------------------------ */

function AdminLayout() {
  const { user, can, logout } = useAuth();
  const { db } = useStore();
  const navigate = useNavigate();
  const location = useLocation();

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  // Close the slide-over whenever the address changes, so tapping a link on a
  // phone does not leave the panel covering the page it just opened.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.search]);

  // The numbers on the sidebar badges, recounted whenever the data changes.
  const counts = useMemo(
    () => ({
      pending: db.posts.filter((post) => AWAITING_REVIEW.includes(post.status)).length,
      // Everything a department has to act on - see isOpenWork in
      // data/workflow.js.
      openWork: db.posts.filter(isOpenWork).length,
      privacy: db.privacyRequests.filter(
        (request) => OPEN_PRIVACY_STATUSES.includes(request.status) && request.userId !== user?.id
      ).length,
      unread: unreadCountFor(db, user),
    }),
    [db, user]
  );

  // Drop any section or row the signed-in admin has no permission for.
  const nav = useMemo(
    () =>
      buildNav(counts)
        .filter((section) => !section.permission || can(section.permission))
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => !item.permission || can(item.permission)),
        }))
        .filter((section) => section.items.length > 0),
    [counts, can]
  );

  async function handleLogout() {
    setConfirmingLogout(false);
    await logout();
    navigate('/');
  }

  const sidebar = (
    <div className="flex h-full flex-col bg-navy-800">
      {/* The logo, linking to the dashboard - the same mark and wordmark the
          student site uses, so the two never look unrelated. The board is
          reached from "View site" in the top bar. */}
      <div className="border-b border-white/10 px-4 py-4">
        <Link to="/admin/dashboard" className="flex min-h-[44px] items-center">
          <Logo tone="light" subtitle="Admin Panel" />
        </Link>
      </div>

      <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4">
        {nav.map((section, index) => (
          <div key={section.title ?? index}>
            {section.title && (
              <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-white/40">
                {section.title}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavItem key={item.to} item={item} onNavigate={() => setMenuOpen(false)} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/*
        THE WAY OUT. Only that: who is signed in is shown once, in the header,
        where the avatar is also the link to the profile. This footer used to
        carry a second avatar, name and email a few centimetres away from the
        header's - the same identity twice on every screen.
      */}
      <div className="border-t border-white/10 p-3">
        <button
          type="button"
          onClick={() => setConfirmingLogout(true)}
          className="flex min-h-[44px] w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold text-red-300 transition-colors hover:bg-red-500/15 hover:text-red-200"
        >
          <Icon path={LOGOUT_PATH} />
          Log out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* THE FIXED SIDEBAR, from the large breakpoint upwards. */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">{sidebar}</aside>

      {/* THE SLIDE-OVER, below that breakpoint. Both use the same markup. */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-navy-900/60"
            onClick={() => setMenuOpen(false)}
            role="presentation"
          />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] animate-fade-up shadow-xl">
            {sidebar}
          </aside>
        </div>
      )}

      {/* `lg:pl-64` leaves exactly the sidebar's width free for the page. */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            {/* The burger, only on the screens where the sidebar is hidden. */}
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open the admin menu"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-navy-700 transition-colors hover:bg-slate-100 lg:hidden"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              </svg>
            </button>

            {/*
              THE WAY TO THE STUDENT SIDE. An administrator can use the board
              like everybody else - read, post and vote. "Admin panel" in the
              profile menu there brings them back.
            */}
            <Link
              to="/"
              className="flex min-h-[44px] items-center rounded-lg px-3 text-sm font-semibold text-navy-700 transition-colors hover:bg-slate-100"
            >
              View site
            </Link>

            <div className="ml-auto flex items-center gap-2">
              {/*
                THE NOTIFICATION BELL - the only way to the notifications
                page, and the only place its unread count is shown. The
                count covers things with no queue of their own (a new
                account, something about this admin's own posts); a new
                submission is counted once, on the Pending Approval badge.
              */}
              <Link
                to="/admin/notifications"
                aria-label={`Notifications${counts.unread ? `, ${counts.unread} unread` : ''}`}
                aria-current={location.pathname.startsWith('/admin/notifications') ? 'page' : undefined}
                className={`relative grid h-11 w-11 place-items-center rounded-lg text-navy-700 transition-colors hover:bg-slate-100 ${
                  location.pathname.startsWith('/admin/notifications') ? 'bg-slate-100' : ''
                }`}
              >
                <Icon path={ICONS.bell} className="h-5 w-5" />
                <UnreadBadge count={counts.unread} className="absolute -right-0.5 -top-0.5" />
              </Link>

              {/*
                WHO IS SIGNED IN - and the way to their profile. One place,
                one link. The avatar used to sit here doing nothing while the
                sidebar footer carried a second copy that was the link.
              */}
              <Link
                to="/admin/profile"
                aria-label="Your profile"
                // /admin/profile forwards to the admin's own user page, so
                // that is the address that counts as "here".
                aria-current={location.pathname === `/admin/users/${user?.id}` ? 'page' : undefined}
                className={`flex min-h-[44px] items-center gap-2 rounded-lg px-2 transition-colors hover:bg-slate-100 ${
                  location.pathname === `/admin/users/${user?.id}` ? 'bg-slate-100' : ''
                }`}
              >
                <Avatar name={user?.name} photo={user?.photo} size="sm" />
                <span className="hidden max-w-[12rem] truncate text-sm font-semibold text-navy-900 md:block">
                  {user?.name}
                </span>
                <span className="hidden sm:block">
                  <RoleBadge role={user?.role} />
                </span>
              </Link>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>

        {/* The policies and the cookie choice - on every admin page, as the
            student site's footer has them on every page there. */}
        <footer className="border-t border-slate-200 px-4 py-2 sm:px-6 lg:px-8">
          <PolicyLinks />
        </footer>
      </div>

      {confirmingLogout && (
        <ConfirmDialog
          title="Are you sure you want to log out?"
          message="You will need to log in again to return to the admin panel."
          confirmLabel="Yes, log out"
          cancelLabel="Stay logged in"
          onConfirm={handleLogout}
          onCancel={() => setConfirmingLogout(false)}
        />
      )}
    </div>
  );
}

export default AdminLayout;
