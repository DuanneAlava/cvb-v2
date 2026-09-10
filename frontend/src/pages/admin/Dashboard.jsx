import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { labelForSlug } from '../../data/categories.js';
import { AWAITING_REVIEW, OPEN_STATUSES, departmentLabel, kindInfo } from '../../data/workflow.js';
import { useStore, platformStats, findUser } from '../../services/store.js';
import {
  Avatar,
  KindBadge,
  PageHeader,
  Panel,
  StatCard,
  StatusBadge,
  EmptyState,
  timeAgo,
} from '../../components/admin/ui.jsx';

/*
 * The admin dashboard: WHAT NEEDS DOING.
 *
 * This page and Analytics used to be two-thirds the same screen. Fifteen
 * cards sat up here - totals, breakdowns, votes, averages - and Analytics
 * repeated most of them under the same headings, with the same two charts
 * drawn from copies of the same code. Three of the cards even stated the
 * number the panel directly beneath them and the sidebar badge beside them
 * already showed.
 *
 * The two pages now answer different questions:
 *
 *   Dashboard   "what needs me right now?"   - counts that drain to zero
 *   Analytics   "how big, and how well?"     - totals, rates and breakdowns
 *
 * So everything here is something an administrator can act on. The four
 * figures across the top each open the queue that clears them, and the two
 * lists below are the top of those queues. Nothing on this page is a total;
 * for those, see pages/admin/Analytics.jsx.
 *
 * Every number is counted from the same records the student site writes to,
 * so the dashboard cannot drift out of date - there is nothing to refresh.
 */
