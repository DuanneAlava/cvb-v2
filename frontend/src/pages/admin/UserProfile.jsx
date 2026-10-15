import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { PERMISSIONS, ROLE_LIST } from '../../data/roles.js';
import { useStore, userActivity, findUser } from '../../services/store.js';
import { programOptions } from '../../data/programs.js';
import { ACCOUNT_FIELDS } from '../../data/accountFields.js';
import Button from '../../components/Button.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import DataTable from '../../components/admin/DataTable.jsx';
import SubmissionReview from '../../components/admin/SubmissionReview.jsx';
import PrivacyData from '../../components/PrivacyData.jsx';
import ChangePasswordForm from '../../components/ChangePasswordForm.jsx';
import {
  AccountStatusBadge,
  Avatar,
  CategoryBadge,
  DetailList,
  EmptyState,
  Field,
  KindBadge,
  Notice,
  PageHeader,
  Panel,
  RoleBadge,
  Select,
  StatCard,
  StatusBadge,
  TextInput,
  formatDate,
  formatDateTime,
  timeAgo,
} from '../../components/admin/ui.jsx';

/*
 * One account, in full: who they are, what they have submitted, and the
 * controls for acting on the account.
 *
 * The brief asked that an administrator be able to understand somebody's
 * activity without hopping between pages, so their profile, their figures and
 * every one of their submissions are all on this one screen - and a submission
 * opens for review right here rather than sending you off to another page.
 *
 * THE EDIT FORM AND THE READ-ONLY VIEW ARE BUILT FROM ONE LIST
 * The fields come from data/accountFields.js, which the student's own
 * account page reads too. Adding "Campus" to an account means adding a line
 * there, and this form, this view and the student's form all pick it up - it
 * does not need a matching change in three other places, which is what the
 * brief was warning against.
 *
 * WHAT YOU'LL MEET IN THIS FILE (plain-English notes)
 *
 * - useParams()  Reads the variable part of the address. The route is
 *   /admin/users/:userId, so on /admin/users/user-lx3k9f1 this returns
 *   { userId: 'user-lx3k9f1' }.
 * - An early return for "not found"  If the account does not exist the
 *   function returns a small "gone" screen straight away, so nothing below
 *   has to keep checking whether `account` is null.
 * - `confirming` holding one of three strings  'suspend' | 'activate' |
 *   'delete' | null. One piece of state drives one ConfirmDialog
 *   with three sets of wording, picked by `{ suspend: {...}, ... }[confirming]`
 *   - an object used as a lookup table, indexed by the current value.
 * - `[isSelf]`  "Is this the signed-in admin's own account?" Several controls
 *   check it, because you must not be able to suspend, delete or demote
 *   yourself by accident.
 * - `...ACCOUNT_FIELDS.map(...)` inside an array literal  Spread the mapped
 *   list into a bigger list, so the fixed rows (Account ID, Registered) can
 *   follow the generated ones.
 */

