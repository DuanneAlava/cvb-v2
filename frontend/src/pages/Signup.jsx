import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import AuthCard from '../components/AuthCard.jsx';
import TextField from '../components/TextField.jsx';
import { programOptions } from '../data/programs.js';
import Button from '../components/Button.jsx';

/*
 * The sign-up page.
 *
 * It checks the fields, creates the account, signs the new student in and then
 * sends them to the dashboard their role belongs to.
 *
 * WHAT ROLE A NEW ACCOUNT GETS
 * Registering always produces a student or user account, never an admin one -
 * an admin role can only be granted afterwards by an administrator, from the
 * user profile page. A sign-up form that could mint administrators would make every
 * other permission check pointless.
 */

// A basic email shape check: some text, an @, some text, a dot, then more text.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The password rule shown under the password box: at least 8 characters,
// containing at least one letter and at least one number.
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

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
  });

  // One error message per field, e.g. { email: 'That does not look right' }.
  const [errors, setErrors] = useState({});

  const { signup } = useAuth();
  const navigate = useNavigate();

  // Update one field and clear that field's error as the student retypes.
  function handleChange(field) {
    return (event) => {
      setForm({ ...form, [field]: event.target.value });
      setErrors({ ...errors, [field]: undefined });
    };
  }

  // Check every field and return an object holding any problems found.
  function validate() {
    const found = {};

    if (!form.name.trim()) {
      found.name = 'Please enter your full name.';
    }

    if (!EMAIL_PATTERN.test(form.email.trim())) {
      found.email = 'Please enter a valid school email address.';
    }

    if (!PASSWORD_PATTERN.test(form.password)) {
      found.password = 'Use at least 8 characters, with one letter and one number.';
    }

    // Only complain about the second password box once the first one is valid.
    if (form.confirm !== form.password) {
      found.confirm = 'The two passwords do not match.';
    }

    return found;
  }

  function handleSubmit(event) {
    event.preventDefault(); // stop the browser reloading the page

    const found = validate();

    // Object.keys(...).length counts the problems. Stop here if there are any.
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }

    const result = signup({
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password,
      studentId: form.studentId.trim(),
      course: form.course.trim(),
      yearLevel: form.yearLevel.trim(),
      section: form.section.trim(),
    });

    if (result.error) {
      setErrors({ email: result.error });
      return;
    }

    // Success - already signed in, so straight to the right dashboard.
    navigate(result.home, { replace: true });
  }

  return (
    <AuthCard
      title="Create your account"
      subtitle="Every new account starts as a student account."
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

        <TextField
          id="signup-password"
          label="Password"
          type="password"
          value={form.password}
          onChange={handleChange('password')}
          placeholder="At least 8 characters"
          autoComplete="new-password"
          hint="At least 8 characters, with one letter and one number."
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

        <Button type="submit" variant="primary" size="lg" fullWidth>
          Create account
        </Button>
      </form>
    </AuthCard>
  );
}

export default Signup;
