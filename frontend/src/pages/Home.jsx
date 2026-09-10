import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { labelForSlug } from '../data/categories.js';
import { PERMISSIONS } from '../data/roles.js';
import { kindInfo } from '../data/workflow.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useStore, publicPosts, voteCount, authorLabel } from '../services/store.js';
import Header from '../components/Header.jsx';
import PostModal from '../components/PostModal.jsx';
import SuggestionCard from '../components/SuggestionCard.jsx';
import Reveal from '../components/Reveal.jsx';

/*
 * The public board.
 *
 * Two things changed here when moderation arrived:
 *
 *   1. The board reads publicPosts() rather than every post. A submission only
 *      appears once an administrator has approved it, so the board can no
 *      longer be used to publish something straight to the whole campus.
 *
 *   2. Author names come from authorLabel(), which resolves the real name only
 *      for somebody holding VIEW_IDENTITY. Anonymous stays anonymous here even
 *      when an admin is the one reading the page.
 *
 * The filters still live in the address bar, set by the navbar search box and
 * the profile menu, so this page reads them rather than owning the controls.
 *
 * WHAT YOU'LL MEET IN THIS FILE (plain-English notes)
 *
 * - A "page" component  Same as any other component; it is just the one a
 *   route in App.js points at. It owns the data for the screen and hands
 *   pieces of it down to smaller components (Header, SuggestionCard) as
 *   props.
 * - useMemo for a derived list  `visiblePosts` is worked out from the db
 *   plus the filters. Wrapping it in useMemo means the filtering only
 *   re-runs when one of the listed dependencies changes, not on every
 *   keystroke elsewhere on the page.
 * - `.filter(...).sort(...)`  Chained array methods: keep the posts that
 *   match, then order what is left. `Date.parse(text)` turns an ISO date
 *   string into a number of milliseconds so two dates can be subtracted -
 *   `b - a` sorts newest first.
 * - `searchParams.get('q') ?? ''`  Read a filter from the address; if it is
 *   absent, treat it as an empty string rather than null.
 * - `useNavigate()`  A hook that returns a function for sending the visitor
 *   to another address from code (as opposed to <Link>, which is a thing to
 *   click). Used to send guests to /login when they try to post or vote.
 */
function Home() {
  const { user, can } = useAuth();
  const store = useStore(user);

  const [modalMode, setModalMode] = useState(null);
  const [error, setError] = useState('');

  const [searchParams, setSearchParams] = useSearchParams();
  const activeCategory = searchParams.get('category');
  const query = searchParams.get('q') ?? '';
  const mine = searchParams.get('mine');

  const navigate = useNavigate();

  // Posting requires an account, so send guests to the login page first.
  function openModal(mode) {
    if (!user) {
      navigate('/login');
      return;
    }
    setModalMode(mode);
  }

  function addSubmission({ kind, category, title, message, anonymous, attachments }) {
    try {
      const result = store.createPost({
        kind,
        category,
        title,
        message,
        anonymous,
        attachments,
        authorId: user.id,
      });

      setError(
        result?.error ??
          // Nothing appears on the board straight away any more, so say so
          // rather than letting the student think their post vanished.
          'Thanks - your submission has been sent for review. You can follow it from your dashboard.'
      );
    } catch (failure) {
      setError(failure.message);
    }
  }

  function handleVote(id) {
    if (!user) {
      navigate('/login');
      return;
    }

    if (!can(PERMISSIONS.VOTE)) {
      setError('Your account is suspended, so voting is turned off.');
      return;
    }

    try {
      store.toggleVote(id, user.id);
      setError('');
    } catch (failure) {
      setError(failure.message);
    }
  }

  function clearFilters() {
    setSearchParams({});
  }

  const visiblePosts = useMemo(() => {
    const search = query.trim().toLowerCase();

    return publicPosts(store.db)
      .filter((post) => {
        const matchesCategory = !activeCategory || post.category === activeCategory;

        const matchesSearch =
          !search ||
          post.message.toLowerCase().includes(search) ||
          (post.title ?? '').toLowerCase().includes(search);

        // "Your Suggestions" / "Your Voice Outs" from the profile menu. A
        // voice out is a post in the concern family - ?mine=suggestion or
        // ?mine=concern - read off the kind, which is the one classification
        // a post has.
        const matchesMine =
          !mine || (user && post.authorId === user.id && kindInfo(post.kind).group === mine);

        return matchesCategory && matchesSearch && matchesMine;
      })
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [store.db, activeCategory, query, mine, user]);

  /*
   * THE BOARD-WIDE TALLY.
   *
   * Counted across every published post, NOT just the ones currently on
   * screen. A share that changed depending on which category filter happened
   * to be applied would be meaningless - "31% of all votes" has to mean the
   * same thing however the reader arrived at the card.
   */
  const tally = useMemo(() => {
    const counts = publicPosts(store.db).map((post) => voteCount(store.db, post.id));
    return {
      total: counts.reduce((sum, count) => sum + count, 0),
      // Math.max of an empty list is -Infinity, so seed it with 0.
      max: Math.max(0, ...counts),
    };
  }, [store.db]);

  const filterSummary = [
    mine === 'suggestion' && 'your suggestions',
    mine === 'concern' && 'your voice outs',
    activeCategory && labelForSlug(activeCategory),
    query.trim() && `"${query.trim()}"`,
  ].filter(Boolean);

  return (
    <>
      <Header
        onPostSuggestion={() => openModal('suggestion')}
        onVoiceOut={() => openModal('voice')}
      />

      <section id="browse-suggestions" className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-bold text-navy-900 sm:text-2xl">Browse suggestions</h2>
          <p className="text-sm text-slate-500">
            {visiblePosts.length} {visiblePosts.length === 1 ? 'post' : 'posts'}
          </p>
        </div>

        {filterSummary.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span>Showing {filterSummary.join(' · ')}</span>
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-navy-700 transition-colors hover:border-navy-600 hover:bg-navy-50"
            >
              Clear filters
            </button>
          </div>
        )}

        {error && (
          <p role="status" className="mt-3 rounded-lg bg-navy-50 px-3 py-2 text-sm text-navy-800">
            {error}
          </p>
        )}

        {visiblePosts.length === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
            No posts match your search yet. Try another category, or be the first to post.
          </p>
        ) : (
          <div className="mt-4 grid items-stretch gap-3 lg:grid-cols-2">
            {visiblePosts.map((post, index) => (
              <Reveal key={post.id} delay={(index % 4) * 80} className="h-full">
                <SuggestionCard
                  suggestion={{
                    ...post,
                    // Resolved here rather than inside the card, so the card
                    // never has to know anything about who is looking at it.
                    author: authorLabel(store.db, post, user),
                  }}
                  votes={voteCount(store.db, post.id)}
                  totalVotes={tally.total}
                  // Ties all show the marker, which is correct - they are all
                  // equally in front.
                  isTopVoted={tally.max > 0 && voteCount(store.db, post.id) === tally.max}
                  hasVoted={Boolean(user) && (store.db.votes[post.id] ?? []).includes(user.id)}
                  onVote={handleVote}
                />
              </Reveal>
            ))}
          </div>
        )}
      </section>

      {modalMode && (
        <PostModal
          mode={modalMode}
          onClose={() => setModalMode(null)}
          onSubmit={addSubmission}
        />
      )}
    </>
  );
}

export default Home;
