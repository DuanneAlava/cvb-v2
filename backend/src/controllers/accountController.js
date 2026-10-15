const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { can, signToken } = require('../middleware/auth');
const { logAs, logOwnChange } = require('../models/activityLog');
const { inTransaction } = require('../models/transaction');
const {
  PASSWORD_PATTERN,
  PASSWORD_RULE_MESSAGE,
  SELF_EDITABLE,
  readAccountFields,
  changedLabels,
  schoolDetailsRefused,
} = require('../models/accountRules');
const { readProfilePhoto, sendFile } = require('../models/files');
const { toId } = require('../models/shape');

/*
 * A signed-in person's own things: their account details, their password,
 * their profile photo, and their notifications. Everything here acts on req.user - the
 * account the token belongs to - and never on an id sent in the request, so
 * nobody can edit somebody else's account through these.
 */

/*
 * PATCH /api/account - the profile form on /account. A person may change
 * their name and school details; their email, role and status are an
 * administrator's to change (routes/admin/users.js). A save that changes
 * nothing is not logged; one that does names only the fields that changed.
 */
async function updateAccount(req, res, next) {
  try {
    const { values, error } = readAccountFields(req.body, SELF_EDITABLE);
    if (error) return res.status(400).json({ error });

    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);

    // School details are kept only with the person's consent, given on the
    // Privacy & Data section of the same page (controllers/privacyController.js).
    if (schoolDetailsRefused(values, { hasConsent: Boolean(rows[0].school_consent_at), current: rows[0] })) {
      return res.status(400).json({
        error: 'To save school details, first allow CampusVoiceBox to keep them under Privacy & Data below.',
      });
    }

    const changed = changedLabels(rows[0], values);
    if (changed.length === 0) return res.status(204).end();

    const columns = Object.keys(values);
    await inTransaction(async (client) => {
      await client.query(
        `UPDATE users SET ${columns.map((column, index) => `${column} = $${index + 2}`).join(', ')}
          WHERE id = $1`,
        [req.user.id, ...columns.map((column) => values[column])]
      );
      await logOwnChange(client, req, `Updated ${changed.join(', ')} on ${values.name ?? rows[0].name}`);
    });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

/*
 * PUT /api/account/photo - { photo: a data URL }, or { photo: '' } to go
 * back to initials. Saved at once, not with the profile form.
 */
async function updatePhoto(req, res, next) {
  try {
    const { photo, error } = readProfilePhoto(req.body.photo);
    if (error) return res.status(400).json({ error });

    // Removing a photo that is not there changes nothing, so is not logged.
    if (!photo) {
      const { rows } = await pool.query('SELECT photo IS NOT NULL AS has_photo FROM users WHERE id = $1', [
        req.user.id,
      ]);
      if (!rows[0].has_photo) return res.status(204).end();
    }

    await inTransaction(async (client) => {
      await client.query(
        'UPDATE users SET photo = $2, photo_type = $3, photo_updated_at = now() WHERE id = $1',
        [req.user.id, photo?.data ?? null, photo?.type ?? null]
      );
      await logOwnChange(client, req, `Updated photo on ${req.user.name}`);
    });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

/*
 * GET /api/users/:id/photo - "Only you and school staff see it", as the
 * account page promises: the account itself, and anybody who can open the
 * admin panel. Everybody else is told there is nothing there.
 */
async function getPhoto(req, res, next) {
  try {
    const id = toId(req.params.id);
    const mayView = id && (id === req.user.id || can(req.user, 'view_admin'));
    const { rows } = mayView
      ? await pool.query('SELECT photo, photo_type FROM users WHERE id = $1 AND photo IS NOT NULL', [id])
      : { rows: [] };
    if (!rows[0]) return res.status(404).json({ error: 'Not found.' });

    sendFile(res, { name: 'photo', type: rows[0].photo_type, data: rows[0].photo });
  } catch (err) {
    next(err);
  }
}

/*
 * Which notifications are this person's: the ones addressed to them, plus
 * the admin feed if they can open the admin panel - the same rule GET
 * /api/state uses to send them. $1 is their id, $2 whether they see the
 * admin feed.
 */
const MINE = "((audience = 'author' AND user_id = $1) OR (audience = 'admin' AND $2::boolean))";

// PATCH /api/notifications/:id/read
async function markNotificationRead(req, res, next) {
  try {
    const id = toId(req.params.id);
    if (id) {
      await pool.query(`UPDATE notifications SET is_read = TRUE WHERE id = $3 AND ${MINE}`, [
        req.user.id,
        can(req.user, 'view_admin'),
        id,
      ]);
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// POST /api/notifications/read-all
async function markAllNotificationsRead(req, res, next) {
  try {
    await pool.query(`UPDATE notifications SET is_read = TRUE WHERE is_read = FALSE AND ${MINE}`, [
      req.user.id,
      can(req.user, 'view_admin'),
    ]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

/*
 * PUT /api/account/password - { currentPassword, newPassword }
 *
 * Changing a password you know, signed in, from your own account page. The
 * current password is asked for even though the person is signed in: a
 * session left open on a shared computer must not be enough to take the
 * account over. (A FORGOTTEN password is reset with an emailed link instead
 * - forgotPassword in controllers/authController.js.)
 *
 * Every other device is signed out (password_changed_at, middleware/auth.js).
 * This one is handed a new token so it stays signed in: the change time is
 * taken from this server's clock, the same clock that dates the new token,
 * so the token can never count as older than the change.
 */
async function changePassword(req, res, next) {
  try {
    const currentPassword = String(req.body.currentPassword ?? '');
    const newPassword = String(req.body.newPassword ?? '');

    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!(await bcrypt.compare(currentPassword, rows[0].password_hash))) {
      return res.status(403).json({ error: 'Your current password is not right.' });
    }
    if (!PASSWORD_PATTERN.test(newPassword)) {
      return res.status(400).json({ error: PASSWORD_RULE_MESSAGE });
    }
    if (newPassword === currentPassword) {
      return res.status(400).json({ error: 'Choose a new password that is different from your current one.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await inTransaction(async (client) => {
      await client.query('UPDATE users SET password_hash = $1, password_changed_at = $2 WHERE id = $3', [
        passwordHash,
        new Date(),
        req.user.id,
      ]);
      await logAs(client, req.user, 'password_changed', {
        targetType: 'user',
        targetId: req.user.id,
        details: req.user.name,
        req,
      });
    });

    res.json({ token: signToken(req.user) });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  updateAccount,
  changePassword,
  updatePhoto,
  getPhoto,
  markNotificationRead,
  markAllNotificationsRead,
};
