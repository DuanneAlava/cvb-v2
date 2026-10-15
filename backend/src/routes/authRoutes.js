const express = require('express');
const { register, login, logout, forgotPassword, resetPassword } = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const { authFlood, passwordAttempts, resetRequests } = require('../middleware/rateLimit');

const router = express.Router();

// All of these sit behind the per-address backstop (middleware/rateLimit.js):
// logging in also behind the per-account limit on wrong passwords, and
// "forgot password" behind a limit on emails sent to any one address.
router.post('/register', authFlood, register);
router.post('/login', authFlood, passwordAttempts, login);
router.post('/forgot-password', authFlood, resetRequests, forgotPassword);
router.post('/reset-password', authFlood, resetPassword);
router.post('/logout', requireAuth, logout);

module.exports = router;
