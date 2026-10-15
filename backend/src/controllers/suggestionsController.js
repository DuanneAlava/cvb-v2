const pool = require('../config/db');
const { can } = require('../middleware/auth');
const { KINDS, PUBLIC_STATUSES } = require('../models/workflow');
const { checkFields, rejectionMessage } = require('../models/moderation');
const { readAttachments, sendFile } = require('../models/files');
const { inTransaction } = require('../models/transaction');
const { str, toId } = require('../models/shape');

/*
 * Posting, voting, and the files attached to posts. What the board shows is
 * read from GET /api/state (controllers/stateController.js).
 */

// The same limits as the posting form in frontend/src/components/PostModal.jsx,
// so the API never accepts something the form itself would have refused.
const MIN_TITLE = 5;
const MAX_TITLE = 80;
const MIN_MESSAGE = 10;
const MAX_MESSAGE = 5000;

// POST /api/posts  (signed in, allowed to post - see routes/suggestionsRoutes.js)
// Body: { kind, category, title, message, anonymous, attachments: [{ name, dataUrl }] }
async function createPost(req, res, next) {
  try {
    const kind = String(req.body.kind ?? '');
    const category = String(req.body.category ?? '');
    const title = String(req.body.title ?? '').trim();
    const message = String(req.body.message ?? '').trim();

    if (!Object.hasOwn(KINDS, kind)) {
      return res.status(400).json({ error: 'Please choose the type of submission.' });
    }
    if (title.length < MIN_TITLE) {
      return res
        .status(400)
        .json({ error: `Please write a title of at least ${MIN_TITLE} characters.` });
    }
    if (title.length > MAX_TITLE) {
      return res
        .status(400)
        .json({ error: `Please keep the title to ${MAX_TITLE} characters or fewer.` });
    }
    if (message.length < MIN_MESSAGE) {
      return res
        .status(400)
        .json({ error: `Please write at least ${MIN_MESSAGE} characters so we understand you.` });
    }
    if (message.length > MAX_MESSAGE) {
      return res
        .status(400)
        .json({ error: `Please keep your message to ${MAX_MESSAGE} characters or fewer.` });
    }

    // The rudeness filter, again - the form ran it already, but a request
    // sent without the form never did. The message names no words.
    if (!checkFields(title, message).clean) {
      return res.status(400).json({ error: rejectionMessage() });
    }

    const categoryRow = await pool.query('SELECT 1 FROM categories WHERE slug = $1', [category]);
    if (categoryRow.rows.length === 0) {
      return res.status(400).json({ error: 'Unknown category.' });
    }

    const { files, error } = readAttachments(req.body.attachments);
    if (error) return res.status(400).json({ error });

    /*
     * No status is written, so the post takes the column's 'pending' default:
     * it waits for an administrator and does not appear on the board until
     * one approves it. Anonymous only when the student ticked the box - it
     * is their choice, for every kind of submission.
     *
     * NO NOTIFICATION TO ADMINS. A new post is pending by definition, so it
     * is already the newest row in the Pending Approval queue, whose badge
     * counts it. A notification would say the same thing twice.
     */
    const postId = await inTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO posts (kind, category_slug, author_id, is_anonymous, title, message)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [kind, category, req.user.id, req.body.anonymous === true, title, message]
      );
      for (const file of files) {
        await client.query(
          `INSERT INTO attachments (post_id, file_name, mime_type, byte_size, data)
           VALUES ($1, $2, $3, $4, $5)`,
          [rows[0].id, file.name, file.type, file.data.length, file.data]
        );
      }
      return rows[0].id;
    });

    res.status(201).json({ id: str(postId) });
  } catch (err) {
    next(err);
  }
}

// POST /api/posts/:id/vote  (toggles: casts the vote, or takes it back)
// Only posts on the public board can be voted on.
async function toggleVote(req, res, next) {
  try {
    const postId = toId(req.params.id);

    /*
     * The post must exist AND be public. A pending or rejected post answers
     * exactly like a post that does not exist, so voting cannot be used to
     * find out which unpublished posts there are.
     */
    const post = postId
      ? await pool.query('SELECT 1 FROM posts WHERE id = $1 AND status = ANY($2)', [
          postId,
          PUBLIC_STATUSES,
        ])
      : { rows: [] };
    if (post.rows.length === 0) {
      return res.status(404).json({ error: 'That post is not on the board.' });
    }

    // Take the vote back if there is one; otherwise cast it. ON CONFLICT
    // covers a double-click arriving twice: the second insert does nothing.
    const removed = await pool.query('DELETE FROM votes WHERE user_id = $1 AND post_id = $2', [
      req.user.id,
      postId,
    ]);
    if (removed.rowCount === 0) {
      await pool.query(
        'INSERT INTO votes (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [req.user.id, postId]
      );
    }

    const count = await pool.query('SELECT count(*)::int AS votes FROM votes WHERE post_id = $1', [
      postId,
    ]);
    res.json({ votes: count.rows[0].votes, hasVoted: removed.rowCount === 0 });
  } catch (err) {
    next(err);
  }
}

/*
 * GET /api/attachments/:id - one attached photo or PDF.
 *
 * A file on a published post is as public as the post. A file on anything
 * else - pending, rejected - is for its author and for staff only, and to
 * everybody else it does not exist.
 */
async function getAttachment(req, res, next) {
  try {
    const id = toId(req.params.id);
    const { rows } = id
      ? await pool.query(
          `SELECT a.file_name, a.mime_type, a.data, p.status, p.author_id
             FROM attachments a JOIN posts p ON p.id = a.post_id
            WHERE a.id = $1`,
          [id]
        )
      : { rows: [] };
    const file = rows[0];

    const allowed =
      file &&
      (PUBLIC_STATUSES.includes(file.status) ||
        (req.user && (req.user.id === file.author_id || can(req.user, 'view_admin'))));
    if (!allowed) return res.status(404).json({ error: 'Not found.' });

    sendFile(res, { name: file.file_name, type: file.mime_type, data: file.data });
  } catch (err) {
    next(err);
  }
}

module.exports = { createPost, toggleVote, getAttachment };
