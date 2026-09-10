const express = require('express');
const authRoutes = require('./authRoutes');
const suggestionsRoutes = require('./suggestionsRoutes');
const adminRoutes = require('./adminRoutes');

const router = express.Router();

router.get('/health', (req, res) => res.json({ status: 'ok' }));
router.use('/auth', authRoutes);
router.use('/', suggestionsRoutes); // exposes /categories, /posts, /posts/:id/vote

/*
 * The admin API. Everything under /admin is authenticated and permission-
 * checked inside adminRoutes.js, one check per route - mounting it here does
 * not protect it, the checks in that file do.
 */
router.use('/admin', adminRoutes);

module.exports = router;
