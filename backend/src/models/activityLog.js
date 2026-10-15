/*
 * WRITING TO THE ACTIVITY LOG - one INSERT for every part of the backend.
 *
 * Five places record an entry: the admin routes (every administrative
 * action), signing up, in and out and changing a password
 * (controllers/authController.js), a person changing their own account
 * (controllers/accountController.js and privacyController.js - through
 * logOwnChange below) and the make-admin command
 * (config/make-admin.js). They share this one statement, so a column added
 * to activity_logs has one place to be remembered in.
 *
 * `db` is the pool, or a client inside a transaction - pass the client when
 * the entry has to succeed or fail together with the change it records.
 *
 * `adminName` is COPIED into the row rather than joined later, so the entry
 * reads correctly after that account is deleted (see the activity_logs table
 * in models/schema.sql). The command line has no account, so it passes a
 * name and no id.
 */
async function writeActivityLog(
  db,
  { adminId = null, adminName, adminRole = null, action, targetType = null, targetId = null, details = null, ip = null }
) {
  await db.query(
    `INSERT INTO activity_logs
       (admin_id, admin_name, admin_role, action, target_type, target_id, details, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      adminId,
      adminName,
      adminRole,
      action,
      targetType,
      targetId === null ? null : String(targetId),
      details,
      ip,
    ]
  );
}

/*
 * The entry for a change somebody made to their OWN account - their details,
 * their photo, their consent for school details - recorded as their action.
 * Shared by controllers/accountController.js and privacyController.js.
 */
function logOwnChange(client, req, details) {
  return writeActivityLog(client, {
    adminId: req.user.id,
    adminName: req.user.name,
    adminRole: req.user.role,
    action: 'user_updated',
    targetType: 'user',
    targetId: req.user.id,
    details,
    ip: req.ip,
  });
}

module.exports = { writeActivityLog, logOwnChange };
