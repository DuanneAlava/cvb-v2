import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { labelForSlug } from '../data/categories.js';
import { PERMISSIONS } from '../data/roles.js';
import { kindInfo } from '../data/workflow.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useStore, publicPosts, authorLabel } from '../services/store.js';
import Header from '../components/Header.jsx';
import PostModal from '../components/PostModal.jsx';
import SuggestionCard from '../components/SuggestionCard.jsx';
import Reveal from '../components/Reveal.jsx';
import Button from '../components/Button.jsx';
import { useFilterParams } from '../hooks/useFilterParams.js';
import { matchesSearch, plural } from '../components/admin/ui.jsx';

/*
 * HOW MANY CARDS AT A TIME. The board shows this many first, and "Load more"
 * adds this many again, so a long board is not one endless page to scroll
 * and draw. An even number, so the two-column layout on wide screens always
 * ends on a full row.
 */
const PAGE_SIZE = 10;

/*
 * THE TWO ORDERS. "Newest" is the default and leaves the address clean;
 * "Most voted" adds ?sort=votes, so - like the search and the category - it
 * survives a reload and can be shared as a link. Most voted breaks ties by
 * newest first.
 */
const SORTS = [
  { key: 'newest', label: 'Newest' },
  { key: 'votes', label: 'Most voted' },
];

