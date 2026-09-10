import { useEffect } from 'react';

/*
 * The admin panel's dialog shell.
 *
 * Same behaviour as the student site's post pop-up - Escape closes it, a click
 * on the dark backdrop closes it, the page behind it stops scrolling - written
 * once here so every admin dialog behaves identically.
 *
 * Props:
 * - title / description  the heading block
 * - onClose              called on Escape, on the X, and on a backdrop click
 * - footer               the action buttons, pinned under the content
 * - size                 'md' (default) or 'lg' for the submission review
 */
function Modal({ title, description, onClose, footer, size = 'md', children }) {
  useEffect(() => {
    function handleKey(event) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Stop the page behind scrolling while the dialog is open.
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const widths = { md: 'max-w-lg', lg: 'max-w-3xl' };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-navy-900/70 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      {/* stopPropagation keeps a click inside the dialog from reaching the
          backdrop and closing it by accident. */}
      <div
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-modal-title"
        className={`flex max-h-[92vh] w-full ${widths[size]} animate-fade-up flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h2 id="admin-modal-title" className="text-lg font-bold text-navy-900">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        {/* Only the middle scrolls, so the heading and the buttons stay put on
            a long submission. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 sm:flex-row sm:justify-end">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

export default Modal;
