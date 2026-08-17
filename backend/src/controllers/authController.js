const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// At least 8 characters, with one letter and one number - same rule the
// frontend's Signup.jsx already enforces, kept in sync here so the API
// never accepts something the UI itself would have rejected.
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function publicUser(row) {
  return { id: row.id, name: row.name, email: row.email };
}

// POST /api/auth/register
async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Please enter your full name.' });
    }
    if (!EMAIL_PATTERN.test(String(email || '').trim())) {
      return res.status(400).json({ error: 'Please enter a valid school email address.' });
    }
    if (!PASSWORD_PATTERN.test(String(password || ''))) {
      return res
        .status(400)
        .json({ error: 'Use at least 8 characters, with one letter and one number.' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [
      email.trim().toLowerCase(),
    ]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with that school email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email`,
      [name.trim(), email.trim().toLowerCase(), passwordHash]
    );

    const user = result.rows[0];
    const token = signToken(user);
    res.status(201).json({ user: publicUser(user), token });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/login
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Please fill in both fields.' });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [
      String(email).trim().toLowerCase(),
    ]);
    const user = result.rows[0];

    // Deliberately vague message so we never reveal which accounts exist.
    const genericError = 'That email and password do not match an account.';
    if (!user) return res.status(401).json({ error: genericError });

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) return res.status(401).json({ error: genericError });

    const token = signToken(user);
    res.json({ user: publicUser(user), token });
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/me  (requires a valid Bearer token)
async function me(req, res, next) {
  try {
    const result = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [
      req.user.id,
    ]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    res.json({ user: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, me };
