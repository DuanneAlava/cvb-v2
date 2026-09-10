import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useStore, readSessionId, writeSessionId, initialsOf } from '../services/store.js';
import { PERMISSIONS, can as roleCan, homeFor } from '../data/roles.js';

/*
 * ONE ACCOUNT SYSTEM FOR THE WHOLE PLATFORM.
 *
 * There is no separate admin login. A person signs in once, at /login, and the
 * `role` on their account decides where they land and what they may do:
 *
 *     LOGIN
 *       |
 *     check email + password
 *       |
 *     read the account's role
 *       |
 *       +-- super_admin --> /admin/dashboard
 *       +-- admin       --> /admin/dashboard
 *       +-- student     --> /student/dashboard
 *       +-- user        --> /student/dashboard
 *       +-- no match    --> stay on /login with an error
 *
 * Building it this way is what keeps the two halves of the site synchronised.
 * A second, separate admin login would mean a second list of accounts, and the
 * moment those two lists disagree the admin panel stops describing reality.
 *
 * The account record itself lives in services/store.js alongside the posts, so
 * "who wrote this" is a real link between two records rather than a name
 * copied onto a post.
 */

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  /*
   * Only the id of the signed-in account is held here. The account itself is
   * looked up from the store on every render, so an admin editing somebody's
   * role or suspending them takes effect for that person immediately, without
   * them having to sign out and back in.
   */
  const [sessionId, setSessionId] = useState(readSessionId);

  // `null` as the actor: nobody is performing these actions until they are
  // signed in, and logging in records itself explicitly.
  const store = useStore(null);

  const user = useMemo(() => {
    const found = store.db.users.find((candidate) => candidate.id === sessionId);
    if (!found) return null;

    // Never let the password out of the store and into the rest of the app.
    const { password, ...safe } = found;
    return { ...safe, initials: initialsOf(found.name) };
  }, [store.db.users, sessionId]);

  /*
   * Both of these return { error } when they fail and { user, home } when they
   * work. `home` matters: the page that called them has to redirect straight
   * away, and the `user` in this context will not have updated until the next
   * render, so the destination is handed back rather than read afterwards.
   */
  function startSession(account) {
    writeSessionId(account.id);
    setSessionId(account.id);
    store.recordLogin(account);
    return { user: account, home: homeFor(account) };
  }

  const signup = useCallback(
    (details) => {
      const result = store.register(details);
      if (result.error) return { error: result.error };
      return startSession(result.user);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store]
  );

  const login = useCallback(
    (credentials) => {
      const result = store.authenticate(credentials);
      if (result.error) return { error: result.error };
      return startSession(result.user);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store]
  );

  const logout = useCallback(() => {
    if (user) store.recordLogout(user);
    writeSessionId(null);
    setSessionId(null);
  }, [store, user]);

  const value = useMemo(
    () => ({
      user,
      signup,
      login,
      logout,

      // The one question every guard and every button asks.
      can: (permission) => roleCan(user, permission),

      // Where this account belongs, used after logging in and by the guards.
      home: homeFor(user),
    }),
    [user, signup, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// A short helper so components can write `const { user, can } = useAuth()`.
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.');
  return context;
}

export { PERMISSIONS };
