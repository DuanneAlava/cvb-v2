import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import AuthCard from '../components/AuthCard.jsx';
import TextField from '../components/TextField.jsx';
import Button from '../components/Button.jsx';

/*
 * The log-in page.
 *
 * It checks the email and password against the accounts saved by the sign-up
 * page. When they match, the student is logged in and sent to the landing page,
 * where the navbar then shows their profile instead of the two auth buttons.
 */
function Login() {
  // One piece of state holding both fields, so the form is easy to extend.
  const [form, setForm] = useState({ email: '', password: '' });

  // The message shown when the details are wrong.
  const [error, setError] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  // Update one field while leaving the other untouched.
  function handleChange(field) {
    return (event) => {
      setForm({ ...form, [field]: event.target.value });
      setError(''); // clear the old error as soon as the student edits anything
    };
  }

  function handleSubmit(event) {
    event.preventDefault(); // stop the browser reloading the page

    // Check the fields are filled in before bothering the auth code.
    if (!form.email.trim() || !form.password) {
      setError('Please fill in both fields.');
      return;
    }

    // login() returns an error message when it fails, or null when it works.
    const failure = login({ email: form.email.trim(), password: form.password });
    if (failure) {
      setError(failure);
      return;
    }

    // Success - go to the landing page.
    navigate('/');
  }

  return (
    <AuthCard
      title="Welcome Back!"
      subtitle="Log in to post, upvote and track your suggestions."
      footer={
        <>
          New here?{' '}
          <Link to="/signup" className="font-semibold text-navy-600 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      {/* `space-y-4` puts an even gap between every field in the form. */}
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <TextField
          id="login-email"
          label="Email Address"
          type="email"
          value={form.email}
          onChange={handleChange('email')}
          placeholder="juandelacruz@gmail.com"
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
          The error sits above the button so it is read before the student
          presses submit again. role="alert" makes screen readers announce it.
        */}
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" size="lg" fullWidth>
          Log in
        </Button>
      </form>
    </AuthCard>
  );
}

export default Login;
