import { labelForSlug } from '../data/categories.js';
import { kindInfo } from '../data/workflow.js';
import { formatDate } from './admin/ui.jsx';

/*
 * One post on the board.
 *
 * Reading down a card:
 *   - the category label, and the kind as a tag if it is a concern
 *   - the title, then the message
 *   - any photos or files the student attached
 *   - who posted it
 *   - the vote meter along the bottom, with the Vote button in the corner
 *
 * THE VOTE METER
 * There is no target and no maximum: a post takes as many votes as students
 * give it. The bar shows the post's share of every vote cast on the board, so
 * the question it answers is the one a suggestion box exists to answer -
 * which of these does the campus want most - rather than "has this reached
 * some number somebody picked".
 *
 * Read it like an election result. Past halfway is a literal majority, and the
 * leading post is marked so the front-runner is obvious at a glance.
 *
 * Props:
 * - votes       how many students have backed THIS post
 * - totalVotes  every vote cast across the whole board, for the share
 * - isTopVoted  true when nothing on the board has more
 *
 * WHAT YOU'LL MEET IN THIS FILE (plain-English notes)
 *
 * - "Props"  The inputs a component receives, written as attributes where it
 *   is used: <SuggestionCard votes={3} />. Inside, they arrive as one object,
 *   and `{ suggestion, votes, ... }` in the parameter list pulls the named
 *   ones out ("destructuring"). `totalVotes = 0` is a default for when the
 *   caller leaves it out.
 * - `onVote`  A function passed in as a prop. The card does not know how
 *   voting works; it just calls onVote when the button is pressed and the
 *   page that owns the data does the rest. This is how a child talks to its
 *   parent in React.
 * - `{condition && <element />}`  Draw the element only when the condition
 *   is true. If it is false, nothing is drawn. Used for the kind tag.
 * - A template literal in className  `${kind.badgeClass}` drops a class name
 *   held in data into the class list, so the tag's colour comes from
 *   workflow.js rather than being repeated here.
 */
function SuggestionCard({ suggestion, votes, totalVotes = 0, isTopVoted = false, hasVoted, onVote }) {
  // Share of all votes cast. Guarded against the empty board, where every post
  // honestly has 0% rather than an undefined slice of nothing.
  const share = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
  const percent = Math.round(share);

  const hasMajority = share > 50;
  const attachments = suggestion.attachments ?? [];
  const kind = kindInfo(suggestion.kind);

  return (
    <article className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5">
      {/* THE LABEL ROW above the title. */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Which category this post belongs to. */}
        <span className="rounded-full bg-navy-100 px-2.5 py-0.5 text-xs font-semibold text-navy-700">
          {labelForSlug(suggestion.category)}
        </span>

        {/*
          A post in the concern family gets its kind as a tag - Concern,
          Complaint or Report, in the same colour the admin panel uses - so it
          stands apart from a suggestion. This replaced a "Voice out" tag that
          was read from a separate stored field; the kind is the one
          classification a post has, and this is it.
        */}
        {kind.group === 'concern' && (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${kind.badgeClass}`}>
            {kind.label}
          </span>
        )}

        {/*
          The date, pushed to the far right by `ml-auto`.
          Formatted rather than printed raw: submissions carry a full ISO
          timestamp so the admin panel can sort and age them, and dropping
          that straight onto a card would show "2026-08-25T02:45:13.419Z".
        */}
        <time dateTime={suggestion.createdAt} className="ml-auto text-xs text-slate-400">
          {formatDate(suggestion.createdAt)}
        </time>
      </div>

      {/* THE TITLE. `break-words` stops one very long word overflowing on phones. */}
      <h3 className="mt-2 break-words text-base font-bold text-navy-900">{suggestion.title}</h3>

      {/* THE MESSAGE. */}
      <p className="mt-1.5 break-words text-sm leading-relaxed text-slate-700">
        {suggestion.message}
      </p>

      {/* THE ATTACHMENTS, if the student added any. */}
      {attachments.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {attachments.map((file, index) => (
            <li key={index}>
              {file.type?.startsWith('image/') ? (
                // A photo, shown as a small square thumbnail. `object-cover`
                // fills the square without stretching the picture.
                <img
                  src={file.dataUrl}
                  alt={file.name}
                  className="h-20 w-20 rounded-lg border border-slate-200 object-cover"
                />
              ) : (
                // Anything that is not a photo is listed by name instead,
                // because there is nothing useful to show as a preview.
                <span className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-600">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-slate-400"
                  >
                    <path
                      d="M14 3v5h5M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="max-w-[10rem] truncate">{file.name}</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-xs text-slate-400">Posted by {suggestion.author}</p>

      {/*
        THE VOTE ROW along the bottom of the card.
        `mt-auto` pushes it to the bottom so the row lines up across cards of
        different heights sitting side by side.
      */}
      <div className="mt-auto flex items-end gap-3 border-t border-slate-100 pt-3">
        {/* THE METER on the left, taking whatever width is left over. */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs">
            {/* The raw count. This is the number that matters, so it leads and
                is never abbreviated or capped. */}
            <span className="font-semibold text-navy-900">
              {votes} {votes === 1 ? 'vote' : 'votes'}
            </span>

            {/* The front-runner, marked so the leader is obvious without
                having to compare bars across cards. */}
            {isTopVoted && votes > 0 && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                Most voted
              </span>
            )}

            <span
              className={`ml-auto shrink-0 ${
                hasMajority ? 'font-semibold text-emerald-700' : 'text-slate-400'
              }`}
            >
              {totalVotes === 0 ? 'No votes yet' : `${percent}% of all votes`}
            </span>
          </div>

          {/*
            THE BAR: a grey track with a coloured fill on top of it.
            `role="progressbar"` plus the aria values let a screen reader
            announce the same standing the bar shows visually - as a share,
            since there is no total to count towards.
          */}
          <div
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={
              totalVotes === 0
                ? 'No votes cast yet'
                : `${votes} votes, ${percent} percent of all votes on the board`
            }
            className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200"
          >
            {/*
              The width is set from JavaScript because it changes with every
              vote anywhere on the board, which Tailwind cannot know ahead of
              time. `transition-all` makes it slide to its new width when a
              vote lands, including votes cast in another tab.
            */}
            <div
              style={{ width: `${share}%` }}
              className={`h-full rounded-full transition-all duration-500 ${
                hasMajority ? 'bg-emerald-600' : 'bg-navy-600'
              }`}
            />
          </div>
        </div>

        {/*
          THE VOTE BUTTON, in the bottom-right corner of the card.

          The word on its own, no icon: the label already says exactly what the
          button does, and an arrow beside it only repeated that in a second
          language. `justify-center` keeps "Vote" and the longer "Voted"
          centred rather than sitting to one side once the icon is gone.

          It is a toggle: pressing it again takes the vote back, so each
          student only ever counts once towards the tally.
        */}
        <button
          type="button"
          onClick={() => onVote(suggestion.id)}
          aria-pressed={hasVoted}
          aria-label={hasVoted ? 'Remove your vote' : 'Vote for this suggestion'}
          className={`flex min-h-[44px] shrink-0 items-center justify-center rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
            hasVoted
              ? 'border-navy-600 bg-navy-600 text-white hover:bg-navy-700'
              : 'border-navy-200 bg-white text-navy-700 hover:border-navy-600 hover:bg-navy-50'
          }`}
        >
          {hasVoted ? 'Voted' : 'Vote'}
        </button>
      </div>
    </article>
  );
}

export default SuggestionCard;
