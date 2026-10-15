import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useStore, TERMS_REQUIRED_EVENT } from '../services/store.js';
import Button from './Button.jsx';
import PopupFrame from './PopupFrame.jsx';
import { Notice } from './admin/ui.jsx';

/*
 * "PLEASE ACCEPT THE TERMS" - for a signed-in account that has not accepted
 * the Terms version it now needs.
 *
 * Who sees it: an account made before the Terms existed, or everybody once
 * the Terms change in a way that needs accepting again (the server decides,
 * with TERMS_REQUIRED_VERSION in backend/src/models/policies.js, and says so
 * in `privacy.mustAcceptTerms`). Nobody is asked at every log-in - only when
 * that is true.
 *
 * Until they accept, the SERVER refuses their posts and votes
 * (backend/src/middleware/terms.js). Reading is never held back, so the
 * dialog can be put off with "Not now"; it comes back on the next visit, or
 * as soon as they try to post or vote (TERMS_REQUIRED_EVENT, sent by
 * services/store.js).
 *
 * School details kept from before consent was asked: a second, separate,
 * unticked choice. Accepting the Terms never implies it - leaving it
 * unticked removes the details, because without consent there is nothing to
 * keep them on.
 *
 * Not drawn on the policy pages themselves, so the Terms can be read in full
 * from the link inside it.
 */
const POLICY_PATHS = ['/privacy-policy', '/terms-and-conditions', '/cookie-policy'];

function TermsGate() {
  const { user } = useAuth();
  const store = useStore();
  const location = useLocation();
  const privacy = store.db.privacy;

  const [putOff, setPutOff] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [keepSchool, setKeepSchool] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Trying to post or vote while it is put off brings it back.
  useEffect(() => {
    const bringBack = () => setPutOff(false);
    window.addEventListener(TERMS_REQUIRED_EVENT, bringBack);
    return () => window.removeEventListener(TERMS_REQUIRED_EVENT, bringBack);
  }, []);

  if (!user || !privacy?.mustAcceptTerms || putOff || POLICY_PATHS.includes(location.pathname)) {
    return null;
  }

  const firstTime = !privacy.acceptedTermsVersion;
  const askAboutSchool = privacy.hasSchoolDetails && !privacy.schoolConsent;

  async function handleAccept() {
    if (!accepted) {
      setError('Tick the box to accept the Terms & Conditions, or choose "Not now".');
      return;
    }
    setBusy(true);
    const result = await store.acceptTerms(askAboutSchool && keepSchool);
    setBusy(false);
    if (result.error) setError(result.error);
  }

  return (
    <PopupFrame onClose={() => setPutOff(true)} labelledBy="terms-gate-title" className="max-h-[90vh] max-w-lg overflow-y-auto p-5 sm:p-6">
      <h2 id="terms-gate-title" className="text-xl font-bold text-navy-900">
        {firstTime ? 'Please accept the Terms & Conditions' : 'The Terms & Conditions have changed'}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        {firstTime
          ? 'CampusVoiceBox now has Terms & Conditions. Please read and accept them before you post or vote again. You can keep reading the board either way.'
          : 'Please read the new version and accept it before you post or vote again. You can keep reading the board either way.'}
      </p>
      <p className="mt-2 text-sm">
        <Link to="/terms-and-conditions" className="font-semibold text-navy-700 underline">
          Read the Terms & Conditions
        </Link>{' '}
        ·{' '}
        <Link to="/privacy-policy" className="font-semibold text-navy-700 underline">
          Privacy Policy
        </Link>
      </p>

      <label htmlFor="terms-gate-accept" className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <input
          id="terms-gate-accept"
          type="checkbox"
          checked={accepted}
          onChange={(event) => {
            setAccepted(event.target.checked);
            setError('');
          }}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-navy-600 focus:ring-navy-600"
        />
        <span className="text-sm font-semibold text-navy-900">
          I have read and accept the Terms & Conditions.
        </span>
      </label>

      {askAboutSchool && (
        <label htmlFor="terms-gate-school" className="mt-3 flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3">
          <input
            id="terms-gate-school"
            type="checkbox"
            checked={keepSchool}
            onChange={(event) => setKeepSchool(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-navy-600 focus:ring-navy-600"
          />
          <span className="text-sm">
            <span className="font-semibold text-navy-900">
              Optional: keep my school details on my account
            </span>
            <span className="mt-0.5 block text-xs text-slate-500">
              Your student ID, course, year level and section, so staff can follow up your concerns.
              If you leave this unticked, they are removed from your account when you accept. You can
              change this later under Privacy & Data on your account page.
            </span>
          </span>
        </label>
      )}

      {error && <Notice className="mt-3">{error}</Notice>}

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={() => setPutOff(true)}>
          Not now
        </Button>
        <Button type="button" variant="primary" size="sm" onClick={handleAccept} disabled={busy}>
          {busy ? 'Saving…' : 'Accept and continue'}
        </Button>
      </div>
    </PopupFrame>
  );
}

export default TermsGate;
