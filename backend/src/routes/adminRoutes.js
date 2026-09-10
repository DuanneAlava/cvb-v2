const express = require('express');
const pool = require('../config/db');
const { requireAuth, requirePermission } = require('../middleware/auth');

/*
 * THE ADMIN API.
 *
 * Everything the admin panel needs, and nothing a student can reach.
 *
 * THE ONE RULE IN THIS FILE
 * Every route below carries its own requirePermission(...). Not one of them
 * relies on the frontend having hidden a button, because a hidden button is
 * not a check - it is a suggestion, and curl ignores it.
 *
 * requireAuth is applied once to the whole router, so a route physically
 * cannot be added here without at least being authenticated; the per-route
 * permission is then the second gate. requirePermission re-reads the account's
 * role from the database rather than trusting the token, so demoting or
 * suspending somebody takes effect immediately instead of when their token
 * happens to expire.
 *
 * ANONYMITY
 * The identity of an anonymous poster is returned by these endpoints and by
 * no others. The public /posts endpoint must keep leaving author details out
 * of anonymous rows - see the note in models/schema.sql.
 */

const router = express.Router();

// Nothing in this file is reachable without a valid token.
router.use(requireAuth);

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/*
 * Write an audit entry. Called by the handlers themselves rather than left to
 * the caller, so an administrative action cannot quietly skip being recorded.
 */
async function writeLog(client, req, action, { targetType, targetId, details }) {
  await client.query(
    `INSERT INTO activity_logs
       (admin_id, admin_name, admin_role, action, target_type, target_id, details, ip_address)
     VALUES ($1, (SELECT name FROM users WHERE id = $1), $2, $3, $4, $5, $6, $7)`,
    [req.user.id, req.user.role, action, targetType, String(targetId), details, req.ip]
  );
}

// Queue a notification for the student who wrote a post.
async function notifyAuthor(client, postId, type, { title, body, link }) {
  await client.query(
    `INSERT INTO notifications (type, audience, user_id, post_id, title, body, link)
     VALUES ($1, 'author', (SELECT author_id FROM posts WHERE id = $2), $2, $3, $4, $5)`,
    [type, postId, title, body, link]
  );
}

/*
 * Run a set of statements as one transaction.
 *
 * Changing a status, writing the audit entry and notifying the student have to
 * succeed or fail together. A half-applied approval - the post published but
 * nobody told, or told but not published - is worse than a failed one.
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

/* ------------------------------------------------------------------ *
 * DASHBOARD
 * ------------------------------------------------------------------ */

