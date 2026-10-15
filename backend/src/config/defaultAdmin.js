/*
 * THE DEFAULT ADMINISTRATOR - the one account that can open the admin panel
 * on a new installation.
 *
 * Signing up only ever makes student and user accounts
 * (controllers/authController.js), so the administrator comes from the
 * server's own settings instead:
 *
 *   ADMIN_NAME      the name shown in the panel (default "Administrator")
 *   ADMIN_EMAIL     the email the administrator logs in with
 *   ADMIN_PASSWORD  their password - at least 8 characters, with a letter
 *                   and a number, like every other password
 *
 * Every time the server starts (server.js), this checks whether the
 * database has an administrator. If it has none, the account is created
 * from those settings. If it already has one, nothing happens - changing
 * the settings later does not change or add an account, so the password is
 * changed the usual way, from the log-in page.
 *
 * The password is never written in the code. Each installation sets its own
 * in backend/.env (or, with Docker, in the shell or a .env file beside
 * docker-compose.yml) - see GUIDE.md.
 *
 * The administrator can use the student side of the site too: the board,
 * posting and voting.
 */
const bcrypt = require('bcryptjs');
const pool = require('./db');
const { writeActivityLog } = require('../models/activityLog');
const { inTransaction } = require('../models/transaction');
const { EMAIL_PATTERN, PASSWORD_PATTERN, PASSWORD_RULE_MESSAGE } = require('../models/accountRules');

async function ensureDefaultAdmin() {
  const { rows } = await pool.query("SELECT EXISTS (SELECT 1 FROM users WHERE role = 'admin') AS has_admin");
  if (rows[0].has_admin) return;

  const name = String(process.env.ADMIN_NAME || 'Administrator').trim();
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || '');

  if (!email || !password) {
    console.warn(
      'There is no administrator yet. Set ADMIN_EMAIL and ADMIN_PASSWORD (see .env.example) and restart the server to create it.'
    );
    return;
  }
  if (!EMAIL_PATTERN.test(email)) {
    console.warn('ADMIN_EMAIL is not a valid email address, so no administrator was created.');
    return;
  }
  if (!PASSWORD_PATTERN.test(password)) {
    console.warn(`ADMIN_PASSWORD is too weak, so no administrator was created. ${PASSWORD_RULE_MESSAGE}`);
    return;
  }
  if (name.length > 120) {
    console.warn('ADMIN_NAME must be 120 characters or fewer, so no administrator was created.');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const created = await inTransaction(async (client) => {
    // The same lock as signing up, so a sign-up at the same moment cannot
    // take this email, and two servers starting at once cannot both create
    // an administrator.
    await client.query('SELECT pg_advisory_xact_lock(470700)');

    const admins = await client.query("SELECT 1 FROM users WHERE role = 'admin'");
    if (admins.rows.length > 0) return 'exists';

    const taken = await client.query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (taken.rows.length > 0) return 'taken';

    const { rows: inserted } = await client.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'admin')
       RETURNING id, name, email, role`,
      [name, email, passwordHash]
    );
    const account = inserted[0];

    // Recorded, so the activity log shows how the panel got its administrator.
    await writeActivityLog(client, {
      adminId: account.id,
      adminName: account.name,
      adminRole: account.role,
      action: 'first_admin',
      targetType: 'user',
      targetId: account.id,
      details: account.email,
    });
    return 'created';
  });

  if (created === 'taken') {
    console.warn(
      `ADMIN_EMAIL (${email}) already belongs to a student or user account, so no administrator was created. ` +
        'Use another address, or promote that account with: npm run make-admin -- ' +
        email
    );
  }
  if (created === 'created') {
    console.log(`Created the default administrator account: ${email}`);
  }
}

module.exports = { ensureDefaultAdmin };
