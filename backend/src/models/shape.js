/*
 * HOW RECORDS LEAVE THE API - the database's rows turned into the shapes the
 * frontend's screens read (frontend/src/services/store.js). One place, so
 * every endpoint that sends an account or a log entry sends the same shape.
 *
 * Two conventions run through all of it:
 *   - ids are strings. The frontend compares them with addresses such as
 *     /admin/users/12, and an address is always text.
 *   - an empty value is '' rather than null, which is what the screens test
 *     for ("has a department", "has been resolved").
 */

// A row's id as the frontend sees it.
const str = (value) => (value === null || value === undefined ? '' : String(value));

// A date as ISO text ("2026-10-13T05:06:49.890Z"), or '' when there is none.
const iso = (date) => (date ? new Date(date).toISOString() : '');

/*
 * The id in an address such as /posts/12, as a number - or null when it is
 * not a whole positive number. Checked before it reaches a query, so
 * /posts/abc is a plain "not found" rather than a database error.
 */
function toId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 && String(id) === String(value) ? id : null;
}

/*
 * An account. Allow-listed field by field rather than by deleting the
 * password hash from the row: a column added to the table later is then left
 * out by default instead of leaking until somebody notices.
 *
 * `photo` is the address the picture is fetched from, with the time it last
 * changed on the end - so a new photo is a new address and is never confused
 * with the old one in a cache.
 */
function shapeUser(row) {
  return {
    id: str(row.id),
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    studentId: row.student_id ?? '',
    course: row.course ?? '',
    yearLevel: row.year_level ?? '',
    section: row.section ?? '',
    photo: row.has_photo ? `/users/${row.id}/photo?v=${new Date(row.photo_updated_at).getTime()}` : '',
    votesCast: row.votes_cast ?? 0,
    createdAt: iso(row.created_at),
    lastLogin: iso(row.last_login_at),
  };
}

function shapeNotification(row) {
  return {
    id: str(row.id),
    type: row.type,
    audience: row.audience,
    userId: row.user_id === null ? null : str(row.user_id),
    title: row.title,
    body: row.body ?? '',
    link: row.link ?? '',
    read: row.is_read,
    createdAt: iso(row.created_at),
  };
}

function shapeLogEntry(row) {
  return {
    id: str(row.id),
    adminId: str(row.admin_id),
    adminName: row.admin_name,
    adminRole: row.admin_role ?? '',
    action: row.action,
    targetType: row.target_type ?? '',
    targetId: row.target_id ?? '',
    details: row.details ?? '',
    createdAt: iso(row.created_at),
  };
}

/*
 * A privacy request. `forStaff` adds who handled it - the person who made
 * the request is told what was decided, not which administrator decided it.
 */
function shapePrivacyRequest(row, { forStaff = false } = {}) {
  return {
    id: str(row.id),
    userId: row.user_id === null ? null : str(row.user_id),
    requesterName: row.requester_name,
    requesterEmail: row.requester_email,
    type: row.type,
    details: row.details ?? '',
    status: row.status,
    response: row.response ?? '',
    postsOutcome: row.posts_outcome ?? '',
    ...(forStaff ? { handledBy: row.handled_by_name ?? '' } : {}),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    resolvedAt: iso(row.resolved_at),
  };
}

function shapePrivacyEvent(row) {
  return {
    id: str(row.id),
    actorName: row.actor_name,
    actorRole: row.actor_role ?? '',
    action: row.action,
    requestId: str(row.request_id),
    subjectName: row.subject_name ?? '',
    details: row.details ?? '',
    createdAt: iso(row.created_at),
  };
}

module.exports = {
  str,
  iso,
  toId,
  shapeUser,
  shapeNotification,
  shapeLogEntry,
  shapePrivacyRequest,
  shapePrivacyEvent,
};
