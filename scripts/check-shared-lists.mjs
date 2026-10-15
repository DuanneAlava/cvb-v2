/*
 * THE LISTS BOTH SIDES KEEP - CHECKED TO STILL MATCH.
 *
 * The website and the server each keep their own copy of a few lists: the
 * statuses and the moves between them, the kinds, the departments, the
 * categories, the roles and what they may do, the policy versions, the
 * privacy request types, the account fields, the password and email rules,
 * the blocked words and the filter that uses them. Each copy says "kept in
 * step with" the other. This script is what makes sure: it loads both copies
 * (and the lists written into models/schema.sql) and fails if any two differ.
 *
 * Run it from the repository root, once the backend's packages are installed
 * (the server's role check loads its database settings):
 *
 *   node scripts/check-shared-lists.mjs
 *
 * CI runs it on every push (.github/workflows/ci.yml).
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { deepStrictEqual } from 'node:assert/strict';

const require = createRequire(import.meta.url);
const root = new URL('../', import.meta.url);
const fe = (path) => import(new URL(`frontend/src/${path}`, root));
const be = (path) => require(fileURLToPath(new URL(`backend/src/${path}`, root)));

const feWorkflow = await fe('data/workflow.js');
const feCategories = await fe('data/categories.js');
const feRoles = await fe('data/roles.js');
const fePolicies = await fe('data/policies.js');
const feAccount = await fe('data/accountFields.js');
const feWords = await fe('data/blockedWords.js');
const feModeration = await fe('services/moderation.js');

const beWorkflow = be('models/workflow.js');
const beAuth = be('middleware/auth.js');
const bePolicies = be('models/policies.js');
const beAccount = be('models/accountRules.js');
const beWords = be('models/blockedWords.js');
const beModeration = be('models/moderation.js');

const schema = readFileSync(new URL('backend/src/models/schema.sql', root), 'utf8');

// The values a table's "CHECK (<column> IN ('a', 'b', ...))" allows in schema.sql.
function schemaList(table, column) {
  const block = schema.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\(([\\s\\S]*?)\\n\\);`));
  const match = block?.[1].match(new RegExp(`CHECK \\(${column} IN \\(([^)]*)\\)\\)`));
  if (!match) throw new Error(`schema.sql has no CHECK list for ${table}.${column}`);
  return [...match[1].matchAll(/'([^']*)'/g)].map((m) => m[1]);
}

const sorted = (list) => [...list].sort();

/* ------------------------------------------------------------------ */

const failures = [];

function check(name, run) {
  try {
    run();
    console.log(`  ok   ${name}`);
  } catch (problem) {
    failures.push(name);
    console.log(`  FAIL ${name}\n${String(problem.message).replace(/^/gm, '       ')}`);
  }
}

console.log('Lists kept on both sides:');

check('statuses, and the moves between them', () => {
  deepStrictEqual(
    feWorkflow.STATUS_LIST.map(({ key, public: isPublic, next }) => ({ key, public: isPublic, next })),
    Object.entries(beWorkflow.STATUSES).map(([key, { public: isPublic, next }]) => ({ key, public: isPublic, next }))
  );
  deepStrictEqual(sorted(feWorkflow.PUBLIC_STATUSES), sorted(beWorkflow.PUBLIC_STATUSES));
  deepStrictEqual(sorted(feWorkflow.STATUS_LIST.map((s) => s.key)), sorted(schemaList('posts', 'status')));
});

check('kinds, and which need a department', () => {
  deepStrictEqual(
    feWorkflow.KIND_LIST.map(({ key, needsAssignment }) => ({ key, needsAssignment })),
    Object.entries(beWorkflow.KINDS).map(([key, { needsAssignment }]) => ({ key, needsAssignment }))
  );
  deepStrictEqual(sorted(feWorkflow.KIND_LIST.map((k) => k.key)), sorted(schemaList('posts', 'kind')));
});

check('departments', () => {
  deepStrictEqual(
    feWorkflow.DEPARTMENTS.map(({ key, label }) => [key, label]),
    Object.entries(beWorkflow.DEPARTMENTS)
  );
});

