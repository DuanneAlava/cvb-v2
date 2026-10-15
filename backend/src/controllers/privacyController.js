const pool = require('../config/db');
const { logOwnChange } = require('../models/activityLog');
const { writePrivacyEvent } = require('../models/privacyEvents');
const { inTransaction } = require('../models/transaction');
const { SCHOOL_COLUMNS } = require('../models/accountRules');
const {
  POLICY_VERSIONS,
  COOKIE_CONSENT_VERSION,
  OPTIONAL_COOKIE_CATEGORIES,
  PRIVACY_REQUEST_TYPES: REQUEST_TYPES,
} = require('../models/policies');
const { iso, str, toId } = require('../models/shape');

/*
 * A SIGNED-IN PERSON'S PRIVACY CHOICES AND RIGHTS - the server side of the
 * "Privacy & Data" section of the account page.
 *
 * Every function here acts on req.user - the account the token belongs to -
 * and never on an id sent in the request (a request id is only ever looked
 * up together with the asker's own id), so nobody can see or change another
 * person's choices or requests through these. What administrators do with a
 * request is in routes/adminRoutes.js, behind the manage_privacy permission.
 */

const RELOAD =
  'This was updated while your page was open. Reload the page, read it again, and try once more.';

/* ------------------------------------------------------------------ *
 * THE TERMS
 * ------------------------------------------------------------------ */

/*
 * POST /api/account/terms - { version, keepSchoolDetails }
 *
 * Accepting the current Terms from the "Terms updated" dialog, for an
 * account that has not yet accepted the version it now needs
 * (models/policies.js). Recorded once, however many times it is sent.
 *
 * An account made before school details needed consent may hold them
 * without it. The same dialog asks, separately: keepSchoolDetails true
 * records that consent; anything else removes the details, because there
 * would be nothing to keep them on.
 */
