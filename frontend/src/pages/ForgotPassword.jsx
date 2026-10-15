import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useStore } from '../services/store.js';
import AuthCard from '../components/AuthCard.jsx';
import TextField from '../components/TextField.jsx';
import Button from '../components/Button.jsx';
import { Notice } from '../components/admin/ui.jsx';

/*
 * "FORGOT PASSWORD?" - reached from the log-in page.
 *
 * The person types their email, and the server emails a one-time link to
 * choose a new password (forgotPassword in
 * backend/src/controllers/authController.js). The link opens
 * pages/ResetPassword.jsx.
 *
 * The answer is the same whether or not the email has an account - "if it
 * does, a link is on its way" - so this page cannot be used to find out who
 * has an account. Nobody needs to be signed in.
 *
 * WHAT YOU'LL MEET IN THIS FILE
 * - `location.state?.email`  The log-in page passes along whatever email was
 *   typed there, so it is not typed twice.
 * - `sent`  Once the request has gone, the form is replaced by what to do
 *   next: check the inbox.
 */
function ForgotPassword() {
  const location = useLocation();
  const store = useStore();

  const [email, setEmail] = useState(location.state?.email ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;
    if (!email.trim()) {
      setError('Please enter the email you log in with.');
      return;
    }

    setBusy(true);
    const result = await store.requestPasswordReset(email.trim());
    setBusy(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setSent(result.message);
  }

  const backToLogin = (
    <>
      Remembered it?{' '}
      <Link
        to="/login"
        state={{ email: email.trim() }}
        className="inline-flex min-h-[44px] items-center rounded-lg px-2 font-semibold text-navy-600 hover:bg-navy-50 hover:underline"
      >
        Log in
      </Link>
    </>
  );

  if (sent) {
    return (
      <AuthCard title="Check your email" subtitle={sent} footer={backToLogin}>
        <p className="text-sm text-slate-600">
          Open the link in the email to choose a new password. If nothing arrives within a few
          minutes, check your spam folder, then ask again.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Forgot your password?"
      subtitle="Type the email you log in with, and we will email you a link to choose a new password."
      footer={backToLogin}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <TextField
          id="forgot-email"
          label="Email Address"
          type="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setError('');
          }}
          placeholder="juandelacruz@ollcf.edu.ph"
          autoComplete="email"
        />

        {error && <Notice>{error}</Notice>}

        <Button type="submit" variant="primary" size="lg" fullWidth disabled={busy}>
          {busy ? 'Sending…' : 'Email me a reset link'}
        </Button>
      </form>
    </AuthCard>
  );
}

export default ForgotPassword;
