const pool = require('../config/db');
const { SIGNED_OUT, can } = require('../middleware/auth');
const { PUBLIC_STATUSES } = require('../models/workflow');
const { mustAcceptTerms } = require('../models/policies');
const {
  str,
  iso,
  shapeUser,
  shapeNotification,
  shapeLogEntry,
  shapePrivacyRequest,
  shapePrivacyEvent,
} = require('../models/shape');

/*
 * GET /api/state - EVERYTHING ONE PERSON IS ALLOWED TO SEE, IN ONE ANSWER.
 *
 * The website holds one copy of the platform's records and every screen
 * reads from it (frontend/src/services/store.js). This is where that copy
 * comes from, and it is re-fetched after every change and every few seconds,
 * so a moderator's approval reaches the student's board without anybody
 * reloading.
 *
 * WHAT EACH PERSON IS SENT - the whole point of this file is what it leaves
 * out:
 *
 *   a visitor        the published posts, with no author behind an
 *                    anonymous one
 *   a student/user   the same, plus their own posts in every status, their
 *                    own account and their own notifications
 *   an administrator everything: every post with its author (anonymous or
 *                    not) and internal notes, every account, the admin
 *                    notifications and the activity log
 *
 * Votes arrive as a count per post plus whether THIS person voted - never
 * who else did. A suspended account is sent what a visitor-with-an-account
 * is sent, whatever its role: suspended accounts may do nothing (see can()
 * in middleware/auth.js), and that includes reading the admin panel.
 *
 * The activity log and the notifications are the most recent 500 and 300 -
 * what the screens list - with `auditTotal`, the size of the whole log. The
 * full log is downloaded from GET /api/admin/activity-logs when it is
 * exported.
 *
 * PRIVACY. A signed-in person is also sent `privacy`: their own choices, the
 * history of what they accepted, and their own privacy requests - nobody
 * else's. Only a holder of manage_privacy is sent everybody's requests and
 * the privacy log (`privacyRequests`, `privacyEvents`); the other
 * administrators are sent neither, and nobody is sent other people's
 * consent records at all.
 */

const LOG_LIMIT = 500;
const NOTIFICATION_LIMIT = 300;
const PRIVACY_EVENT_LIMIT = 300;
const NONE = { rows: [] };

