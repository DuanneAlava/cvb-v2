const express = require('express');
const { requirePermission, ROLE_PERMISSIONS } = require('../../middleware/auth');
const { logAs } = require('../../models/activityLog');
const { inTransaction } = require('../../models/transaction');
const { ADMIN_EDITABLE, readAccountFields, changedLabels, schoolDetailsRefused } = require('../../models/accountRules');
const { toId } = require('../../models/shape');
const { isSelf, deleteAccount } = require('./helpers');

/*
 * USERS - correcting somebody's details, suspending and reactivating an
 * account, changing a role, deleting an account. Part of the admin API: see
 * index.js beside this file for the rules every route here follows.
 */

const router = express.Router();

const MISSING_ACCOUNT = 'That account no longer exists.';

/*
 * Correct somebody's details - including the email, which only an
 * administrator may change. The log names only the fields that actually
 * changed; a save that changes nothing is not logged at all.
 */
router.patch('/users/:id', requirePermission('manage_users'), async (req, res, next) => {
  const id = toId(req.params.id);
  const { values, error } = readAccountFields(req.body, ADMIN_EDITABLE);
  if (error) return res.status(400).json({ error });

  try {
    const result = await inTransaction(async (client) => {
      const { rows } = await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [id]);
      const account = rows[0];
      if (!account) return { status: 404, error: MISSING_ACCOUNT };

      // School details are kept only with the person's own consent - an
      // administrator cannot add them to an account that has not given it.
      if (schoolDetailsRefused(values, { hasConsent: Boolean(account.school_consent_at), current: account })) {
        return {
          status: 400,
          error: 'This person has not agreed to CampusVoiceBox keeping their school details, so they cannot be added or changed.',
        };
      }

      if (values.email && values.email !== account.email) {
        const owner = await client.query('SELECT 1 FROM users WHERE email = $1', [values.email]);
        if (owner.rows.length > 0) {
          return { status: 400, error: 'Another account already uses that email address.' };
        }
      }

      const changed = changedLabels(account, values);
      if (changed.length === 0) return {};

      const columns = Object.keys(values);
      await client.query(
        `UPDATE users SET ${columns.map((column, index) => `${column} = $${index + 2}`).join(', ')}
          WHERE id = $1`,
        [id, ...columns.map((column) => values[column])]
      );
      await logAs(client, req.user, 'user_updated', {
        targetType: 'user',
        targetId: id,
        details: `Updated ${changed.join(', ')} on ${values.name ?? account.name}`,
        req,
      });
      return {};
    });

    if (result.error) return res.status(result.status).json({ error: result.error });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.patch('/users/:id/status', requirePermission('manage_users'), async (req, res, next) => {
  const id = toId(req.params.id);
  const { status } = req.body;
  if (!['active', 'suspended'].includes(status)) {
    return res.status(400).json({ error: 'Status must be active or suspended.' });
  }

  // Suspending yourself would lock you out of the panel you administer.
  if (isSelf(req, id)) {
    return res.status(400).json({ error: 'You cannot change your own account status.' });
  }

  try {
    const done = await inTransaction(async (client) => {
      const { rows } = await client.query(
        'UPDATE users SET status = $1 WHERE id = $2 RETURNING id, name',
        [status, id]
      );
      if (!rows[0]) return false;

      const suspended = status === 'suspended';
      await logAs(client, req.user, suspended ? 'user_suspended' : 'user_activated', {
        targetType: 'user',
        targetId: id,
        details: rows[0].name,
        req,
      });
      await client.query(
        `INSERT INTO notifications (type, audience, user_id, title, body)
         VALUES ($1, 'author', $2, $3, $4)`,
        [
          suspended ? 'account_suspended' : 'account_activated',
          id,
          suspended ? 'Your account has been suspended' : 'Your account is active again',
          suspended
            ? 'You can still read the board, but posting and voting are turned off.'
            : 'You can post and vote again.',
        ]
      );
      return true;
    });

    if (!done) return res.status(404).json({ error: MISSING_ACCOUNT });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

/*
 * Changing somebody's role needs manage_admins. Nobody may change their own -
 * that self-check, not a second admin tier, is what stops the one admin role
 * being used to promote or demote the account holding it.
 */
router.patch('/users/:id/role', requirePermission('manage_admins'), async (req, res, next) => {
  const id = toId(req.params.id);
  const { role } = req.body;
  // The roles that exist are the ones with a permission list (middleware/auth.js).
  if (!Object.hasOwn(ROLE_PERMISSIONS, String(role))) {
    return res.status(400).json({ error: 'Unknown role.' });
  }
  if (isSelf(req, id)) {
    return res.status(400).json({ error: 'You cannot change your own role.' });
  }

  try {
    const done = await inTransaction(async (client) => {
      const { rows } = await client.query('SELECT name, role FROM users WHERE id = $1 FOR UPDATE', [
        id,
      ]);
      if (!rows[0]) return false;

      await client.query('UPDATE users SET role = $1 WHERE id = $2', [role, id]);
      await logAs(client, req.user, 'role_changed', {
        targetType: 'user',
        targetId: id,
        details: `${rows[0].name}: ${rows[0].role} to ${role}`,
        req,
      });
      return true;
    });

    if (!done) return res.status(404).json({ error: MISSING_ACCOUNT });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.delete('/users/:id', requirePermission('delete_users'), async (req, res, next) => {
  const id = toId(req.params.id);
  if (isSelf(req, id)) {
    return res.status(400).json({ error: 'You cannot delete your own account.' });
  }

  try {
    // From the Users page, an account's submissions are always kept: erasing
    // concerns staff may still be working on is not a side effect of tidying
    // up accounts. Deleting them is only ever done at the person's request.
    const done = await inTransaction((client) => deleteAccount(client, req, id));

    if (!done) return res.status(404).json({ error: MISSING_ACCOUNT });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
