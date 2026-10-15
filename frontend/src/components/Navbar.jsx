import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Logo from './Logo.jsx';
import SearchBar from './SearchBar.jsx';
import ProfileMenu from './ProfileMenu.jsx';
import NavGreeting from './NavGreeting.jsx';
import NotificationBell from './NotificationBell.jsx';
import Button from './Button.jsx';

/*
 * The navy bar pinned to the top of the page.
 *
 * Left to right:
 *
 *   1. the school seal, the logo and the CampusVoiceBox name
 *   2. the search box, with the category dropdown built into its left edge
 *   3. "Hi, Juan" with a waving hand, the notification bell (from 640px) and
 *      the profile circle, or the Log in / Sign up buttons
 *
 * The row of category links that used to sit across the middle is gone. The
 * categories now live in one place: the dropdown inside the search box.
 *
 * ONE ROW AT EVERY WIDTH. Logo, search box and profile circle share a line
 * all the way down to a phone, and the room comes from three places: the
 * wordmark is dropped (seal and hexagon still identify the app), the
 * category dropdown becomes an icon (see SearchBar.jsx), the buttons lose a
 * little padding, and the profile circle drops its chevron - which is what
 * pays for the greeting beside it (see NavGreeting.jsx).
 *
 * WHAT YOU'LL MEET IN THIS FILE (plain-English notes)
 *
 * - Tailwind CSS  The styling system used throughout. Instead of writing CSS
 *   files, each element lists small "utility classes" in className, one per
 *   rule: `flex` (lay children out in a row), `items-center` (line them up
 *   vertically), `gap-2` (space between them), `px-3` (horizontal padding),
 *   `bg-navy-600` (background colour from tailwind.config.js).
 * - Breakpoint prefixes  `sm:gap-4` means "gap-4, but only from the small
 *   breakpoint (640px) upwards". Unprefixed classes are the phone layout;
 *   prefixed ones override it on wider screens. "Mobile first."
 * - `flex-1`  Take up whatever width is left over.
 * - `shrink-0`  Never be squeezed narrower than your content.
 * - `min-w-0`  Allow shrinking below the content's natural width - needed on
 *   a flex child that must not push the row wider than the screen.
 * - `ml-auto`  Push this item to the far right by giving it all the spare
 *   left margin.
 * - `!px-2.5`  The `!` makes the class "important", so it beats the padding
 *   the Button component sets for itself.
 * - `sticky top-0`  Stay pinned to the top of the window while the page
 *   scrolls underneath.
 * - `aria-label`  Text for screen readers when the visible content is only an
 *   image or an icon.
 * - <Link to="/">  react-router's replacement for <a href>; it changes the
 *   address without reloading the page.
 */
