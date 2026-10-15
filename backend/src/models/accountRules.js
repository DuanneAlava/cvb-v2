/*
 * THE RULES FOR AN ACCOUNT'S DETAILS - one copy for every route that sets
 * them: registering (controllers/authController.js), a person editing their
 * own account (controllers/accountController.js) and an administrator editing
 * anybody's (routes/adminRoutes.js). The server-side twin of the frontend's
 * frontend/src/data/accountFields.js, whose rules these must match.
 */

// Some text, an @, some text, a dot, then more text.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// At least 8 characters, with one letter and one number.
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
const PASSWORD_RULE_MESSAGE = 'Use at least 8 characters, with one letter and one number.';

// What logging in and changing a password answer for a wrong email OR a wrong
// password - the same words for both, so neither can be used to find out
// which emails have accounts.
const WRONG_EMAIL_OR_PASSWORD = 'That email and password do not match an account.';

/*
 * The fields on an account: the key the frontend uses, the column it is kept
 * in, the label people read (in error messages and the activity log), and
 * the longest value the column holds.
 *
 * `school` marks the school details. They are optional, and may only be
 * kept while the person has agreed to it (users.school_consent_at) - see
 * schoolDetailsRefused() below.
 */
const ACCOUNT_FIELDS = [
  { key: 'name', column: 'name', label: 'Full name', required: true, max: 120 },
  { key: 'email', column: 'email', label: 'Email', required: true, max: 160 },
  { key: 'studentId', column: 'student_id', label: 'Student ID', max: 40, school: true },
  { key: 'course', column: 'course', label: 'Course / Program', max: 120, school: true },
  { key: 'yearLevel', column: 'year_level', label: 'Year level', max: 40, school: true },
  { key: 'section', column: 'section', label: 'Section', max: 20, school: true },
];

const SCHOOL_COLUMNS = ACCOUNT_FIELDS.filter((field) => field.school).map((field) => field.column);

/*
 * Would saving `values` put school details on an account that has not
 * agreed to keep them? Clearing them is always allowed; filling one in or
 * changing one is not, until the person has said yes.
 *
 * `current` is the account as it stands (none when registering). A value
 * sent back unchanged is not refused: an account made before consent was
 * asked may still hold school details until its owner decides, in the
 * "Terms updated" dialog - refusing those would block every other edit to
 * the account, a name change included.
 */
function schoolDetailsRefused(values, { hasConsent, current = {} }) {
  if (hasConsent) return false;
  return SCHOOL_COLUMNS.some((column) => values[column] && values[column] !== current[column]);
}

// What a person may change on their own account. The email identifies the
// account, so only an administrator changes it.
const SELF_EDITABLE = ['name', 'studentId', 'course', 'yearLevel', 'section'];
const ADMIN_EDITABLE = ACCOUNT_FIELDS.map((field) => field.key);

/*
 * Read the account fields named in `keys` out of a request body: trimmed, an
 * email in lower case, an empty optional field stored as NULL. A field the
 * body leaves out is left out here too, so it is not changed.
 *
 * Answers { values } keyed by column, or { error } with a message for the
 * person filling in the form.
 */
function readAccountFields(body, keys) {
  const values = {};

  for (const field of ACCOUNT_FIELDS) {
    if (!keys.includes(field.key) || body[field.key] === undefined) continue;

    let value = String(body[field.key] ?? '').trim();
    if (field.key === 'email') value = value.toLowerCase();

    if (field.required && !value) return { error: `${field.label} cannot be left empty.` };
    if (value.length > field.max) {
      return { error: `${field.label} must be ${field.max} characters or fewer.` };
    }
    if (field.key === 'email' && !EMAIL_PATTERN.test(value)) {
      return { error: 'Please enter a valid email address.' };
    }

    values[field.column] = value || null;
  }

  return { values };
}

/*
 * Which of `values` differ from what the account already holds, as the
 * labels people read - "Student ID", not "student_id". A form sends every
 * field, so listing the fields handed in would claim edits nobody made.
 */
function changedLabels(account, values) {
  return ACCOUNT_FIELDS.filter(
    (field) => field.column in values && (account[field.column] ?? null) !== values[field.column]
  ).map((field) => field.label);
}

module.exports = {
  EMAIL_PATTERN,
  PASSWORD_PATTERN,
  PASSWORD_RULE_MESSAGE,
  WRONG_EMAIL_OR_PASSWORD,
  SELF_EDITABLE,
  ADMIN_EDITABLE,
  SCHOOL_COLUMNS,
  readAccountFields,
  changedLabels,
  schoolDetailsRefused,
};
