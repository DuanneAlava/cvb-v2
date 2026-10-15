import { Link } from 'react-router-dom';
import { POLICY_VERSIONS } from '../../data/policies.js';
import {
  HAS_TRACKING,
  SHOWN_CATEGORIES,
  STORAGE_ITEMS,
  openCookieSettings,
} from '../../services/consent.js';
import Button from '../../components/Button.jsx';
import PolicyPage, { PolicyTable } from '../../components/PolicyPage.jsx';

/*
 * THE COOKIE POLICY - /cookie-policy
 *
 * The table of what is stored is not typed out here: it is drawn from
 * STORAGE_ITEMS in services/consent.js - the same list the code that writes
 * each item takes its name from, and the same list the cookie window
 * enforces. So this page cannot describe storage that does not exist, or
 * leave out storage that does.
 */

const categoryLabel = (key) => SHOWN_CATEGORIES.find((category) => category.key === key)?.label ?? key;

const sections = [
  {
    id: 'what-they-are',
    title: 'Cookies and browser storage',
    content: (
      <>
        <p>
          Cookies are small files a website asks your browser to keep. Websites can also keep small
          pieces of information in the browser's own storage ("local storage" and "session storage").
          This policy covers both.
        </p>
        <p>
          <strong>CampusVoiceBox sets no cookies.</strong> It keeps a few small items in your browser's
          storage, all of them listed below, and all of them set by CampusVoiceBox itself - nothing is
          set by, or sent to, another company.
        </p>
      </>
    ),
  },
  {
    id: 'what-we-use',
    title: 'Exactly what is stored',
    content: (
      <>
        <PolicyTable
          head={['Name', 'Kind', 'Category', 'What it is for', 'How long']}
          rows={STORAGE_ITEMS.map((item) => [
            <code key="name" className="break-all font-mono text-xs">{item.name}</code>,
            item.where,
            categoryLabel(item.category),
            item.purpose,
            item.duration,
          ])}
        />
        <p>
          Provider of every item: CampusVoiceBox itself. Your browser may also keep ordinary copies of
          pages and images it has loaded (its "cache") to make the site faster - that is the browser's
          own behaviour, not information CampusVoiceBox stores about you.
        </p>
      </>
    ),
  },
  {
    id: 'categories',
    title: 'The categories',
    content: (
      <>
        {SHOWN_CATEGORIES.map((category) => (
          <p key={category.key}>
            <strong>
              {category.label}
              {category.optional ? ' (optional, off until you allow it)' : ' (always on)'}:
            </strong>{' '}
            {category.description}
          </p>
        ))}
        {!HAS_TRACKING && (
          <p>
            <strong>Analytics and marketing:</strong> CampusVoiceBox uses none. Nothing measures how
            you use the site or follows you to other websites, so there is nothing of this kind to
            allow or refuse.
          </p>
        )}
      </>
    ),
  },
  {
    id: 'your-choice',
    title: 'Your choice, and changing it',
    content: (
      <>
        <p>
          On your first visit, a box at the bottom of the screen asks you to choose. Optional storage
          is never written before you say yes to it. Your choice is remembered in your browser, so you
          are not asked on every visit - and if you are logged in, it is also saved with your account
          (only the choice, its version and the time), so your other devices remember it too.
        </p>
        <p>
          You can change your mind at any time with <strong>Cookie settings</strong> at the bottom of
          every page, or in the Privacy &amp; Data section of <Link to="/account">your account</Link>.
          Turning a category off deletes what is already stored in it straight away, and nothing more
          is written.
        </p>
        <p>
          If what an optional category covers ever changes, you are asked again, because your earlier
          answer was about something else.
        </p>
        <div className="mt-3">
          <Button type="button" variant="ghost" size="sm" onClick={openCookieSettings}>
            Open cookie settings
          </Button>
        </div>
      </>
    ),
  },
  {
    id: 'browser',
    title: 'Using your browser instead',
    content: (
      <p>
        Every browser lets you see and delete what a site has stored, usually under "Site settings" or
        "Privacy". Deleting CampusVoiceBox's data logs you out and forgets your cookie choice, so you
        will be asked again. Blocking site storage entirely means you cannot stay logged in.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    content: (
      <p>
        When this policy changes, its version and date at the top change. More about how your
        information is handled is in the <Link to="/privacy-policy">Privacy Policy</Link>.
      </p>
    ),
  },
];

function CookiePolicy() {
  return (
    <PolicyPage
      title="Cookie Policy"
      version={POLICY_VERSIONS.cookies}
      summary="What CampusVoiceBox keeps in your browser, why, for how long, and how to change your choice."
      sections={sections}
    />
  );
}

export default CookiePolicy;
