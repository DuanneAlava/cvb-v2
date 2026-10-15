const pool = require('../config/db');

/*
 * Run a set of statements as one transaction - all of them, or none.
 *
 * Changing a status, writing the audit entry and notifying the student have to
 * succeed or fail together. A half-applied approval - the post published but
 * nobody told, or told but not published - is worse than a failed one.
 *
 * Shared by every part of the backend that writes more than one row at once:
 * the admin routes, sign-up and password changes, posting (a post and its
 * files), account changes and the make-admin command.
 *
 * `handler` receives the transaction's client and runs its statements on it;
 * whatever it returns is handed back. If anything inside throws, everything
 * it did is rolled back and the error is passed on.
 */
async function inTransaction(handler) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await handler(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { inTransaction };
