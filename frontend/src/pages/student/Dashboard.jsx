import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { PERMISSIONS } from '../../data/roles.js';
import { statusInfo, departmentLabel } from '../../data/workflow.js';
import {
  useStore,
  userActivity,
  notificationsFor,
  unreadCountFor,
  firstNameOf,
} from '../../services/store.js';
import Layout from '../../components/Layout.jsx';
import Button from '../../components/Button.jsx';
import BackButton from '../../components/BackButton.jsx';
import PostModal from '../../components/PostModal.jsx';
import NotificationContent from '../../components/NotificationContent.jsx';
import {
  Badge,
  CategoryBadge,
  EmptyState,
  KindBadge,
  Notice,
  Panel,
  StatCard,
  StatusBadge,
  formatDate,
  plural,
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
 *
 * WHAT YOU'LL MEET IN THIS FILE (plain-English notes)
 *
 * - Shared building blocks from components/admin/ui.jsx  Badge, Panel,
 *   StatCard and the date helpers are the admin panel's, reused here so a
 *   status looks identical to the student and to the admin.
 * - `.slice(0, 8)`  The first eight items of a list - "show the latest few".
 * - `.map((post) => <li key={post.id}>...)`  Turn a list of records into a
 *   list of elements. The `key` is how React tells the items apart when the
 *   list changes; it must be unique and stable, which is why it is the id.
 * - `{post.department && (<p>...</p>)}`  Draw the "being handled by" line
 *   only when there is a department. The same `&&` trick appears for the
 *   rejection reason and the resolution.
 * - `firstNameOf(user.name)`  The first name, for the "Welcome back" line - a
 *   helper in services/store.js.
 * - `{firstName && `, ${firstName}`}`  Adds ", Juan" only when there is a
 *   name, so a blank one gives "Welcome back" rather than "Welcome back, ".
 */
function StudentDashboard() {
  const { user, can } = useAuth();
  const store = useStore();
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

  // Across ALL of them, not just the eight listed, so this agrees with the
  // number on the navbar bell - and "Mark all read" marks every one.
  const unread = unreadCountFor(store.db, user);

  /*
   * ARRIVING FROM THE BELL. The navbar bell (and the phone profile menu's
   * "Notifications" row) link to /student/dashboard#notifications. The
   * router does not scroll to a #part of the address by itself, so this
   * does, once the panel is on screen. `location.key` changes on every
   * visit, so pressing the bell again while already here scrolls again.
   */
  const location = useLocation();
  useEffect(() => {
    if (location.hash !== '#notifications') return;
    document.getElementById('notifications')?.scrollIntoView({ behavior: 'smooth' });
  }, [location.hash, location.key]);

  // For the greeting. '' if the account has no name, in which case the
  // greeting is just "Welcome back".
  const firstName = firstNameOf(user.name);

  // Open the posting form - unless the account may not post, which the
  // suspension notice below already explains, so the buttons say nothing new.
  function openModal(mode) {
    if (!can(PERMISSIONS.SUBMIT_POSTS)) {
      setError('Your account is suspended, so posting is turned off.');
      return;
    }
    setError('');
    setModalMode(mode);
  }

  // The posting form hands its fields here and waits; a refusal is shown in
  // the form itself, which stays open. On success there is nothing to say -
  // the new post appears at the top of "Your submissions" straight away.
  function addSubmission(fields) {
    return store.createPost(fields);
  }

  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/*
          A WAY BACK. This page is reached from the profile menu, and a student
          who has read their submissions wants to return to the board - or to
          the post they came from. The only ways out used to be the logo, the
          profile menu again, or the phone's own back gesture; a Back button
          where the eye looks for one is the ordinary answer. Same button as
          the log-in card, with the same "somewhere that exists" fallback.
        */}
        <BackButton className="mb-3" />

        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            {/* Named, for the same reason as the admin dashboard: an admin
                holds both, and two pages that open with a greeting and
                nothing else are indistinguishable at a glance. */}
            <h1 className="text-2xl font-bold text-navy-900">Your Dashboard</h1>
            <p className="mt-1 text-sm text-slate-500">
              Welcome back{firstName && `, ${firstName}`} - everything you have sent in, and
              where each one has got to.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="sm" onClick={() => openModal('suggestion')}>
              Post a Suggestion
            </Button>
            <Button variant="ghost" size="sm" onClick={() => openModal('voice')}>
              Voice Out
            </Button>
          </div>
        </div>

        {user.status === 'suspended' && (
          <Notice announce={false} className="mb-4">
            Your account is suspended, so posting and voting are turned off. You can still read the
            board. Please contact the Student Affairs office.
          </Notice>
        )}

        {error && (
          <Notice className="mb-4">
            {error}
          </Notice>
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
                <Button variant="primary" size="sm" onClick={() => openModal('suggestion')}>
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
                        <Notice announce={false} className="mt-3">
                          <strong>Not approved:</strong> {post.rejectionReason}
                        </Notice>
                      )}


                      {post.department && (
                        <p className="mt-3 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
                          <strong>Being handled by:</strong> {departmentLabel(post.department)}
                          {post.assignedTo && ` · ${post.assignedTo}`}
                        </p>
                      )}

                      {post.resolution && (
                        <Notice tone="success" announce={false} className="mt-3">
                          <strong>Resolved:</strong> {post.resolution}
                        </Notice>
                      )}

                      <div className="mt-3 flex items-center gap-3 border-t border-slate-100 pt-2 text-xs text-slate-500">
                        <span>{plural(post.votes, 'vote')}</span>
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

          {/* WHAT THEY HAVE BEEN TOLD. Where the navbar bell leads;
              `scroll-mt-20` stops the sticky navbar covering its heading. */}
          <Panel
            id="notifications"
            className="scroll-mt-20"
            title="Notifications"
            description={unread > 0 ? `${unread} unread` : 'You are up to date.'}
            actions={
              unread > 0 && (
                <button
                  type="button"
                  onClick={() => store.markAllNotificationsRead()}
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
                {myNotifications.map((note) => (
                  <li key={note.id} className="flex items-start gap-2.5 py-3">
                    <NotificationContent note={note} compact />
                  </li>
                ))}
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