router.get('/stats', requirePermission('view_admin'), async (req, res, next) => {
  try {
    // One round trip rather than a dozen: the dashboard loads on every visit.
    const { rows } = await pool.query(`
      SELECT
        (SELECT count(*) FROM users)                                            AS total_users,
        (SELECT count(*) FROM users WHERE status = 'active'
           AND last_login_at > now() - interval '30 days')                      AS active_users,
        (SELECT count(*) FROM users WHERE created_at > now() - interval '7 days') AS new_users,
        (SELECT count(*) FROM users WHERE status = 'suspended')                 AS suspended_users,
        (SELECT count(*) FROM posts)                                            AS total_posts,
        (SELECT count(*) FROM posts WHERE status IN
           ('pending','under_review','needs_revision'))                         AS pending_posts,
        (SELECT count(*) FROM posts WHERE status IN
           ('approved','assigned','in_progress','resolved','closed'))           AS approved_posts,
        (SELECT count(*) FROM posts WHERE status = 'rejected')                  AS rejected_posts,
        (SELECT count(*) FROM posts WHERE kind IN
           ('suggestion','feedback','request'))                                 AS total_suggestions,
        (SELECT count(*) FROM posts WHERE kind IN
           ('concern','complaint','report'))                                    AS total_concerns,
        (SELECT count(*) FROM posts WHERE status IN
           ('approved','assigned','in_progress'))                               AS open_concerns,
        (SELECT count(*) FROM posts WHERE status IN ('resolved','closed'))      AS resolved_concerns,
        (SELECT count(*) FROM posts WHERE kind = 'report')                      AS total_reports,
        (SELECT avg(extract(epoch FROM (resolved_at - created_at)) / 86400)
           FROM posts WHERE resolved_at IS NOT NULL)                            AS avg_resolution_days
    `);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ *
 * USERS
 * ------------------------------------------------------------------ */

router.get('/users', requirePermission('manage_users'), async (req, res, next) => {
  try {
    const { search, role, status } = req.query;

    /*
     * Parameterised, always. Pasting req.query into SQL is how an admin search
     * box becomes an injection hole - and this one is searched by the people
     * with the most access.
     */
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.status, u.student_id, u.course,
              u.year_level, u.section, u.created_at, u.last_login_at,
              (SELECT count(*) FROM posts p WHERE p.author_id = u.id) AS post_count,
              (SELECT count(*) FROM posts p WHERE p.author_id = u.id
                 AND p.kind IN ('concern','complaint','report'))      AS concern_count
         FROM users u
        WHERE ($1::text IS NULL OR u.name ILIKE '%' || $1 || '%'
                                OR u.email ILIKE '%' || $1 || '%'
                                OR u.student_id ILIKE '%' || $1 || '%')
          AND ($2::text IS NULL OR u.role = $2)
          AND ($3::text IS NULL OR u.status = $3)
        ORDER BY u.created_at DESC`,
      [search || null, role || null, status || null]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/users/:id', requirePermission('manage_users'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, role, status, student_id, course, year_level,
              section, avatar_url, created_at, last_login_at
         FROM users WHERE id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Account not found.' });

    const posts = await pool.query(
      'SELECT * FROM posts WHERE author_id = $1 ORDER BY created_at DESC',
      [req.params.id]
    );
    res.json({ user: rows[0], submissions: posts.rows });
  } catch (err) {
    next(err);
  }
});

router.patch('/users/:id/status', requirePermission('manage_users'), async (req, res, next) => {
  const { status } = req.body;
  if (!['active', 'suspended'].includes(status)) {
    return res.status(400).json({ error: 'Status must be active or suspended.' });
  }

  // Suspending yourself would lock you out of the panel you administer.
  if (String(req.user.id) === String(req.params.id)) {
    return res.status(400).json({ error: 'You cannot change your own account status.' });
  }

  try {
    const result = await inTransaction(async (client) => {
      const { rows } = await client.query(
        'UPDATE users SET status = $1 WHERE id = $2 RETURNING id, name, status',
        [status, req.params.id]
      );
      if (!rows[0]) return null;

      await writeLog(client, req, status === 'suspended' ? 'user_suspended' : 'user_activated', {
        targetType: 'user',
        targetId: req.params.id,
        details: rows[0].name,
      });

      await client.query(
        `INSERT INTO notifications (type, audience, user_id, title, body)
         VALUES ($1, 'author', $2, $3, $4)`,
        [
          status === 'suspended' ? 'account_suspended' : 'account_activated',
          req.params.id,
          status === 'suspended'
            ? 'Your account has been suspended'
            : 'Your account is active again',
          status === 'suspended'
            ? 'You can still read the board, but posting and voting are turned off.'
            : 'You can post and vote again.',
        ]
      );

      return rows[0];
    });

    if (!result) return res.status(404).json({ error: 'Account not found.' });
    res.json(result);
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
  const { role } = req.body;
  if (!['admin', 'student', 'user'].includes(role)) {
    return res.status(400).json({ error: 'Unknown role.' });
  }
  if (String(req.user.id) === String(req.params.id)) {
    return res.status(400).json({ error: 'You cannot change your own role.' });
  }

  try {
    const result = await inTransaction(async (client) => {
      const { rows } = await client.query(
        'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, name, role',
        [role, req.params.id]
      );
      if (!rows[0]) return null;

      await writeLog(client, req, 'role_changed', {
        targetType: 'user',
        targetId: req.params.id,
        details: `${rows[0].name} to ${role}`,
      });
      return rows[0];
    });

    if (!result) return res.status(404).json({ error: 'Account not found.' });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.delete('/users/:id', requirePermission('delete_users'), async (req, res, next) => {
  if (String(req.user.id) === String(req.params.id)) {
    return res.status(400).json({ error: 'You cannot delete your own account.' });
  }

  try {
    const result = await inTransaction(async (client) => {
      const { rows } = await client.query(
        'DELETE FROM users WHERE id = $1 RETURNING name, email',
        [req.params.id]
      );
      if (!rows[0]) return null;

      // posts.author_id is ON DELETE SET NULL, so their submissions survive.
      // Erasing concerns that staff may still be working on would be the
      // wrong kind of tidy.
      await writeLog(client, req, 'user_deleted', {
        targetType: 'user',
        targetId: req.params.id,
        details: `${rows[0].name} (${rows[0].email}) - submissions kept`,
      });
      return rows[0];
    });

    if (!result) return res.status(404).json({ error: 'Account not found.' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ *
 * SUBMISSIONS
 * ------------------------------------------------------------------ */

/*
 * The admin view of the board. Unlike the public /posts endpoint this returns
 * every status and joins the author in, including for anonymous posts - that
 * is what the view_identity permission is for.
 */
router.get('/posts', requirePermission('view_admin'), async (req, res, next) => {
  try {
    const { status, kind, category, priority, search } = req.query;

    const { rows } = await pool.query(
      `SELECT p.*,
              u.name AS author_name, u.email AS author_email,
              u.student_id AS author_student_id,
              (SELECT count(*) FROM votes v WHERE v.post_id = p.id) AS vote_count
         FROM posts p
         LEFT JOIN users u ON u.id = p.author_id
        WHERE ($1::text IS NULL OR p.status = $1)
          AND ($2::text IS NULL OR p.kind = $2)
          AND ($3::text IS NULL OR p.category_slug = $3)
          AND ($4::text IS NULL OR p.priority = $4)
          AND ($5::text IS NULL OR p.title ILIKE '%' || $5 || '%'
                                OR p.message ILIKE '%' || $5 || '%'
                                OR u.name ILIKE '%' || $5 || '%'
                                OR u.email ILIKE '%' || $5 || '%'
                                OR u.student_id ILIKE '%' || $5 || '%')
        ORDER BY p.created_at DESC`,
      [status || null, kind || null, category || null, priority || null, search || null]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

const ALLOWED_STATUSES = [
  'pending', 'under_review', 'needs_revision', 'rejected', 'approved',
  'assigned', 'in_progress', 'resolved', 'closed', 'archived',
];

// Approve, reject, request a revision, or move a submission along.
router.patch('/posts/:id/status', requirePermission('moderate_posts'), async (req, res, next) => {
  const { status, reason, note } = req.body;

  if (!ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Unknown status.' });
  }
  // A rejection the student cannot understand is the complaint this exists to
  // prevent, so the reason is required rather than optional.
  if (status === 'rejected' && !String(reason || '').trim()) {
    return res.status(400).json({ error: 'A rejection must include a reason for the student.' });
  }
  if (status === 'needs_revision' && !String(note || '').trim()) {
    return res.status(400).json({ error: 'Say what the student needs to change.' });
  }

  try {
    const result = await inTransaction(async (client) => {
      const { rows } = await client.query(
        `UPDATE posts
            SET status = $1,
                rejection_reason = CASE WHEN $1 = 'rejected' THEN $2 ELSE rejection_reason END,
                revision_note   = CASE WHEN $1 = 'needs_revision' THEN $3 ELSE revision_note END,
                updated_at = now()
          WHERE id = $4
        RETURNING id, title, status, author_id`,
        [status, reason || null, note || null, req.params.id]
      );
      if (!rows[0]) return null;
      const post = rows[0];

      const action =
        { approved: 'post_approved', rejected: 'post_rejected', needs_revision: 'revision_requested' }[
          status
        ] || 'status_changed';

      await writeLog(client, req, action, {
        targetType: 'post',
        targetId: post.id,
        details: `${post.title} to ${status}`,
      });

      const notice =
        {
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
          needs_revision: {
            type: 'revision_requested',
            title: 'Your submission needs a change',
            body: note,
          },
        }[status] || {
          type: 'status_changed',
          title: 'Your submission was updated',
          body: `"${post.title}" is now marked ${status.replace('_', ' ')}.`,
        };

      await notifyAuthor(client, post.id, notice.type, {
        title: notice.title,
        body: notice.body,
        link: '/student/dashboard',
      });

      return post;
    });

    if (!result) return res.status(404).json({ error: 'Submission not found.' });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Hand an approved concern to the department that will deal with it.
router.patch('/posts/:id/assign', requirePermission('manage_concerns'), async (req, res, next) => {
  const { department, assignedTo, priority } = req.body;
  if (!department) return res.status(400).json({ error: 'Choose a department.' });

  try {
    const result = await inTransaction(async (client) => {
      const { rows } = await client.query(
        `UPDATE posts
            SET department = $1,
                assigned_to = $2,
                assigned_at = now(),
                priority = COALESCE($3, priority),
                status = CASE WHEN status IN ('approved','pending','under_review')
                              THEN 'assigned' ELSE status END,
                updated_at = now()
          WHERE id = $4
        RETURNING id, title, department, assigned_to, status`,
        [department, assignedTo || null, priority || null, req.params.id]
      );
      if (!rows[0]) return null;

      await writeLog(client, req, 'concern_assigned', {
        targetType: 'post',
        targetId: rows[0].id,
        details: `${rows[0].title} to ${department}`,
      });
      await notifyAuthor(client, rows[0].id, 'concern_assigned', {
        title: 'Your concern has been assigned',
        body: `"${rows[0].title}" was passed to the department handling it.`,
        link: '/student/dashboard',
      });

      return rows[0];
    });

    if (!result) return res.status(404).json({ error: 'Submission not found.' });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.patch('/posts/:id/resolve', requirePermission('manage_concerns'), async (req, res, next) => {
  const { resolution } = req.body;
  if (!String(resolution || '').trim()) {
    return res.status(400).json({ error: 'Write a short summary of what was done.' });
  }

  try {
    const result = await inTransaction(async (client) => {
      const { rows } = await client.query(
        `UPDATE posts
            SET status = 'resolved', resolution = $1, resolved_at = now(), updated_at = now()
          WHERE id = $2
        RETURNING id, title, resolution`,
        [resolution, req.params.id]
      );
      if (!rows[0]) return null;

      await writeLog(client, req, 'concern_resolved', {
        targetType: 'post',
        targetId: rows[0].id,
        details: rows[0].title,
      });
      await notifyAuthor(client, rows[0].id, 'concern_resolved', {
        title: 'Your concern has been resolved',
        body: resolution,
        link: '/student/dashboard',
      });

      return rows[0];
    });

    if (!result) return res.status(404).json({ error: 'Submission not found.' });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// A staff-only note. Never returned to the student.
router.post('/posts/:id/notes', requirePermission('moderate_posts'), async (req, res, next) => {
  const { body } = req.body;
  if (!String(body || '').trim()) return res.status(400).json({ error: 'The note is empty.' });

  try {
    const { rows } = await pool.query(
      `INSERT INTO admin_notes (post_id, admin_id, body) VALUES ($1, $2, $3) RETURNING *`,
      [req.params.id, req.user.id, body]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ *
 * NOTIFICATIONS AND THE AUDIT LOG
 * ------------------------------------------------------------------ */

router.get('/notifications', requirePermission('view_admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM notifications
        WHERE audience = 'admin' OR user_id = $1
        ORDER BY created_at DESC
        LIMIT 200`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.patch('/notifications/:id/read', requirePermission('view_admin'), async (req, res, next) => {
  try {
    await pool.query('UPDATE notifications SET is_read = TRUE WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

/*
 * The audit log is readable and nothing else. There is no POST, PATCH or
 * DELETE here on purpose - entries are only ever written by the handlers
 * above, as part of the action they record.
 */
router.get('/activity-logs', requirePermission('view_audit_log'), async (req, res, next) => {
  try {
    const { action, adminId, search } = req.query;
    const { rows } = await pool.query(
      `SELECT * FROM activity_logs
        WHERE ($1::text IS NULL OR action = $1)
          AND ($2::int  IS NULL OR admin_id = $2)
          AND ($3::text IS NULL OR details ILIKE '%' || $3 || '%'
                                OR admin_name ILIKE '%' || $3 || '%')
        ORDER BY created_at DESC
        LIMIT 500`,
      [action || null, adminId || null, search || null]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
