/*
 * THE LOADING SCREEN'S EXIT, AND WHO NEEDS TO KNOW ABOUT IT.
 *
 * The animated logo in public/index.html covers the page while the app
 * downloads and fetches its first records. Three things care about when it
 * leaves:
 *
 *   context/AuthContext.jsx      asks it to leave once the server has answered
 *   components/ErrorBoundary.jsx asks it to leave if something fails first
 *   components/NavGreeting.jsx   waits for it to leave before the hand waves -
 *                                otherwise the wave would play underneath the
 *                                loading screen, unseen
 *
 * They meet here so the two sides of that conversation cannot drift apart.
 */

/*
 * The least time the loading screen stays up, counted from the moment the
 * page started loading. When the app is already cached it can be ready in a
 * tenth of a second, and a loading screen that appears and vanishes that
 * fast reads as a flicker. On a slow connection the app takes longer than
 * this anyway, and the screen leaves as soon as it is ready - nobody is kept
 * waiting for the sake of the animation.
 */
const SPLASH_MIN_MS = 700;

// The browser event fired the moment the loading screen starts to fade.
const SPLASH_HIDDEN_EVENT = 'cvb:splash-hidden';

// Is the loading screen gone, or already on its way out?
function splashIsGone() {
  const splash = document.getElementById('splash');
  return !splash || splash.classList.contains('splash-hidden');
}

export function hideSplash() {
  const splash = document.getElementById('splash');

  // In development React deliberately runs effects twice to catch bugs, so
  // this can be called twice. The `hiding` flag makes the second call a
  // no-op instead of starting a second fade.
  if (!splash || splash.dataset.hiding) return;
  splash.dataset.hiding = 'true';

  // performance.now() is milliseconds since the page started loading.
  const wait = Math.max(0, SPLASH_MIN_MS - performance.now());

  setTimeout(() => {
    splash.classList.add('splash-hidden'); // starts the 0.35s fade in index.html
    window.dispatchEvent(new Event(SPLASH_HIDDEN_EVENT));

    splash.addEventListener('transitionend', () => splash.remove(), { once: true });
    // With reduced motion there is no fade, so `transitionend` never fires;
    // this removes it anyway. Removing an element twice is harmless.
    setTimeout(() => splash.remove(), 500);
  }, wait);
}

/*
 * Run `callback` once the loading screen is out of the way - straight away
 * if it already is. Returns a function that cancels the wait, which is what
 * a React effect hands back as its cleanup.
 */
export function whenSplashGone(callback) {
  if (splashIsGone()) {
    callback();
    return () => {};
  }

  window.addEventListener(SPLASH_HIDDEN_EVENT, callback, { once: true });
  return () => window.removeEventListener(SPLASH_HIDDEN_EVENT, callback);
}
