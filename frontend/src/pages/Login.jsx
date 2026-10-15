import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import AuthCard from '../components/AuthCard.jsx';
import TextField from '../components/TextField.jsx';
import Button from '../components/Button.jsx';
import { Notice } from '../components/admin/ui.jsx';

/*
 * The one log-in page for the whole platform.
 *
 * There is no separate admin login. Everybody signs in here, and the role on
 * the account decides where they are sent:
 *
 *     verify email + password
 *            |
 *     read the account's role
 *            |
 *     admin          --> /admin/dashboard
 *     student / user --> /  (the board)
 *
 * A person who was sent here by a route guard is returned to wherever they
 * were heading instead, so a bookmarked admin page still works after signing
 * in - provided their role is allowed there, which the guard checks again.
 * That forwarding is done by the route itself (RedirectIfSignedIn in
 * components/RequireAuth.jsx) the moment the account is confirmed, so this
 * page only has to report a failure.
 *
 * WHAT YOU'LL MEET IN THIS FILE (plain-English notes)
 *
 * - One useState for the whole form  `form` is an object holding both
 *   fields. `setForm({ ...form, [field]: value })` copies the old object and
 *   changes one property - the `[field]` in square brackets means "the
 *   property whose name is in the variable field".
 * - handleChange(field) returns a function  A function that makes a
 *   function ("higher-order function"). handleChange('email') hands back the
 *   onChange handler for the email box, so both inputs share one piece of
 *   code.
 * - `event.preventDefault()`  Stops the form doing a full page reload on
 *   submit, which is the browser's default and would lose our state.
 * - `location.state?.email`  The email the "forgot password" page hands
 *   back, if any. The `?.` is "optional chaining": read `.email` only if
 *   `state` exists, otherwise give undefined instead of crashing.
 * - `async` / `await`  Checking the password is a request to the server;
 *   the form waits for the answer, with the button showing it is busy.
 */
function Login() {
  const { login } = useAuth();
  const location = useLocation();

  // The "forgot password" page hands back the email it was using, so it is
  // not typed a second time.
  const [form, setForm] = useState({ email: location.state?.email ?? '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function handleChange(field) {
    return (event) => {
      setForm({ ...form, [field]: event.target.value });
      setError(''); // clear the old error as soon as anything is edited
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;

    if (!form.email.trim() || !form.password) {
      setError('Please fill in both fields.');
      return;
    }

    setBusy(true);
    const result = await login({ email: form.email.trim(), password: form.password });
    // On success this page is already on its way out (see the note at the top).
    if (!result.error) return;

    setBusy(false);
    setError(result.error);
  }

  return (
    <AuthCard
      title="Welcome Back!"
      subtitle="Log in to post, upvote and track your suggestions."
      footer={
        <>
          New here?{' '}
          {/* Padded to the touch floor: switching between logging in and
              signing up is a main action on this page, not incidental prose. */}
          <Link
            to="/signup"
            className="inline-flex min-h-[44px] items-center rounded-lg px-2 font-semibold text-navy-600 hover:bg-navy-50 hover:underline"
          >
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <TextField
          id="login-email"
          label="Email Address"
          type="email"
          value={form.email}
          onChange={handleChange('email')}
          placeholder="juandelacruz@ollcf.edu.ph"
          autoComplete="email"
        />

        <TextField
          id="login-password"
          label="Password"
          type="password"
          value={form.password}
          onChange={handleChange('password')}
          placeholder="Your password"
          autoComplete="current-password"
        />

        {/*
          A FORGOTTEN PASSWORD is reset with an emailed link
          (pages/ForgotPassword.jsx); whatever email is typed above goes
          along. A password you know is changed once signed in, from your
          own account.
        */}
        <div className="-mt-2 flex justify-end">
          <Link
            to="/forgot-password"
            state={{ email: form.email.trim() }}
            className="inline-flex min-h-[44px] items-center rounded-lg px-2 text-sm font-semibold text-navy-600 hover:bg-navy-50 hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        {error && <Notice>{error}</Notice>}

        <Button type="submit" variant="primary" size="lg" fullWidth disabled={busy}>
          {busy ? 'Logging in…' : 'Log in'}
        </Button>
      </form>
    </AuthCard>
  );
}

export default Login;
