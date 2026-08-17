const jwt = require('jsonwebtoken');

/*
 * Reads the "Authorization: Bearer <token>" header, checks the JWT is
 * valid, and attaches { id, email } to req.user so later route handlers
 * know who is making the request. Responds 401 if the token is missing,
 * expired, or was not signed with our JWT_SECRET.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
  }
}

/*
 * Same idea, but never blocks the request - it just attaches req.user
 * when a valid token is present. Used on routes that behave slightly
 * differently for guests vs logged-in students (e.g. voting shows who
 * voted only when logged in) without forcing a login.
 */
function attachUserIfPresent(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme === 'Bearer' && token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      req.user = { id: payload.sub, email: payload.email };
    } catch {
      // Invalid token on an optional-auth route - just proceed as a guest.
    }
  }
  next();
}

module.exports = { requireAuth, attachUserIfPresent };
