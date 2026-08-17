-- CampusVoiceBox database schema
-- Covers the "Database schema drafted (users, sessions, posts)" checklist item.
-- Run with: npm run db:migrate  (see src/config/migrate.js)

-- Students who can log in, post, and vote.
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL, -- bcrypt hash, never a plain password
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per active login. Storing sessions server-side (in addition to the
-- JWT itself) makes it possible to revoke a single device's access later,
-- e.g. a "log out of all devices" button.
CREATE TABLE IF NOT EXISTS sessions (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL, -- sha256 of the JWT, not the JWT itself
  user_agent VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- The six fixed categories from the frontend's data/categories.js,
-- kept here too so the API can validate incoming posts against real rows
-- instead of trusting whatever string the client sends.
CREATE TABLE IF NOT EXISTS categories (
  slug  VARCHAR(40) PRIMARY KEY,
  label VARCHAR(80) NOT NULL
);

-- A suggestion or "voice out" post on the board.
CREATE TABLE IF NOT EXISTS posts (
  id            SERIAL PRIMARY KEY,
  type          VARCHAR(20) NOT NULL CHECK (type IN ('suggestion', 'voice')),
  category_slug VARCHAR(40) NOT NULL REFERENCES categories(slug),
  author_id     INTEGER REFERENCES users(id) ON DELETE SET NULL, -- NULL once the account is deleted
  is_anonymous  BOOLEAN NOT NULL DEFAULT FALSE, -- true hides the author's name in API responses
  message       TEXT NOT NULL CHECK (char_length(trim(message)) >= 10),
  status        VARCHAR(20) NOT NULL DEFAULT 'open'
                CHECK (status IN ('open', 'in_review', 'resolved')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per student per post, so a vote can only be cast once and can be
-- taken back (the row is deleted) instead of double-counting.
CREATE TABLE IF NOT EXISTS votes (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category_slug);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_votes_post_id ON votes(post_id);
