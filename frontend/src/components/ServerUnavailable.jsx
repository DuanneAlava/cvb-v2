import { useState } from 'react';
import { retryConnection } from '../services/store.js';

/*
 * SHOWN WHEN THE SERVER CANNOT BE REACHED AT ALL - when the very first
 * request for the platform's records failed, so there is nothing to show
 * and nobody known to be signed in. (Once something has loaded, a failed
 * refresh just keeps the last copy on screen; see services/store.js.)
 *
 * Drawn with plain markup, like the error page (components/ErrorBoundary.jsx)
 * whose look it shares, because it is drawn outside the router and the
 * signed-in state - neither exists yet.
 */
function ServerUnavailable() {
  const [trying, setTrying] = useState(false);

  async function tryAgain() {
    setTrying(true);
    // On success the app replaces this screen by itself.
    await retryConnection();
    setTrying(false);
  }

  return (
    <main
      role="alert"
      className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10 text-center"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-xl font-bold text-navy-900">Cannot reach CampusVoiceBox</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          The server is not answering right now. Check your internet connection, then try again
          in a moment.
        </p>
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={tryAgain}
            disabled={trying}
            className="min-h-[44px] rounded-lg bg-navy-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-navy-700 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:ring-offset-2 disabled:opacity-60"
          >
            {trying ? 'Trying…' : 'Try again'}
          </button>
        </div>
      </div>
    </main>
  );
}

export default ServerUnavailable;
