-- Starter data so the API returns something the first time it runs.
-- Matches the six categories and sample posts already used by the
-- frontend's data/categories.js and data/suggestions.js, so switching the
-- frontend from mock data to real fetch calls (see GUIDE.md) does not
-- change what appears on screen.

INSERT INTO categories (slug, label) VALUES
  ('facilities', 'Facilities'),
  ('academics', 'Academics'),
  ('safety', 'Safety'),
  ('food-canteen', 'Food & Canteen'),
  ('organizations', 'Organizations'),
  ('school-environment', 'School Environment')
ON CONFLICT (slug) DO NOTHING;

-- Demo student account so you can log in immediately after `docker compose up`
-- or after running the seed script directly.
-- Email: demo@student.edu.ph   Password: Demo1234
-- (hash generated once with bcrypt.hashSync('Demo1234', 10) - see GUIDE.md
-- if you want to regenerate it with a password of your own choosing)
INSERT INTO users (name, email, password_hash) VALUES
  ('Demo Student', 'demo@student.edu.ph', '$2b$10$PZB/7TMqWBfBhr2MDbK/rOk2Qn1.XD4y9o0YyEYTLUpJUQSLF0l0q')
ON CONFLICT (email) DO NOTHING;

INSERT INTO posts (type, category_slug, author_id, message, status, created_at) VALUES
  ('suggestion', 'facilities', NULL, 'The library needs more power outlets near the study tables.', 'open', now() - interval '3 days'),
  ('voice', 'food-canteen', NULL, 'Canteen queues at lunch are so long that we miss the start of class.', 'open', now() - interval '3 days'),
  ('suggestion', 'safety', NULL, 'The back gate walkway has no lighting. It is not safe after evening classes.', 'open', now() - interval '4 days'),
  ('suggestion', 'academics', NULL, 'Please open more evening slots for the computer laboratory.', 'open', now() - interval '5 days'),
  ('voice', 'organizations', NULL, 'Club sign-up week clashes with midterms every single semester.', 'open', now() - interval '6 days'),
  ('suggestion', 'school-environment', NULL, 'We need more covered waiting areas and bins around the quadrangle.', 'open', now() - interval '7 days');
