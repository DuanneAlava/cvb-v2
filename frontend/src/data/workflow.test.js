import {
  STATUS_LIST,
  PUBLIC_STATUSES,
  AWAITING_REVIEW,
  OPEN_STATUSES,
  CLOSED_STATUSES,
  KIND_LIST,
  ASSIGNABLE_KINDS,
  statusInfo,
  kindInfo,
  kindsInGroup,
  isOpenWork,
} from './workflow.js';

/*
 * THE WORKFLOW VOCABULARY, TESTED FOR SENSE.
 *
 * data/workflow.js is the one place the statuses, the moves between them and
 * the kinds of submission are written down; every badge, dropdown, queue and
 * review button reads from it. These tests check the file agrees with
 * itself: a `next` list may only name statuses that exist, every status can
 * be reached, and the lists worked out from the others come out as intended.
 *
 * Whether it agrees with the SERVER's copy is a different question, answered
 * by scripts/check-shared-lists.mjs.
 *
 * WHAT YOU'LL MEET IN THIS FILE
 * - describe / test / expect  Jest - see services/moderation.test.js.
 * - toEqual([...])  The derived lists are compared with the answer written
 *   out by hand, so a change to a status's `public` or a kind's
 *   `needsAssignment` has to be made here too, on purpose.
 */

const statusKeys = STATUS_LIST.map((status) => status.key);

describe('statuses and the moves between them', () => {
  test('every status in a `next` list exists', () => {
    for (const status of STATUS_LIST) {
      for (const next of status.next) {
        expect({ from: status.key, to: next, exists: statusKeys.includes(next) }).toEqual({
          from: status.key,
          to: next,
          exists: true,
        });
      }
    }
  });

  test('no status moves to itself, or lists a move twice', () => {
    for (const status of STATUS_LIST) {
      expect(status.next).not.toContain(status.key);
      expect(new Set(status.next).size).toBe(status.next.length);
    }
  });

  test('every status can be reached from pending', () => {
    // Walk every move from where a new post starts, and collect where it gets.
    const reached = new Set(['pending']);
    const toVisit = ['pending'];
    while (toVisit.length > 0) {
      for (const next of statusInfo(toVisit.pop()).next) {
        if (!reached.has(next)) {
          reached.add(next);
          toVisit.push(next);
        }
      }
    }
    expect([...reached].sort()).toEqual([...statusKeys].sort());
  });

  test('each status is filed under its own key', () => {
    for (const key of statusKeys) expect(statusInfo(key).key).toBe(key);
  });

  test('an unknown status is shown as pending rather than breaking the screen', () => {
    expect(statusInfo('no_such_status').key).toBe('pending');
  });
});

describe('the lists worked out from the statuses', () => {
  test('PUBLIC_STATUSES is every status marked public, in list order', () => {
    expect(PUBLIC_STATUSES).toEqual(['in_progress', 'approved', 'resolved']);
    expect(PUBLIC_STATUSES).toEqual(STATUS_LIST.filter((s) => s.public).map((s) => s.key));
  });

  test('the queues name real statuses, and nothing awaiting review is public', () => {
    for (const key of [...AWAITING_REVIEW, ...OPEN_STATUSES, ...CLOSED_STATUSES]) {
      expect(statusKeys).toContain(key);
    }
    for (const key of AWAITING_REVIEW) expect(PUBLIC_STATUSES).not.toContain(key);
  });
});

describe('kinds of submission', () => {
  test('ASSIGNABLE_KINDS is every kind that needs a department', () => {
    expect(ASSIGNABLE_KINDS).toEqual(['request', 'concern', 'complaint', 'report']);
    expect(ASSIGNABLE_KINDS).toEqual(KIND_LIST.filter((k) => k.needsAssignment).map((k) => k.key));
  });

  test('every kind belongs to exactly one family', () => {
    const suggestions = kindsInGroup('suggestion');
    const concerns = kindsInGroup('concern');
    expect(suggestions).toEqual(['suggestion', 'request']);
    expect(concerns).toEqual(['concern', 'complaint', 'report']);
    expect([...suggestions, ...concerns].sort()).toEqual(KIND_LIST.map((k) => k.key).sort());
  });

  test('an unknown kind is shown as a suggestion', () => {
    expect(kindInfo('no_such_kind').key).toBe('suggestion');
  });

  test('open work is an approved or in-progress post of a kind a department acts on', () => {
    expect(isOpenWork({ kind: 'concern', status: 'approved' })).toBe(true);
    expect(isOpenWork({ kind: 'request', status: 'in_progress' })).toBe(true);
    // A suggestion is never handed to a department.
    expect(isOpenWork({ kind: 'suggestion', status: 'approved' })).toBe(false);
    // Not open yet, and no longer open.
    expect(isOpenWork({ kind: 'concern', status: 'pending' })).toBe(false);
    expect(isOpenWork({ kind: 'concern', status: 'resolved' })).toBe(false);
  });
});
