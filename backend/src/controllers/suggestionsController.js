const pool = require('../config/db');

const MIN_LENGTH = 10;

// Shared SELECT used by both listPosts and createPost so the two endpoints
// always return posts shaped the same way for the frontend.
const POST_SELECT = `
  SELECT
    p.id,
    p.type,
    p.category_slug AS category,
    p.message,
    p.status,
    p.created_at AS "createdAt",
    CASE WHEN p.is_anonymous OR p.author_id IS NULL THEN 'Anonymous student'
         ELSE u.name END AS author,
    COUNT(v.user_id)::int AS votes
  FROM posts p
  LEFT JOIN users u ON u.id = p.author_id
  LEFT JOIN votes v ON v.post_id = p.id
`;
const POST_GROUP_ORDER = `
  GROUP BY p.id, u.name
  ORDER BY p.created_at DESC
`;

// GET /api/categories
async function listCategories(req, res, next) {
  try {
    const result = await pool.query('SELECT slug, label FROM categories ORDER BY label');
    res.json({ categories: result.rows });
  } catch (err) {
    next(err);
  }
}

// GET /api/posts?category=safety&search=lighting
// Works for guests too (attachUserIfPresent), so `hasVoted` is only
// computed when a token was sent, and is false for anonymous visitors.
async function listPosts(req, res, next) {
  try {
    const { category, search } = req.query;
    const conditions = [];
    const values = [];

    if (category) {
      values.push(category);
      conditions.push(`p.category_slug = $${values.length}`);
    }
    if (search) {
      values.push(`%${search}%`);
      conditions.push(`p.message ILIKE $${values.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `${POST_SELECT} ${where} ${POST_GROUP_ORDER}`,
      values
    );

    let votedIds = [];
    if (req.user) {
      const voted = await pool.query('SELECT post_id FROM votes WHERE user_id = $1', [
        req.user.id,
      ]);
      votedIds = voted.rows.map((r) => r.post_id);
    }

    const posts = result.rows.map((row) => ({ ...row, hasVoted: votedIds.includes(row.id) }));
    res.json({ posts });
  } catch (err) {
    next(err);
  }
}

// POST /api/posts  (requires login - mirrors the frontend sending guests to /login first)
async function createPost(req, res, next) {
  try {
    const { type, category, message, anonymous } = req.body;

    if (!['suggestion', 'voice'].includes(type)) {
      return res.status(400).json({ error: "Type must be 'suggestion' or 'voice'." });
    }
    const trimmed = String(message || '').trim();
    if (trimmed.length < MIN_LENGTH) {
      return res
        .status(400)
        .json({ error: `Please write at least ${MIN_LENGTH} characters so we understand you.` });
    }

    const categoryRow = await pool.query('SELECT slug FROM categories WHERE slug = $1', [
      category,
    ]);
    if (categoryRow.rows.length === 0) {
      return res.status(400).json({ error: 'Unknown category.' });
    }

    const inserted = await pool.query(
      `INSERT INTO posts (type, category_slug, author_id, is_anonymous, message)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [type, category, req.user.id, Boolean(anonymous) || type === 'voice', trimmed]
    );
    const postId = inserted.rows[0].id;

    // A new post starts with the author's own vote, same as the frontend mock behaviour.
    await pool.query(
      'INSERT INTO votes (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.user.id, postId]
    );

    const full = await pool.query(`${POST_SELECT} WHERE p.id = $1 ${POST_GROUP_ORDER}`, [postId]);
    res.status(201).json({ post: { ...full.rows[0], hasVoted: true } });
  } catch (err) {
    next(err);
  }
}

// POST /api/posts/:id/vote  (toggles: casts the vote, or removes it if already cast)
async function toggleVote(req, res, next) {
  try {
    const postId = Number(req.params.id);

    const existing = await pool.query(
      'SELECT 1 FROM votes WHERE user_id = $1 AND post_id = $2',
      [req.user.id, postId]
    );

    if (existing.rows.length > 0) {
      await pool.query('DELETE FROM votes WHERE user_id = $1 AND post_id = $2', [
        req.user.id,
        postId,
      ]);
    } else {
      await pool.query(
        'INSERT INTO votes (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [req.user.id, postId]
      );
    }

    const countResult = await pool.query('SELECT COUNT(*)::int AS votes FROM votes WHERE post_id = $1', [
      postId,
    ]);

    res.json({ postId, votes: countResult.rows[0].votes, hasVoted: existing.rows.length === 0 });
  } catch (err) {
    next(err);
  }
}

module.exports = { listCategories, listPosts, createPost, toggleVote };
