/*
 * THE WORKFLOW THE API ENFORCES - one copy of each list, for every part of
 * the backend that needs it. The server-side twin of the frontend's
 * frontend/src/data/workflow.js: the keys, the allowed moves and the
 * department list must match it exactly. (models/schema.sql still lists the
 * statuses and kinds in its CHECK rules: that is the database refusing
 * anything else, whatever the code does.)
 *
 * The frontend draws its buttons from its own copy; this copy is what stops a
 * request that skips the buttons. A move the review dialog would never offer
 * is refused here too.
 */

/*
 * THE SIX STATUSES.
 *
 *   pending -> under_review -> approved -> in_progress -> resolved
 *                           \-> rejected
 *
 * `public` means the student board shows it. `next` lists the statuses an
 * administrator may move a post to from this one - the same lists as the
 * frontend's, which is what its review dialog offers.
 */
const STATUSES = {
  pending: { label: 'Pending', public: false, next: ['under_review', 'approved', 'rejected'] },
  under_review: { label: 'Under Review', public: false, next: ['approved', 'rejected'] },
  in_progress: { label: 'In Progress', public: true, next: ['resolved'] },
  approved: { label: 'Approved', public: true, next: ['in_progress', 'resolved', 'under_review'] },
  resolved: { label: 'Resolved', public: true, next: ['in_progress'] },
  rejected: { label: 'Rejected', public: false, next: ['under_review'] },
};

// The statuses whose posts appear on the public board, and can be voted on.
const PUBLIC_STATUSES = Object.keys(STATUSES).filter((key) => STATUSES[key].public);

/*
 * THE FIVE KINDS OF SUBMISSION. `needsAssignment` is whether an approved one
 * is handed to a department - a suggestion is an idea and is not; a request
 * is a suggestion somebody has to act on, so it is.
 */
const KINDS = {
  suggestion: { needsAssignment: false },
  request: { needsAssignment: true },
  concern: { needsAssignment: true },
  complaint: { needsAssignment: true },
  report: { needsAssignment: true },
};

// Who a submission can be assigned to: the eleven academic colleges.
const DEPARTMENTS = {
  'college-education': 'College of Education',
  'college-business-administration': 'College of Business Administration',
  'college-criminal-justice': 'College of Criminal Justice Education',
  'college-computer-studies': 'College of Computer Studies',
  'college-psychology': 'College of Psychology',
  'college-medical-laboratory-science': 'College of Medical Laboratory Science',
  'college-nursing-midwifery': 'College of Nursing & Midwifery',
  'college-hospitality-management': 'College of Hospitality Management',
  'college-maritime-studies': 'College of Maritime Studies',
  'college-law': 'College of Law',
  'senior-high-school': 'Senior High School',
};

module.exports = { STATUSES, PUBLIC_STATUSES, KINDS, DEPARTMENTS };
