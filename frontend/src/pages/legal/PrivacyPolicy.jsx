import { Link } from 'react-router-dom';
import { POLICY_VERSIONS } from '../../data/policies.js';
import PolicyPage, { ForReview, PolicyTable, ToConfirm } from '../../components/PolicyPage.jsx';

/*
 * THE PRIVACY POLICY - /privacy-policy
 *
 * Every statement about what CampusVoiceBox does is a description of what the
 * code actually does today: what the sign-up form asks for, what the server
 * keeps (backend/src/models/schema.sql), who is sent what
 * (backend/src/controllers/stateController.js). Change one of those, change
 * this page - and its version, in data/policies.js and the backend.
 *
 * Facts only the school can supply are <ToConfirm> placeholders, and legal
 * judgements the draft does not make are marked <ForReview>; see
 * components/PolicyPage.jsx. Written for the Philippine Data Privacy Act of
 * 2012 (Republic Act No. 10173), without claiming to satisfy it - that is
 * for the school's Data Protection Officer to confirm.
 */

const sections = [
  {
    id: 'introduction',
    title: 'About this policy',
    content: (
      <>
        <p>
          CampusVoiceBox is where students and staff post suggestions and voice out concerns about
          campus life, vote for what matters to them, and follow each submission until it is dealt
          with. Administrators review every submission and pass concerns to the college or office
          that can act on them.
        </p>
        <p>
          This policy explains, in plain words, what information about you CampusVoiceBox keeps, why,
          who can see it, how long it is kept, and what you can do about it. It is written with the
          principles of the Data Privacy Act of 2012 (Republic Act No. 10173) in mind:
          transparency, legitimate purpose and proportionality.
        </p>
      </>
    ),
  },
  {
    id: 'who-we-are',
    title: 'Who is responsible for your information',
    content: (
      <>
        <p>
          The organisation responsible for CampusVoiceBox and the information in it (the "personal
          information controller") is <ToConfirm fact="name" />, <ToConfirm fact="address" />.
        </p>
        <p>
          Data Protection Officer: <ToConfirm fact="dpoName" />, reachable at{' '}
          <ToConfirm fact="dpoEmail" />.
        </p>
      </>
    ),
  },
  {
    id: 'what-we-collect',
    title: 'What we collect',
    content: (
      <>
        <p>
          <strong>When you sign up:</strong> your full name, your email address and a password. The
          password is never stored as you typed it - only a scrambled, one-way version (a "bcrypt
          hash") that can check a password but cannot be turned back into it. If you forget your
          password, your email address is used to send you a link to choose a new one - only when
          you ask for it.
        </p>
        <p>
          <strong>School details, only if you agree:</strong> your student ID, course or program,
          year level and section. These are optional, and are kept only while you agree to it - see{' '}
          <a href="#lawful-basis">why we ask</a>. You can withdraw that agreement at any time, and the
          details are then removed.
        </p>
        <p>
          <strong>A profile photo, if you add one.</strong> It is cut to a square and shrunk in your
          browser before it is sent, which also removes the extra information phone cameras attach to
          photos, such as the location where it was taken.
        </p>
        <p>
          <strong>What you post:</strong> the type of submission (suggestion, request, concern,
          complaint or report), its category, title and message, any photos or PDF files you attach,
          and whether you chose to post anonymously. Photos are shrunk and re-saved in your browser,
          which removes camera and location information. <strong>PDF files are kept exactly as you
          upload them</strong>, so check that a PDF does not contain anything you do not want to share,
          such as an author name in its document properties.
        </p>
        <p>
          <strong>What happens to your posts:</strong> each post's status, the reason given if it is
          rejected, the college or office it is assigned to and the staff member handling it, the
          summary of how it was resolved, the dates of each step, and internal notes staff write
          about it.
        </p>
        <ul>
          <li><strong>Votes:</strong> which approved posts you voted for.</li>
          <li><strong>Notifications</strong> sent to you about your posts and your account.</li>
          <li>
            <strong>Account records:</strong> your role (student, user or administrator), whether the
            account is active or suspended, when it was created, and when you last logged in.
          </li>
          <li>
            <strong>Activity records:</strong> when you change your own account details, password or
            school-details agreement, an entry is kept with the date and the internet (IP) address the
            change came from. Administrators' actions and sign-ins are recorded the same way.
          </li>
          <li>
            <strong>Your choices:</strong> which version of the Terms & Conditions you accepted and
            when, which version of this policy you were shown at sign-up, your agreement (or not) to
            keeping school details, and your cookie choices.
          </li>
          <li>
            <strong>Privacy requests</strong> you make, with your name and email, and the answers.
          </li>
        </ul>
        <p>
          <strong>What we do not collect:</strong> CampusVoiceBox has no analytics, advertising or
          tracking tools, sets no cookies, and loads nothing from other companies' websites. It does
          not ask for your location, your contacts or your device's identity. Like every website, the
          server sees your internet address when your browser connects to it; the hosting provider (
          <ToConfirm fact="hosting" />) may keep its own technical records of those connections.
        </p>
      </>
    ),
  },
  {
    id: 'lawful-basis',
    title: 'Why we use it, and on what basis',
    content: (
      <>
        <PolicyTable
          head={['What', 'Why', 'Basis']}
          rows={[
            [
              'Name, email, password, role',
              'To create and run your account, let you log in, and know who is posting.',
              'Needed to provide the service you sign up for under the Terms & Conditions.',
            ],
            [
              'School details (optional)',
              'So staff can follow up a concern with the right student, and pass it to the right college.',
              'Your consent - asked separately, never required, and withdrawable at any time.',
            ],
            [
              'Posts, their files and what happens to them',
              'To review submissions, publish approved ones, route concerns to the people who can act, and tell you the outcome.',
              'Needed to provide the service; the school\'s legitimate interest in hearing and acting on campus concerns.',
            ],
            [
              'Votes',
              'To show which posts the campus supports most.',
              'Needed to provide the service.',
            ],
            [
              'Activity records, including internet addresses',
              'To keep the platform secure and administrators accountable, and to investigate misuse.',
              'The school\'s legitimate interest in security and accountability.',
            ],
            [
              'Records of what you accepted',
              'To show what you agreed to, and when.',
              'Accountability for your agreement.',
            ],
          ]}
        />
        <p>
          <ForReview>
            the Data Privacy Act treats information about a person's education as "sensitive personal
            information" (Section 3(l)), and processing it is generally allowed only on specific
            grounds such as consent (Section 13). This is why school details are optional and asked
            for separately. The school should confirm the basis for each row above, and whether any
            other information it keeps counts as sensitive.
          </ForReview>
        </p>
      </>
    ),
  },
  {
    id: 'who-can-see',
    title: 'Who can see what',
    content: (
      <>
        <p>
          <strong>Approved posts are public.</strong> Once an administrator approves a post, anyone
          who opens CampusVoiceBox can read it - including people who are not logged in. They see the
          title, message, category, type, attached photos and files, the date, the vote count, and
          your name, unless you posted anonymously.
        </p>
        <PolicyTable
          head={['Information', 'Who can see it']}
          rows={[
            ['An approved post, with your name', 'Anyone who opens the site'],
            ['An approved anonymous post', 'Anyone - shown as "Anonymous student". Administrators can still see who wrote it.'],
            ['A post that is pending or was rejected', 'You and administrators'],
            ['The rejection reason, the college assigned, the resolution summary', 'You and administrators'],
            ['Internal staff notes on your post', 'Administrators only'],
            ['Your email, school details and profile photo', 'You and administrators - never other students'],
            ['That you voted for a post', 'Nobody else: others see only the total'],
            ['Activity records and privacy requests', 'Administrators. Privacy requests only those administrators who handle privacy.'],
          ]}
        />
        <p>
          <strong>Anonymous posting</strong> hides your name from other users. It does not hide it
          from administrators: they need to know who sent a concern to follow it up, and to deal with
          misuse. Every page that shows your posts to others is built on the server without your
          name for anonymous posts, so your name is not sent to other people's devices at all.
        </p>
      </>
    ),
  },
  {
    id: 'moderation',
    title: 'How posts are reviewed',
    content: (
      <>
        <p>
          Nothing you submit appears on the board straight away. Every post starts as pending and
          waits for an administrator, who approves it or rejects it with a reason you are shown.
          Requests, concerns, complaints and reports are then assigned to the college or office that
          can act on them, and marked resolved with a summary of what was done. You are notified at
          each step.
        </p>
        <p>
          Before a post is sent, and again when it reaches the server, an automatic filter checks the
          title and message for swearing and insults in English and Filipino. A post that fails is
          refused and is not saved.
        </p>
        <p>
          How the assigned college or office receives a concern outside CampusVoiceBox, and what it
          does with it: <ToConfirm fact="handover" />.
        </p>
      </>
    ),
  },
  {
    id: 'storage-security',
    title: 'Where it is kept, and how it is protected',
    content: (
      <>
        <p>
          Everything is kept in one database on the CampusVoiceBox server - including your photos and
          files. Hosting provider and location: <ToConfirm fact="hosting" />. If the server is
          outside the Philippines, your information is transferred there;{' '}
          <ForReview>the safeguards for any such transfer</ForReview>.
        </p>
        <ul>
          <li>Passwords are stored only as one-way hashes.</li>
          <li>
            The server checks who you are and what you may do on every request - not just what your
            screen shows.
          </li>
          <li>
            Logging in gives your browser a sign-in token that expires after 7 days. Changing or
            resetting your password signs you out on every device. A password reset link works once,
            for one hour, and only a scrambled version of it is stored.
          </li>
          <li>
            Repeated wrong passwords on an account are paused for 15 minutes, and uploaded files are
            checked to be real photos or PDFs.
          </li>
          <li>
            The connection to the site is encrypted (HTTPS) where the hosting provides it:{' '}
            <ToConfirm fact="hosting" />.
          </li>
        </ul>
        <p>
          No system is perfectly secure. If a breach affects your information, the school's
          obligations to notify you and the National Privacy Commission apply.
        </p>
      </>
    ),
  },
  {
    id: 'sharing',
    title: 'Who we share it with',
    content: (
      <>
        <p>
          CampusVoiceBox does not sell your information or share it with advertisers. It is used by
          the school's administrators, and the details of a concern are passed to the college or
          office assigned to it. The hosting provider stores it on the school's behalf (
          <ToConfirm fact="hosting" />), and password reset emails are sent through{' '}
          <ToConfirm fact="emailProvider" />. It may be disclosed where the law requires it.
        </p>
      </>
    ),
  },
  {
    id: 'retention',
    title: 'How long it is kept',
    content: (
      <>
        <p>How the system behaves today:</p>
        <ul>
          <li>Your account and its details are kept until the account is deleted.</li>
          <li>
            When an account is deleted, its votes are kept without your name, so results do not
            change after the fact. Its posts are kept without your name too, unless deleting them
            was part of your deletion request and an administrator agreed.
          </li>
          <li>Your acceptance history is deleted with your account.</li>
          <li>
            Activity records and the privacy log are never edited or deleted, so they remain
            evidence of what was done.
          </li>
          <li>
            A privacy request is kept with your name and email after your account is deleted, as the
            record that the request was handled.
          </li>
        </ul>
        <p>
          The school's retention schedule: <ToConfirm fact="retention" />.
        </p>
      </>
    ),
  },
  {
    id: 'your-rights',
    title: 'Your rights',
    content: (
      <>
        <p>Under the Data Privacy Act you have the right to:</p>
        <ul>
          <li><strong>be informed</strong> about how your information is used - this policy;</li>
          <li>
            <strong>access</strong> your information - download a copy any time from{' '}
            <Link to="/account">your account</Link>, or ask for more;
          </li>
          <li><strong>correct</strong> information that is wrong;</li>
          <li><strong>object</strong> to a use of your information;</li>
          <li>
            <strong>withdraw consent</strong> you gave - for school details and optional cookies, in
            one click;
          </li>
          <li>
            <strong>have it erased or blocked</strong> where the law allows - ask for your account to
            be deleted;
          </li>
          <li><strong>data portability</strong> - your download is a standard JSON file;</li>
          <li><strong>be indemnified</strong> for damages caused by a breach of your rights;</li>
          <li>
            <strong>file a complaint</strong> with the National Privacy Commission.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'how-to',
    title: 'How to use your rights',
    content: (
      <>
        <p>
          Log in and open <Link to="/account">your account</Link>, then <strong>Privacy &amp;
          Data</strong>. There you can download a copy of your information, change your cookie
          choices and your agreement to keeping school details, see what you have accepted, and make
          a request for access, correction or deletion. A request made while you are logged in is
          already verified as yours.
        </p>
        <p>
          <strong>What happens when you ask for deletion:</strong> an administrator who handles
          privacy reviews the request, then deletes your account. They decide whether your posts are
          deleted too, or kept without your name - for example when a concern you raised is still
          being worked on - and records which. Information the school must keep, such as activity
          records, is not deleted. Once your account is deleted you can no longer log in to read the
          reply, so download a copy of your data first if you want one.
        </p>
        <p>
          You can also write to the Data Protection Officer at <ToConfirm fact="dpoEmail" />.
          Requests are answered within <ToConfirm fact="responseTime" />.
        </p>
      </>
    ),
  },
  {
    id: 'minors',
    title: 'Students under 18',
    content: (
      <>
        <p>
          Some students, such as those in Senior High School, may be under 18. How their accounts are
          handled: <ToConfirm fact="minors" />.
        </p>
        <p>
          <ForReview>whether a parent's or guardian's consent is needed for students under 18</ForReview>
        </p>
      </>
    ),
  },
  {
    id: 'complaints',
    title: 'Complaints',
    content: (
      <p>
        If you are unhappy with how your information is handled, contact the Data Protection Officer
        first, at <ToConfirm fact="dpoEmail" />. You can also complain to the National Privacy
        Commission of the Philippines (privacy.gov.ph).
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    content: (
      <p>
        When this policy changes, its version and date at the top change. If a change affects what you
        agreed to - such as the school details consent - you will be asked again. Earlier versions are
        kept by the school.
      </p>
    ),
  },
];

function PrivacyPolicy() {
  return (
    <PolicyPage
      title="Privacy Policy"
      version={POLICY_VERSIONS.privacy}
      summary="What CampusVoiceBox keeps about you, why, who can see it, and how to see, correct or delete it."
      sections={sections}
    />
  );
}

export default PrivacyPolicy;
