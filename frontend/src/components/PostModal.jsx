import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CATEGORIES, labelForSlug } from '../data/categories.js';
import { KIND_LIST, kindInfo } from '../data/workflow.js';
// The shortest and longest title and message, kept the same as the server's.
import { MIN_TITLE, MAX_TITLE, MIN_MESSAGE, MAX_MESSAGE } from '../data/postLimits.js';
import { checkFields, rejectionMessage } from '../services/moderation.js';
import { MAX_FILES, prepareAttachment } from '../services/attachments.js';
import Button from './Button.jsx';
import PopupFrame, { CloseButton } from './PopupFrame.jsx';
import { CLOSE_PATH } from './icons.js';
import { Notice } from './admin/ui.jsx';

/*
 * The pop-up that opens when a student presses "Post a Suggestion" or
 * "Voice Out". Both buttons open this same pop-up; only the wording changes.
 *
 * The form collects:
 *   1. a category, which becomes the label on the finished card
 *   2. a title - the one line other students see first
 *   3. the message itself
 *   4. photos or files, which are optional
 *   5. whether to post anonymously
 *
 * Nothing is saved until it passes the rudeness filter in
 * services/moderation.js. Swearing and name-calling are prohibited on the
 * board, and this is where a post carrying them is turned away.
 *
 * Props:
 * - mode     'suggestion' or 'voice' - which hero button was pressed. It picks
 *            the wording and the starting kind, and that is all: the button
 *            is NOT stored on the post. The `kind` the student ends up with
 *            is the one classification a submission has. It used to be saved
 *            as a second field, `type`, which meant a post could be a "Voice
 *            Out" of kind "Suggestion" - two answers to one question.
 * - onClose  called when the pop-up should shut
 * - onSubmit called with the finished post when everything checks out. It
 *            sends the post to the server and answers `{ error }` if it was
 *            refused - the pop-up then stays open with the reason, so
 *            nothing the student typed is lost - or `{}`, and it closes.
 *
 * WHAT YOU'LL MEET IN THIS FILE (plain-English notes)
 *
 * - A "modal"  A pop-up that sits over the page and takes the focus until
 *   it is closed. The frame - the dark backdrop, Escape, the page behind not
 *   scrolling - is shared by every pop-up: components/PopupFrame.jsx.
 * - One useState per field  Each input has its own remembered value and its
 *   own setter. Typing calls the setter; React re-draws the input with the
 *   new value. That is a "controlled form".
 * - `async` / `await`  Reading a chosen photo takes time. An async function
 *   can `await` that work - pause at that line until it finishes - without
 *   freezing the page.
 * - `[...event.target.files]`  The spread operator turning the browser's
 *   FileList (which is not a real array) into a normal array we can loop.
 * - `event.preventDefault()`  Stops a form's built-in behaviour of reloading
 *   the page when submitted, so we can handle the submission ourselves.
 * - `.trim()`  Removes spaces from both ends of a string, so "   " does not
 *   count as a title.
 */

// The look shared by all four fields - the two dropdowns, the title and the
// message - so they line up and cannot drift apart one edit at a time.
const FIELD_CLASS =
  'mt-1.5 min-h-[44px] w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600';

