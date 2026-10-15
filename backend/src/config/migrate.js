/*
 * Creates every table from schema.sql if it does not already exist.
 * Run with: npm run db:migrate
 *
 * This is deliberately simple (no migration framework, no version table)
 * because the project is still at the 30% stage. It is safe to run more
 * than once - every statement in schema.sql uses IF NOT EXISTS.
 */
const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function migrate() {
  const schemaPath = path.join(__dirname, '..', 'models', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  console.log('Running schema.sql against', process.env.PGDATABASE || '(no PGDATABASE set)');
  await pool.query(schema);
  console.log('Migration complete: every table is ready, with the six categories filled in.');

  await pool.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
