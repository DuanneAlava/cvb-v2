/*
 * The CampusVoiceBox brand mark: a hexagonal "C", orange across the top and
 * blue below, open on its right side, around a white hexagon holding a blue
 * voice waveform. The mark is followed by the app name, so the pair always
 * reads as "logo + CampusVoiceBox".
 *
 * Props:
 * - tone      'light' for dark backgrounds (the navy navbar),
 *             'dark' for white cards (the log-in and sign-up pages)
 * - showText  set to false to show the hexagon on its own, with no wordmark
 * - showSeal  set to true to put the Our Lady of Lourdes College Foundation
 *             seal to the LEFT of the hexagon, so the pair reads as
 *             "school + app". Off by default.
 * - subtitle  a small label stacked under the wordmark (the admin sidebar's
 *             "Admin Panel"). It shares the wordmark's column, so the two
 *             start at the same edge at every screen size.
 */

/*
 * The school seal. Importing the picture lets the build add a fingerprint to
 * its file name, so browsers pick up a new version instead of showing a stale
 * cached one.
 *
 * It is a 144px PNG made from the full-size 1254px original. The seal is
 * never shown larger than 36px, and 144 is four times that - sharp even on a
 * phone's high-density screen - at about a sixth of the original's size. PNG
 * rather than JPG because the seal's surroundings are transparent.
 */
import ollcfSeal from '../assets/OllcfSeal.png';

/*
 * The app's own mark, imported the same way and for the same reason.
 *
 * A 144px square PNG cut from the 1254px original: trimmed to the logo's own
 * edges, so none of the original's empty margin is shown, and centred in the
 * square. Like the seal it is shown at 36px at most, so 144 stays sharp on a
 * high-density phone screen. The background is transparent.
 */
import campusVoiceBoxLogo from '../assets/CampusVoiceBoxLogo.png';

/*
 * SIZE. The marks are 36px from the small breakpoint up and 32px on phones.
 * The phone navbar shows the seal AND the hexagon beside a search box and
 * two buttons on a 360px screen; four pixels off each mark, and two off the
 * gap between them, is what lets all of that share one row. On a white card
 * or in the admin sidebar the difference is not noticeable.
 */
const MARK_SIZE = 'h-8 w-8 sm:h-9 sm:w-9';

function Logo({ tone = 'light', showText = true, showSeal = false, subtitle }) {
  const textColor = tone === 'light' ? 'text-white' : 'text-navy-900';

  return (
    <span className={`flex items-center gap-2 font-bold tracking-tight sm:gap-2.5 ${textColor}`}>
      {/*
        THE SCHOOL SEAL, sitting to the left of the app's own mark.

        It is the same size as the white tile beside it, so the two read as
        one pair rather than a big badge next to a small one.

        THE SEAL IS SHOWN AS ITSELF - its own wavy purple edge is the outline.
        It used to sit on a white circle (`rounded-full bg-white`), which put
        a white ring round the wavy edge and turned the seal into a white
        badge. The picture's background is transparent, so with nothing
        behind it the navbar shows through between the waves, exactly like
        the official seal. `object-contain` fits the whole seal in the box
        without cropping or stretching it.
      */}
      {showSeal && (
        <img
          src={ollcfSeal}
          alt="Our Lady of Lourdes College Foundation"
          className={`${MARK_SIZE} shrink-0 object-contain`}
        />
      )}

      {/*
        The white tile behind the mark. Most of the logo is blue, and its
        darker lower half almost disappears against the navy navbar, so the
        tile keeps every part of it readable wherever the logo is placed. On
        a white card the tile simply blends in.

        THE LOGO FILLS THE TILE: 28px inside the 32px tile on a phone, 32px
        inside 36px from `sm` up - 2px of white above and below, a little
        more at the sides because the logo is narrower than it is tall.
        `object-contain` keeps its proportions exact.
      */}
      <span className={`grid ${MARK_SIZE} shrink-0 place-items-center rounded-xl bg-white shadow-sm`}>
        <img
          src={campusVoiceBoxLogo}
          alt="CampusVoiceBox"
          className="h-7 w-7 object-contain sm:h-8 sm:w-8"
        />
      </span>

      {showText &&
        (subtitle ? (
          <span className="flex flex-col leading-tight">
            CampusVoiceBox
            <span className="text-xs font-semibold uppercase tracking-wide text-mustard">
              {subtitle}
            </span>
          </span>
        ) : (
          'CampusVoiceBox'
        ))}
    </span>
  );
}

export default Logo;
