/*
 * THE PROGRAMS OFFERED, AND WHICH COLLEGE OWNS EACH ONE.
 *
 * This is what the "Course / Program" field on a student's account holds. It
 * used to be a free-text box, which meant "BS in Computer Science", "BSCS"
 * and "bs comp sci" were three different courses as far as the platform was
 * concerned - so no report could group students by what they study, and
 * searching for a programme found only the students who spelled it your way.
 *
 * WHY THE LIST IS KEYED BY COLLEGE
 *
 * A programme is not a department. Departments (data/workflow.js) are the
 * offices a concern is handed to and are measured on how long they take to
 * resolve one; a programme is a curriculum and cannot resolve anything. The
 * two lists stay separate for that reason.
 *
 * But every programme BELONGS to exactly one college, and the colleges are
 * now the departments - so that relationship is real and worth recording.
 * Writing it here, once, is what lets the review dialog open with the right
 * college already selected instead of asking an administrator to remember
 * which of eleven owns BS in Midwifery.
 *
 * The keys below MUST match a `key` in DEPARTMENTS. `collegeForProgram`
 * returns null rather than guessing when it cannot find one, so a programme
 * added here without a matching college degrades to "no suggestion" instead
 * of silently assigning work to the wrong office.
 */
export const PROGRAMS_BY_COLLEGE = {
  'college-education': [
    'BS in Secondary Education major in Filipino',
    'BS in Secondary Education major in Science',
    'BS in Secondary Education major in English',
    'BS in Secondary Education major in Mathematics',
    'BS in Elementary Education major in Methods of Teaching',
  ],

  'college-business-administration': [
    'BS in Business Administration major in Financial Management',
    'BS in Business Administration major in Marketing Management',
    'BS in Business Administration major in Human Resources Management',
    'BS in Business Administration major in Operational Management',
    'BS in Business Administration major in Business Economics',
  ],

  'college-criminal-justice': ['BS in Criminology'],

  'college-computer-studies': ['BS in Computer Science', 'BS in Information Technology'],

  'college-psychology': ['BS in Psychology'],

  'college-medical-laboratory-science': ['BS in Medical Technology'],

  'college-nursing-midwifery': ['BS in Nursing', 'BS in Midwifery'],

  'college-hospitality-management': ['BS in Hospitality Management'],

  'college-maritime-studies': ['BS in Marine Transportation', 'BS in Marine Engineering'],

  'college-law': ['Juris Doctor'],

  // Strands rather than degrees, but they answer the same question - what is
  // this student enrolled in - so they belong on the same list.
  'senior-high-school': [
    'GAS',
    'STEM',
    'HUMSS',
    'ABM',
    'TVL - ICT CSS',
    'TVL - ICT Programming',
    'HE - Bread and Pastry',
    'HE - Cookery',
  ],
};

// The flat list, in college order. Derived so the two can never disagree.
export const PROGRAMS = Object.values(PROGRAMS_BY_COLLEGE).flat();

/*
 * Which college runs this programme, as a DEPARTMENTS key.
 *
 * Null for anything unrecognised - an account created while the field was
 * free text, or a programme renamed since. The caller treats null as "no
 * suggestion", which is the honest answer.
 */
export function collegeForProgram(program) {
  if (!program) return null;

  const found = Object.entries(PROGRAMS_BY_COLLEGE).find(([, list]) => list.includes(program));
  return found ? found[0] : null;
}

/*
 * The options for a Course / Program dropdown.
 *
 * `current` is whatever the account already has. If that value is not on the
 * list any more it is added back as its own option - without that the
 * dropdown would show empty and the first save would quietly wipe a real
 * answer. The blank first option lets somebody who is not a student, or who
 * would rather not say, leave it unanswered.
 */
export function programOptions(current = '') {
  const list = PROGRAMS.includes(current) || !current ? PROGRAMS : [current, ...PROGRAMS];

  return [
    { value: '', label: 'Select a program...' },
    ...list.map((name) => ({ value: name, label: name })),
  ];
}
