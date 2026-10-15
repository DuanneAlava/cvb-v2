import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { PERMISSIONS } from '../data/roles.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useStore, unreadCountFor } from '../services/store.js';
import ConfirmDialog from './ConfirmDialog.jsx';
import { BellIcon, UnreadBadge } from './NotificationBell.jsx';
import { DASHBOARD_PATH, LOGOUT_PATH, MEGAPHONE_PATHS } from './icons.js';
import { Avatar } from './admin/ui.jsx';

/*
 * The profile circle at the right-hand end of the navbar, and the panel that
 * drops down when it is pressed.
 *
 * What is in here:
 *
 *   - who is logged in: profile photo (or initials), full name and school
 *     email
 *   - where to go next: the dashboard, account settings, and - for an
 *     account that may open it - the admin panel. On a phone, also
 *     "Notifications", with the unread count (the navbar bell's job from
 *     `sm` up)
 *   - "Your Suggestions" and "Your Voice Outs", which narrow the board down
 *     to the student's own posts
 *   - "Log out", which asks for confirmation before it does anything
 *
 * The categories are NOT in here. The search box's dropdown offers the same
 * six, and it is always on screen.
 *
 * The panel closes when the student clicks anywhere else on the page or
 * presses Escape, so it never gets stuck open.
 *
 * WHAT YOU'LL MEET IN THIS FILE (plain-English notes)
 *
 * - useRef()  A box that holds a value across re-draws WITHOUT causing one
 *   when it changes. Attached to an element with `ref={menuRef}`, it gives
 *   us a handle on the real DOM node - here, to ask "was that click inside
 *   the menu or outside it?"
 * - document.addEventListener(...)  Listen for an event on the whole page,
 *   not just one element. Set up inside useEffect and removed again in its
 *   cleanup, so the listener does not outlive the menu.
 * - `if (!user) return null`  An early return: a component that renders
 *   `null` draws nothing at all.
 * - `role="menu"` / `role="menuitem"`  Accessibility roles that tell a
 *   screen reader this is a menu, not a list of unrelated buttons.
 * - `aria-expanded`  Tells assistive technology whether the panel is open.
 */
