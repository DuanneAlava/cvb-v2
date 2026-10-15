const express = require('express');
const pool = require('../config/db');
const { can, requireAuth, requirePermission, ROLE_PERMISSIONS } = require('../middleware/auth');
const { STATUSES, KINDS, DEPARTMENTS } = require('../models/workflow');
const { writeActivityLog } = require('../models/activityLog');
const { writePrivacyEvent } = require('../models/privacyEvents');
const { inTransaction } = require('../models/transaction');
const { PRIVACY_REQUEST_TYPES } = require('../models/policies');
const {
  ADMIN_EDITABLE,
  readAccountFields,
  changedLabels,
  schoolDetailsRefused,
} = require('../models/accountRules');
const { toId, shapeLogEntry } = require('../models/shape');

/*
 * THE ADMIN API.
 *
 * Everything the admin panel changes, and nothing a student can reach. What
 * the panel SHOWS comes from GET /api/state, which sends an administrator
 * every record (controllers/stateController.js).
 *
 * THE ONE RULE IN THIS FILE
 * Every route below carries its own requirePermission(...). Not one of them
 * relies on the frontend having hidden a button, because a hidden button is
 * not a check - it is a suggestion, and curl ignores it. For the same reason
 * the workflow is enforced here too: a status move the review dialog would
 * never offer is refused (models/workflow.js).
 *
 * requireAuth is applied once to the whole router, so a route physically
 * cannot be added here without at least being authenticated; the per-route
 * permission is then the second gate. Both read the account fresh from the
 * database rather than trusting the token, so demoting or suspending
 * somebody takes effect immediately instead of when their token expires.
 *
 * Every change writes its activity-log entry, and tells the student, inside
 * the same transaction - all three happen, or none does.
 */

/*
 * WHAT YOU'LL MEET IN THIS FILE (plain-English notes)
 *
 * - express.Router()  A group of related routes that is mounted at one path
 *   (here /admin, in routes/index.js). `router.patch('/users/:id', ...)`
 *   therefore answers PATCH /admin/users/12.
 * - HTTP verbs  GET reads, POST creates, PATCH changes part of something,
 *   DELETE removes. Each route is one verb at one path.
 * - `router.use(requireAuth)`  Apply a middleware to every route below it.
 * - `requirePermission('manage_users')` as a route argument  Middleware
 *   given per route, between the path and the handler. It runs first; the
 *   handler only runs if it calls next().
 * - `req.params.id` / `req.body.status`  Where input arrives: the address
 *   (/users/:id) and the JSON body of a POST or PATCH.
 * - `res.status(400).json({ error })`  Reply with an HTTP status code and a
 *   JSON body. 400 = bad input, 401 = not signed in, 403 = not allowed,
 *   404 = not found, 409 = it has changed since you looked, 204 = done,
 *   nothing to return.
 * - A "transaction"  Several database statements that must all succeed or
 *   all be undone together (BEGIN ... COMMIT, or ROLLBACK on error). See
 *   inTransaction() in models/transaction.js.
 * - `SELECT ... FOR UPDATE`  Read a row and hold it until the transaction
 *   ends, so two administrators acting on the same submission at once take
 *   turns instead of overwriting each other.
 * - `next(err)`  Hand an error to the app's error handler (middleware/
 *   errorHandler.js) instead of crashing the process.
 */

const router = express.Router();

// Nothing in this file is reachable without a valid token.
router.use(requireAuth);

const MISSING_POST = 'That submission no longer exists.';
const MISSING_ACCOUNT = 'That account no longer exists.';

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/*
 * Write an audit entry for the administrator making this request. Called by
 * the handlers themselves rather than left to the caller, so an
 * administrative action cannot quietly skip being recorded. The INSERT itself
 * is shared - see models/activityLog.js.
 */
function writeLog(client, req, action, { targetType, targetId, details }) {
  return writeActivityLog(client, {
    adminId: req.user.id,
    adminName: req.user.name,
    adminRole: req.user.role,
    action,
    targetType,
    targetId,
    details,
    ip: req.ip,
  });
}

/*
 * Tell a post's author what happened to it. No link is saved with it: a
 * student reads their notifications on their own dashboard, so there is
 * nowhere further to send them. A post whose author's account was deleted
 * has nobody to tell.
 */
async function notifyAuthor(client, post, type, { title, body }) {
  if (!post.author_id) return;
  await client.query(
    `INSERT INTO notifications (type, audience, user_id, post_id, title, body)
     VALUES ($1, 'author', $2, $3, $4, $5)`,
    [type, post.author_id, post.id, title, body]
  );
}

// A post, held for the rest of the transaction - or null if it is gone.
async function lockPost(client, id) {
  if (!id) return null;
  const { rows } = await client.query('SELECT * FROM posts WHERE id = $1 FOR UPDATE', [id]);
  return rows[0] ?? null;
}

