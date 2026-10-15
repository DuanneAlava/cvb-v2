const { Pool } = require('pg');

/*
 * The settings in .env are loaded here, once, for the whole server. Every
 * entry point - server.js (through app.js), migrate.js and make-admin.js -
 * requires this file before anything reads process.env, so keep it that way
 * when adding a setting that is read as a file loads.
 */
require('dotenv').config();

/*
 * One shared connection pool for the whole app. `pg` reads PGHOST, PGPORT,
 * PGUSER, PGPASSWORD and PGDATABASE from the environment automatically, so
 * no config object is required here - it all comes from .env (see
 * .env.example) or from docker-compose.yml when running in Docker.
 */
const pool = new Pool();

pool.on('error', (err) => {
  // A background/idle client crashed - log it but do not crash the server.
  console.error('Unexpected error on idle Postgres client', err);
});

module.exports = pool;
