import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { PERMISSIONS } from '../../data/roles.js';
import {
  AWAITING_REVIEW,
  DEPARTMENTS,
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
 * ONE NEXT STEP AT A TIME, AND YOU WATCH IT HAPPEN.
 *
 * The layout is:
 *
 *   1. where it stands    - the progress line, pinned to the top while you
 *                           scroll, so the map is in view when you act
 *   2. what was submitted - title, message, photos
 *   3. who submitted it   - the identity block, admins only
 *   4. the next step      - ONE section, chosen by the current status:
 *
 *        pending / under review   ->  approve, or reject with a reason
 *        approved, needs a dept   ->  assign it
 *        approved, a suggestion   ->  resolve it
 *        in progress              ->  resolve it (reassigning is folded away)
 *        resolved                 ->  finished; edit the summary, or reopen
 *        rejected                 ->  finished; send it back to review
 *
 *   5. internal notes     - staff-only, never shown to the student
 *
 * THE DIALOG STAYS OPEN AFTER AN ACTION. It used to close on every click,
 * which meant an approved concern vanished from the queue you were looking
 * at and had to be found again under Open Concerns before it could be
 * assigned - three visits, across two queues, for one submission, and you
 * never once saw the progress line move. Now the line advances in front of
 * you, a line under it says what just happened and what comes next, and the
 * next step's form is already below. Take it all the way to Assigned in one
 * visit, or close and come back - both work.
 *
 * THE PROGRESS LINE SHOWS THE STEPS YOU TAKE, NOT EVERY STATUS THAT EXISTS.
 * It drew all five statuses in a row, which had three problems: "Under
 * Review" looked like a required step 2 of 5 when it is an optional hold;
 * the button said "Assign" but the step it landed on said "In Progress";
 * and every circle left of the current one was ticked whether or not it had
 * happened, so a post approved straight from Pending showed Under Review as
 * done. The line is now built per kind from the actions that move it - see
 * pathFor() - and a step can only be ticked if it was actually passed.
 *
 * Every forward move that records something - a reason, a department, a
 * summary - exists in exactly one place, with its form beside it. The
 * backward moves (send back to review, reopen) carry no data and sit as
 * small buttons under the step they undo, each with its consequence written
 * next to it. Which moves are offered still comes from `next` in
 * data/workflow.js, so the dialog cannot offer a move the workflow forbids.
 *
 * Everything here writes through services/store.js, which records the audit
 * entry and sends the student their notification as part of the same write.
 *
 * WHAT YOU'LL MEET IN THIS FILE (plain-English notes)
 *
 * - Small local components  Section, SideAction, CheckIcon and StatusSteps
 *   are components used only by this file, so they live here rather than in
 *   ui.jsx. A component is just a function that returns JSX.
 * - JSX  The HTML-looking syntax inside JavaScript. `<Section title="x">`
 *   is really a function call; `{expression}` inside it drops a JavaScript
 *   value into the markup.
 * - `{ label, hint, ...props }`  Destructure the two props this component
 *   uses and gather the rest (onClick, aria-expanded...) into `props`, then
 *   `{...props}` passes them all on to the Button. This is how a wrapper
 *   stays transparent to whatever the caller wants to set.
 * - `switch (post.status) { case 'pending': return ...; }`  Pick one branch
 *   by value; a tidier if/else-if chain for a fixed set of options.
 * - `.findIndex(...)`  The position of the first item that passes the test,
 *   or -1 if none does. That position is the current step on the line.
 * - Functions that return JSX vs components  `assignForm()` and
 *   `resolveForm()` are plain functions called like `{assignForm('Assign')}`.
 *   If they were components (<AssignForm />) React would rebuild their
 *   inputs on every keystroke and the cursor would jump out of the box.
 * - `let nextStep = null; if (...) nextStep = <Section>...</Section>`
 *   Building an element in a variable, then dropping it into the markup
 *   with `{nextStep}`. Rendering null draws nothing.
 * - `sm:sticky sm:top-0`  Stay pinned to the top of the scrolling area
 *   while the content beneath scrolls, from the small breakpoint up.
 * - `aria-current="step"` / `role="status"` / `role="alert"`  Accessibility:
 *   which step is current; a message that changed; an error to announce.
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
 * A secondary action: a small button with its consequence written beside it.
 *
 * Used for every move that is NOT the next step - reassigning, sending back,
 * reopening. Keeping them all in this one shape is what makes the primary
 * button in each section stand out as the thing to press.
 */
function SideAction({ label, hint, ...props }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Button variant="ghost" size="sm" {...props}>
        {label}
      </Button>
      {hint && <span className="text-xs text-slate-500">{hint}</span>}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-4 w-4"
    >
      <path d="m5 12 5 5L20 7" />
    </svg>
  );
}

