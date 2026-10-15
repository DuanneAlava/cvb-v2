import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useStore } from '../../services/store.js';
import { useFilterParams } from '../../hooks/useFilterParams.js';
import { PERMISSIONS } from '../../data/roles.js';
import {
  OPEN_PRIVACY_STATUSES,
  PRIVACY_EVENT_WORDS,
  PRIVACY_REQUEST_STATUSES,
  requestTypeLabel,
} from '../../data/policies.js';
import Button from '../../components/Button.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import DataTable from '../../components/admin/DataTable.jsx';
import Modal from '../../components/admin/Modal.jsx';
import {
  Badge,
  DetailList,
  Field,
  Notice,
  PageHeader,
  Panel,
  Select,
  TextArea,
  formatDateTime,
  plural,
} from '../../components/admin/ui.jsx';

/*
 * PRIVACY REQUESTS - /admin/privacy, for MANAGE_PRIVACY only.
 *
 * What people asked about their own information from the Privacy & Data
 * section of their account page (components/PrivacyData.jsx): a copy of
 * more than the download holds, a correction, deleting their account, or
 * another privacy matter. Kept apart from the submission queues on purpose -
 * this is not moderation.
 *
 * HANDLING ONE
 *   Start handling   tells the person somebody is on it (a reply is optional)
 *   Complete         done - a reply saying what was done is required
 *   Decline          not done - a reply saying why is required
 * The person is notified each time and sees the reply on their account page.
 *
 * A DELETION REQUEST is completed by deleting the account, here, in the same
 * step. The administrator chooses whether the person's submissions go too or
 * stay without their name. That needs DELETE_USERS as well, and cannot be
 * undone - so it asks first.
 *
 * NOBODY HANDLES THEIR OWN. A request about the signed-in administrator's
 * own account is shown, but only another administrator can act on it. The
 * server refuses it too (backend/src/routes/adminRoutes.js).
 *
 * THE PRIVACY LOG, at the foot of the page, records every request made,
 * cancelled and handled, and every data download - who, what, when. Like
 * the activity log, it cannot be edited or deleted from anywhere.
 */

const STATUS_FILTERS = [
  { value: '', label: 'Open requests' },
  { value: 'all', label: 'All requests' },
  ...Object.entries(PRIVACY_REQUEST_STATUSES).map(([value, info]) => ({ value, label: info.label })),
];

function StatusBadge({ status }) {
  const info = PRIVACY_REQUEST_STATUSES[status];
  return <Badge className={info.className}>{info.label}</Badge>;
}

