/*
 * Starter content for the suggestion board.
 *
 * These are sample posts so the board is not empty the first time it loads.
 * They are written into the browser's storage once, on the very first visit,
 * and after that the saved board is what the page reads (see
 * services/store.js).
 *
 * - `title`    the short headline shown at the top of the card
 * - `type`     either 'suggestion' (a proposed fix) or 'voice' (a quick concern)
 * - `category` matches a slug from data/categories.js
 *
 * Note there is no `votes` field here on purpose. Vote counts are never stored
 * on the post itself - they are counted from the vote records in store.js,
 * which is what keeps every post starting from a clean zero.
 */
export const SEED_SUGGESTIONS = [
  {
    id: 'seed-1',
    type: 'suggestion',
    category: 'facilities',
    title: 'More power outlets in the library',
    message: 'The library needs more power outlets near the study tables.',
    author: 'Anonymous student',
    attachments: [],
    createdAt: '2026-08-10',
  },
  {
    id: 'seed-2',
    type: 'voice',
    category: 'lounge-area',
    title: 'Lunch queues run into class time',
    message: 'Queues in the lounge area at lunch are so long that we miss the start of class.',
    author: 'Anonymous student',
    attachments: [],
    createdAt: '2026-08-10',
  },
  {
    id: 'seed-3',
    type: 'suggestion',
    category: 'safety',
    title: 'No lighting on the back gate walkway',
    message: 'The back gate walkway has no lighting. It is not safe after evening classes.',
    author: 'Anonymous student',
    attachments: [],
    createdAt: '2026-08-09',
  },
  {
    id: 'seed-4',
    type: 'suggestion',
    category: 'academics',
    title: 'Open more evening laboratory slots',
    message: 'Please open more evening slots for the computer laboratory.',
    author: 'Anonymous student',
    attachments: [],
    createdAt: '2026-08-08',
  },
  {
    id: 'seed-5',
    type: 'voice',
    category: 'organization',
    title: 'Club sign-up week clashes with midterms',
    message: 'Club sign-up week clashes with midterms every single semester.',
    author: 'Anonymous student',
    attachments: [],
    createdAt: '2026-08-07',
  },
  {
    id: 'seed-6',
    type: 'suggestion',
    category: 'school-environment',
    title: 'Covered waiting areas for the quadrangle',
    message: 'We need more covered waiting areas and bins around the quadrangle.',
    author: 'Anonymous student',
    attachments: [],
    createdAt: '2026-08-06',
  },
];
