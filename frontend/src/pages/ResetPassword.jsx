import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../services/store.js';
import { PASSWORD_RULE_MESSAGE, newPasswordProblem } from '../data/accountFields.js';
import AuthCard from '../components/AuthCard.jsx';
import TextField from '../components/TextField.jsx';
import Button from '../components/Button.jsx';
import { Notice } from '../components/admin/ui.jsx';

/*
 * CHOOSE A NEW PASSWORD - where the emailed "reset your password" link
 * lands: /reset-password#token=...
 *
 * The secret is in the "#" part of the link, which the browser never sends
 * to any server, so it does not end up in a web server's logs. It is read
 * once, then taken off the address bar - it is not left on screen or in the
 * browser's history. The server checks it, sets the new password and signs
 * the account out everywhere (resetPassword in
 * backend/src/controllers/authController.js). A link works once, for an
 * hour.
 *
 * WHAT YOU'LL MEET IN THIS FILE
 * - `window.location.hash`  The "#..." part of the address. URLSearchParams
 *   reads "token=..." out of it.
 * - navigate(path, { replace: true })  Change the address without adding a
 *   history entry - here, to drop the secret from it.
 */
const fromLink = () => new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '';

function ResetPassword() {
  const store = useStore();
  const navigate = useNavigate();
  const location = useLocation();

  const [token] = useState(fromLink);
  const [passwords, setPasswords] = useState({ next: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // The secret has been read: take it off the address.
  useEffect(() => {
    if (location.hash) navigate(location.pathname, { replace: true });
  }, [location.hash, location.pathname, navigate]);

  function handlePassword(field) {
    return (event) => {
      setPasswords({ ...passwords, [field]: event.target.value });
      setError('');
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;

    const problem = newPasswordProblem(passwords.next, passwords.confirm);
    if (problem) {
      setError(problem.message);
      return;
    }

    setBusy(true);
    const result = await store.resetPassword(token, passwords.next);
    setBusy(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setPasswords({ next: '', confirm: '' });
    setDone(true);
  }

  const askAgain = (
    <Link
      to="/forgot-password"
      className="inline-flex min-h-[44px] items-center rounded-lg px-2 font-semibold text-navy-600 hover:bg-navy-50 hover:underline"
    >
      Ask for a new link
    </Link>
  );

  if (done) {
    return (
      <AuthCard
        title="Password changed"
        subtitle="Use your new password from now on. You have been signed out on every device."
      >
        <Button type="button" variant="primary" size="lg" fullWidth onClick={() => navigate('/login', { replace: true })}>
          Log in
        </Button>
      </AuthCard>
    );
  }

  if (!token) {
    return (
      <AuthCard
        title="This link is incomplete"
        subtitle="Open the link from the email exactly as it was sent - or ask for a new one."
        footer={askAgain}
      />
    );
  }

  return (
    <AuthCard title="Choose a new password" subtitle="Type your new password twice." footer={askAgain}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <TextField
          id="reset-new"
          label="New password"
          type="password"
          value={passwords.next}
          onChange={handlePassword('next')}
          placeholder="At least 8 characters"
          autoComplete="new-password"
          hint={PASSWORD_RULE_MESSAGE}
        />

        <TextField
          id="reset-confirm"
          label="Confirm new password"
          type="password"
          value={passwords.confirm}
          onChange={handlePassword('confirm')}
          placeholder="Type it again"
          autoComplete="new-password"
        />

        {error && <Notice>{error}</Notice>}

        <Button type="submit" variant="primary" size="lg" fullWidth disabled={busy}>
          {busy ? 'Saving…' : 'Save new password'}
        </Button>
      </form>
    </AuthCard>
  );
}

export default ResetPassword;
