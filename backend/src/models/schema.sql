-- CampusVoiceBox database schema
-- Run with: npm run db:migrate  (see src/config/migrate.js)
--
-- ONE DATABASE FOR THE WHOLE PLATFORM.
-- The student site and the admin panel read and write these same tables. There
-- is no separate admin database and no separate admins table - an administrator
-- is a row in `users` with a different `role`. That is what keeps "who
-- submitted this" a real foreign key rather than two account lists that
-- gradually stop agreeing with each other.

-- Students, staff and administrators. Everybody who can log in.
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(160) NOT NULL UNIQUE, -- always stored in lower case
  password_hash VARCHAR(255) NOT NULL, -- bcrypt hash, never a plain password

  /*
   * THE ROLE. This column is the only authority on what somebody may do.
   *
   * The frontend has its own copy of the role list, and route guards that use
   * it - but those run in the visitor's browser and decide only what gets
   * drawn. The API re-reads THIS column on every request before allowing
   * anything; see middleware/auth.js.
   *
   * Registration never lets anybody choose a role, and never makes an
   * administrator: every account signed up is a student (with a student
   * number) or a general user (without) - see register() in
   * controllers/authController.js. The administrator is the default account,
   * created when the server starts from ADMIN_EMAIL and ADMIN_PASSWORD
   * (src/config/defaultAdmin.js). Only an administrator can change a role -
   * never their own. If the administrators are ever lost, an account can be
   * promoted on the server itself: `npm run make-admin -- someone@school.edu.ph`
   * (src/config/make-admin.js).
   *
   * Reading the column definition: VARCHAR(20) is text up to 20 characters;
   * NOT NULL means it must always have a value; DEFAULT 'student' is the
   * value it gets when an INSERT leaves it out; CHECK (...) is a rule the
   * database enforces on every write - a row with any other role is refused
   * outright, whatever the application code tried to do.
   */
  role          VARCHAR(20) NOT NULL DEFAULT 'student'
                CHECK (role IN ('admin', 'student', 'user')),

  -- 'suspended' keeps the account and its history but blocks posting and voting.
  status        VARCHAR(20) NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'suspended')),

  -- School details. Nullable, because staff and visitors have no student number.
  student_id    VARCHAR(40),
  course        VARCHAR(120),
  year_level    VARCHAR(40),
  section       VARCHAR(20),

  -- The profile photo: a small square JPEG made in the browser (see
  -- prepareProfilePhoto in frontend/src/services/attachments.js). Shown only
  -- to the account itself and to administrators.
  photo            BYTEA,
  photo_type       VARCHAR(40),
  photo_updated_at TIMESTAMPTZ,

  /*
   * When the password last changed - a sign-in token issued before it stops
   * working, so changing or resetting a password really does sign out
   * whoever held the old one, on every device. A forgotten password is
   * reset with an emailed link (the password_resets table, below).
   */
  password_changed_at  TIMESTAMPTZ,

  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The categories from the frontend's data/categories.js, kept here too so the
-- API can validate incoming posts against real rows instead of trusting
-- whatever string the client sends.
CREATE TABLE IF NOT EXISTS categories (
  slug  VARCHAR(40) PRIMARY KEY,
  label VARCHAR(80) NOT NULL
);

-- The rows live here, with the table, because they are the platform's
-- vocabulary rather than sample data: a post is refused with "Unknown
-- category" unless its slug is one of these, so the slugs must be exactly the
-- frontend's. ON CONFLICT DO NOTHING keeps a second run from duplicating them.
INSERT INTO categories (slug, label) VALUES
  ('facilities', 'Facilities'),
  ('academics', 'Academics'),
  ('safety', 'Safety'),
  ('lounge-area', 'Lounge Area'),
  ('organization', 'Organization'),
  ('school-environment', 'School Environment')
ON CONFLICT (slug) DO NOTHING;

-- A submission: a suggestion, a request, a concern, a complaint, a report.
CREATE TABLE IF NOT EXISTS posts (
  id            SERIAL PRIMARY KEY,

  -- The one classification a post has (the frontend's KINDS). Decides which
  -- admin queue it lands in and whether it is handed to a department.
  kind          VARCHAR(20) NOT NULL
                CHECK (kind IN ('suggestion', 'request', 'concern', 'complaint', 'report')),

  category_slug VARCHAR(40) NOT NULL REFERENCES categories(slug),
  -- The same limits as the posting form (frontend/src/components/PostModal.jsx).
  title         VARCHAR(80) NOT NULL CHECK (char_length(trim(title)) >= 5),
  message       TEXT NOT NULL
                CHECK (char_length(trim(message)) BETWEEN 10 AND 5000),

  /*
   * WHO WROTE IT.
   *
   * Kept even for an anonymous post. Anonymity is a promise that the BOARD
   * will not show the name - not that nobody is accountable for what was
   * written. Administrators need the identity to follow a concern up.
   *
   * The other half of that promise is the API's job: the author's id and name
   * are left out of what anybody without the view_identity permission is sent
   * (controllers/stateController.js). If the field ships to the browser,
   * anonymous posting is anonymous in name only, whatever the interface shows.
   */
  author_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  is_anonymous  BOOLEAN NOT NULL DEFAULT FALSE,

  /*
   * THE LIFECYCLE - the six statuses of frontend/src/data/workflow.js:
   *
   *   pending -> under_review -> approved -> in_progress -> resolved
   *                           \-> rejected
   *
   * Which moves are allowed is in models/workflow.js. The default matters:
   * everything starts at 'pending', so nothing reaches the public board
   * without an administrator approving it first.
   */
  status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'under_review', 'approved',
                                  'in_progress', 'resolved', 'rejected')),

  -- Shown to the student who wrote the post, so a rejection is never unexplained.
  rejection_reason TEXT,

  -- Assignment, once a submission has been approved and handed to a department.
  department    VARCHAR(60),
  assigned_to   VARCHAR(120),
  assigned_at   TIMESTAMPTZ,

  -- How it ended.
  resolution    TEXT,
  resolved_at   TIMESTAMPTZ,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Photos and PDF files attached to a submission, kept in the database itself
