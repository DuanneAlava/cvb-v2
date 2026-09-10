/*
 * The CampusVoiceBox brand mark: an orange hexagon, open on its right side,
 * with a blue voice waveform sitting inside it. The mark is followed by the
 * app name, so the pair always reads as "logo + CampusVoiceBox".
 *
 * It is drawn as SVG rather than loaded from a picture file so it stays sharp
 * on any screen and needs no extra download.
 *
 * Props:
 * - tone      'light' for dark backgrounds (the navy navbar),
 *             'dark' for white cards (the log-in and sign-up pages)
 * - showText  set to false to show the hexagon on its own, with no wordmark
 */

// The two brand colours, kept here so both the mark and any future use agree.
const ORANGE = '#EE7623';
const BLUE = '#1B4E9E';

/*
 * The waveform bars, described as [height in viewBox units].
 * Every bar is centred on the middle line, so a taller bar grows equally
 * upwards and downwards - exactly how a sound level meter behaves.
 */
const BAR_HEIGHTS = [16, 26, 12, 32, 20, 28, 14];

function Logo({ tone = 'light', showText = true }) {
  const textColor = tone === 'light' ? 'text-white' : 'text-navy-900';

  return (
    <span className={`flex items-center gap-2.5 font-bold tracking-tight ${textColor}`}>
      {/*
        The white tile behind the mark. The logo uses orange and dark blue, and
        dark blue on a navy navbar would be almost invisible, so the tile keeps
        both colours readable wherever the logo is placed. On a white card the
        tile simply blends in.
      */}
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white shadow-sm">
        <svg viewBox="0 0 64 64" className="h-7 w-7" role="img" aria-label="CampusVoiceBox">
          {/*
            THE ORANGE PART OF THE HEXAGON.
            It runs from the top-right corner, anti-clockwise around the top,
            left and bottom, stopping short of the bottom-right corner.
          */}
          <path
            d="M45.5 8.6 L18.5 8.6 L5 32 L18.5 55.4 L33 55.4"
            fill="none"
            stroke={ORANGE}
            strokeWidth="8.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/*
            THE BLUE PART OF THE HEXAGON - the bottom-right edge.
            The stretch between this piece and the orange one is left empty on
            purpose: that gap is what gives the mark its open, "listening" look.
          */}
          <path
            d="M39 55.4 L45.5 55.4 L59 32"
            fill="none"
            stroke={BLUE}
            strokeWidth="8.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/*
            THE WAVEFORM INSIDE.
            Each bar is a rounded rectangle. `x` steps along by 5.4 units so the
            bars are evenly spaced, and `y` is worked out from the height so the
            bar stays centred on the middle line.
          */}
          {BAR_HEIGHTS.map((height, index) => (
            <rect
              key={index}
              x={14.3 + index * 5.4}
              y={32 - height / 2}
              width="3"
              height={height}
              rx="1.5"
              fill={BLUE}
            />
          ))}
        </svg>
      </span>

      {showText && 'CampusVoiceBox'}
    </span>
  );
}

export default Logo;
