import { useEffect, useRef, useState } from 'react';
import { CATEGORIES, labelForSlug } from '../data/categories.js';
import { useFilterParams } from '../hooks/useFilterParams.js';

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
 *
 * WHAT YOU'LL MEET IN THIS FILE (plain-English notes)
 *
 * - The "query string"  The part of an address after `?`, e.g.
 *   ?category=safety&q=light. Each name=value pair is a "search param".
 * - useFilterParams()  The shared hook (hooks/useFilterParams.js) that reads
 *   those params and changes one at a time with setFilter(key, value) - the
 *   same one the admin lists use.
 * - A "controlled input"  An <input> whose `value` comes from our data and
 *   whose `onChange` writes back to it, so React - not the browser - owns
 *   what the box shows. Both the select and the text box here are controlled
 *   by the address bar.
 * - ResizeObserver  Tells us whenever an element changes size. It is how the
 *   placeholder picks a prompt that fits the field (see below).
 * - `opacity-0` over an icon  A standard trick for restyling a native
 *   <select>: the real control is made invisible but left in place, on top
 *   of the picture we want people to see, so a tap still opens it.
 * - `aria-hidden="true"`  Hide a purely decorative element from screen
 *   readers, so the icon is not announced on top of the select it decorates.
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
 * AN ICON BELOW `md` (768px). The search box shares one navbar row with the
 * logo and either the auth buttons or the greeting and profile circle, which
 * leaves it around 130px on a 360px phone. A dropdown showing a word would
 * take most of that, so the dropdown is drawn as a filter icon 44px wide -
 * still the real <select>, laid over the icon at zero opacity, so a tap
 * opens the device's own picker and every label is read at full size there.
 * A dot on the icon says a category is currently applied. The filter is the
 * secondary control and the search is the primary one, so the field people
 * type in gets the room.
 *
 * The icon stays until `md`, not just on phones: from 640px the
 * "CampusVoiceBox" wordmark returns beside the logo, and a 128px dropdown on
 * top of it left the field about 15px to type in on a 640px screen.
 */
const SELECT_WIDTH = 'w-11 md:w-32'; // an icon below `md`, 8rem from `md` up

/*
 * THE PLACEHOLDER FITS THE ROOM IT ACTUALLY HAS.
 *
 * The search field's width depends on more than the screen: on a phone it
 * shares the navbar with the school seal, the hexagon, and either the two
 * auth buttons or the greeting and the profile circle - and the greeting's
 * width depends on whose first name it shows. So rather than guessing from
 * the screen size, this measures the field itself and picks the longest
 * prompt that fits:
 *
 *   160px or more    "Search suggestions..."   (needs 140px in the 14px font)
 *   60px or more     "Search"                  (needs 45px)
 *   less             nothing - the magnifying glass already says "search",
 *                    and a word cut off to "Searc" looks broken
 *
 * Each cut-off is the words' width plus two allowances:
 *   about 12px for the clear (x) button Chrome and Safari put in a search
 *     box. It is hidden while the box is empty but still keeps its space, so
 *     the placeholder has that much less room than the box's measured width.
 *     (Measured: with the button hidden, "Search" fits a 55px box; with it,
 *     the "h" is cut off.) The button stays - it clears a search in one tap.
 *   a few more pixels, because Android and Windows draw the same words in
 *     slightly wider system fonts.
 *
 * ResizeObserver is the browser's way of being told when an element changes
 * size, without polling. `contentRect.width` is the width inside the
 * padding - the actual room for text.
 */
const FULL_PROMPT = 'Search suggestions...';
const SHORT_PROMPT = 'Search';
const FULL_PROMPT_MIN_WIDTH = 160;
const SHORT_PROMPT_MIN_WIDTH = 60;

function useFittingPlaceholder(ref) {
  const [placeholder, setPlaceholder] = useState(FULL_PROMPT);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(([entry]) => {
      const room = entry.contentRect.width;
      setPlaceholder(
        room >= FULL_PROMPT_MIN_WIDTH ? FULL_PROMPT : room >= SHORT_PROMPT_MIN_WIDTH ? SHORT_PROMPT : ''
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return placeholder;
}

function SearchBar() {
  // Searching or picking a category always shows the whole board, so the
  // "your posts only" filter from the profile menu (`mine`) is cleared
  // whenever either changes.
  const { searchParams, setFilter } = useFilterParams({ alsoClear: ['mine'] });
  const inputRef = useRef(null);
  const placeholder = useFittingPlaceholder(inputRef);

  const category = searchParams.get('category') ?? ''; // '' means all categories
  const query = searchParams.get('q') ?? '';

  return (
    <div className="flex w-full items-center rounded-lg bg-white shadow-sm ring-1 ring-white/20 focus-within:ring-2 focus-within:ring-mustard">
      {/* THE CATEGORY DROPDOWN on the left, inside the same rounded box. */}
      <div className="relative shrink-0 border-r border-slate-200">
        {/*
          THE NARROW-SCREEN FACE OF THE DROPDOWN: a filter icon, with a dot
          when a category is applied. Purely visual - `pointer-events-none`
          lets the tap through to the <select> laid over it, and it is hidden
          from `md` up where the select shows its own text.
        */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 grid place-items-center text-navy-700 md:hidden"
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
          onChange={(event) => setFilter('category', event.target.value)}
          aria-label="Filter by category"
          // A label too long for the fixed width is shortened on screen, so the
          // full text is offered here instead of being lost.
          title={category ? labelForSlug(category) : 'All categories'}
          /*
            `opacity-0` below `md` hides the select's own rendering behind the
            icon while keeping it fully in the page: it is still focusable,
            still announced, and a tap on the icon is a tap on it.
          */
          className={`${SELECT_WIDTH} min-h-[44px] cursor-pointer truncate rounded-l-lg border-0 bg-transparent py-2.5 pl-3 pr-2 text-sm font-medium text-navy-700 opacity-0 focus:outline-none md:opacity-100`}
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
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => setFilter('q', event.target.value)}
          placeholder={placeholder}
          aria-label="Search suggestions"
          /* Tighter inner padding until `md`: on a 360px phone, and again
             at 640px where the wordmark comes back, the field can be under
             100px wide, and every pixel of padding is one the word "Search"
             cannot use. 4px on the right is enough - the clear (x) button
             keeps its own space inside the box anyway. */
          className="min-h-[44px] w-full rounded-r-lg border-0 bg-transparent py-2.5 pl-7 pr-1 text-sm text-navy-900 placeholder:text-slate-400 focus:outline-none sm:pl-8 md:pr-3"
        />
      </div>
    </div>
  );
}

export default SearchBar;
