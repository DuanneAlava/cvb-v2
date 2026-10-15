const app = require('./app');
const { ensureDefaultAdmin } = require('./config/defaultAdmin');
const { mailConfigured } = require('./config/mail');

/*
 * REFUSE TO START WITHOUT A REAL SECRET.
 *
 * JWT_SECRET is what makes a sign-in token impossible to forge. With none
 * set, every token check fails; with the example's placeholder - which is
 * public, in .env.example - anybody could forge a token for any account,
 * administrators included. Both are mistakes to stop at the door rather than
 * discover later.
 */
const secret = process.env.JWT_SECRET || '';
const PLACEHOLDER = 'change-this-to-a-long-random-string';

if (!secret) {
  console.error('JWT_SECRET is not set. Copy .env.example to .env and set it - see GUIDE.md.');
  process.exit(1);
}
if (process.env.NODE_ENV === 'production' && (secret === PLACEHOLDER || secret.length < 32)) {
  console.error(
    'JWT_SECRET must be a long random value in production (at least 32 characters, not the example). ' +
      'Generate one with: openssl rand -hex 32'
  );
  process.exit(1);
}

/*
 * PASSWORD RESET EMAILS. Without a mail server, "Forgot password?" cannot
 * send its link (config/mail.js); without APP_URL the link would point at
 * this computer instead of the website. Neither stops the rest of the site
 * working, so they are warnings, not refusals.
 */
if (process.env.NODE_ENV === 'production') {
  if (!mailConfigured) {
    console.warn('SMTP_HOST is not set, so "Forgot password?" cannot email reset links. See .env.example.');
  }
  if (!process.env.APP_URL) {
    console.warn("APP_URL is not set, so reset links would point at http://localhost:3000. Set it to the website's address.");
  }
}

const PORT = process.env.PORT || 4000;

/*
 * THE DEFAULT ADMINISTRATOR is created before the server starts answering,
 * if the database has none yet (config/defaultAdmin.js). A failure here - the
 * database not reachable yet, say - is reported, and the server starts
 * anyway; the check runs again at the next start.
 */
ensureDefaultAdmin()
  .catch((err) => console.error('Could not check for the default administrator:', err.message))
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`CampusVoiceBox API listening on http://localhost:${PORT}`);
      console.log(`Try it: curl http://localhost:${PORT}/api/health`);
    });
  });
