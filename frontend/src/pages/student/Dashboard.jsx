import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { TONE_CLASS, kindInfo, notificationInfo, statusInfo, departmentLabel } from '../../data/workflow.js';
import { useStore, userActivity, notificationsFor, voteCount } from '../../services/store.js';
import Layout from '../../components/Layout.jsx';
import Button from '../../components/Button.jsx';
import PostModal from '../../components/PostModal.jsx';
import {
  Badge,
  CategoryBadge,
  EmptyState,
  KindBadge,
  Panel,
  StatCard,
  StatusBadge,
  formatDate,
  timeAgo,
} from '../../components/admin/ui.jsx';

/*
 * The student's own dashboard - the other half of the platform the admin panel
 * manages.
 *
 * It exists to close the loop. A student who submits a concern and then hears
 * nothing assumes the box is a bin; this page shows them exactly where their
 * submission is, who is handling it, and what was eventually done about it -
 * the same records the admin was working on, read from the student's side.
 */
function StudentDashboard() {
  const { user } = useAuth();
  const store = useStore(user);
  const [modalMode, setModalMode] = useState(null);
  const [error, setError] = useState('');

  const activity = useMemo(() => userActivity(store.db, user.id), [store.db, user.id]);

  const mySubmissions = useMemo(
    () =>
      store.db.posts
        .filter((post) => post.authorId === user.id)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [store.db.posts, user.id]
  );

  const myNotifications = useMemo(
    () => notificationsFor(store.db, user).slice(0, 8),
    [store.db, user]
  );

  const unread = myNotifications.filter((note) => !note.read).length;

  function addSubmission({ type, kind, category, title, message, anonymous, attachments }) {
    try {
      const result = store.createPost({
        type,
        kind,
        category,
        title,
        message,
        anonymous,
        attachments,
        authorId: user.id,
      });
      if (result?.error) setError(result.error);
      else setError('');
    } catch (failure) {
      setError(failure.message);
    }
  }

  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            {/* Named, for the same reason as the admin dashboard: an admin
                holds both, and two pages that open with a greeting and
                nothing else are indistinguishable at a glance. */}
            <h1 className="text-2xl font-bold text-navy-900">Your Dashboard</h1>
            <p className="mt-1 text-sm text-slate-500">
              Welcome back, {user.name.split(' ')[0]} - everything you have sent in, and where
              each one has got to.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="sm" onClick={() => setModalMode('suggestion')}>
              Post a Suggestion
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setModalMode('voice')}>
              Voice Out
            </Button>
          </div>
        </div>

        {user.status === 'suspended' && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            Your account is suspended, so posting and voting are turned off. You can still read the
            board. Please contact the Student Affairs office.
          </p>
        )}

        {error && (
          <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Submissions" value={activity.total} />
          <StatCard label="Awaiting review" value={activity.pending} tone={activity.pending ? 'warn' : 'default'} />
          <StatCard label="Published" value={activity.approved} tone="good" />
          <StatCard label="Resolved" value={activity.resolved} tone="good" />
          <StatCard label="Votes you cast" value={activity.votesCast} />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {/* WHAT THEY SENT IN, AND WHERE IT IS NOW. */}
          <Panel
            className="lg:col-span-2"
            title="Your submissions"
            description="Newest first."
            actions={
              <Link
                to="/"
                // Padded to the 44px touch floor: this is a standalone action,
                // not a link inside a sentence, so it needs a real target.
                className="-mx-2 inline-flex min-h-[44px] items-center rounded-lg px-2 text-sm font-semibold text-navy-600 hover:bg-navy-50 hover:underline"
              >
                Browse the board
              </Link>
            }
          >
            {mySubmissions.length === 0 ? (
              <EmptyState
                title="You have not posted yet"
                message="Post a suggestion or voice out a concern, and you can follow it from here."
              >
                <Button variant="primary" size="sm" onClick={() => setModalMode('suggestion')}>
                  Post a Suggestion
                </Button>
              </EmptyState>
            ) : (
              <ul className="space-y-3">
                {mySubmissions.map((post) => {
                  const status = statusInfo(post.status);

                  return (
                    <li key={post.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={post.status} />
                        <KindBadge kind={post.kind} />
                        <CategoryBadge category={post.category} />
                        {post.anonymous && (
                          <Badge className="bg-slate-100 text-slate-600">Anonymous</Badge>
                        )}
                        <span className="ml-auto text-xs text-slate-400">
                          {formatDate(post.createdAt)}
                        </span>
                      </div>

                      <h3 className="mt-2 font-bold text-navy-900">{post.title}</h3>
                      <p className="mt-1 text-sm text-slate-600">{post.message}</p>

                      {/* WHAT HAPPENED NEXT. Each of these only appears when
                          there is actually something to tell them. */}
                      {post.status === 'rejected' && post.rejectionReason && (
                        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                          <strong>Not approved:</strong> {post.rejectionReason}
                        </p>
                      )}


                      {post.department && (
                        <p className="mt-3 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
                          <strong>Being handled by:</strong> {departmentLabel(post.department)}
                          {post.assignedTo && ` · ${post.assignedTo}`}
                        </p>
                      )}

                      {post.resolution && (
                        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                          <strong>Resolved:</strong> {post.resolution}
                        </p>
                      )}

                      <div className="mt-3 flex items-center gap-3 border-t border-slate-100 pt-2 text-xs text-slate-500">
                        <span>{voteCount(store.db, post.id)} votes</span>
                        <span className="text-slate-300">·</span>
                        <span>{status.public ? 'Visible on the board' : 'Not published yet'}</span>
                        <span className="ml-auto">Updated {timeAgo(post.updatedAt)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {/* WHAT THEY HAVE BEEN TOLD. */}
          <Panel
            title="Notifications"
            description={unread > 0 ? `${unread} unread` : 'You are up to date.'}
            actions={
              unread > 0 && (
                <button
                  type="button"
                  onClick={() => store.markAllNotificationsRead(user)}
                  className="text-xs font-semibold text-navy-600 hover:underline"
                >
                  Mark all read
                </button>
              )
            }
          >
            {myNotifications.length === 0 ? (
              <EmptyState
                title="Nothing yet"
                message="You will be told here when a submission of yours is reviewed or resolved."
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {myNotifications.map((note) => {
                  const info = notificationInfo(note.type);
                  return (
                    <li key={note.id} className="flex items-start gap-2.5 py-3">
                      <span
                        aria-hidden="true"
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                          note.read ? 'bg-transparent' : 'bg-navy-600'
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className={`text-sm font-semibold ${note.read ? 'text-slate-600' : 'text-navy-900'}`}>
                            {note.title}
                          </p>
                          <Badge className={TONE_CLASS[info.tone]}>{info.label}</Badge>
                        </div>
                        {note.body && <p className="mt-0.5 text-sm text-slate-500">{note.body}</p>}
                        <p className="mt-1 text-xs text-slate-400">{timeAgo(note.createdAt)}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      {modalMode && (
        <PostModal
          mode={modalMode}
          onClose={() => setModalMode(null)}
          onSubmit={addSubmission}
        />
      )}
    </Layout>
  );
}

export default StudentDashboard;