function UserProfile() {
  const { userId } = useParams();
  const { user, can } = useAuth();
  const store = useStore();
  const navigate = useNavigate();

  const account = findUser(store.db, userId);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [confirming, setConfirming] = useState(null); // 'suspend' | 'activate' | 'delete'
  const [reviewingId, setReviewingId] = useState(null);
  const [error, setError] = useState('');
  // True while a change is on its way to the server.
  const [busy, setBusy] = useState(false);

  const activity = useMemo(
    () => (account ? userActivity(store.db, account.id) : null),
    [store.db, account]
  );

  const submissions = useMemo(
    () =>
      store.db.posts
        .filter((post) => post.authorId === userId)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [store.db.posts, userId]
  );

  if (!account) {
    return (
      <>
        <PageHeader title="Account not found" />
        <EmptyState
          title="This account no longer exists"
          message="It may have been deleted. Their submissions are kept on the board."
        >
          <Link to="/admin/users">
            <Button variant="primary">Back to users</Button>
          </Link>
        </EmptyState>
      </>
    );
  }

  const isSelf = account.id === user.id;
  const maySeeIdentity = can(PERMISSIONS.VIEW_IDENTITY);

  function startEditing() {
    // Seed the form from the account, so unchanged fields keep their values.
    const seed = {};
    ACCOUNT_FIELDS.forEach((field) => {
      seed[field.key] = account[field.key] ?? '';
    });
    setDraft(seed);
    setEditing(true);
    setError('');
  }

  // Every change on this page goes through here: one request at a time, and
  // the server's reason shown if it refuses. Answers what the server sent,
  // or null if it was refused.
  async function act(request) {
    if (busy) return null;
    setBusy(true);
    const result = await request();
    setBusy(false);

    if (result.error) {
      setError(result.error);
      return null;
    }
    setError('');
    return result;
  }

  async function saveEdits() {
    if (await act(() => store.updateUser(account.id, draft))) setEditing(false);
  }

  async function handleConfirmed() {
    const actions = {
      suspend: () => store.setUserStatus(account.id, 'suspended'),
      activate: () => store.setUserStatus(account.id, 'active'),
      delete: () => store.deleteUser(account.id),
    };

    // Kept: `confirming` is cleared below, before the answer arrives.
    const confirmed = confirming;
    setConfirming(null);

    const result = await act(actions[confirmed]);
    if (!result) return;
    if (confirmed === 'delete') navigate('/admin/users');
  }

  const confirmCopy = {
    suspend: {
      title: `Suspend ${account.name}?`,
      message:
        'They will stay signed in and can still read the board, but posting and voting are turned off until the account is reactivated.',
      confirmLabel: 'Suspend account',
    },
    activate: {
      title: `Reactivate ${account.name}?`,
      message: 'They will be able to post and vote again straight away.',
      confirmLabel: 'Reactivate account',
    },
    delete: {
      title: `Delete ${account.name}?`,
      message:
        'This cannot be undone. Their submissions are kept on the board so any concern still being worked on is not lost, but they will no longer have an owner.',
      confirmLabel: 'Delete permanently',
    },
  }[confirming];

  const submissionColumns = [
    {
      key: 'title',
      header: 'Submission',
      sortable: true,
      cell: (post) => (
        <div className="min-w-0 max-w-sm">
          <p className="truncate font-semibold text-navy-900">{post.title}</p>
          <p className="truncate text-xs text-slate-500">{post.message}</p>
        </div>
      ),
    },
    { key: 'kind', header: 'Type', hideOn: 'md', cell: (post) => <KindBadge kind={post.kind} /> },
    {
      key: 'category',
      header: 'Category',
      hideOn: 'lg',
      cell: (post) => <CategoryBadge category={post.category} />,
    },
    { key: 'status', header: 'Status', sortable: true, cell: (post) => <StatusBadge status={post.status} /> },
    {
      key: 'anonymous',
      header: 'Posted as',
      hideOn: 'lg',
      cell: (post) => (
        <span className="whitespace-nowrap text-xs text-slate-500">
          {post.anonymous ? 'Anonymous' : 'Named'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Date',
      hideOn: 'sm',
      sortable: true,
      sortValue: (post) => Date.parse(post.createdAt),
      cell: (post) => <span className="whitespace-nowrap text-xs text-slate-500">{formatDate(post.createdAt)}</span>,
    },
  ];

  const reviewing = reviewingId ? store.db.posts.find((post) => post.id === reviewingId) : null;

  return (
    <>
      <Link
        to="/admin/users"
        className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition-colors hover:text-navy-700"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to users
      </Link>

      <PageHeader title={account.name} description={account.email}>
        {can(PERMISSIONS.MANAGE_USERS) && !editing && (
          <Button variant="ghost" size="sm" onClick={startEditing}>
            Edit account
          </Button>
        )}

        {can(PERMISSIONS.MANAGE_USERS) &&
          !isSelf &&
          (account.status === 'suspended' ? (
            <Button variant="primary" size="sm" onClick={() => setConfirming('activate')}>
              Reactivate
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setConfirming('suspend')} className="!text-amber-700">
              Suspend
            </Button>
          ))}

        {can(PERMISSIONS.DELETE_USERS) && !isSelf && (
          <Button variant="ghost" size="sm" onClick={() => setConfirming('delete')} className="!text-red-600">
            Delete
          </Button>
        )}
      </PageHeader>

      {error && (
        <Notice className="mb-4">
          {error}
        </Notice>
      )}

      {/* Editing your own account here would let you take away your own admin
          rights by accident, so the role control is hidden on your own page. */}
      {isSelf && (
        <p className="mb-4 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
          This is your own account. Suspending, deleting and role changes are disabled here.
          Your password is changed below.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* WHO THEY ARE. */}
        <Panel className="lg:col-span-2" title="User information">
          {editing ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                {ACCOUNT_FIELDS.map((field) => (
                  <Field key={field.key} label={field.label} htmlFor={`edit-${field.key}`}>
                    {field.type === 'select' ? (
                      <Select
                        id={`edit-${field.key}`}
                        value={draft[field.key] ?? ''}
                        onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
                        options={programOptions(draft[field.key] ?? '')}
                      />
                    ) : (
                      <TextInput
                        id={`edit-${field.key}`}
                        type={field.type}
                        value={draft[field.key] ?? ''}
                        onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
                      />
                    )}
                  </Field>
                ))}
              </div>

              {/* The server refuses new school details for somebody who has
                  not agreed to them being kept (backend/src/models/accountRules.js). */}
              <p className="text-xs text-slate-500">
                School details can only be added or changed for a person who has allowed CampusVoiceBox
                to keep them. Clearing them is always allowed.
              </p>

              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" onClick={saveEdits} disabled={busy}>
                  {busy ? 'Saving…' : 'Save changes'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="flex flex-col items-center gap-2">
                <Avatar name={account.name} photo={account.photo} size="lg" />
                <AccountStatusBadge status={account.status} />
                <RoleBadge role={account.role} />
              </div>

              <div className="min-w-0 flex-1">
                {/*
                  The same list the form edits, so the view cannot show a
                  field the form forgot or vice versa - followed by the
                  record-keeping the account carries but nobody types.

                  "Last login" is printed once, as a date with how long ago
                  beside it. It used to be two rows - "Last login" and "Last
                  active" - which were the same timestamp in two formats.
                */}
                <DetailList
                  items={[
                    ...ACCOUNT_FIELDS.map((field) => ({
                      label: field.label,
                      value:
                        field.key === 'email' && !maySeeIdentity ? 'Hidden' : account[field.key],
                    })),
                    { label: 'Account ID', value: account.id },
                    { label: 'Registered', value: formatDate(account.createdAt) },
                    {
                      label: 'Last login',
                      value: account.lastLogin
                        ? `${formatDateTime(account.lastLogin)} (${timeAgo(account.lastLogin)})`
                        : 'Never',
                    },
                  ]}
                />
              </div>
            </div>
          )}
        </Panel>

        {/* THE ROLE. Needs MANAGE_ADMINS, and is never offered on your own
            account - that is what stops an admin promoting or demoting
            themselves by accident. */}
        <Panel title="Access">
          {can(PERMISSIONS.MANAGE_ADMINS) && !isSelf ? (
            <Field
              label="Role"
              htmlFor="account-role"
              hint="Changing this changes which dashboard they land on and what they can do."
            >
              <Select
                id="account-role"
                value={account.role}
                disabled={busy}
                onChange={(event) => {
                  const role = event.target.value;
                  act(() => store.setUserRole(account.id, role));
                }}
                options={ROLE_LIST.map((item) => ({ value: item.key, label: item.label }))}
              />
            </Field>
          ) : (
            <div>
              <p className="text-sm text-slate-600">
                Current role: <RoleBadge role={account.role} />
              </p>
              <p className="mt-2 text-xs text-slate-400">
                {isSelf
                  ? 'You cannot change your own role.'
                  : 'You do not have permission to change account roles.'}
              </p>
            </div>
          )}
        </Panel>
      </div>

      {/* WHAT THEY HAVE DONE. */}
      <h2 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Activity
      </h2>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total Submissions" value={activity.total} />
        <StatCard label="Suggestions" value={activity.suggestions} />
        <StatCard label="Concerns" value={activity.concerns} />
        <StatCard label="Approved" value={activity.approved} tone="good" />
        <StatCard label="Rejected" value={activity.rejected} tone={activity.rejected ? 'bad' : 'default'} />
        <StatCard label="Resolved" value={activity.resolved} tone="good" />
      </div>

      <Panel className="mt-4" title="All submissions by this user">
        <DataTable
          rows={submissions}
          columns={submissionColumns}
          onRowClick={(post) => setReviewingId(post.id)}
          emptyTitle="Nothing submitted yet"
          emptyMessage="This account has not posted to the board."
          initialSort={{ key: 'createdAt', direction: 'desc' }}
          pageSize={10}
        />
      </Panel>

      {/* An administrator's own password, privacy choices and rights - the
          same panels a student has on /account, which forwards admins here.
          Nobody changes or resets another person's password: a forgotten
          one is reset by its owner, with the emailed link from the log-in
          page. A privacy request an admin makes is handled by another. */}
      {isSelf && (
        <div className="mt-4 space-y-4">
          <ChangePasswordForm />
          <PrivacyData />
        </div>
      )}

      {confirming && (
        <ConfirmDialog
          title={confirmCopy.title}
          message={confirmCopy.message}
          confirmLabel={confirmCopy.confirmLabel}
          cancelLabel="Cancel"
          onConfirm={handleConfirmed}
          onCancel={() => setConfirming(null)}
        />
      )}

      {reviewing && <SubmissionReview post={reviewing} onClose={() => setReviewingId(null)} />}
    </>
  );
}

export default UserProfile;
