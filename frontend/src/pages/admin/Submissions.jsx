import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { CATEGORIES } from '../../data/categories.js';
import {
  DEPARTMENTS,
  KIND_LIST,
  STATUS_LIST,
  departmentLabel,
  kindInfo,
  kindsInGroup,
} from '../../data/workflow.js';
import { PROGRAMS } from '../../data/programs.js';
import { useStore, authorLabel, findUser } from '../../services/store.js';
import {
  downloadCsv,
  stamp,
  submissionHeaders,
  submissionRow,
  toCsv,
} from '../../services/csv.js';
import DataTable from '../../components/admin/DataTable.jsx';
import SubmissionReview from '../../components/admin/SubmissionReview.jsx';
import {
  CategoryBadge,
  KindBadge,
  PageHeader,
  Panel,
  Select,
  StatusBadge,
  TextInput,
  timeAgo,
} from '../../components/admin/ui.jsx';

/*
 * ONE PAGE, THREE ROUTES.
 *
 * All Submissions and both work queues are the same screen looking at a
 * different slice of the same records. They share this component and differ
 * only in the props the route passes in:
 *
 *   <Submissions title="All Submissions" />
 *   <Submissions title="Pending Approval" lockedStatuses={AWAITING_REVIEW} queue />
 *
 * It used to be five. "Suggestions" and "Concerns" were separate sidebar
 * entries that passed group="suggestion" / group="concern" and did nothing
 * else - the same records as All Submissions, pre-filtered, under their own
 * names. They existed because the type dropdown could only pick ONE kind, so
 * "every concern" (concern + complaint + report) had no other home.
 *
 * That hole is now closed: the type dropdown offers the two families as well
 * as the six kinds, so All Submissions genuinely covers everything and the
 * two extra rows in the sidebar were redundant rather than useful.
 *
 * Props:
 * - title / description  the page heading
 * - lockedGroup          'suggestion' | 'concern' - pin to that family
 * - lockedKinds          pin to specific kinds - Open Work passes the kinds
 *                        that need a department; also hides the family options
 * - lockedStatuses       limit to specific statuses; also hides the status filter
 * - queue                true for a work queue: sorts OLDEST first, because the
 *                        top of a queue should be whoever has waited longest
 *
 * Anything a route pins is removed from the filter bar rather than shown
 * fixed, so there is no control on screen that can contradict the page.
 *
 * WHAT YOU'LL MEET IN THIS FILE (plain-English notes)
 *
 * - Props with defaults  `lockedGroup = null` in the parameter list means
 *   "if the route does not pass this, treat it as null". A route that
 *   passes nothing gets All Submissions; the queues pass a lock or two.
 * - Filters in the address bar  useSearchParams, as in SearchBar.jsx. Every
 *   dropdown reads its value from the URL and writes back to it, which is
 *   why a filtered view can be copied as a link.
 * - useEffect watching one param  The `highlight` effect re-runs whenever
 *   that param changes, opening the dialog for that submission - needed
 *   because a click on a notification can change the address while this
 *   page is already on screen.
 * - `[a, b, c].filter(Boolean).join(' ')`  Drop the empty/undefined entries
 *   (Boolean(x) is false for them), then glue what is left into one string.
 *   That string is the "haystack" the search box looks in.
 * - `new Set(list)`  A collection that keeps each value once. Used to find
 *   which departments actually appear in the records. `[...set]` turns it
 *   back into an array.
 * - `.every((item) => item.needsAssignment)`  True only if EVERY item passes
 *   the test - here, "is everything on this queue the kind that gets
 *   assigned?"
 * - Column definitions as data  `columns` is a list of objects - header,
 *   how to draw the cell, how to sort - handed to DataTable. `.filter(Boolean)`
 *   at the end drops a column that was written as `condition && {...}` and
 *   came out false.
 * - A "slug"  A short, URL-safe version of a name: `title.toLowerCase()
 *   .replace(/[^a-z0-9]+/g, '-')` turns "Open Work" into "open-work" for the
 *   CSV filename. The /.../g is a regex applied to every match.
 */
