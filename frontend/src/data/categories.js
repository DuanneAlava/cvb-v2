/*
 * The six categories of the suggestion board.
 *
 * This one list is the single source of truth. The dropdown built into the
 * navbar search box, the shortcut links in the profile menu and the category
 * picker in the post form all read from here, so adding a category in this
 * file adds it everywhere at once.
 *
 * - `slug`  goes in the URL, for example /?category=lounge-area
 * - `label` is the text a student actually reads on screen
 * - `barClass` is this area's colour on a chart. Fixed per category rather
 *   than by position, so Safety is the same red wherever it appears and you
 *   can follow one area across two charts without re-reading the labels.
 */
export const CATEGORIES = [
  { slug: 'facilities', label: 'Facilities', barClass: 'bg-navy-600' },
  { slug: 'academics', label: 'Academics', barClass: 'bg-sky-500' },
  { slug: 'safety', label: 'Safety', barClass: 'bg-red-500' },
  { slug: 'lounge-area', label: 'Lounge Area', barClass: 'bg-teal-500' },
  { slug: 'organization', label: 'Organization', barClass: 'bg-orange-500' },
  { slug: 'school-environment', label: 'School Environment', barClass: 'bg-violet-500' },
];

// Look up a category's readable label from its slug, e.g. 'lounge-area' -> 'Lounge Area'.
export function labelForSlug(slug) {
  return CATEGORIES.find((category) => category.slug === slug)?.label ?? '';
}
