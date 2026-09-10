import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { CATEGORIES } from '../../data/categories.js';
import { STATUS_LIST, kindInfo } from '../../data/workflow.js';
import { useStore, platformStats, averageResolutionDays } from '../../services/store.js';
import { BarChart } from '../../components/admin/Charts.jsx';
import { PageHeader, Panel, StatCard } from '../../components/admin/ui.jsx';

/*
 * ANALYTICS - four numbers and three lists.
 *
 * It answers the questions an administrator actually has:
 *
 *   How big is this?            the figures across the top
 *   Are we keeping up?          Reviewed %, and average resolution time
 *   What do students complain   by campus area
 *   about?
 *   Where is everything stuck?  by status, and by submission type
 *
 * WHAT WAS REMOVED, AND WHY
 *
 * This page carried a daily/weekly/monthly selector and two trend lines,
 * built on a date-bucketing helper that grouped records into rolling windows.
 * It was the largest and least useful thing here: a campus suggestion box
 * takes a handful of posts a week, so every line was flat with an occasional
 * spike of one, and nobody could act on it. Two doughnut charts went the same
 * way - a doughnut of three slices is a bar chart that is harder to read.
 *
 * What is left is counted straight from the records with no helper, no state
 * and no time maths. Every figure is one filter and a length.
 */
function Analytics() {
  const { user } = useAuth();
  const { db } = useStore(user);

  const stats = useMemo(() => platformStats(db), [db]);
  const avgResolution = useMemo(() => averageResolutionDays(db), [db]);

  // Which parts of campus generate the most submissions.
  const byCategory = useMemo(
    () =>
      CATEGORIES.map((category) => ({
        label: category.label,
        color: category.barClass,
        value: db.posts.filter((post) => post.category === category.slug).length,
      })).sort((a, b) => b.value - a.value),
    [db.posts]
  );

  // Where everything currently sits. Built from STATUS_LIST so a status added
  // to workflow.js appears here without this file being touched.
  const byStatus = useMemo(
    () =>
      STATUS_LIST.map((status) => ({
        label: status.label,
        color: status.barClass,
        value: db.posts.filter((post) => post.status === status.key).length,
      })).filter((row) => row.value > 0),
    [db.posts]
  );

  // Suggestions or concerns - the two families, and what they are made of.
  const byKind = useMemo(() => {
    const counts = new Map();
    db.posts.forEach((post) => {
      const kind = kindInfo(post.kind);
      const row = counts.get(kind.label) ?? { label: kind.label, color: kind.barClass, value: 0 };
      row.value += 1;
      counts.set(kind.label, row);
    });

    return [...counts.values()].sort((a, b) => b.value - a.value);
  }, [db.posts]);

  // The share that has been dealt with - the plainest measure of keeping up.
  const handled = stats.totalPosts - stats.pendingPosts;
  const handledRate = stats.totalPosts ? Math.round((handled / stats.totalPosts) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Analytics"
        description="How the platform is being used, and how well it is keeping up."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Registered Users"
          value={stats.totalUsers}
          hint={`${stats.newUsers} new this week`}
        />
        <StatCard label="Total Submissions" value={stats.totalPosts} />
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
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
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

        {/*
          Workload by department lives on the Departments page, which also
          knows how long each college is taking. Two pages drawing one number
          is how they drift apart, so this links across instead.
        */}
        <Panel
          title="Workload by department"
          description="Which department is carrying what, and how long it is taking them."
        >
          <p className="text-sm text-slate-600">
            Assigned, open and resolved counts per department - with oldest open and average
            resolution time, which is what separates a department that is busy from one that is
            stuck.
          </p>
          <Link
            to="/admin/departments"
            className="mt-3 inline-flex min-h-[44px] items-center rounded-lg border border-navy-200 px-4 text-sm font-semibold text-navy-700 transition-colors hover:border-navy-600 hover:bg-navy-50"
          >
            Open Departments
          </Link>
        </Panel>
      </div>
    </>
  );
}

export default Analytics;
