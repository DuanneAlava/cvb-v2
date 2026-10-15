import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.js';
import ErrorBoundary from './components/ErrorBoundary.jsx';

/*
 * THE LOADING SCREEN, AND WHEN IT LEAVES.
 *
 * The animated logo in public/index.html is on screen before any of this
 * code has downloaded. It is faded out once the server has answered the
 * first request for the platform's records - not merely once React has
 * started - so the first screen drawn already knows who is signed in; that
 * happens in context/AuthContext.jsx. hideSplash lives in services/splash.js,
 * beside whenSplashGone, which the navbar greeting uses to hold its wave
 * until the loading screen is out of the way.
 *
 * The app sits inside ErrorBoundary (components/ErrorBoundary.jsx), so an
 * error anywhere in it shows a message instead of a blank page - and takes
 * the loading screen away too, so the message can be seen.
 */
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
