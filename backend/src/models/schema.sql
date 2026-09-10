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
  email         VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL, -- bcrypt hash, never a plain password

  /*
   * THE ROLE. This column is the only authority on what somebody may do.
   *
   * The frontend has its own copy of the role list, and route guards that use
   * it - but those run in the visitor's browser and decide only what gets
   * drawn. The API must re-read THIS column on every request before allowing
   * an administrative action; see middleware/auth.js requirePermission().
   *
   * Registration must never be able to set an admin role. Promotion is a
   * deliberate act by an admin, recorded in activity_logs - and never on
   * their own account.
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
  avatar_url    VARCHAR(255),

  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per active login. Storing sessions server-side (in addition to the
-- JWT itself) makes it possible to revoke a single device's access later,
-- e.g. a "log out of all devices" button, or to cut off an account the moment
-- it is suspended rather than waiting for its token to expire.
CREATE TABLE IF NOT EXISTS sessions (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL, -- sha256 of the JWT, not the JWT itself
  user_agent VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- The categories from the frontend's data/categories.js, kept here too so the
-- API can validate incoming posts against real rows instead of trusting
-- whatever string the client sends.
CREATE TABLE IF NOT EXISTS categories (
  slug  VARCHAR(40) PRIMARY KEY,
  label VARCHAR(80) NOT NULL
);

-- A submission: a suggestion, a concern, a complaint, a report.
CREATE TABLE IF NOT EXISTS posts (
  id            SERIAL PRIMARY KEY,
  type          VARCHAR(20) NOT NULL CHECK (type IN ('suggestion', 'voice')),

  -- What sort of submission it is. Decides which admin queue it lands in and
  -- whether it needs assigning to a department.
  kind          VARCHAR(20) NOT NULL DEFAULT 'suggestion'
                CHECK (kind IN ('suggestion', 'feedback', 'request',
                                'concern', 'complaint', 'report')),

  category_slug VARCHAR(40) NOT NULL REFERENCES categories(slug),
  title         VARCHAR(160) NOT NULL,
  message       TEXT NOT NULL CHECK (char_length(trim(message)) >= 10),

  /*
   * WHO WROTE IT.
   *
   * Kept even for an anonymous post. Anonymity is a promise that the BOARD
   * will not show the name - not that nobody is accountable for what was
   * written. Administrators need the identity to follow a concern up.
   *
   * The other half of that promise is the API's job: author_id and any author
   * detail MUST be left out of responses to a caller without the
   * view_identity permission. If the field ships to the browser, anonymous
   * posting is anonymous in name only, whatever the interface shows.
   */
  author_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  is_anonymous  BOOLEAN NOT NULL DEFAULT FALSE,

  /*
   * THE LIFECYCLE.
   *
   *   pending -> under_review -> approved -> assigned -> in_progress
   *           -> resolved -> closed
   *
   * with rejected, needs_revision and archived as the ways out.
   *
   * The default matters: everything starts at 'pending', so nothing reaches
   * the public board without an administrator approving it first.
   */
  status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'under_review', 'needs_revision',
                                  'rejected', 'approved', 'assigned',
                                  'in_progress', 'resolved', 'closed', 'archived')),

  priority      VARCHAR(20) NOT NULL DEFAULT 'medium'
                CHECK (priority IN ('low', 'medium', 'high', 'urgent')),

  -- The moderation outcome. Both of these are shown to the student who wrote
  -- the post, so a rejection is never unexplained.
  rejection_reason TEXT,
  revision_note    TEXT,

  -- Assignment, once a concern has been approved and handed to a department.
  department    VARCHAR(60),
  assigned_to   VARCHAR(120),
  assigned_at   TIMESTAMPTZ,

  -- How it ended.
  resolution    TEXT,
  resolved_at   TIMESTAMPTZ,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Photos and files attached to a submission. The file itself belongs in object
-- storage; only its address is kept here.
CREATE TABLE IF NOT EXISTS attachments (
  id         SERIAL PRIMARY KEY,
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  file_name  VARCHAR(255) NOT NULL,
  mime_type  VARCHAR(100) NOT NULL,
  byte_size  INTEGER NOT NULL,
  url        VARCHAR(500) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Staff-only notes on a submission. Never returned to the student who wrote it.
CREATE TABLE IF NOT EXISTS admin_notes (
  id         SERIAL PRIMARY KEY,
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  admin_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per student per post, so a vote can only be cast once and can be
-- taken back (the row is deleted) instead of double-counting.
CREATE TABLE IF NOT EXISTS votes (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
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
 * rejections, assignments, suspensions, role changes, sign-ins.
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

-- Indexes for the queries the two sides actually run.
CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category_slug);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_votes_post_id ON votes(post_id);

-- "Everything pending, oldest first" is the admin panel's busiest query, and
-- the public board filters on status on every single page load.
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_kind ON posts(kind);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at DESC);