-- so a backup of the database is a backup of everything. A photo is shrunk in
-- the browser before it is sent, so each is a few hundred kilobytes at most.
CREATE TABLE IF NOT EXISTS attachments (
  id         SERIAL PRIMARY KEY,
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  file_name  VARCHAR(255) NOT NULL,
  mime_type  VARCHAR(100) NOT NULL,
  byte_size  INTEGER NOT NULL,
  data       BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Staff-only notes on a submission. Never returned to the student who wrote it.
-- admin_name is copied, like the activity log's, so a note still says who
-- wrote it after that account is deleted.
CREATE TABLE IF NOT EXISTS admin_notes (
  id         SERIAL PRIMARY KEY,
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  admin_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  admin_name VARCHAR(120) NOT NULL,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

/*
 * VOTES. One row per account per post, so a vote is cast once and can be
 * taken back (the row is deleted) instead of double-counting.
 *
 * Deleting an account KEEPS its votes - user_id simply becomes NULL. A vote
 * is a record that somebody backed a suggestion, and that happened whether or
 * not the account still exists: a suggestion that won on fifty votes must not
 * quietly drop to forty-nine because one student graduated. (UNIQUE treats
 * NULLs as different from each other, so the kept votes do not collide.)
 */
CREATE TABLE IF NOT EXISTS votes (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, post_id)
);

/*
 * NOTIFICATIONS.
 *
 * `audience` routes the row: 'author' delivers to user_id, 'admin' delivers to
 * everybody holding the view_admin permission, in which case user_id is NULL.
 * Adding a new notification type is a new `type` value - no schema change.
 */
CREATE TABLE IF NOT EXISTS notifications (
  id         SERIAL PRIMARY KEY,
  type       VARCHAR(40) NOT NULL,
  audience   VARCHAR(20) NOT NULL DEFAULT 'author'
             CHECK (audience IN ('author', 'admin')),
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  post_id    INTEGER REFERENCES posts(id) ON DELETE CASCADE,
  title      VARCHAR(200) NOT NULL,
  body       TEXT,
  link       VARCHAR(255),
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

/*
 * THE AUDIT LOG.
 *
 * Every administrative action that changes somebody else's data: approvals,
 * rejections, assignments, suspensions, role changes, administrators' sign-ins
 * - plus the account changes people make to their own accounts.
 *
 * Insert-only by design. There is deliberately no update or delete path,
 * because a log that administrators can edit is not evidence of anything.
 * admin_name is copied rather than joined so an entry still reads correctly
 * after the account that made it has been deleted.
 */
CREATE TABLE IF NOT EXISTS activity_logs (
  id          SERIAL PRIMARY KEY,
  admin_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  admin_name  VARCHAR(120) NOT NULL,
  admin_role  VARCHAR(20),
  action      VARCHAR(60) NOT NULL,
  target_type VARCHAR(20),
  target_id   VARCHAR(60),
  details     TEXT,
  ip_address  VARCHAR(60),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

/* ================================================================== *
 * PRIVACY AND CONSENT (added 2026-10-13)
 *
 * Everything below was added after the tables above, and is written so it
 * can be run against an EXISTING database without losing anything:
 * `ADD COLUMN IF NOT EXISTS` and `CREATE ... IF NOT EXISTS` change nothing
 * that is already there. `npm run db:migrate` applies it.
 *
 * The current versions of the Terms, the Privacy Policy and the cookie
 * choices are in models/policies.js.
 * ================================================================== */

/*
 * Two of a person's choices, kept on their own account:
 *
 * school_consent_*  Whether they have agreed to CampusVoiceBox keeping their
 *                   school details (student ID, course, year level, section),
 *                   and under which Privacy Policy version. Education records
 *                   can be sensitive personal information under the Data
 *                   Privacy Act, so the four school columns may only hold
 *                   values while this is set.
 * cookie_consent    The browser-storage choices they made in the cookie
 *                   window - { version, categories, decidedAt } - kept so a
 *                   choice made on one device follows them to another. No
 *                   device or browser identifier is stored with it.
 */
ALTER TABLE users ADD COLUMN IF NOT EXISTS school_consent_version VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS school_consent_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cookie_consent JSONB;

/*
 * POLICY ACCEPTANCES - the history of what each person agreed to, and when.
 *
 *   terms           accepted      the Terms & Conditions, at sign-up or later
 *   privacy_notice  acknowledged  the Privacy Policy version shown at sign-up
 *                                 (reading a notice is not consenting to it,
 *                                 so it is recorded as acknowledged)
 *   school_details  granted /     the optional consent for school details,
 *                   withdrawn     each change kept as its own row
 *
 * The unique index stops a double-click recording the same acceptance twice.
 * Rows go with the account when it is deleted.
 */
CREATE TABLE IF NOT EXISTS policy_acceptances (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document   VARCHAR(30) NOT NULL
             CHECK (document IN ('terms', 'privacy_notice', 'school_details')),
  version    VARCHAR(20) NOT NULL,
  action     VARCHAR(20) NOT NULL
             CHECK (action IN ('accepted', 'acknowledged', 'granted', 'withdrawn')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_policy_acceptance
  ON policy_acceptances(user_id, document, version) WHERE action IN ('accepted', 'acknowledged');
CREATE INDEX IF NOT EXISTS idx_policy_acceptances_user ON policy_acceptances(user_id);

/*
 * PRIVACY REQUESTS - a person asking for a copy of their data, a correction,
 * the deletion of their account, or raising another privacy matter.
 *
 * The requester's name and email are copied onto the request because a
 * deletion request outlives the account it deleted: the record that it was
 * carried out is the evidence that it was. One open request per person per
 * type, so the queue cannot be flooded with copies.
 */
CREATE TABLE IF NOT EXISTS privacy_requests (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  requester_name  VARCHAR(120) NOT NULL,
  requester_email VARCHAR(160) NOT NULL,
  type            VARCHAR(20) NOT NULL
                  CHECK (type IN ('access', 'correction', 'deletion', 'other')),
  details         TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'in_progress', 'completed', 'declined', 'cancelled')),
  response        TEXT,
  -- For a completed deletion: whether the person's posts were kept (without
  -- their name) or deleted with the account.
  posts_outcome   VARCHAR(10) CHECK (posts_outcome IN ('kept', 'deleted')),
  handled_by_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  handled_by_name VARCHAR(120),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at     TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_open_privacy_request
  ON privacy_requests(user_id, type) WHERE status IN ('pending', 'in_progress');
CREATE INDEX IF NOT EXISTS idx_privacy_requests_created ON privacy_requests(created_at DESC);

/*
 * THE PRIVACY LOG - kept apart from the activity log on purpose. That one
 * records moderation and account administration and is read by everybody
 * who reviews content; this one records privacy requests and data exports
 * and is read only by those holding the manage_privacy permission.
 * Insert-only, like the activity log, and for the same reason. No internet
 * address is stored here.
 */
CREATE TABLE IF NOT EXISTS privacy_events (
  id           SERIAL PRIMARY KEY,
  actor_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_name   VARCHAR(120) NOT NULL,
  actor_role   VARCHAR(20),
  action       VARCHAR(40) NOT NULL,
  request_id   INTEGER,
  subject_name VARCHAR(120),
  details      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_privacy_events_created ON privacy_events(created_at DESC);

/* ==================================================================
 * PASSWORD RESETS BY EMAIL (2026-10-14)
 *
 * "Forgot password?" emails a one-time link. Only a SHA-256 hash of the
 * link's secret is kept here, so somebody who reads this table still cannot
 * reset anybody's password. A link works once, for one hour; asking again
 * replaces it, and using it removes every link for that account
 * (controllers/authController.js).
 * ================================================================== */
CREATE TABLE IF NOT EXISTS password_resets (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);

/*
 * Before the emailed link, an administrator reset a forgotten password by
 * handing over a temporary one, marked by users.must_change_password. That
 * is gone, so the column goes too. A temporary password still waiting to be
 * used would otherwise turn into an ordinary password the administrator
 * knows - so it is replaced first with the hash of a random value nobody
 * has, and those accounts use "Forgot password?". Runs once: after the
 * column is gone it does nothing.
 */
DO $migrate$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = current_schema()
                AND table_name = 'users' AND column_name = 'must_change_password') THEN
    UPDATE users
       SET password_hash = '$2a$10$7W/bGE5P/gEIP.mOzCdj3.Z.fzbdFHtJWOJ6Ylgk/.9dzGtMSuf76',
           password_changed_at = now()
     WHERE must_change_password;
    ALTER TABLE users DROP COLUMN must_change_password;
  END IF;
END
$migrate$;

-- Indexes for the queries the two sides actually run.
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_votes_post_id ON votes(post_id);
CREATE INDEX IF NOT EXISTS idx_attachments_post ON attachments(post_id);
CREATE INDEX IF NOT EXISTS idx_admin_notes_post ON admin_notes(post_id);

-- The public board filters on status on every single page load.
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at DESC);
