import PopupFrame, { CloseButton } from '../PopupFrame.jsx';

/*
 * The admin panel's dialog: a heading bar, a body that scrolls, and the
 * action buttons pinned underneath, so they stay put on a long submission.
 *
 * How it behaves - Escape closes it, a click on the dark backdrop closes it,
 * the page behind it stops scrolling - comes from the frame every pop-up
 * shares (components/PopupFrame.jsx), so every admin dialog behaves exactly
 * like the student site's post pop-up.
 *
 * Props:
 * - title / description  the heading block
 * - onClose              called on Escape, on the X, and on a backdrop click
 * - footer               the action buttons, pinned under the content
 * - size                 'md' (default) or 'lg' for the submission review
 */
function Modal({ title, description, onClose, footer, size = 'md', children }) {
  const widths = { md: 'max-w-lg', lg: 'max-w-3xl' };

  return (
    <PopupFrame
      onClose={onClose}
      labelledBy="admin-modal-title"
      className={`flex max-h-[92vh] ${widths[size]} flex-col overflow-hidden`}
    >
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div className="min-w-0">
          <h2 id="admin-modal-title" className="text-lg font-bold text-navy-900">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
        </div>

        <CloseButton onClick={onClose} />
      </header>

      {/* Only the middle scrolls, so the heading and the buttons stay put on
          a long submission. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

      {footer && (
        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 sm:flex-row sm:justify-end">
          {footer}
        </footer>
      )}
    </PopupFrame>
  );
}

export default Modal;
