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
 * `type: 'select'` means the value is picked from data/programs.js rather
 * than typed, so one programme cannot end up recorded five different ways.
 */
export const ACCOUNT_FIELDS = [
  { key: 'name', label: 'Full name', type: 'text', required: true },
  { key: 'email', label: 'Email', type: 'email', adminOnly: true },
  { key: 'studentId', label: 'Student ID', type: 'text' },
  { key: 'course', label: 'Course / Program', type: 'select' },
  { key: 'yearLevel', label: 'Year level', type: 'text' },
  { key: 'section', label: 'Section', type: 'text' },
];

// What a student may edit on their own account.
export const STUDENT_EDITABLE_FIELDS = ACCOUNT_FIELDS.filter((field) => !field.adminOnly);
