/*
 * Makes an existing account an administrator - the way back in when the
 * admin panel has nobody left who can use it.
 * Run with: npm run make-admin -- someone@school.edu.ph
 *
 * Normally this is never needed: the default administrator is created when
 * the server starts (config/defaultAdmin.js), administrators promote others
 * from the admin panel, and a forgotten password is reset with the emailed
 * link from "Forgot password?". This is the recovery when that is not
 * possible - email is not set up, or the administrator's mailbox is gone -
 * run by somebody with access to the server:
 *
 *   1. Register a new account as usual, on the sign-up page.
 *   2. Run this with its email address.
 *   3. Sign in with it - every request reads the role fresh from the
 *      database, so the new role applies straight away.
 *
 * The change is written to activity_logs like any other role change, under
 * "Command line" instead of an administrator's name, so the log still shows
 * how the account got its role. The two writes share one transaction.
 */
const pool = require('./db');
const { writeActivityLog } = require('../models/activityLog');
const { inTransaction } = require('../models/transaction');

async function makeAdmin(email) {
  if (!email) {
    console.error("Give the account's email address: npm run make-admin -- someone@school.edu.ph");
    process.exitCode = 1;
    return;
  }

  // Registration stores emails in lower case, so look them up the same way.
  const address = email.trim().toLowerCase();
  const { rows } = await pool.query('SELECT id, name, email, role FROM users WHERE email = $1', [
    address,
  ]);
  const account = rows[0];

  if (!account) {
    console.error(`No account uses ${address}. Register it first, then run this again.`);
    process.exitCode = 1;
    return;
  }

  if (account.role === 'admin') {
    console.log(`${account.name} (${account.email}) is already an administrator.`);
    return;
  }

  await inTransaction(async (client) => {
    await client.query("UPDATE users SET role = 'admin' WHERE id = $1", [account.id]);
    await writeActivityLog(client, {
      adminName: 'Command line',
      action: 'role_changed',
      targetType: 'user',
      targetId: account.id,
      details: `${account.name}: ${account.role} to admin`,
    });
  });

  console.log(`${account.name} (${account.email}) is now an administrator.`);
}

makeAdmin(process.argv[2])
  .catch((err) => {
    console.error('Could not make the account an administrator:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
