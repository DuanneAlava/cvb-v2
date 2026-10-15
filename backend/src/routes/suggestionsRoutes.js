const express = require('express');
const { createPost, toggleVote, getAttachment } = require('../controllers/suggestionsController');
const { requireAuth, attachUserIfPresent, requirePermission } = require('../middleware/auth');
const { postingLimit } = require('../middleware/rateLimit');
const { requireCurrentTerms } = require('../middleware/terms');

const router = express.Router();

/*
 * Posting and voting re-check the account in the database, not just the
 * token. A token stays valid for days; requireAuth reads the account fresh,
 * so a student suspended (or deleted) after signing in is stopped at once
 * rather than when the token runs out. Every role holds both permissions, so
 * for an active account nothing changes.
 *
 * Both also need the current Terms accepted (middleware/terms.js): putting
 * something on the board is what the Terms govern.
 */
router.post('/posts', requireAuth, requirePermission('submit_posts'), requireCurrentTerms, postingLimit, createPost);
router.post('/posts/:id/vote', requireAuth, requirePermission('vote'), requireCurrentTerms, toggleVote);

// Open to visitors too: a file on a published post is as public as the post.
router.get('/attachments/:id', attachUserIfPresent, getAttachment);

module.exports = router;
