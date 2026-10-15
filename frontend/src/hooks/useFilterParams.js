import { useSearchParams } from 'react-router-dom';

/*
 * FILTERS THAT LIVE IN THE ADDRESS BAR.
 *
 * The search box and every admin list keep their filters in the address
 * (?q=...&status=...) rather than in React state, so a filtered view
 * survives a reload, works with Back, and can be shared as a link. They all
 * change a filter the same way, so the way is written once here:
 *
 *   setFilter(key, value)   set one filter, leaving the others as they are;
 *                           an empty value removes it from the address
 *
 * `replace: true` overwrites the current history entry instead of adding
 * one, so Back does not step through every letter typed into a search.
 *
 * `alsoClear` names parameters that should go whenever a filter changes:
 *   components/SearchBar.jsx   'mine' - searching or picking a category
 *                              always shows the whole board, not just the
 *                              student's own posts
 *   pages/admin/Submissions.jsx 'highlight' - the post opened from a link
 *                              is forgotten once the list is re-filtered
 *
 * Also hands back `searchParams` (to read the filters) and the router's own
 * `setSearchParams`, for the few places that rewrite the address in some
 * other way - "Clear filters", for one.
 *
 * WHAT YOU'LL MEET HERE: a "custom hook" (see hooks/useEscapeKey.js), and
 * URLSearchParams - the browser's object for the part of an address after
 * `?`, with .get(), .set() and .delete().
 */
export function useFilterParams({ alsoClear = [] } = {}) {
  const [searchParams, setSearchParams] = useSearchParams();

  function setFilter(key, value) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    alsoClear.forEach((name) => next.delete(name));
    setSearchParams(next, { replace: true });
  }

  return { searchParams, setSearchParams, setFilter };
}