function Dashboard() {
  const { user } = useAuth();
  const { db } = useStore(user);

  const stats = useMemo(() => platformStats(db), [db]);

  // The oldest waiting submissions first: the queue should surface what has
  // been ignored longest, not what arrived most recently.
  const reviewQueue = useMemo(
    () =>
      db.posts
        .filter((post) => AWAITING_REVIEW.includes(post.status))
        .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)),
    [db.posts]
  );

  // Everything approved that a department has to act on - the Open Work queue.
  const openWork = useMemo(
    () =>
      db.posts
        .filter((post) => kindInfo(post.kind).needsAssignment && OPEN_STATUSES.includes(post.status))
        .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)),
    [db.posts]
  );

  /*
   * How long the student at the front of the review queue has been waiting,
   * in whole days. Null when the queue is clear. This is the one figure that
   * says whether "3 pending" is fine or a problem: three from this morning
   * is a normal day, three from last week is a student giving up on us.
   */
  const longestWait = reviewQueue.length
    ? Math.floor((Date.now() - Date.parse(reviewQueue[0].createdAt)) / 86400000)
    : null;

  const recentActivity = db.audit.slice(0, 6);

  // Padded to the 44px touch floor - a standalone action, not prose.
  const panelLink =
    '-mx-2 inline-flex min-h-[44px] items-center rounded-lg px-2 text-sm font-semibold text-navy-600 hover:bg-navy-50 hover:underline';

  return (
    <>
      {/*
        The heading names the PAGE, not the person - the student dashboard
        opens with a greeting too, and two screens with near-identical first
        lines said nothing about which one you were on. The greeting lives in
        the subtitle, where it costs nothing.
      */}
      <PageHeader
        title="Admin Dashboard"
        description={`Signed in as ${user?.name ?? 'an administrator'}. What needs doing right now - totals and trends are under Analytics.`}
      />

      {/*
        THE FOUR THINGS THAT CAN BE CLEARED.

        Each opens the queue that clears it, and each reads green at zero,
        because on this page a zero is the goal. Two are about the review
        queue - how many, and how long the oldest has waited - and two are
        about work already approved: how much is open, and how much of it
        nobody has been given.
      */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Pending Approval"
          value={stats.pendingPosts}
          hint="Waiting for a decision"
          tone={stats.pendingPosts > 0 ? 'warn' : 'good'}
          to="/admin/queue/pending"
        />
        <StatCard
          label="Longest Wait"
          value={longestWait === null ? '—' : `${longestWait}d`}
          hint={longestWait === null ? 'The review queue is clear' : 'Oldest submission still waiting'}
          tone={longestWait === null ? 'good' : longestWait >= 7 ? 'bad' : 'warn'}
          to="/admin/queue/pending"
        />
        <StatCard
          label="Open Work"
          value={stats.openWork}
          hint="Approved, waiting on a department"
          tone={stats.openWork > 0 ? 'warn' : 'good'}
          to="/admin/queue/open"
        />
        <StatCard
          label="Needs Assigning"
          value={stats.unassignedPosts}
          hint="Approved, but no department yet"
          tone={stats.unassignedPosts > 0 ? 'bad' : 'good'}
          to="/admin/queue/open"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* THE FRONT OF THE REVIEW QUEUE - the reason to open the panel at all. */}
        <Panel
          title="Waiting for review"
          description="Oldest first - who has waited longest."
          actions={
            <Link to="/admin/queue/pending" className={panelLink}>
              View all
            </Link>
          }
        >
          {reviewQueue.length === 0 ? (
            <EmptyState title="The queue is clear" message="Every submission has been reviewed." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {reviewQueue.slice(0, 6).map((post) => {
                const author = findUser(db, post.authorId);
                return (
                  <li key={post.id}>
                    <Link
                      to={`/admin/queue/pending?highlight=${post.id}`}
                      className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-navy-50/60"
                    >
                      <Avatar name={author?.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-navy-900">{post.title}</p>
                        <p className="truncate text-xs text-slate-500">
                          {author?.name ?? 'Deleted account'}
                          {post.anonymous && ' · anonymous on the board'} · {timeAgo(post.createdAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <StatusBadge status={post.status} />
                        <KindBadge kind={post.kind} />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        {/*
          THE FRONT OF THE WORK QUEUE - the ones somebody is meant to be
          fixing. Each row opens straight into its review dialog, the same as
          the list beside it, and says who has it - or that nobody does, which
          is the row that needs a click.
        */}
        <Panel
          title="Open work"
          description="Oldest first - approved and waiting on a department."
          actions={
            <Link to="/admin/queue/open" className={panelLink}>
              View all
            </Link>
          }
        >
          {openWork.length === 0 ? (
            <EmptyState title="No open work" message="Nothing is currently outstanding." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {openWork.slice(0, 6).map((post) => (
                <li key={post.id}>
                  <Link
                    to={`/admin/queue/open?highlight=${post.id}`}
                    className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-navy-50/60"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-navy-900">{post.title}</p>
                      <p className="truncate text-xs text-slate-500">
                        {post.department ? (
                          departmentLabel(post.department)
                        ) : (
                          <span className="font-semibold text-amber-700">Unassigned</span>
                        )}
                        {' · '}
                        {labelForSlug(post.category)} · open {timeAgo(post.createdAt)}
                      </p>
                    </div>
                    <StatusBadge status={post.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* WHAT ADMINISTRATORS HAVE BEEN DOING. */}
      <Panel
        className="mt-4"
        title="Recent admin activity"
        actions={
          <Link to="/admin/activity" className={panelLink}>
            View the full log
          </Link>
        }
      >
        {recentActivity.length === 0 ? (
          <EmptyState
            title="Nothing logged yet"
            message="Administrative actions are recorded here as they happen."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {recentActivity.map((entry) => (
              <li key={entry.id} className="flex items-center gap-3 py-2.5 text-sm">
                <Avatar name={entry.adminName} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="font-semibold text-navy-900">{entry.adminName}</span>{' '}
                  <span className="text-slate-600">{entry.details || entry.action}</span>
                </span>
                <span className="shrink-0 whitespace-nowrap text-xs text-slate-400">
                  {timeAgo(entry.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

export default Dashboard;
