import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { PERMISSIONS } from '../../data/roles.js';
import {
  AWAITING_REVIEW,
  DEPARTMENTS,
  STATUS_PATH,
  kindInfo,
  statusInfo,
  departmentLabel,
} from '../../data/workflow.js';
import { collegeForProgram } from '../../data/programs.js';
import { useStore, findUser } from '../../services/store.js';
import Button from '../Button.jsx';
import Modal from './Modal.jsx';
import {
  Avatar,
  CategoryBadge,
  DetailList,
  Field,
  KindBadge,
  Select,
  StatusBadge,
  TextArea,
  TextInput,
  formatDateTime,
} from './ui.jsx';

/*
 * Open one submission, read it properly, and act on it.
 *
 * This is the busiest screen in the panel, so it is laid out in the order an
 * administrator actually works:
 *
 *   1. what was submitted        - title, message, photos
 *   2. who submitted it          - the identity block, admins only
 *   3. the decision              - approve, reject, or ask for a revision
 *   4. where it goes next        - department and responsible staff
 *   5. how it ended              - the resolution written back to the student
 *   6. internal notes            - staff-only, never shown to the student
 *
 * Everything here writes through services/store.js, which records the audit
 * entry and sends the student their notification as part of the same write.
 * That is deliberate: an approval that quietly failed to notify anybody would
 * be worse than one that did not happen.
 */

