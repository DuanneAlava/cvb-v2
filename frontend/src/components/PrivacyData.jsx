import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore, TERMS_REQUIRED_EVENT } from '../services/store.js';
import { SHOWN_CATEGORIES, openCookieSettings, useConsent } from '../services/consent.js';
import { saveFile } from '../services/csv.js';
import {
  ACCEPTANCE_WORDS,
  OPEN_PRIVACY_STATUSES,
  PRIVACY_REQUEST_STATUSES,
  PRIVACY_REQUEST_TYPES,
  requestTypeLabel,
} from '../data/policies.js';
import Button from './Button.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import { Badge, Field, Notice, Panel, TextArea, formatDate, formatDateTime } from './admin/ui.jsx';

/*
 * PRIVACY & DATA - the last panel on a student's account page (/account).
 *
 * Everything a person can do about their own information, in one place:
 *   - read the policies, and see which Terms they accepted
 *   - allow or withdraw keeping their school details
 *   - see and change their cookie choice
 *   - download a copy of their data, at once, with nobody's permission
 *   - ask an administrator for what the page cannot do by itself (a copy of
 *     the staff notes, a correction, deleting the account), and follow the
 *     answer
 *   - see the history of what they accepted, and when
 *
 * Every action is the server's to allow (backend/src/controllers/
 * privacyController.js) and acts on the signed-in account only. A suspended
 * account still sees all of this: suspension stops posting and voting, not
 * a person's rights over their own information.
 *
 * An administrator gets the same panel on their own profile page in the
 * admin panel (pages/admin/UserProfile.jsx), since /account forwards them
 * there. Their requests are handled by another administrator - see
 * pages/admin/PrivacyRequests.jsx.
 */

