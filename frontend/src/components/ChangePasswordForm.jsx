import { useState } from 'react';
import { useStore } from '../services/store.js';
import { PASSWORD_RULE_MESSAGE, newPasswordProblem } from '../data/accountFields.js';
import Button from './Button.jsx';
import { Field, Notice, Panel, TextInput } from './admin/ui.jsx';

/*
 * CHANGE YOUR PASSWORD - for somebody signed in who knows their password.
 * On a student's account page (pages/student/Account.jsx) and on an
 * administrator's own profile (pages/admin/UserProfile.jsx).
 *
 * The current password is asked for even though the person is signed in:
 * a session left open on a shared computer must not be enough to take the
 * account over. A FORGOTTEN password is reset from the log-in page instead,
 * with an emailed link (pages/ForgotPassword.jsx).
 *
 * The server signs out every other device and hands this one a new sign-in
 * token, so the person stays signed in here (changeOwnPassword in
 * services/store.js; changePassword in
 * backend/src/controllers/accountController.js).
 */
const EMPTY = { current: '', next: '', confirm: '' };

function ChangePasswordForm() {
  const store = useStore();
  const [passwords, setPasswords] = useState(EMPTY);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  function handlePassword(field) {
    return (event) => {
      setPasswords({ ...passwords, [field]: event.target.value });
      setError('');
      setMessage('');
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;

    if (!passwords.current) {
      setError('Please enter your current password.');
      return;
    }
    const problem = newPasswordProblem(passwords.next, passwords.confirm);
    if (problem) {
      setError(problem.message);
      return;
    }

    setBusy(true);
    const result = await store.changeOwnPassword(passwords.current, passwords.next);
    setBusy(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setPasswords(EMPTY);
    setMessage('Your password has been changed. Any other device you were signed in on has been signed out.');
  }

  return (
    <Panel title="Password" description="Change the password you log in with.">
      <form onSubmit={handleSubmit} className="space-y-3" noValidate>
        <Field label="Current password" htmlFor="password-current">
          <TextInput
            id="password-current"
            type="password"
            value={passwords.current}
            onChange={handlePassword('current')}
            autoComplete="current-password"
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="New password" htmlFor="password-new" hint={PASSWORD_RULE_MESSAGE}>
            <TextInput
              id="password-new"
              type="password"
              value={passwords.next}
              onChange={handlePassword('next')}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Confirm new password" htmlFor="password-confirm">
            <TextInput
              id="password-confirm"
              type="password"
              value={passwords.confirm}
              onChange={handlePassword('confirm')}
              autoComplete="new-password"
            />
          </Field>
        </div>

        {error && <Notice>{error}</Notice>}
        {message && <Notice tone="success">{message}</Notice>}

        <div className="flex justify-end">
          <Button type="submit" variant="primary" size="sm" disabled={busy}>
            {busy ? 'Changing…' : 'Change password'}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

export default ChangePasswordForm;
