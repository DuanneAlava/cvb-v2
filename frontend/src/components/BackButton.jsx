import { useNavigate } from 'react-router-dom';

/*
 * A "Back" button that always leads somewhere.
 *
 * "Back" should mean the page the person actually came from - the board, or
 * a suggestion they tried to vote on before being asked to sign in - so this
 * steps back through history rather than always jumping to one fixed page.
 *
 * The catch is that a page is often the FIRST page of a visit: opened from a
 * bookmark, a shared link, or a new tab. Going back from there leaves
 * CampusVoiceBox altogether, or does nothing at all if there is no history to
 * step into. Either way the button would look broken.
 *
 * React Router numbers the entries it creates, so `idx` says how deep into
 * this visit we are. Zero means this page is where the visit began, and the
 * button sends them to `fallback` instead - still "back", just to somewhere
 * that exists. The fallback is the board unless the page says otherwise.
 *
 * Used on the log-in and sign-up cards, the student dashboard and the
 * account page, which is why it lives here rather than inside one of them.
 *
 * WHAT YOU'LL MEET IN THIS FILE
 *
 * - window.history.state?.idx  The browser's history entry carries a small
 *   object React Router stores its position in. `?.` reads `idx` only if
 *   that object exists; `?? 0` treats a missing value as "first page".
 * - navigate(-1)  Go back one entry, like the browser's own Back button.
 * - navigate(path, { replace: true })  Go somewhere without leaving this
 *   page in the history, so pressing Back again does not bounce here.
 */
function BackButton({ fallback = '/', label = 'Back', className = '' }) {
  const navigate = useNavigate();

  function goBack() {
    const depth = window.history.state?.idx ?? 0;

    if (depth > 0) {
      navigate(-1);
    } else {
      navigate(fallback, { replace: true });
    }
  }

  return (
    /*
      `flex w-fit` rather than `inline-flex`: an inline button shares its line
      with whatever follows, which crowds the two together. Block-level puts
      Back on its own row and shrink-to-fit keeps it only as wide as its text.

      The negative left margin pulls the button's padding back so its text
      lines up with the content underneath rather than sitting indented.
    */
    <button
      type="button"
      onClick={goBack}
      className={`-ml-2 flex min-h-[44px] w-fit items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-navy-700 focus:outline-none focus:ring-2 focus:ring-navy-500 ${className}`}
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
      {label}
    </button>
  );
}

export default BackButton;