function PrivacyRequests() {
  const { db } = useStore();
  const { user } = useAuth();
  const { searchParams, setFilter } = useFilterParams();
  const statusFilter = searchParams.get('status') ?? '';
  const [openId, setOpenId] = useState(null);

  const rows = useMemo(
    () =>
      db.privacyRequests.filter((request) => {
        if (statusFilter === '') return OPEN_PRIVACY_STATUSES.includes(request.status);
        if (statusFilter === 'all') return true;
        return request.status === statusFilter;
      }),
    [db.privacyRequests, statusFilter]
  );

  const opened = db.privacyRequests.find((request) => request.id === openId) ?? null;

  const columns = [
    {
      key: 'requesterName',
      header: 'Requested by',
      sortable: true,
      cell: (request) => (
        // A real button, so the row can be opened from the keyboard too.
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setOpenId(request.id);
          }}
          className="min-w-0 text-left"
        >
          <span className="block truncate font-semibold text-navy-900 hover:underline">
            {request.requesterName}
          </span>
          <span className="block truncate text-xs text-slate-500">{request.requesterEmail}</span>
          {request.userId === user.id && (
            <Badge className="mt-1 bg-slate-100 text-slate-700">Your own account</Badge>
          )}
        </button>
      ),
    },
    {
      key: 'type',
      header: 'Request',
      sortable: true,
      sortValue: (request) => requestTypeLabel(request.type),
      cell: (request) => <span className="text-sm text-navy-900">{requestTypeLabel(request.type)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      cell: (request) => <StatusBadge status={request.status} />,
    },
    {
      key: 'createdAt',
      header: 'Sent',
      sortable: true,
      sortValue: (request) => Date.parse(request.createdAt),
      cell: (request) => (
        <span className="whitespace-nowrap text-xs text-slate-500">{formatDateTime(request.createdAt)}</span>
      ),
    },
    {
      key: 'handledBy',
      header: 'Handled by',
      hideOn: 'md',
      cell: (request) => <span className="text-sm text-slate-600">{request.handledBy || '—'}</span>,
    },
  ];

  const logColumns = [
    {
      key: 'actorName',
      header: 'Who',
      cell: (event) => <span className="font-semibold text-navy-900">{event.actorName}</span>,
    },
    {
      key: 'action',
      header: 'What',
      cell: (event) => (
        <Badge className="bg-slate-100 text-slate-700">{PRIVACY_EVENT_WORDS[event.action] ?? event.action}</Badge>
      ),
    },
    {
      key: 'details',
      header: 'About',
      hideOn: 'md',
      cell: (event) => (
        <p className="max-w-md truncate text-sm text-slate-600">
          {[event.subjectName, event.details].filter(Boolean).join(' - ') || '—'}
        </p>
      ),
    },
    {
      key: 'createdAt',
      header: 'When',
      cell: (event) => (
        <span className="whitespace-nowrap text-xs text-slate-500">{formatDateTime(event.createdAt)}</span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Privacy Requests"
        description="What people asked about their own information. Each step is recorded in the privacy log below, and the person is told."
      />

      <div className="space-y-4">
        <Panel title={plural(rows.length, 'request')}>
          <div className="mb-4 max-w-xs">
            <Select
              value={statusFilter}
              onChange={(event) => setFilter('status', event.target.value)}
              aria-label="Filter by status"
              options={STATUS_FILTERS}
            />
          </div>

          <DataTable
            rows={rows}
            columns={columns}
            onRowClick={(request) => setOpenId(request.id)}
            emptyTitle={statusFilter === '' ? 'No open requests' : 'Nothing to show'}
            emptyMessage={
              statusFilter === ''
                ? 'Requests appear here when somebody makes one from their account page.'
                : 'No requests match this filter.'
            }
            initialSort={{ key: 'createdAt', direction: 'asc' }}
            pageSize={20}
          />
        </Panel>

        <Panel
          title="Privacy log"
          description="Every request made, cancelled and handled, and every data download. It cannot be edited. The latest 300 are shown."
        >
          <DataTable
            rows={db.privacyEvents}
            columns={logColumns}
            emptyTitle="Nothing recorded yet"
            emptyMessage="Privacy actions are recorded here as they happen."
            pageSize={20}
          />
        </Panel>
      </div>

      {opened && <RequestDialog key={opened.id} request={opened} onClose={() => setOpenId(null)} />}
    </>
  );
}

/*
 * ONE REQUEST - what was asked, what has been done, and the buttons to move
 * it on. Drawn from the latest copy of the records, so it updates in place
 * once an action has gone through.
 */
function RequestDialog({ request, onClose }) {
  const store = useStore();
  const { user, can } = useAuth();

  const [reply, setReply] = useState('');
  const [deletePosts, setDeletePosts] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [confirmingDeletion, setConfirmingDeletion] = useState(false);

  const isOwn = request.userId === user.id;
  const isOpen = OPEN_PRIVACY_STATUSES.includes(request.status);
  const deletesAccount = request.type === 'deletion' && request.userId !== null;
  const mayDelete = can(PERMISSIONS.DELETE_USERS);
  const label = requestTypeLabel(request.type);

  async function move(status) {
    setConfirmingDeletion(false);
    setBusy(true);
    const changes = { status, response: reply, ...(deletesAccount && status === 'completed' ? { deletePosts } : {}) };
    const result = await store.updatePrivacyRequest(request.id, changes);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      setDone('');
      return;
    }
    setError('');
    setReply('');
    setDone(
      status === 'in_progress'
        ? 'Marked as being handled. They have been told.'
        : deletesAccount && status === 'completed'
          ? `The account has been deleted, and their submissions ${deletePosts ? 'deleted' : 'kept without their name'}.`
          : `The request is ${PRIVACY_REQUEST_STATUSES[status].label.toLowerCase()}. They have been told.`
    );
  }

  // A deletion asks "are you sure?" first - so a missing reply, which the
  // server would refuse anyway, is said before that, not after it.
  function handleComplete() {
    if (!deletesAccount) return move('completed');
    if (!reply.trim()) {
      setError('Write a reply for the person - they are shown it.');
      return;
    }
    setConfirmingDeletion(true);
  }

  const footer = (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={onClose}>
        Close
      </Button>
      {isOpen && !isOwn && (
        <>
          {request.status === 'pending' && (
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => move('in_progress')}>
              Start handling
            </Button>
          )}
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => move('declined')}>
            Decline
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={busy || (deletesAccount && !mayDelete)}
            onClick={handleComplete}
          >
            {deletesAccount ? 'Delete account and complete' : 'Complete'}
          </Button>
        </>
      )}
    </>
  );

  return (
    <>
      <Modal title={`${label} request`} description={`From ${request.requesterName}`} onClose={onClose} footer={footer}>
        <div className="space-y-4">
          <DetailList
            items={[
              { label: 'Requested by', value: request.requesterName },
              { label: 'Email', value: request.requesterEmail },
              {
                label: 'Account',
                value:
                  request.userId === null ? (
                    'Deleted'
                  ) : can(PERMISSIONS.MANAGE_USERS) ? (
                    <Link to={`/admin/users/${request.userId}`} className="font-semibold text-navy-700 underline">
                      Open their profile
                    </Link>
                  ) : (
                    'Exists'
                  ),
              },
              { label: 'Status', value: <StatusBadge status={request.status} /> },
              { label: 'Sent', value: formatDateTime(request.createdAt) },
              { label: 'Last changed', value: formatDateTime(request.updatedAt) },
              request.resolvedAt && { label: 'Closed', value: formatDateTime(request.resolvedAt) },
              request.handledBy && { label: 'Handled by', value: request.handledBy },
              request.postsOutcome && {
                label: 'Their submissions',
                value: request.postsOutcome === 'deleted' ? 'Deleted' : 'Kept without their name',
              },
            ]}
          />

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">What they asked</p>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-navy-900">
              {request.details || 'No details given.'}
            </p>
          </div>

          {request.response && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Reply sent</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-navy-900">{request.response}</p>
            </div>
          )}

          {isOwn && isOpen && (
            <Notice tone="error" announce={false}>
              This request is about your own account. Another administrator must handle it.
            </Notice>
          )}

          {isOpen && !isOwn && (
            <>
              {request.type === 'access' && (
                <p className="text-sm text-slate-600">
                  They can already download their own data from their account page. This request is
                  for anything more - for example the staff notes on their posts. Send it to them
                  outside CampusVoiceBox, then complete the request saying what was sent.
                </p>
              )}

              {deletesAccount && (
                <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <p>
                    Completing this request deletes their account. It cannot be undone, and they will
                    not be able to log in to read your reply - if they need to know, contact them at{' '}
                    {request.requesterEmail}.
                  </p>
                  <fieldset>
                    <legend className="font-semibold">Their submissions</legend>
                    <label className="mt-1 flex cursor-pointer items-start gap-2">
                      <input
                        type="radio"
                        name="posts-outcome"
                        checked={!deletePosts}
                        onChange={() => setDeletePosts(false)}
                        className="mt-0.5 h-4 w-4 border-slate-300 text-navy-600 focus:ring-navy-600"
                      />
                      Keep them, without their name - for example, a concern still being worked on
                    </label>
                    <label className="mt-1 flex cursor-pointer items-start gap-2">
                      <input
                        type="radio"
                        name="posts-outcome"
                        checked={deletePosts}
                        onChange={() => setDeletePosts(true)}
                        className="mt-0.5 h-4 w-4 border-slate-300 text-navy-600 focus:ring-navy-600"
                      />
                      Delete them too, with their attachments
                    </label>
                  </fieldset>
                  {!mayDelete && <p className="font-semibold">Deleting an account needs the permission to delete users.</p>}
                </div>
              )}

              <Field
                label="Reply to them"
                htmlFor="privacy-reply"
                hint="They see it on their account page and in a notification. Needed to complete or decline."
              >
                <TextArea
                  id="privacy-reply"
                  rows={4}
                  maxLength={2000}
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                />
              </Field>
            </>
          )}

          {error && <Notice>{error}</Notice>}
          {done && <Notice tone="success">{done}</Notice>}
        </div>
      </Modal>

      {confirmingDeletion && (
        <ConfirmDialog
          title={`Delete ${request.requesterName}'s account?`}
          message={`This cannot be undone. Their account is deleted and their submissions are ${
            deletePosts ? 'deleted too' : 'kept without their name'
          }.`}
          confirmLabel="Yes, delete the account"
          onConfirm={() => move('completed')}
          onCancel={() => setConfirmingDeletion(false)}
        />
      )}
    </>
  );
}

export default PrivacyRequests;
