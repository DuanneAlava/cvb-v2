/*
 * THE API, TESTED FROM THE OUTSIDE.
 *
 * Every test here talks to the real server the way the website does - HTTP
 * requests carrying JSON - with a real PostgreSQL database behind it. It
 * walks through what people actually do: signing up and logging in, posting,
 * an administrator reviewing, voting, a person's own account and privacy
 * tools, a forgotten password, and managing accounts. It checks what the
 * server answers AND what it records: the activity log rows are read
 * straight from the database, so a change to how entries are written cannot
 * quietly drop the name, role or address an entry should carry.
 *
 * A DATABASE OF ITS OWN
 * The run starts by wiping the database and loading models/schema.sql
 * afresh, so it refuses to start unless the database's name ends in "_test":
 * it cannot touch real data by accident. With the PG* settings pointing at
 * such a database (GUIDE.md shows how, with Docker):
 *
 *   npm test
 *
 * CI runs it on every push, against an empty Postgres.
 *
 * Nothing is emailed: sendMail is replaced before the server loads, so the
 * reset email is caught on its way out - which is also how the test reads
 * the link inside it.
 *
 * WHAT YOU'LL MEET IN THIS FILE
 * - node:test  Node's own test runner. test('name', fn) is one test; the
 *   tests in a file run one after another, top to bottom, so later ones can
 *   use the accounts and posts earlier ones made. t.test() nests a step.
 * - assert.equal / assert.deepEqual / assert.match  Fail the test unless the
 *   two values are the same (deepEqual: the same contents) or the text
 *   matches the pattern.
 * - fetch  The browser's way to make a request, built into Node.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

if (!/_test$/.test(process.env.PGDATABASE ?? '')) {
  throw new Error(
    'Refusing to run: the tests wipe their database, so PGDATABASE must name one ending in "_test". See GUIDE.md.'
  );
}

// The server's settings for this run. Test values only - never real ones.
process.env.JWT_SECRET ||= 'test-only-secret-not-for-real-use';
process.env.ADMIN_NAME = 'Test Admin';
process.env.ADMIN_EMAIL = 'admin@test.example';
process.env.ADMIN_PASSWORD = 'AdminPass1';

// Catch outgoing email. Replaced before the server loads, because the
// controllers take sendMail from this module as they load.
const mail = require('../src/config/mail');
const sentMail = [];
mail.sendMail = async (message) => {
  sentMail.push(message);
};

const pool = require('../src/config/db');
const app = require('../src/app');
const { ensureDefaultAdmin } = require('../src/config/defaultAdmin');
const { POLICY_VERSIONS, COOKIE_CONSENT_VERSION } = require('../src/models/policies');
const { PASSWORD_RULE_MESSAGE, WRONG_EMAIL_OR_PASSWORD } = require('../src/models/accountRules');
const { PROFANITY } = require('../src/models/blockedWords');
const { rejectionMessage } = require('../src/models/moderation');

const PASSWORD = 'Passw0rd1';
const LOCAL_ADDRESS = '127.0.0.1';

let server;
let base;

before(async () => {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await pool.query(fs.readFileSync(path.join(__dirname, '..', 'src', 'models', 'schema.sql'), 'utf8'));
  await ensureDefaultAdmin();
  await new Promise((resolve) => {
    server = app.listen(0, LOCAL_ADDRESS, resolve);
  });
  base = `http://${LOCAL_ADDRESS}:${server.address().port}/api`;
});

after(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

// One request. Answers the status code and the JSON body (null when empty).
async function call(method, url, { token, body } = {}) {
  const response = await fetch(base + url, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

const signUp = (fields) =>
  call('POST', '/auth/register', {
    body: {
      password: PASSWORD,
      acceptTerms: true,
      termsVersion: POLICY_VERSIONS.terms,
      privacyVersion: POLICY_VERSIONS.privacy,
      ...fields,
    },
  });

const logIn = (email, password = PASSWORD) => call('POST', '/auth/login', { body: { email, password } });

// Everything this token may see - what the website loads on every page.
const state = async (token) => (await call('GET', '/state', { token })).body;

async function me(token) {
  const seen = await state(token);
  return seen.users.find((user) => user.id === seen.viewerId);
}

const post = async (token, id) => (await state(token)).posts.find((p) => p.id === id);

const newPost = (token, fields = {}) =>
  call('POST', '/posts', {
    token,
    body: {
      kind: 'concern',
      category: 'safety',
      title: 'Broken walkway lights',
      message: 'The lights along the main walkway are out at night.',
      anonymous: false,
      attachments: [],
      ...fields,
    },
  });

// The activity log rows with this action, oldest first, as stored.
async function logRows(action) {
  const { rows } = await pool.query('SELECT * FROM activity_logs WHERE action = $1 ORDER BY id', [action]);
  return rows;
}

// The parts of a log row that say who did it, from where, to what.
const entry = (row) => ({
  admin_id: row.admin_id,
  admin_name: row.admin_name,
  admin_role: row.admin_role,
  target_type: row.target_type,
  target_id: row.target_id,
  details: row.details,
  ip_address: row.ip_address,
});

// The reset email goes out just after the answer, so wait for it.
async function nextMail(count) {
  for (let i = 0; i < 100 && sentMail.length < count; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return sentMail[count - 1];
}

/* ------------------------------------------------------------------ *
 * The accounts and posts the tests share, filled in as they run
 * ------------------------------------------------------------------ */

