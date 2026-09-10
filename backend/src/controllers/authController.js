const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// At least 8 characters, with one letter and one number - same rule the
// frontend's Signup.jsx already enforces, kept in sync here so the API
// never accepts something the UI itself would have rejected.
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

function signToken(user) {
  /*
   * The role travels in the token so cheap checks can read it without a query.
   * It is a HINT, not the authority: a token minted an hour ago still claims
   * "admin" after the account was demoted or suspended, so every admin route
   * re-reads the role from the database (middleware/auth.js requirePermission).
   */
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

/*
 * What is safe to send back about an account.
 *
 * Built as an allow-list rather than by deleting password_hash from the row:
 * a column added to the table later is then excluded by default instead of
 * being leaked until somebody notices.
 */
function publicUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    studentId: row.student_id ?? '',
    course: row.course ?? '',
    yearLevel: row.year_level ?? '',
    section: row.section ?? '',
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

// POST /api/auth/register
async function register(req, res, next) {
  try {
    const { name, email, password, studentId, course, yearLevel, section } = req.body;

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
      /*
       * The role column is deliberately absent from this INSERT, so it takes
       * its 'student' default. Registration must never be able to choose a
       * role - if it could, every permission check in the system would be
       * decorative, because anyone could sign up as an admin.
       */
      `INSERT INTO users (name, email, password_hash, student_id, course, year_level, section)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, email, role, status, student_id, course, year_level, section, created_at`,
      [
        name.trim(),
        email.trim().toLowerCase(),
        passwordHash,
        studentId || null,
        course || null,
        yearLevel || null,
        section || null,
      ]
    );

    const user = result.rows[0];

    // Tell the admin panel somebody registered.
    await pool.query(
      `INSERT INTO notifications (type, audience, title, body, link)
       VALUES ('user_registered', 'admin', 'New user registered', $1, $2)`,
      [`${user.name} (${user.email}) created an account.`, `/admin/users/${user.id}`]
    );

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

    /*
     * A suspended account is refused here as well as at every admin route.
     * Checking it once at the door is not enough on its own - an account can
     * be suspended after signing in - but refusing the sign-in stops a new
     * token being minted for it in the first place.
     */
    if (user.status === 'suspended') {
      return res.status(403).json({
        error: 'This account has been suspended. Please contact the Student Affairs office.',
      });
    }

    await pool.query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);

    // Sign-ins go in the audit log too, so "who was in the panel and when" has
    // an answer.
    await pool.query(
      `INSERT INTO activity_logs (admin_id, admin_name, admin_role, action, target_type, target_id, details, ip_address)
       VALUES ($1, $2, $3, 'login', 'user', $4, $5, $6)`,
      [user.id, user.name, user.role, String(user.id), user.email, req.ip]
    );

    const token = signToken(user);
    res.json({ user: publicUser(user), token });
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/me  (requires a valid Bearer token)
async function me(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT id, name, email, role, status, student_id, course, year_level, section,
              created_at, last_login_at
         FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    res.json({ user: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, me };