// The refusal for a move the workflow does not allow from where a post is now.
function cannotMove(post, wanted) {
  return `This submission is ${STATUSES[post.status].label}, so it cannot be ${wanted} from here.`;
}

// Is this the administrator's own account? Several actions refuse it.
const isSelf = (req, id) => id === req.user.id;

/*
 * Delete an account - from the Users page, or to complete a deletion
 * request. Votes are always kept (votes.user_id is ON DELETE SET NULL - see
 * models/schema.sql): quietly changing a result after the fact would be the
 * wrong kind of tidy. Submissions are kept too, without an owner, unless
 * `deletePosts` - a choice made when handling the person's own deletion
 * request - removes them with their files and the votes on them.
 * Answers the deleted account's name and email, or null if it was gone.
 */
async function deleteAccount(client, req, id, { deletePosts = false } = {}) {
  if (deletePosts) await client.query('DELETE FROM posts WHERE author_id = $1', [id]);

  const { rows } = await client.query('DELETE FROM users WHERE id = $1 RETURNING name, email', [id]);
  if (!rows[0]) return null;

  await writeLog(client, req, 'user_deleted', {
    targetType: 'user',
    targetId: id,
    details: `${rows[0].name} (${rows[0].email}) - their submissions were ${deletePosts ? 'deleted too' : 'kept'}`,
  });
  return rows[0];
}

