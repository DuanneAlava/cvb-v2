import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { DEPARTMENTS, CLOSED_STATUSES, OPEN_STATUSES } from '../../data/workflow.js';
import { useStore, needsAssigning, platformStats } from '../../services/store.js';
import DataTable from '../../components/admin/DataTable.jsx';
import { PageHeader, Panel } from '../../components/admin/ui.jsx';

/*
 * DEPARTMENTS - who is carrying what.
 *
 * The assignment workflow has existed since the panel was built: a concern is
 * approved, handed to one of the departments in data/workflow.js, worked on
 * and resolved. Every one of those steps was already recorded on the post -
 * `department`, `assignedTo`, `assignedAt`, `resolvedAt` - and there was
 * nowhere to read it back. An administrator could assign a concern to the IT
 * Department and then had no way to ask what the IT Department was sitting on.
 *
 * This page is that missing answer. It adds no new data; it reads what the
 * assignment step has been writing all along.
 *
 * The figure that matters most is the last column. A department with four open
 * concerns is busy; a department averaging eleven days to close one has a
 * problem, and those are not the same thing.
 */
function Departments() {
  const { user } = useAuth();
  const { db } = useStore(user);
  const navigate = useNavigate();

  const rows = useMemo(() => {
    return DEPARTMENTS.map((department) => {
      const assigned = db.posts.filter((post) => post.department === department.key);

      const open = assigned.filter((post) => OPEN_STATUSES.includes(post.status));
      const resolved = assigned.filter((post) => CLOSED_STATUSES.includes(post.status));

      /*
       * Average days from submission to resolution, for this department only.
       * Null rather than zero when nothing has been resolved yet - a department
       * that has never closed anything has no average, and printing "0.0d"
       * would read as instant rather than as unknown.
       */
      const timed = assigned.filter((post) => post.resolvedAt && post.createdAt);
      const avgDays = timed.length
        ? timed.reduce(
            (sum, post) => sum + (Date.parse(post.resolvedAt) - Date.parse(post.createdAt)),
            0
          ) /
          timed.length /
          86400000
        : null;

      // The longest-waiting open concern, which is the one most likely to
      // become a complaint about the complaint.
      const oldestOpen = open.length
        ? Math.floor((Date.now() - Math.min(...open.map((p) => Date.parse(p.createdAt)))) / 86400000)
        : null;

      return {
        id: department.key,
        label: department.label,
        open: open.length,
        resolved: resolved.length,
        avgDays,
        oldestOpen,
      };
    });
  }, [db.posts]);

  /*
   * The two numbers this page adds to the table.
   *
   * `open` is the same figure as the sidebar's Open Work badge - everything
   * approved that a department has to act on, assigned or not - read from
   * platformStats so the two cannot drift. It used to be the sum of the
   * table's Open column, which left out anything unassigned, so the card
   * here said 2 while the badge beside it said 3.
   *
   * `unassigned` is the slice of that nobody has been given - the gap that
   * would otherwise go unnoticed, because nothing is chasing it. Counted by
   * needsAssigning(), which the dashboard card reads too.
   */
  const totals = useMemo(
    () => ({
      open: platformStats(db).openWork,
      unassigned: needsAssigning(db).length,
    }),
    [db]
  );

  /*
   * NO "ASSIGNED" COLUMN.
   *
   * It printed Open + Resolved - the two columns immediately to its right -
   * so every row stated the same fact three times and the header card stated
   * it a fourth. What a department has handled in total is a sum you can see;
   * what it is still carrying, and how long that has taken, is the thing you
   * came to the page to find out.
   */
  const columns = [
    {
      key: 'label',
      header: 'Department',
      sortable: true,
      cell: (row) => <span className="font-semibold text-navy-900">{row.label}</span>,
    },
    {
      key: 'open',
      header: 'Open',
      align: 'right',
      sortable: true,
      cell: (row) => (
        <span className={row.open > 0 ? 'font-semibold text-amber-700' : 'text-slate-400'}>
          {row.open}
        </span>
      ),
    },
    {
      key: 'resolved',
      header: 'Resolved',
      align: 'right',
      hideOn: 'sm',
      sortable: true,
      cell: (row) => (
        <span className={row.resolved > 0 ? 'text-emerald-700' : 'text-slate-400'}>
          {row.resolved}
        </span>
      ),
    },
    {
      key: 'oldestOpen',
      header: 'Oldest open',
      align: 'right',
      hideOn: 'md',
      sortable: true,
      sortValue: (row) => row.oldestOpen ?? -1,
      cell: (row) => (
        <span className={row.oldestOpen > 14 ? 'font-semibold text-red-700' : 'text-slate-500'}>
          {row.oldestOpen === null ? '—' : `${row.oldestOpen}d`}
        </span>
      ),
    },
    {
      key: 'avgDays',
      header: 'Avg. resolution',
      align: 'right',
      sortable: true,
      sortValue: (row) => row.avgDays ?? Infinity,
      cell: (row) => (
        <span className="text-slate-600">
          {row.avgDays === null ? '—' : `${row.avgDays.toFixed(1)}d`}
        </span>
      ),
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      cell: () => <span className="whitespace-nowrap text-xs font-semibold text-navy-600">View →</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Departments"
        description="Who is carrying what, and how long it is taking them."
      />

      {/*
        NO CARDS. Two used to sit here: "Departments: 11", a constant that the
        footer line under the table already states, and "Still Open", which
        disagreed with the sidebar badge whenever anything was unassigned.
        The one number worth having is now in the panel heading, and it is
        the badge's number.

        Nor a chart. A "Share of assigned work" bar chart used to sit beside
        the table, plotting the very column the table already prints, and
        Analytics had a third copy. The table wins because it alone also
        carries open, resolved, oldest-open and average resolution - what
        actually distinguishes a department that is busy from one that is
        stuck. Analytics links here instead of redrawing it.
      */}
      <Panel
        title="Workload by department"
        description={`${totals.open} open ${totals.open === 1 ? 'item' : 'items'} across ${DEPARTMENTS.length} departments. Click a row to see everything that department has been given.`}
      >
        <DataTable
          rows={rows}
          columns={columns}
          // Straight through to All Submissions, filtered to this department -
          // every kind it has been given, not only the concern family.
          onRowClick={(row) => navigate(`/admin/posts?department=${row.id}`)}
          emptyTitle="No departments configured"
          emptyMessage="Departments are defined in src/data/workflow.js."
          initialSort={{ key: 'open', direction: 'desc' }}
          pageSize={20}
        />
      </Panel>

      {/*
        The point of this panel: work that nobody owns. A concern with no
        department is not being carried by anyone, and nothing else on the
        page would tell you - the table lists what each college HAS, not what
        has fallen between them.

        The second half of the sentence matters now that the departments are
        the eleven colleges. An academic complaint has an obvious owner; a
        broken light or a wifi fault has none, and telling somebody to assign
        it would send them hunting for a department that is not on the list.
      */}
      {totals.unassigned > 0 && (
        <Panel className="mt-4" title="Needs assigning">
          <p className="text-sm text-slate-600">
            {totals.unassigned} approved{' '}
            {totals.unassigned === 1 ? 'submission has' : 'submissions have'} no department, so
            nobody is working on {totals.unassigned === 1 ? 'it' : 'them'}. Give{' '}
            {totals.unassigned === 1 ? 'it' : 'them'} a college - or add a department that fits, if
            none here does.
          </p>
          <button
            type="button"
            onClick={() => navigate('/admin/queue/open')}
            className="mt-3 inline-flex min-h-[44px] items-center rounded-lg border border-navy-200 px-4 text-sm font-semibold text-navy-700 transition-colors hover:border-navy-600 hover:bg-navy-50"
          >
            Open the work queue
          </button>
        </Panel>
      )}

      <p className="mt-6 text-center text-xs text-slate-400">
        {DEPARTMENTS.length} departments, defined in src/data/workflow.js. Adding one there adds it
        to this page, the assignment dropdown and the analytics charts at the same time.
      </p>
    </>
  );
}

export default Departments;
