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
 * NARROWER ON A PHONE, though. 8rem is a comfortable slice of a laptop
 * navbar and a greedy one on a 320px screen, where it took 44% of the bar
 * and squeezed the search field down to about seventeen visible characters -
 * with the placeholder itself cut off mid-word. The filter is the secondary
 * control and the search is the primary one, so those proportions were
 * backwards. 6rem still fits "All", which is what the box shows almost all
 * of the time, and hands the difference back to the field people type in.
 */
const SELECT_WIDTH = 'w-24 sm:w-32'; // 6rem on phones, 8rem from `sm` up

function SearchBar() {
  const [searchParams, setSearchParams] = useSearchParams();

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
      <select
        value={category}
        onChange={(event) => updateParam('category', event.target.value)}
        aria-label="Filter by category"
        // A label too long for the fixed width is shortened on screen, so the
        // full text is offered here instead of being lost.
        title={category ? labelForSlug(category) : 'All categories'}
        className={`${SELECT_WIDTH} min-h-[44px] shrink-0 cursor-pointer truncate rounded-l-lg border-0 border-r border-slate-200 bg-transparent py-2.5 pl-3 pr-2 text-sm font-medium text-navy-700 focus:outline-none`}
      >
        {/* The empty value is what clears the filter and shows every post. */}
        <option value="">All</option>
        {CATEGORIES.map((item) => (
          <option key={item.slug} value={item.slug}>
            {item.label}
          </option>
        ))}
      </select>

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
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>

        <input
          type="search"
          value={query}
          onChange={(event) => updateParam('q', event.target.value)}
          placeholder="Search suggestions..."
          aria-label="Search suggestions"
          className="min-h-[44px] w-full rounded-r-lg border-0 bg-transparent py-2.5 pl-8 pr-3 text-sm text-navy-900 placeholder:text-slate-400 focus:outline-none"
        />
      </div>
    </div>
  );
}

export default SearchBar;
