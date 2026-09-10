import { useMemo, useState } from 'react';
import { EmptyState } from './ui.jsx';

/*
 * The one table the whole admin panel uses.
 *
 * Users, submissions, concerns and the audit log are all lists of records with
 * columns, so they share this rather than each page growing its own table with
 * its own slightly different sorting bug.
 *
 * A page describes its columns and hands over its rows:
 *
 *   <DataTable
 *     rows={users}
 *     columns={[
 *       { key: 'name',  header: 'Name', sortable: true, cell: (u) => u.name },
 *       { key: 'email', header: 'Email', cell: (u) => u.email, hideOn: 'sm' },
 *     ]}
 *     onRowClick={(user) => navigate(`/admin/users/${user.id}`)}
 *   />
 *
 * Column options:
 *   key       identifies the column, and is what sorting refers to
 *   header    the text in the heading row
 *   cell      (row) => what to draw in the cell
 *   sortValue (row) => the value to sort on, when it differs from the cell
 *   sortable  whether the heading can be clicked
 *   hideOn    'sm' or 'md' - drop this column on narrow screens rather than
 *             letting the table crush every column to fit
 *   align     'right' for numbers, so they line up
 *
 * RESPONSIVENESS
 * On a phone the table scrolls sideways inside its own box rather than pushing
 * the page wider - a page that scrolls horizontally is unusable on a phone.
 * Columns marked `hideOn` drop out first so the important ones survive.
 */

function SortIcon({ direction }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden="true"
      className={`h-3 w-3 shrink-0 transition-opacity ${direction ? 'opacity-100' : 'opacity-25'}`}
    >
      {direction === 'desc' ? (
        <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="m6 15 6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

function DataTable({
  rows,
  columns,
  onRowClick,
  emptyTitle = 'Nothing to show',
  emptyMessage = 'No records match the filters you have set.',
  initialSort = null, // { key, direction }
  pageSize = 25,
}) {
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(0);

  // Clicking a heading cycles ascending -> descending -> ascending.
  function toggleSort(key) {
    setPage(0);
    setSort((current) =>
      current?.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    );
  }

  const sortedRows = useMemo(() => {
    if (!sort) return rows;

    const column = columns.find((candidate) => candidate.key === sort.key);
    if (!column) return rows;

    // Sort on `sortValue` when the column provides one, because the cell often
    // renders a badge or a link rather than something comparable.
    const valueOf = column.sortValue ?? ((row) => row[column.key]);

    // Copied before sorting: sort() rearranges in place, and mutating props
    // is how lists start rendering in a different order than they hold.
    return [...rows].sort((a, b) => {
      const left = valueOf(a);
      const right = valueOf(b);

      let comparison;
      if (typeof left === 'number' && typeof right === 'number') {
        comparison = left - right;
      } else {
        comparison = String(left ?? '').localeCompare(String(right ?? ''), undefined, {
          numeric: true,
        });
      }

      return sort.direction === 'asc' ? comparison : -comparison;
    });
  }, [rows, columns, sort]);

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize));

  // Guards against being left on page 5 after a filter cuts the list to one page.
  const safePage = Math.min(page, pageCount - 1);
  const visibleRows = sortedRows.slice(safePage * pageSize, safePage * pageSize + pageSize);

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} message={emptyMessage} />;
  }

  const hideClass = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell' };

  return (
    <div>
      {/* The scroll box. `overflow-x-auto` keeps the sideways scrolling inside
          this element instead of the whole page. */}
      <div className="-mx-4 overflow-x-auto sm:mx-0">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left">
              {columns.map((column) => {
                const active = sort?.key === column.key;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className={`px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 ${
                      column.align === 'right' ? 'text-right' : ''
                    } ${column.hideOn ? hideClass[column.hideOn] : ''}`}
                  >
                    {column.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column.key)}
                        /*
                         * `min-h-[44px]` is the touch-target floor; the text
                         * alone left these at 16px. The negative vertical
                         * margin lets the button grow back OVER the cell's own
                         * padding rather than on top of it, so the tap area
                         * reaches 44px without the header row getting taller.
                         */
                        className={`-my-2.5 inline-flex min-h-[44px] items-center gap-1 uppercase tracking-wide transition-colors hover:text-navy-700 ${
                          active ? 'text-navy-700' : ''
                        }`}
                      >
                        {column.header}
                        <SortIcon direction={active ? sort.direction : null} />
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {visibleRows.map((row) => (
              <tr
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`border-b border-slate-100 last:border-0 ${
                  onRowClick ? 'cursor-pointer transition-colors hover:bg-navy-50/60' : ''
                }`}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-3 py-3 align-middle text-slate-700 ${
                      column.align === 'right' ? 'text-right tabular-nums' : ''
                    } ${column.hideOn ? hideClass[column.hideOn] : ''}`}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paging only appears once there is more than one page of records. */}
      {pageCount > 1 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-sm">
          <p className="text-slate-500">
            Showing {safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, sortedRows.length)}{' '}
            of {sortedRows.length}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage(safePage - 1)}
              disabled={safePage === 0}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-navy-700 transition-colors hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-slate-500">
              Page {safePage + 1} of {pageCount}
            </span>
            <button
              type="button"
              onClick={() => setPage(safePage + 1)}
              disabled={safePage >= pageCount - 1}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-navy-700 transition-colors hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataTable;
