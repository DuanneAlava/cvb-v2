const pool = require('../config/db');
const { latestTermsVersion, mustAcceptTerms } = require('../models/policies');

/*
 * Has this account accepted the Terms it now needs to have accepted?
 *
 * Goes after requireAuth, on the routes that put something on the board -
 * posting and voting. An account that has not accepted the required Terms
 * version (models/policies.js) - because it was made before the Terms
 * existed, or because they have changed in a way that needs accepting
 * again - is refused, with `mustAcceptTerms` so the website can ask. Reading
 * the board, the person's own account and their privacy rights are never
 * held back by this.
 */
async function requireCurrentTerms(req, res, next) {
  try {
    if (mustAcceptTerms(await latestTermsVersion(pool, req.user.id))) {
      return res.status(403).json({
        error: 'Please accept the updated Terms & Conditions first.',
        mustAcceptTerms: true,
      });
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireCurrentTerms };
