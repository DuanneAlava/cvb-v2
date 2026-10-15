/*
 * Catches anything thrown or passed to next(err) in a route handler and
 * turns it into a consistent JSON error response instead of an HTML stack
 * trace. Keep this as the LAST app.use() in app.js.
 *
 * Only the errors a person can do something about are explained; anything
 * else is logged here and answered with a general message, so no internal
 * detail - a table name, a line of SQL - ever reaches the browser.
 */
function errorHandler(err, req, res, _next) {
  // A request body bigger than its limit (app.js).
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'That is too large to send. Try fewer or smaller files.' });
  }
  // A request body that is not valid JSON.
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'The request could not be read.' });
  }
  // Two requests racing to do the same thing: a UNIQUE rule in
  // models/schema.sql refused the second. Say which, where it is one a person
  // can act on.
  if (err.code === '23505') {
    const which = {
      users_email_key: 'Another account already uses that email address.',
      uniq_open_privacy_request: 'You already have an open request of that type.',
    }[err.constraint];
    return res.status(409).json({ error: which ?? 'That has already been done.' });
  }
  // Any other problem with the request itself that Express marks as safe to
  // repeat back (an unsupported character set, say).
  if (err.expose && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: err.message });
  }

  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our end. Please try again.' });
}

module.exports = errorHandler;
