const express = require('express');
const authRoutes = require('./authRoutes');
const suggestionsRoutes = require('./suggestionsRoutes');

const router = express.Router();

router.get('/health', (req, res) => res.json({ status: 'ok' }));
router.use('/auth', authRoutes);
router.use('/', suggestionsRoutes); // exposes /categories, /posts, /posts/:id/vote

module.exports = router;