/*
 * THE STEPS A SUBMISSION TAKES, named after the button that moves it there.
 *
 * Each step lists the stored statuses it stands for. "Submitted" covers both
 * pending and under_review - under review is a hold, not a stage, and is
 * shown as a note on the first step rather than a step of its own. A
 * suggestion is never assigned, so its line has no "Assigned" step; a
 * reopened suggestion sits at in_progress with nobody to assign, so that
 * status counts as "Approved" on its line.
 *
 * Because the steps are built from what a kind can actually go through, a
 * later step is unreachable without the earlier ones - which is what makes
 * a tick on the line mean "this happened".
 */
function pathFor(kind) {
  return kind.needsAssignment
    ? [
        { label: 'Submitted', statuses: ['pending', 'under_review'] },
        { label: 'Approved', statuses: ['approved'] },
        { label: 'Assigned', statuses: ['in_progress'] },
        { label: 'Resolved', statuses: ['resolved'] },
      ]
    : [
        { label: 'Submitted', statuses: ['pending', 'under_review'] },
        { label: 'Approved', statuses: ['approved', 'in_progress'] },
        { label: 'Resolved', statuses: ['resolved'] },
      ];
}

/*
 * THE PROGRESS LINE.
 *
 * Steps already passed are ticked, the current one is ringed, the rest are
 * greyed out. It shows where the submission is; it does not move it. The
 * moving is done by the "Next step" section further down, which is the only
 * place each move exists.
 *
 * Rejected is not a step. A rejected post has left the road rather than
 * travelled part of it, so it is announced above the line with nothing
 * ticked.
 */
