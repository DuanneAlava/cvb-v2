/*
 * THE ICONS USED IN MORE THAN ONE PLACE - each one the `d` of an SVG <path>,
 * drawn on the usual 24 x 24 grid. They live here once, so the same icon
 * cannot come out slightly different on two screens: the student navbar and
 * profile menu, the hero, the admin panel and the pop-ups all read them from
 * this file.
 *
 * An icon drawn in only one place stays in that file, beside the markup it
 * belongs to.
 */

// The notification bell - the student navbar, the profile menu, the admin header.
export const BELL_PATH = 'M18 16v-5a6 6 0 1 0-12 0v5l-2 3h16l-2-3ZM10 22h4';

// The X that closes a pop-up, or takes a chosen file back off a post.
export const CLOSE_PATH = 'M6 6l12 12M18 6L6 18';

// Four tiles - "Your dashboard" in the profile menu, Dashboard in the admin sidebar.
export const DASHBOARD_PATH = 'M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6V11h-6v9Zm0-16v5h6V4h-6Z';

// An arrow leaving a door - "Log out" in the profile menu and the admin sidebar.
export const LOGOUT_PATH = 'M15 17l5-5-5-5M20 12H9M12 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6';

/*
 * The megaphone of "Voice Out", the same shape as in the CampusVoiceBox logo:
 * its body, then two sound waves coming out of it. Drawn filled, not stroked.
 * The hero's large button shows all three; the profile menu's small row shows
 * the body and the nearer wave, which is all that reads at 16px.
 */
export const MEGAPHONE_PATHS = [
  'M3 10.5v3a1.5 1.5 0 0 0 1.5 1.5H6l3.2 3.7a1 1 0 0 0 1.8-.7V5.5a1 1 0 0 0-1.8-.7L6 8.5H4.5A1.5 1.5 0 0 0 3 10.5Z',
  'M14.5 9a1 1 0 0 1 1.4 0 4.3 4.3 0 0 1 0 6 1 1 0 1 1-1.4-1.4 2.3 2.3 0 0 0 0-3.2 1 1 0 0 1 0-1.4Z',
  'M17.3 6.2a1 1 0 0 1 1.4 0 8.2 8.2 0 0 1 0 11.6 1 1 0 0 1-1.4-1.4 6.2 6.2 0 0 0 0-8.8 1 1 0 0 1 0-1.4Z',
];