check('categories (frontend and the rows schema.sql inserts)', () => {
  const insert = schema.match(/INSERT INTO categories \(slug, label\) VALUES([\s\S]*?)ON CONFLICT/);
  if (!insert) throw new Error('schema.sql does not insert the categories');
  const rows = [...insert[1].matchAll(/\('([^']*)', '([^']*)'\)/g)].map((m) => [m[1], m[2]]);
  deepStrictEqual(feCategories.CATEGORIES.map(({ slug, label }) => [slug, label]), rows);
});

check('roles, and what each may do', () => {
  const roles = schemaList('users', 'role');
  deepStrictEqual(sorted(feRoles.ROLE_LIST.map((r) => r.key)), sorted(roles));
  for (const role of roles) {
    for (const permission of Object.values(feRoles.PERMISSIONS)) {
      const account = { role, status: 'active' };
      deepStrictEqual(
        { role, permission, allowed: beAuth.can(account, permission) },
        { role, permission, allowed: feRoles.can(account, permission) }
      );
    }
  }
});

check('policy versions and the cookie-choice version', () => {
  deepStrictEqual(fePolicies.POLICY_VERSIONS, bePolicies.POLICY_VERSIONS);
  deepStrictEqual(fePolicies.COOKIE_CONSENT_VERSION, bePolicies.COOKIE_CONSENT_VERSION);
});

check('privacy request types and statuses', () => {
  const types = fePolicies.PRIVACY_REQUEST_TYPES.map((t) => t.key);
  deepStrictEqual(types, Object.keys(bePolicies.PRIVACY_REQUEST_TYPES));
  deepStrictEqual(sorted(types), sorted(schemaList('privacy_requests', 'type')));
  deepStrictEqual(
    sorted(Object.keys(fePolicies.PRIVACY_REQUEST_STATUSES)),
    sorted(schemaList('privacy_requests', 'status'))
  );
});

check('account fields, and which a person may edit themselves', () => {
  deepStrictEqual(feAccount.ACCOUNT_FIELDS.map((f) => f.key), beAccount.ADMIN_EDITABLE);
  deepStrictEqual(feAccount.STUDENT_EDITABLE_FIELDS.map((f) => f.key), beAccount.SELF_EDITABLE);
  deepStrictEqual(feAccount.ACCOUNT_FIELDS.filter((f) => f.school).length, beAccount.SCHOOL_COLUMNS.length);
});

check('the email rule', () => {
  deepStrictEqual(feAccount.EMAIL_PATTERN.source, beAccount.EMAIL_PATTERN.source);
});

check('the password rule', () => {
  deepStrictEqual(feAccount.PASSWORD_RULE_MESSAGE, beAccount.PASSWORD_RULE_MESSAGE);
  const samples = ['', 'short1', 'abcdefgh', '12345678', 'abcdefg1', 'ABCDEFG1', 'a1      ', 'pässwörd1', 'long password with 1 digit'];
  for (const password of samples) {
    deepStrictEqual(
      { password, accepted: feAccount.newPasswordProblem(password, password) === null },
      { password, accepted: beAccount.PASSWORD_PATTERN.test(password) }
    );
  }
});

check('blocked words', () => {
  for (const list of ['PROFANITY', 'INSULTS', 'FILIPINO_WORDS', 'BLOCKED_PHRASES', 'ALWAYS_ALLOWED']) {
    deepStrictEqual({ list, words: feWords[list] }, { list, words: beWords[list] });
  }
});

check('the filter gives the same answer on both sides', () => {
  const words = [...beWords.PROFANITY, ...beWords.INSULTS, ...beWords.BLOCKED_PHRASES, ...beWords.ALWAYS_ALLOWED];
  const samples = [
    ...words,
    ...words.map((word) => `The ${word.toUpperCase()} by the library.`),
    ...words.map((word) => word.split('').join(' ')),
    ...words.map((word) => word.replace(/a/g, '@').replace(/i/g, '1').replace(/o/g, '0')),
    'Please fix the broken chairs in room 204.',
    'The canteen line is too long at noon.',
    '',
  ];
  for (const text of samples) {
    deepStrictEqual({ text, result: feModeration.checkFields(text) }, { text, result: beModeration.checkFields(text) });
  }
  deepStrictEqual(feModeration.rejectionMessage(), beModeration.rejectionMessage());
});

if (failures.length > 0) {
  console.log(`\n${failures.length} list(s) differ between the website and the server - see above.`);
  process.exit(1);
}
console.log('\nEvery shared list matches.');
// The server's database pool is loaded with its role check but never used.
await be('config/db.js').end();
