import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CATEGORIES } from '../data/categories.js';
import { SEED_SUGGESTIONS } from '../data/suggestions.js';
import { useAuth } from '../context/AuthContext.jsx';
import Header from '../components/Header.jsx';
import PostModal from '../components/PostModal.jsx';
import SuggestionCard from '../components/SuggestionCard.jsx';
import Reveal from '../components/Reveal.jsx';

/*
 * The landing page.
 *
 * Reading down the page:
 *   1. the hero - the quote and the two centred buttons
 *   2. the category filter pills
 *   3. the search box
 *   4. "Browse suggestions" - the list of posts, filtered by the two controls above
 */
function Home() {
  // Every post on the board. New posts from the pop-up are added to the front.
  const [suggestions, setSuggestions] = useState(SEED_SUGGESTIONS);

  // The ids of posts this student has voted for, so a vote can be taken back.
  const [votedIds, setVotedIds] = useState([]);

  // What the student has typed into the search box.
  const [query, setQuery] = useState('');

  // Which pop-up is open: null (none), 'suggestion', or 'voice'.
  const [modalMode, setModalMode] = useState(null);

  // The chosen category lives in the address bar, e.g. /?category=safety.
  // Keeping it there means the navbar links and these pills stay in step,
  // and a filtered view can be copied and shared as a link.
  const [searchParams, setSearchParams] = useSearchParams();
  const activeCategory = searchParams.get('category'); // null means "All"

  const { user } = useAuth();
  const navigate = useNavigate();

  // Change the category filter. Passing null clears it back to "All".
  function selectCategory(slug) {
    if (slug) {
      setSearchParams({ category: slug });
    } else {
      setSearchParams({});
    }
  }

  // Posting requires an account, so send guests to the login page first.
  function openModal(mode) {
    if (!user) {
      navigate('/login');
      return;
    }
    setModalMode(mode);
  }

  // Add a finished post from the pop-up to the top of the board.
  function addSuggestion({ type, category, message }) {
    const newPost = {
      id: Date.now(), // the current time in milliseconds makes a simple unique id
      type,
      category,
      author: user ? user.name : 'Anonymous student',
      message,
      votes: 1, // a new post starts with the author's own vote
      createdAt: new Date().toISOString().slice(0, 10), // keep only the YYYY-MM-DD part
    };

    setSuggestions([newPost, ...suggestions]);
    setVotedIds([...votedIds, newPost.id]);
  }

  // Add or remove this student's vote on one post.
  function toggleVote(id) {
    // Guests cannot vote either, so send them to log in.
    if (!user) {
      navigate('/login');
      return;
    }

    const alreadyVoted = votedIds.includes(id);

    // Move the vote count up by one, or back down if the vote is being taken away.
    setSuggestions(
      suggestions.map((item) =>
        item.id === id ? { ...item, votes: item.votes + (alreadyVoted ? -1 : 1) } : item
      )
    );

    setVotedIds(
      alreadyVoted ? votedIds.filter((votedId) => votedId !== id) : [...votedIds, id]
    );
  }

  /*
   * The list actually shown on screen, after both filters are applied.
   * useMemo re-runs this only when one of the values in the list at the end
   * changes, instead of on every single render.
   */
  const visibleSuggestions = useMemo(() => {
    const search = query.trim().toLowerCase();

    return suggestions.filter((item) => {
      // Keep the post if no category is chosen, or if its category matches.
      const matchesCategory = !activeCategory || item.category === activeCategory;

      // Keep the post if the search box is empty, or if the text appears in the message.
      const matchesSearch = !search || item.message.toLowerCase().includes(search);

      return matchesCategory && matchesSearch;
    });
  }, [suggestions, activeCategory, query]);

  return (
    <>
      {/* 1. THE HERO - the quote plus the two centred buttons. */}
      <Header
        onPostSuggestion={() => openModal('suggestion')}
        onVoiceOut={() => openModal('voice')}
      />

      {/* 2 and 3. THE FILTER BAR - category pills with the search box underneath. */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          {/*
            THE CATEGORY PILLS.
            `flex-wrap` lets them flow onto a second line on narrow screens
            instead of running off the side of the page.
          */}
          <div className="flex flex-wrap gap-2">
            {/* The "All" pill clears the filter and shows every post. */}
            <button
              type="button"
              onClick={() => selectCategory(null)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                !activeCategory
                  ? 'bg-navy-600 text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-navy-200 hover:text-navy-700'
              }`}
            >
              All
            </button>

            {/* One pill for each of the six categories. */}
            {CATEGORIES.map((category) => (
              <button
                key={category.slug}
                type="button"
                onClick={() => selectCategory(category.slug)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  activeCategory === category.slug
                    ? 'bg-navy-600 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:border-navy-200 hover:text-navy-700'
                }`}
              >
                {category.label}
              </button>
            ))}
          </div>

          {/* THE SEARCH BOX, directly under the pills. */}
          <div className="relative mt-3">
            {/* The magnifying glass sits inside the box on the left. */}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>

            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search suggestions..."
              aria-label="Search suggestions"
              className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600"
            />
          </div>
        </div>
      </div>

      {/* 4. BROWSE SUGGESTIONS - the list sitting under the search box. */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-bold text-navy-900 sm:text-2xl">Browse suggestions</h2>

          {/* A running count that follows whatever filters are active. */}
          <p className="text-sm text-slate-500">
            {visibleSuggestions.length} {visibleSuggestions.length === 1 ? 'post' : 'posts'}
            {activeCategory && ' in this category'}
          </p>
        </div>

        {visibleSuggestions.length === 0 ? (
          // Shown when the filters match nothing, so the page is never blank.
          <p className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
            No posts match your search yet. Try another category, or be the first to post.
          </p>
        ) : (
          // The posts themselves: one column on phones, two from the large breakpoint.
          // Each card is wrapped in <Reveal> so it fades up into place the
          // moment it scrolls into the viewport, staggered card by card.
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {visibleSuggestions.map((suggestion, index) => (
              <Reveal key={suggestion.id} delay={(index % 4) * 80}>
                <SuggestionCard
                  suggestion={suggestion}
                  hasVoted={votedIds.includes(suggestion.id)}
                  onVote={toggleVote}
                />
              </Reveal>
            ))}
          </div>
        )}
      </section>

      {/* THE POP-UP. It is only added to the page while a mode is set. */}
      {modalMode && (
        <PostModal
          mode={modalMode}
          onClose={() => setModalMode(null)}
          onSubmit={addSuggestion}
        />
      )}
    </>
  );
}

export default Home;
