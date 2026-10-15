/*
 * TALKING TO THE CAMPUSVOICEBOX SERVER - every request the website makes
 * goes through this file. The routes it calls are in backend/src/routes.
 *
 * Nothing here decides who may do what. The server checks the signed-in
 * account again on every request (backend/src/middleware/auth.js), and
 * whatever the browser believes, the server's answer is the one that counts.
 *
 * WHERE THE SERVER IS
 * REACT_APP_API_URL, if it was set when the site was built. Otherwise, in a
 * production build, "/api" on the same address as the website - the usual
 * arrangement behind one web server - and while developing, the backend's
 * own port on this computer. See GUIDE.md, "Connecting frontend to backend".
 *
 * WHAT YOU'LL MEET IN THIS FILE (plain-English notes)
 *
 * - fetch()  The browser's way of sending a request and waiting for the
 *   answer. `await` pauses until it arrives.
 * - The token  A signed string the server hands out when somebody logs in.
 *   It is kept in localStorage under "cvb_token" and sent back with every
 *   request in an "Authorization: Bearer ..." header - that is how the
 *   server knows who is asking. Logging out deletes it.
 * - JSON  The text format requests and answers are written in.
 * - A Blob  A file's contents held in the browser. fileUrl() fetches a
 *   photo or PDF and turns it into a "blob:" address an <img> or a link can
 *   use - an <img src> on its own cannot send the token.
 */

import { STORAGE_KEYS } from './consent.js';

const API_URL =
  process.env.REACT_APP_API_URL ||
  (process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:4000/api');

// Strictly necessary storage - listed, with every other item the site keeps
// in the browser, in services/consent.js.
const TOKEN_KEY = STORAGE_KEYS.token;

// localStorage can be switched off (some private-browsing modes), so every
// use of it is allowed to fail: then nobody stays signed in across a reload.
export function readToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function writeToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Signed in for this visit only.
  }
  // A different person, or nobody: what the last one could see goes.
  forgetFiles();
}

// Whether a storage event from another tab is about the token.
export function isTokenKey(key) {
  return key === TOKEN_KEY;
}

/*
 * An error the server answered with, carrying its HTTP status and whatever
 * else it sent - a refused sign-up also says which `field` it is about.
 */
class ApiError extends Error {
  constructor(message, status = 0, data = {}) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

const OFFLINE = 'Could not reach the server. Check your connection and try again.';

async function send(path, { method = 'GET', body, token = readToken() } = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(OFFLINE);
  }
  return response;
}

// Send a request and read its JSON answer (null for "204 No Content").
async function request(path, options) {
  const response = await send(path, options);
  const data = response.status === 204 ? null : await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(
      data?.error || `The server could not do that (error ${response.status}).`,
      response.status,
      data ?? {}
    );
  }
  return data;
}

/*
 * STORED PHOTOS AND PDFS, as "blob:" addresses - see the note at the top.
 *
 * Each file is fetched once and kept: a file's contents never change (a new
 * profile photo gets a new address), so the second card showing the same
 * photo, or the same card drawn again, costs nothing. `files` holds the
 * request for each address and `ready` the finished blob: address, so a
 * screen can draw a file it already has without a moment's blank first.
 */
const files = new Map(); // address -> the request for it
const ready = new Map(); // address -> its blob: address, once loaded

export function fileUrl(path) {
  if (!files.has(path)) {
    const loading = send(path).then(async (response) => {
      if (!response.ok) throw new ApiError('That file could not be loaded.', response.status);
      const url = URL.createObjectURL(await response.blob());
      if (files.get(path) === loading) ready.set(path, url);
      return url;
    });
    // A failure is not kept, so the next screen to want it tries again.
    loading.catch(() => {
      if (files.get(path) === loading) files.delete(path);
    });
    files.set(path, loading);
  }
  return files.get(path);
}

export function loadedFileUrl(path) {
  return ready.get(path) ?? null;
}

