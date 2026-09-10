import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CATEGORIES, labelForSlug } from '../data/categories.js';

/*
 * The search box that sits in the navbar, immediately beside the logo.
 *
 * It is one control made of two halves:
 *   LEFT  - a dropdown listing "All" plus the six categories. This is where
 *           the old row of navbar links now lives.
 *   RIGHT - the text box for searching the wording of posts.
 *
 * Both halves write straight into the address bar (?category=... and ?q=...)
 * rather than into React state. Keeping them there means the board can read
 * them from anywhere without state being passed down through components, the
 * Back button behaves, and a filtered view can be copied and shared as a link.
 */

/*
 * THE DROPDOWN IS A FIXED WIDTH.
 *
 * Left to itself a native <select> is as wide as its LONGEST option, forever -
 * so with "School Environment" in the list it sat at about 170px even while
 * showing the word "All", padding the control out with empty space.
 *
 * Sizing it to whatever is selected fixes that, but trades one problem for
 * another: the box then changes width every time a category is picked, and the
 * search field beside it jumps about. A control that moves while you are using
 * it is worse than one that is slightly roomy.
 *
 * So it is pinned. 8rem is the width where six of the seven labels - All,
 * Safety, Facilities, Academics, Lounge Area and Organization - fit whole,
 * leaving only "School Environment" to shorten with an ellipsis. The list
 * itself still opens at full width, so nothing is unreadable at the point of
 * choosing, and `title` puts the full label in a tooltip.
 *
 * Nothing in the bar changes size once it is drawn.
 *
 * AN ICON ON A PHONE. The search box now shares one navbar row with the
 * logo and the two auth buttons at every width, which leaves it around
 * 130px on a 360px screen. A dropdown showing a word would take most of
 * that, so below `sm` the dropdown is drawn as a filter icon 44px wide -
 * still the real <select>, laid over the icon at zero opacity, so a tap
 * opens the phone's own picker and every label is read at full size there.
 * A dot on the icon says a category is currently applied. The filter is the
 * secondary control and the search is the primary one, so the field people
 * type in gets the room.
 */
const SELECT_WIDTH = 'w-11 sm:w-32'; // an icon on phones, 8rem from `sm` up

/*
 * Whether the navbar is in its phone layout. Used only to shorten the
 * placeholder: "Search suggestions..." is a good prompt in a wide field and a
 * cut-off one in a 90px field. Below `sm` it reads "Search".
 */
const PHONE_QUERY = '(max-width: 639px)';

function useIsPhone() {
  const [isPhone, setIsPhone] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(PHONE_QUERY).matches
  );

  useEffect(() => {
    const media = window.matchMedia(PHONE_QUERY);
    const update = (event) => setIsPhone(event.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return isPhone;
}

function SearchBar() {
  const [searchParams, setSearchParams] = useSearchParams();
  const isPhone = useIsPhone();

  const category = searchParams.get('category') ?? ''; // '' means all categories
  const query = searchParams.get('q') ?? '';

  /*
   * Write one value into the address bar while leaving the others alone.
   * Passing an empty value removes that part of the address completely, so a
   * cleared search box does not leave "?q=" trailing behind.
   *
   * `replace: true` overwrites the current history entry instead of adding a
   * new one, so Back does not have to step through every letter typed.
   */
  function updateParam(key, value) {
    const next = new URLSearchParams(searchParams);

    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }

    // Searching or picking a category always shows the whole board, so the
    // "your posts only" filter from the profile menu is cleared here.
    next.delete('mine');

    setSearchParams(next, { replace: true });
  }

  return (
    <div className="flex w-full items-center rounded-lg bg-white shadow-sm ring-1 ring-white/20 focus-within:ring-2 focus-within:ring-mustard">
      {/* THE CATEGORY DROPDOWN on the left, inside the same rounded box. */}
      <div className="relative shrink-0 border-r border-slate-200">
        {/*
          THE PHONE FACE OF THE DROPDOWN: a filter icon, with a dot when a
          category is applied. Purely visual - `pointer-events-none` lets the
          tap through to the <select> laid over it, and it is hidden from
          `sm` up where the select shows its own text.
        */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 grid place-items-center text-navy-700 sm:hidden"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <path d="M3 5h18l-7 8v5l-4 2v-7L3 5Z" />
          </svg>
          {category && (
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-mustard ring-2 ring-white" />
          )}
        </span>

        <select
          value={category}
          onChange={(event) => updateParam('category', event.target.value)}
          aria-label="Filter by category"
          // A label too long for the fixed width is shortened on screen, so the
          // full text is offered here instead of being lost.
          title={category ? labelForSlug(category) : 'All categories'}
          /*
            `opacity-0` below `sm` hides the select's own rendering behind the
            icon while keeping it fully in the page: it is still focusable,
            still announced, and a tap on the icon is a tap on it.
          */
          className={`${SELECT_WIDTH} min-h-[44px] cursor-pointer truncate rounded-l-lg border-0 bg-transparent py-2.5 pl-3 pr-2 text-sm font-medium text-navy-700 opacity-0 focus:outline-none sm:opacity-100`}
        >
          {/* The empty value is what clears the filter and shows every post. */}
          <option value="">All</option>
          {CATEGORIES.map((item) => (
            <option key={item.slug} value={item.slug}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      {/*
        THE TEXT BOX, taking every pixel the dropdown does not.
        `flex-1` claims the remaining width; `min-w-0` is what allows it to
        shrink below its content's natural size on a narrow phone instead of
        pushing the whole bar wider than the screen.
      */}
      <div className="relative min-w-0 flex-1">
        {/* The magnifying glass sits inside the box on the left. */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
          className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 sm:left-2.5"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>

        <input
          type="search"
          value={query}
          onChange={(event) => updateParam('q', event.target.value)}
          placeholder={isPhone ? 'Search' : 'Search suggestions...'}
          aria-label="Search suggestions"
          /* Tighter inner padding on a phone: at 360px the field is about
             90px wide, and 44px of padding left "Search" clipped by a letter. */
          className="min-h-[44px] w-full rounded-r-lg border-0 bg-transparent py-2.5 pl-7 pr-2 text-sm text-navy-900 placeholder:text-slate-400 focus:outline-none sm:pl-8 sm:pr-3"
        />
      </div>
    </div>
  );
}

export default SearchBar;
