import { useEffect } from 'react';
import { useEscapeKey } from '../hooks/useEscapeKey.js';
import { CLOSE_PATH } from './icons.js';

/*
 * THE FRAME EVERY POP-UP SITS IN - the post form (PostModal.jsx), the "are
 * you sure?" box (ConfirmDialog.jsx) and the admin panel's dialogs
 * (admin/Modal.jsx).
 *
 * It owns what makes a pop-up behave like one, so the three cannot drift
 * apart:
 *   - the dark backdrop over the page; a click on it closes the pop-up
 *   - Escape closes it (hooks/useEscapeKey.js)
 *   - the page behind stops scrolling while it is open
 *   - role="dialog" and aria-modal, so a screen reader treats it as one
 * What goes inside - the heading, the form, the buttons - and the panel's own
 * size, padding and layout are each pop-up's own, passed in as `className`
 * and children. So each still looks the way it did.
 *
 * Props:
 * - onClose     called on Escape and on a click on the backdrop
 * - labelledBy  the id of the pop-up's heading, for screen readers
 * - role        'dialog' (default), or 'alertdialog' for an "are you sure?"
 * - placement   'sheet' (default): rises from the bottom on phones and is
 *               centred from 640px - for a form with a lot in it.
 *               'center': always centred - for a short question.
 * - className   the panel's own classes
 *
 * WHAT YOU'LL MEET IN THIS FILE
 * - `event.stopPropagation()`  A click inside the panel would otherwise
 *   "bubble" up to the backdrop and close the pop-up by accident.
 * - Restoring the page's previous `overflow` on close, rather than clearing
 *   it, so a pop-up opened over another pop-up hands the lock back intact.
 */

const PLACEMENTS = {
  sheet: {
    backdrop: 'items-end p-0 sm:items-center sm:p-4',
    panel: 'rounded-t-2xl sm:rounded-2xl',
  },
  center: {
    backdrop: 'items-center p-4',
    panel: 'rounded-2xl',
  },
};

function PopupFrame({
  onClose,
  labelledBy,
  role = 'dialog',
  placement = 'sheet',
  className = '',
  children,
}) {
  useEscapeKey(onClose);

  // Stop the page behind scrolling while the pop-up is open.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const { backdrop, panel } = PLACEMENTS[placement];

  return (
    <div
      className={`fixed inset-0 z-[60] flex justify-center bg-navy-900/70 ${backdrop}`}
      onClick={onClose}
      role="presentation"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`w-full animate-fade-up bg-white shadow-xl ${panel} ${className}`}
      >
        {children}
      </div>
    </div>
  );
}

// The X in a pop-up's top corner, the same in every pop-up that has one.
export function CloseButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close"
      className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d={CLOSE_PATH} strokeLinecap="round" />
      </svg>
    </button>
  );
}

export default PopupFrame;
