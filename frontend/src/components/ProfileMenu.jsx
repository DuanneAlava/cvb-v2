import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CATEGORIES } from '../data/categories.js';
import { PERMISSIONS } from '../data/roles.js';
import { useAuth } from '../context/AuthContext.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';

/*
 * The profile circle at the right-hand end of the navbar, and the panel that
 * drops down when it is pressed.
 *
 * Everything that used to be spread across the navbar now lives in here:
 *
 *   - who is logged in: initials, full name and school email
 *   - "Your Suggestions" and "Your Voice Outs", which narrow the board down
 *     to the student's own posts
 *   - the six category shortcuts
 *   - "Log out", which asks for confirmation before it does anything
 *
 * The panel closes when the student clicks anywhere else on the page or
 * presses Escape, so it never gets stuck open.
 */
function ProfileMenu() {
  const [open, setOpen] = useState(false);

  // True while the "are you sure?" box is showing. Logging out is a two-step
  // action on purpose: one stray click should not end someone's session.
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  // A handle on the whole menu, so we can tell whether a click landed inside it.
  const menuRef = useRef(null);

  const { user, can, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Which "your posts" view is showing, if any: 'suggestion', 'voice' or null.
  const activeMine = searchParams.get('mine');
  const activeCategory = searchParams.get('category');

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

  // The filters live below the hero, so bring the results into view rather
  // than leaving the student looking at an unchanged screen.
  function scrollToBoard() {
    document.getElementById('browse-suggestions')?.scrollIntoView({ behavior: 'smooth' });
  }

  /*
   * Show only this student's posts of one type. The choice goes into the
   * address bar, the same place the search box writes to, so the board has a
   * single set of filters to read no matter which control set them.
   */
  function showMyPosts(type) {
    const next = new URLSearchParams();
    next.set('mine', type);
    setSearchParams(next);
    setOpen(false);
    scrollToBoard();
  }

  // Jump to one category, clearing any other filter that was active.
  function showCategory(slug) {
    const next = new URLSearchParams();
    next.set('category', slug);
    setSearchParams(next);
    setOpen(false);
    scrollToBoard();
  }

  // Only runs once the student has confirmed in the pop-up.
  function handleLogout() {
    logout();
    setConfirmingLogout(false);
    setOpen(false);
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
          panel below is currently open. */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Open your profile menu"
        className="flex min-h-[44px] items-center gap-2 rounded-full p-1 pr-2 text-white transition-colors hover:bg-white/10"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/20 text-xs font-bold">
          {user.initials}
        </span>

        {/* A small chevron so it is obvious this opens something. It turns
            upside down while the panel is open. */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
          className={open ? 'h-4 w-4 rotate-180 transition-transform' : 'h-4 w-4 transition-transform'}
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
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy-600 text-sm font-bold text-white">
              {user.initials}
            </span>
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
                <path d="M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6V11h-6v9Zm0-16v5h6V4h-6Z" strokeLinejoin="round" />
              </svg>
              Your dashboard
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
            <button
              type="button"
              role="menuitem"
              onClick={() => showMyPosts('suggestion')}
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
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => showMyPosts('voice')}
              className={
                activeMine === 'voice'
                  ? rowClass + ' bg-navy-50 font-semibold text-navy-700'
                  : rowClass + ' text-slate-700 hover:bg-slate-100'
              }
            >
              {/* The same megaphone used on the "Voice Out" button in the hero. */}
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-4 w-4 text-navy-600">
                <path d="M3 10.5v3a1.5 1.5 0 0 0 1.5 1.5H6l3.2 3.7a1 1 0 0 0 1.8-.7V5.5a1 1 0 0 0-1.8-.7L6 8.5H4.5A1.5 1.5 0 0 0 3 10.5Z" />
                <path d="M14.5 9a1 1 0 0 1 1.4 0 4.3 4.3 0 0 1 0 6 1 1 0 1 1-1.4-1.4 2.3 2.3 0 0 0 0-3.2 1 1 0 0 1 0-1.4Z" />
              </svg>
              Your Voice Outs
            </button>
          </div>

          {/* 4. THE CATEGORY SHORTCUTS that used to sit across the navbar. */}
          <div className="border-t border-slate-200 p-2">
            <p className="px-3 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Browse by category
            </p>
            {CATEGORIES.map((item) => (
              <button
                key={item.slug}
                type="button"
                role="menuitem"
                onClick={() => showCategory(item.slug)}
                className={
                  activeCategory === item.slug
                    ? rowClass + ' bg-navy-50 font-semibold text-navy-700'
                    : rowClass + ' text-slate-700 hover:bg-slate-100'
                }
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* 5. LOG OUT. This only opens the confirmation - it does not log out yet. */}
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
                <path
                  d="M15 17l5-5-5-5M20 12H9M12 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
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
