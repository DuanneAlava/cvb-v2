/*
 * The admin panel's charts, drawn as plain SVG.
 *
 * No charting library. Three small chart types cover everything the analytics
 * page needs, and writing them by hand keeps the download small, keeps them in
 * the site's own colours, and avoids a dependency that would have to be kept
 * up to date for the rest of the project's life.
 *
 * Every chart also prints its numbers as text beside the drawing. A bar is a
 * quick impression; the figure is what an administrator actually quotes in a
 * meeting - and it is what a screen reader can read out, which a bare <svg>
 * cannot.
 */

// Chart colours, in the order they get handed out. The first few are the
// site's own navy, so a chart looks like it belongs to this website.
export const SERIES_COLORS = [
  '#0f4c92', // navy-600
  '#1a5fae', // navy-500
  '#d9c04f', // mustard
  '#0d9488', // teal
  '#ea7317', // orange
  '#7c3aed', // violet
  '#dc2626', // red
  '#64748b', // slate
];

export function colorAt(index) {
  return SERIES_COLORS[index % SERIES_COLORS.length];
}

/* ------------------------------------------------------------------ *
 * BAR CHART
 *
 * Horizontal bars. Used for "which parts of campus get the most submissions",
 * where the labels are words rather than dates - horizontal bars give a long
 * label room to be read instead of tipping it on its side.
 *
 * COLOUR MEANS SOMETHING HERE.
 *
 * Each row carries its own `color`, taken from the same place its badge
 * colour comes from - so Pending is the amber it always is, Safety the red
 * it always is, and you can follow one status or one campus area across two
 * charts without re-reading the labels.
 *
 * That is the opposite of what it used to do, which was hand each row the
 * next colour in a palette. Six categories came out as six colours that
 * meant only "this is the fifth row" - the appearance of meaning with none
 * behind it. A row with no colour of its own falls back to navy.
 *
 * The bar is 8px - enough for the colour to register, short of the 10px it
 * started at, where the fill read as a block of colour rather than a scale.
 *
 * The percentage is off by default - with counts like 1 and 3, "17%" is a
 * second number saying what the first already said. Pass showPercent when
 * the share genuinely matters more than the count.
 * ------------------------------------------------------------------ */

export function BarChart({ data, showPercent = false }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const max = Math.max(...data.map((item) => item.value), 1);

  if (total === 0) {
    return <p className="py-6 text-center text-sm text-slate-400">No data yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {data.map((item) => {
        // Bars are drawn against the largest value, not the total, so a small
        // set of numbers still fills the width and stays comparable.
        const width = (item.value / max) * 100;
        const share = total ? Math.round((item.value / total) * 100) : 0;

        return (
          <li key={item.label}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium text-navy-900">{item.label}</span>
              <span className="shrink-0 tabular-nums text-slate-500">
                {item.value}
                {showPercent && <span className="ml-1.5 text-slate-400">{share}%</span>}
              </span>
            </div>

            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${item.color ?? 'bg-navy-600'}`}
                style={{ width: `${width}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ *
 * DONUT CHART
 *
 * A ring split into segments, with the total in the middle. Used where the
 * question is "how does the whole divide up" - the status of every submission,
 * for instance.
 *
 * The ring is drawn with one circle per segment, using stroke-dasharray to
 * show only that segment's slice of the circumference and stroke-dashoffset to
 * rotate it into place. That is far less code than working out arc paths, and
 * it animates cleanly.
 * ------------------------------------------------------------------ */

export function DonutChart({ data, centerLabel = 'Total' }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return <p className="py-6 text-center text-sm text-slate-400">No data yet.</p>;
  }

  const radius = 60;
  const circumference = 2 * Math.PI * radius;

  // Each segment starts where the previous one ended.
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
      <div className="relative shrink-0">
        <svg viewBox="0 0 160 160" className="h-40 w-40 -rotate-90" role="img" aria-label={`${centerLabel}: ${total}`}>
          {/* The track behind the segments, so a part-filled ring still reads
              as a ring. */}
          <circle cx="80" cy="80" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="20" />

          {data.map((item, index) => {
            const length = (item.value / total) * circumference;
            const segment = (
              <circle
                key={item.label}
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke={item.color ?? colorAt(index)}
                strokeWidth="20"
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-offset}
              />
            );
            offset += length;
            return segment;
          })}
        </svg>

        {/* The total, sitting in the hole. `pointer-events-none` keeps it from
            catching clicks meant for the chart. */}
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-2xl font-bold tabular-nums text-navy-900">{total}</p>
            <p className="text-xs text-slate-400">{centerLabel}</p>
          </div>
        </div>
      </div>

      {/* The key. This is where the actual numbers are read. */}
      <ul className="min-w-0 flex-1 space-y-1.5">
        {data.map((item, index) => (
          <li key={item.label} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: item.color ?? colorAt(index) }}
            />
            <span className="min-w-0 flex-1 truncate text-slate-600">{item.label}</span>
            <span className="shrink-0 font-semibold tabular-nums text-navy-900">{item.value}</span>
            <span className="w-10 shrink-0 text-right text-xs tabular-nums text-slate-400">
              {Math.round((item.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * LINE CHART
 *
 * A value over time - registrations per day, submissions per week. Points are
 * evenly spaced across the width, so the labels underneath are what say which
 * period each point belongs to.
 * ------------------------------------------------------------------ */

export function LineChart({ points, color = SERIES_COLORS[0], height = 160 }) {
  if (points.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-400">No data yet.</p>;
  }

  const width = 600;
  const padding = { top: 12, right: 8, bottom: 8, left: 8 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  // Never divide by zero, and always leave headroom above the tallest point.
  const max = Math.max(...points.map((point) => point.value), 1);

  const x = (index) =>
    padding.left + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  const y = (value) => padding.top + plotHeight - (value / max) * plotHeight;

  const line = points.map((point, index) => `${x(index)},${y(point.value)}`).join(' ');

  // The same line, closed along the bottom, to shade the area underneath.
  const area = `${padding.left},${padding.top + plotHeight} ${line} ${
    padding.left + plotWidth
  },${padding.top + plotHeight}`;

  const gradientId = `line-fade-${color.replace('#', '')}`;

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-40 w-full"
        role="img"
        aria-label={`Trend from ${points[0].label} to ${points[points.length - 1].label}, peak ${max}`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Three faint guides, so a point can be placed against a rough value
            without a full set of axis numbers cluttering the chart. */}
        {[0, 0.5, 1].map((fraction) => (
          <line
            key={fraction}
            x1={padding.left}
            x2={padding.left + plotWidth}
            y1={padding.top + plotHeight * fraction}
            y2={padding.top + plotHeight * fraction}
            stroke="#e2e8f0"
            strokeWidth="1"
          />
        ))}

        <polygon points={area} fill={`url(#${gradientId})`} />
        <polyline
          points={line}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {points.map((point, index) => (
          <circle
            key={point.label}
            cx={x(index)}
            cy={y(point.value)}
            r="3"
            fill="#ffffff"
            stroke={color}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      {/* The labels along the bottom. Only the ends and the middle are printed
          on a narrow screen, because a dozen dates side by side is unreadable. */}
      <div className="mt-1 flex justify-between text-xs text-slate-400">
        {points.map((point, index) => (
          <span
            key={point.label}
            className={
              index === 0 || index === points.length - 1 || index === Math.floor(points.length / 2)
                ? ''
                : 'hidden sm:inline'
            }
          >
            {point.label}
          </span>
        ))}
      </div>
    </div>
  );
}
