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
 * ONE ROW AT EVERY WIDTH. On a phone the search box used to wrap onto a
 * second line under the logo and the buttons, which read as a separate bar
 * rather than part of this one. It now stays between the logo and the
 * buttons all the way down, and the room comes from three places: the
 * wordmark is dropped (the hexagon alone identifies the app), the category
 * dropdown becomes an icon (see SearchBar.jsx), and the buttons lose a
 * little padding. At 360px that leaves the search field about 90px of
 * typing room, which is a magnifier and a word - enough to search on.
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

            `min-w-0` lets the box shrink rather than pushing the bar wider
            than the window - on a phone it is what gives the field whatever
            the logo and the buttons leave.
          */}
          <div className="min-w-0 flex-1 sm:max-w-2xl">
            <SearchBar />
          </div>

          {/*
            3. THE RIGHT-HAND END: the profile menu once logged in, or the two
            auth buttons before that.

            `ml-auto` holds it against the right edge at every width. It is
            what collects the space left over once the search box has taken
            its 672px, which is why the search stays tucked beside the logo
            while these stay pinned to the far right.

            The buttons are a touch tighter on a phone - 10px of side padding
            instead of 14px - which is 16px handed back to the search field
            without either label losing its full 44px tap height.
          */}
          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            {user ? (
              <ProfileMenu />
            ) : (
              <>
                <Link to="/login">
                  <Button variant="outline" size="sm" className="!px-2.5 sm:!px-3.5">
                    Log in
                  </Button>
                </Link>
                <Link to="/signup">
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