/*
 * Start again with no files - called when the signed-in account changes,
 * here and in other tabs (services/store.js), so the next person's screens
 * fetch every file with their own token. The blob: addresses already handed
 * out are left working: a picture still on screen at that moment must not
 * turn into a broken image.
 */
export function forgetFiles() {
  ready.clear();
  files.clear();
}

/*
 * A file the server builds for the signed-in person - their data export -
 * as { blob, filename }, taking the file name the server gave it, or
 * `fallbackName` if the browser did not let this page read it.
 */
async function download(path, fallbackName) {
  const response = await send(path);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(data.error || 'That file could not be downloaded.', response.status, data);
  }
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? fallbackName;
  return { blob: await response.blob(), filename };
}

const post = (path, body) => request(path, { method: 'POST', body: body ?? {} });
const patch = (path, body) => request(path, { method: 'PATCH', body });
const put = (path, body) => request(path, { method: 'PUT', body });

export const api = {
  // Everything the signed-in person (or a visitor) may see - one request.
  state: () => request('/state'),

  // --- Accounts ---
  register: (details) => post('/auth/register', details),
  login: (credentials) => post('/auth/login', credentials),
  // The token is passed in, because the browser forgets it at the same moment.
  logout: (token) => request('/auth/logout', { method: 'POST', body: {}, token }),
  // A forgotten password: the emailed link, asked for and then used.
  forgotPassword: (email) => post('/auth/forgot-password', { email }),
  resetPassword: (token, newPassword) => post('/auth/reset-password', { token, newPassword }),
  // A password you know, changed while signed in. Answers a new token.
  changeOwnPassword: (currentPassword, newPassword) =>
    put('/account/password', { currentPassword, newPassword }),
  updateAccount: (fields) => patch('/account', fields),
  updatePhoto: (photo) => put('/account/photo', { photo }),

  // --- Posts ---
  createPost: (fields) => post('/posts', fields),
  toggleVote: (postId) => post(`/posts/${postId}/vote`),

  // --- Notifications ---
  markNotificationRead: (id) => patch(`/notifications/${id}/read`, {}),
  markAllNotificationsRead: () => post('/notifications/read-all'),

  // --- Privacy: the person's own choices and rights ---
  acceptTerms: (version, keepSchoolDetails) =>
    post('/account/terms', { version, keepSchoolDetails }),
  setSchoolConsent: (granted, version) => put('/account/school-consent', { granted, version }),
  setCookieConsent: ({ version, categories }) =>
    put('/account/cookie-consent', { version, categories }),
  exportMyData: () => download('/account/export', 'campusvoicebox-my-data.json'),
  createPrivacyRequest: (type, details) => post('/privacy-requests', { type, details }),
  cancelPrivacyRequest: (id) => post(`/privacy-requests/${id}/cancel`),

  /*
   * --- Admin ---
   * Every one of these is permission-checked on the server. Calling them
   * without the right role returns 404, not 403: an unauthorised caller does
   * not need to be told that an admin area exists and they are merely outside
   * it. Do not "handle" that by hiding the button - the check is the point.
   */
  admin: {
    updateUser: (id, fields) => patch(`/admin/users/${id}`, fields),
    setUserStatus: (id, status) => patch(`/admin/users/${id}/status`, { status }),
    setUserRole: (id, role) => patch(`/admin/users/${id}/role`, { role }),
    deleteUser: (id) => request(`/admin/users/${id}`, { method: 'DELETE' }),

    setPostStatus: (id, status, reason) => patch(`/admin/posts/${id}/status`, { status, reason }),
    assign: (id, department, assignedTo) =>
      patch(`/admin/posts/${id}/assign`, { department, assignedTo }),
    resolve: (id, resolution) => patch(`/admin/posts/${id}/resolve`, { resolution }),
    addNote: (id, text) => post(`/admin/posts/${id}/notes`, { text }),

    // The whole activity log, for the export (the screens show the latest 500).
    activityLog: () => request('/admin/activity-logs'),

    // Start, complete or decline a privacy request (manage_privacy).
    updatePrivacyRequest: (id, changes) => patch(`/admin/privacy-requests/${id}`, changes),
  },
};
