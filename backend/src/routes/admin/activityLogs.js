const express = require('express');
const pool = require('../../config/db');
const { requirePermission } = require('../../middleware/auth');
const { shapeLogEntry } = require('../../models/shape');

/*
 * THE AUDIT LOG. Part of the admin API: see index.js beside this file for
 * the rules every route here follows.
 */

const router = express.Router();

/*
 * The whole log, newest first, for the activity-log export. (The screens
 * show the latest 500, which arrive with GET /api/state.)
 *
 * Readable and nothing else. There is no POST, PATCH or DELETE for it on
 * purpose - entries are only ever written by the handlers that make a change,
 * as part of the action they record (models/activityLog.js).
 */
router.get('/activity-logs', requirePermission('view_audit_log'), async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM activity_logs ORDER BY created_at DESC, id DESC');
    res.json({ entries: rows.map(shapeLogEntry) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
