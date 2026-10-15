const express = require('express');
const {
  acceptTerms,
  setSchoolConsent,
  setCookieConsent,
  exportMyData,
  createRequest,
  cancelRequest,
} = require('../controllers/privacyController');
const { requireAuth } = require('../middleware/auth');

/*
 * A signed-in person's privacy choices and rights (controllers/
 * privacyController.js). Signed in is all these need: each one acts only on
 * the account the token belongs to. A suspended account may use them too -
 * suspension turns off posting and voting, never a person's privacy rights.
 *
 * requireAuth is given route by route, as in accountRoutes.js: this router is
 * mounted at the top of /api, where a router-wide check would also stop
 * requests passing through on their way to other routes.
 */
const router = express.Router();

router.post('/account/terms', requireAuth, acceptTerms);
router.put('/account/school-consent', requireAuth, setSchoolConsent);
router.put('/account/cookie-consent', requireAuth, setCookieConsent);
router.get('/account/export', requireAuth, exportMyData);

router.post('/privacy-requests', requireAuth, createRequest);
router.post('/privacy-requests/:id/cancel', requireAuth, cancelRequest);

module.exports = router;