const admin = { email: 'admin@test.example', password: 'AdminPass1' };
const juan = { email: 'juan@test.example' }; // a student, with school details
const ana = { email: 'ana@test.example' }; // a user: no Student ID
let concernId; // Juan's concern, taken through the whole workflow
let suggestionId; // Ana's anonymous suggestion
let pendingId; // a post nobody reviews

/* ------------------------------------------------------------------ */

test('the health check answers', async () => {
  const { status, body } = await call('GET', '/health');
  assert.equal(status, 200);
  assert.deepEqual(body, { status: 'ok' });
});

test('signing up', async (t) => {
  await t.test('is refused without the Terms accepted', async () => {
    const { status, body } = await signUp({ name: 'No Terms', email: 'noterms@test.example', acceptTerms: false });
    assert.equal(status, 400);
    assert.match(body.error, /accept the Terms/);
  });

  await t.test('is refused with a weak password', async () => {
    const { status, body } = await signUp({ name: 'Weak', email: 'weak@test.example', password: 'password' });
    assert.equal(status, 400);
    assert.equal(body.error, PASSWORD_RULE_MESSAGE);
  });

  await t.test('is refused when the policies changed while the form was open', async () => {
    const { status } = await signUp({ name: 'Old Page', email: 'old@test.example', termsVersion: '2000-01-01' });
    assert.equal(status, 409);
  });

  await t.test('is refused with school details but no consent to keep them', async () => {
    const { status, body } = await signUp({ name: 'No Consent', email: 'nc@test.example', studentId: '2023-1' });
    assert.equal(status, 400);
    assert.match(body.error, /school details/);
  });

  await t.test('with a Student ID makes a student account', async () => {
    const { status, body } = await signUp({
      name: 'Juan Dela Cruz',
      email: 'Juan@Test.Example',
      studentId: '2023-00145',
      course: 'BS in Computer Science',
      yearLevel: '3rd Year',
      section: 'A',
      schoolConsent: true,
    });
    assert.equal(status, 201);
    juan.token = body.token;
    const account = await me(juan.token);
    juan.id = account.id;
    assert.equal(account.role, 'student');
    assert.equal(account.email, 'juan@test.example', 'emails are stored in lower case');
    assert.equal(account.studentId, '2023-00145');
  });

  await t.test('without a Student ID makes a user account', async () => {
    const { status, body } = await signUp({ name: 'Ana Reyes', email: ana.email });
    assert.equal(status, 201);
    ana.token = body.token;
    const account = await me(ana.token);
    ana.id = account.id;
    assert.equal(account.role, 'user');
  });

  await t.test('is refused for an email that already has an account', async () => {
    const { status, body } = await signUp({ name: 'Juan Again', email: juan.email });
    assert.equal(status, 409);
    assert.equal(body.field, 'email');
  });
});

