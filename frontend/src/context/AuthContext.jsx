import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useStore, useConnection, findUser } from '../services/store.js';
import { PERMISSIONS, can as roleCan, homeFor } from '../data/roles.js';
import { forgetWave } from '../services/greeting.js';
import { hideSplash } from '../services/splash.js';
import ServerUnavailable from '../components/ServerUnavailable.jsx';

/*
 * ONE ACCOUNT SYSTEM FOR THE WHOLE PLATFORM.
 *
 * There is no separate admin login. A person signs in once, at /login, and the
 * `role` on their account decides where they land and what they may do:
 *
 *     LOGIN
 *       |
 *     check email + password  (on the server)
 *       |
 *     read the account's role
 *       |
 *       +-- admin     --> /admin/dashboard
 *       +-- student   --> /            (the board)
 *       +-- user      --> /            (the board)
 *       +-- no match  --> stay on /login with an error
 *
 * Building it this way is what keeps the two halves of the site synchronised.
 * A second, separate admin login would mean a second list of accounts, and the
 * moment those two lists disagree the admin panel stops describing reality.
 *
 * WHO IS SIGNED IN is whatever the server says: the copy of the records in
 * services/store.js carries the signed-in account (`viewerId`) along with
 * everything else, re-read every few seconds. So an admin suspending
 * somebody, changing their role or resetting their password takes effect for
 * that person straight away, without them signing out and back in.
 *
 * WHAT YOU'LL MEET IN THIS FILE (plain-English notes)
 *
 * - React "context"  A way to make a value available to every component
 *   underneath a certain point in the tree, without passing it down by hand
 *   through each one as a prop. createContext() makes the slot; the
 *   <AuthContext.Provider value={...}> element fills it for everything inside
 *   it; useContext() reads it from any descendant. Here the value is "who is
 *   signed in, and what may they do".
 * - AuthProvider  The component that wraps the whole app (see App.js) and
 *   owns the signed-in state.
 * - useAuth()  A custom hook - a small function starting with `use` - that
 *   wraps useContext so a screen can write `const { user, can } = useAuth()`.
 * - useMemo  Keep a value the same between re-draws unless its inputs
 *   change, so components that receive it do not think something changed
 *   when nothing did.
 */

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const store = useStore();
  const connection = useConnection();

  const user = useMemo(() => findUser(store.db, store.db.viewerId), [store.db]);

  /*
   * Whether the last person here signed out ON PURPOSE. The route guards
   * read it: a page that needs an account sends somebody who just pressed
   * "Log out" to the board, but somebody whose session ended by itself (a
   * password reset, an expired sign-in) to the log-in page, with a note of
   * where they were.
   */
  const [signedOut, setSignedOut] = useState(false);

  /*
   * THE LOADING SCREEN stays up until the server has answered once, so the
   * first thing drawn already knows who is signed in. Without that wait,
   * reloading an admin page would flash the log-in page - the guards would
   * see "nobody" for the moment before the answer arrived.
   */
  useEffect(() => {
    if (connection !== 'loading') hideSplash();
  }, [connection]);

  const value = useMemo(() => {
    /*
     * Signing up and logging in answer `{ error }` when they fail and `{}`
     * when they work. Nothing needs sending anywhere afterwards: once `user` is
     * set, the /login and /signup routes forward the person to where they
     * belong (RedirectIfSignedIn in components/RequireAuth.jsx).
     */
    async function startSession(attempt) {
      const result = await attempt;
      if (!result.error) setSignedOut(false);
      return result;
    }

    return {
      user,
      signedOut,

      signup: (details) => startSession(store.register(details)),
      login: (credentials) => startSession(store.authenticate(credentials)),

      // No redirect needed afterwards either: the guards send somebody who
      // signed out on purpose to the board (see `signedOut` above).
      logout: async () => {
        setSignedOut(true);
        // So the navbar greeting waves at whoever signs in next on this tab.
        forgetWave();
        await store.signOut();
      },

      // The one question every guard and every button asks.
      can: (permission) => roleCan(user, permission),

      // Where this account belongs, used after logging in and by the guards.
      home: homeFor(user),
    };
    // The store's actions never change; `user` and `signedOut` are what do.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, signedOut]);

  if (connection === 'loading') return null;
  if (connection === 'unreachable') return <ServerUnavailable />;

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// A short helper so components can write `const { user, can } = useAuth()`.
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.');
  return context;
}

export { PERMISSIONS };
