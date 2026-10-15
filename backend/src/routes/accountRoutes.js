const express = require('express');
const {
  updateAccount,
  changePassword,
  updatePhoto,
  getPhoto,
  markNotificationRead,
  markAllNotificationsRead,
} = require('../controllers/accountController');
const { requireAuth } = require('../middleware/auth');
const { currentPasswordAttempts } = require('../middleware/rateLimit');

/*
 * A signed-in person's own account and notifications. Signed in is all
 * these need - each one acts only on the account the token belongs to
 * (controllers/accountController.js) - and a suspended account may still
 * use them: suspension turns off posting and voting, not looking after your
 * own details.
 *
 * requireAuth is given route by route rather than with router.use(): this
 * router is mounted at the top of /api (routes/index.js), where a
 * router-wide check would also stop the requests that pass through it on
 * their way to other routes - a visitor reading the board included.
 */
const router = express.Router();

router.patch('/account', requireAuth, updateAccount);
router.put('/account/password', requireAuth, currentPasswordAttempts, changePassword);
router.put('/account/photo', requireAuth, updatePhoto);
router.get('/users/:id/photo', requireAuth, getPhoto);

router.patch('/notifications/:id/read', requireAuth, markNotificationRead);
router.post('/notifications/read-all', requireAuth, markAllNotificationsRead);

module.exports = router;
