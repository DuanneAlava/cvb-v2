import { createContext, useContext, useEffect, useMemo, useState } from 'react';

/*
 * AuthContext holds the "who is logged in" state for the whole app.
 *
 * IMPORTANT - this is a front-end only demo account system. Accounts are kept in
 * the browser's localStorage, which means passwords are readable by anyone with
 * access to this browser. Before this app goes live, sign-up and log-in must be
 * moved to a real server that hashes passwords. Do not reuse a real password here.
 */

// The two localStorage keys we read and write.
const USERS_KEY = 'cvb_users'; // the list of every account created on this browser
const SESSION_KEY = 'cvb_session'; // the email of the account currently logged in

// Create the context object that components will read from.
const AuthContext = createContext(null);

// Read the saved account list out of localStorage and turn it back into an array.
function readUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY)) || [];
  } catch {
    // If the stored value is damaged, start again with an empty list.
    return [];
  }
}

// Save the account list back into localStorage as text.
function writeUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

// Turn "Juan Dela Cruz" into "JD" so we can show initials in the profile circle.
function initialsOf(fullName) {
  return fullName
    .trim()
    .split(/\s+/) // split the name on spaces
    .slice(0, 2) // keep at most the first two words
    .map((word) => word[0].toUpperCase()) // take the first letter of each
    .join('');
}

export function AuthProvider({ children }) {
  // The currently logged-in user, or null when nobody is logged in.
  const [user, setUser] = useState(null);

  // When the app first loads, check whether a session was left behind
  // from last time so the user stays logged in after a page refresh.
  useEffect(() => {
    const savedEmail = localStorage.getItem(SESSION_KEY);
    if (!savedEmail) return;

    const match = readUsers().find((account) => account.email === savedEmail);
    if (match) {
      setUser({ name: match.name, email: match.email, initials: initialsOf(match.name) });
    }
  }, []);

  // Create a new account. Returns an error message string, or null when it worked.
  function signup({ name, email, password }) {
    const users = readUsers();

    // Refuse to create a second account with the same email address.
    const alreadyExists = users.some(
      (account) => account.email.toLowerCase() === email.toLowerCase()
    );
    if (alreadyExists) return 'An account with that school email already exists.';

    // Add the new account to the list and save it.
    const newUser = { name, email, password };
    writeUsers([...users, newUser]);

    // Log the new user in straight away.
    localStorage.setItem(SESSION_KEY, email);
    setUser({ name, email, initials: initialsOf(name) });
    return null;
  }

  // Log an existing user in. Returns an error message string, or null when it worked.
  function login({ email, password }) {
    const match = readUsers().find(
      (account) => account.email.toLowerCase() === email.toLowerCase()
    );

    // Deliberately vague message so we never reveal which accounts exist.
    if (!match || match.password !== password) {
      return 'That email and password do not match an account.';
    }

    localStorage.setItem(SESSION_KEY, match.email);
    setUser({ name: match.name, email: match.email, initials: initialsOf(match.name) });
    return null;
  }

  // Log the current user out and forget the saved session.
  function logout() {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  }

  // useMemo stops this object being rebuilt on every render, which would
  // needlessly re-render every component that reads the context.
  const value = useMemo(() => ({ user, signup, login, logout }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// A short helper so components can write `const { user } = useAuth()`.
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.');
  return context;
}
