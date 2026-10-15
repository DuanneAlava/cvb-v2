import { Link } from 'react-router-dom';
import { POLICY_VERSIONS } from '../../data/policies.js';
import PolicyPage, { ForReview, ToConfirm } from '../../components/PolicyPage.jsx';

/*
 * THE TERMS & CONDITIONS - /terms-and-conditions
 *
 * The rules for using CampusVoiceBox, written to match what the platform
 * actually does: every post is reviewed before it is published, rude words
 * are refused, administrators can suspend or delete accounts. Accepting
 * these is required at sign-up and checked by the server
 * (backend/src/controllers/authController.js); the version accepted is
 * recorded. When a change needs everybody to accept again, the backend's
 * TERMS_REQUIRED_VERSION is raised (backend/src/models/policies.js).
 *
 * Nothing here waives a right a person has by law - section 11 says so.
 */

const sections = [
  {
    id: 'acceptance',
    title: 'Agreeing to these terms',
    content: (
      <>
        <p>
          CampusVoiceBox is run by <ToConfirm fact="name" /> so that students and staff can raise
          suggestions and concerns about campus life. By creating an account you agree to these terms.
          If you do not agree, do not create an account - you can still read the public board.
        </p>
        <p>
          How we handle your information is explained in the <Link to="/privacy-policy">Privacy
          Policy</Link>, and what the site stores in your browser in the{' '}
          <Link to="/cookie-policy">Cookie Policy</Link>.
        </p>
      </>
    ),
  },
  {
    id: 'eligibility',
    title: 'Who can use CampusVoiceBox',
    content: (
      <ul>
        <li>Who may register: <ToConfirm fact="eligibility" />.</li>
        <li>One account per person. Use your own name and an email address that is yours.</li>
        <li>Keep your details accurate, and correct them on your account page if they change.</li>
        <li>Students under 18: <ToConfirm fact="minors" />.</li>
      </ul>
    ),
  },
  {
    id: 'account-security',
    title: 'Keeping your account safe',
    content: (
      <ul>
        <li>Keep your password to yourself. Never share your account.</li>
        <li>Log out when you use a shared or public computer.</li>
        <li>
          You are responsible for what is posted from your account. If you think someone else has used
          it, change your password straight away from your account page - or with "Forgot
          password?" on the log-in page - and tell{' '}
          <ToConfirm fact="supportContact" />.
        </li>
        <li>Do not try to get into another person's account or a part of the site you are not allowed into.</li>
      </ul>
    ),
  },
  {
    id: 'posting',
    title: 'What you may post',
    content: (
      <>
        <p>
          Post suggestions, requests, concerns, complaints and reports about campus life - facilities,
          academics, safety, the lounge area, organisations, the school environment. Good posts:
        </p>
        <ul>
          <li>are about a situation, not an attack on a person;</li>
          <li>are honest, and as specific as you can make them;</li>
          <li>are respectful - rude words are refused automatically, in English and Filipino;</li>
          <li>only include photos and files you have the right to share.</li>
        </ul>
        <p>
          You may post anonymously. Your name is then hidden from other users, but administrators can
          still see who sent it, so they can follow it up and deal with misuse.
        </p>
      </>
    ),
  },
  {
    id: 'not-allowed',
    title: 'What is not allowed',
    content: (
      <ul>
        <li>Harassment, bullying, threats or hate towards anyone.</li>
        <li>Pretending to be another person or another office.</li>
        <li>
          Sharing other people's personal information - names of individuals, contact details, student
          numbers, photos of people without their permission.
        </li>
        <li>Reports or claims you know are false, or posts made only to cause trouble.</li>
        <li>Spam, advertising, or the same post again and again.</li>
        <li>Files meant to harm a device, or attempts to break, overload or get around the site's security.</li>
        <li>Anything illegal.</li>
      </ul>
    ),
  },
  {
    id: 'your-content',
    title: 'Your posts and who owns them',
    content: (
      <>
        <p>
          What you write and the files you attach stay yours. By posting, you allow{' '}
          <ToConfirm fact="name" /> to store your post, review it, show it on the board once approved,
          pass it to the college or office that can act on it, and count it in summary reports about
          the platform. <ForReview>the exact scope and duration of this permission</ForReview>
        </p>
        <p>
          You confirm that you have the right to share what you attach - for example, that a photo is
          your own or that you have permission to use it.
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
          Every post is reviewed by an administrator before anyone else can see it. An administrator
          may approve it, reject it with a reason you are shown, assign it to the college or office
          that can act on it, and mark it resolved with a summary. Administrators do not edit what you
          wrote: a post that needs changing is rejected with a reason, and you can post it again.
        </p>
        <p>
          A post that breaks these terms may be rejected, or taken off the board after it was
          approved. If you see a post that breaks these terms, tell <ToConfirm fact="supportContact" />.
        </p>
      </>
    ),
  },
  {
    id: 'misuse',
    title: 'False reports and misuse',
    content: (
      <p>
        A false report can harm real people and take staff away from real problems. Knowingly false or
        malicious posts may lead to your account being suspended or deleted, and may be dealt with
        under the school's own rules. <ForReview>how this platform's rules relate to the school's
        student code of conduct</ForReview>
      </p>
    ),
  },
  {
    id: 'suspension',
    title: 'Suspension and deletion of accounts',
    content: (
      <>
        <p>
          An administrator may <strong>suspend</strong> an account that breaks these terms. A
          suspended account can still read the board and its own submissions, but cannot post or vote,
          and cannot log in again until it is reactivated. You are told when this happens.
        </p>
        <p>
          An administrator may also <strong>delete</strong> an account. You can ask for your own
          account to be deleted from the Privacy &amp; Data section of{' '}
          <Link to="/account">your account</Link> - see the{' '}
          <Link to="/privacy-policy#how-to">Privacy Policy</Link> for what is kept afterwards.
        </p>
      </>
    ),
  },
  {
    id: 'availability',
    title: 'What CampusVoiceBox is - and is not',
    content: (
      <>
        <p>
          CampusVoiceBox is a channel for suggestions and concerns. It may sometimes be unavailable,
          for example during maintenance, and there is no promise that every post will be approved,
          acted on, or answered within a set time.
        </p>
        <p>
          <strong>It is not an emergency service.</strong> Posts are only read when an administrator
          reviews them. In an emergency, contact <ToConfirm fact="emergencyContact" /> immediately.
        </p>
      </>
    ),
  },
  {
    id: 'liability',
    title: 'Responsibility',
    content: (
      <>
        <p>
          You are responsible for what you post. The school is responsible for running the platform
          with reasonable care and for handling your information as the Privacy Policy describes.
        </p>
        <p>
          <ForReview>
            any limitation of the school's liability. Whatever is written here, nothing in these terms
            takes away the rights you have under Philippine law, including the Data Privacy Act of 2012.
          </ForReview>
        </p>
      </>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to these terms',
    content: (
      <p>
        When these terms change, their version and date at the top change. If a change matters to how
        you use the site, you will be asked to accept the new version the next time you visit, before
        you post or vote again. Reading the board is never blocked.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Questions and disagreements',
    content: (
      <>
        <p>
          Questions about these terms, a post or your account: <ToConfirm fact="supportContact" />.
          Privacy questions: the Data Protection Officer, at <ToConfirm fact="dpoEmail" />.
        </p>
        <p>
          If you disagree with a decision about your post or your account, contact us first so it can
          be looked at again. <ForReview>the governing law and the dispute-resolution process</ForReview>
        </p>
      </>
    ),
  },
];

function TermsAndConditions() {
  return (
    <PolicyPage
      title="Terms & Conditions"
      version={POLICY_VERSIONS.terms}
      summary="The rules for using CampusVoiceBox: who can use it, what you may post, how posts are reviewed, and what happens if the rules are broken."
      sections={sections}
    />
  );
}

export default TermsAndConditions;
