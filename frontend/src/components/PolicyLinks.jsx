import { Link } from 'react-router-dom';
import { openCookieSettings } from '../services/consent.js';

/*
 * THE POLICY LINKS, AND THE WAY BACK INTO THE COOKIE CHOICE - one list,
 * drawn in the student site's footer (components/Footer.jsx), under the
 * log-in, sign-up and password-reset cards (components/AuthCard.jsx) and
 * at the foot of every admin page (components/admin/AdminLayout.jsx), so
 * every page offers the same four things in the same order.
 *
 * Props:
 * - newTab     open the policies in a new tab - for pages holding a form the
 *              person has started filling in, so reading a policy does not
 *              throw away what they typed
 * - className  placement
 */

const POLICIES = [
  { to: '/privacy-policy', label: 'Privacy Policy' },
  { to: '/terms-and-conditions', label: 'Terms & Conditions' },
  { to: '/cookie-policy', label: 'Cookie Policy' },
];

function PolicyLinks({ newTab = false, className = '' }) {
  const linkClass =
    'inline-flex min-h-[44px] items-center text-slate-600 underline-offset-2 hover:text-navy-700 hover:underline';
  const tab = newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {};

  return (
    <nav aria-label="Privacy and legal" className={className}>
      <ul className="flex flex-wrap items-center justify-center gap-x-4 text-sm">
        {POLICIES.map((policy) => (
          <li key={policy.to}>
            <Link to={policy.to} className={linkClass} {...tab}>
              {policy.label}
            </Link>
          </li>
        ))}
        <li>
          <button type="button" onClick={openCookieSettings} className={linkClass}>
            Cookie settings
          </button>
        </li>
      </ul>
    </nav>
  );
}

export default PolicyLinks;
