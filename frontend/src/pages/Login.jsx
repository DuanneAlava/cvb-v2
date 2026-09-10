import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { DEMO_PASSWORD } from '../services/store.js';
import AuthCard from '../components/AuthCard.jsx';
import TextField from '../components/TextField.jsx';
import Button from '../components/Button.jsx';

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
 *     super_admin / admin --> /admin/dashboard
 *     student / user      --> /student/dashboard
 *
 * A person who was sent here by a route guard is returned to wherever they
 * were heading instead, so a bookmarked admin page still works after signing
 * in - provided their role is allowed there, which the guard checks again.
 */
function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Set by the route guard when it turned somebody away.
  const from = location.state?.from;

  function handleChange(field) {
    return (event) => {
      setForm({ ...form, [field]: event.target.value });
      setError(''); // clear the old error as soon as anything is edited
    };
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!form.email.trim() || !form.password) {
      setError('Please fill in both fields.');
      return;
    }

    const result = login({ email: form.email.trim(), password: form.password });
    if (result.error) {
      setError(result.error);
      return;
    }

    // `result.home` is the dashboard for the role that just signed in.
    navigate(from ?? result.home, { replace: true });
  }

  // Fills the form so the panel can be tried without hunting for a password.
  function useDemoAccount(email) {
    setForm({ email, password: DEMO_PASSWORD });
    setError('');
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

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" size="lg" fullWidth>
          Log in
        </Button>
      </form>

      {/*
        THE DEMONSTRATION ACCOUNTS.
        These exist so the platform can be opened and judged without registering
        first, and they are seeded by services/store.js. Delete this block and
        those seed accounts before the site is used for real - a log-in page
        that lists working credentials is exactly as bad as it sounds.
      */}
      <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Demo accounts
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Password for all of them: <code className="font-mono">{DEMO_PASSWORD}</code>
        </p>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {[
            { label: 'Super Admin', email: 'superadmin@ollcf.edu.ph' },
            { label: 'Admin', email: 'admin@ollcf.edu.ph' },
            { label: 'Student', email: 'juan.delacruz@ollcf.edu.ph' },
          ].map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => useDemoAccount(account.email)}
              className="inline-flex min-h-[44px] items-center rounded-full border border-slate-300 bg-white px-4 py-1 text-xs font-medium text-navy-700 transition-colors hover:border-navy-600 hover:bg-navy-50"
            >
              {account.label}
            </button>
          ))}
        </div>
      </div>
    </AuthCard>
  );
}

export default Login;