/* ------------------------------------------------------------------ *
 * USERS
 * ------------------------------------------------------------------ */

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
      await writeLog(client, req, 'user_updated', {
        targetType: 'user',
        targetId: id,
        details: `Updated ${changed.join(', ')} on ${values.name ?? account.name}`,
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
      await writeLog(client, req, suspended ? 'user_suspended' : 'user_activated', {
        targetType: 'user',
        targetId: id,
        details: rows[0].name,
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
      await writeLog(client, req, 'role_changed', {
        targetType: 'user',
        targetId: id,
        details: `${rows[0].name}: ${rows[0].role} to ${role}`,
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

/* ------------------------------------------------------------------ *
 * SUBMISSIONS
 * ------------------------------------------------------------------ */

/*
 * Approve, reject, send back to review, reopen - every move that carries no
 * more than a reason. Resolving has its own route below, because it needs a
 * summary of what was done.
 */
router.patch('/posts/:id/status', requirePermission('moderate_posts'), async (req, res, next) => {
  const id = toId(req.params.id);
  const status = String(req.body.status ?? '');
  const reason = String(req.body.reason ?? '').trim();

  if (!Object.hasOwn(STATUSES, status) || status === 'resolved') {
    return res.status(400).json({ error: 'Unknown status.' });
  }
  // A rejection the student cannot understand is the complaint this exists to
  // prevent, so the reason is required rather than optional.
  if (status === 'rejected' && !reason) {
    return res.status(400).json({
      error: 'Please give a reason. The student is shown this, so it should explain the decision.',
    });
  }

  try {
    const result = await inTransaction(async (client) => {
      const post = await lockPost(client, id);
      if (!post) return { status: 404, error: MISSING_POST };
      if (!STATUSES[post.status].next.includes(status)) {
        return { status: 409, error: cannotMove(post, `moved to ${STATUSES[status].label}`) };
      }

      await client.query(
        `UPDATE posts SET status = $1, rejection_reason = $2, updated_at = now() WHERE id = $3`,
        [status, status === 'rejected' ? reason : post.rejection_reason, post.id]
      );

      const action =
        { approved: 'post_approved', rejected: 'post_rejected' }[status] ?? 'status_changed';
      await writeLog(client, req, action, {
        targetType: 'post',
        targetId: post.id,
        details: `${post.title} to ${status}${status === 'rejected' ? ` - ${reason}` : ''}`,
      });

      const notice = {
        approved: {
          type: 'post_approved',
          title: 'Your submission was approved',
          body: `"${post.title}" is now visible on the board.`,
        },
        rejected: {
          type: 'post_rejected',
          title: 'Your submission was not approved',
          body: reason,
        },
      }[status] ?? {
        type: 'status_changed',
        title: 'Your submission was updated',
        body: `"${post.title}" is now marked ${STATUSES[status].label.toLowerCase()}.`,
      };
      await notifyAuthor(client, post, notice.type, notice);
      return {};
    });

    if (result.error) return res.status(result.status).json({ error: result.error });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

/*
 * Hand an approved submission to the department that will deal with it.
 * Assigning IS the work starting, so an approved post moves to in_progress;
 * one already in progress is simply reassigned.
 */
router.patch('/posts/:id/assign', requirePermission('manage_concerns'), async (req, res, next) => {
  const id = toId(req.params.id);
  const department = String(req.body.department ?? '');
  const assignedTo = String(req.body.assignedTo ?? '').trim();
  if (!Object.hasOwn(DEPARTMENTS, department)) {
    return res.status(400).json({ error: 'Choose a department.' });
  }
  if (assignedTo.length > 120) {
    return res.status(400).json({ error: 'Responsible staff must be 120 characters or fewer.' });
  }

  try {
    const result = await inTransaction(async (client) => {
      const post = await lockPost(client, id);
      if (!post) return { status: 404, error: MISSING_POST };
      if (!KINDS[post.kind].needsAssignment) {
        return { status: 409, error: 'This kind of submission is not assigned to a department.' };
      }
      if (!['approved', 'in_progress'].includes(post.status)) {
        return { status: 409, error: cannotMove(post, 'assigned') };
      }

      await client.query(
        `UPDATE posts
            SET department = $1, assigned_to = $2, assigned_at = now(),
                status = 'in_progress', updated_at = now()
          WHERE id = $3`,
        [department, assignedTo || null, post.id]
      );

      await writeLog(client, req, 'concern_assigned', {
        targetType: 'post',
        targetId: post.id,
        details: `${post.title} to ${DEPARTMENTS[department]}${assignedTo ? ` (${assignedTo})` : ''}`,
      });
      await notifyAuthor(client, post, 'concern_assigned', {
        title: 'Your concern has been assigned',
        body: `"${post.title}" was passed to the department handling it.`,
      });
      return {};
    });

    if (result.error) return res.status(result.status).json({ error: result.error });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.patch('/posts/:id/resolve', requirePermission('manage_concerns'), async (req, res, next) => {
  const id = toId(req.params.id);
  const resolution = String(req.body.resolution ?? '').trim();
  if (!resolution) {
    return res.status(400).json({ error: 'Please write a short summary of what was actually done.' });
  }

  try {
    const result = await inTransaction(async (client) => {
      const post = await lockPost(client, id);
      if (!post) return { status: 404, error: MISSING_POST };
      if (!['approved', 'in_progress', 'resolved'].includes(post.status)) {
        return { status: 409, error: cannotMove(post, 'resolved') };
      }

      /*
       * Correcting the summary of something already resolved keeps its
       * original resolution date. Otherwise every edit to the wording would
       * move the date forward and quietly inflate the resolution-time
       * figures on the dashboard and the Departments page.
       */
      const alreadyResolved = post.status === 'resolved' && Boolean(post.resolved_at);

      await client.query(
        `UPDATE posts
            SET status = 'resolved', resolution = $1,
                resolved_at = CASE WHEN $2::boolean THEN resolved_at ELSE now() END,
                updated_at = now()
          WHERE id = $3`,
        [resolution, alreadyResolved, post.id]
      );

      await writeLog(client, req, 'concern_resolved', {
        targetType: 'post',
        targetId: post.id,
        details: alreadyResolved ? `${post.title} - summary updated` : post.title,
      });
      await notifyAuthor(client, post, 'concern_resolved', {
        title: alreadyResolved
          ? 'The resolution of your concern was updated'
          : 'Your concern has been resolved',
        body: resolution,
      });
      return {};
    });

    if (result.error) return res.status(result.status).json({ error: result.error });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// A staff-only note. Never returned to the student.
router.post('/posts/:id/notes', requirePermission('moderate_posts'), async (req, res, next) => {
  const id = toId(req.params.id);
  const text = String(req.body.text ?? '').trim();
  if (!text) return res.status(400).json({ error: 'The note is empty.' });
  if (text.length > 2000) {
    return res.status(400).json({ error: 'Please keep a note to 2000 characters or fewer.' });
  }

  try {
    const result = await inTransaction(async (client) => {
      const post = await lockPost(client, id);
      if (!post) return { status: 404, error: MISSING_POST };

      await client.query(
        'INSERT INTO admin_notes (post_id, admin_id, admin_name, body) VALUES ($1, $2, $3, $4)',
        [post.id, req.user.id, req.user.name, text]
      );
      await client.query('UPDATE posts SET updated_at = now() WHERE id = $1', [post.id]);
      await writeLog(client, req, 'admin_note_added', {
        targetType: 'post',
        targetId: post.id,
        details: post.title,
      });
      return {};
    });

    if (result.error) return res.status(result.status).json({ error: result.error });
    res.status(201).end();
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ *
 * PRIVACY REQUESTS
 *
 * Kept apart from moderation on purpose: its own permission
 * (manage_privacy), its own log (models/privacyEvents.js). The requests and
 * the privacy log reach the panel through GET /api/state, for holders of
 * that permission only.
 * ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ *
 * THE AUDIT LOG
 * ------------------------------------------------------------------ */

/*
 * The whole log, newest first, for the activity-log export. (The screens
 * show the latest 500, which arrive with GET /api/state.)
 *
 * Readable and nothing else. There is no POST, PATCH or DELETE for it on
 * purpose - entries are only ever written by the handlers above, as part of
 * the action they record.
 */
router.get('/activity-logs', requirePermission('view_audit_log'), async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM activity_logs ORDER BY created_at DESC, id DESC');
    res.json({ entries: rows.map(shapeLogEntry) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
