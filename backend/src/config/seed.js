/*
 * Loads starter data: the six categories, the demo student account, and
 * six sample posts, so the API and the frontend show the same content on
 * first run.
 * Run with: npm run db:seed  (after npm run db:migrate)
 *
 * Demo login -> email: demo@student.edu.ph   password: Demo1234
 *
 * Note: when using docker-compose, this file is not needed - Postgres runs
 * schema.sql and seed.sql automatically on first startup via
 * docker-entrypoint-initdb.d (see docker-compose.yml). Use this script
 * instead when running Postgres yourself, outside of Docker.
 */
const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function seed() {
  const seedPath = path.join(__dirname, '..', 'models', 'seed.sql');
  const seedSql = fs.readFileSync(seedPath, 'utf8');

  console.log('Seeding categories, demo account, and sample posts...');
  await pool.query(seedSql);

  console.log('Seed complete. Log in with demo@student.edu.ph / Demo1234');
  await pool.end();
}

seed().catch((err) => {
  console.error('Seeding failed:', err.message);
  process.exit(1);
});
