/*
 * A thin wrapper around fetch() for talking to the CampusVoiceBox backend.
 *
 * NOT IN USE YET. The app runs on services/store.js, which keeps everything in
 * the browser so the whole platform - student site and admin panel - starts
 * with no database and no setup. This file is the other end of that swap: the
 * endpoints below match the routes in backend/src/routes one for one, so
 * moving over means rewriting store.js's four read/write helpers to call these
 * instead. No screen changes. See GUIDE.md, "Connecting frontend to backend".
 *
 * WHY THE SWAP IS NOT OPTIONAL BEFORE DEPLOYING
 * Browser storage cannot enforce a permission. The role checks and route
 * guards on the frontend decide what gets drawn; anybody can edit their own
 * stored account and draw the admin panel. The endpoints below are checked
 * again on the server (backend/src/middleware/auth.js), where the browser gets
 * no say - that is the layer that actually protects anything.
 */

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

function authHeaders() {
  const token = localStorage.getItem('cvb_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }
  return data;
}

export const api = {
  // --- Auth ---
  register: (payload) => request('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  login: (payload) => request('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  me: () => request('/auth/me'),

  // --- Categories & posts ---
  getCategories: () => request('/categories'),
  getPosts: ({ category, search } = {}) => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (search) params.set('search', search);
    const query = params.toString();
    return request(`/posts${query ? `?${query}` : ''}`);
  },
  createPost: (payload) => request('/posts', { method: 'POST', body: JSON.stringify(payload) }),
  toggleVote: (postId) => request(`/posts/${postId}/vote`, { method: 'POST' }),

  /*
   * --- Admin ---
   * Every one of these is permission-checked on the server. Calling them
   * without the right role returns 404, not 403: an unauthorised caller does
   * not need to be told that an admin area exists and they are merely outside
   * it. Do not "handle" that by hiding the button - the check is the point.
   */
  admin: {
    stats: () => request('/admin/stats'),

    listUsers: ({ search, role, status } = {}) => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (role) params.set('role', role);
      if (status) params.set('status', status);
      const query = params.toString();
      return request(`/admin/users${query ? `?${query}` : ''}`);
    },
    getUser: (id) => request(`/admin/users/${id}`),
    setUserStatus: (id, status) =>
      request(`/admin/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    setUserRole: (id, role) =>
      request(`/admin/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
    deleteUser: (id) => request(`/admin/users/${id}`, { method: 'DELETE' }),

    listPosts: (filters = {}) => {
      const params = new URLSearchParams(
        Object.entries(filters).filter(([, value]) => value)
      );
      const query = params.toString();
      return request(`/admin/posts${query ? `?${query}` : ''}`);
    },
    setPostStatus: (id, status, extra = {}) =>
      request(`/admin/posts/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, ...extra }),
      }),
    assignConcern: (id, payload) =>
      request(`/admin/posts/${id}/assign`, { method: 'PATCH', body: JSON.stringify(payload) }),
    resolveConcern: (id, resolution) =>
      request(`/admin/posts/${id}/resolve`, {
        method: 'PATCH',
        body: JSON.stringify({ resolution }),
      }),
    addNote: (id, body) =>
      request(`/admin/posts/${id}/notes`, { method: 'POST', body: JSON.stringify({ body }) }),

    notifications: () => request('/admin/notifications'),
    markNotificationRead: (id) => request(`/admin/notifications/${id}/read`, { method: 'PATCH' }),
    activityLogs: (filters = {}) => {
      const params = new URLSearchParams(
        Object.entries(filters).filter(([, value]) => value)
      );
      const query = params.toString();
      return request(`/admin/activity-logs${query ? `?${query}` : ''}`);
    },
  },
};
