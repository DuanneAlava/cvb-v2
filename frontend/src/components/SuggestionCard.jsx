import { labelForSlug } from '../data/categories.js';

/*
 * One post on the board.
 *
 * The vote button on the left is a toggle: tapping it once backs the post,
 * tapping it again takes the vote away, so each student has one vote per post.
 */
function SuggestionCard({ suggestion, hasVoted, onVote }) {
  return (
    <article className="flex gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5">
      {/* THE VOTE BUTTON - an up arrow above the current vote count. */}
      <button
        type="button"
        onClick={() => onVote(suggestion.id)}
        aria-pressed={hasVoted} // tells screen readers whether the vote is currently on
        aria-label={hasVoted ? 'Remove your vote' : 'Vote for this suggestion'}
        className={`flex h-16 w-12 shrink-0 flex-col items-center justify-center rounded-lg border transition-colors ${
          hasVoted
            ? 'border-navy-600 bg-navy-600 text-white' // filled in once voted
            : 'border-slate-200 bg-slate-50 text-navy-700 hover:border-navy-200 hover:bg-navy-50'
        }`}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <path d="M12 5.5 4.5 14h5v5h5v-5h5L12 5.5Z" />
        </svg>
        <span className="mt-0.5 text-sm font-bold">{suggestion.votes}</span>
      </button>

      {/* THE POST ITSELF. `min-w-0` lets long words wrap instead of stretching the card. */}
      <div className="min-w-0 flex-1">
        {/* The row of small labels above the message. */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Which category this post belongs to. */}
          <span className="rounded-full bg-navy-100 px-2.5 py-0.5 text-xs font-semibold text-navy-700">
            {labelForSlug(suggestion.category)}
          </span>

          {/* A "Voice out" post gets an extra amber tag so it stands apart from a suggestion. */}
          {suggestion.type === 'voice' && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
              Voice out
            </span>
          )}

          {/* The date, pushed to the far right by `ml-auto`. */}
          <time className="ml-auto text-xs text-slate-400">{suggestion.createdAt}</time>
        </div>

        {/* The message the student wrote. `break-words` stops long text overflowing on phones. */}
        <p className="mt-2 break-words text-slate-700">{suggestion.message}</p>

        <p className="mt-2 text-xs text-slate-400">Posted by {suggestion.author}</p>
      </div>
    </article>
  );
}

export default SuggestionCard;