function Section({ title, children, tone = 'default' }) {
  const tones = {
    default: 'border-slate-200 bg-white',
    admin: 'border-amber-200 bg-amber-50', // staff-only areas are tinted
  };

  return (
    <section className={`rounded-xl border p-4 ${tones[tone]}`}>
      <h3 className="text-sm font-bold uppercase tracking-wide text-navy-900">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/*
 * THE PROGRESS STEPPER.
 *
 * Five circles along a line - pending, under review, approved, in progress,
 * resolved - with everything up to and including the current status filled
 * in and the rest greyed out. It replaced a row of plain buttons, which told
 * you what you COULD do next but never where the submission actually was.
 *
 * A step is clickable only when it is a legal move from here, which comes
 * from `next` in data/workflow.js rather than from anything decided in this
 * file. So the drawing and the rules cannot disagree.
 *
 * Rejected is not on the line - see STATUS_PATH. A rejected post is shown as
 * its own state above the stepper instead of being drawn as though it were
 * partway to resolved.
 *
 * ON CLICKING "RESOLVED" DIRECTLY. It is allowed, because it is a legal
 * move. It is worth knowing it records less than "Mark resolved" does:
 * `resolvedAt` and the resolution summary stay empty, so the student is told
 * only "your submission was updated" rather than what was done, and the
 * concern never counts towards any resolution-time figure. The tooltip says
 * so at the point of clicking rather than hiding the option.
 */
function StatusSteps({ post, canMove, onMove }) {
  const currentIndex = STATUS_PATH.indexOf(post.status);
  const rejected = post.status === 'rejected';
  const allowed = statusInfo(post.status).next;

  return (
    <div>
      {rejected && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          This was rejected, so it never travelled the path below. Sending it back to review puts
          it back on at step two.
        </p>
      )}

      {/* Scrolls sideways on a narrow phone rather than squashing the labels. */}
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <ol className="flex min-w-[30rem] items-start">
          {STATUS_PATH.map((key, index) => {
            const done = !rejected && index <= currentIndex;
            const isCurrent = !rejected && index === currentIndex;

            const clickable = canMove && allowed.includes(key) && !isCurrent;

            return (
              /*
                Every step is an equal-width column with the circle centred in
                it, and the connecting lines are spacers either side of that
                circle - invisible at the two ends rather than absent. Leaving
                them out made the first and last columns narrower than the
                rest, so their labels sat off-centre from their own circles.
              */
              <li key={key} className="flex flex-1 flex-col items-center">
                <div className="flex w-full items-center">
                  <span
                    aria-hidden="true"
                    className={`h-0.5 flex-1 ${
                      index === 0 ? 'invisible' : done ? 'bg-navy-700' : 'bg-slate-200'
                    }`}
                  />

                  <button
                    type="button"
                    disabled={!clickable}
                    onClick={() => clickable && onMove(key)}
                    aria-current={isCurrent ? 'step' : undefined}
                    /*
                      Say what the click will DO, not just where it goes -
                      two of these moves have a consequence you would rather
                      not discover afterwards.
                    */
                    title={
                      !clickable
                        ? statusInfo(key).label
                        : key === 'resolved'
                          ? 'Marks it resolved without a summary - "Mark resolved" above records one'
                          : statusInfo(post.status).public && !statusInfo(key).public
                            ? `Move back to ${statusInfo(key).label} - this takes it off the student board`
                            : `Move to ${statusInfo(key).label}`
                    }
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors ${
                      done ? 'bg-navy-700 text-white' : 'bg-slate-200 text-slate-500'
                    } ${isCurrent ? 'ring-4 ring-navy-200' : ''} ${
                      clickable ? 'cursor-pointer hover:bg-navy-500 hover:text-white' : 'cursor-default'
                    }`}
                  >
                    {index + 1}
                  </button>

                  <span
                    aria-hidden="true"
                    className={`h-0.5 flex-1 ${
                      index === STATUS_PATH.length - 1
                        ? 'invisible'
                        : !rejected && index < currentIndex
                          ? 'bg-navy-700'
                          : 'bg-slate-200'
                    }`}
                  />
                </div>

                <span
                  className={`mt-1.5 w-full px-1 text-center text-[11px] leading-tight ${
                    isCurrent ? 'font-bold text-navy-900' : 'text-slate-500'
                  }`}
                >
                  {statusInfo(key).label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Anything legal that is not a step on the line - rejecting from
          review, or putting a rejected post back. */}
      {canMove && allowed.some((key) => !STATUS_PATH.includes(key)) && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-200 pt-3">
          {allowed
            .filter((key) => !STATUS_PATH.includes(key))
            .map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => onMove(key)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-navy-700 transition-colors hover:border-navy-600 hover:bg-navy-50"
              >
                {statusInfo(key).label}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

function SubmissionReview({ post, onClose }) {
  const { user, can } = useAuth();
  const store = useStore(user);

  const author = findUser(store.db, post.authorId);

  /*
   * WHICH COLLEGE THIS PROBABLY BELONGS TO.
   *
   * Every programme belongs to exactly one college and the colleges are the
   * departments, so the student's own course already answers "who owns this"
   * most of the time. Offering that as the starting value saves an
   * administrator remembering which of eleven colleges runs BS in Midwifery,
   * on every single assignment.
   *
   * It is a DEFAULT, not a decision - the dropdown is untouched and a
   * facilities problem raised by a nursing student is still one click from
   * going elsewhere. Null when the course is unrecognised or absent, in
   * which case nothing is suggested rather than something wrong being
   * pre-selected.
   */
  const suggestedCollege = collegeForProgram(author?.course);

  // Draft values for the controls. They start from the submission so the
  // dialog opens showing where things currently stand.
  const [reason, setReason] = useState('');
  const [department, setDepartment] = useState(
    post.department || suggestedCollege || DEPARTMENTS[0].key
  );
  const [assignedTo, setAssignedTo] = useState(post.assignedTo || '');
  const [resolution, setResolution] = useState(post.resolution || '');
  const [noteText, setNoteText] = useState('');
  const [error, setError] = useState('');
  const kind = kindInfo(post.kind);
  const status = statusInfo(post.status);

  const mayModerate = can(PERMISSIONS.MODERATE_POSTS);
  const mayManageConcerns = can(PERMISSIONS.MANAGE_CONCERNS);
  const maySeeIdentity = can(PERMISSIONS.VIEW_IDENTITY);

  // Every action funnels through here so one failure path covers them all.
  function run(action) {
    try {
      const result = action();
      if (result?.error) {
        setError(result.error);
        return;
      }
      setError('');
      onClose();
    } catch (failure) {
      setError(failure.message);
    }
  }

  function handleReject() {
    if (!reason.trim()) {
      // A rejection with no reason is the thing students complain about most,
      // so the form insists on one.
      setError('Please give a reason. The student is shown this, so it should explain the decision.');
      return;
    }
    run(() => store.changeStatus(post.id, 'rejected', { reason: reason.trim() }));
  }

  function handleResolve() {
    if (!resolution.trim()) {
      setError('Please write a short summary of what was actually done.');
      return;
    }
    run(() => store.resolveConcern(post.id, resolution.trim()));
  }

  function handleAddNote() {
    if (!noteText.trim()) return;
    try {
      store.addAdminNote(post.id, noteText.trim());
      setNoteText('');
      setError('');
    } catch (failure) {
      setError(failure.message);
    }
  }

  return (
    <Modal
      size="lg"
      title={post.title}
      description={`${kind.label} · submitted ${formatDateTime(post.createdAt)}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>

          {/* The three decisions only make sense while something is waiting. */}
          {mayModerate && AWAITING_REVIEW.includes(post.status) && (
            <Button
              variant="primary"
              onClick={() => run(() => store.changeStatus(post.id, 'approved'))}
            >
              Approve
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {/* THE STATUS STRIP - where this submission stands, at a glance. */}
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={post.status} />
          <KindBadge kind={post.kind} />
          <CategoryBadge category={post.category} />
          {post.type === 'voice' && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
              Voice out
            </span>
          )}
          <span className="ml-auto font-mono text-xs text-slate-400">{post.id}</span>
        </div>

        {/* 1. WHAT WAS SUBMITTED. */}
        <Section title="Submission">
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">
            {post.message}
          </p>

          {post.attachments?.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {post.attachments.map((file, index) => (
                <li key={index}>
                  {file.type?.startsWith('image/') ? (
                    <img
                      src={file.dataUrl}
                      alt={file.name}
                      className="h-24 w-24 rounded-lg border border-slate-200 object-cover"
                    />
                  ) : (
                    <span className="flex h-24 w-24 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-2 text-center text-[10px] text-slate-500">
                      {file.name}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/*
          2. WHO SUBMITTED IT.
          Anonymous posting is a promise to the student that their name will not
          appear on the board - not that nobody is accountable for what they
          wrote. The identity is kept, and shown here to administrators only.
          Anybody without VIEW_IDENTITY sees the notice instead.
        */}
        {maySeeIdentity ? (
          <Section title="Submitted by" tone="admin">
            {post.anonymous && (
              <p className="mb-3 rounded-lg bg-amber-100 px-3 py-2 text-xs font-medium text-amber-900">
                Posted anonymously. This identity is visible to administrators only and is never
                shown on the student-facing board.
              </p>
            )}

            {author ? (
              <div className="flex items-start gap-3">
                <Avatar name={author.name} />
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/admin/users/${author.id}`}
                    className="font-semibold text-navy-700 hover:underline"
                  >
                    {author.name}
                  </Link>
                  <DetailList
                    items={[
                      { label: 'Student / User ID', value: author.studentId || 'Not a student account' },
                      { label: 'Email', value: author.email },
                      { label: 'Account ID', value: author.id },
                      { label: 'Submitted', value: formatDateTime(post.createdAt) },
                      { label: 'Course', value: author.course },
                      { label: 'Year & Section', value: [author.yearLevel, author.section].filter(Boolean).join(' - ') },
                    ]}
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                The account that submitted this has been deleted. The submission was kept so any
                work already under way is not lost.
              </p>
            )}
          </Section>
        ) : (
          <Section title="Submitted by">
            <p className="text-sm text-slate-500">
              You do not have permission to view submitter identities.
            </p>
          </Section>
        )}

        {/* 3. THE DECISION. */}
        {mayModerate && AWAITING_REVIEW.includes(post.status) && (
          <Section title="Review decision" tone="admin">
            <p className="mb-3 text-sm text-slate-600">
              Approving publishes this to the student board. The student is notified either way.
            </p>

            <div className="space-y-3">
              <Field label="Reason for rejection" htmlFor="reject-reason" hint="Shown to the student.">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <TextInput
                    id="reject-reason"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="e.g. This names an individual student."
                  />
                  <Button variant="ghost" onClick={handleReject} className="shrink-0 !text-red-600">
                    Reject
                  </Button>
                </div>
              </Field>

            </div>
          </Section>
        )}

        {/* 4. WHERE IT GOES NEXT. Only for the kinds that need somebody to act. */}
        {mayManageConcerns && kind.needsAssignment && post.status !== 'pending' && (
          <Section title="Assignment" tone="admin">
            {post.department && (
              <p className="mb-3 text-sm text-slate-600">
                Currently with <strong>{departmentLabel(post.department)}</strong>
                {post.assignedTo && ` · ${post.assignedTo}`}
                {post.assignedAt && ` · assigned ${formatDateTime(post.assignedAt)}`}
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Department"
                htmlFor="assign-department"
                /* Say WHY this one is pre-selected. A default nobody can
                   explain is a default nobody trusts, and they end up
                   re-picking every time to be sure. */
                hint={
                  !post.department && suggestedCollege === department && author?.course
                    ? `Suggested from ${author.course}`
                    : undefined
                }
              >
                <Select
                  id="assign-department"
                  value={department}
                  onChange={(event) => setDepartment(event.target.value)}
                  options={DEPARTMENTS.map((item) => ({ value: item.key, label: item.label }))}
                />
              </Field>

              <Field label="Responsible staff" htmlFor="assign-staff">
                <TextInput
                  id="assign-staff"
                  value={assignedTo}
                  onChange={(event) => setAssignedTo(event.target.value)}
                  placeholder="Name or role"
                />
              </Field>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() =>
                  run(() => store.assignConcern(post.id, { department, assignedTo }))
                }
              >
                {post.department ? 'Update assignment' : 'Assign concern'}
              </Button>
            </div>
          </Section>
        )}

        {/* 5. HOW IT ENDED. */}
        {mayManageConcerns && ['approved', 'in_progress', 'resolved'].includes(post.status) && (
          <Section title="Resolution" tone="admin">
            {post.resolvedAt && (
              <p className="mb-3 text-sm text-emerald-700">
                Resolved {formatDateTime(post.resolvedAt)}
              </p>
            )}

            <Field
              label="Resolution summary"
              htmlFor="resolution"
              hint="Sent to the student and shown on the concern's record."
            >
              <TextArea
                id="resolution"
                rows={3}
                value={resolution}
                onChange={(event) => setResolution(event.target.value)}
                placeholder="e.g. Computer units in Laboratory 2 were inspected and three defective units were repaired."
              />
            </Field>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="primary" size="sm" onClick={handleResolve}>
                {post.status === 'resolved' ? 'Update resolution' : 'Mark resolved'}
              </Button>
            </div>
          </Section>
        )}

        {/* MOVE IT SOMEWHERE ELSE. The options come from the status itself, so
            the workflow can be changed in data/workflow.js without touching
            this dialog. */}
        {mayModerate && (
          <Section title="Progress">
            <StatusSteps
              post={post}
              canMove={mayModerate}
              onMove={(nextStatus) => run(() => store.changeStatus(post.id, nextStatus))}
            />
          </Section>
        )}

        {/* 6. INTERNAL NOTES. */}
        {mayModerate && (
          <Section title="Internal notes" tone="admin">
            <p className="mb-3 text-xs text-slate-500">
              Staff only. These are never shown to the student.
            </p>

            {post.adminNotes?.length > 0 && (
              <ul className="mb-3 space-y-2">
                {post.adminNotes.map((note) => (
                  <li key={note.id} className="rounded-lg bg-white p-3 text-sm">
                    <p className="text-slate-700">{note.text}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {note.author} · {formatDateTime(note.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-col gap-2 sm:flex-row">
              <TextInput
                value={noteText}
                onChange={(event) => setNoteText(event.target.value)}
                placeholder="Add a note for other administrators..."
                aria-label="Add an internal note"
              />
              <Button variant="ghost" onClick={handleAddNote} className="shrink-0">
                Add note
              </Button>
            </div>
          </Section>
        )}

        {/* The student's own record of what happened, repeated here so the
            admin sees exactly what the student was told. */}
        {post.rejectionReason && (
          <Section title="What the student was told">
            <p className="text-sm text-slate-700">{post.rejectionReason}</p>
          </Section>
        )}

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

export default SubmissionReview;
