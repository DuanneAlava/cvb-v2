import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { TONE_CLASS, notificationInfo } from '../../data/workflow.js';
import { useStore, notificationsFor } from '../../services/store.js';
import Button from '../../components/Button.jsx';
import { Badge, EmptyState, PageHeader, Panel, Select, timeAgo } from '../../components/admin/ui.jsx';

/*
 * The notification centre.
 *
 * Notifications are written by services/store.js as part of the action that
 * caused them, so this page only reads. That is what stops the familiar bug
 * where a status changes but nobody is told, because the notification was a
 * second step somebody forgot to call.
 *
 * Who gets what is decided by the type's `audience` in data/workflow.js:
 * 'admin' notifications go to everybody who can open the panel, 'author' ones
 * go to the student concerned. Adding a type there is all that is needed for
 * it to be delivered and to appear here.
 *
 * WHAT IS NOT HERE: new submissions. They go straight to the Pending
 * Approval queue and are counted there, once. This page carries the things
 * that have no queue - a new account, and anything about the signed-in
 * admin's own posts - so its unread count never duplicates a queue badge.
 *
 * WHAT YOU'LL MEET IN THIS FILE (plain-English notes)
 *
 * - notificationsFor(db, user)  The store's selector for "which
 *   notifications is this person allowed to see" - their own, plus the
 *   admin feed if they can open the panel.
 * - `[...new Set(all.map((note) => note.type))]`  Collect every type that
 *   appears, once each: map to the types, de-duplicate with a Set, spread
 *   back into an array. That is the dropdown's option list.
 * - The same markup in a <Link> or a <button>  `body` is built once and
 *   dropped inside whichever wrapper fits: a link when the notification
 *   points somewhere, a button when it only needs marking as read. One
 *   piece of markup, two behaviours.
 * - Local useState for the filter  Unlike the Submissions page, this filter
 *   is not in the address bar: it is a passing choice, not a view anyone
 *   would bookmark.
 */
function Notifications() {
  const { user } = useAuth();
  const store = useStore(user);
  const [filter, setFilter] = useState('all');

  const all = useMemo(() => notificationsFor(store.db, user), [store.db, user]);
  const unreadCount = all.filter((note) => !note.read).length;

  const visible = useMemo(() => {
    if (filter === 'unread') return all.filter((note) => !note.read);
    if (filter === 'all') return all;
    return all.filter((note) => note.type === filter);
  }, [all, filter]);

  // Only offer a type in the dropdown if something of that type has arrived -
  // a filter that can only ever return nothing is just clutter.
  const typeOptions = useMemo(() => {
    const present = [...new Set(all.map((note) => note.type))];
    return present.map((type) => ({ value: type, label: notificationInfo(type).label }));
  }, [all]);

  return (
    <>
      <PageHeader
        title="Notifications"
        description={
          unreadCount > 0
            ? `${unreadCount} unread`
            : 'Everything here has been read.'
        }
      >
        {/*
          The shared control styling carries `w-full`, which is what the
          filter bars want - each control filling its grid cell. In a header
          it made the dropdown claim the whole row and push "Mark all as
          read" onto a second line. Constraining the wrapper fixes it without
          touching CONTROL, which every input in the panel depends on.
        */}
        <div className="w-full sm:w-52">
          <Select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            aria-label="Filter notifications"
            options={[
              { value: 'all', label: `All (${all.length})` },
              { value: 'unread', label: `Unread (${unreadCount})` },
              ...typeOptions,
            ]}
          />
        </div>

        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={() => store.markAllNotificationsRead(user)}>
            Mark all as read
          </Button>
        )}
      </PageHeader>

      <Panel>
        {visible.length === 0 ? (
          <EmptyState
            title="Nothing here"
            message={
              filter === 'unread'
                ? 'Every notification has been read.'
                : 'New accounts and updates on your own submissions appear here. New submissions go straight to the Pending Approval queue.'
            }
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {visible.map((note) => {
              const info = notificationInfo(note.type);

              const body = (
                <>
                  {/* An unread row is marked with a dot rather than a different
                      background, so a long list does not turn into stripes. */}
                  <span
                    aria-hidden="true"
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      note.read ? 'bg-transparent' : 'bg-navy-600'
                    }`}
                  />

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className={`font-semibold ${note.read ? 'text-slate-600' : 'text-navy-900'}`}>
                        {note.title}
                      </span>
                      <Badge className={TONE_CLASS[info.tone]}>{info.label}</Badge>
                    </span>
                    {note.body && <span className="mt-0.5 block text-sm text-slate-500">{note.body}</span>}
                  </span>

                  <span className="shrink-0 whitespace-nowrap text-xs text-slate-400">
                    {timeAgo(note.createdAt)}
                  </span>
                </>
              );

              return (
                <li key={note.id}>
                  {note.link ? (
                    <Link
                      to={note.link}
                      onClick={() => store.markNotificationRead(note.id)}
                      className="-mx-2 flex min-h-[44px] items-start gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-navy-50/60"
                    >
                      {body}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => store.markNotificationRead(note.id)}
                      className="-mx-2 flex min-h-[44px] w-full items-start gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-navy-50/60"
                    >
                      {body}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </>
  );
}

export default Notifications;
