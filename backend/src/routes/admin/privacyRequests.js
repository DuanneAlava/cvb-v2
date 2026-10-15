const express = require('express');
const { can, requirePermission } = require('../../middleware/auth');
const { writePrivacyEvent } = require('../../models/privacyEvents');
const { inTransaction } = require('../../models/transaction');
const { PRIVACY_REQUEST_TYPES } = require('../../models/policies');
const { toId } = require('../../models/shape');
const { isSelf, deleteAccount } = require('./helpers');

/*
 * PRIVACY REQUESTS - an administrator handling what a person asked for.
 * Part of the admin API: see index.js beside this file for the rules every
 * route here follows.
 *
 * Kept apart from moderation on purpose: its own permission
 * (manage_privacy), its own log (models/privacyEvents.js). The requests and
 * the privacy log reach the panel through GET /api/state, for holders of
 * that permission only.
 */

const router = express.Router();

const PRIVACY_STATUS_WORDS = {
  in_progress: 'being handled',
  completed: 'completed',
  declined: 'declined',
};

/*
 * Move a request on: start it, complete it, or decline it. Completing or
 * declining needs a reply, because the person is shown it. Completing a
 * deletion request deletes the account - which also needs delete_users -
 * with `deletePosts` choosing whether the person's submissions go too.
 *
 * Nobody handles a request about their own account: another administrator
 * must, so nobody is the only witness to what was done with their own data.
 */
router.patch('/privacy-requests/:id', requirePermission('manage_privacy'), async (req, res, next) => {
  const id = toId(req.params.id);
  const status = String(req.body.status ?? '');
  const response = String(req.body.response ?? '').trim();
  const deletePosts = req.body.deletePosts === true;

  if (!Object.hasOwn(PRIVACY_STATUS_WORDS, status)) {
    return res.status(400).json({ error: 'Unknown status.' });
  }
  if (status !== 'in_progress' && !response) {
    return res.status(400).json({ error: 'Write a reply for the person - they are shown it.' });
  }
  if (response.length > 2000) {
    return res.status(400).json({ error: 'Please keep the reply to 2000 characters or fewer.' });
  }

  try {
    const result = await inTransaction(async (client) => {
      const { rows } = await client.query('SELECT * FROM privacy_requests WHERE id = $1 FOR UPDATE', [id]);
      const request = rows[0];
      if (!request) return { status: 404, error: 'That request no longer exists.' };
      if (request.user_id !== null && isSelf(req, request.user_id)) {
        return { status: 400, error: 'Another administrator must handle a request about your own account.' };
      }

      const allowed = { pending: ['in_progress', 'completed', 'declined'], in_progress: ['completed', 'declined'] };
      if (!(allowed[request.status] ?? []).includes(status)) {
        return { status: 409, error: `This request is already ${request.status.replace('_', ' ')}.` };
      }

      const label = PRIVACY_REQUEST_TYPES[request.type];
      let postsOutcome = null;
      let accountDeleted = false;

      if (request.type === 'deletion' && status === 'completed' && request.user_id !== null) {
        if (!can(req.user, 'delete_users')) return { status: 404, error: 'Not found.' };
        accountDeleted = Boolean(await deleteAccount(client, req, request.user_id, { deletePosts }));
        postsOutcome = deletePosts ? 'deleted' : 'kept';
      }

      await client.query(
        `UPDATE privacy_requests
            SET status = $2, response = COALESCE($3, response), posts_outcome = COALESCE($4, posts_outcome),
                handled_by_id = $5, handled_by_name = $6, updated_at = now(),
                resolved_at = CASE WHEN $7::boolean THEN now() ELSE resolved_at END
          WHERE id = $1`,
        [
          request.id,
          status,
          response || null,
          postsOutcome,
          req.user.id,
          req.user.name,
          status !== 'in_progress',
        ]
      );

      await writePrivacyEvent(client, {
        actor: req.user,
        action: `request_${status}`,
        requestId: request.id,
        subjectName: request.requester_name,
        details: [
          `${label} request`,
          accountDeleted && `account deleted, submissions ${postsOutcome}`,
        ]
          .filter(Boolean)
          .join(' - '),
      });

      // Tell the person - unless their account was the thing deleted.
      if (request.user_id !== null && !accountDeleted) {
        await client.query(
          `INSERT INTO notifications (type, audience, user_id, title, body)
           VALUES ('privacy_request_updated', 'author', $1, $2, $3)`,
          [
            request.user_id,
            `Your ${label} request is ${PRIVACY_STATUS_WORDS[status]}`,
            response || `An administrator has started on your ${label} request.`,
          ]
        );
      }
      return {};
    });

    if (result.error) return res.status(result.status).json({ error: result.error });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
