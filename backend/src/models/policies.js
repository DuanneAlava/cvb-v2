/*
 * THE CURRENT POLICY VERSIONS - the server's copy.
 *
 * The website shows the policies and sends back the version it showed when
 * somebody accepts one (frontend/src/data/policies.js holds the same
 * versions). The server only accepts the CURRENT version: a page left open
 * since before the Terms changed gets "reload and read them again", never a
 * silent acceptance of text the person did not see. Change a policy's text,
 * change its version in both files.
 *
 * A version is the date the text was last changed, written YYYY-MM-DD, so
 * two versions compare correctly as plain text.
 */
const POLICY_VERSIONS = {
  terms: '2026-10-14',
  privacy: '2026-10-14',
  cookies: '2026-10-13',
};

/*
 * THE OLDEST TERMS AN ACCOUNT MAY HAVE ACCEPTED AND STILL POST OR VOTE.
 *
 * Not every edit to the Terms needs everybody to accept them again - fixing a
 * typo does not. When a change does, raise this to the new version: every
 * account whose latest acceptance is older is then asked once, and until it
 * accepts, posting and voting are refused (middleware/terms.js). An account
 * that has never accepted any version - one made before the Terms existed -
 * is asked too.
 */
const TERMS_REQUIRED_VERSION = '2026-10-13';

/*
 * THE VERSION OF THE COOKIE CHOICES. Raise it when what the optional storage
 * categories cover changes materially - a new kind of storage added, say -
 * and everybody is asked again, because the choice they made was about
 * something else.
 */
const COOKIE_CONSENT_VERSION = '2026-10-13';

// The optional storage categories a person can turn on. Strictly necessary
// storage is not a choice, so it is not listed.
const OPTIONAL_COOKIE_CATEGORIES = ['functional'];

/*
 * What a privacy request can ask for, and the word used for each in the
 * messages people read: an "access" request, a "privacy" request... The
 * same four types as frontend/src/data/policies.js.
 */
const PRIVACY_REQUEST_TYPES = {
  access: 'access',
  correction: 'correction',
  deletion: 'deletion',
  other: 'privacy',
};

// The newest Terms version this account has accepted, or null.
async function latestTermsVersion(db, userId) {
  const { rows } = await db.query(
    "SELECT max(version) AS version FROM policy_acceptances WHERE user_id = $1 AND document = 'terms'",
    [userId]
  );
  return rows[0].version ?? null;
}

const mustAcceptTerms = (latestAccepted) =>
  !latestAccepted || latestAccepted < TERMS_REQUIRED_VERSION;

module.exports = {
  POLICY_VERSIONS,
  COOKIE_CONSENT_VERSION,
  OPTIONAL_COOKIE_CATEGORIES,
  PRIVACY_REQUEST_TYPES,
  latestTermsVersion,
  mustAcceptTerms,
};