async function getState(req, res, next) {
  try {
    // A token was sent but is no longer good: say so, and the browser forgets it.
    if (req.signedOut) return res.status(401).json({ error: SIGNED_OUT });

    const viewer = req.user;
    const viewerId = viewer?.id ?? null;
    const isAdmin = can(viewer, 'view_admin');
    const seesIdentity = can(viewer, 'view_identity');

    // $1 every post (admins), $2 the viewer's own, $3 the published ones.
    const posts = await pool.query(
      `SELECT p.*, u.name AS author_name,
              (SELECT count(*)::int FROM votes v WHERE v.post_id = p.id) AS vote_count,
              EXISTS (SELECT 1 FROM votes v WHERE v.post_id = p.id AND v.user_id = $2) AS has_voted
         FROM posts p
         LEFT JOIN users u ON u.id = p.author_id
        WHERE $1::boolean OR p.author_id = $2 OR p.status = ANY($3)
        ORDER BY p.created_at DESC, p.id DESC`,
      [isAdmin, viewerId, PUBLIC_STATUSES]
    );
    const postIds = posts.rows.map((row) => row.id);

    const seesPrivacy = can(viewer, 'manage_privacy');

    const [
      attachments,
      notes,
      users,
      notifications,
      audit,
      own,
      acceptances,
      ownRequests,
      allRequests,
      privacyEvents,
    ] = await Promise.all([
      // Only what describes each file. The file itself is fetched on its own,
      // from GET /api/attachments/:id, when a screen shows it.
      pool.query(
        `SELECT id, post_id, file_name, mime_type, byte_size
           FROM attachments WHERE post_id = ANY($1) ORDER BY id`,
        [postIds]
      ),
      isAdmin
        ? pool.query('SELECT id, post_id, admin_name, body, created_at FROM admin_notes ORDER BY id')
        : { rows: [] },
      // Every account for an administrator; otherwise only the viewer's own.
      pool.query(
        `SELECT u.id, u.name, u.email, u.role, u.status, u.student_id, u.course, u.year_level,
                u.section, u.photo IS NOT NULL AS has_photo, u.photo_updated_at,
                (SELECT count(*)::int FROM votes v WHERE v.user_id = u.id) AS votes_cast,
                u.created_at, u.last_login_at
           FROM users u
          WHERE $1::boolean OR u.id = $2
          ORDER BY u.id`,
        [isAdmin, viewerId]
      ),
      // Their own, plus the admin feed if they can open the admin panel.
      pool.query(
        `SELECT * FROM notifications
          WHERE (audience = 'author' AND user_id = $2) OR (audience = 'admin' AND $1::boolean)
          ORDER BY created_at DESC, id DESC
          LIMIT ${NOTIFICATION_LIMIT}`,
        [isAdmin, viewerId]
      ),
      // The latest entries, and how many there are in all - the export says
      // how many rows the full download will have.
      can(viewer, 'view_audit_log')
        ? pool.query(
            `SELECT *, count(*) OVER ()::int AS total FROM activity_logs
              ORDER BY created_at DESC, id DESC LIMIT ${LOG_LIMIT}`
          )
        : { rows: [] },
      // The viewer's own choices and requests (see PRIVACY above).
      viewer
        ? pool.query(
            `SELECT school_consent_version, school_consent_at, cookie_consent,
                    (student_id IS NOT NULL OR course IS NOT NULL OR year_level IS NOT NULL
                     OR section IS NOT NULL) AS has_school_details
               FROM users WHERE id = $1`,
            [viewerId]
          )
        : NONE,
      viewer
        ? pool.query(
            'SELECT document, version, action, created_at FROM policy_acceptances WHERE user_id = $1 ORDER BY created_at DESC, id DESC',
            [viewerId]
          )
        : NONE,
      viewer
        ? pool.query('SELECT * FROM privacy_requests WHERE user_id = $1 ORDER BY created_at DESC, id DESC', [viewerId])
        : NONE,
      seesPrivacy
        ? pool.query('SELECT * FROM privacy_requests ORDER BY created_at DESC, id DESC')
        : NONE,
      seesPrivacy
        ? pool.query(
            `SELECT * FROM privacy_events ORDER BY created_at DESC, id DESC LIMIT ${PRIVACY_EVENT_LIMIT}`
          )
        : NONE,
    ]);

    const filesByPost = groupBy(attachments.rows, (file) => ({
      id: str(file.id),
      name: file.file_name,
      type: file.mime_type,
      size: file.byte_size,
      url: `/attachments/${file.id}`,
    }));
    const notesByPost = groupBy(notes.rows, (note) => ({
      id: str(note.id),
      author: note.admin_name,
      text: note.body,
      createdAt: iso(note.created_at),
    }));

    res.set('Cache-Control', 'no-cache');
    res.json({
      viewerId: viewerId === null ? null : str(viewerId),
      users: users.rows.map(shapeUser),
      posts: posts.rows.map((row) => {
        const own = viewerId !== null && row.author_id === viewerId;
        // How it was handled is for the student who wrote it and for staff.
        const followUp = isAdmin || own;

        return {
          id: str(row.id),
          kind: row.kind,
          category: row.category_slug,
          title: row.title,
          message: row.message,
          status: row.status,
          anonymous: row.is_anonymous,
          // THE ANONYMITY PROMISE. Who wrote a post is sent to staff, and to
          // the author about their own posts - and to nobody else. A named
          // post's author NAME is public; its account id is not needed.
          authorId: isAdmin || own ? str(row.author_id) || null : null,
          authorName: !row.is_anonymous || seesIdentity || own ? row.author_name : null,
          votes: row.vote_count,
          hasVoted: row.has_voted,
          attachments: filesByPost.get(row.id) ?? [],
          rejectionReason: followUp ? row.rejection_reason ?? '' : '',
          department: followUp ? row.department ?? '' : '',
          assignedTo: followUp ? row.assigned_to ?? '' : '',
          assignedAt: followUp ? iso(row.assigned_at) : '',
          resolution: followUp ? row.resolution ?? '' : '',
          resolvedAt: followUp ? iso(row.resolved_at) : '',
          // Staff-only, never to the student - not even the author.
          adminNotes: notesByPost.get(row.id) ?? [],
          createdAt: iso(row.created_at),
          updatedAt: iso(row.updated_at),
        };
      }),
      notifications: notifications.rows.map(shapeNotification),
      audit: audit.rows.map(shapeLogEntry),
      auditTotal: audit.rows[0]?.total ?? 0,
      privacy: viewer ? viewerPrivacy(own.rows[0], acceptances.rows, ownRequests.rows) : null,
      privacyRequests: allRequests.rows.map((row) => shapePrivacyRequest(row, { forStaff: true })),
      privacyEvents: privacyEvents.rows.map(shapePrivacyEvent),
    });
  } catch (err) {
    next(err);
  }
}

/*
 * The signed-in person's own privacy picture: whether they must accept the
 * Terms before posting or voting again, their consent for school details,
 * their cookie choices, what they have accepted over time, and their
 * privacy requests.
 */
function viewerPrivacy(account, acceptances, requests) {
  const termsVersions = acceptances
    .filter((row) => row.document === 'terms')
    .map((row) => row.version)
    .sort();
  const acceptedTermsVersion = termsVersions[termsVersions.length - 1] ?? null;

  return {
    acceptedTermsVersion,
    mustAcceptTerms: mustAcceptTerms(acceptedTermsVersion),
    hasSchoolDetails: account.has_school_details,
    schoolConsent: account.school_consent_at
      ? { version: account.school_consent_version, at: iso(account.school_consent_at) }
      : null,
    cookieConsent: account.cookie_consent,
    acceptances: acceptances.map((row) => ({
      document: row.document,
      version: row.version,
      action: row.action,
      at: iso(row.created_at),
    })),
    requests: requests.map((row) => shapePrivacyRequest(row)),
  };
}

// Rows grouped by their post_id, each turned into what the post carries.
function groupBy(rows, shape) {
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.post_id)) groups.set(row.post_id, []);
    groups.get(row.post_id).push(shape(row));
  }
  return groups;
}

module.exports = { getState };
