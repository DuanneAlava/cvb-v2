import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import SubmissionReview from './SubmissionReview.jsx';
import { STATUS_LIST, statusInfo } from '../../data/workflow.js';

/*
 * THE REVIEW DIALOG OFFERS ONLY THE MOVES THE WORKFLOW ALLOWS.
 *
 * Every status change an administrator makes goes through this dialog
 * (components/admin/SubmissionReview.jsx). Which buttons it draws for a
 * submission is meant to come from that status's `next` list in
 * data/workflow.js, so the dialog can never offer a move the workflow - or
 * the server, which keeps the same list - would refuse. These tests open the
 * dialog on a submission in each status and read which buttons appear.
 *
 * Nothing here reaches the server. The two things the dialog asks the rest
 * of the app - "who is signed in, and what may they do?" (useAuth) and "what
 * does the platform hold?" (useStore) - are answered by stand-ins, as an
 * administrator who may do everything, so every move the status allows is
 * drawn.
 *
 * WHAT YOU'LL MEET IN THIS FILE
 * - jest.mock(path, () => ({...}))  Swap a module for a stand-in for this
 *   file only. jest.requireActual keeps the real module's other exports.
 * - createRoot / act  How React draws a component into a page; act() waits
 *   until React has finished drawing before the test reads the page. The
 *   test page is jsdom - a browser imitated in Node, which react-scripts
 *   sets up.
 * - querySelectorAll('button')  Every button in the drawn dialog, read the
 *   way a person would read them: by their text.
 */

jest.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ can: () => true }),
}));

jest.mock('../../services/store.js', () => ({
  ...jest.requireActual('../../services/store.js'),
  useStore: () => ({ db: { users: [] } }),
}));

// Tells React this is a test page, so it expects every update inside act().
global.IS_REACT_ACT_ENVIRONMENT = true;

/*
 * Each button that moves a submission, and the status it moves it to.
 * "Assign to department" starts the work (in_progress); "Resolve without
 * assigning" opens the form whose button resolves it.
 */
const MOVES = {
  Approve: 'approved',
  Reject: 'rejected',
  'Mark as under review': 'under_review',
  'Send back to review': 'under_review',
  'Assign to department': 'in_progress',
  'Resolve without assigning': 'resolved',
  'Mark resolved': 'resolved',
  Reopen: 'in_progress',
};

// A submission in the given status. An assigned one has a department, so
// its assignment form starts folded away behind "Reassign".
function postIn(status, kind = 'concern') {
  return {
    id: 'P-1001',
    kind,
    status,
    category: 'facilities',
    title: 'Broken chairs in room 204',
    message: 'Three of the chairs at the back are broken.',
    createdAt: '2026-10-01T08:00:00.000Z',
    authorId: 1,
    anonymous: false,
    attachments: [],
    adminNotes: [],
    department: status === 'in_progress' ? 'college-computer-studies' : null,
  };
}

let container;
let root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

// Open the dialog on `post`, and answer with the moves it offers, in the
// order they appear. The `key` makes each one a freshly opened dialog. The
// router is set up as App.js sets up the real one.
function movesOffered(post) {
  // The lint rule takes any `render` for React Testing Library's, which
  // wraps itself in act(). This is React's own root.render, which does not.
  // eslint-disable-next-line testing-library/no-unnecessary-act
  act(() => {
    root.render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <SubmissionReview key={`${post.kind}-${post.status}`} post={post} onClose={() => {}} />
      </MemoryRouter>
    );
  });
  return [...container.querySelectorAll('button')]
    .map((button) => button.textContent.trim())
    .filter((label) => Object.hasOwn(MOVES, label));
}

test.each([
  ['concern', 'pending', ['Approve', 'Reject', 'Mark as under review']],
  ['concern', 'under_review', ['Approve', 'Reject']],
  ['concern', 'approved', ['Assign to department', 'Resolve without assigning', 'Send back to review']],
  // A suggestion is never handed to a department, so it skips straight to resolving.
  ['suggestion', 'approved', ['Mark resolved', 'Send back to review']],
  ['concern', 'in_progress', ['Mark resolved']],
  ['concern', 'resolved', ['Reopen']],
  ['concern', 'rejected', ['Send back to review']],
])('a %s in %s offers exactly its moves', (kind, status, expected) => {
  expect(movesOffered(postIn(status, kind))).toEqual(expected);
});

test('every move offered, from every status, is one its `next` list allows', () => {
  for (const { key: status, next } of STATUS_LIST) {
    for (const kind of ['concern', 'suggestion']) {
      for (const label of movesOffered(postIn(status, kind))) {
        expect({ status, kind, label, allowed: next.includes(MOVES[label]) }).toEqual({
          status,
          kind,
          label,
          allowed: true,
        });
      }
    }
  }
});

test('taking a move out of `next` takes its button away', () => {
  const pending = statusInfo('pending');
  const approved = statusInfo('approved');
  const original = { pending: pending.next, approved: approved.next };

  // Changed for this test only; the finally block puts both back.
  pending.next = original.pending.filter((status) => status !== 'rejected');
  approved.next = original.approved.filter((status) => status !== 'under_review');
  try {
    expect(movesOffered(postIn('pending'))).toEqual(['Approve', 'Mark as under review']);
    expect(movesOffered(postIn('approved'))).toEqual([
      'Assign to department',
      'Resolve without assigning',
    ]);
  } finally {
    pending.next = original.pending;
    approved.next = original.approved;
  }
});
