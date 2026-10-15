/*
 * HOW LONG A POST'S TITLE AND MESSAGE MAY BE.
 *
 * The shortest title and message the posting form accepts, so posts are not
 * one-word entries, and the longest (components/PostModal.jsx). The server
 * holds the same limits (backend/src/controllers/suggestionsController.js),
 * and so does the posts table (backend/src/models/schema.sql) -
 * scripts/check-shared-lists.mjs checks all three still agree.
 *
 * They live in a file of their own, rather than at the top of PostModal.jsx
 * where they started, so that check can load them: it runs in plain Node,
 * which cannot read a .jsx file.
 */
export const MIN_TITLE = 5;
export const MAX_TITLE = 80;
export const MIN_MESSAGE = 10;
export const MAX_MESSAGE = 5000;
