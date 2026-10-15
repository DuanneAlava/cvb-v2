const express = require('express');
const cors = require('cors');

const apiRoutes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

/*
 * BEHIND A REVERSE PROXY (nginx, a load balancer, a hosting platform), every
 * request arrives from the proxy's address. TRUST_PROXY tells Express how
 * many proxies to look past to find the visitor's own address - which the
 * activity log records and the rate limits count by (middleware/rateLimit.js).
 * Leave it unset when nothing sits in front of the server.
 */
const trustProxy = process.env.TRUST_PROXY;
if (trustProxy) app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);

// Do not announce "X-Powered-By: Express" to every visitor.
app.disable('x-powered-by');

/*
 * Security headers on every answer. The API sends data and files, never a
 * page to display, so: never guess a type other than the one given
 * (nosniff), never be shown inside somebody else's page, and run nothing if
 * an answer is ever opened directly.
 */
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  });
  next();
});

/*
 * Which websites may call this API from a browser: CORS_ORIGIN, a comma-
 * separated list (see .env.example). When the website and the API share one
 * address - "/api" behind the same web server - the browser does not ask.
 * `maxAge` lets the browser remember the answer to its "may I?" check for
 * ten minutes instead of asking again before nearly every request.
 * `exposedHeaders` lets the website read Content-Disposition from another
 * address - it carries the file name of "Download my data"
 * (controllers/privacyController.js); without it the browser hides it.
 */
app.use(
  cors({
    origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map((origin) => origin.trim()),
    exposedHeaders: ['Content-Disposition'],
    maxAge: 600,
  })
);

/*
 * How large a request body may be. A new post can carry up to three photos
 * or PDFs (models/files.js), and a profile photo is one small picture; every
 * other request is a few lines of text, and a small limit keeps a huge
 * request from tying the server up. The more specific limits come first:
 * once a body has been read, the general one leaves it alone.
 */
app.use('/api/posts', express.json({ limit: '3mb' }));
app.use('/api/account/photo', express.json({ limit: '1mb' }));
app.use(express.json({ limit: '100kb' }));

app.use('/api', apiRoutes);

// Anything outside /api/* is not a route this server knows about.
app.use((req, res) => res.status(404).json({ error: 'Not found.' }));

app.use(errorHandler);

module.exports = app;