function ProfileMenu() {
  const [open, setOpen] = useState(false);

  // True while the "are you sure?" box is showing. Logging out is a two-step
  // action on purpose: one stray click should not end someone's session.
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  // A handle on the whole menu, so we can tell whether a click landed inside it.
  const menuRef = useRef(null);

  const { user, can, logout } = useAuth();

  /*
   * UNREAD NOTIFICATIONS, FOR PHONES. From `sm` up the navbar has its own
   * bell (NotificationBell.jsx). On a phone there is no room for it, so the
   * same count is shown here instead: a badge on the profile circle and a
   * "Notifications" row in the panel, both hidden from `sm` up so the count
   * is never shown twice.
   */
  const store = useStore();
  const unread = user ? unreadCountFor(store.db, user) : 0;
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Which "your posts" view is showing, if any: 'suggestion', 'concern' or
  // null. These are the two kind families from data/workflow.js - a "voice
  // out" is the student-facing name for a post in the concern family. Only
  // meaningful on the board itself; on any other page nothing is "active".
  const activeMine = location.pathname === '/' ? searchParams.get('mine') : null;

  // Close the panel on a click outside it, and on Escape.
  useEffect(() => {
    if (!open) return undefined;

    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    function handleKey(event) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  // Nothing to show when nobody is logged in; the navbar shows the auth
  // buttons in this component's place instead.
  if (!user) return null;

  /*
   * "YOUR SUGGESTIONS" AND "YOUR VOICE OUTS" ARE LINKS TO THE BOARD.
   *
   * They used to be buttons that wrote ?mine=... into the address of
   * whatever page was open. On the board that filtered the list; on the
   * dashboard or the account page it produced /student/dashboard?mine=concern
   * - an address that changed while nothing on screen did, so the item
   * looked dead. This menu sits in the navbar on every student page, so the
   * item has to work from every student page.
   *
   * A <Link to="/?mine=..."> always lands on the board with the filter set,
   * wherever it is pressed from. The board itself does the scrolling down to
   * the results once it is on screen (see pages/Home.jsx), because from
   * another page there is nothing to scroll to at the moment of the click.
   * The address bar stays the one place filters live, so the board reads
   * this exactly as it reads the search box.
   */
  function myPostsLink(group) {
    return `/?mine=${group}`;
  }

  // Only runs once the student has confirmed in the pop-up. Back to the
  // board afterwards, with any "your posts" filter cleared - there is no
  // "you" to filter by any more.
  async function handleLogout() {
    setConfirmingLogout(false);
    setOpen(false);
    await logout();
    navigate('/');
  }

  // Shared styling for the rows inside the panel.
  // `min-h-[44px]` is the touch-target floor - these rows are the main way the
  // menu is used on a phone, and py-2 alone left them at about 36px.
  const rowClass =
    'flex min-h-[44px] w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors';

  return (
    <div className="relative" ref={menuRef}>
      {/* THE PROFILE CIRCLE. `aria-expanded` tells screen readers whether the
          panel below is currently open. Below `md` the button is just the
          circle - 36px inside 4px of padding, a full 44px tap target - and
          the chevron's 28px go to the greeting and the search box instead. */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Open your profile menu${unread ? `, ${unread} unread notifications` : ''}`}
        className="flex min-h-[44px] items-center gap-2 rounded-full p-1 text-white transition-colors hover:bg-white/10 md:pr-2"
      >
        {/* The student's profile photo, or their initials until they add
            one on the account page - with the unread count on it on a
            phone (see UNREAD NOTIFICATIONS above). */}
        <span className="relative shrink-0">
          <Avatar name={user.name} photo={user.photo} size="nav" tone="glass" />
          <UnreadBadge
            count={unread}
            className="absolute -right-1 -top-1 ring-2 ring-navy-600 sm:hidden"
          />
        </span>

        {/* A small chevron so it is obvious this opens something. It turns
            upside down while the panel is open. From `md` up only: on a
            phone or small tablet a lone avatar circle is a familiar "tap for
            your account". */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
          className={
            'hidden h-4 w-4 transition-transform md:block' + (open ? ' rotate-180' : '')
          }
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* THE DROP-DOWN PANEL. It is only added to the page while it is open. */}
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-72 animate-fade-up overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        >
          {/* 1. WHO IS LOGGED IN. `truncate` stops a long email stretching the panel. */}
          <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
            <Avatar name={user.name} photo={user.photo} size="md" />
            <span className="min-w-0">
              <span className="block truncate font-semibold text-navy-900">{user.name}</span>
              <span className="block truncate text-xs text-slate-500">{user.email}</span>
              {/* Which kind of account this is, so an admin browsing the
                  student site can see which hat they are wearing. */}
              <span className="mt-1 inline-block rounded-full bg-navy-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-navy-700">
                {user.role.replace('_', ' ')}
              </span>
            </span>
          </div>

          {/*
            2. WHERE TO GO NEXT.
            The admin link only exists for an account that may open the panel.
            Hiding it is tidiness, not protection - the route guards in
            components/RequireAuth.jsx are what turn a student away if they
            type the address, and the server has to check the role again.
          */}
          <div className="border-b border-slate-200 p-2">
            <Link
              to="/student/dashboard"
              role="menuitem"
              onClick={() => setOpen(false)}
              className={rowClass + ' text-slate-700 hover:bg-slate-100'}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-4 w-4 text-navy-600">
                <path d={DASHBOARD_PATH} strokeLinejoin="round" />
              </svg>
              Your dashboard
            </Link>

            {/* Phones only - from `sm` up the navbar's bell is the way in. */}
            <Link
              to="/student/dashboard#notifications"
              role="menuitem"
              aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
              onClick={() => setOpen(false)}
              className={rowClass + ' text-slate-700 hover:bg-slate-100 sm:hidden'}
            >
              <BellIcon className="h-4 w-4 text-navy-600" />
              Notifications
              <UnreadBadge count={unread} className="ml-auto" />
            </Link>

            <Link
              to="/account"
              role="menuitem"
              onClick={() => setOpen(false)}
              className={rowClass + ' text-slate-700 hover:bg-slate-100'}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-4 w-4 text-navy-600">
                <path d="M16 19a4 4 0 0 0-8 0M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" strokeLinecap="round" />
              </svg>
              Account settings
            </Link>

            {can(PERMISSIONS.VIEW_ADMIN) && (
              <Link
                to="/admin/dashboard"
                role="menuitem"
                onClick={() => setOpen(false)}
                className={rowClass + ' font-semibold text-navy-700 hover:bg-navy-50'}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-4 w-4">
                  <path d="m9 12 2 2 4-4M12 3l7.5 3.5v5c0 4.5-3 8.2-7.5 9.5-4.5-1.3-7.5-5-7.5-9.5v-5L12 3Z" strokeLinejoin="round" />
                </svg>
                Admin panel
              </Link>
            )}
          </div>

          {/* 3. THE STUDENT'S OWN POSTS. */}
          <div className="p-2">
            <Link
              to={myPostsLink('suggestion')}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={
                activeMine === 'suggestion'
                  ? rowClass + ' bg-navy-50 font-semibold text-navy-700'
                  : rowClass + ' text-slate-700 hover:bg-slate-100'
              }
            >
              {/* A speech bubble, for suggestions the student has posted. */}
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
                className="h-4 w-4 text-navy-600"
              >
                <path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-4.6A8 8 0 1 1 21 12Z" strokeLinejoin="round" />
              </svg>
              Your Suggestions
            </Link>

            <Link
              to={myPostsLink('concern')}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={
                activeMine === 'concern'
                  ? rowClass + ' bg-navy-50 font-semibold text-navy-700'
                  : rowClass + ' text-slate-700 hover:bg-slate-100'
              }
            >
              {/* The hero's "Voice Out" megaphone, with the one sound wave
                  that reads at this size - see icons.js. */}
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-4 w-4 text-navy-600">
                {MEGAPHONE_PATHS.slice(0, 2).map((path) => (
                  <path key={path} d={path} />
                ))}
              </svg>
              Your Voice Outs
            </Link>
          </div>

          {/*
            No "Browse by category" list. The six categories used to be
            repeated here as a column of buttons, but the dropdown in the
            search box already offers exactly the same six - and it is always
            on screen, where this menu is two taps away. The same choice in
            two places was one too many.
          */}

          {/* 4. LOG OUT. This only opens the confirmation - it does not log out yet. */}
          <div className="border-t border-slate-200 p-2">
            <button
              type="button"
              role="menuitem"
              onClick={() => setConfirmingLogout(true)}
              className={rowClass + ' font-semibold text-red-600 hover:bg-red-50'}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
                className="h-4 w-4"
              >
                <path d={LOGOUT_PATH} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Log out
            </button>
          </div>
        </div>
      )}

      {/* THE CONFIRMATION. Logging out only happens once this is answered. */}
      {confirmingLogout && (
        <ConfirmDialog
          title="Are you sure you want to log out?"
          message="You will need to log in again to post a suggestion, voice out or vote."
          confirmLabel="Yes, log out"
          cancelLabel="Stay logged in"
          onConfirm={handleLogout}
          onCancel={() => setConfirmingLogout(false)}
        />
      )}
    </div>
  );
}

export default ProfileMenu;
