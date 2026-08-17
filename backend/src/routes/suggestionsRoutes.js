const express = require('express');
const {
  listCategories,
  listPosts,
  createPost,
  toggleVote,
} = require('../controllers/suggestionsController');
const { requireAuth, attachUserIfPresent } = require('../middleware/auth');

const router = express.Router();

router.get('/categories', listCategories);
router.get('/posts', attachUserIfPresent, listPosts);
router.post('/posts', requireAuth, createPost);
router.post('/posts/:id/vote', requireAuth, toggleVote);

module.exports = router;
