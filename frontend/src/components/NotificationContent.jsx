import { TONE_CLASS, notificationInfo } from '../data/workflow.js';
import { Badge, timeAgo } from './admin/ui.jsx';

/*
 * ONE NOTIFICATION, DRAWN - the unread dot, the title with its type badge,
 * the message, and when it arrived. The same on the admin panel's
 * Notifications page (pages/admin/Notifications.jsx) and on a student's
 * dashboard (pages/student/Dashboard.jsx). Each page supplies the row around
 * it: a link or a button on the admin page, a plain list item on the
 * dashboard - so this draws only <span>s, which may sit inside either.
 *
 * Props:
 * - note     a notification, as GET /api/state sends it
 * - compact  for a narrow panel: a smaller title, and the time under the
 *            message instead of at the right
 */
function NotificationContent({ note, compact = false }) {
  const info = notificationInfo(note.type);
  const time = timeAgo(note.createdAt);

  return (
    <>
      {/* An unread row is marked with a dot rather than a different
          background, so a long list does not turn into stripes. */}
      <span
        aria-hidden="true"
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${note.read ? 'bg-transparent' : 'bg-navy-600'}`}
      />

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className={`${compact ? 'text-sm ' : ''}font-semibold ${note.read ? 'text-slate-600' : 'text-navy-900'}`}>
            {note.title}
          </span>
          <Badge className={TONE_CLASS[info.tone]}>{info.label}</Badge>
        </span>
        {note.body && <span className="mt-0.5 block text-sm text-slate-500">{note.body}</span>}
        {compact && <span className="mt-1 block text-xs text-slate-400">{time}</span>}
      </span>

      {!compact && <span className="shrink-0 whitespace-nowrap text-xs text-slate-400">{time}</span>}
    </>
  );
}

export default NotificationContent;
