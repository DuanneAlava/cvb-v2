import { useMemo } from 'react';
import { AUDIT_ACTIONS, auditLabel } from '../../data/workflow.js';
import { useStore } from '../../services/store.js';
import { useFilterParams } from '../../hooks/useFilterParams.js';
import DataTable from '../../components/admin/DataTable.jsx';
import {
  Avatar,
  Badge,
  PageHeader,
  Panel,
  RoleBadge,
  Select,
  TextInput,
  formatDateTime,
  matchesSearch,
  plural,
} from '../../components/admin/ui.jsx';

/*
 * The audit log.
 *
 * Every administrative action that changes somebody else's data is recorded -
 * approvals, rejections, assignments, suspensions, role changes, sign-ins.
 * The entries are written by the server as part of the action itself, not by
 * the screens, so an action cannot quietly skip being logged.
 *
 * The page lists the most recent 500 - what arrives with the rest of the
 * records. Nothing older is lost: the whole log is downloaded from Reports &
 * Exports.
 *
 * This is what makes the panel accountable rather than merely powerful: if a
 * student asks why their post was rejected, or who suspended their account,
 * there is an answer with a name and a timestamp on it.
 *
 * The log is read-only on purpose. There is no delete button, because a log
 * that administrators can edit is not evidence of anything.
 */
function ActivityLogs() {
  const { db } = useStore();

  // Filters live in the address bar - see hooks/useFilterParams.js.
  const { searchParams, setFilter } = useFilterParams();
  const query = searchParams.get('q') ?? '';
  const action = searchParams.get('action') ?? '';
  const adminId = searchParams.get('admin') ?? '';

  const rows = useMemo(() => {
    return db.audit.filter((entry) => {
      if (action && entry.action !== action) return false;
      if (adminId && entry.adminId !== adminId) return false;

      return matchesSearch(
        [entry.adminName, entry.details, entry.targetId, auditLabel(entry.action)],
        query
      );
    });
  }, [db.audit, query, action, adminId]);

  // Only administrators who have actually done something appear in the filter.
  // An entry from the server's make-admin command has no account behind it,
  // so it is not an administrator anybody can filter by.
  const admins = useMemo(() => {
    const seen = new Map();
    db.audit.forEach((entry) => {
      if (entry.adminId) seen.set(entry.adminId, entry.adminName);
    });
    return [...seen.entries()].map(([id, name]) => ({ value: id, label: name }));
  }, [db.audit]);

  const columns = [
    {
      key: 'adminName',
      header: 'Administrator',
      sortable: true,
      cell: (entry) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={entry.adminName} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-semibold text-navy-900">{entry.adminName}</p>
            <RoleBadge role={entry.adminRole} />
          </div>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      sortable: true,
      sortValue: (entry) => auditLabel(entry.action),
      cell: (entry) => (
        <Badge className="bg-slate-100 text-slate-700">{auditLabel(entry.action)}</Badge>
      ),
    },
    {
      key: 'details',
      header: 'Details',
      hideOn: 'md',
      cell: (entry) => (
        <p className="max-w-md truncate text-sm text-slate-600">{entry.details || '—'}</p>
      ),
    },
    {
      key: 'targetId',
      header: 'Target',
      hideOn: 'lg',
      cell: (entry) => (
        <span className="whitespace-nowrap font-mono text-xs text-slate-400">
          {entry.targetId || '—'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'When',
      sortable: true,
      sortValue: (entry) => Date.parse(entry.createdAt),
      cell: (entry) => (
        <span className="whitespace-nowrap text-xs text-slate-500">
          {formatDateTime(entry.createdAt)}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Activity Logs"
        description="A read-only record of every administrative action, newest first. The latest 500 are listed here; download the whole log from Reports & Exports."
      />

      <Panel title={plural(rows.length, 'entry', 'entries')}>
        <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <TextInput
              type="search"
              value={query}
              onChange={(event) => setFilter('q', event.target.value)}
              placeholder="Search administrator, action or details..."
              aria-label="Search the activity log"
            />
          </div>

          <Select
            value={action}
            onChange={(event) => setFilter('action', event.target.value)}
            aria-label="Filter by action"
            options={[
              { value: '', label: 'All actions' },
              ...Object.entries(AUDIT_ACTIONS).map(([key, label]) => ({ value: key, label })),
            ]}
          />

          <Select
            value={adminId}
            onChange={(event) => setFilter('admin', event.target.value)}
            aria-label="Filter by administrator"
            options={[{ value: '', label: 'All administrators' }, ...admins]}
          />
        </div>

        <DataTable
          rows={rows}
          columns={columns}
          emptyTitle="Nothing logged yet"
          emptyMessage="Administrative actions are recorded here as they happen."
          initialSort={{ key: 'createdAt', direction: 'desc' }}
          pageSize={20}
        />
      </Panel>
    </>
  );
}

export default ActivityLogs;
