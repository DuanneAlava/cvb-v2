import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useStore, userActivity } from '../../services/store.js';
import { programOptions } from '../../data/programs.js';
import { STUDENT_EDITABLE_FIELDS } from '../../data/accountFields.js';
import Layout from '../../components/Layout.jsx';
import Button from '../../components/Button.jsx';
import {
  AccountStatusBadge,
  Avatar,
  Field,
  Panel,
  RoleBadge,
  Select,
  StatCard,
  TextInput,
  formatDate,
} from '../../components/admin/ui.jsx';

/*
 * The student's own account page.
 *
 * ONE LIST OF FIELDS, TWO SCREENS
 * The form is built from data/accountFields.js, the same list the admin
 * panel's user profile edits from. Add a field there and both screens pick
 * it up; nothing here has to change, because everything downstream reads the
 * account record rather than a fixed set of columns.
 *
 * What a student may NOT edit here is just as deliberate: role and account
 * status are administrative decisions, so they are shown and not offered,
 * and the email is shown disabled - see `adminOnly` in that file.
 *
 * An administrator never lands here: /account forwards them to their own
 * page in the admin panel, which shows the same fields with the admin
 * controls beside them. One account page per person, not two.
 *
 * WHAT YOU'LL MEET IN THIS FILE (plain-English notes)
 *
 * - `useState(() => {...})`  A lazy initialiser: the function runs once, on
 *   the first render, to build the starting value - here, an object with one
 *   entry per editable field, seeded from the signed-in account.
 * - `setDraft({ ...draft, [field.key]: value })`  Copy the draft and change
 *   one property. React state should be replaced, not edited in place, so
 *   React can tell something changed.
 * - <form onSubmit={handleSave}>  The handler receives the submit event and
 *   calls preventDefault() so the page does not reload.
 * - `disabled`  On the email input: shown, greyed out, not editable.
 * - `role="alert"` / `role="status"`  Tell screen readers that the error or
 *   the "saved" message is an announcement worth reading out when it appears.
 */

function Account() {
  const { user } = useAuth();
  const store = useStore(user);

  const [draft, setDraft] = useState(() => {
    const seed = {};
    STUDENT_EDITABLE_FIELDS.forEach((field) => {
      seed[field.key] = user[field.key] ?? '';
    });
    return seed;
  });

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const activity = userActivity(store.db, user.id);

  function handleSave(event) {
    event.preventDefault();

    if (!draft.name.trim()) {
      setError('Please enter your name.');
      return;
    }

    const result = store.updateUser(user.id, { ...draft, name: draft.name.trim() });
    if (result?.error) {
      setError(result.error);
      setMessage('');
      return;
    }

    setError('');
    setMessage('Your account has been updated.');
  }

  return (
    <Layout>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-navy-900">Your account</h1>
          <p className="mt-1 text-sm text-slate-500">
            Keep these up to date so staff can follow up on your concerns properly.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Panel className="md:col-span-2" title="Profile">
            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                {STUDENT_EDITABLE_FIELDS.map((field) => (
                  <Field key={field.key} label={field.label} htmlFor={`account-${field.key}`}>
                    {/* Course / Program is picked from the list in
                        data/programs.js rather than typed, so one programme
                        cannot end up recorded five different ways. */}
                    {field.type === 'select' ? (
                      <Select
                        id={`account-${field.key}`}
                        value={draft[field.key]}
                        onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
                        options={programOptions(draft[field.key])}
                      />
                    ) : (
                      <TextInput
                        id={`account-${field.key}`}
                        type={field.type}
                        value={draft[field.key]}
                        onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
                      />
                    )}
                  </Field>
                ))}

                {/* The email identifies the account, so it is shown rather than
                    offered - changing it is a support request, not a text box. */}
                <Field
                  label="Email"
                  htmlFor="account-email"
                  hint="Contact the registrar to change your school email."
                >
                  <TextInput id="account-email" value={user.email} disabled />
                </Field>
              </div>

              {error && (
                <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              )}
              {message && (
                <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  {message}
                </p>
              )}

              <div className="flex justify-end pt-1">
                <Button type="submit" variant="primary" size="sm">
                  Save changes
                </Button>
              </div>
            </form>
          </Panel>

          <div className="space-y-4">
            <Panel title="Account">
              <div className="flex flex-col items-center gap-2 text-center">
                <Avatar name={user.name} size="lg" />
                <p className="font-semibold text-navy-900">{user.name}</p>
                <p className="text-xs text-slate-500">{user.email}</p>
                <div className="flex gap-2">
                  <RoleBadge role={user.role} />
                  <AccountStatusBadge status={user.status} />
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  Member since {formatDate(user.createdAt)}
                </p>
              </div>
            </Panel>

            <Panel title="Your activity">
              <div className="grid grid-cols-2 gap-2">
                <StatCard label="Posts" value={activity.total} />
                <StatCard label="Published" value={activity.approved} tone="good" />
                <StatCard label="Pending" value={activity.pending} />
                <StatCard label="Resolved" value={activity.resolved} tone="good" />
              </div>

              <Link
                to="/student/dashboard"
                className="mt-3 flex min-h-[44px] items-center justify-center rounded-lg text-center text-sm font-semibold text-navy-600 hover:bg-navy-50 hover:underline"
              >
                See all your submissions
              </Link>
            </Panel>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default Account;
