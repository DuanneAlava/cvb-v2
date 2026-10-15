import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useStore, userActivity } from '../../services/store.js';
import { PROFILE_PHOTO_MAX_BYTES, formatBytes, prepareProfilePhoto } from '../../services/attachments.js';
import { programOptions } from '../../data/programs.js';
import { STUDENT_EDITABLE_FIELDS } from '../../data/accountFields.js';
import Layout from '../../components/Layout.jsx';
import Button from '../../components/Button.jsx';
import BackButton from '../../components/BackButton.jsx';
import PrivacyData from '../../components/PrivacyData.jsx';
import ChangePasswordForm from '../../components/ChangePasswordForm.jsx';
import {
  AccountStatusBadge,
  Avatar,
  Field,
  Notice,
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
 * - <input type="file">  The browser's own "choose a file" control. It is
 *   hidden (`className="hidden"`) and the "Upload photo" button clicks it
 *   through a ref, so the page shows a normal button instead of the
 *   browser's plain grey one. `accept="image/*"` offers photos only - on a
 *   phone that means the gallery or the camera.
 * - async / await  Shrinking a photo takes a moment, so it runs without
 *   freezing the page; `await` waits for it to finish before saving.
 *
 * THE PROFILE PHOTO
 * Chosen in the Account panel and saved at once - it does not wait for
 * "Save changes", which belongs to the form beside it. The picture is cut
 * to a square and shrunk first (prepareProfilePhoto in
 * services/attachments.js), then saved with the account on the server. Every
 * circle that stands for the account - the navbar, the profile menu, this
 * page, and the admin panel's lists - then shows it instead of the initials
 * (see Avatar in components/admin/ui.jsx). "Remove" goes back to initials.
 * Other students never see it: the board shows no pictures of who posted.
 *
 * SCHOOL DETAILS NEED CONSENT
 * Student ID, course, year level and section are optional, and kept only
 * while the person allows it - in the Privacy & Data panel at the foot of
 * the page (components/PrivacyData.jsx). Without that, their boxes are
 * greyed out and left out of "Save changes"; the server refuses new ones
 * anyway (backend/src/models/accountRules.js).
 */

// The fields' current values on the account, for the form to start from.
function valuesOf(user, fields) {
  return Object.fromEntries(fields.map((field) => [field.key, user[field.key] ?? '']));
}

function Account() {
  const { user } = useAuth();
  const store = useStore();

  const [draft, setDraft] = useState(() => valuesOf(user, STUDENT_EDITABLE_FIELDS));

  const schoolAllowed = Boolean(store.db.privacy?.schoolConsent);

  /*
   * When the consent changes, the school boxes start again from what the
   * server now holds: withdrawing has just deleted the details, so a value
   * left in the form would look as though it was kept. (Adjusting state
   * while drawing, rather than in an effect, is React's own advice for
   * "reset part of the state when something changes".)
   */
  const [draftSchoolAllowed, setDraftSchoolAllowed] = useState(schoolAllowed);
  if (draftSchoolAllowed !== schoolAllowed) {
    setDraftSchoolAllowed(schoolAllowed);
    setDraft((current) => ({
      ...current,
      ...valuesOf(user, STUDENT_EDITABLE_FIELDS.filter((field) => field.school)),
    }));
  }

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // The profile photo has its own messages, shown under the photo, so they
  // are never confused with the form's.
  const photoInputRef = useRef(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoMessage, setPhotoMessage] = useState('');
  const [photoError, setPhotoError] = useState('');

  const activity = userActivity(store.db, user.id);

  // Save (or, with '', remove) the photo on the account.
  async function savePhoto(photo, successMessage) {
    const result = await store.updateOwnPhoto(photo);
    if (result.error) {
      setPhotoError(result.error);
      return;
    }
    setPhotoMessage(successMessage);
  }

  async function handlePhotoChosen(event) {
    const file = event.target.files?.[0];
    // Empty the input, so picking the same file again still counts as a choice.
    event.target.value = '';
    if (!file) return; // the picker was closed without choosing anything

    setPhotoBusy(true);
    setPhotoError('');
    setPhotoMessage('');
    try {
      const photo = await prepareProfilePhoto(file);
      await savePhoto(photo, 'Your profile photo has been updated.');
    } catch (problem) {
      setPhotoError(problem.message);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function handleRemovePhoto() {
    setPhotoBusy(true);
    setPhotoError('');
    setPhotoMessage('');
    await savePhoto('', 'Your profile photo has been removed.');
    setPhotoBusy(false);
  }

  async function handleSave(event) {
    event.preventDefault();
    if (saving) return;

    // The rules - a name is required, spaces are trimmed - are checked on
    // the server, for this form and the admin's alike.
    // Without consent the school details are not sent at all.
    const fields = Object.fromEntries(
      STUDENT_EDITABLE_FIELDS.filter((field) => schoolAllowed || !field.school).map((field) => [
        field.key,
        draft[field.key],
      ])
    );

    setSaving(true);
    const result = await store.updateOwnAccount(fields);
    setSaving(false);

    if (result.error) {
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
        {/* Reached from the profile menu, like the dashboard, and given the
            same way back - see components/BackButton.jsx. */}
        <BackButton className="mb-3" />

        <div className="mb-5">
          <h1 className="text-2xl font-bold text-navy-900">Your account</h1>
          <p className="mt-1 text-sm text-slate-500">
            Keep these up to date so staff can follow up on your concerns properly.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {/* The left two-thirds: the profile form, and changing the password
              (components/ChangePasswordForm.jsx). A forgotten password is
              reset from the log-in page, with an emailed link. */}
          <div className="space-y-4 md:col-span-2">
            <Panel title="Profile">
              <form onSubmit={handleSave} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  {STUDENT_EDITABLE_FIELDS.map((field) => {
                    // A greyed-out school box shows what the server holds, so
                    // details removed elsewhere (accepting the Terms without
                    // keeping them) disappear here at once.
                    const locked = field.school && !schoolAllowed;
                    const value = locked ? user[field.key] ?? '' : draft[field.key];
                    return (
                      <Field key={field.key} label={field.label} htmlFor={`account-${field.key}`}>
                        {/* Course / Program is picked from the list in
                            data/programs.js rather than typed, so one programme
                            cannot end up recorded five different ways. */}
                        {field.type === 'select' ? (
                          <Select
                            id={`account-${field.key}`}
                            value={value}
                            disabled={locked}
                            onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
                            options={programOptions(value)}
                          />
                        ) : (
                          <TextInput
                            id={`account-${field.key}`}
                            type={field.type}
                            value={value}
                            disabled={locked}
                            onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
                          />
                        )}
                      </Field>
                    );
                  })}

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

                {!schoolAllowed && (
                  <p className="text-xs text-slate-500">
                    School details are optional, and kept only if you allow it under{' '}
                    <a href="#privacy" className="font-semibold text-navy-700 underline">
                      Privacy &amp; Data
                    </a>{' '}
                    below.
                  </p>
                )}

                {error && (
                  <Notice>
                    {error}
                  </Notice>
                )}
                {message && (
                  <Notice tone="success">
                    {message}
                  </Notice>
                )}

                <div className="flex justify-end pt-1">
                  <Button type="submit" variant="primary" size="sm" disabled={saving}>
                    {saving ? 'Saving…' : 'Save changes'}
                  </Button>
                </div>
              </form>
            </Panel>

            <ChangePasswordForm />
          </div>

          <div className="space-y-4">
            <Panel title="Account">
              <div className="flex flex-col items-center gap-2 text-center">
                <Avatar name={user.name} photo={user.photo} size="xl" />

                {/* THE PROFILE PHOTO CONTROLS. The file input itself is
                    hidden; the button below opens it. */}
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChosen}
                  className="hidden"
                />
                <div className="flex flex-wrap justify-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={photoBusy}
                    onClick={() => photoInputRef.current?.click()}
                  >
                    {photoBusy ? 'Saving photo…' : user.photo ? 'Change photo' : 'Upload photo'}
                  </Button>
                  {user.photo && !photoBusy && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemovePhoto}
                      className="!text-red-700 hover:!bg-red-50"
                    >
                      Remove
                    </Button>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  A JPG, PNG or WebP photo up to {formatBytes(PROFILE_PHOTO_MAX_BYTES)}. Only you and
                  school staff see it.
                </p>
                {photoError && (
                  <Notice className="w-full">
                    {photoError}
                  </Notice>
                )}
                {photoMessage && (
                  <Notice tone="success" className="w-full">
                    {photoMessage}
                  </Notice>
                )}

                <p className="mt-1 font-semibold text-navy-900">{user.name}</p>
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

        <div className="mt-4">
          <PrivacyData />
        </div>
      </div>
    </Layout>
  );
}

export default Account;
