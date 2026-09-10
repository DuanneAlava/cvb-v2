import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { PERMISSIONS, ROLE_LIST, isAdminRole } from '../../data/roles.js';
import { useStore, userActivity } from '../../services/store.js';
import DataTable from '../../components/admin/DataTable.jsx';
import {
  AccountStatusBadge,
  Avatar,
  PageHeader,
  Panel,
  RoleBadge,
  Select,
  TextInput,
  formatDate,
  timeAgo,
} from '../../components/admin/ui.jsx';

/*
 * Every account on the platform, in one searchable list.
 *
 * The same page serves "All Users", "Students" and any other slice, because
 * the filters live in the address bar: /admin/users?role=student is the
 * students view. That keeps one screen to maintain instead of several.
 *
 * The activity numbers on each row are counted from the submissions rather
 * than stored on the account, so they cannot fall out of step with what the
 * person has actually posted.
 */
function Users() {
  const { user, can } = useAuth();
  const { db } = useStore(user);
  const navigate = useNavigate();

  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const role = searchParams.get('role') ?? '';
  const status = searchParams.get('status') ?? '';

  function setFilter(key, value) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  }

  const rows = useMemo(() => {
    const search = query.trim().toLowerCase();

    return db.users
      .filter((account) => {
        if (role && account.role !== role) return false;
        if (status && account.status !== status) return false;

        if (!search) return true;
        return [account.name, account.email, account.studentId, account.course, account.id]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(search);
      })
      .map((account) => ({ ...account, activity: userActivity(db, account.id) }))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [db, query, role, status]);

  const columns = [
    {
      key: 'name',
      header: 'User',
      sortable: true,
      cell: (account) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={account.name} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-semibold text-navy-900">{account.name}</p>
            <p className="truncate text-xs text-slate-500">{account.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'studentId',
      header: 'Student ID',
      hideOn: 'md',
      sortable: true,
      cell: (account) => (
        <span className="whitespace-nowrap text-sm text-slate-600">
          {account.studentId || <span className="text-slate-300">—</span>}
        </span>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      sortable: true,
      cell: (account) => <RoleBadge role={account.role} />,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      cell: (account) => <AccountStatusBadge status={account.status} />,
    },
    /*
      NO "POSTS" COLUMN. It printed suggestions + concerns - the two columns
      to its right - because every kind belongs to exactly one of those two
      groups, so the total is arithmetic rather than information. The row
      total is still on the account's own profile page, where there is room
      for it and nothing beside it to do the addition.
    */
    {
      key: 'suggestions',
      header: 'Suggestions',
      align: 'right',
      hideOn: 'lg',
      sortable: true,
      sortValue: (account) => account.activity.suggestions,
      cell: (account) => account.activity.suggestions,
    },
    {
      key: 'concerns',
      header: 'Concerns',
      align: 'right',
      hideOn: 'lg',
      sortable: true,
      sortValue: (account) => account.activity.concerns,
      cell: (account) => account.activity.concerns,
    },
    {
      key: 'createdAt',
      header: 'Registered',
      hideOn: 'md',
      sortable: true,
      sortValue: (account) => Date.parse(account.createdAt),
      cell: (account) => (
        <span className="whitespace-nowrap text-xs text-slate-500">{formatDate(account.createdAt)}</span>
      ),
    },
    {
      key: 'lastLogin',
      header: 'Last active',
      hideOn: 'sm',
      sortable: true,
      sortValue: (account) => Date.parse(account.lastLogin || 0),
      cell: (account) => (
        <span className="whitespace-nowrap text-xs text-slate-500">{timeAgo(account.lastLogin)}</span>
      ),
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      cell: () => <span className="whitespace-nowrap text-xs font-semibold text-navy-600">Profile →</span>,
    },
  ];

  const adminCount = db.users.filter((account) => isAdminRole(account.role)).length;
  const filtersActive = Boolean(query || role || status);

  return (
    <>
      <PageHeader
        title="Users"
        description={`${db.users.length} accounts · ${adminCount} with admin access`}
      />

      <Panel
        title={`${rows.length} ${rows.length === 1 ? 'account' : 'accounts'}`}
        actions={
          filtersActive && (
            <button
              type="button"
              onClick={() => setSearchParams({})}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-navy-700 transition-colors hover:border-navy-600 hover:bg-navy-50"
            >
              Clear filters
            </button>
          )
        }
      >
        <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <TextInput
              type="search"
              value={query}
              onChange={(event) => setFilter('q', event.target.value)}
              placeholder="Search name, email, student ID or course..."
              aria-label="Search users"
            />
          </div>

          <Select
            value={role}
            onChange={(event) => setFilter('role', event.target.value)}
            aria-label="Filter by role"
            options={[
              { value: '', label: 'All roles' },
              ...ROLE_LIST.map((item) => ({ value: item.key, label: item.label })),
            ]}
          />

          <Select
            value={status}
            onChange={(event) => setFilter('status', event.target.value)}
            aria-label="Filter by account status"
            options={[
              { value: '', label: 'All statuses' },
              { value: 'active', label: 'Active' },
              { value: 'suspended', label: 'Suspended' },
            ]}
          />
        </div>

        <DataTable
          rows={rows}
          columns={columns}
          onRowClick={
            can(PERMISSIONS.MANAGE_USERS) ? (account) => navigate(`/admin/users/${account.id}`) : undefined
          }
          emptyTitle="No accounts match"
          emptyMessage="Try a different search or clear the filters."
          initialSort={{ key: 'createdAt', direction: 'desc' }}
        />
      </Panel>
    </>
  );
}

export default Users;
