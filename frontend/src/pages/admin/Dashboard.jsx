import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { CATEGORIES, labelForSlug } from '../../data/categories.js';
import { AWAITING_REVIEW, OPEN_STATUSES, kindInfo, statusInfo } from '../../data/workflow.js';
import { useStore, platformStats, averageResolutionDays, findUser } from '../../services/store.js';
import { BarChart, DonutChart } from '../../components/admin/Charts.jsx';
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
 * The admin dashboard.
 *
 * It is built to answer the questions an administrator opens the panel with,
 * in the order they usually ask them:
 *
 *   "How big is this platform?"        - the figures across the top
 *   "What needs me right now?"         - the review queue, first panel
 *   "What are students worried about?" - the category breakdown
 *   "What has been happening?"         - recent activity
 *
 * Every number is counted from the same records the student site writes to, so
 * the dashboard cannot drift out of date - there is nothing to refresh.
 */
function Dashboard() {
  const { user } = useAuth();
  const { db } = useStore(user);

  const stats = useMemo(() => platformStats(db), [db]);
  const avgResolution = useMemo(() => averageResolutionDays(db), [db]);

  // The oldest waiting submissions first: the queue should surface what has
  // been ignored longest, not what arrived most recently.
  const reviewQueue = useMemo(
    () =>
      db.posts
        .filter((post) => AWAITING_REVIEW.includes(post.status))
        .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
        .slice(0, 6),
    [db.posts]
  );

  const openConcerns = useMemo(
    () =>
      db.posts
        .filter((post) => kindInfo(post.kind).group === 'concern' && OPEN_STATUSES.includes(post.status))
        .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
        .slice(0, 5),
    [db.posts]
  );

  // Which parts of campus are generating the most submissions.
  const byCategory = useMemo(
    () =>
      CATEGORIES.map((category) => ({
        label: category.label,
        color: category.barClass,
        value: db.posts.filter((post) => post.category === category.slug).length,
      })).sort((a, b) => b.value - a.value),
    [db.posts]
  );

  // How the whole board divides up by status.
  const byStatus = useMemo(() => {
    const counts = new Map();
    db.posts.forEach((post) => {
      counts.set(post.status, (counts.get(post.status) ?? 0) + 1);
    });

    return [...counts.entries()]
      .map(([key, value]) => ({ label: statusInfo(key).label, value }))
      .sort((a, b) => b.value - a.value);
  }, [db.posts]);

  const recentActivity = db.audit.slice(0, 6);

  return (
    <>
      {/*
        The heading names the PAGE, not the person.

        This used to greet the admin by name - and so does the student
        dashboard, which meant the two screens opened with near-identical
        lines and nothing on either said which one you were on. A page title
        should answer "where am I", and the greeting moved to the subtitle
        where it costs nothing.
      */}
      <PageHeader
        title="Admin Dashboard"
        description={`Signed in as ${user?.name ?? 'an administrator'}. Everything below is counted live from the same records the student site writes to.`}
      />

      {/* PEOPLE. */}
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">People</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Users" value={stats.totalUsers} hint={`${stats.totalStudents} students`} to="/admin/users" />
        <StatCard label="Active Users" value={stats.activeUsers} hint="Signed in within 30 days" tone="good" />
        <StatCard label="New Users" value={stats.newUsers} hint="Registered this week" />
        <StatCard
          label="Suspended"
          value={stats.suspendedUsers}
          tone={stats.suspendedUsers > 0 ? 'bad' : 'default'}
          to="/admin/users?status=suspended"
        />
      </div>

      {/* SUBMISSIONS. */}
      <h2 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Submissions
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Submissions" value={stats.totalPosts} to="/admin/posts" />
        <StatCard
          label="Pending Submissions"
          value={stats.pendingPosts}
          hint="Waiting for a decision"
          tone={stats.pendingPosts > 0 ? 'warn' : 'default'}
          to="/admin/queue/pending"
        />
        <StatCard
          label="Approved Submissions"
          value={stats.approvedPosts}
          hint="Approved, not yet assigned"
          tone="good"
          to="/admin/posts?status=approved"
        />
        <StatCard label="Rejected Submissions" value={stats.rejectedPosts} to="/admin/posts?status=rejected" />
        <StatCard label="Total Suggestions" value={stats.totalSuggestions} to="/admin/posts?group=suggestion" />
        <StatCard label="Pending Suggestions" value={stats.pendingSuggestions} tone={stats.pendingSuggestions > 0 ? 'warn' : 'default'} />
        <StatCard
          label="Open Concerns"
          value={stats.openConcerns}
          tone={stats.openConcerns > 0 ? 'warn' : 'default'}
          to="/admin/queue/open"
        />
        <StatCard label="Resolved Concerns" value={stats.resolvedConcerns} tone="good" />
      </div>

      {/* A second row for the figures that describe how well the process is
          working, rather than how much of it there is. */}
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Reports" value={stats.totalReports} to="/admin/posts?kind=report" />
        <StatCard label="Total Votes Cast" value={stats.totalVotes} />
        <StatCard
          label="Avg. Resolution"
          value={avgResolution === null ? '—' : `${avgResolution.toFixed(1)}d`}
          hint={avgResolution === null ? 'Nothing resolved yet' : 'Submission to resolution'}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {/* WHAT NEEDS ATTENTION - the reason to open the panel at all, so it
            gets the widest column and sits first. */}
        <Panel
          className="lg:col-span-2"
          title="Waiting for review"
          description="Oldest first, because these are the ones a student is still waiting on."
          actions={
            <Link
              to="/admin/queue/pending"
              // Padded to the 44px touch floor - a standalone action, not prose.
              className="-mx-2 inline-flex min-h-[44px] items-center rounded-lg px-2 text-sm font-semibold text-navy-600 hover:bg-navy-50 hover:underline"
            >
              View all
            </Link>
          }
        >
          {reviewQueue.length === 0 ? (
            <EmptyState title="The queue is clear" message="Every submission has been reviewed." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {reviewQueue.map((post) => {
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

        {/* WHAT STUDENTS ARE CONCERNED ABOUT. */}
        <Panel title="Submissions by campus area" description="Where submissions are coming from.">
          <BarChart data={byCategory} />
        </Panel>

        {/* OPEN CONCERNS - the ones somebody is meant to be fixing. */}
        <Panel
          className="lg:col-span-2"
          title="Open concerns"
          description="Approved and still being worked on."
          actions={
            <Link to="/admin/queue/open" // Padded to the 44px touch floor - a standalone action, not prose.
              className="-mx-2 inline-flex min-h-[44px] items-center rounded-lg px-2 text-sm font-semibold text-navy-600 hover:bg-navy-50 hover:underline">
              View all
            </Link>
          }
        >
          {openConcerns.length === 0 ? (
            <EmptyState title="No open concerns" message="Nothing is currently outstanding." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {openConcerns.map((post) => (
                <li key={post.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-navy-900">{post.title}</p>
                    <p className="truncate text-xs text-slate-500">
                      {labelForSlug(post.category)} · open {timeAgo(post.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={post.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Submissions by status">
          <DonutChart data={byStatus} centerLabel="Posts" />
        </Panel>
      </div>

      {/* WHAT ADMINISTRATORS HAVE BEEN DOING. */}
      <Panel
        className="mt-4"
        title="Recent admin activity"
        actions={
          <Link to="/admin/activity" // Padded to the 44px touch floor - a standalone action, not prose.
              className="-mx-2 inline-flex min-h-[44px] items-center rounded-lg px-2 text-sm font-semibold text-navy-600 hover:bg-navy-50 hover:underline">
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
