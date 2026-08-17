/*
 * Starter content for the suggestion board.
 *
 * These are sample posts so the landing page is not empty the first time it
 * loads. When a real backend exists, this file is replaced by a fetch call.
 *
 * - `type` is either 'suggestion' (a proposed fix) or 'voice' (a quick concern)
 * - `category` matches a slug from data/categories.js
 * - `votes` is how many students have backed the post
 */
export const SEED_SUGGESTIONS = [
  {
    id: 1,
    type: 'suggestion',
    category: 'facilities',
    author: 'Anonymous student',
    message: 'The library needs more power outlets near the study tables.',
    votes: 42,
    createdAt: '2026-08-10',
  },
  {
    id: 2,
    type: 'voice',
    category: 'food-canteen',
    author: 'Anonymous student',
    message: 'Canteen queues at lunch are so long that we miss the start of class.',
    votes: 31,
    createdAt: '2026-08-10',
  },
  {
    id: 3,
    type: 'suggestion',
    category: 'safety',
    author: 'Anonymous student',
    message: 'The back gate walkway has no lighting. It is not safe after evening classes.',
    votes: 58,
    createdAt: '2026-08-09',
  },
  {
    id: 4,
    type: 'suggestion',
    category: 'academics',
    author: 'Anonymous student',
    message: 'Please open more evening slots for the computer laboratory.',
    votes: 24,
    createdAt: '2026-08-08',
  },
  {
    id: 5,
    type: 'voice',
    category: 'organizations',
    author: 'Anonymous student',
    message: 'Club sign-up week clashes with midterms every single semester.',
    votes: 17,
    createdAt: '2026-08-07',
  },
  {
    id: 6,
    type: 'suggestion',
    category: 'school-environment',
    author: 'Anonymous student',
    message: 'We need more covered waiting areas and bins around the quadrangle.',
    votes: 12,
    createdAt: '2026-08-06',
  },
];
