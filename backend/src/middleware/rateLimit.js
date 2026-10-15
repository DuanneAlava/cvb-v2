/*
 * LIMITS ON HOW OFTEN SOMETHING MAY BE TRIED.
 *
 * Without these, a script could guess passwords as fast as the server
 * answers, or fill the review queue with thousands of posts. Each limit
 * counts the attempts made in the last `windowMs` milliseconds under one key
 * - an email address, an account, an internet address - and answers
 * "429 Too Many Requests" once there have been `max` of them.
 *
 * `counts(res)`, when given, decides from the answer whether an attempt
 * counts at all: only a WRONG password counts towards locking an account,
 * and only a post that was actually SAVED counts towards the posting limit -
 * a student who fixes a mistake and tries again is not punished for it. The
 * attempt is counted while it is being answered and taken off afterwards if
 * it should not count, so a burst of requests sent all at once cannot slip
 * past the limit before the first of them has finished.
 *
 * The counts are kept in this server's memory. That is enough for one
 * server; they start again from nothing when it restarts, which only ever
 * makes the limits more forgiving.
 *
 * CAMPUS WI-FI: a whole campus often reaches the internet through ONE
 * address, so a limit per address has to be generous or a busy morning would
 * lock every student out at once. The tight limits are therefore per email
 * address (password guessing) and per account (posting); the per-address one
 * is only a backstop against a flood. Behind a reverse proxy, set TRUST_PROXY
 * (see .env.example) so the address counted is the visitor's, not the proxy's.
 */
function rateLimit({ windowMs, max, key, counts, message }) {
  const attempts = new Map(); // key -> times of recent attempts

  // Forget keys with nothing recent, so the map does not grow forever.
  // unref() lets the server shut down without waiting for this timer.
  setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [name, times] of attempts) {
      if (times.length === 0 || times[times.length - 1] <= cutoff) attempts.delete(name);
    }
  }, windowMs).unref();

  return function limit(req, res, next) {
    const name = key(req);
    if (!name) return next();

    const now = Date.now();
    const recent = (attempts.get(name) ?? []).filter((time) => time > now - windowMs);

    if (recent.length >= max) {
      res.set('Retry-After', String(Math.ceil((recent[0] + windowMs - now) / 1000)));
      return res.status(429).json({ error: message });
    }

    recent.push(now);
    attempts.set(name, recent);

    if (counts) {
      res.on('finish', () => {
        if (counts(res)) return;
        const times = attempts.get(name) ?? [];
        const index = times.indexOf(now);
        if (index !== -1) times.splice(index, 1);
      });
    }
    next();
  };
}

const MINUTE = 60 * 1000;

// The email a sign-in or password change is for, the way accounts store it.
const emailKey = (req) => String(req.body?.email ?? '').trim().toLowerCase() || null;

// Ten wrong passwords for one account in fifteen minutes.
const passwordAttempts = rateLimit({
  windowMs: 15 * MINUTE,
  max: 10,
  key: emailKey,
  counts: (res) => res.statusCode === 401,
  message: 'Too many attempts for this account. Please wait 15 minutes and try again.',
});

// The backstop: a generous ceiling on sign-ups, sign-ins and password
// resets from any one address.
const authFlood = rateLimit({
  windowMs: 15 * MINUTE,
  max: 600,
  key: (req) => req.ip,
  message: 'Too many requests from this network. Please wait a few minutes and try again.',
});

// Three "forgot password" emails per address in fifteen minutes, whether or
// not it has an account - so nobody's inbox can be flooded with reset links.
const resetRequests = rateLimit({
  windowMs: 15 * MINUTE,
  max: 3,
  key: emailKey,
  message: 'A reset link was already sent to this email. Please wait 15 minutes, and check your spam folder.',
});

// Ten wrong current passwords in fifteen minutes when a signed-in person
// changes their own - so a session left open cannot be used to guess it.
const currentPasswordAttempts = rateLimit({
  windowMs: 15 * MINUTE,
  max: 10,
  key: (req) => (req.user ? String(req.user.id) : null),
  counts: (res) => res.statusCode === 403,
  message: 'Too many wrong attempts. Please wait 15 minutes and try again.',
});

// Ten posts an hour from one account - far more than anybody writes by hand.
const postingLimit = rateLimit({
  windowMs: 60 * MINUTE,
  max: 10,
  key: (req) => (req.user ? String(req.user.id) : null),
  counts: (res) => res.statusCode === 201,
  message: 'You have posted a lot in a short time. Please wait a while before posting again.',
});

module.exports = { passwordAttempts, authFlood, postingLimit, resetRequests, currentPasswordAttempts };
