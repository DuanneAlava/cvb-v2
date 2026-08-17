import { useEffect, useState } from 'react';
import { CATEGORIES } from '../data/categories.js';
import Button from './Button.jsx';

/*
 * The pop-up that opens when a student presses "Post a suggestion" or "Voice out"
 * on the hero. Both buttons open this same pop-up; only the wording changes.
 *
 * Props:
 * - mode     'suggestion' or 'voice' - decides the title and placeholder text
 * - onClose  called when the pop-up should shut
 * - onSubmit called with the finished post when the form is valid
 */

// The shortest message we accept, so posts are not one-word entries.
const MIN_LENGTH = 10;

function PostModal({ mode, onClose, onSubmit }) {
  // The form fields. The category starts on the first one in the list.
  const [category, setCategory] = useState(CATEGORIES[0].slug);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Let the Escape key close the pop-up, which is what people expect.
  useEffect(() => {
    function handleKey(event) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);

    // Remove the listener again when the pop-up closes, so it does not pile up.
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Stop the page behind the pop-up scrolling while the pop-up is open.
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Wording that changes depending on which hero button was pressed.
  const isVoice = mode === 'voice';
  // These match the hero button labels exactly, so the pop-up clearly
  // belongs to the button the student just pressed.
  const title = isVoice ? 'Voice Out' : 'Post a Suggestion';
  const subtitle = isVoice
    ? 'Say what is bothering you on campus. Your name is never shown.'
    : 'Describe what should be improved, and where.';

  // Runs when the student presses the submit button.
  function handleSubmit(event) {
    // Stop the browser reloading the page, which is its default for forms.
    event.preventDefault();

    // Remove blank space from both ends before checking the length.
    const trimmed = message.trim();
    if (trimmed.length < MIN_LENGTH) {
      setError(`Please write at least ${MIN_LENGTH} characters so we understand you.`);
      return;
    }

    // Hand the finished post back to the landing page, then close the pop-up.
    onSubmit({ type: isVoice ? 'voice' : 'suggestion', category, message: trimmed });
    onClose();
  }

  return (
    // THE BACKDROP - the dark layer covering the page. Clicking it closes the pop-up.
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-navy-900/70 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      {/*
        THE PANEL itself.
        `onClick` with stopPropagation stops a click inside the panel from
        reaching the backdrop and closing the pop-up by accident.
        On phones it sits at the bottom of the screen; from 640px it is centred.
      */}
      <div
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="post-modal-title"
        className="max-h-[90vh] w-full max-w-lg animate-fade-up overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl sm:p-6"
      >
        {/* THE HEADING ROW, with the close X on the right. */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="post-modal-title" className="text-xl font-bold text-navy-900">
              {title}
            </h2>
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* FIELD 1 - which of the six categories this post belongs to. */}
          <div>
            <label htmlFor="post-category" className="block text-sm font-semibold text-navy-900">
              Category
            </label>
            <select
              id="post-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600"
            >
              {CATEGORIES.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          {/* FIELD 2 - the message itself. */}
          <div>
            <label htmlFor="post-message" className="block text-sm font-semibold text-navy-900">
              Your message
            </label>
            <textarea
              id="post-message"
              rows={4}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={
                isVoice
                  ? 'What is going wrong on campus right now?'
                  : 'What should the school improve, and where?'
              }
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600"
            />

            {/* A live character count, and the error message when the text is too short. */}
            <div className="mt-1 flex items-center justify-between gap-3">
              {error ? (
                <p className="text-sm text-red-600">{error}</p>
              ) : (
                <span className="text-xs text-slate-400">Minimum {MIN_LENGTH} characters</span>
              )}
              <span className="shrink-0 text-xs text-slate-400">{message.trim().length}</span>
            </div>
          </div>

          {/* THE ACTION BUTTONS. They stack on phones and sit in a row on wider screens. */}
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {isVoice ? 'Voice it out' : 'Post suggestion'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PostModal;
