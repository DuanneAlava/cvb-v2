const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { sendMail } = require('../config/mail');
const { can, signToken } = require('../middleware/auth');
const { logAs } = require('../models/activityLog');
const { inTransaction } = require('../models/transaction');
const {
  EMAIL_PATTERN,
  PASSWORD_PATTERN,
  PASSWORD_RULE_MESSAGE,
  WRONG_EMAIL_OR_PASSWORD,
  ADMIN_EDITABLE,
  readAccountFields,
  schoolDetailsRefused,
} = require('../models/accountRules');
const { POLICY_VERSIONS } = require('../models/policies');

/*
 * Signing up, signing in and out, and resetting a forgotten password.
 * (Changing a password you know is done signed in, from your own account -
 * controllers/accountController.js.)
 *
 * The browser keeps the token these hand out and sends it with every request
 * (frontend/src/services/api.js). Everything about the account itself - its
 * name, its role, its posts - is then read from GET /api/state, so these only
 * answer "did it work" and hand over the token (signToken, middleware/auth.js).
 */

/*
 * Compared against when no account has the email typed, so a wrong email
 * takes as long to answer as a wrong password. Without it, the time taken
 * would tell somebody which emails have accounts - the very thing the
 * single error message is there to hide.
 */
const NO_ACCOUNT_HASH = bcrypt.hashSync('no account has this password', 10);

// The account an email belongs to, and whether `password` is its password.
async function checkPassword(email, password) {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  const account = rows[0];
  const matches = await bcrypt.compare(String(password ?? ''), account?.password_hash ?? NO_ACCOUNT_HASH);
  return account && matches ? account : null;
}

// Sign-ins and sign-outs are recorded for administrators only. The log is a
// record of administrative action; a few hundred student sign-ins a week
// would bury the decisions it exists to show.
function logSession(account, action, req) {
  if (!can(account, 'view_admin')) return null;
  return logAs(pool, account, action, { targetType: 'user', targetId: account.id, details: account.email, req });
}