async function acceptTerms(req, res, next) {
  try {
    if (req.body.version !== POLICY_VERSIONS.terms) return res.status(409).json({ error: RELOAD });

    await inTransaction(async (client) => {
      await client.query(
        `INSERT INTO policy_acceptances (user_id, document, version, action)
         VALUES ($1, 'terms', $2, 'accepted')
         ON CONFLICT (user_id, document, version) WHERE action IN ('accepted', 'acknowledged') DO NOTHING`,
        [req.user.id, POLICY_VERSIONS.terms]
      );

      const { rows } = await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [req.user.id]);
      const account = rows[0];
      const holdsSchoolDetails = SCHOOL_COLUMNS.some((column) => account[column]);
      if (!holdsSchoolDetails || account.school_consent_at) return;

      if (req.body.keepSchoolDetails === true) {
        await grantSchoolConsent(client, req.user.id);
      } else {
        await clearSchoolDetails(client, req.user.id);
        await logOwnChange(client, req, `Removed school details on ${account.name} - not agreed to keep them`);
      }
    });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

/* ------------------------------------------------------------------ *
 * THE OPTIONAL CONSENT FOR SCHOOL DETAILS
 * ------------------------------------------------------------------ */

async function grantSchoolConsent(client, userId) {
  await client.query(
    'UPDATE users SET school_consent_version = $2, school_consent_at = now() WHERE id = $1',
    [userId, POLICY_VERSIONS.privacy]
  );
  await client.query(
    "INSERT INTO policy_acceptances (user_id, document, version, action) VALUES ($1, 'school_details', $2, 'granted')",
    [userId, POLICY_VERSIONS.privacy]
  );
}

async function clearSchoolDetails(client, userId) {
  await client.query(
    `UPDATE users
        SET ${SCHOOL_COLUMNS.map((column) => `${column} = NULL`).join(', ')},
            school_consent_version = NULL, school_consent_at = NULL
      WHERE id = $1`,
    [userId]
  );
}

/*
 * PUT /api/account/school-consent - { granted, version }
 *
 * Giving the consent, or withdrawing it. Withdrawing removes the school
 * details at once - consent is the only reason they are kept - and is as
 * easy as giving it. A request that changes nothing records nothing.
 */
async function setSchoolConsent(req, res, next) {
  try {
    const granted = req.body.granted === true;
    if (granted && req.body.version !== POLICY_VERSIONS.privacy) {
      return res.status(409).json({ error: RELOAD });
    }

    await inTransaction(async (client) => {
      const { rows } = await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [req.user.id]);
      const account = rows[0];
      const hasConsent = Boolean(account.school_consent_at);

      if (granted && !hasConsent) {
        await grantSchoolConsent(client, req.user.id);
      }
      if (!granted && hasConsent) {
        await clearSchoolDetails(client, req.user.id);
        await client.query(
          "INSERT INTO policy_acceptances (user_id, document, version, action) VALUES ($1, 'school_details', $2, 'withdrawn')",
          [req.user.id, account.school_consent_version]
        );
        await logOwnChange(client, req, `Withdrew consent for school details on ${account.name} - school details removed`);
      }
    });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

/* ------------------------------------------------------------------ *
 * COOKIE AND STORAGE CHOICES
 * ------------------------------------------------------------------ */

/*
 * PUT /api/account/cookie-consent - { version, categories: { functional } }
 *
 * The choice made in the cookie window, kept with the account so it follows
 * the person to another device. Only the version, the yes/no for each
 * optional category and the time are stored - no device, browser or address.
 */
async function setCookieConsent(req, res, next) {
  try {
    if (req.body.version !== COOKIE_CONSENT_VERSION) return res.status(409).json({ error: RELOAD });

    const chosen = req.body.categories ?? {};
    const categories = Object.fromEntries(
      OPTIONAL_COOKIE_CATEGORIES.map((category) => [category, chosen[category] === true])
    );
    const consent = { version: COOKIE_CONSENT_VERSION, categories, decidedAt: new Date().toISOString() };

    await pool.query('UPDATE users SET cookie_consent = $2 WHERE id = $1', [req.user.id, consent]);
    res.json({ cookieConsent: consent });
  } catch (err) {
    next(err);
  }
}

/* ------------------------------------------------------------------ *
 * A COPY OF EVERYTHING HELD ABOUT THE ACCOUNT
 * ------------------------------------------------------------------ */

const dataUrl = (type, data) => (data ? `data:${type};base64,${data.toString('base64')}` : null);

/*
 * GET /api/account/export - the person's own data, as one JSON file.
 *
 * Self-service, so the right of access needs nobody's permission: the
 * account, the choices made, every post (with its files), the votes cast,
 * the notifications received, the person's own activity-log entries and
 * their privacy requests. Not included: other people's data, and the staff's
 * internal notes on the person's posts - whether those must be disclosed is
 * left to a formal access request and the Data Protection Officer.
 */
async function exportMyData(req, res, next) {
  try {
    const id = req.user.id;
    const [account, posts, files, votes, notifications, activity, acceptances, requests] =
      await Promise.all([
        pool.query('SELECT * FROM users WHERE id = $1', [id]),
        pool.query('SELECT * FROM posts WHERE author_id = $1 ORDER BY created_at', [id]),
        pool.query(
          `SELECT a.post_id, a.file_name, a.mime_type, a.byte_size, a.data
             FROM attachments a JOIN posts p ON p.id = a.post_id
            WHERE p.author_id = $1 ORDER BY a.id`,
          [id]
        ),
        pool.query(
          `SELECT v.post_id, p.title, v.created_at
             FROM votes v JOIN posts p ON p.id = v.post_id
            WHERE v.user_id = $1 ORDER BY v.created_at`,
          [id]
        ),
        pool.query('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at', [id]),
        pool.query(
          'SELECT action, details, ip_address, created_at FROM activity_logs WHERE admin_id = $1 ORDER BY created_at',
          [id]
        ),
        pool.query('SELECT * FROM policy_acceptances WHERE user_id = $1 ORDER BY created_at, id', [id]),
        pool.query('SELECT * FROM privacy_requests WHERE user_id = $1 ORDER BY created_at', [id]),
      ]);

    const user = account.rows[0];
    const filesByPost = new Map();
    for (const file of files.rows) {
      if (!filesByPost.has(file.post_id)) filesByPost.set(file.post_id, []);
      filesByPost.get(file.post_id).push({
        name: file.file_name,
        type: file.mime_type,
        bytes: file.byte_size,
        contents: dataUrl(file.mime_type, file.data),
      });
    }

    const exported = {
      about:
        'Everything CampusVoiceBox holds about your account, as of exportedAt. Files are included as data URLs. Internal staff notes on your posts are not included; ask for them with an access request on the Privacy & Data page.',
      exportedAt: new Date().toISOString(),
      account: {
        id: str(user.id),
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        studentId: user.student_id,
        course: user.course,
        yearLevel: user.year_level,
        section: user.section,
        profilePhoto: dataUrl(user.photo_type, user.photo),
        createdAt: iso(user.created_at),
        lastLogin: iso(user.last_login_at),
      },
      choices: {
        schoolDetailsConsent: user.school_consent_at
          ? { privacyPolicyVersion: user.school_consent_version, givenAt: iso(user.school_consent_at) }
          : null,
        cookieConsent: user.cookie_consent,
        history: acceptances.rows.map((row) => ({
          document: row.document,
          version: row.version,
          action: row.action,
          at: iso(row.created_at),
        })),
      },
      posts: posts.rows.map((post) => ({
        id: str(post.id),
        kind: post.kind,
        category: post.category_slug,
        title: post.title,
        message: post.message,
        anonymous: post.is_anonymous,
        status: post.status,
        rejectionReason: post.rejection_reason,
        department: post.department,
        assignedTo: post.assigned_to,
        assignedAt: iso(post.assigned_at),
        resolution: post.resolution,
        resolvedAt: iso(post.resolved_at),
        createdAt: iso(post.created_at),
        updatedAt: iso(post.updated_at),
        attachments: filesByPost.get(post.id) ?? [],
      })),
      votes: votes.rows.map((vote) => ({
        postId: str(vote.post_id),
        postTitle: vote.title,
        votedAt: iso(vote.created_at),
      })),
      notifications: notifications.rows.map((note) => ({
        type: note.type,
        title: note.title,
        body: note.body,
        read: note.is_read,
        at: iso(note.created_at),
      })),
      activity: activity.rows.map((entry) => ({
        action: entry.action,
        details: entry.details,
        ipAddress: entry.ip_address,
        at: iso(entry.created_at),
      })),
      privacyRequests: requests.rows.map((request) => ({
        type: request.type,
        details: request.details,
        status: request.status,
        response: request.response,
        createdAt: iso(request.created_at),
        resolvedAt: iso(request.resolved_at),
      })),
    };

    await writePrivacyEvent(pool, {
      actor: req.user,
      action: 'data_exported',
      subjectName: req.user.name,
    });

    const day = new Date().toISOString().slice(0, 10);
    res.set({
      'Content-Disposition': `attachment; filename="campusvoicebox-my-data-${day}.json"`,
      'Cache-Control': 'no-store',
    });
    res.json(exported);
  } catch (err) {
    next(err);
  }
}

/* ------------------------------------------------------------------ *
 * PRIVACY REQUESTS
 * ------------------------------------------------------------------ */

/*
 * POST /api/privacy-requests - { type, details }
 *
 * Asking for something the page cannot do by itself: a copy of information
 * beyond the download, a correction to something the person cannot edit
 * (their email, say), the deletion of their account, or another privacy
 * matter. An administrator holding manage_privacy handles it. One open
 * request per type.
 */
async function createRequest(req, res, next) {
  try {
    const type = String(req.body.type ?? '');
    const details = String(req.body.details ?? '').trim();

    if (!Object.hasOwn(REQUEST_TYPES, type)) {
      return res.status(400).json({ error: 'Choose what you are asking for.' });
    }
    if ((type === 'correction' || type === 'other') && !details) {
      return res.status(400).json({
        error:
          type === 'correction'
            ? 'Say what is wrong and what it should say.'
            : 'Please describe what you are asking for.',
      });
    }
    if (details.length > 2000) {
      return res.status(400).json({ error: 'Please keep the details to 2000 characters or fewer.' });
    }

    const created = await inTransaction(async (client) => {
      const open = await client.query(
        "SELECT 1 FROM privacy_requests WHERE user_id = $1 AND type = $2 AND status IN ('pending', 'in_progress')",
        [req.user.id, type]
      );
      if (open.rows.length > 0) return null;

      const { rows } = await client.query(
        `INSERT INTO privacy_requests (user_id, requester_name, requester_email, type, details)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [req.user.id, req.user.name, req.user.email, type, details || null]
      );
      await writePrivacyEvent(client, {
        actor: req.user,
        action: 'request_submitted',
        requestId: rows[0].id,
        subjectName: req.user.name,
        details: `${REQUEST_TYPES[type]} request`,
      });
      return rows[0];
    });

    if (!created) {
      return res.status(409).json({
        error: `You already have an open ${REQUEST_TYPES[type]} request. You can follow it below.`,
      });
    }
    res.status(201).json({ id: str(created.id) });
  } catch (err) {
    next(err);
  }
}

// POST /api/privacy-requests/:id/cancel - only the asker's own, only while pending.
async function cancelRequest(req, res, next) {
  try {
    const id = toId(req.params.id);
    const done = await inTransaction(async (client) => {
      const { rows } = await client.query(
        `UPDATE privacy_requests SET status = 'cancelled', updated_at = now(), resolved_at = now()
          WHERE id = $1 AND user_id = $2 AND status = 'pending'
        RETURNING id, type`,
        [id, req.user.id]
      );
      if (!rows[0]) return false;
      await writePrivacyEvent(client, {
        actor: req.user,
        action: 'request_cancelled',
        requestId: rows[0].id,
        subjectName: req.user.name,
        details: `${REQUEST_TYPES[rows[0].type]} request`,
      });
      return true;
    });

    if (!done) {
      return res
        .status(409)
        .json({ error: 'Only a request that nobody has started on yet can be cancelled.' });
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  acceptTerms,
  setSchoolConsent,
  setCookieConsent,
  exportMyData,
  createRequest,
  cancelRequest,
};
