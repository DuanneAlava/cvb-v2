import { Link } from 'react-router-dom';
import Logo from './Logo.jsx';

/*
 * The shared frame for the log-in and sign-up pages: a white card centred on a
 * deep navy background. Both pages look identical apart from their fields, so
 * that shell lives here once instead of being written out twice.
 *
 * Props:
 * - title     the big heading, e.g. "Welcome back"
 * - subtitle  the grey line under the heading
 * - children  the form fields and submit button
 * - footer    the "Already have an account?" line at the bottom
 */
function AuthCard({ title, subtitle, children, footer }) {
  return (
    // `min-h-screen` fills the window; `items-center` centres the card vertically.
    // The padding keeps the card off the edges on small phones.
    <div className="flex min-h-screen items-center justify-center bg-navy-800 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl sm:p-8">
        {/* The logo doubles as a link back to the landing page. */}
        <Link to="/" className="inline-block">
          <Logo tone="dark" />
        </Link>

        <h1 className="mt-6 text-2xl font-bold text-navy-900">{title}</h1>
        <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>

        {/* The form supplied by whichever page is using this card. */}
        <div className="mt-6">{children}</div>

        {/* A thin divider, then the link across to the other auth page. */}
        <div className="mt-6 border-t border-slate-200 pt-4 text-center text-sm text-slate-500">
          {footer}
        </div>
      </div>
    </div>
  );
}

export default AuthCard;
