import { useSyncExternalStore } from 'react';
import { COOKIE_CONSENT_VERSION } from '../data/policies.js';

/*
 * COOKIES AND BROWSER STORAGE - WHAT THE SITE KEEPS ON YOUR DEVICE, AND
 * WHETHER IT MAY.
 *
 * CampusVoiceBox sets no cookies at all. It keeps a few small items in the
 * browser's own storage (localStorage, sessionStorage), and every one of them
 * is listed in STORAGE_ITEMS below - the code that writes an item takes its
 * name from here, and the Cookie Policy's table is drawn from here
 * (pages/legal/CookiePolicy.jsx). So the policy cannot describe storage the
 * site does not use, or miss storage it does.
 *
 * WHAT CONSENT DOES
 * - "Strictly necessary" items are always allowed: without them nobody could
 *   stay signed in, or have their cookie choice remembered.
 * - Every other item belongs to an optional category, and is only ever
 *   written once the person has said yes to that category. Saying no -
 *   at first, or later - deletes what is already there (`clear`), and the
 *   code that would write it asks isAllowed() first.
 * - A category is only offered when something in it exists. There are no
 *   analytics or advertising items, so those categories are not shown; add
 *   such an item to STORAGE_ITEMS and its category appears in the cookie
 *   window and the policy by itself - and raise COOKIE_CONSENT_VERSION
 *   (data/policies.js and the backend), so everybody is asked again about
 *   what is now actually in it.
 *
 * WHAT YOU'LL MEET IN THIS FILE (plain-English notes)
 * - localStorage / sessionStorage  The browser's per-site storage. Local
 *   storage stays until it is deleted; session storage is emptied when the
 *   tab is closed. Both can be switched off, so every use is in try/catch.
 * - useSyncExternalStore  React's way of reading a value kept outside React
 *   - here, the current choice - and re-drawing when it changes.
 */

// The names of the storage items the site writes, in one place - imported by
// the code that writes them (services/api.js, services/greeting.js).
export const STORAGE_KEYS = {
  token: 'cvb_token',
  consent: 'cvb_consent',
  greetingWaved: 'cvb_greeting_waved',
};

/*
 * The kinds of storage, in the order the cookie window lists them. Only
 * `necessary` and the categories that have items are shown (SHOWN_CATEGORIES).
 */
const STORAGE_CATEGORIES = [
  {
    key: 'necessary',
    label: 'Strictly necessary',
    optional: false,
    description:
      'Needed for the site to work: keeping you signed in, and remembering the choices you make here. They cannot be switched off, because without them you could not log in.',
  },
  {
    key: 'functional',
    label: 'Functional',
    optional: true,
    description:
      'Small conveniences that are nice to have but not needed. Turning them off changes nothing important.',
  },
  {
    key: 'analytics',
    label: 'Analytics',
    optional: true,
    description: 'Measuring how the site is used.',
  },
  {
    key: 'marketing',
    label: 'Marketing',
    optional: true,
    description: 'Advertising and tracking across other websites.',
  },
];

/*
 * EVERY ITEM THE SITE STORES IN THE BROWSER. `clear` deletes an optional
 * item when its category is refused or withdrawn.
 */
export const STORAGE_ITEMS = [
  {
    name: STORAGE_KEYS.token,
    category: 'necessary',
    where: 'Local storage',
    purpose:
      'Your sign-in token: a signed code that proves to the server it is you, so you stay logged in between pages and visits.',
    duration: 'Until you log out. The token itself stops working after 7 days, or as soon as your password is changed or reset.',
  },
  {
    name: STORAGE_KEYS.consent,
    category: 'necessary',
    where: 'Local storage',
    purpose:
      'Remembers the choice you made in this cookie window - which optional categories you allowed, the version you answered, and when - so you are not asked on every visit.',
    duration: 'Until you change your choice or clear this site\'s data. You are asked again if what the categories cover changes.',
  },
  {
    name: STORAGE_KEYS.greetingWaved,
    category: 'functional',
    where: 'Session storage',
    purpose:
      'Remembers that the waving hand beside "Hi, [your name]" has already waved during this visit, so it does not wave again on every page. It holds your account number.',
    duration: 'Until you close the tab, or log out.',
    clear: () => sessionStorage.removeItem(STORAGE_KEYS.greetingWaved),
  },
];