test('logging in', async (t) => {
  await t.test('answers the same for a wrong password and an unknown email', async () => {
    const wrongPassword = await logIn(juan.email, 'Wrong0ne');
    const unknown = await logIn('nobody@test.example');
    assert.equal(wrongPassword.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(wrongPassword.body.error, WRONG_EMAIL_OR_PASSWORD);
    assert.equal(unknown.body.error, WRONG_EMAIL_OR_PASSWORD);
  });

  await t.test('works with the right password', async () => {
    const { status, body } = await logIn(juan.email);
    assert.equal(status, 200);
    juan.token = body.token;
  });

  await t.test('signs the default administrator in, and records it', async () => {
    const { status, body } = await logIn(admin.email, admin.password);
    assert.equal(status, 200);
    admin.token = body.token;
    admin.id = (await me(admin.token)).id;

    // Only administrators' sign-ins are recorded - not Juan's or Ana's.
    const rows = await logRows('login');
    assert.equal(rows.length, 1);
    assert.deepEqual(entry(rows[0]), {
      admin_id: Number(admin.id),
      admin_name: 'Test Admin',
      admin_role: 'admin',
      target_type: 'user',
      target_id: admin.id,
      details: admin.email,
      ip_address: LOCAL_ADDRESS,
    });
  });
});

test('who may reach what', async (t) => {
  await t.test('posting needs an account', async () => {
    assert.equal((await newPost(undefined)).status, 401);
  });

  await t.test('the admin API does not exist for a student', async () => {
    assert.equal((await call('GET', '/admin/activity-logs', { token: juan.token })).status, 404);
    const move = await call('PATCH', '/admin/posts/1/status', { token: juan.token, body: { status: 'approved' } });
    assert.equal(move.status, 404);
  });
});

test('posting', async (t) => {
  await t.test('is refused with a blocked word, without naming it', async () => {
    const { status, body } = await newPost(juan.token, { message: `The canteen staff are ${PROFANITY[0]} today.` });
    assert.equal(status, 400);
    assert.equal(body.error, rejectionMessage());
  });

  await t.test('is refused for an unknown category or a too-short title', async () => {
    assert.equal((await newPost(juan.token, { category: 'cafeteria' })).status, 400);
    assert.equal((await newPost(juan.token, { title: 'Hi' })).status, 400);
  });

  await t.test('waits for review before anybody else sees it', async () => {
    const { status, body } = await newPost(juan.token);
    assert.equal(status, 201);
    concernId = body.id;

    assert.equal((await post(juan.token, concernId)).status, 'pending', 'the author sees their own');
    assert.equal(await post(undefined, concernId), undefined, 'a visitor does not');
    assert.equal(await post(ana.token, concernId), undefined, 'another student does not');
  });

  await t.test('can be anonymous', async () => {
    const { status, body } = await newPost(ana.token, {
      kind: 'suggestion',
      category: 'lounge-area',
      title: 'More seats in the lounge',
      message: 'The lounge fills up at lunch; a few more benches would help.',
      anonymous: true,
    });
    assert.equal(status, 201);
    suggestionId = body.id;

    pendingId = (await newPost(juan.token, { title: 'Leaking roof in the gym', message: 'Water drips onto the court.' }))
      .body.id;
  });
});

test('an administrator reviewing', async (t) => {
  await t.test('a rejection needs a reason', async () => {
    const { status } = await call('PATCH', `/admin/posts/${concernId}/status`, {
      token: admin.token,
      body: { status: 'rejected', reason: '' },
    });
    assert.equal(status, 400);
  });

  await t.test('approving publishes it, tells the author and is logged', async () => {
    const { status } = await call('PATCH', `/admin/posts/${concernId}/status`, {
      token: admin.token,
      body: { status: 'approved' },
    });
    assert.equal(status, 204);

    const seen = await post(undefined, concernId);
    assert.equal(seen.status, 'approved');
    assert.equal(seen.authorName, 'Juan Dela Cruz');

    const notices = (await state(juan.token)).notifications.filter((n) => n.type === 'post_approved');
    assert.equal(notices.length, 1);

    const [row] = await logRows('post_approved');
    assert.deepEqual(entry(row), {
      admin_id: Number(admin.id),
      admin_name: 'Test Admin',
      admin_role: 'admin',
      target_type: 'post',
      target_id: concernId,
      details: 'Broken walkway lights to approved',
      ip_address: LOCAL_ADDRESS,
    });
  });

  await t.test('a move the workflow does not allow is refused', async () => {
    const { status } = await call('PATCH', `/admin/posts/${concernId}/status`, {
      token: admin.token,
      body: { status: 'rejected', reason: 'Too late for this' },
    });
    assert.equal(status, 409);
  });

  await t.test('a suggestion is not assigned to a department', async () => {
    const { status } = await call('PATCH', `/admin/posts/${suggestionId}/assign`, {
      token: admin.token,
      body: { department: 'college-computer-studies' },
    });
    assert.equal(status, 409);
  });

  await t.test('assigning a concern starts the work', async () => {
    const unknown = await call('PATCH', `/admin/posts/${concernId}/assign`, {
      token: admin.token,
      body: { department: 'the-moon' },
    });
    assert.equal(unknown.status, 400);

    const { status } = await call('PATCH', `/admin/posts/${concernId}/assign`, {
      token: admin.token,
      body: { department: 'college-computer-studies', assignedTo: "Dean's office" },
    });
    assert.equal(status, 204);
    const seen = await post(juan.token, concernId);
    assert.equal(seen.status, 'in_progress');
    assert.equal(seen.department, 'college-computer-studies');
    assert.equal((await logRows('concern_assigned')).length, 1);
  });

  await t.test('resolving needs a summary of what was done', async () => {
    const empty = await call('PATCH', `/admin/posts/${concernId}/resolve`, {
      token: admin.token,
      body: { resolution: ' ' },
    });
    assert.equal(empty.status, 400);

    const { status } = await call('PATCH', `/admin/posts/${concernId}/resolve`, {
      token: admin.token,
      body: { resolution: 'New lights were installed.' },
    });
    assert.equal(status, 204);
    const seen = await post(juan.token, concernId);
    assert.equal(seen.status, 'resolved');
    assert.equal(seen.resolution, 'New lights were installed.');
    const notices = (await state(juan.token)).notifications.map((n) => n.type);
    assert.ok(notices.includes('concern_resolved'));
  });

  await t.test('an internal note is never shown to the student', async () => {
    const { status } = await call('POST', `/admin/posts/${concernId}/notes`, {
      token: admin.token,
      body: { text: 'Checked with the facilities office.' },
    });
    assert.equal(status, 201);
    assert.equal((await post(admin.token, concernId)).adminNotes.length, 1);
    assert.deepEqual((await post(juan.token, concernId)).adminNotes, []);
  });

  await t.test('an anonymous post hides its author from everybody but staff', async () => {
    await call('PATCH', `/admin/posts/${suggestionId}/status`, { token: admin.token, body: { status: 'approved' } });
    assert.equal((await post(undefined, suggestionId)).authorName, null);
    assert.equal((await post(juan.token, suggestionId)).authorName, null);
    assert.equal((await post(admin.token, suggestionId)).authorName, 'Ana Reyes');
  });
});

test('voting', async (t) => {
  await t.test('needs an account', async () => {
    assert.equal((await call('POST', `/posts/${concernId}/vote`)).status, 401);
  });

  await t.test('only works on posts on the board', async () => {
    assert.equal((await call('POST', `/posts/${pendingId}/vote`, { token: ana.token })).status, 404);
  });

  await t.test('casts the vote, and takes it back', async () => {
    const cast = await call('POST', `/posts/${concernId}/vote`, { token: ana.token });
    assert.deepEqual(cast.body, { votes: 1, hasVoted: true });
    const back = await call('POST', `/posts/${concernId}/vote`, { token: ana.token });
    assert.deepEqual(back.body, { votes: 0, hasVoted: false });
  });
});

test('a person changing their own account', async (t) => {
  await t.test('their details, logged as their own change', async () => {
    const { status } = await call('PATCH', '/account', {
      token: juan.token,
      body: { name: 'Juan Dela Cruz', studentId: '2023-00145', course: 'BS in Computer Science', yearLevel: '4th Year', section: 'A' },
    });
    assert.equal(status, 204);
    assert.equal((await me(juan.token)).yearLevel, '4th Year');

    const [row] = await logRows('user_updated');
    assert.deepEqual(entry(row), {
      admin_id: Number(juan.id),
      admin_name: 'Juan Dela Cruz',
      admin_role: 'student',
      target_type: 'user',
      target_id: juan.id,
      details: 'Updated Year level on Juan Dela Cruz',
      ip_address: LOCAL_ADDRESS,
    });
  });

  await t.test('their password, which needs the current one', async () => {
    const wrong = await call('PUT', '/account/password', {
      token: juan.token,
      body: { currentPassword: 'Wrong0ne', newPassword: 'Passw0rd2' },
    });
    assert.equal(wrong.status, 403);

    const { status, body } = await call('PUT', '/account/password', {
      token: juan.token,
      body: { currentPassword: PASSWORD, newPassword: 'Passw0rd2' },
    });
    assert.equal(status, 200);
    juan.token = body.token;
    assert.equal((await logIn(juan.email)).status, 401, 'the old password no longer works');
    assert.equal((await logIn(juan.email, 'Passw0rd2')).status, 200);

    const [row] = await logRows('password_changed');
    assert.deepEqual(entry(row), {
      admin_id: Number(juan.id),
      admin_name: 'Juan Dela Cruz',
      admin_role: 'student',
      target_type: 'user',
      target_id: juan.id,
      details: 'Juan Dela Cruz',
      ip_address: LOCAL_ADDRESS,
    });
  });
});

test('a forgotten password', async (t) => {
  await t.test('an unknown email gets the same answer, and no email', async () => {
    const { status, body } = await call('POST', '/auth/forgot-password', { body: { email: 'nobody@test.example' } });
    assert.equal(status, 200);
    assert.ok(body.message);
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(sentMail.length, 0);
  });

  await t.test('the emailed link sets a new password, once', async () => {
    const { status } = await call('POST', '/auth/forgot-password', { body: { email: juan.email } });
    assert.equal(status, 200);
    const message = await nextMail(1);
    assert.equal(message.to, juan.email);
    const token = message.text.match(/#token=(\S+)/)[1];

    const weak = await call('POST', '/auth/reset-password', { body: { token, newPassword: 'short' } });
    assert.equal(weak.status, 400);

    const reset = await call('POST', '/auth/reset-password', { body: { token, newPassword: 'Passw0rd3' } });
    assert.equal(reset.status, 204);
    const again = await call('POST', '/auth/reset-password', { body: { token, newPassword: 'Passw0rd4' } });
    assert.equal(again.status, 400, 'a link works once');

    const { body } = await logIn(juan.email, 'Passw0rd3');
    juan.token = body.token;
    assert.ok(juan.token);

    const rows = await logRows('password_changed');
    assert.deepEqual(entry(rows[1]), {
      admin_id: Number(juan.id),
      admin_name: 'Juan Dela Cruz',
      admin_role: 'student',
      target_type: 'user',
      target_id: juan.id,
      details: 'Juan Dela Cruz - with an emailed reset link',
      ip_address: LOCAL_ADDRESS,
    });
  });
});

test('privacy tools', async (t) => {
  await t.test('a person can download their data', async () => {
    const { status, body } = await call('GET', '/account/export', { token: juan.token });
    assert.equal(status, 200);
    assert.ok(body.posts.some((p) => p.id === concernId));
  });

  await t.test('the cookie choice is kept, for the current version only', async () => {
    const stale = await call('PUT', '/account/cookie-consent', {
      token: juan.token,
      body: { version: '2000-01-01', categories: { functional: true } },
    });
    assert.equal(stale.status, 409);
    const { status } = await call('PUT', '/account/cookie-consent', {
      token: juan.token,
      body: { version: COOKIE_CONSENT_VERSION, categories: { functional: true } },
    });
    assert.equal(status, 200);
  });

  await t.test('a request: details where needed, one open at a time, cancellable', async () => {
    const vague = await call('POST', '/privacy-requests', { token: juan.token, body: { type: 'correction' } });
    assert.equal(vague.status, 400);

    const first = await call('POST', '/privacy-requests', { token: juan.token, body: { type: 'access' } });
    assert.equal(first.status, 201);
    const second = await call('POST', '/privacy-requests', { token: juan.token, body: { type: 'access' } });
    assert.equal(second.status, 409);

    assert.equal((await call('POST', `/privacy-requests/${first.body.id}/cancel`, { token: juan.token })).status, 204);
    assert.equal((await call('POST', `/privacy-requests/${first.body.id}/cancel`, { token: juan.token })).status, 409);
  });

  await t.test('an administrator handles a request and the person is told', async () => {
    const { body } = await call('POST', '/privacy-requests', {
      token: ana.token,
      body: { type: 'access', details: 'Please send me the staff notes on my posts.' },
    });
    const url = `/admin/privacy-requests/${body.id}`;

    assert.equal((await call('PATCH', url, { token: admin.token, body: { status: 'in_progress' } })).status, 204);
    const noReply = await call('PATCH', url, { token: admin.token, body: { status: 'completed' } });
    assert.equal(noReply.status, 400);
    const done = await call('PATCH', url, {
      token: admin.token,
      body: { status: 'completed', response: 'The notes were sent to you today.' },
    });
    assert.equal(done.status, 204);

    const seen = await state(ana.token);
    assert.equal(seen.privacy.requests.find((r) => r.id === body.id).status, 'completed');
    assert.ok(seen.notifications.some((n) => n.type === 'privacy_request_updated'));
  });

  await t.test('nobody handles a request about their own account', async () => {
    const { body } = await call('POST', '/privacy-requests', { token: admin.token, body: { type: 'access' } });
    const { status } = await call('PATCH', `/admin/privacy-requests/${body.id}`, {
      token: admin.token,
      body: { status: 'in_progress' },
    });
    assert.equal(status, 400);
  });

  await t.test('a completed deletion request deletes the account, keeping its posts', async () => {
    const leaver = (await signUp({ name: 'Leah Leaver', email: 'leah@test.example' })).body.token;
    const kept = (await newPost(leaver, { title: 'Bench by the gate', message: 'It is broken and needs fixing.' })).body.id;
    const { body } = await call('POST', '/privacy-requests', { token: leaver, body: { type: 'deletion' } });

    const { status } = await call('PATCH', `/admin/privacy-requests/${body.id}`, {
      token: admin.token,
      body: { status: 'completed', response: 'Your account was deleted.', deletePosts: false },
    });
    assert.equal(status, 204);
    assert.equal((await logIn('leah@test.example')).status, 401);
    assert.equal((await post(admin.token, kept)).authorId, null, 'the post stays, without an owner');

    const [row] = await logRows('user_deleted');
    assert.equal(row.admin_name, 'Test Admin');
    assert.equal(row.ip_address, LOCAL_ADDRESS);
    assert.match(row.details, /^Leah Leaver \(leah@test\.example\) - their submissions were kept$/);
  });
});

test('newer Terms must be accepted before posting again', async () => {
  // As if the Terms had changed since Ana accepted them.
  await pool.query("UPDATE policy_acceptances SET version = '2000-01-01' WHERE user_id = $1 AND document = 'terms'", [
    ana.id,
  ]);
  const refused = await newPost(ana.token, { title: 'Water fountain', message: 'The fountain near hall B is dry.' });
  assert.equal(refused.status, 403);
  assert.equal(refused.body.mustAcceptTerms, true);

  const accepted = await call('POST', '/account/terms', {
    token: ana.token,
    body: { version: POLICY_VERSIONS.terms, keepSchoolDetails: false },
  });
  assert.equal(accepted.status, 204);
  const { status } = await newPost(ana.token, { title: 'Water fountain', message: 'The fountain near hall B is dry.' });
  assert.equal(status, 201);
});

test('managing accounts', async (t) => {
  await t.test('editing, with only the changed fields logged', async () => {
    const taken = await call('PATCH', `/admin/users/${ana.id}`, { token: admin.token, body: { email: juan.email } });
    assert.equal(taken.status, 400);
    const noConsent = await call('PATCH', `/admin/users/${ana.id}`, { token: admin.token, body: { studentId: '2024-9' } });
    assert.equal(noConsent.status, 400, 'no school details without her consent');

    const { status } = await call('PATCH', `/admin/users/${ana.id}`, {
      token: admin.token,
      body: { name: 'Ana Reyes', email: 'ana.reyes@test.example' },
    });
    assert.equal(status, 204);
    const rows = await logRows('user_updated');
    assert.deepEqual(entry(rows.at(-1)), {
      admin_id: Number(admin.id),
      admin_name: 'Test Admin',
      admin_role: 'admin',
      target_type: 'user',
      target_id: ana.id,
      details: 'Updated Email on Ana Reyes',
      ip_address: LOCAL_ADDRESS,
    });
  });

  await t.test('suspending turns posting off until the account is active again', async () => {
    const url = `/admin/users/${ana.id}/status`;
    assert.equal((await call('PATCH', url, { token: admin.token, body: { status: 'suspended' } })).status, 204);
    assert.equal((await newPost(ana.token, { title: 'While suspended' })).status, 403);
    assert.equal((await logIn('ana.reyes@test.example')).status, 403);

    assert.equal((await call('PATCH', url, { token: admin.token, body: { status: 'active' } })).status, 204);
    assert.equal((await newPost(ana.token, { title: 'Back again', message: 'Posting works again for me.' })).status, 201);
    const types = (await state(ana.token)).notifications.map((n) => n.type);
    assert.ok(types.includes('account_suspended') && types.includes('account_activated'));
    assert.equal((await logRows('user_suspended')).length, 1);
    assert.equal((await logRows('user_activated')).length, 1);
  });

  await t.test('changing a role, but never your own', async () => {
    const unknown = await call('PATCH', `/admin/users/${ana.id}/role`, { token: admin.token, body: { role: 'owner' } });
    assert.equal(unknown.status, 400);
    const own = await call('PATCH', `/admin/users/${admin.id}/role`, { token: admin.token, body: { role: 'student' } });
    assert.equal(own.status, 400);

    const { status } = await call('PATCH', `/admin/users/${ana.id}/role`, { token: admin.token, body: { role: 'student' } });
    assert.equal(status, 204);
    const [row] = await logRows('role_changed');
    assert.equal(row.details, 'Ana Reyes: user to student');
    assert.equal(row.ip_address, LOCAL_ADDRESS);
  });

  await t.test('you cannot suspend or delete yourself', async () => {
    const suspend = await call('PATCH', `/admin/users/${admin.id}/status`, { token: admin.token, body: { status: 'suspended' } });
    assert.equal(suspend.status, 400);
    assert.equal((await call('DELETE', `/admin/users/${admin.id}`, { token: admin.token })).status, 400);
  });

  await t.test('deleting keeps the account\'s posts', async () => {
    assert.equal((await call('DELETE', `/admin/users/${ana.id}`, { token: admin.token })).status, 204);
    assert.equal((await call('DELETE', `/admin/users/${ana.id}`, { token: admin.token })).status, 404);
    assert.equal((await post(admin.token, suggestionId)).authorId, null);
  });

  await t.test('make-admin promotes an account from the command line, and logs it', async () => {
    execFileSync(process.execPath, [path.join(__dirname, '..', 'src', 'config', 'make-admin.js'), juan.email], {
      env: process.env,
      stdio: 'pipe',
    });
    assert.equal((await me(juan.token)).role, 'admin');
    const rows = await logRows('role_changed');
    assert.deepEqual(entry(rows.at(-1)), {
      admin_id: null,
      admin_name: 'Command line',
      admin_role: null,
      target_type: 'user',
      target_id: juan.id,
      details: 'Juan Dela Cruz: student to admin',
      ip_address: null,
    });
  });
});

test('the activity log', async (t) => {
  await t.test('starts with how the panel got its administrator', async () => {
    const [row] = await logRows('first_admin');
    assert.deepEqual(entry(row), {
      admin_id: Number(admin.id),
      admin_name: 'Test Admin',
      admin_role: 'admin',
      target_type: 'user',
      target_id: admin.id,
      details: admin.email,
      ip_address: null,
    });
  });

  await t.test('is readable in full, newest first, by an administrator only', async () => {
    assert.equal((await call('GET', '/admin/activity-logs', { token: ana.token })).status, 401, 'Ana was deleted');
    const { status, body } = await call('GET', '/admin/activity-logs', { token: admin.token });
    assert.equal(status, 200);
    const { rows } = await pool.query('SELECT count(*)::int AS total FROM activity_logs');
    assert.equal(body.entries.length, rows[0].total);
    assert.equal(body.entries.at(-1).action, 'first_admin');
    assert.ok(body.entries.every((e) => e.adminName));
  });
});
