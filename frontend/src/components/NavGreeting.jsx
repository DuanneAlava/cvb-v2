import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { firstNameOf } from '../services/store.js';
import { takeWave } from '../services/greeting.js';
import { whenSplashGone } from '../services/splash.js';
import WaveHand from './WaveHand.jsx';

/*
 * "Hi, Juan [waving hand]" - the greeting just left of the profile circle.
 *
 * It uses the student's first name (see firstNameOf in services/store.js).
 * Every account has a name - signing up and the account page both require
 * one - but if one were ever blank the greeting would simply say "Hi"
 * rather than "Hi, " with nothing after it.
 *
 * A LONG NAME NEVER CRUSHES THE SEARCH BOX. First names run from "Jo" to
 * "Maximiliano", and the greeting shares one row with the logo and the
 * search box. Navbar.jsx keeps the search box at least 120px wide; if the
 * whole greeting does not fit beside that, the text is cut short with an
 * ellipsis ("Hi, Maximil...") instead - `min-w-0` lets it shrink and
 * `truncate` draws the "...". The hand never shrinks. On a wide screen the
 * text stops at 10rem (160px), so even a very long name stays tidy.
 *
 * WHEN IT SHOWS. Only to someone signed in; Navbar.jsx renders it in the
 * same place as the profile circle. Not on the narrowest phones (under
 * 360px), where that room is worth more to the search box. Below `md`
 * (768px) it is drawn in the smaller 14px text, because that is where the
 * navbar is most crowded; from `md` up it is 16px.
 *
 * THE WAVE. The hand waves once when the greeting first appears in a visit -
 * after logging in, after signing up, or on opening the site already signed
 * in - and then stays still. Two things decide the moment:
 *
 *   - whenSplashGone (services/splash.js) holds the wave until the loading
 *     screen has left, or it would play underneath it unseen
 *   - takeWave (services/greeting.js) remembers that it has waved, because
 *     the navbar is rebuilt when the student moves between pages and would
 *     otherwise wave on every one
 *
 * The wave is `motion-safe:` only: someone who has asked their device for
 * reduced motion sees the hand without the animation.
 *
 * WHAT YOU'LL MEET IN THIS FILE (plain-English notes)
 *
 * - `hidden min-[360px]:flex`  Hidden by default, shown as a flex row from a
 *   360px-wide screen upwards. `min-[360px]:` is a breakpoint written on the
 *   spot, for a width Tailwind has no name for.
 * - `origin-[50%_84%]`  The point the hand rotates around: halfway across and
 *   near the bottom, where the wrist is - so it swings like a hand, not a
 *   spinning sign.
 * - `em` units on the hand  Sized relative to the text, so the hand grows
 *   with the words from phone to desktop without its own breakpoints.
 */
function NavGreeting() {
  const { user } = useAuth();
  const [waving, setWaving] = useState(false);

  const userId = user?.id;
  useEffect(() => {
    if (!userId) return undefined;
    return whenSplashGone(() => {
      if (takeWave(userId)) setWaving(true);
    });
  }, [userId]);

  if (!user) return null;

  const name = firstNameOf(user.name);

  return (
    <p className="hidden min-w-0 items-center gap-1 text-sm font-semibold text-white min-[360px]:flex md:text-base">
      <span className="max-w-[10rem] truncate">{name ? `Hi, ${name}` : 'Hi'}</span>
      <WaveHand
        className={
          'h-[1.25em] w-[1.25em] shrink-0 origin-[50%_84%]' + (waving ? ' motion-safe:animate-wave' : '')
        }
      />
    </p>
  );
}

export default NavGreeting;
