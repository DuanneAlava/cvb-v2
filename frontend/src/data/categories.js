/*
 * The six categories of the suggestion board.
 *
 * This one list is the single source of truth. The navbar links, the mobile
 * burger menu, the filter pills and the "Post a suggestion" dropdown all read
 * from here, so adding a category in this file adds it everywhere at once.
 *
 * - `slug`  goes in the URL, for example /?category=food-canteen
 * - `label` is the text a student actually reads on screen
 */
export const CATEGORIES = [
  { slug: 'facilities', label: 'Facilities' },
  { slug: 'academics', label: 'Academics' },
  { slug: 'safety', label: 'Safety' },
  { slug: 'food-canteen', label: 'Food & Canteen' },
  { slug: 'organizations', label: 'Organizations' },
  { slug: 'school-environment', label: 'School Environment' },
];

// Look up a category's readable label from its slug, e.g. 'food-canteen' -> 'Food & Canteen'.
export function labelForSlug(slug) {
  return CATEGORIES.find((category) => category.slug === slug)?.label ?? '';
}
