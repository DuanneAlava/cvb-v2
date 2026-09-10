const { Pool } = require('pg');
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