// POST /api/auth/register
async function register(req, res, next) {
  try {
    // The same checks, in the same order and words, as the sign-up form
    // (frontend/src/pages/Signup.jsx) - then the length limits of every field.
    if (!String(req.body.name ?? '').trim()) {
      return res.status(400).json({ error: 'Please enter your full name.' });
    }
    if (!EMAIL_PATTERN.test(String(req.body.email ?? '').trim())) {
      return res.status(400).json({ error: 'Please enter a valid school email address.' });
    }
    if (!PASSWORD_PATTERN.test(String(req.body.password ?? ''))) {
      return res.status(400).json({ error: PASSWORD_RULE_MESSAGE });
    }
    const { values, error } = readAccountFields(req.body, ADMIN_EDITABLE);
    if (error) return res.status(400).json({ error });

    /*
     * THE TERMS, AND WHAT WAS READ. Accepting the Terms is required, and is
     * checked here as well as on the form - a request sent without the form
     * would skip the form's check. The versions sent back are the ones the
     * form showed; they must be the current ones, so nobody accepts text
     * they did not see (models/policies.js).
     */
    if (req.body.acceptTerms !== true) {
      return res
        .status(400)
        .json({ error: 'Please accept the Terms & Conditions to create your account.' });
    }
    if (
      req.body.termsVersion !== POLICY_VERSIONS.terms ||
      req.body.privacyVersion !== POLICY_VERSIONS.privacy
    ) {
      return res.status(409).json({
        error:
          'The Terms or the Privacy Policy changed while this page was open. Reload the page, read them again, then sign up.',
      });
    }

    /*
     * SCHOOL DETAILS ONLY WITH CONSENT - a separate, optional choice, never
     * bundled with the Terms. Somebody who fills them in must also agree to
     * them being kept; somebody who does not agree simply leaves them blank.
     */
    const schoolConsent = req.body.schoolConsent === true;
    if (schoolDetailsRefused(values, { hasConsent: schoolConsent })) {
      return res.status(400).json({
        error: 'Tick the box to let CampusVoiceBox keep your school details, or leave them blank.',
      });
    }

    /*
     * bcrypt turns the password into a one-way "hash": a scrambled string
     * that cannot be turned back into the password, but can be checked
     * against a later attempt. The 10 is the "cost" - how slow to make it,
     * deliberately, so guessing millions of passwords is impractical. The
     * plain password is never stored anywhere.
     */
    const passwordHash = await bcrypt.hash(req.body.password, 10);

    const user = await inTransaction(async (client) => {
      /*
       * One sign-up at a time, so two sign-ups at the same moment cannot
       * both claim the same email. The default administrator is created
       * under the same lock (config/defaultAdmin.js). The lock is released
       * when the transaction ends.
       */
      await client.query('SELECT pg_advisory_xact_lock(470700)');

      const taken = await client.query('SELECT 1 FROM users WHERE email = $1', [values.email]);
      if (taken.rows.length > 0) return null;

      /*
       * SIGNING UP IS FOR STUDENTS AND USERS ONLY. A student number makes a
       * student account; without one it is a general user account. It never
       * makes an administrator: the administrator is the default account
       * (config/defaultAdmin.js), and only an administrator can promote
       * anybody. Registration never lets the person choose - the role is
       * decided here and nowhere else.
       */
      const role = values.student_id ? 'student' : 'user';

      // Signing up signs the person in, so it counts as their first login.
      const { rows } = await client.query(
        `INSERT INTO users (name, email, password_hash, role, student_id, course, year_level,
                            section, school_consent_version, school_consent_at, last_login_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CASE WHEN $10::boolean THEN now() END, now())
         RETURNING *`,
        [
          values.name,
          values.email,
          passwordHash,
          role,
          values.student_id ?? null,
          values.course ?? null,
          values.year_level ?? null,
          values.section ?? null,
          schoolConsent ? POLICY_VERSIONS.privacy : null,
          schoolConsent,
        ]
      );
      const created = rows[0];

      // What was agreed to, and when - the evidence, in the same transaction
      // as the account, so there is never an account without it.
      const agreed = [
        ['terms', POLICY_VERSIONS.terms, 'accepted'],
        ['privacy_notice', POLICY_VERSIONS.privacy, 'acknowledged'],
        ...(schoolConsent ? [['school_details', POLICY_VERSIONS.privacy, 'granted']] : []),
      ];
      for (const [document, version, action] of agreed) {
        await client.query(
          'INSERT INTO policy_acceptances (user_id, document, version, action) VALUES ($1, $2, $3, $4)',
          [created.id, document, version, action]
        );
      }

      // Tell the admin panel somebody registered.
      await client.query(
        `INSERT INTO notifications (type, audience, title, body, link)
         VALUES ('user_registered', 'admin', 'New user registered', $1, $2)`,
        [`${created.name} (${created.email}) created an account.`, `/admin/users/${created.id}`]
      );

      return created;
    });

    // `field` tells the form which box the message belongs beside - a 409
    // can also mean the policies changed while the form was open (above).
    if (!user) {
      return res
        .status(409)
        .json({ error: 'An account with that school email already exists.', field: 'email' });
    }

    await logSession(user, 'login', req);
    res.status(201).json({ token: signToken(user) });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/login
async function login(req, res, next) {
  try {
    const email = String(req.body.email ?? '').trim().toLowerCase();
    if (!email || !req.body.password) {
      return res.status(400).json({ error: 'Please fill in both fields.' });
    }

    // Deliberately vague, so the form never reveals which accounts exist.
    const user = await checkPassword(email, req.body.password);
    if (!user) return res.status(401).json({ error: WRONG_EMAIL_OR_PASSWORD });

    /*
     * A suspended account is refused here as well as on every request it
     * makes. Checking it at the door is not enough on its own - an account
     * can be suspended after signing in - but refusing the sign-in stops a
     * new token being minted for it in the first place.
     */
    if (user.status === 'suspended') {
      return res.status(403).json({
        error: 'This account has been suspended. Please contact the Student Affairs office.',
      });
    }

    await pool.query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);
    await logSession(user, 'login', req);

    res.json({ token: signToken(user) });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/logout  (signed in) - only recorded; the browser forgets the token.
async function logout(req, res, next) {
  try {
    await logSession(req.user, 'logout', req);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

/*
 * FORGOTTEN PASSWORDS - an emailed link, used once, within an hour.
 *
 * POST /api/auth/forgot-password { email } answers the same whatever the
 * email: "if it has an account, a link is on its way". Saying which emails
 * have accounts would hand anybody a list of the school's students. The
 * email itself is sent after the answer has gone, so the time taken does
 * not give it away either. A suspended account is sent nothing - it could
 * not log in afterwards anyway.
 *
 * The link carries a long random secret. Only its SHA-256 hash is stored
 * (the password_resets table), so the table alone cannot be used to reset
 * anybody's password. The secret is in the link's "#" part, which browsers
 * never send to a server - it stays out of every web server's access log.
 *
 * POST /api/auth/reset-password { token, newPassword } sets the new
 * password, signs the account out on every device (password_changed_at,
 * see middleware/auth.js), and removes every reset link the account has.
 */
const RESET_LINK_MINUTES = 60;
const RESET_SENT =
  'If that email belongs to an account, a link to reset its password is on its way. It works for one hour.';
const RESET_LINK_INVALID =
  'This reset link no longer works - it was already used, it has expired, or a newer one was sent. Ask for a new link.';

// The website's own address, which the emailed link points to.
const APP_URL = (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');

const hashResetToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function resetEmail(account, token) {
  return {
    to: account.email,
    subject: 'Reset your CampusVoiceBox password',
    text: [
      `Hello ${account.name},`,
      '',
      `Somebody asked to reset the password of your CampusVoiceBox account (${account.email}).`,
      `To choose a new password, open this link within the next ${RESET_LINK_MINUTES} minutes:`,
      '',
      `${APP_URL}/reset-password#token=${token}`,
      '',
      'The link works once. If you did not ask for this, ignore this email - your password stays as it is.',
      '',
      'CampusVoiceBox',
    ].join('\n'),
  };
}

// POST /api/auth/forgot-password
async function forgotPassword(req, res, next) {
  try {
    const email = String(req.body.email ?? '').trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    const { rows } = await pool.query("SELECT id, name, email FROM users WHERE email = $1 AND status = 'active'", [
      email,
    ]);
    const account = rows[0];

    if (account) {
      const token = crypto.randomBytes(32).toString('base64url');
      await inTransaction(async (client) => {
        // A new link replaces any earlier one; expired links are cleared out too.
        await client.query('DELETE FROM password_resets WHERE user_id = $1 OR expires_at < now()', [account.id]);
        await client.query(
          `INSERT INTO password_resets (user_id, token_hash, expires_at)
           VALUES ($1, $2, now() + make_interval(mins => $3))`,
          [account.id, hashResetToken(token), RESET_LINK_MINUTES]
        );
      });
      // After the answer, not before it - see the note above.
      setImmediate(() => {
        sendMail(resetEmail(account, token)).catch((err) =>
          console.error(`Could not send the password reset email to ${account.email}:`, err.message)
        );
      });
    }

    res.json({ message: RESET_SENT });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/reset-password
async function resetPassword(req, res, next) {
  try {
    const token = String(req.body.token ?? '');
    const newPassword = String(req.body.newPassword ?? '');
    if (!token) return res.status(400).json({ error: RESET_LINK_INVALID });
    if (!PASSWORD_PATTERN.test(newPassword)) {
      return res.status(400).json({ error: PASSWORD_RULE_MESSAGE });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const done = await inTransaction(async (client) => {
      const { rows } = await client.query(
        `SELECT u.id, u.name, u.role
           FROM password_resets r JOIN users u ON u.id = r.user_id
          WHERE r.token_hash = $1 AND r.expires_at > now()
          FOR UPDATE OF r`,
        [hashResetToken(token)]
      );
      const account = rows[0];
      if (!account) return false;

      await client.query('UPDATE users SET password_hash = $1, password_changed_at = now() WHERE id = $2', [
        passwordHash,
        account.id,
      ]);
      await client.query('DELETE FROM password_resets WHERE user_id = $1', [account.id]);
      await logAs(client, account, 'password_changed', {
        targetType: 'user',
        targetId: account.id,
        details: `${account.name} - with an emailed reset link`,
        req,
      });
      return true;
    });

    if (!done) return res.status(400).json({ error: RESET_LINK_INVALID });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, logout, forgotPassword, resetPassword };
