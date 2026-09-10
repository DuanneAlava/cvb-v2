import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Logo from './Logo.jsx';
import SearchBar from './SearchBar.jsx';
import ProfileMenu from './ProfileMenu.jsx';
import Button from './Button.jsx';

/*
 * The navy bar pinned to the top of the page.
 *
 * It now holds three things and nothing else, left to right:
 *
 *   1. the logo and the CampusVoiceBox name
 *   2. the search box, with the category dropdown built into its left edge
 *   3. the profile circle
 *
 * The row of category links that used to sit across the middle is gone. Those
 * categories now live in two places instead: the dropdown inside the search
 * box, and the "Browse by category" shortcuts inside the profile menu.
 *
 * On a phone the row wraps and the search box drops onto its own line
 * underneath, so the logo and the profile circle are never squashed. It is
 * still one search box, not a second copy - see the note on the row below.
 */
function Navbar() {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-navy-600 shadow-sm">
      <nav className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
        {/*
          ONE ROW THAT WRAPS, RATHER THAN TWO COPIES OF THE SEARCH BOX.

          The search box used to be rendered twice - once inline for desktop,
          once on a second row for phones - with each copy hidden at the other
          breakpoint. That quietly broke the box's self-measuring width: the
          hidden copy measures zero, so after the window crossed the breakpoint
          the now-visible copy kept a width it had worked out while invisible.

          Flex wrapping does the same layout with a single instance. On a phone
          the search box carries `order-last w-full` and drops onto its own
          line; from `sm` up the row stops wrapping and it sits inline between
          the logo and the buttons.
        */}
        <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap sm:gap-4">
          {/* 1. THE LOGO, which always links back to the board. `shrink-0`
                stops it being squeezed when the search box grows. */}
          <Link
            to="/"
            // min-h/min-w pad the tap area out to 44px around the 36px mark; the
            // artwork itself is unchanged, it just sits centred in a bigger target.
            className="order-1 flex min-h-[44px] min-w-[44px] shrink-0 items-center sm:order-none"
            aria-label="CampusVoiceBox home"
          >
            {/*
              The wordmark is hidden on the narrowest phones, where the search
              box needs the room. The hexagon on its own still identifies the
              app, and the `aria-label` above keeps the link readable to screen
              readers either way.
            */}
            <span className="hidden sm:block">
              <Logo tone="light" />
            </span>
            <span className="sm:hidden">
              <Logo tone="light" showText={false} />
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

            The three ordering classes work as a set: on a phone the logo is
            1, the buttons are 2 and the search box is last, so it wraps onto
            its own line and takes the full width. From `sm` up ALL THREE
            reset to `order-none`, which hands the row back to the natural DOM
            order - logo, search, buttons. They have to be reset together;
            leaving any one of them ordered sorts it to the wrong end.

            `min-w-0` lets the box shrink rather than pushing the bar wider
            than the window.
          */}
          <div className="order-last w-full min-w-0 sm:order-none sm:w-auto sm:max-w-2xl sm:flex-1">
            <SearchBar />
          </div>

          {/*
            3. THE RIGHT-HAND END: the profile menu once logged in, or the two
            auth buttons before that.

            `ml-auto` holds it against the right edge at every width. It is
            what collects the space left over once the search box has taken
            its 672px, which is why the search stays tucked beside the logo
            while these stay pinned to the far right.
          */}
          <div className="order-2 ml-auto flex shrink-0 items-center gap-2 sm:order-none">
            {user ? (
              <ProfileMenu />
            ) : (
              <>
                <Link to="/login">
                  <Button variant="outline" size="sm">
                    Log in
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button variant="cream" size="sm">
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
