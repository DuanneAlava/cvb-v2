import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CATEGORIES } from '../../data/categories.js';
import { KIND_LIST, STATUS_LIST } from '../../data/workflow.js';
import { useStore, platformStats, averageResolutionDays } from '../../services/store.js';
import { BarChart } from '../../components/admin/Charts.jsx';
import { PageHeader, Panel, StatCard, plural } from '../../components/admin/ui.jsx';

/*
 * ANALYTICS: HOW BIG, AND HOW WELL.
 *
 * Every total, rate and breakdown lives here and nowhere else. The dashboard
 * used to carry most of them as well - fifteen cards and two charts, drawn
 * from copies of the code below - so each figure was maintained twice and
 * the dashboard buried the handful of numbers an administrator actually
 * opens the panel for. Those stay on the dashboard; the counting is here.
 *
 * Three questions, in order:
 *
 *   How many people, and are they active?      the People row
 *   How much comes in, and do we keep up?       the Submissions row
 *   What is it about, and where does it sit?    the three breakdowns
 *
 * The breakdowns are what replaced a dozen cards. "Total Suggestions",
 * "Total Reports", "Approved", "Rejected", "Resolved Concerns" and "Pending
 * Suggestions" were each one bar of the charts below, printed a second time
 * as a tile - so the tiles went and the bars stayed, where the same numbers
 * can be read against each other instead of one at a time.
 *
 * WHAT ELSE WAS REMOVED, AND WHY
 *
 * This page once carried a daily/weekly/monthly selector and two trend
 * lines, built on a date-bucketing helper that grouped records into rolling
 * windows. A campus suggestion box takes a handful of posts a week, so every
 * line was flat with an occasional spike of one, and nobody could act on it.
 * A doughnut of the status split went the same way - a doughnut of five
 * slices is a bar chart that is harder to read.
 *
 * Workload by department is not drawn here either. The Departments page
 * carries it with open, resolved, oldest-open and average resolution per
 * college; a second copy of one of those columns is how two pages drift
 * apart, so the heading links across instead.
 *
 * Everything left is counted straight from the records with no helper, no
 * state and no time maths. Every figure is one filter and a length.
 *
 * WHAT YOU'LL MEET IN THIS FILE (plain-English notes)
 *
 * - Chart data as a list of { label, color, value }  Each useMemo below
 *   builds one of these lists from the vocabulary in workflow.js /
 *   categories.js, and the BarChart component draws whatever it is given.
 *   The chart knows nothing about statuses or categories.
 * - `.filter((row) => row.value > 0)`  Leave out empty bars.
 * - `.sort((a, b) => b.value - a.value)`  Biggest first. A sort function
 *   returns a negative number to put `a` first, positive to put `b` first.
 * - `Math.round((handled / total) * 100)`  A percentage, as a whole number.
 *   The `total ? ... : 0` guard avoids dividing by zero on an empty board.
 * - `avgResolution.toFixed(1)`  Print a number with one decimal place.
 */
function Analytics() {
  const { db } = useStore();

  const stats = useMemo(() => platformStats(db), [db]);
  const avgResolution = useMemo(() => averageResolutionDays(db.posts), [db.posts]);

  // Which parts of campus generate the most submissions - busiest first.
  const byCategory = useMemo(
    () =>
      CATEGORIES.map((category) => ({
        label: category.label,
        color: category.barClass,
        value: db.posts.filter((post) => post.category === category.slug).length,
      })).sort((a, b) => b.value - a.value),
    [db.posts]
  );

  // Where everything currently sits, in the order of the lifecycle. Built
  // from STATUS_LIST so a status added to workflow.js appears here on its own.
  const byStatus = useMemo(
    () =>
      STATUS_LIST.map((status) => ({
        label: status.label,
        color: status.barClass,
        value: db.posts.filter((post) => post.status === status.key).length,
      })).filter((row) => row.value > 0),
    [db.posts]
  );

  // What students are sending in - commonest first. Built from KIND_LIST for
  // the same reason as the status chart.
  const byKind = useMemo(
    () =>
      KIND_LIST.map((kind) => ({
        label: kind.label,
        color: kind.barClass,
        value: db.posts.filter((post) => post.kind === kind.key).length,
      }))
        .filter((row) => row.value > 0)
        .sort((a, b) => b.value - a.value),
    [db.posts]
  );

  // The share that has been dealt with - the plainest measure of keeping up.
  const handled = stats.totalPosts - stats.pendingPosts;
  const handledRate = stats.totalPosts ? Math.round((handled / stats.totalPosts) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Analytics"
        description="How the platform is being used, and how well it is keeping up."
      >
        <Link
          to="/admin/departments"
          className="inline-flex min-h-[44px] items-center rounded-lg border border-navy-200 px-4 text-sm font-semibold text-navy-700 transition-colors hover:border-navy-600 hover:bg-navy-50"
        >
          Workload by department →
        </Link>
      </PageHeader>

      {/* PEOPLE. */}
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">People</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Registered Users"
          value={stats.totalUsers}
          hint={plural(stats.totalStudents, 'student')}
          to="/admin/users"
        />
        <StatCard label="Active Users" value={stats.activeUsers} hint="Signed in within 30 days" tone="good" />
        <StatCard label="New Users" value={stats.newUsers} hint="Registered this week" />
        <StatCard
          label="Suspended"
          value={stats.suspendedUsers}
          tone={stats.suspendedUsers > 0 ? 'bad' : 'default'}
          to="/admin/users?status=suspended"
        />
      </div>

      {/* SUBMISSIONS - how much, and how well it is being kept up with. */}
      <h2 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Submissions
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Submissions"
          value={stats.totalPosts}
          hint={`${plural(stats.totalSuggestions, 'suggestion')} · ${plural(stats.totalConcerns, 'concern')}`}
          to="/admin/posts"
        />
        <StatCard
          label="Reviewed"
          value={`${handledRate}%`}
          hint={`${stats.pendingPosts} still waiting`}
          tone={handledRate >= 80 ? 'good' : 'warn'}
        />
        <StatCard
          label="Avg. Resolution Time"
          value={avgResolution === null ? '—' : `${avgResolution.toFixed(1)} days`}
          hint={avgResolution === null ? 'Nothing resolved yet' : 'Submission to resolution'}
        />
        <StatCard label="Votes Cast" value={stats.totalVotes} hint="Across the whole board" />
      </div>

      {/* THE BREAKDOWNS. */}
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Panel
          title="Submissions by campus area"
          description="Which parts of campus students raise most often - the recurring problems."
        >
          <BarChart data={byCategory} />
        </Panel>

        <Panel title="Submissions by status" description="Where everything currently sits.">
          <BarChart data={byStatus} />
        </Panel>

        <Panel title="Submissions by type" description="What students are sending in.">
          <BarChart data={byKind} />
        </Panel>
      </div>
    </>
  );
}

export default Analytics;
