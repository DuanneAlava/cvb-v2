import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import AuthCard from '../components/AuthCard.jsx';
import TextField from '../components/TextField.jsx';
import { programOptions } from '../data/programs.js';
import { EMAIL_PATTERN, PASSWORD_RULE_MESSAGE, newPasswordProblem } from '../data/accountFields.js';
import { POLICY_VERSIONS } from '../data/policies.js';
import Button from '../components/Button.jsx';
import { Notice } from '../components/admin/ui.jsx';

/*
 * The sign-up page.
 *
 * It checks the fields, creates the account, signs the new student in - and
 * the route then sends them to the page their role belongs to
 * (RedirectIfSignedIn in components/RequireAuth.jsx).
 *
 * WHAT ROLE A NEW ACCOUNT GETS
 * Signing up is for students and users only. It produces a student or user
 * account, never an admin one - an admin role can only be granted afterwards
 * by an administrator, from the user profile page. A sign-up form that could
 * mint administrators would make every other permission check pointless. The
 * server decides the role; this form cannot send one. The administrator is
 * the default account the server creates from its own settings
 * (backend/src/config/defaultAdmin.js).
 *
 * WHAT IS AGREED TO, AND HOW
 * - A short notice at the top says what is collected and why, with the
 *   Privacy Policy a click away - before anything is typed.
 * - SCHOOL DETAILS are optional and need their own tick, separate from the
 *   Terms: filling them in without it is refused, here and by the server.
 * - THE TERMS need a tick before "Create account" does anything. Neither box
 *   is ever ticked in advance.
 * The versions of the Terms and the Privacy Policy this page showed are sent
 * with the account, and recorded with the time (policy_acceptances).
 * Every policy link opens in a new tab, so reading one does not lose what
 * was typed.
 *
 * WHAT YOU'LL MEET IN THIS FILE (plain-English notes)
 *
 * - The same controlled-form pattern as Login.jsx: one useState object for
 *   the fields, a handler that copies it and changes one property, and
 *   `event.preventDefault()` on submit.
 * - A "regular expression" (regex)  EMAIL_PATTERN, from data/accountFields.js,
 *   is a pattern for text. `.test(value)` answers "does this text match the
 *   pattern?". This one reads: start, some non-space characters, an @, some
 *   more, a dot, some more, end - the rough shape of an email address.
 * - Validation before saving  Each check sets an `error` string and returns
 *   early; the form only calls signup() once every check has passed. The
 *   error is drawn with `{error && <p>...</p>}` - nothing when it is empty.
 * - `programOptions(...)`  Builds the <option> list for the course dropdown
 *   from data/programs.js, so the list of programmes lives in one place.
 */

