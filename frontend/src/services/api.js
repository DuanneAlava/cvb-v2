/*
 * A thin wrapper around fetch() for talking to the CampusVoiceBox backend.
 *
 * The rest of the app does not use this yet - Home.jsx and AuthContext.jsx
 * still run on the built-in mock data and localStorage, which is why the
 * frontend runs on its own with zero setup. This file exists so the swap
 * to the real API is a small, contained change instead of a rewrite. See
 * GUIDE.md, "Connecting frontend to backend" for the step-by-step.
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
};
