const express = require('express');
const { requireAuth } = require('../../middleware/auth');
const usersRoutes = require('./users');
const postsRoutes = require('./posts');
const privacyRequestsRoutes = require('./privacyRequests');
const activityLogsRoutes = require('./activityLogs');

/*
 * THE ADMIN API.
 *
 * Everything the admin panel changes, and nothing a student can reach. What
 * the panel SHOWS comes from GET /api/state, which sends an administrator
 * every record (controllers/stateController.js).
 *
 * One file per area, all mounted below:
 *   users.js            correcting details, suspending, roles, deleting
 *   posts.js            the review workflow and staff notes
 *   privacyRequests.js  handling what a person asked about their data
 *   activityLogs.js     reading the audit log
 *   helpers.js          what more than one of them needs
 *
 * THE ONE RULE IN THESE FILES
 * Every route carries its own requirePermission(...). Not one of them
 * relies on the frontend having hidden a button, because a hidden button is
 * not a check - it is a suggestion, and curl ignores it. For the same reason
 * the workflow is enforced here too: a status move the review dialog would
 * never offer is refused (models/workflow.js).
 *
 * requireAuth is applied once, here, before every area's routes, so a route
 * physically cannot be added without at least being authenticated; the per-route
 * permission is then the second gate. Both read the account fresh from the
 * database rather than trusting the token, so demoting or suspending
 * somebody takes effect immediately instead of when their token expires.
 *
 * Every change writes its activity-log entry, and tells the student, inside
 * the same transaction - all three happen, or none does.
 */

/*
 * WHAT YOU'LL MEET IN THESE FILES (plain-English notes)
 *
 * - express.Router()  A group of related routes that is mounted at one path
 *   (here /admin, in routes/index.js). `router.patch('/users/:id', ...)` in
 *   users.js therefore answers PATCH /admin/users/12.
 * - HTTP verbs  GET reads, POST creates, PATCH changes part of something,
 *   DELETE removes. Each route is one verb at one path.
 * - `router.use(requireAuth)`  Apply a middleware to every route below it.
 *   `router.use(usersRoutes)` adds another router's routes at this point.
 * - `requirePermission('manage_users')` as a route argument  Middleware
 *   given per route, between the path and the handler. It runs first; the
 *   handler only runs if it calls next().
 * - `req.params.id` / `req.body.status`  Where input arrives: the address
 *   (/users/:id) and the JSON body of a POST or PATCH.
 * - `res.status(400).json({ error })`  Reply with an HTTP status code and a
 *   JSON body. 400 = bad input, 401 = not signed in, 403 = not allowed,
 *   404 = not found, 409 = it has changed since you looked, 204 = done,
 *   nothing to return.
 * - A "transaction"  Several database statements that must all succeed or
 *   all be undone together (BEGIN ... COMMIT, or ROLLBACK on error). See
 *   inTransaction() in models/transaction.js.
 * - `SELECT ... FOR UPDATE`  Read a row and hold it until the transaction
 *   ends, so two administrators acting on the same submission at once take
 *   turns instead of overwriting each other.
 * - `next(err)`  Hand an error to the app's error handler (middleware/
 *   errorHandler.js) instead of crashing the process.
 */

const router = express.Router();

// Nothing in this folder is reachable without a valid token.
router.use(requireAuth);

router.use(usersRoutes); // /users/:id - details, status, role, deletion
router.use(postsRoutes); // /posts/:id - status, assign, resolve, notes
router.use(privacyRequestsRoutes); // /privacy-requests/:id
router.use(activityLogsRoutes); // /activity-logs

module.exports = router;
