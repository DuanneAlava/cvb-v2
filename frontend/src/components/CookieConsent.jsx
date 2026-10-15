import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useStore } from '../services/store.js';
import { COOKIE_CONSENT_VERSION } from '../data/policies.js';
import {
  HAS_TRACKING,
  OPTIONAL_CATEGORIES,
  SHOWN_CATEGORIES,
  allOptional,
  closeCookieSettings,
  openCookieSettings,
  saveChoice,
  useConsent,
} from '../services/consent.js';
import Button from './Button.jsx';
import PopupFrame, { CloseButton } from './PopupFrame.jsx';
import { Notice } from './admin/ui.jsx';

/*
 * THE COOKIE CHOICE - the banner on a first visit, and the settings window.
 *
 * Rendered once, for the whole site (App.js). It does what it says:
 *   Accept All       allows every optional category that exists
 *   Reject Optional  allows none of them, and deletes anything stored in them
 *   Customize        opens the window with a switch per optional category
 * Nothing optional is written to the device before one of these is chosen -
 * services/consent.js enforces that, and keeps the choice. The banner does
 * not come back once a choice is made, unless what the categories cover
 * changes (COOKIE_CONSENT_VERSION).
 *
 * THE SAME CHOICE ON EVERY DEVICE. A choice made while logged in is also
 * saved with the account (PUT /api/account/cookie-consent). Logging in on a
 * device that has no choice yet, or an older one, takes the account's - so a
 * person is not asked again on every computer they use. A choice is only
 * ever saved to an account by that person, signed in: on a shared computer,
 * the last visitor's choice is never copied onto the next person's account.
 *
 * THE BUTTONS ARE EQUAL. Accept and Reject are the same size and colour -
 * neither is dressed up as the "right" answer.
 */

// The account's saved choice, if it is for the current version.
function accountChoice(privacy) {
  const saved = privacy?.cookieConsent;
  return saved?.version === COOKIE_CONSENT_VERSION ? saved : null;
}

function CookieConsent() {
  const { choice, settingsOpen } = useConsent();
  const { user } = useAuth();
  const store = useStore();
  const saved = user ? accountChoice(store.db.privacy) : null;
  const [error, setError] = useState('');

  // Logging in where this device has no choice yet - or an older one than
  // the account's - takes the account's choice.
  useEffect(() => {
    if (!saved) return;
    if (!choice || saved.decidedAt > choice.decidedAt) {
      saveChoice(saved.categories, saved.decidedAt);
    }
    // `saved` is rebuilt on every refresh; its time is what changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved?.decidedAt, choice?.decidedAt]);

  async function decide(categories) {
    const made = saveChoice(categories);
    closeCookieSettings();
    if (!user) return;
    const result = await store.saveCookieConsent(made);
    // The choice already applies on this device; only the copy on the
    // account failed, so say that and nothing more.
    setError(result.error ? `Your choice applies on this device, but could not be saved to your account: ${result.error}` : '');
  }

  const showBanner = !choice && !saved && !settingsOpen;

  return (
    <>
      {showBanner && <Banner onDecide={decide} />}
      {settingsOpen && <Settings current={choice} onDecide={decide} onClose={closeCookieSettings} />}
      {error && (
        <div className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-xl sm:inset-x-6">
          <Notice className="shadow-lg">
            {error}{' '}
            <button type="button" className="font-semibold underline" onClick={() => setError('')}>
              Dismiss
            </button>
          </Notice>
        </div>
      )}
    </>
  );
}

/*
 * THE BANNER - small, at the bottom of the screen, never covering the page.
 * It does not take the focus away from the page (it is not a pop-up), but it
 * is the first thing in the page's order, so the Tab key reaches it first.
 */
function Banner({ onDecide }) {
  return (
    <section
      aria-labelledby="cookie-banner-title"
      className="fixed inset-x-3 bottom-3 z-[55] mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:inset-x-6 sm:p-5"
    >
      <h2 id="cookie-banner-title" className="text-base font-bold text-navy-900">
        Your privacy on CampusVoiceBox
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">
        We keep in your browser only what is needed to keep you signed in and to remember this
        choice. Anything optional is stored only if you allow it.{' '}
        {HAS_TRACKING ? '' : 'There is no analytics or advertising tracking. '}
        <Link to="/cookie-policy" className="font-semibold text-navy-700 underline">
          Read the Cookie Policy
        </Link>
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button type="button" variant="primary" size="sm" onClick={() => onDecide(allOptional(true))}>
          Accept All
        </Button>
        <Button type="button" variant="primary" size="sm" onClick={() => onDecide(allOptional(false))}>
          Reject Optional
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={openCookieSettings}>
          Customize Preferences
        </Button>
      </div>
    </section>
  );
}

/*
 * THE SETTINGS WINDOW - one switch per optional category, each off unless
 * the person turned it on before. Strictly necessary storage is listed, with
 * why, and cannot be switched off.
 */
function Settings({ current, onDecide, onClose }) {
  const [draft, setDraft] = useState(() => current?.categories ?? allOptional(false));

  return (
    <PopupFrame onClose={onClose} labelledBy="cookie-settings-title" className="max-h-[90vh] max-w-lg overflow-y-auto p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="cookie-settings-title" className="text-xl font-bold text-navy-900">
            Cookie settings
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Choose what CampusVoiceBox may keep in your browser. You can change this at any time.
          </p>
        </div>
        <CloseButton onClick={onClose} />
      </div>

      <ul className="mt-4 space-y-3">
        {SHOWN_CATEGORIES.map((category) => {
          const id = `cookie-category-${category.key}`;
          const on = category.optional ? draft[category.key] === true : true;
          return (
            <li key={category.key} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-3">
                <label htmlFor={id} className="min-w-0 cursor-pointer">
                  <span className="block font-semibold text-navy-900">{category.label}</span>
                  <span className="mt-0.5 block text-sm text-slate-600">{category.description}</span>
                </label>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500" aria-hidden="true">
                    {category.optional ? (on ? 'On' : 'Off') : 'Always on'}
                  </span>
                  <input
                    id={id}
                    type="checkbox"
                    checked={on}
                    disabled={!category.optional}
                    onChange={(event) => setDraft({ ...draft, [category.key]: event.target.checked })}
                    className="h-5 w-5 rounded border-slate-300 text-navy-600 focus:ring-navy-600 disabled:opacity-60"
                  />
                </span>
              </div>
              <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-xs text-slate-500">
                {category.items.map((item) => (
                  <li key={item.name}>
                    <code className="font-mono text-slate-700">{item.name}</code> - {item.purpose}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>

      {!HAS_TRACKING && (
        <p className="mt-3 text-sm text-slate-600">
          CampusVoiceBox uses no analytics or advertising cookies, and loads nothing from other
          companies, so there is nothing of that kind to switch on or off.
        </p>
      )}

      <p className="mt-3 text-sm">
        <Link to="/cookie-policy" onClick={onClose} className="font-semibold text-navy-700 underline">
          Cookie Policy
        </Link>
      </p>

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={() => onDecide(allOptional(false))}>
          Reject Optional
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => onDecide(allOptional(true))}>
          Accept All
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => onDecide(Object.fromEntries(OPTIONAL_CATEGORIES.map((key) => [key, draft[key] === true])))}
        >
          Save my choices
        </Button>
      </div>
    </PopupFrame>
  );
}

export default CookieConsent;
