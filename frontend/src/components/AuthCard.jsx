import { Link } from 'react-router-dom';
import Logo from './Logo.jsx';
import BackButton from './BackButton.jsx';
import PolicyLinks from './PolicyLinks.jsx';

/*
 * The shared frame for the log-in and sign-up pages: a frosted-glass card
 * centred on a deep navy background. Both pages look identical apart from
 * their fields, so that shell lives here once instead of being written out
 * twice - which is why the Back button only had to be added in one place to
 * appear on both.
 *
 * THE GLASS
 * The card is a clear pane of "liquid glass": nearly the tone of the page
 * behind it, with the edge doing the work - a thin bright rim along the top
 * and left where light would catch it, a fainter one along the bottom and
 * right, and a soft inner glow. That edge is three inset box-shadows, not a
 * border; a border is the same brightness all the way round and reads as a
 * drawn outline, where a highlight that fades from one corner to the other
 * reads as a bevelled edge. A top-to-bottom sheen (lighter at the top) and a
 * heavy blur behind finish it. Corners are 28px - big enough to read as a
 * lens, not so big the card turns into a pill.
 *
 * WHY THE PAGE IS BLUE-GREY, NOT NAVY. Clear glass takes on whatever is
 * behind it. On the deep navy the rest of the site uses, the card came out
 * dark and the form's dark text stopped being readable; the alternative was
 * flipping every label and input to a light-on-dark scheme. So the page is
 * a soft blue-grey gradient instead - the glass over it is light enough for
 * the form inside to stay exactly as it was, dark text on white inputs.
 *
 * Glass only reads as glass when there is something behind it to blur, and
 * a flat colour gives it nothing, so three large, softly blurred circles in
 * the brand colours sit behind the card. They are decoration only:
 * `aria-hidden`, no pointer events, and no animation, so there is nothing
 * for reduced-motion settings to object to. Everything is CSS; no image is
 * loaded, so the page opens as fast as it did before.
 *
 * Props:
 * - title     the big heading, e.g. "Welcome back"
 * - subtitle  the grey line under the heading
 * - children  the form fields and submit button
 * - footer    the "Already have an account?" line at the bottom (optional)
 *
 * Every card ends with the policy links and Cookie settings. They open in a
 * new tab, so reading a policy halfway through signing up does not throw
 * away what was typed.
 */
function AuthCard({ title, subtitle, children, footer }) {
  return (
    // `min-h-screen` fills the window; `items-center` centres the card vertically.
    // The padding keeps the card off the edges on small phones. `relative` and
    // `overflow-hidden` are for the blurred circles: they are positioned
    // against this box and clipped at its edges, so a circle hanging off a
    // corner does not give the page a scrollbar.
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-300 via-navy-200 to-slate-400 px-4 py-10">
      {/*
        WHAT THE GLASS BLURS. Three big circles, each blurred so far
        (`blur-3xl`, 64px) that it reads as a soft glow rather than a shape:
        one navy, one mustard, one white, placed off-centre so the card
        catches an edge of each. Sizes and positions are picked by eye; there
        is nothing to compute.
      */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-navy-500/30 blur-3xl" />
        <div className="absolute -bottom-32 -right-16 h-[28rem] w-[28rem] rounded-full bg-white/50 blur-3xl" />
        <div className="absolute right-1/4 top-1/4 h-64 w-64 rounded-full bg-mustard/30 blur-3xl" />
      </div>

      {/*
        THE CARD. Reading the classes:

        bg-gradient-to-b from-white/55 to-white/30
            The sheen - a little brighter at the top, as a lit pane is.
        backdrop-blur-xl backdrop-saturate-150
            Blur what shows through (24px) and push its colour up a notch,
            so the glow behind stays a glow and looks lit from within.
        shadow-[...]  four shadows, in order:
            inset 1px 1px   white 70%   the bright rim, top and left
            inset -1px -1px white 25%   the faint rim, bottom and right
            inset 0 0 24px  white 20%   the inner glow along every edge
            0 24px 48px -12px navy 35%  the soft drop shadow underneath
        border border-white/30
            A faint uniform edge under the rims, so the pane still has an
            outline where the highlights fade out.
        rounded-[28px]
            The lens corners.

        `relative` lifts it above the circles.
      */}
      <div className="relative w-full max-w-md rounded-[28px] border border-white/30 bg-gradient-to-b from-white/55 to-white/30 p-6 shadow-[inset_1px_1px_0_rgba(255,255,255,0.7),inset_-1px_-1px_0_rgba(255,255,255,0.25),inset_0_0_24px_rgba(255,255,255,0.2),0_24px_48px_-12px_rgba(10,38,71,0.35)] backdrop-blur-xl backdrop-saturate-150 sm:p-8">
        {/* Back sits above everything else, at the top-left corner of the
            card, which is where a person looks for a way out of a form. The
            button itself - and the "where does back go?" logic - is shared
            with the student dashboard; see components/BackButton.jsx. */}
        <BackButton className="mb-3" />

        {/* The school seal and the app logo together, doubling as a link
            back to the landing page. */}
        <Link to="/" className="inline-flex min-h-[44px] items-center">
          <Logo tone="dark" showSeal />
        </Link>

        <h1 className="mt-6 text-2xl font-bold text-navy-900">{title}</h1>
        <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>

        {/* The form supplied by whichever page is using this card. */}
        <div className="mt-6">{children}</div>

        {/* A thin divider, then the link across to the other auth page -
            left out when a page has nothing to put there. */}
        {footer && (
          <div className="mt-6 border-t border-slate-200 pt-4 text-center text-sm text-slate-500">
            {footer}
          </div>
        )}

        <PolicyLinks newTab className="mt-4 border-t border-slate-200 pt-2" />
      </div>
    </div>
  );
}

export default AuthCard;