export const SHOWN_CATEGORIES = STORAGE_CATEGORIES.filter(
  (category) => !category.optional || STORAGE_ITEMS.some((item) => item.category === category.key)
).map((category) => ({
  ...category,
  items: STORAGE_ITEMS.filter((item) => item.category === category.key),
}));

export const OPTIONAL_CATEGORIES = SHOWN_CATEGORIES.filter((category) => category.optional).map(
  (category) => category.key
);

// Whether analytics or advertising storage exists at all - the cookie window
// and the policy say plainly when it does not.
export const HAS_TRACKING = STORAGE_ITEMS.some((item) => ['analytics', 'marketing'].includes(item.category));

/* ------------------------------------------------------------------ *
 * The current choice
 * ------------------------------------------------------------------ */

/*
 * A choice as kept: { version, categories: { functional: true }, decidedAt }.
 * Anything that is not a valid choice for the CURRENT version counts as no
 * choice at all - an answer given about different storage does not stand.
 */
function asChoice(record) {
  if (!record || record.version !== COOKIE_CONSENT_VERSION || typeof record.categories !== 'object') {
    return null;
  }
  return {
    version: record.version,
    categories: Object.fromEntries(
      OPTIONAL_CATEGORIES.map((key) => [key, record.categories?.[key] === true])
    ),
    decidedAt: String(record.decidedAt ?? ''),
  };
}

function readChoice() {
  try {
    return asChoice(JSON.parse(localStorage.getItem(STORAGE_KEYS.consent)));
  } catch {
    return null;
  }
}

let snapshot = { choice: readChoice(), settingsOpen: false };
const listeners = new Set();

function publish(changes) {
  snapshot = { ...snapshot, ...changes };
  listeners.forEach((listener) => listener());
}

// May storage of this category be written? Strictly necessary always may;
// anything else only once the person has said yes to it.
export function isAllowed(category) {
  if (category === 'necessary') return true;
  return snapshot.choice?.categories?.[category] === true;
}

// Delete every optional item whose category is not allowed right now.
function removeRefused() {
  for (const item of STORAGE_ITEMS) {
    if (!item.clear || isAllowed(item.category)) continue;
    try {
      item.clear();
    } catch {
      // Storage unavailable: then there is nothing stored to remove.
    }
  }
}

// Before any choice - and after a version change - nothing optional may be
// on the device, whatever an older visit left behind.
removeRefused();

/*
 * Record a choice: `categories` says yes or no for each optional category.
 * Refused categories are cleared at once. `decidedAt` is passed when the
 * choice comes from the server (the same person's choice on another
 * device), so the record keeps the time it was really made.
 */
export function saveChoice(categories, decidedAt = new Date().toISOString()) {
  const choice = asChoice({ version: COOKIE_CONSENT_VERSION, categories, decidedAt });
  try {
    localStorage.setItem(STORAGE_KEYS.consent, JSON.stringify(choice));
  } catch {
    // Remembered for this visit only.
  }
  publish({ choice });
  removeRefused();
  return choice;
}

// Every optional category on, or every one off.
export const allOptional = (value) =>
  Object.fromEntries(OPTIONAL_CATEGORIES.map((key) => [key, value]));

/* The cookie window, opened from anywhere - the footer, the account page. */
export function openCookieSettings() {
  publish({ settingsOpen: true });
}

export function closeCookieSettings() {
  publish({ settingsOpen: false });
}

// A choice made in another tab of this site applies here too.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEYS.consent && event.key !== null) return;
    publish({ choice: readChoice() });
    removeRefused();
  });
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// { choice, settingsOpen } - `choice` is null until the person has decided.
export function useConsent() {
  return useSyncExternalStore(subscribe, () => snapshot);
}
