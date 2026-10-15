/*
 * A WAVING HAND, DRAWN RATHER THAN TYPED.
 *
 * The 👋 emoji looks different on every phone and computer - Apple, Google,
 * Samsung and Windows each draw their own, and some older devices show an
 * empty box. This is one hand, drawn in SVG, so every student sees the same
 * one at the same size, and it can be animated like any other element.
 *
 * HOW IT IS BUILT. A palm, four fingers and a thumb, each a simple rounded
 * shape on a 64 x 64 grid. The whole hand is drawn twice:
 *
 *   1. the OUTLINE layer - every shape in the darker gold, with a thick
 *      stroke, so together they form one solid silhouette a little bigger
 *      than the hand
 *   2. the FILL layer - the same shapes in the bright yellow, no stroke,
 *      laid on top
 *
 * What shows of layer 1 is only the rim around the outside. That is why there
 * are no outlines BETWEEN the fingers and the palm - a single stroke on each
 * shape would draw a line across every place two of them overlap.
 *
 * The fingers meet the palm flush, and the thumb sits on the curve of the
 * palm's heel at a tangent, so the silhouette has no notches where the parts
 * join.
 *
 * `className` sizes it and adds the wave (see NavGreeting.jsx). The hand is
 * decoration - the words beside it carry the meaning - so it is hidden from
 * screen readers.
 */

// The palm: a rectangle whose top corners are slightly rounded and whose
// bottom corners are fully rounded into the heel of the hand.
const PALM_PATH =
  'M21 32 H42 A4 4 0 0 1 46 36 V44 A12 12 0 0 1 34 56 H29 A12 12 0 0 1 17 44 V36 A4 4 0 0 1 21 32 Z';

// Index, middle, ring and little finger, left to right. The middle finger is
// the tallest, as on a real hand.
const FINGERS = [
  { x: 17, y: 14, width: 6, height: 26 },
  { x: 24.67, y: 10, width: 6, height: 30 },
  { x: 32.33, y: 12, width: 6, height: 28 },
  { x: 40, y: 18, width: 6, height: 22 },
];

// The thumb, tilted out from the heel of the palm.
const THUMB = {
  x: 21.66,
  y: 25.56,
  width: 7.5,
  height: 27,
  rx: 3.75,
  transform: 'rotate(-40 25.41 52.56)',
};

const OUTLINE = '#D4921A';
const FILL = '#FFC83D';

// One complete hand in a single colour. `stroke` is only set for the
// outline layer.
function HandShapes({ fill, stroke }) {
  const strokeProps = stroke ? { stroke, strokeWidth: 3, strokeLinejoin: 'round' } : {};
  return (
    <g fill={fill} {...strokeProps}>
      <rect {...THUMB} />
      {FINGERS.map((finger) => (
        <rect key={finger.x} {...finger} rx="3" />
      ))}
      <path d={PALM_PATH} />
    </g>
  );
}

function WaveHand({ className = '' }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" className={className}>
      {/* Leaning a little to the right, the way a hand mid-wave does. The
          pivot is the wrist, so the lean does not shift it sideways. */}
      <g transform="rotate(10 32 54)">
        <HandShapes fill={OUTLINE} stroke={OUTLINE} />
        <HandShapes fill={FILL} />
      </g>
    </svg>
  );
}

export default WaveHand;