function StatusSteps({ post, path }) {
  const rejected = post.status === 'rejected';
  const currentIndex = rejected
    ? -1
    : path.findIndex((step) => step.statuses.includes(post.status));

  return (
    <div>
      {rejected && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          This was rejected, so it left the path below. Sending it back to review puts it back at
          step one, waiting for a decision.
        </p>
      )}

      {/* Scrolls sideways on a narrow phone rather than squashing the labels. */}
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <ol className="flex min-w-[22rem] items-start">
          {path.map((step, index) => {
            const done = index <= currentIndex;
            const isCurrent = index === currentIndex;

            return (
              /*
                Every step is an equal-width column with the circle centred in
                it, and the connecting lines are spacers either side of that
                circle - invisible at the two ends rather than absent, so the
                first and last labels sit centred under their circles.
              */
              <li key={step.label} className="flex flex-1 flex-col items-center">
                <div className="flex w-full items-center">
                  <span
                    aria-hidden="true"
                    className={`h-0.5 flex-1 ${
                      index === 0 ? 'invisible' : done ? 'bg-navy-700' : 'bg-slate-200'
                    }`}
                  />

                  <span
                    aria-current={isCurrent ? 'step' : undefined}
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${
                      done ? 'bg-navy-700 text-white' : 'bg-slate-200 text-slate-500'
                    } ${isCurrent ? 'ring-4 ring-navy-200' : ''}`}
                  >
                    {/* A tick for what is behind it, a number for where it is. */}
                    {done && !isCurrent ? <CheckIcon /> : index + 1}
                  </span>

                  <span
                    aria-hidden="true"
                    className={`h-0.5 flex-1 ${
                      index === path.length - 1
                        ? 'invisible'
                        : index < currentIndex
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
                  {step.label}
                  {/* The hold, noted on the step it belongs to. */}
                  {index === 0 && post.status === 'under_review' && (
                    <span className="block font-normal text-sky-700">under review</span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

/*
 * One plain sentence under the progress line: what this stage means for the
 * student, and what - if anything - is waiting on an admin. The "Next step"
 * section below is where that thing gets done.
 */
function stageCaption(post, kind) {
  switch (post.status) {
    case 'pending':
      return 'Waiting for a decision. Students cannot see it yet.';
    case 'under_review':
      return 'Being looked at by an admin. Students cannot see it yet.';
    case 'approved':
      return kind.needsAssignment
        ? 'On the student board. Nobody is working on it yet - it needs a department.'
        : 'On the student board. Mark it resolved once it has been acted on.';
    case 'in_progress':
      if (!kind.needsAssignment) return 'On the student board, reopened. Mark it resolved once it has been acted on.';
      return post.department
        ? `On the student board. ${departmentLabel(post.department)} is working on it.`
        : 'On the student board and marked as assigned - but no department is recorded.';
    case 'resolved':
      return 'Finished. The student was told what was done.';
    case 'rejected':
      return 'Not published. The student was told why.';
    default:
      return '';
  }
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
   * administrator remembering which of eleven colleges runs BS in Midwifery.
   *
   * It is a DEFAULT, not a decision - the dropdown is untouched and a
   * facilities problem raised by a nursing student is still one click from
   * going elsewhere. Null when the course is unrecognised or absent, in
   * which case nothing is suggested rather than something wrong being
   * pre-selected.
   */
  const suggestedCollege = collegeForProgram(author?.course);

  // Draft values for the forms. They start from the submission so the dialog
  // opens showing where things currently stand.
  const [reason, setReason] = useState('');
  const [department, setDepartment] = useState(
    post.department || suggestedCollege || DEPARTMENTS[0].key
  );
  const [assignedTo, setAssignedTo] = useState(post.assignedTo || '');
  const [resolution, setResolution] = useState(post.resolution || '');
  const [noteText, setNoteText] = useState('');
  const [error, setError] = useState('');
  const [noteError, setNoteError] = useState('');

  // What the last button did, in one sentence, shown under the progress line
  // in place of the stage caption until the next action.
  const [justDid, setJustDid] = useState('');

  /*
   * THE SIDE PATHS, folded away until asked for.
   *
   * On an assigned concern the next step is to resolve it, and the
   * assignment form is only wanted when the owner is wrong - so it is hidden
   * behind "Reassign". On an approved concern the next step is to assign
   * it, and resolving straight away is the exception: something already
   * dealt with, or something no department on the list can own - so that
   * form is hidden behind "Resolve without assigning".
   *
   * Hiding them is what leaves one primary button per stage.
   */
  const [reassigning, setReassigning] = useState(false);
  const [resolvingUnassigned, setResolvingUnassigned] = useState(false);

  const kind = kindInfo(post.kind);
  const status = statusInfo(post.status);
  const path = pathFor(kind);

  const mayModerate = can(PERMISSIONS.MODERATE_POSTS);
  const mayManageConcerns = can(PERMISSIONS.MANAGE_CONCERNS);
  const maySeeIdentity = can(PERMISSIONS.VIEW_IDENTITY);

  // Is this a legal move from where the post is now? Every status button
  // asks before it is drawn, so a change to `next` in data/workflow.js
  // removes the button rather than leaving one that performs a forbidden move.
  const allows = (next) => status.next.includes(next);

  /*
   * Every action funnels through here so one failure path covers them all.
   *
   * On success the dialog STAYS OPEN: `post` is re-read by the page from the
   * store, so the progress line and the next-step section redraw themselves
   * for the new status, and `done` says what just happened. The side forms
   * are folded away because whatever they were for is no longer the next
   * step.
   */
  function run(action, done) {
    try {
      const result = action();
      if (result?.error) {
        setError(result.error);
        return;
      }
      setError('');
      setJustDid(done);
      setReassigning(false);
      setResolvingUnassigned(false);
    } catch (failure) {
      setError(failure.message);
    }
  }

  // The moves that carry no data: approve, and every backward step.
  function moveTo(next, done) {
    run(() => store.changeStatus(post.id, next), done);
  }

  function handleApprove() {
    const done = kind.needsAssignment
      ? 'Approved. It is on the student board and in the Open Work queue. Next: assign it to a department, below.'
      : 'Approved. It is on the student board. Nothing more is needed unless it gets acted on - then mark it resolved.';
    moveTo('approved', done);
  }

  function handleReject() {
    if (!reason.trim()) {
      // A rejection with no reason is the thing students complain about most,
      // so the form insists on one.
      setError('Please give a reason. The student is shown this, so it should explain the decision.');
      return;
    }
    run(
      () => store.changeStatus(post.id, 'rejected', { reason: reason.trim() }),
      'Rejected. The student has been told why.'
    );
    setReason('');
  }

  function handleAssign() {
    run(
      () => store.assignConcern(post.id, { department, assignedTo }),
      `Assigned to ${departmentLabel(department)}. The student has been told. When the work is done, mark it resolved below.`
    );
  }

  function handleResolve() {
    if (!resolution.trim()) {
      setError('Please write a short summary of what was actually done.');
      return;
    }
    run(
      () => store.resolveConcern(post.id, resolution.trim()),
      post.status === 'resolved'
        ? 'Summary updated. The student has been sent the new wording.'
        : 'Resolved. The student has been sent the summary.'
    );
  }

  function handleAddNote() {
    if (!noteText.trim()) return;
    try {
      store.addAdminNote(post.id, noteText.trim());
      setNoteText('');
      setNoteError('');
    } catch (failure) {
      setNoteError(failure.message);
    }
  }

  /* ---------------------------------------------------------------- *
   * The two forms that record something. Plain functions rather than
   * components, so React does not rebuild the inputs on every keystroke
   * and drop the cursor out of them.
   * ---------------------------------------------------------------- */

  const assignForm = (buttonLabel, size = 'md') => (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Department"
          htmlFor="assign-department"
          /* Say WHY this one is pre-selected. A default nobody can explain
             is a default nobody trusts, and they end up re-picking every
             time to be sure. */
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

        <Field label="Responsible staff" htmlFor="assign-staff" hint="Optional - a name or a role.">
          <TextInput
            id="assign-staff"
            value={assignedTo}
            onChange={(event) => setAssignedTo(event.target.value)}
            placeholder="e.g. Dean's office"
          />
        </Field>
      </div>

      <div className="mt-3">
        <Button variant="primary" size={size} onClick={handleAssign}>
          {buttonLabel}
        </Button>
      </div>
    </>
  );

  const resolveForm = (buttonLabel, size = 'md') => (
    <>
      <Field
        label="Resolution summary"
        htmlFor="resolution"
        hint="Sent to the student and kept on the record."
      >
        <TextArea
          id="resolution"
          rows={3}
          value={resolution}
          onChange={(event) => setResolution(event.target.value)}
          placeholder="e.g. Computer units in Laboratory 2 were inspected and three defective units were repaired."
        />
      </Field>

      <div className="mt-3">
        <Button variant="primary" size={size} onClick={handleResolve}>
          {buttonLabel}
        </Button>
      </div>
    </>
  );

  // The divider that separates a stage's side paths from its next step.
  const sidePaths = 'mt-4 space-y-2 border-t border-amber-200/70 pt-3';

  /* ---------------------------------------------------------------- *
   * THE NEXT STEP - one section, picked by the current status.
   * ---------------------------------------------------------------- */

  let nextStep = null;

  if (AWAITING_REVIEW.includes(post.status) && mayModerate) {
    // Say where it goes after approval, so the admin knows where to find it
    // for the next step.
    const afterApproval = kind.needsAssignment
      ? 'Approving puts it on the student board and into the Open Work queue, where it can be assigned to a department.'
      : 'Approving puts it on the student board.';

    nextStep = (
      <Section title="Next step: decide" tone="admin">
        <p className="mb-3 text-sm text-slate-600">
          {afterApproval} Rejecting keeps it off the board. The student is told either way.
        </p>

        {allows('approved') && (
          <Button variant="primary" onClick={handleApprove}>
            Approve
          </Button>
        )}

        {allows('rejected') && (
          <div className={sidePaths}>
            <Field
              label="Or reject it"
              htmlFor="reject-reason"
              hint="A reason is required. The student is shown it, so it should explain the decision."
            >
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
        )}

        {allows('under_review') && (
          <div className={sidePaths}>
            <SideAction
              label="Mark as under review"
              hint="Not deciding yet? This tells other admins it is being looked at. It stays off the board."
              onClick={() =>
                moveTo('under_review', 'Marked as under review. It stays off the board until approved.')
              }
            />
          </div>
        )}
      </Section>
    );
  } else if (post.status === 'approved' && mayManageConcerns) {
    nextStep = kind.needsAssignment ? (
      <Section title="Next step: assign it" tone="admin">
        <p className="mb-3 text-sm text-slate-600">
          Hand it to the department that can act on it. Assigning is what starts the work, and
          the student is told.
        </p>

        {assignForm('Assign to department')}

        <div className={sidePaths}>
          <SideAction
            label="Resolve without assigning"
            hint="Already dealt with, or no department here fits it."
            aria-expanded={resolvingUnassigned}
            onClick={() => setResolvingUnassigned((value) => !value)}
          />
          {resolvingUnassigned && (
            <div className="rounded-lg border border-amber-200 bg-white/60 p-3">
              {resolveForm('Mark resolved', 'sm')}
            </div>
          )}

          {mayModerate && allows('under_review') && (
            <SideAction
              label="Send back to review"
              hint="Approved by mistake? This takes it off the student board."
              onClick={() =>
                moveTo('under_review', 'Sent back to review. It is off the student board again.')
              }
            />
          )}
        </div>
      </Section>
    ) : (
      <Section title="Next step: resolve it" tone="admin">
        <p className="mb-3 text-sm text-slate-600">
          A {kind.label.toLowerCase()} is not handed to a department. Once it has been acted on,
          write down what was done and mark it resolved - the student is sent the summary.
        </p>

        {resolveForm('Mark resolved')}

        {mayModerate && allows('under_review') && (
          <div className={sidePaths}>
            <SideAction
              label="Send back to review"
              hint="Approved by mistake? This takes it off the student board."
              onClick={() =>
                moveTo('under_review', 'Sent back to review. It is off the student board again.')
              }
            />
          </div>
        )}
      </Section>
    );
  } else if (post.status === 'in_progress' && mayManageConcerns) {
    // Assignment is only asked about for the kinds that get one - a
    // reopened suggestion lands here too, and has no department to show.
    const showsOwner = kind.needsAssignment;
    const assignFormOpen = showsOwner && (reassigning || !post.department);

    nextStep = (
      <Section title="Next step: resolve it" tone="admin">
        {showsOwner &&
          (post.department ? (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-slate-600">
                With <strong>{departmentLabel(post.department)}</strong>
                {post.assignedTo && ` · ${post.assignedTo}`}
                {post.assignedAt && ` · since ${formatDateTime(post.assignedAt)}`}
              </p>
              <Button
                variant="ghost"
                size="sm"
                aria-expanded={reassigning}
                onClick={() => setReassigning((value) => !value)}
              >
                Reassign
              </Button>
            </div>
          ) : (
            /* Older records could reach "assigned" with no department. Nothing
               new can, but the gap is still worth a line. */
            <p className="mb-3 rounded-lg bg-amber-100 px-3 py-2 text-xs font-medium text-amber-900">
              Marked as assigned, but no department is recorded. Give it one so the work has an
              owner.
            </p>
          ))}

        {assignFormOpen && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-white/60 p-3">
            {assignForm(post.department ? 'Update assignment' : 'Assign to department', 'sm')}
          </div>
        )}

        <p className="mb-3 text-sm text-slate-600">
          When the work is done, write down what was done and mark it resolved - the student is
          sent the summary.
        </p>

        {resolveForm('Mark resolved')}
      </Section>
    );
  } else if (post.status === 'resolved' && mayManageConcerns) {
    nextStep = (
      <Section title="Resolved" tone="admin">
        <p className="mb-3 text-sm text-emerald-700">
          {post.resolvedAt ? `Resolved ${formatDateTime(post.resolvedAt)}` : 'Marked resolved'}
          {post.department && ` · ${departmentLabel(post.department)}`}. Nothing more is needed.
        </p>

        <Field
          label="Resolution summary"
          htmlFor="resolution"
          hint="What the student was sent. Edit it here if it needs correcting."
        >
          <TextArea
            id="resolution"
            rows={3}
            value={resolution}
            onChange={(event) => setResolution(event.target.value)}
          />
        </Field>
        <div className="mt-3">
          <Button variant="ghost" size="sm" onClick={handleResolve}>
            Update summary
          </Button>
        </div>

        {mayModerate && allows('in_progress') && (
          <div className={sidePaths}>
            <SideAction
              label="Reopen"
              hint={
                kind.needsAssignment
                  ? 'Came back? This puts it back with its department.'
                  : 'Came back? This puts it back on the board as open.'
              }
              onClick={() => moveTo('in_progress', 'Reopened. It is open again.')}
            />
          </div>
        )}
      </Section>
    );
  } else if (post.status === 'rejected') {
    nextStep = (
      <Section title="Rejected" tone="admin">
        <p className="text-sm text-slate-700">
          <span className="font-semibold text-navy-900">What the student was told: </span>
          {post.rejectionReason || 'No reason was recorded.'}
        </p>

        {mayModerate && allows('under_review') && (
          <div className={sidePaths}>
            <SideAction
              label="Send back to review"
              hint="Reconsidering? It goes back to waiting for a decision, where it can be approved or rejected again."
              onClick={() =>
                moveTo('under_review', 'Sent back to review. It is waiting for a decision again.')
              }
            />
          </div>
        )}
      </Section>
    );
  }

  // Nothing left to do here, so Close becomes the obvious button.
  const finished = ['resolved', 'rejected'].includes(post.status);

  return (
    <Modal
      size="lg"
      title={post.title}
      description={`${kind.label} · submitted ${formatDateTime(post.createdAt)}`}
      onClose={onClose}
      footer={
        <Button variant={finished ? 'primary' : 'ghost'} onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-4">
        {/* THE STATUS STRIP - what this submission is, at a glance. */}
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={post.status} />
          <KindBadge kind={post.kind} />
          <CategoryBadge category={post.category} />
          <span className="ml-auto font-mono text-xs text-slate-400">{post.id}</span>
        </div>

        {/*
          1. WHERE IT STANDS.

          Pinned to the top of the scrolling area from the small breakpoint
          up, so it is still in view when the button at the bottom is
          pressed and the line moves. On a phone the dialog is too short to
          give up that much of it, so there it scrolls with the rest.
        */}
        <div className="sm:sticky sm:top-0 sm:z-10 sm:-mx-1 sm:bg-white sm:px-1 sm:pb-1">
          <Section title="Progress">
            <StatusSteps post={post} path={path} />
            {justDid ? (
              <p role="status" className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {justDid}
              </p>
            ) : (
              <p className="mt-3 text-sm text-slate-600">{stageCaption(post, kind)}</p>
            )}
          </Section>
        </div>

        {/* 2. WHAT WAS SUBMITTED. */}
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
          3. WHO SUBMITTED IT.
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
                  {/* The submission date is in the dialog's subtitle, so it
                      is not repeated here. */}
                  <DetailList
                    items={[
                      { label: 'Student / User ID', value: author.studentId || 'Not a student account' },
                      { label: 'Email', value: author.email },
                      { label: 'Account ID', value: author.id },
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

        {/* 4. THE NEXT STEP. */}
        {nextStep}

        {/* Any failure from the section above lands directly under it, where
            the button that caused it is still in view. */}
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {/* A rejection that was later reconsidered leaves its reason on the
            record. Worth a line, so nobody wonders why it is there. */}
        {post.status !== 'rejected' && post.rejectionReason && (
          <p className="text-xs text-slate-500">
            Previously rejected - the student was told: “{post.rejectionReason}”. It was sent back
            and reviewed again.
          </p>
        )}

        {/* 5. INTERNAL NOTES. */}
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

            {noteError && (
              <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {noteError}
              </p>
            )}
          </Section>
        )}
      </div>
    </Modal>
  );
}

export default SubmissionReview;
