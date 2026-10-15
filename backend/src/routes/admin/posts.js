const express = require('express');
const { requirePermission } = require('../../middleware/auth');
const { STATUSES, KINDS, DEPARTMENTS } = require('../../models/workflow');
const { logAs } = require('../../models/activityLog');
const { inTransaction } = require('../../models/transaction');
const { toId } = require('../../models/shape');

/*
 * SUBMISSIONS - the review workflow: approving, rejecting and every other
 * status move, assigning to a department, resolving, and staff-only notes.
 * Part of the admin API: see index.js beside this file for the rules every
 * route here follows.
 */

const router = express.Router();

const MISSING_POST = 'That submission no longer exists.';

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
      await logAs(client, req.user, action, {
        targetType: 'post',
        targetId: post.id,
        details: `${post.title} to ${status}${status === 'rejected' ? ` - ${reason}` : ''}`,
        req,
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

      await logAs(client, req.user, 'concern_assigned', {
        targetType: 'post',
        targetId: post.id,
        details: `${post.title} to ${DEPARTMENTS[department]}${assignedTo ? ` (${assignedTo})` : ''}`,
        req,
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

      await logAs(client, req.user, 'concern_resolved', {
        targetType: 'post',
        targetId: post.id,
        details: alreadyResolved ? `${post.title} - summary updated` : post.title,
        req,
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
      await logAs(client, req.user, 'admin_note_added', {
        targetType: 'post',
        targetId: post.id,
        details: post.title,
        req,
      });
      return {};
    });

    if (result.error) return res.status(result.status).json({ error: result.error });
    res.status(201).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