function Navbar() {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-navy-600 shadow-sm">
      <nav className="mx-auto max-w-7xl px-3 py-3 sm:px-6">
        {/*
          NO WRAPPING. The three items share one line, and `min-w-0` on the
          search box is what lets it shrink to whatever is left rather than
          pushing the bar wider than the screen.
        */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* 1. THE LOGO, which always links back to the board. `shrink-0`
                stops it being squeezed when the search box grows. */}
          <Link
            to="/"
            // min-h/min-w pad the tap area out to 44px around the 36px mark; the
            // artwork itself is unchanged, it just sits centred in a bigger target.
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center"
            aria-label="CampusVoiceBox home"
          >
            {/*
              The school seal sits in front of the hexagon at every width -
              it is the school's mark, and a phone is where most students
              will see it. Only the WORDMARK is dropped on phones, because
              the search box needs the room; "seal + hexagon" still says
              whose app this is, and the `aria-label` above keeps the link
              readable to screen readers either way. The marks themselves
              are 32px on phones and 36px from `sm` up (see Logo.jsx), which
              is what pays for the seal without squeezing the search field.
            */}
            <span className="hidden sm:block">
              <Logo tone="light" showSeal />
            </span>
            <span className="sm:hidden">
              <Logo tone="light" showSeal showText={false} />
            </span>
          </Link>

          {/*
            2. THE SEARCH BOX.

            SIZING:

            `flex-1` claims the free space and `max-w-2xl` stops it growing
            past 672px, because a search field stretched the full width of a
            wide monitor looks absurd for a few words of text.

            There is deliberately NO auto margin here. The box belongs beside
            the logo, so it starts immediately after it and any width left
            over collects on the right, before the buttons. Centring it in the
            leftover space would float it away from the wordmark it reads as
            part of.

            `min-w-0` lets the box shrink rather than pushing the bar wider
            than the window - on a phone it is what gives the field whatever
            the logo and the buttons leave.

            SIGNED IN, IT KEEPS A MINIMUM WIDTH. The greeting beside it holds
            the student's first name, and some first names are long; without
            a floor, "Hi, Maximiliano" would squeeze the field down to
            nothing. The floor leaves the dropdown plus about 40px to see what
            is being typed, and the greeting gives way instead (see
            NavGreeting.jsx). It follows the dropdown's own width (see
            SELECT_WIDTH in SearchBar.jsx):
              120px below `md`, where the dropdown is a 44px icon
              208px from `md` up, where the dropdown is 128px wide
            Signed out there is no floor - the auth buttons are a fixed
            width, so nothing can squeeze the box.
          */}
          <div
            className={`flex-1 sm:max-w-2xl ${user ? 'min-w-[7.5rem] md:min-w-[13rem]' : 'min-w-0'}`}
          >
            <SearchBar />
          </div>

          {/*
            3. THE RIGHT-HAND END: the greeting and the profile menu once
            logged in, or the two auth buttons before that.

            `ml-auto` holds it against the right edge at every width. It is
            what collects the space left over once the search box has taken
            its 672px, which is why the search stays tucked beside the logo
            while these stay pinned to the far right.

            The buttons are a touch tighter on a phone - 10px of side padding
            instead of 14px - which is 16px handed back to the search field
            without either label losing its full 44px tap height.

            Signed in, this end may shrink (`min-w-0`) - that is how a long
            name gives way to the search box's 120px. Only the greeting's
            text actually narrows; the profile circle stays 44px. Signed out
            it may not (`shrink-0`), so "Log in" can never wrap onto two lines.
          */}
          <div
            className={`ml-auto flex items-center gap-1.5 sm:gap-2 ${user ? 'min-w-0' : 'shrink-0'}`}
          >
            {user ? (
              /*
                On a phone the greeting sits 8px from the circle (this 4px
                gap plus the button's own 4px padding); from `sm` the bell
                comes between them, and from `md` the greeting stands 16px
                clear of the pair, as in the design. Below `md` the bar is at
                its most crowded - a phone, or 640-767px where the wordmark
                returns - so everything stays compact there and the search
                box keeps the room.
              */
              <div className="flex min-w-0 items-center gap-1 md:gap-4">
                <NavGreeting />
                {/* The bell (from `sm` up - see NotificationBell.jsx) sits
                    right beside the circle, as a pair. */}
                <div className="flex shrink-0 items-center gap-1">
                  <NotificationBell />
                  <ProfileMenu />
                </div>
              </div>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="outline" size="sm" className="!px-2.5 sm:!px-3.5">
                    Log in
                  </Button>
                </Link>
                {/*
                  "Sign up" only from 375px. Below that, the two buttons
                  together took about 140px of a 320px screen and left the
                  search box no room to type in at all. "Log in" stays, and
                  the log-in page has a "Create an account" link, so signing
                  up is still one tap further on.
                */}
                <Link to="/signup" className="hidden min-[375px]:block">
                  <Button variant="cream" size="sm" className="!px-2.5 sm:!px-3.5">
                    Sign up
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>

      </nav>
    </header>
  );
}

export default Navbar;