function PrivacyData() {
  const store = useStore();
  const privacy = store.db.privacy;
  const { choice } = useConsent();

  // One message at a time, shown under the part of the panel it is about.
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState('');
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);

  const [type, setType] = useState('');
  const [details, setDetails] = useState('');

  if (!privacy) return null;

  const say = (where, tone, text) => setNotice({ where, tone, text });
  const noticeFor = (where) =>
    notice?.where === where && (
      <Notice tone={notice.tone} className="mt-2">
        {notice.text}
      </Notice>
    );

  // The only request of each type that may be open at a time.
  const openTypes = privacy.requests
    .filter((request) => OPEN_PRIVACY_STATUSES.includes(request.status))
    .map((request) => request.type);
  const chosenType = PRIVACY_REQUEST_TYPES.find((option) => option.key === type);

  async function setSchoolConsent(granted) {
    setConfirmWithdraw(false);
    setBusy('school');
    const result = await store.setSchoolConsent(granted);
    setBusy('');
    if (result.error) return say('school', 'error', result.error);
    say(
      'school',
      'success',
      granted
        ? 'Thank you. You can now fill in your school details in the Profile form above.'
        : 'Done. Your school details have been removed from your account and are no longer kept.'
    );
  }

  async function handleDownload() {
    setBusy('export');
    const result = await store.exportMyData();
    setBusy('');
    if (result.error) return say('export', 'error', result.error);
    saveFile(result.filename, result.blob);
    say('export', 'success', `Downloaded as ${result.filename}.`);
  }

  async function handleRequest(event) {
    event.preventDefault();
    if (!type) return say('request', 'error', 'Choose what you are asking for.');
    setBusy('request');
    const result = await store.submitPrivacyRequest(type, details);
    setBusy('');
    if (result.error) return say('request', 'error', result.error);
    setType('');
    setDetails('');
    say('request', 'success', 'Your request has been sent. You can follow it below - the reply will appear there.');
  }

  async function handleCancel(id) {
    setBusy(`cancel-${id}`);
    const result = await store.cancelPrivacyRequest(id);
    setBusy('');
    say('list', result.error ? 'error' : 'success', result.error || 'Your request has been cancelled.');
  }

  return (
    <Panel
      id="privacy"
      title="Privacy & Data"
      description="See and control what CampusVoiceBox keeps about you."
    >
      <div className="space-y-5">
        {/* THE POLICIES, AND THE TERMS ACCEPTED */}
        <Section title="Policies">
          <p>
            <Link to="/privacy-policy" className="font-semibold text-navy-700 underline">
              Privacy Policy
            </Link>{' '}
            ·{' '}
            <Link to="/terms-and-conditions" className="font-semibold text-navy-700 underline">
              Terms & Conditions
            </Link>{' '}
            ·{' '}
            <Link to="/cookie-policy" className="font-semibold text-navy-700 underline">
              Cookie Policy
            </Link>
          </p>
          {privacy.mustAcceptTerms ? (
            <div className="flex flex-wrap items-center gap-3">
              <p>
                {privacy.acceptedTermsVersion
                  ? 'The Terms & Conditions have changed since you accepted them.'
                  : 'You have not accepted the Terms & Conditions yet.'}{' '}
                Until you do, you can read the board but not post or vote.
              </p>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => window.dispatchEvent(new Event(TERMS_REQUIRED_EVENT))}
              >
                Review and accept
              </Button>
            </div>
          ) : (
            <p>You accepted the Terms & Conditions of {formatVersion(privacy.acceptedTermsVersion)}.</p>
          )}
        </Section>

        {/* THE OPTIONAL CONSENT FOR SCHOOL DETAILS */}
        <Section title="Your school details">
          {privacy.schoolConsent ? (
            <>
              <p>
                You allowed CampusVoiceBox to keep your student ID, course, year level and section
                (since {formatDate(privacy.schoolConsent.at)}), so staff can follow up your concerns.
                Withdrawing removes them from your account straight away.
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy === 'school'}
                onClick={() => setConfirmWithdraw(true)}
              >
                Withdraw and remove my school details
              </Button>
            </>
          ) : (
            <>
              <p>
                {privacy.hasSchoolDetails
                  ? 'Your account holds school details from before you were asked about them. They are removed when you accept the Terms, unless you allow CampusVoiceBox to keep them.'
                  : 'CampusVoiceBox keeps no school details for you. They are optional.'}{' '}
                If you allow it, your student ID, course, year level and section are kept with your
                account so staff can follow up your concerns. You can withdraw at any time.
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy === 'school'}
                onClick={() => setSchoolConsent(true)}
              >
                {busy === 'school' ? 'Saving…' : 'Allow keeping my school details'}
              </Button>
            </>
          )}
          {noticeFor('school')}
        </Section>

        {/* COOKIES AND BROWSER STORAGE */}
        <Section title="Cookies and browser storage">
          {choice ? (
            <ul className="space-y-0.5">
              {SHOWN_CATEGORIES.map((category) => (
                <li key={category.key}>
                  {category.label}:{' '}
                  <strong className="text-navy-900">
                    {!category.optional ? 'always on' : choice.categories[category.key] ? 'allowed' : 'not allowed'}
                  </strong>
                </li>
              ))}
            </ul>
          ) : (
            <p>You have not made a choice on this device yet.</p>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={openCookieSettings}>
            Manage cookie settings
          </Button>
        </Section>

        {/* A COPY OF EVERYTHING */}
        <Section title="Download your data">
          <p>
            A copy of what CampusVoiceBox holds about you - your account, your posts and their files,
            your votes, notifications, activity and choices - as one JSON file. It may contain your
            photo and attachments, so keep it somewhere safe. Staff notes on your posts are not
            included; ask for them below.
          </p>
          <Button type="button" variant="ghost" size="sm" disabled={busy === 'export'} onClick={handleDownload}>
            {busy === 'export' ? 'Preparing…' : 'Download my data'}
          </Button>
          {noticeFor('export')}
        </Section>

        {/* ASKING AN ADMINISTRATOR */}
        <Section title="Make a privacy request">
          <p>For anything you cannot do on this page yourself. An administrator replies here.</p>
          <form onSubmit={handleRequest} className="space-y-3">
            <fieldset>
              <legend className="sr-only">What are you asking for?</legend>
              <div className="space-y-2">
                {PRIVACY_REQUEST_TYPES.map((option) => {
                  const alreadyOpen = openTypes.includes(option.key);
                  const look = alreadyOpen
                    ? 'cursor-not-allowed border-slate-100 opacity-60'
                    : type === option.key
                      ? 'cursor-pointer border-navy-600 bg-navy-50'
                      : 'cursor-pointer border-slate-200';
                  return (
                    <label
                      key={option.key}
                      htmlFor={`privacy-type-${option.key}`}
                      className={`flex items-start gap-3 rounded-lg border p-3 ${look}`}
                    >
                      <input
                        id={`privacy-type-${option.key}`}
                        type="radio"
                        name="privacy-type"
                        value={option.key}
                        checked={type === option.key}
                        disabled={alreadyOpen}
                        onChange={() => {
                          setType(option.key);
                          setNotice(null);
                        }}
                        className="mt-0.5 h-4 w-4 shrink-0 border-slate-300 text-navy-600 focus:ring-navy-600"
                      />
                      <span>
                        <span className="block font-semibold text-navy-900">{option.label}</span>
                        <span className="block text-xs text-slate-500">
                          {alreadyOpen ? 'You already have one open - see below.' : option.description}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {type === 'deletion' && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-semibold">What happens when you ask for deletion</p>
                <p className="mt-1">
                  An administrator who handles privacy reviews your request, then deletes your account.
                  They decide whether your posts are deleted too, or kept without your name - for
                  example when a concern you raised is still being worked on. Records the school must
                  keep, such as activity records, are not deleted.
                </p>
                <p className="mt-1">
                  Once your account is deleted you can no longer log in, so you will not see the reply
                  here. If you want a copy of your data, download it first.
                </p>
              </div>
            )}

            {chosenType && (
              <Field
                label={chosenType.detailsRequired ? 'Details' : 'Details (optional)'}
                htmlFor="privacy-details"
                hint="Up to 2000 characters."
              >
                <TextArea
                  id="privacy-details"
                  rows={4}
                  maxLength={2000}
                  value={details}
                  onChange={(event) => setDetails(event.target.value)}
                  placeholder={
                    type === 'correction'
                      ? 'What is wrong, and what should it say?'
                      : 'Anything that helps an administrator understand your request.'
                  }
                />
              </Field>
            )}

            {noticeFor('request')}

            <div className="flex justify-end">
              <Button type="submit" variant="primary" size="sm" disabled={busy === 'request' || !type}>
                {busy === 'request' ? 'Sending…' : 'Send request'}
              </Button>
            </div>
          </form>
        </Section>

        {/* THE PERSON'S OWN REQUESTS */}
        <Section title="Your requests">
          {noticeFor('list')}
          {privacy.requests.length === 0 ? (
            <p>You have not made any privacy requests.</p>
          ) : (
            <ul className="space-y-2">
              {privacy.requests.map((request) => {
                const status = PRIVACY_REQUEST_STATUSES[request.status];
                return (
                  <li key={request.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-navy-900">{requestTypeLabel(request.type)}</p>
                      <Badge className={status.className}>{status.label}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Sent {formatDateTime(request.createdAt)}
                      {request.resolvedAt && ` · closed ${formatDateTime(request.resolvedAt)}`}
                    </p>
                    {request.details && (
                      <p className="mt-2 whitespace-pre-wrap break-words">{request.details}</p>
                    )}
                    {request.response && (
                      <p className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-2">
                        <span className="font-semibold text-navy-900">Reply: </span>
                        {request.response}
                      </p>
                    )}
                    {request.status === 'pending' && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="mt-2"
                        disabled={busy === `cancel-${request.id}`}
                        onClick={() => handleCancel(request.id)}
                      >
                        Cancel request
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        {/* WHAT THEY ACCEPTED, AND WHEN */}
        <Section title="What you have agreed to">
          {privacy.acceptances.length === 0 ? (
            <p>Nothing is recorded yet.</p>
          ) : (
            <ul className="space-y-1">
              {privacy.acceptances.map((entry) => (
                <li key={`${entry.document}-${entry.version}-${entry.action}-${entry.at}`}>
                  {ACCEPTANCE_WORDS[entry.document]?.[entry.action] ?? `${entry.document}: ${entry.action}`}
                  <span className="text-slate-500">
                    {' '}
                    - version of {formatVersion(entry.version)}, on {formatDateTime(entry.at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {confirmWithdraw && (
        <ConfirmDialog
          title="Remove your school details?"
          message="Your student ID, course, year level and section are deleted from your account straight away. You can allow it again later and fill them in again."
          confirmLabel="Yes, remove them"
          onConfirm={() => setSchoolConsent(false)}
          onCancel={() => setConfirmWithdraw(false)}
        />
      )}
    </Panel>
  );
}

// One part of the panel, under its own small heading.
function Section({ title, children }) {
  return (
    <section className="border-t border-slate-100 pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-bold text-navy-900">{title}</h3>
      <div className="mt-1.5 space-y-2 text-sm text-slate-600">{children}</div>
    </section>
  );
}

// A policy version is the date it was written: '2026-10-13' -> '13 Oct 2026'.
function formatVersion(version) {
  if (!version) return 'an earlier date';
  return formatDate(`${version}T00:00:00`);
}

export default PrivacyData;