/*
 * The public board.
 *
 * Two things changed here when moderation arrived:
 *
 *   1. The board reads publicPosts() rather than every post. A submission only
 *      appears once an administrator has approved it, so the board can no
 *      longer be used to publish something straight to the whole campus.
 *
 *   2. Author names come from authorLabel(), which shows the real name behind
 *      an anonymous post only to somebody holding VIEW_IDENTITY - and the
 *      server only ever sends that name to such a person.
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
  const store = useStore();

  const [modalMode, setModalMode] = useState(null);
  const [error, setError] = useState('');

  // The filters and the order live in the address bar - see
  // hooks/useFilterParams.js.
  const { searchParams, setSearchParams, setFilter } = useFilterParams();
  const activeCategory = searchParams.get('category');
  const query = searchParams.get('q') ?? '';
  const mine = searchParams.get('mine');
  // Anything other than ?sort=votes - including nothing - means newest first.
  const sort = searchParams.get('sort') === 'votes' ? 'votes' : 'newest';

  // How many of the matching posts are on screen (see PAGE_SIZE).
  const [shown, setShown] = useState(PAGE_SIZE);

  /*
   * BACK TO THE FIRST PAGE WHEN THE LIST CHANGES. A new search, category,
   * "your posts" view or order is a different list, so it starts again from
   * the top ten rather than keeping however many the last one had loaded.
   */
  useEffect(() => {
    setShown(PAGE_SIZE);
  }, [activeCategory, query, mine, sort]);

  const navigate = useNavigate();

  /*
   * BRING THE RESULTS INTO VIEW when "Your Suggestions" or "Your Voice Outs"
   * is chosen. Those are links in the profile menu that land here with
   * ?mine=... set; the list they filter sits below the hero, so without this
   * a student arriving from the dashboard would see the top of the board
   * and nothing that looked like a result. The profile menu cannot do the
   * scrolling itself - pressed from another page, the list does not exist
   * yet at the moment of the click - so the board does it once it is on
   * screen. Re-runs whenever the filter changes, which covers switching
   * from one to the other while already here.
   */
  useEffect(() => {
    if (!mine) return;
    document.getElementById('browse-suggestions')?.scrollIntoView({ behavior: 'smooth' });
  }, [mine]);

  // Posting requires an account, so send guests to the login page first -
  // and an account that may not post is told why, rather than handed a form
  // the server would refuse.
  function openModal(mode) {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!can(PERMISSIONS.SUBMIT_POSTS)) {
      setError('Your account is suspended, so posting is turned off.');
      return;
    }
    setModalMode(mode);
  }

  // The posting form hands its fields here and waits: the form stays open
  // with the server's answer if the post is refused.
  async function addSubmission(fields) {
    const result = await store.createPost(fields);
    if (!result.error) {
      // Nothing appears on the board straight away, so say so rather than
      // letting the student think their post vanished.
      setError(
        'Thanks - your submission has been sent for review. You can follow it from your dashboard.'
      );
    }
    return result;
  }

  async function handleVote(id) {
    if (!user) {
      navigate('/login');
      return;
    }

    if (!can(PERMISSIONS.VOTE)) {
      setError('Your account is suspended, so voting is turned off.');
      return;
    }

    setError('');
    const result = await store.toggleVote(id);
    if (result.error) setError(result.error);
  }

  // Clears the filters but keeps the order: "Most voted" is how the student
  // wants the board sorted, not something narrowing it down.
  function clearFilters() {
    setSearchParams(sort === 'votes' ? { sort: 'votes' } : {});
  }

  // Switch the order, leaving every filter in the address as it is.
  // "Newest" is the default, so it takes `sort` out of the address rather
  // than writing it in.
  function changeSort(next) {
    setFilter('sort', next === 'votes' ? 'votes' : '');
  }

  const visiblePosts = useMemo(() => {
    return publicPosts(store.db)
      .filter((post) => {
        const matchesCategory = !activeCategory || post.category === activeCategory;
        const matchesQuery = matchesSearch([post.title, post.message], query);

        // "Your Suggestions" / "Your Voice Outs" from the profile menu. A
        // voice out is a post in the concern family - ?mine=suggestion or
        // ?mine=concern - read off the kind, which is the one classification
        // a post has.
        const matchesMine =
          !mine || (user && post.authorId === user.id && kindInfo(post.kind).group === mine);

        return matchesCategory && matchesQuery && matchesMine;
      })
      .sort((a, b) => {
        if (sort === 'votes') {
          const byVotes = b.votes - a.votes;
          if (byVotes !== 0) return byVotes;
        }
        // Newest first - the whole order for "Newest", the tie-break for
        // "Most voted".
        return Date.parse(b.createdAt) - Date.parse(a.createdAt);
      });
  }, [store.db, activeCategory, query, mine, user, sort]);

  /*
   * THE BOARD-WIDE TALLY.
   *
   * Counted across every published post, NOT just the ones currently on
   * screen. A share that changed depending on which category filter happened
   * to be applied would be meaningless - "31% of all votes" has to mean the
   * same thing however the reader arrived at the card.
   */
  const tally = useMemo(() => {
    const counts = publicPosts(store.db).map((post) => post.votes);
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
        {/* `flex-wrap`: on a narrow phone the count and the sort buttons
            drop under the heading rather than squeezing it. */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h2 className="text-xl font-bold text-navy-900 sm:text-2xl">Browse suggestions</h2>
          <div className="flex items-center gap-3">
            <p className="text-sm text-slate-500">
              {plural(visiblePosts.length, 'post')}
            </p>
            {/* THE ORDER, as two joined buttons. `aria-pressed` tells a
                screen reader which one is on. */}
            <div
              role="group"
              aria-label="Sort posts"
              className="inline-flex overflow-hidden rounded-lg border border-slate-300 bg-white"
            >
              {SORTS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  aria-pressed={sort === option.key}
                  onClick={() => changeSort(option.key)}
                  className={`min-h-[44px] px-3 text-sm font-semibold transition-colors ${
                    sort === option.key
                      ? 'bg-navy-600 text-white'
                      : 'text-navy-700 hover:bg-navy-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
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
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
            {/*
              THE BOARD ONLY SHOWS PUBLISHED POSTS. Under "Your Suggestions"
              or "Your Voice Outs" that matters: a student whose post is still
              waiting for review sees nothing here and, told to "try another
              category", concludes it vanished. So the empty state for those
              two views says where the whole record is - the dashboard - and
              links to it. The generic wording stays for an ordinary search,
              and an empty board with nothing searched says just that.
            */}
            {mine ? (
              <>
                <p>
                  {mine === 'concern'
                    ? 'None of your voice outs are on the board yet.'
                    : 'None of your suggestions are on the board yet.'}
                </p>
                <p className="mt-1 text-sm">
                  Anything still waiting for review is not shown here.{' '}
                  <Link
                    to="/student/dashboard"
                    className="font-semibold text-navy-600 hover:underline"
                  >
                    See everything you have sent in
                  </Link>
                  , including its status.
                </p>
              </>
            ) : activeCategory || query ? (
              <p>No posts match your search yet. Try another category, or be the first to post.</p>
            ) : (
              // Nothing searched and still nothing: the board itself is empty,
              // which is how a fresh install starts. Not "be the first to
              // post" - a student who just posted is reading this too, and
              // their post is waiting for review rather than missing.
              <p>Nothing is on the board yet. Posts appear here once an administrator approves them.</p>
            )}
          </div>
        ) : (
          <div className="mt-4 grid items-stretch gap-3 lg:grid-cols-2">
            {visiblePosts.slice(0, shown).map((post, index) => (
              <Reveal key={post.id} delay={(index % 4) * 80} className="h-full">
                <SuggestionCard
                  suggestion={{
                    ...post,
                    // Resolved here rather than inside the card, so the card
                    // never has to know anything about who is looking at it.
                    author: authorLabel(post, user),
                  }}
                  votes={post.votes}
                  totalVotes={tally.total}
                  // Ties all show the marker, which is correct - they are all
                  // equally in front.
                  isTopVoted={tally.max > 0 && post.votes === tally.max}
                  hasVoted={post.hasVoted}
                  onVote={handleVote}
                />
              </Reveal>
            ))}
          </div>
        )}

        {/* LOAD MORE - only while some matching posts are not on screen yet. */}
        {visiblePosts.length > shown && (
          <div className="mt-6 flex flex-col items-center gap-2">
            <p className="text-sm text-slate-500">
              Showing {shown} of {visiblePosts.length}
            </p>
            <Button type="button" variant="ghost" onClick={() => setShown(shown + PAGE_SIZE)}>
              Load more
            </Button>
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
