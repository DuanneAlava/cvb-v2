/*
 * THE FIELDS ON AN ACCOUNT, in one place.
 *
 * Two screens edit an account: a student edits their own on /account, and an
 * administrator edits anybody's on /admin/users/:id. Each used to carry its
 * own copy of this list, with a comment on both asking whoever added a field
 * to remember to add it to the other. That is the kind of duplication the
 * rest of the codebase avoids, so the list lives here and both screens read
 * it. Add a field here - a campus, a guardian contact - and both forms and
 * the admin's read-only view pick it up.
 *
 * `adminOnly` marks a field a student may see but not change. The email
 * identifies the account, so a student changing it is a support request, not
 * a text box; an administrator can correct it.
 *
 * `required` marks a field that may not be left empty. It is checked in one
 * place - on the server, by backend/src/models/accountRules.js, which keeps
 * the same list - so both forms get the same rule, rather than each page
 * writing its own check (and one forgetting).
 *
 * `school` marks the school details. They are optional, and kept only while
 * the person has agreed to it - on the sign-up form, or later under Privacy &
 * Data on /account (components/PrivacyData.jsx). The server refuses to save
 * new ones without that agreement (backend/src/models/accountRules.js).
 *
 * `type: 'select'` means the value is picked from data/programs.js rather
 * than typed, so one programme cannot end up recorded five different ways.
 *
 * WHAT YOU'LL MEET IN THIS FILE
 *
 * This is "configuration as data": instead of writing six <input> elements
 * by hand in two places, we describe the six fields once as a list of small
 * objects, and each form loops over the list (`ACCOUNT_FIELDS.map(...)`) to
 * draw its inputs. `key` is the property name on the account record,
 * `label` is what the person sees, `type` is the HTML input type.
 */
export const ACCOUNT_FIELDS = [
  { key: 'name', label: 'Full name', type: 'text', required: true },
  { key: 'email', label: 'Email', type: 'email', adminOnly: true, required: true },
  { key: 'studentId', label: 'Student ID', type: 'text', school: true },
  { key: 'course', label: 'Course / Program', type: 'select', school: true },
  { key: 'yearLevel', label: 'Year level', type: 'text', school: true },
  { key: 'section', label: 'Section', type: 'text', school: true },
];

// What a student may edit on their own account.
export const STUDENT_EDITABLE_FIELDS = ACCOUNT_FIELDS.filter((field) => !field.adminOnly);

/*
 * THE PASSWORD RULE, for every place a password is chosen: signing up
 * (pages/Signup.jsx), changing it (components/ChangePasswordForm.jsx) and
 * resetting a forgotten one (pages/ResetPassword.jsx). At least 8
 * characters, with at least one letter and at least one number. The server
 * applies the same rule (backend/src/models/accountRules.js).
 */
export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
export const PASSWORD_RULE_MESSAGE = 'Use at least 8 characters, with one letter and one number.';

/*
 * THE EMAIL RULE, for every place an address is set: signing up, and an
 * administrator correcting one on a user's profile. Some text, an @, some
 * text, a dot, then more text - the rough shape of an email address. The
 * server applies the same rule (backend/src/models/accountRules.js).
 */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
