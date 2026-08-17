/*
 * Catches anything thrown or passed to next(err) in a route handler and
 * turns it into a consistent JSON error response instead of an HTML stack
 * trace. Keep this as the LAST app.use() in app.js.
 */
function errorHandler(err, req, res, _next) {
  console.error(err);

  const status = err.status || 500;
  const message =
    status === 500 ? 'Something went wrong on our end. Please try again.' : err.message;

  res.status(status).json({ error: message });
}

module.exports = errorHandler;