function Submissions({
  title,
  description,
  lockedGroup = null,
  lockedKinds = null,
  lockedStatuses = null,
  queue = false,
}) {
  const { user } = useAuth();
  const { db } = useStore(user);

  // The filters live in the address bar, so a filtered view can be bookmarked
  // and shared with another administrator - the same approach the student
  // site's search box uses.
  const [searchParams, setSearchParams] = useSearchParams();

  const query = searchParams.get('q') ?? '';
  const category = searchParams.get('category') ?? '';
  const status = searchParams.get('status') ?? '';
  const kind = searchParams.get('kind') ?? '';
  /*
   * FAMILY, e.g. every concern at once. This and `kind` are two halves of one
   * dropdown - picking a family clears the kind and vice versa - but they stay
   * separate in the address so a link reads as what it is: ?group=concern
   * rather than a value somebody has to decode.
   */
  const group = searchParams.get('group') ?? '';
  // Set by the Departments page when you click through from a row there.
  const department = searchParams.get('department') ?? '';
  /*
   * PROGRAM, meaning the course the AUTHOR is enrolled in - not a property of
   * the submission at all. It is what turns "students keep complaining about
   * the labs" into "the complaints are all coming from one programme", which
   * is a different problem with a different fix.
   */
  const program = searchParams.get('program') ?? '';

  // Opening a row puts the submission here, which is what shows the dialog.
  const [reviewingId, setReviewingId] = useState(searchParams.get('highlight'));

  /*
   * Notifications link straight to a submission, e.g.
   * /admin/posts?highlight=post-123. Reading that only in useState's initial
   * value works when arriving from another page, but not when this page is
   * already on screen - React keeps the existing state and the dialog never
   * opens. Watching the parameter covers both.
   */
  const highlight = searchParams.get('highlight');
  useEffect(() => {
    if (highlight) setReviewingId(highlight);
  }, [highlight]);

  function setFilter(key, value) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('highlight');
    setSearchParams(next, { replace: true });
  }

  function clearFilters() {
    setSearchParams({});
  }

  // The records this route is allowed to show, before the user's own filters.
  const scoped = useMemo(() => {
    let posts = db.posts;

    if (lockedGroup) {
      const allowed = kindsInGroup(lockedGroup);
      posts = posts.filter((post) => allowed.includes(post.kind));
    }
    if (lockedKinds) posts = posts.filter((post) => lockedKinds.includes(post.kind));
    if (lockedStatuses) posts = posts.filter((post) => lockedStatuses.includes(post.status));

    return posts;
  }, [db.posts, lockedGroup, lockedKinds, lockedStatuses]);

  const rows = useMemo(() => {
    const search = query.trim().toLowerCase();

    return scoped
      .filter((post) => {
        if (category && post.category !== category) return false;
        if (status && post.status !== status) return false;
        if (kind && post.kind !== kind) return false;
        if (group && kindInfo(post.kind).group !== group) return false;
        if (department && post.department !== department) return false;
        if (program && findUser(db, post.authorId)?.course !== program) return false;

        if (!search) return true;

        /*
         * Searching reaches the author's name, email and student number as
         * well as the post itself, because "find everything this student
         * submitted" is a question administrators ask constantly. It works on
         * anonymous posts too - the identity is known here even though the
         * board never shows it.
         */
        const author = findUser(db, post.authorId);
        const haystack = [
          post.title,
          post.message,
          post.id,
          author?.name,
          author?.email,
          author?.studentId,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return haystack.includes(search);
      })
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [scoped, db, query, category, status, kind, group, department, program]);

  /*
   * Which departments actually appear in these records.
   *
   * Assigning a department immediately moves a submission to "assigned",
   * which takes it out of the pre-approval queue - so nothing in Pending
   * Approval can ever have one, and the dropdown there could only ever filter
   * to zero results. Building the list from what is really in scope makes the
   * control disappear exactly where it is meaningless, with no per-page
   * configuration to keep in step.
   */
  const departmentOptions = useMemo(() => {
    const present = new Set(scoped.map((post) => post.department).filter(Boolean));
    return DEPARTMENTS.filter((item) => present.has(item.key));
  }, [scoped]);

  /*
   * EVERY PROGRAMME THE SCHOOL OFFERS, not just the ones that have submitted.
   *
   * This deliberately breaks the rule the department dropdown follows. That
   * one hides itself where nothing matches, on the grounds that a filter
   * which can only return zero is noise. Here the full list is the point: an
   * administrator asking "has anyone from Marine Engineering ever raised
   * anything?" wants to find the answer is *no*, and a derived list answers
   * that by silently omitting the option, which reads as though the
   * programme does not exist.
   *
   * Anything stored on an account but missing from the list is appended
   * rather than dropped, so an older course value stays reachable instead of
   * becoming a record nobody can filter to.
   */
  const programOptionsInScope = useMemo(() => {
    const stored = new Set(
      scoped.map((post) => findUser(db, post.authorId)?.course).filter(Boolean)
    );
    const extras = [...stored].filter((name) => !PROGRAMS.includes(name)).sort();
    return [...PROGRAMS, ...extras];
  }, [scoped, db]);

  // Which kinds this route could possibly show, for the kind dropdown.
  const kindOptions = useMemo(() => {
    let list = KIND_LIST;
    if (lockedGroup) list = list.filter((item) => item.group === lockedGroup);
    if (lockedKinds) list = list.filter((item) => lockedKinds.includes(item.key));
    return list;
  }, [lockedGroup, lockedKinds]);

  /*
   * THE FAMILIES THIS ROUTE COULD USEFULLY OFFER.
   *
   * Only where the route has not pinned kinds. Open Work is pinned to the
   * kinds that need a department - every concern kind plus Request - so a
   * "Suggestions (all)" option there would show requests alone, which is not
   * what the label promises. The kinds themselves are still in the dropdown.
   */
  const groupOptions = useMemo(() => {
    if (lockedKinds) return [];
    const present = [...new Set(kindOptions.map((item) => item.group))];
    return present.length > 1 ? present : [];
  }, [kindOptions, lockedKinds]);

  /*
   * IS THIS A QUEUE WHERE WORK GETS OWNED BY SOMEBODY?
   *
   * `needsAssignment` in data/workflow.js already records which kinds get
   * handed to a department - every concern and a request do, a suggestion or
   * a plain suggestion never does. Reading the answer off the kinds this
   * route can show means it is derived, not configured per page, so a kind
   * added to workflow.js lands on the correct side of this by itself.
   *
   * Pending Approval holds suggestions as well as concerns, so it comes out
   * false: nothing there has an owner yet, and asking who owns it is exactly
   * the wrong question at that stage.
   */
  const assignsWork = queue && kindOptions.every((item) => item.needsAssignment);

  /*
   * DOWNLOAD WHAT IS ON SCREEN.
   *
   * `rows` is the filtered set, so this takes exactly the search that has
   * been built up - "open concerns from Nursing, oldest first" - rather than
   * the whole table. Reports & Exports already hands over everything; the
   * useful thing here is the slice, because narrowing it is the work that
   * would otherwise be thrown away at the point of exporting.
   *
   * Identities are never included. Reports & Exports offers that behind a
   * tick box with an explanation attached, and a decision about anonymity
   * belongs on the page built to explain it - not on a button beside a
   * search box, clicked in passing.
   */
  function downloadFiltered() {
    const headers = submissionHeaders();
    const data = rows.map((post) => submissionRow(db, post));

    // Name the file after the view, so two downloads are told apart later.
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    downloadCsv(`campusvoicebox-${slug}-${stamp()}.csv`, toCsv(headers, data));
  }

  const reviewing = reviewingId ? db.posts.find((post) => post.id === reviewingId) : null;

  const columns = [
    {
      key: 'title',
      header: 'Submission',
      sortable: true,
      sortValue: (post) => post.title,
      cell: (post) => (
        <div className="min-w-0 max-w-md">
          <p className="truncate font-semibold text-navy-900">{post.title}</p>
          <p className="truncate text-xs text-slate-500">{post.message}</p>
        </div>
      ),
    },
    /*
     * WHO RAISED IT, or WHO OWNS IT - one column, never both.
     *
     * These answer different questions and each route only asks one of them.
     * Deciding whether to publish somebody's words needs the author. Chasing
     * a pothole that has been open eleven days needs the department, and the
     * author is beside the point. Showing both was what pushed this table
     * 150px past its container and knocked the age column off the edge.
     *
     * Nothing is lost by swapping: the search box still matches on author
     * name, email and student number on every route, and the review dialog
     * still shows the full identity with the anonymity notice attached.
     */
    assignsWork
      ? {
          key: 'department',
          header: 'Department',
          hideOn: 'md',
          sortable: true,
          // Unassigned sorts to the top - it is the row that needs a decision.
          sortValue: (post) => (post.department ? departmentLabel(post.department) : ''),
          cell: (post) =>
            post.department ? (
              <span className="truncate text-sm text-slate-700">
                {departmentLabel(post.department)}
              </span>
            ) : (
              /* Approved but handed to nobody. This is the gap the Departments
                 page counts as "Needs assigning" - now visible from the queue
                 where it can actually be fixed, instead of only from a panel
                 two pages away. */
              <span className="whitespace-nowrap text-xs font-semibold text-amber-700">
                Unassigned
              </span>
            ),
        }
      : {
          key: 'author',
          header: 'Submitted by',
          hideOn: 'md',
          sortable: true,
          sortValue: (post) => authorLabel(db, post, user),
          cell: (post) => {
            const author = findUser(db, post.authorId);
            return (
              <div className="min-w-0">
                {/* The admin view always resolves the real person, with the
                    anonymous flag shown beside it rather than hiding the name. */}
                <p className="truncate text-sm text-slate-700">
                  {author?.name ?? 'Deleted account'}
                </p>
                <p className="truncate text-xs text-slate-400">
                  {post.anonymous ? 'Anonymous on the board' : author?.studentId || author?.email}
                </p>
              </div>
            );
          },
        },
    /*
     * TYPE, dropped on an assignment queue.
     *
     * Pending Approval genuinely needs it - a safety report and a suggestion
     * about vending machines are read very differently, and both are sitting
     * in that list. Once work is being carried out, complaint-versus-report
     * changes nothing about who fixes it or how soon. The Type filter is
     * still there for the rare time it matters, and the badge is still on
     * the row's review dialog.
     */
    !assignsWork && {
      key: 'kind',
      header: 'Type',
      hideOn: 'lg',
      sortable: true,
      sortValue: (post) => kindInfo(post.kind).label,
      cell: (post) => <KindBadge kind={post.kind} />,
    },
    {
      key: 'category',
      header: 'Category',
      hideOn: 'lg',
      sortable: true,
      cell: (post) => <CategoryBadge category={post.category} />,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      cell: (post) => <StatusBadge status={post.status} />,
    },
    {
      key: 'createdAt',
      header: 'Submitted',
      // A queue is ordered by this, so it survives to the narrowest screen -
      // "oldest first" is not a claim you can check with the ages hidden.
      hideOn: queue ? undefined : 'sm',
      sortable: true,
      sortValue: (post) => Date.parse(post.createdAt),
      cell: (post) => <span className="whitespace-nowrap text-xs text-slate-500">{timeAgo(post.createdAt)}</span>,
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      cell: () => (
        <span className="whitespace-nowrap text-xs font-semibold text-navy-600">Review →</span>
      ),
    },
  ].filter(Boolean);

  const filtersActive = Boolean(
    query || category || status || kind || group || department || program
  );

  return (
    <>
      <PageHeader title={title} description={description} />

      <Panel
        title={`${rows.length} ${rows.length === 1 ? 'submission' : 'submissions'}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {filtersActive && (
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-navy-700 transition-colors hover:border-navy-600 hover:bg-navy-50"
              >
                Clear filters
              </button>
            )}

            {/*
              Solid navy with an icon, rather than the outlined button it
              started as. Outlined matched "Clear filters" beside it, which
              made the two read as one pair of minor controls and this one
              easy to miss entirely. The arrow does most of the work - a
              downward arrow into a tray is read as "download" before the
              label is.

              Disabled on an empty result rather than handing over a file
              with nothing but a header row in it.
            */}
            <button
              type="button"
              onClick={downloadFiltered}
              disabled={rows.length === 0}
              title={`Download these ${rows.length} ${rows.length === 1 ? 'row' : 'rows'} as CSV`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-navy-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-navy-600 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="h-3.5 w-3.5"
              >
                <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
                <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
              </svg>
              Download CSV
            </button>
          </div>
        }
      >
        {/* THE FILTER BAR. Every dropdown is built from data/workflow.js and
            data/categories.js, so a new status or category appears here on its
            own. */}
        <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <div className="sm:col-span-2 lg:col-span-2">
            <TextInput
              type="search"
              value={query}
              onChange={(event) => setFilter('q', event.target.value)}
              placeholder="Search title, content, name, email or student ID..."
              aria-label="Search submissions"
            />
          </div>

          <Select
            value={category}
            onChange={(event) => setFilter('category', event.target.value)}
            aria-label="Filter by category"
            options={[
              { value: '', label: 'All categories' },
              ...CATEGORIES.map((item) => ({ value: item.slug, label: item.label })),
            ]}
          />

          {/* A moderation queue already fixes the status, so offering the
              filter there would only let somebody contradict the page. */}
          {!lockedStatuses && (
            <Select
              value={status}
              onChange={(event) => setFilter('status', event.target.value)}
              aria-label="Filter by status"
              options={[
                { value: '', label: 'All statuses' },
                ...STATUS_LIST.map((item) => ({ value: item.key, label: item.label })),
              ]}
            />
          )}


          {/*
            TYPE - families first, then individual kinds.

            This one control is what replaced the "Suggestions" and "Concerns"
            sidebar entries. Those two pages existed only because this
            dropdown could pick one kind at a time, so "every concern" needed
            a route of its own. With the families in the list, All Submissions
            answers that question directly and the two rows had nothing left
            to offer.

            `group:` prefixes a family so one <select> can carry both; the
            handler splits it back out, and the address keeps them apart as
            ?group=concern or ?kind=report.
          */}
          {kindOptions.length > 1 && (
            <Select
              value={group ? `group:${group}` : kind}
              onChange={(event) => {
                const value = event.target.value;
                const next = new URLSearchParams(searchParams);

                // Picking either one clears the other - a family and a single
                // kind together would just be the kind, worded confusingly.
                next.delete('kind');
                next.delete('group');
                if (value.startsWith('group:')) next.set('group', value.slice(6));
                else if (value) next.set('kind', value);

                next.delete('highlight');
                setSearchParams(next, { replace: true });
              }}
              aria-label="Filter by type"
              options={[
                { value: '', label: 'All types' },
                ...groupOptions.map((key) => ({
                  value: `group:${key}`,
                  label: key === 'concern' ? 'Concerns (all)' : 'Suggestions (all)',
                })),
                ...kindOptions.map((item) => ({ value: item.key, label: item.label })),
              ]}
            />
          )}

          {/*
            PROGRAM. Admin-only, and it shows the author's course rather than
            anything the student chose to attach to the post - which is worth
            being deliberate about. It reveals nothing new: this table's
            "Submitted by" column already names every author, anonymous ones
            included, because identity traceability is the point of the admin
            view. What the board shows is unaffected.
          */}
          {programOptionsInScope.length > 0 && (
            <Select
              value={program}
              onChange={(event) => setFilter('program', event.target.value)}
              aria-label="Filter by program"
              options={[
                { value: '', label: 'All programs' },
                ...programOptionsInScope.map((name) => ({ value: name, label: name })),
              ]}
            />
          )}

          {/* Department. This is what the Departments page links through to,
              and it doubles as an ordinary filter for anybody who lands here
              directly - but only where something has actually been assigned. */}
          {departmentOptions.length > 0 && (
            <Select
              value={department}
              onChange={(event) => setFilter('department', event.target.value)}
              aria-label="Filter by department"
              options={[
                { value: '', label: 'All departments' },
                ...departmentOptions.map((item) => ({ value: item.key, label: item.label })),
              ]}
            />
          )}
        </div>

        <DataTable
          rows={rows}
          columns={columns}
          onRowClick={(post) => setReviewingId(post.id)}
          emptyTitle="No submissions here"
          emptyMessage={
            filtersActive
              ? 'Nothing matches these filters. Try clearing them.'
              : 'Nothing has been submitted into this view yet.'
          }
          /*
           * A QUEUE reads oldest first, everything else newest first.
           *
           * Browsing the record, the newest thing is the interesting one. In a
           * queue it is the opposite: the row that matters is the submission
           * that has been sitting longest, because that is the student who has
           * been waiting longest. Newest-first buried an eleven-day-old
           * request under whatever arrived this morning.
           */
          initialSort={{ key: 'createdAt', direction: queue ? 'asc' : 'desc' }}
        />
      </Panel>

      {reviewing && (
        <SubmissionReview
          post={reviewing}
          onClose={() => {
            setReviewingId(null);
            // Drop ?highlight= too, so closing the dialog sticks instead of
            // the effect above immediately reopening it.
            if (highlight) {
              const next = new URLSearchParams(searchParams);
              next.delete('highlight');
              setSearchParams(next, { replace: true });
            }
          }}
        />
      )}
    </>
  );
}

export default Submissions;
