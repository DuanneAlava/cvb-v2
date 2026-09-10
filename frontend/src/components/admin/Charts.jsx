/*
 * The admin panel's charts, drawn as plain markup.
 *
 * No charting library. One chart type covers everything the analytics page
 * needs, and writing it by hand keeps the download small, keeps it in the
 * site's own colours, and avoids a dependency that would have to be kept up
 * to date for the rest of the project's life.
 *
 * There used to be three. A doughnut and a line chart went with the
 * dashboard cards and trend selector they were drawn for: a doughnut of
 * five slices is a bar chart that is harder to read, and a trend line over
 * a handful of posts a week was flat with the occasional spike of one.
 *
 * The chart also prints its numbers as text beside the drawing. A bar is a
 * quick impression; the figure is what an administrator actually quotes in
 * a meeting - and it is what a screen reader can read out.
 */

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