function Signup() {
  // All four fields kept together in one object.
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirm: '',

    // The school details. Filling in a student number is what makes this a
    // student account rather than a general user one, and it is what lets
    // staff follow a concern up with the right person.
    studentId: '',
    course: '',
    yearLevel: '',
    section: '',

    // The two choices - both start unticked, and only the person ticks them.
    schoolConsent: false,
    acceptTerms: false,
  });

  // One error message per field, e.g. { email: 'That does not look right' }.
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const { signup } = useAuth();

  // Update one field and clear that field's error as the student retypes -
  // and the server's answer above the button, which the edit may have fixed.
  // A tick box sends `checked`, everything else `value`. Changing a school
  // detail can also settle the school-details tick's complaint.
  function handleChange(field) {
    return (event) => {
      const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
      setForm({ ...form, [field]: value });
      setErrors({ ...errors, [field]: undefined, schoolConsent: undefined, form: undefined });
    };
  }

  const fillsSchoolDetails = [form.studentId, form.course, form.yearLevel, form.section].some((value) =>
    value.trim()
  );

  // Check every field and return an object holding any problems found.
  function validate() {
    const found = {};

    if (!form.name.trim()) {
      found.name = 'Please enter your full name.';
    }

    if (!EMAIL_PATTERN.test(form.email.trim())) {
      found.email = 'Please enter a valid school email address.';
    }

    // The shared check from data/accountFields.js - the same one the account
    // page and the reset page use. It only complains about the second
    // password box once the first one is valid.
    const passwordProblem = newPasswordProblem(form.password, form.confirm);
    if (passwordProblem) {
      found[passwordProblem.field] = passwordProblem.message;
    }

    // The same words the server answers with.
    if (fillsSchoolDetails && !form.schoolConsent) {
      found.schoolConsent = 'Tick the box to let CampusVoiceBox keep your school details, or leave them blank.';
    }
    if (!form.acceptTerms) {
      found.acceptTerms = 'Please accept the Terms & Conditions to create your account.';
    }

    return found;
  }

  async function handleSubmit(event) {
    event.preventDefault(); // stop the browser reloading the page
    if (busy) return;

    const found = validate();

    // Object.keys(...).length counts the problems. Stop here if there are any.
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }

    setBusy(true);
    const result = await signup({
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password,
      studentId: form.studentId.trim(),
      course: form.course.trim(),
      yearLevel: form.yearLevel.trim(),
      section: form.section.trim(),
      schoolConsent: form.schoolConsent,
      acceptTerms: form.acceptTerms,
      termsVersion: POLICY_VERSIONS.terms,
      privacyVersion: POLICY_VERSIONS.privacy,
    });

    // Success: already signed in, and the route is already sending them on.
    if (!result.error) return;

    // An email somebody else already has is said beside the email box;
    // anything else - no connection, a policy changed while the page was
    // open - above the button.
    setBusy(false);
    setErrors(result.field === 'email' ? { email: result.error } : { form: result.error });
  }

  return (
    <AuthCard
      title="Create your account"
      subtitle="Add your Student ID for a student account, or leave it blank for a user account."
      footer={
        <>
          Already have an account?{' '}
          <Link
            to="/login"
            className="inline-flex min-h-[44px] items-center rounded-lg px-2 font-semibold text-navy-600 hover:bg-navy-50 hover:underline"
          >
            Log in
          </Link>
        </>
      }
    >
      {/* noValidate turns off the browser's own pop-ups so our messages are used instead. */}
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* WHAT IS COLLECTED, before anything is typed. */}
        <p className="rounded-lg bg-white/60 px-3 py-2 text-xs leading-relaxed text-slate-600">
          Your name and email are used to run your account and to tell you what happens to your
          posts. Your posts are reviewed by administrators before anybody else sees them. Read the{' '}
          <Link to="/privacy-policy" target="_blank" rel="noopener noreferrer" className="font-semibold text-navy-700 underline">
            Privacy Policy
          </Link>{' '}
          for everything kept, who sees it and your rights.
        </p>

        <TextField
          id="signup-name"
          label="Full name"
          value={form.name}
          onChange={handleChange('name')}
          placeholder="Juan Dela Cruz"
          autoComplete="name"
          error={errors.name}
        />

        <TextField
          id="signup-email"
          label="Email Address"
          type="email"
          value={form.email}
          onChange={handleChange('email')}
          placeholder="juandelacruz@ollcf.edu.ph"
          autoComplete="email"
          error={errors.email}
        />

        {/*
          THE SCHOOL DETAILS. Optional, because a staff member or a visitor has
          no student number - leaving this blank creates a general user account
          instead of a student one. Both can post; the difference is only that
          administrators can tell them apart when following something up.
        */}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="signup-student-id"
            label="Student ID"
            value={form.studentId}
            onChange={handleChange('studentId')}
            placeholder="2023-00145"
            hint="Leave blank if you are not a student."
          />

          <TextField
            id="signup-course"
            label="Course / Program"
            value={form.course}
            onChange={handleChange('course')}
            options={programOptions(form.course)}
            hint="Leave unselected if you are not a student."
          />

          <TextField
            id="signup-year"
            label="Year level"
            value={form.yearLevel}
            onChange={handleChange('yearLevel')}
            placeholder="3rd Year"
          />

          <TextField
            id="signup-section"
            label="Section"
            value={form.section}
            onChange={handleChange('section')}
            placeholder="A"
          />
        </div>

        {/* THE SCHOOL DETAILS' OWN CONSENT - optional, unticked, apart from the Terms. */}
        <div>
          <label htmlFor="signup-school-consent" className="flex cursor-pointer items-start gap-3">
            <input
              id="signup-school-consent"
              type="checkbox"
              checked={form.schoolConsent}
              onChange={handleChange('schoolConsent')}
              aria-invalid={Boolean(errors.schoolConsent)}
              aria-describedby="signup-school-consent-note"
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-navy-600 focus:ring-navy-600"
            />
            <span className="text-sm">
              <span className="font-semibold text-navy-900">
                Optional: let CampusVoiceBox keep my school details
              </span>
              <span id="signup-school-consent-note" className="mt-0.5 block text-xs text-slate-500">
                Only needed if you fill them in above. Staff use them to follow up your concerns. You
                can withdraw later from your account page, which removes them.
              </span>
            </span>
          </label>
          {errors.schoolConsent && <p className="mt-1 text-sm text-red-600">{errors.schoolConsent}</p>}
        </div>

        <TextField
          id="signup-password"
          label="Password"
          type="password"
          value={form.password}
          onChange={handleChange('password')}
          placeholder="At least 8 characters"
          autoComplete="new-password"
          hint={PASSWORD_RULE_MESSAGE}
          error={errors.password}
        />

        <TextField
          id="signup-confirm"
          label="Confirm password"
          type="password"
          value={form.confirm}
          onChange={handleChange('confirm')}
          placeholder="Type it again"
          autoComplete="new-password"
          error={errors.confirm}
        />

        {/* THE TERMS - required, unticked, right before the button. */}
        <div>
          <label htmlFor="signup-accept-terms" className="flex cursor-pointer items-start gap-3">
            <input
              id="signup-accept-terms"
              type="checkbox"
              checked={form.acceptTerms}
              onChange={handleChange('acceptTerms')}
              aria-invalid={Boolean(errors.acceptTerms)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-navy-600 focus:ring-navy-600"
            />
            <span className="text-sm text-navy-900">
              I accept the{' '}
              <Link
                to="/terms-and-conditions"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-navy-700 underline"
              >
                Terms &amp; Conditions
              </Link>{' '}
              and have read the{' '}
              <Link
                to="/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-navy-700 underline"
              >
                Privacy Policy
              </Link>
              .
            </span>
          </label>
          {errors.acceptTerms && <p className="mt-1 text-sm text-red-600">{errors.acceptTerms}</p>}
        </div>

        {errors.form && <Notice>{errors.form}</Notice>}

        <Button type="submit" variant="primary" size="lg" fullWidth disabled={busy}>
          {busy ? 'Creating your account…' : 'Create account'}
        </Button>
      </form>
    </AuthCard>
  );
}

export default Signup;
