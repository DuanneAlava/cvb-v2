import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CATEGORIES } from '../data/categories.js';
import { useAuth } from '../context/AuthContext.jsx';
import Logo from './Logo.jsx';
import Button from './Button.jsx';

/*
 * The navy bar pinned to the top of every page.
 *
 * On a wide screen it shows the six category links in a row.
 * On a phone or tablet those links are hidden and a burger button opens them
 * in a drop-down panel instead.
 *
 * On the right hand side:
 * - logged out -> "Log in" and "Sign up" buttons (no profile is shown yet)
 * - logged in  -> the student's profile circle, name and a "Log out" button
 */
function Navbar() {
  // Tracks whether the mobile burger menu is open. It starts closed.
  const [menuOpen, setMenuOpen] = useState(false);

  // Lets us read and change the ?category=... part of the address bar.
  const [searchParams] = useSearchParams();
  const activeCategory = searchParams.get('category');

  // Who is logged in, and the function to log them out.
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Log out, close the burger menu, then return to the landing page.
  function handleLogout() {
    logout();
    setMenuOpen(false);
    navigate('/');
  }

  // Work out the styling for one category link.
  // The link for the category currently being viewed is highlighted.
  function categoryClass(slug) {
    const isActive = activeCategory === slug;
    return `rounded-md px-2.5 py-2 text-sm transition-colors ${
      isActive ? 'font-semibold text-white' : 'text-white/80 hover:text-white'
    }`;
  }

  return (
    <header className="sticky top-0 z-40 bg-navy-600 shadow-sm">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        {/* LEFT: the logo, which always links back to the landing page. */}
        <Link to="/" onClick={() => setMenuOpen(false)}>
          <Logo tone="light" />
        </Link>

        {/*
          MIDDLE: the six category links.
          `hidden lg:flex` means: hide these on small screens, show them from
          the large breakpoint (1024px) upwards, where there is room for them.
        */}
        <div className="hidden items-center gap-1 lg:flex">
          {CATEGORIES.map((category) => (
            <Link
              key={category.slug}
              to={`/?category=${category.slug}`}
              className={categoryClass(category.slug)}
            >
              {category.label}
            </Link>
          ))}
        </div>

        {/* RIGHT: either the auth buttons or the logged-in profile. */}
        <div className="flex items-center gap-2">
          {/* This block is hidden on small screens; it moves into the burger menu instead. */}
          <div className="hidden items-center gap-2 sm:flex">
            {user ? (
              // LOGGED IN - show the profile circle with the student's initials.
              <>
                <span className="flex items-center gap-2 text-sm text-white">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-white/20 text-xs font-bold">
                    {user.initials}
                  </span>
                  {/* The name is hidden on medium screens to save space. */}
                  <span className="hidden md:inline">{user.name}</span>
                </span>
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  Log out
                </Button>
              </>
            ) : (
              // LOGGED OUT - no profile appears here yet, only these two buttons.
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

          {/*
            The burger button. `lg:hidden` shows it on phones and tablets and
            hides it once the full row of category links has room to appear.
          */}
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            className="grid h-10 w-10 place-items-center rounded-lg text-white hover:bg-white/10 lg:hidden"
          >
            {/* Show an X while the menu is open, and the three burger lines while it is closed. */}
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
              {menuOpen ? (
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/*
        THE BURGER MENU PANEL.
        It only exists in the page while `menuOpen` is true, and it is hidden
        from large screens because those already show the links in the bar above.
      */}
      {menuOpen && (
        <div className="border-t border-white/15 bg-navy-600 lg:hidden">
          <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
            {/* The same six category links, stacked one per row for easy tapping. */}
            <div className="flex flex-col">
              {CATEGORIES.map((category) => (
                <Link
                  key={category.slug}
                  to={`/?category=${category.slug}`}
                  onClick={() => setMenuOpen(false)} // close the menu after choosing
                  className={`rounded-md px-2 py-3 text-base ${
                    activeCategory === category.slug
                      ? 'font-semibold text-white'
                      : 'text-white/85 hover:bg-white/10'
                  }`}
                >
                  {category.label}
                </Link>
              ))}
            </div>

            {/*
              The auth controls repeated inside the menu, because the versions in
              the bar are hidden on the smallest screens. `sm:hidden` keeps them
              from appearing twice on tablets.
            */}
            <div className="mt-3 flex gap-2 border-t border-white/15 pt-3 sm:hidden">
              {user ? (
                <>
                  <span className="flex flex-1 items-center gap-2 text-sm text-white">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-white/20 text-xs font-bold">
                      {user.initials}
                    </span>
                    {user.name}
                  </span>
                  <Button variant="outline" size="sm" onClick={handleLogout}>
                    Log out
                  </Button>
                </>
              ) : (
                <>
                  <Link to="/login" className="flex-1" onClick={() => setMenuOpen(false)}>
                    <Button variant="outline" size="sm" fullWidth>
                      Log in
                    </Button>
                  </Link>
                  <Link to="/signup" className="flex-1" onClick={() => setMenuOpen(false)}>
                    <Button variant="cream" size="sm" fullWidth>
                      Sign up
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export default Navbar;
