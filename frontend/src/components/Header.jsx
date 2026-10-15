import Button from './Button.jsx';
import { MEGAPHONE_PATHS } from './icons.js';
// Importing the photo lets the build add a fingerprint to its file name,
// so browsers pick up a new version instead of showing a stale cached one.
import campusPhoto from '../assets/OllcfLogo.jpg';

/*
 * The hero panel at the top of the landing page.
 *
 * It deliberately holds four things and nothing else:
 *   1. the short quote "Your campus, your voice"
 *   2. a short description of what the board is for
 *   3. the "Post a suggestion" button
 *   4. the "Voice out" button
 *
 * Everything is centred, and the buttons stack into one column on narrow
 * phones so they never overflow the screen.
 */
function Header({ onPostSuggestion, onVoiceOut }) {
  return (
    <section className="relative overflow-hidden bg-navy-900">
      {/*
        LAYER 1 - the campus photo, filling the whole hero.
        - `bg-cover` scales it to cover the area without squashing it
        - `bg-center` keeps the middle of the building in view as the screen
          gets narrower, so the sides are cropped rather than the entrance
        `aria-hidden` hides it from screen readers because it is decoration.
      */}
      <div
        aria-hidden="true"
        style={{ backgroundImage: `url(${campusPhoto})` }}
        className="pointer-events-none absolute inset-0 bg-cover bg-center"
      />

      {/*
        LAYER 2 - a navy tint over the photo.
        Without it the pale sky in the picture would sit behind the white
        heading and make it hard to read. The tint is slightly lighter at the
        top so the building still shows through, and deeper at the bottom
        where the buttons sit.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-navy-900/85 via-navy-900/88 to-navy-900/94"
      />

      {/*
        `relative` lifts the content above the glow layer behind it.
        Everything inside fades in on page load: the quote first, then the
        description, then the buttons, each one a little later than the
        last (see the `reveal-delay-*` helpers in index.css). The classes
        are applied here rather than to each child individually to keep
        this section easy to scan.
      */}
      <div className="relative mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 sm:py-24 lg:py-28">
        {/*
          THE SHORT QUOTE. The text size steps up as the screen gets wider.
          The words "your voice" are wrapped in their own <span> so they can be
          painted dirty yellow while the rest of the line stays white.
          `animate-fade-in-up` plays once on mount; no delay, so it leads.
        */}
        <h1 className="animate-fade-in-up text-3xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
          &ldquo;Your campus, <span className="text-mustard">your voice</span>.&rdquo;
        </h1>

        {/*
          THE DESCRIPTION under the quote, explaining what the board is for.
          - `mx-auto max-w-2xl` caps the line length so it stays easy to read
            on wide screens instead of stretching the full width
          - it inherits the centring from the `text-center` on the parent
          - `reveal-delay-1` makes it fade in just after the heading
        */}
        <p className="animate-fade-in-up reveal-delay-1 mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg">
          Post what needs fixing on campus, upvote what other students raised, and follow
          each suggestion from open to resolved. Staff reply in the open.
        </p>

        {/*
          THE TWO BUTTONS, centred under the description.
          - `flex-col` stacks them on small phones
          - `sm:flex-row` puts them side by side from 640px upwards
          - `justify-center` is what keeps them centred on the page
          - `reveal-delay-2` makes them the last thing to fade in
        */}
        <div className="animate-fade-in-up reveal-delay-2 mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button variant="cream" size="lg" onClick={onPostSuggestion} className="w-full sm:w-auto">
            {/*
              A plus sign, drawn as one upright line crossing one flat line.
              `aria-hidden` hides it from screen readers, because the button
              text beside it already says what the button does.
            */}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              aria-hidden="true"
              className="h-5 w-5"
            >
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            Post a Suggestion
          </Button>

          <Button variant="outline" size="lg" onClick={onVoiceOut} className="w-full sm:w-auto">
            {/* A megaphone, the same shape used in the CampusVoiceBox logo. */}
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-5 w-5">
              {MEGAPHONE_PATHS.map((path) => (
                <path key={path} d={path} />
              ))}
            </svg>
            Voice Out
          </Button>
        </div>
      </div>
    </section>
  );
}

export default Header;