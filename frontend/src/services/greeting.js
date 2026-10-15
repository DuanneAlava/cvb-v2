import { STORAGE_KEYS, isAllowed } from './consent.js';

/*
 * HAS THE NAVBAR GREETING'S HAND WAVED YET THIS VISIT?
 *
 * "Hi, Juan [hand]" (components/NavGreeting.jsx) waves once - the first time
 * it appears in a visit - and then stays still. Changing page rebuilds the
 * navbar, which would otherwise set it waving again every time, so whether
 * it has waved is remembered here.
 *
 * WHERE IT IS REMEMBERED depends on the person's cookie choice
 * (services/consent.js). Keeping it in sessionStorage - the browser's
 * per-tab scratch space, emptied when the tab is closed - is optional
 * "functional" storage, so it is only used once they have allowed that:
 * then a reload does not wave again. Otherwise it is remembered in memory
 * only, which nothing outside this page can see: the hand waves once per
 * page load instead of once per visit, and nothing is stored on the device.
 *
 * Every read and write is wrapped in try/catch: some browsers in private
 * mode refuse storage outright, and a wave is never worth an error.
 */

const WAVED_KEY = STORAGE_KEYS.greetingWaved;

// The account the hand has waved at during this page load, when storing it
// on the device is not allowed.
let wavedInMemory = null;

/*
 * Should the hand wave now? Answers true once per account per visit, and
 * records that it has - so it must only be called at the moment the wave is
 * about to start.
 */
export function takeWave(userId) {
  if (!isAllowed('functional')) {
    if (wavedInMemory === userId) return false;
    wavedInMemory = userId;
    return true;
  }

  try {
    if (sessionStorage.getItem(WAVED_KEY) === userId) return false;
    sessionStorage.setItem(WAVED_KEY, userId);
  } catch {
    // Storage unavailable: wave anyway, it just cannot be remembered.
  }
  return true;
}

// Called on log out, so whoever signs in next on this tab is waved at.
export function forgetWave() {
  wavedInMemory = null;
  try {
    sessionStorage.removeItem(WAVED_KEY);
  } catch {
    // Nothing to tidy up if storage is unavailable.
  }
}