function PostModal({ mode, onClose, onSubmit }) {
  // The form fields. The category starts on the first one in the list.
  const [category, setCategory] = useState(CATEGORIES[0].slug);

  /*
   * What sort of submission this is. It decides which admin queue the post
   * lands in and whether it gets assigned to a department, so the two hero
   * buttons start it somewhere sensible: "Post a Suggestion" opens on
   * Suggestion, "Voice Out" opens on Concern. The student can still change it.
   */
  const [kind, setKind] = useState(mode === 'voice' ? 'concern' : 'suggestion');

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [attachments, setAttachments] = useState([]);

  // True while a chosen photo is being shrunk, which takes a moment.
  const [reading, setReading] = useState(false);

  // True while the post is on its way to the server.
  const [sending, setSending] = useState(false);

  const [error, setError] = useState('');

  // A handle on the hidden file input, so the styled button below can open it.
  const fileInputRef = useRef(null);

  // Wording that changes depending on which hero button was pressed.
  const isVoice = mode === 'voice';
  const heading = isVoice ? 'Voice Out' : 'Post a Suggestion';
  const subtitle = isVoice
    ? 'Say what is bothering you on campus. Keep it respectful.'
    : 'Describe what should be improved, and where.';

  // Students should not be left wondering why their post is not on the board
  // yet, so the moderation step is stated up front rather than discovered.
  const reviewNotice = 'An administrator reviews every submission before it appears on the board.';

  /*
   * Handle the files the student just chose.
   *
   * Each one is prepared in turn rather than all at once, so a single file
   * that is too big can be named in the error while the good ones are kept.
   */
  async function handleFiles(event) {
    const chosen = [...event.target.files];

    // Let the same file be picked again later by clearing the input now.
    event.target.value = '';
    if (chosen.length === 0) return;

    if (attachments.length + chosen.length > MAX_FILES) {
      setError(`You can attach up to ${MAX_FILES} files to one post.`);
      return;
    }

    setReading(true);
    setError('');

    const prepared = [];
    try {
      for (const file of chosen) {
        prepared.push(await prepareAttachment(file));
      }
      setAttachments([...attachments, ...prepared]);
    } catch (failure) {
      // Keep whatever was prepared before the problem, so the student does not
      // have to pick everything again.
      setAttachments([...attachments, ...prepared]);
      setError(failure.message);
    } finally {
      setReading(false);
    }
  }

  // Take one attachment back off the post.
  function removeAttachment(index) {
    setAttachments(attachments.filter((_, position) => position !== index));
  }

  // Runs when the student presses the submit button.
  async function handleSubmit(event) {
    // Stop the browser reloading the page, which is its default for forms.
    event.preventDefault();
    if (sending) return;

    // Remove blank space from both ends before checking the lengths.
    const trimmedTitle = title.trim();
    const trimmedMessage = message.trim();

    if (trimmedTitle.length < MIN_TITLE) {
      setError(`Please write a title of at least ${MIN_TITLE} characters.`);
      return;
    }

    if (trimmedMessage.length < MIN_MESSAGE) {
      setError(`Please write at least ${MIN_MESSAGE} characters so we understand you.`);
      return;
    }

    // THE RUDENESS CHECK. Both the title and the message are checked, so a
    // clean message cannot smuggle an insult in through the headline.
    //
    // Only `clean` is read. The words that tripped the check are deliberately
    // left where they are: repeating them back in the warning would put the
    // swearing on screen, which is exactly what the filter exists to prevent.
    if (!checkFields(trimmedTitle, trimmedMessage).clean) {
      setError(rejectionMessage());
      return;
    }

    // Hand the finished post to the page, which sends it to the server.
    // Only a post the server accepted closes the pop-up.
    setSending(true);
    setError('');
    const result = await onSubmit({
      kind,
      category,
      title: trimmedTitle,
      message: trimmedMessage,
      anonymous,
      attachments: attachments.map(({ name, dataUrl }) => ({ name, dataUrl })),
    });
    setSending(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    onClose();
  }

  return (
    // THE PANEL, in the frame every pop-up shares. On phones it rises from the
    // bottom of the screen; from 640px it is centred. The whole panel scrolls.
    <PopupFrame
      onClose={onClose}
      labelledBy="post-modal-title"
      className="max-h-[90vh] max-w-lg overflow-y-auto p-5 sm:p-6"
    >
      {/* THE HEADING ROW, with the close X on the right. */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="post-modal-title" className="text-xl font-bold text-navy-900">
            {heading}
          </h2>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>

        <CloseButton onClick={onClose} />
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        {/* FIELD 1 - what sort of submission this is. */}
        <div>
          <label htmlFor="post-kind" className="block text-sm font-semibold text-navy-900">
            Type of submission
          </label>
          <select
            id="post-kind"
            value={kind}
            onChange={(event) => setKind(event.target.value)}
            className={FIELD_CLASS}
          >
            {KIND_LIST.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>

          {/* Say plainly what choosing this one means, so it is not a guess. */}
          <p className="mt-1.5 text-xs text-slate-400">
            {kindInfo(kind).needsAssignment
              ? 'This will be passed to the department responsible once it is approved.'
              : 'This will be reviewed and, if approved, published to the board.'}
          </p>
        </div>

        {/* FIELD 2 - the category, which becomes the label on the card. */}
        <div>
          <label htmlFor="post-category" className="block text-sm font-semibold text-navy-900">
            Category label
          </label>
          <select
            id="post-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className={FIELD_CLASS}
          >
            {CATEGORIES.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.label}
              </option>
            ))}
          </select>

          {/* A preview of the exact label other students will see on the card,
              so the choice above is never a guess. */}
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-400">
            Your post will be labelled
            <span className="rounded-full bg-navy-100 px-2 py-0.5 text-xs font-semibold text-navy-700">
              {labelForSlug(category)}
            </span>
          </p>
        </div>

        {/* FIELD 3 - the title. */}
        <div>
          <label htmlFor="post-title" className="block text-sm font-semibold text-navy-900">
            Title
          </label>
          <input
            id="post-title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={MAX_TITLE}
            placeholder={
              isVoice ? 'Long queues in the lounge area' : 'More power outlets in the library'
            }
            className={FIELD_CLASS}
          />
        </div>

        {/* FIELD 4 - the message itself. */}
        <div>
          <label htmlFor="post-message" className="block text-sm font-semibold text-navy-900">
            Your message
          </label>
          <textarea
            id="post-message"
            rows={4}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={MAX_MESSAGE}
            placeholder={
              isVoice
                ? 'What is going wrong on campus right now?'
                : 'What should the school improve, and where?'
            }
            className={FIELD_CLASS}
          />

          {/* A live character count next to the minimum length reminder. */}
          <div className="mt-1 flex items-center justify-between gap-3">
            <span className="text-xs text-slate-400">Minimum {MIN_MESSAGE} characters</span>
            <span className="shrink-0 text-xs text-slate-400">{message.trim().length}</span>
          </div>
        </div>

        {/* FIELD 5 - photos and files. */}
        <div>
          <span className="block text-sm font-semibold text-navy-900">
            Attach photos or files{' '}
            <span className="font-normal text-slate-400">(optional)</span>
          </span>

          {/*
            The real file input is hidden because browsers style it their own
            way and it cannot be made to match the rest of the form. The
            button below opens it instead, which is the usual way around this.
          */}
          <input
            ref={fileInputRef}
            id="post-files"
            type="file"
            multiple
            accept="image/*,.pdf"
            onChange={handleFiles}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={reading || attachments.length >= MAX_FILES}
            className="mt-1.5 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-500 transition-colors hover:border-navy-600 hover:text-navy-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {/* A paperclip, the usual sign for an attachment. */}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
              className="h-4 w-4"
            >
              <path
                d="M21 11.5 12.5 20a5 5 0 0 1-7-7l8-8a3.5 3.5 0 0 1 5 5l-8 8a2 2 0 0 1-3-3l7.5-7.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {reading
              ? 'Preparing your file...'
              : attachments.length >= MAX_FILES
              ? `Limit of ${MAX_FILES} files reached`
              : 'Choose photos or a file'}
          </button>

          {/* THE CHOSEN FILES, each with a small X to take it back off. */}
          {attachments.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {attachments.map((file, index) => (
                <li key={index} className="relative">
                  {file.type.startsWith('image/') ? (
                    <img
                      src={file.dataUrl}
                      alt={file.name}
                      className="h-20 w-20 rounded-lg border border-slate-200 object-cover"
                    />
                  ) : (
                    <span className="flex h-20 w-20 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-1 text-center text-[10px] leading-tight text-slate-500">
                      <span className="line-clamp-3 break-all">{file.name}</span>
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => removeAttachment(index)}
                    aria-label={`Remove ${file.name}`}
                    className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-navy-900 text-white shadow hover:bg-red-600"
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d={CLOSE_PATH} strokeLinecap="round" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* FIELD 6 - post anonymously. */}
        <label
          htmlFor="post-anonymous"
          className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
        >
          <input
            id="post-anonymous"
            type="checkbox"
            checked={anonymous}
            onChange={(event) => setAnonymous(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-navy-600 focus:ring-navy-600"
          />
          <span className="text-sm">
            <span className="font-semibold text-navy-900">Post as Anonymous</span>
            <span className="mt-0.5 block text-xs text-slate-500">
              Your name is replaced with &ldquo;Anonymous student&rdquo; on the card. Administrators
              can still see who sent it.
            </span>
          </span>
        </label>

        {/*
          THE ERROR MESSAGE, shown just above the buttons so it is read before
          the student presses submit again. role="alert" makes screen readers
          announce it as soon as it appears.
        */}
        {error && (
          <Notice>
            {error}
          </Notice>
        )}

        {/* Standing reminders, so neither the rule nor the wait is a surprise. */}
        <p className="text-xs text-slate-400">
          Rude, offensive or insulting posts are not allowed and will be rejected. {reviewNotice}{' '}
          You can follow yours from your dashboard.
        </p>

        {/* WHO WILL SEE IT - said before it is sent. The policy opens in a new
            tab, so reading it does not throw away the post being written. */}
        <p className="text-xs text-slate-500">
          Once approved, your post and its files can be seen by anyone who visits the board. Do not
          include other people's personal details.{' '}
          <Link
            to="/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-navy-700 underline"
          >
            Privacy Policy
          </Link>
        </p>

        {/* THE ACTION BUTTONS. They stack on phones and sit in a row on wider screens. */}
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={reading || sending}>
            {sending ? 'Sending…' : isVoice ? 'Voice it out' : 'Post suggestion'}
          </Button>
        </div>
      </form>
    </PopupFrame>
  );
}

export default PostModal;
