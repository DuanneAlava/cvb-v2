import { Component } from 'react';
import { hideSplash } from '../services/splash.js';

/*
 * THE SAFETY NET.
 *
 * Without this, one mistake while drawing any part of the page - a bug, or
 * saved data in an unexpected shape - makes React remove the whole app and
 * leaves a blank white screen with no way forward. This catches that error
 * and shows a short message with two ways out instead.
 *
 * It wraps the entire app (see src/index.js), so it is drawn with plain
 * markup and nothing else from the app: the navbar, the router or the logo
 * may be the very thing that failed. The links are ordinary <a> and
 * <button> elements for the same reason - a full page load starts the app
 * afresh, which is what clears the error.
 *
 * WHAT YOU'LL MEET IN THIS FILE (plain-English notes)
 *
 * - A "class component"  The older way of writing a component. Error
 *   boundaries are the one thing that still has to be written this way:
 *   React only offers the two methods below to classes.
 * - `static getDerivedStateFromError()`  React calls it when something
 *   inside has failed; what it returns becomes the new state, which switches
 *   render() over to the message.
 * - `componentDidCatch()`  Called with the error and where it happened. It
 *   writes them to the browser console, where a developer can read them,
 *   and takes the loading screen away - an error before the first screen
 *   was drawn would otherwise sit hidden underneath it.
 * - `this.props.children`  Whatever was placed inside <ErrorBoundary> - the
 *   whole app, drawn as normal while nothing has gone wrong.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error('CampusVoiceBox hit an error it could not recover from:', error, info?.componentStack);
    hideSplash();
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main
        role="alert"
        className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10 text-center"
      >
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-xl font-bold text-navy-900">Something went wrong</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            This page hit a problem and could not be shown. Nothing you have posted is lost.
            Reloading usually fixes it.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-[44px] rounded-lg bg-navy-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-navy-700 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:ring-offset-2"
            >
              Reload the page
            </button>
            <a
              href="/"
              className="grid min-h-[44px] place-items-center rounded-lg border border-navy-200 px-5 text-sm font-semibold text-navy-700 transition-colors hover:bg-navy-50 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:ring-offset-2"
            >
              Go to the board
            </a>
          </div>
        </div>
      </main>
    );
  }
}

export default ErrorBoundary;
