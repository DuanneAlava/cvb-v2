/*
 * WRITING TO THE PRIVACY LOG - one INSERT for every part of the backend
 * that records a privacy action: a request made, cancelled or handled, an
 * account deleted at its owner's request, a copy of somebody's data
 * downloaded. See the privacy_events table in models/schema.sql for why it
 * is kept apart from the activity log.
 *
 * `db` is the pool, or a client inside a transaction - pass the client when
 * the entry has to succeed or fail together with the change it records.
 * Names are COPIED in, so an entry still reads correctly after the account
 * it mentions is deleted.
 */
async function writePrivacyEvent(
  db,
  { actor, action, requestId = null, subjectName = null, details = null }
) {
  await db.query(
    `INSERT INTO privacy_events (actor_id, actor_name, actor_role, action, request_id, subject_name, details)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [actor.id, actor.name, actor.role, action, requestId, subjectName, details]
  );
}

module.exports = { writePrivacyEvent };
