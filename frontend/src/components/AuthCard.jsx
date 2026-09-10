import { Link, useNavigate } from 'react-router-dom';
import Logo from './Logo.jsx';

/*
 * The shared frame for the log-in and sign-up pages: a white card centred on a
 * deep navy background. Both pages look identical apart from their fields, so
 * that shell lives here once instead of being written out twice - which is why
 * the Back button only had to be added in one place to appear on both.
 *
 * Props:
 * - title     the big heading, e.g. "Welcome back"
 * - subtitle  the grey line under the heading
 * - children  the form fields and submit button
 * - footer    the "Already have an account?" line at the bottom
 */
function AuthCard({ title, subtitle, children, footer }) {
  const navigate = useNavigate();

  /*
   * THE BACK BUTTON.
   *
   * "Back" should mean the page they actually came from - the board, or a
   * suggestion they tried to vote on before being asked to sign in - so this
   * steps back through history rather than always jumping to one fixed page.
   *
   * The catch is that these pages are often the FIRST page of a visit: opened
   * from a bookmark, a shared link, or a new tab. Going back from there leaves
   * CampusVoiceBox altogether, or does nothing at all if there is no history
   * to step into. Either way the button would look broken.
   *
   * React Router numbers the entries it creates, so `idx` says how deep into
   * this visit we are. Zero means this page is where the visit began, and the
   * button sends them to the board instead - still "back", just to somewhere
   * that exists.
   */
  function goBack() {
    const depth = window.history.state?.idx ?? 0;

    if (depth > 0) {
      navigate(-1);
    } else {
      navigate('/', { replace: true });
    }
  }

  return (
    // `min-h-screen` fills the window; `items-center` centres the card vertically.
    // The padding keeps the card off the edges on small phones.
    <div className="flex min-h-screen items-center justify-center bg-navy-800 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl sm:p-8">
        {/*
          Back sits above everything else, at the top-left corner of the card,
          which is where a person looks for a way out of a form.

          `flex w-fit` rather than `inline-flex`: an inline button shares its
          line with the logo that follows, which crowds the two together and
          makes the margin below it do nothing. Block-level puts Back on its
          own row and shrink-to-fit keeps it only as wide as its own text.

          The negative left margin pulls the button's padding back so its text
          lines up with the logo underneath rather than sitting indented.
        */}
        <button
          type="button"
          onClick={goBack}
          className="-ml-2 mb-3 flex min-h-[44px] w-fit items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-navy-700 focus:outline-none focus:ring-2 focus:ring-navy-500"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
            className="h-4 w-4"
          >
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>

        {/* The logo doubles as a link back to the landing page. */}
        <Link to="/" className="inline-flex min-h-[44px] items-center">
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
