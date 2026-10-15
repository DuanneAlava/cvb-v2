const { logAs } = require('../../models/activityLog');

/*
 * What more than one area of the admin API needs: users.js and
 * privacyRequests.js both refuse actions on your own account, and both can
 * delete one.
 */

// Is this the administrator's own account? Several actions refuse it.
const isSelf = (req, id) => id === req.user.id;

/*
 * Delete an account - from the Users page, or to complete a deletion
 * request. Votes are always kept (votes.user_id is ON DELETE SET NULL - see
 * models/schema.sql): quietly changing a result after the fact would be the
 * wrong kind of tidy. Submissions are kept too, without an owner, unless
 * `deletePosts` - a choice made when handling the person's own deletion
 * request - removes them with their files and the votes on them.
 * Answers the deleted account's name and email, or null if it was gone.
 */
async function deleteAccount(client, req, id, { deletePosts = false } = {}) {
  if (deletePosts) await client.query('DELETE FROM posts WHERE author_id = $1', [id]);

  const { rows } = await client.query('DELETE FROM users WHERE id = $1 RETURNING name, email', [id]);
  if (!rows[0]) return null;

  await logAs(client, req.user, 'user_deleted', {
    targetType: 'user',
    targetId: id,
    details: `${rows[0].name} (${rows[0].email}) - their submissions were ${deletePosts ? 'deleted too' : 'kept'}`,
    req,
  });
  return rows[0];
}

module.exports = { isSelf, deleteAccount };
