import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useStore, unreadCountFor } from '../services/store.js';
import { BELL_PATH } from './icons.js';

/*
 * THE NOTIFICATION BELL in the student navbar, with the number unread - and
 * the two small pieces every way into notifications shares.
 *
 * It works like the bell in the admin header (components/admin/
 * AdminLayout.jsx): a link, not a drop-down. The notifications themselves
 * are listed in one place - the Notifications panel on the student
 * dashboard, which has "Mark all read" - and the bell takes the student
 * straight to it (`#notifications`; Dashboard.jsx scrolls it into view).
 *
 * FROM `sm` (640px) UP ONLY. On a phone the navbar has no room for another
 * 44px button beside the search box, the greeting and the profile circle -
 * it would cut "Hi, Juan" down to "Hi, Ju...". There, the same count is a
 * badge on the profile circle and "Notifications" is a row in the profile
 * menu (components/ProfileMenu.jsx). One number, from unreadCountFor in
 * services/store.js, so every place agrees.
 *
 * SHARED PIECES, exported for the profile menu and the admin header so the
 * bell and the count look and behave the same everywhere:
 *   BellIcon      the bell drawing (its shape, BELL_PATH, is in icons.js,
 *                 where the admin sidebar reads it too)
 *   UnreadBadge   the red count, which reads "9+" past nine so it never
 *                 outgrows what it sits on
 */

export function BellIcon({ className = 'h-5 w-5' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={BELL_PATH} />
    </svg>
  );
}

/*
 * The red count. Draws nothing at zero. `className` places it - pinned to a
 * corner of the bell or the profile circle, or at the end of a menu row. It
 * is hidden from screen readers: the link or button it sits on says the
 * count in words ("Notifications, 3 unread").
 */
export function UnreadBadge({ count, className = '' }) {
  if (!(count > 0)) return null;

  return (
    <span
      aria-hidden="true"
      className={`grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ${className}`}
    >
      {count > 9 ? '9+' : count}
    </span>
  );
}

function NotificationBell() {
  const { user } = useAuth();
  const store = useStore();

  if (!user) return null;
  const unread = unreadCountFor(store.db, user);

  return (
    <Link
      to="/student/dashboard#notifications"
      aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
      className="relative hidden h-11 w-11 shrink-0 place-items-center rounded-full text-white transition-colors hover:bg-white/10 sm:grid"
    >
      <BellIcon />
      <UnreadBadge count={unread} className="absolute right-0.5 top-0.5 ring-2 ring-navy-600" />
    </Link>
  );
}

export default NotificationBell;
