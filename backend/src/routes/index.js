const express = require('express');
const authRoutes = require('./authRoutes');
const suggestionsRoutes = require('./suggestionsRoutes');
const accountRoutes = require('./accountRoutes');
const privacyRoutes = require('./privacyRoutes');
const adminRoutes = require('./admin');
const { getState } = require('../controllers/stateController');
const { attachUserIfPresent } = require('../middleware/auth');

const router = express.Router();

router.get('/health', (req, res) => res.json({ status: 'ok' }));

// Everything the person asking may see - visitors included.
router.get('/state', attachUserIfPresent, getState);

router.use('/auth', authRoutes);
router.use('/', suggestionsRoutes); // /posts, /posts/:id/vote, /attachments/:id
router.use('/', accountRoutes); // /account, /account/photo, /users/:id/photo, /notifications
router.use('/', privacyRoutes); // /account/terms, consents, /account/export, /privacy-requests

/*
 * The admin API. Everything under /admin is authenticated and permission-
 * checked inside routes/admin/, one check per route - mounting it here does
 * not protect it, the checks in those files do.
 */
router.use('/admin', adminRoutes);

module.exports = router;
