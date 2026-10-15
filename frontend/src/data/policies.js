/*
 * THE POLICIES' VERSIONS, AND THE FACTS THEY STILL NEED.
 *
 * VERSIONS
 * Each policy page shows its version, and signing up sends the versions the
 * person was shown. The server holds the same versions
 * (backend/src/models/policies.js) and only accepts the current ones, so a
 * page left open while a policy changed is told to reload instead of
 * silently accepting text nobody read. CHANGE A POLICY'S TEXT, CHANGE ITS
 * VERSION HERE AND THERE. A version is the date it was last changed.
 *
 * COOKIE_CONSENT_VERSION is the version of the cookie choices: raising it
 * (in both files) asks everybody again - do that when what the optional
 * storage covers changes, so nobody's old answer stands for something new.
 *
 * FACTS STILL TO BE CONFIRMED
 * The policies need organisational facts that only the school can supply -
 * who is responsible for the data, how to reach them, how long records are
 * kept. They are NOT made up here. Every one of them is written below as a
 * placeholder, and the policy pages show each placeholder highlighted as
 * "to be confirmed" (components/PolicyPage.jsx). Fill them in here, in one
 * place, and the highlight disappears everywhere they are used.
 */

export const POLICY_VERSIONS = {
  terms: '2026-10-14',
  privacy: '2026-10-14',
  cookies: '2026-10-13',
};

export const COOKIE_CONSENT_VERSION = '2026-10-13';

// The three policy pages, in the order every list of them shows them: the
// links in the footers (components/PolicyLinks.jsx) and the other two
// policies at the foot of each one (components/PolicyPage.jsx).
export const POLICY_PAGES = [
  { to: '/privacy-policy', label: 'Privacy Policy' },
  { to: '/terms-and-conditions', label: 'Terms & Conditions' },
  { to: '/cookie-policy', label: 'Cookie Policy' },
];

/*
 * Each value is either the confirmed fact - a plain string - or `null`, which
 * the pages show as a highlighted "[To be confirmed: ...]" using the
 * description beside it. Replace a `null` with the real text once it is known.
 */
export const ORGANIZATION = {
  name: { value: null, describe: 'the school or organisation responsible for CampusVoiceBox' },
  address: { value: null, describe: 'its postal address' },
  dpoName: { value: null, describe: 'the name or title of the Data Protection Officer' },
  dpoEmail: { value: null, describe: 'the Data Protection Officer\'s email address' },
  supportContact: { value: null, describe: 'who students contact about their account or a post' },
  handover: { value: null, describe: 'how an assigned college or office receives a concern, and how it handles the information' },
  emergencyContact: { value: null, describe: 'who to contact in an emergency on campus' },
  effectiveDate: { value: null, describe: 'the date these policies take effect' },
  hosting: { value: null, describe: 'the hosting provider and the country where the server and database are kept' },
  emailProvider: { value: null, describe: 'the email service that sends password reset emails (for example, the school\'s Google Workspace)' },
  retention: { value: null, describe: 'how long accounts, posts, logs and requests are kept' },
  responseTime: { value: null, describe: 'how quickly privacy requests are answered' },
  eligibility: { value: null, describe: 'who may register - for example, enrolled students and staff of the school' },
  minors: { value: null, describe: 'how accounts of students under 18 are handled, including any parent or guardian consent' },
};

/*
 * What a privacy request can ask for - the same four types as the server
 * (PRIVACY_REQUEST_TYPES in backend/src/models/policies.js).
 * `detailsRequired` matches the server's rule: a correction or an "other"
 * request means nothing without saying what it is about.
 */
export const PRIVACY_REQUEST_TYPES = [
  {
    key: 'access',
    label: 'Access',
    description:
      'A copy of information about you that the download does not include - for example, the internal staff notes on your posts.',
    detailsRequired: false,
  },
  {
    key: 'correction',
    label: 'Correction',
    description:
      'Fix something wrong that you cannot edit yourself, such as your email address.',
    detailsRequired: true,
  },
  {
    key: 'deletion',
    label: 'Account deletion',
    description:
      'Delete your account. An administrator reviews it first - see "What happens when you ask for deletion" below.',
    detailsRequired: false,
  },
  {
    key: 'other',
    label: 'Other privacy question or objection',
    description: 'Anything else about how your information is used, including objecting to a use.',
    detailsRequired: true,
  },
];

export const PRIVACY_REQUEST_STATUSES = {
  pending: { label: 'Waiting', className: 'bg-amber-100 text-amber-800' },
  in_progress: { label: 'Being handled', className: 'bg-sky-100 text-sky-800' },
  completed: { label: 'Completed', className: 'bg-emerald-100 text-emerald-800' },
  declined: { label: 'Declined', className: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Cancelled', className: 'bg-slate-100 text-slate-600' },
};

// The statuses in which a request is still waiting on somebody.
export const OPEN_PRIVACY_STATUSES = ['pending', 'in_progress'];

/*
 * The privacy log's entries, in words - the actions the server records in
 * privacy_events (backend/src/controllers/privacyController.js and the
 * privacy-request route in backend/src/routes/admin/privacyRequests.js).
 */
export const PRIVACY_EVENT_WORDS = {
  request_submitted: 'Made a request',
  request_cancelled: 'Cancelled a request',
  request_in_progress: 'Started handling a request',
  request_completed: 'Completed a request',
  request_declined: 'Declined a request',
  data_exported: 'Downloaded their own data',
};

export function requestTypeLabel(key) {
  return PRIVACY_REQUEST_TYPES.find((type) => type.key === key)?.label ?? key;
}

// The documents in a person's acceptance history, in words.
export const ACCEPTANCE_WORDS = {
  terms: { accepted: 'Accepted the Terms & Conditions' },
  privacy_notice: { acknowledged: 'Was shown the Privacy Policy at sign-up' },
  school_details: {
    granted: 'Agreed to CampusVoiceBox keeping school details',
    withdrawn: 'Withdrew agreement to keeping school details',
  },
};
