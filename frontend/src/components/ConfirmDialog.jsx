import Button from './Button.jsx';
import PopupFrame from './PopupFrame.jsx';

/*
 * A small "are you sure?" pop-up, used before anything that cannot be undone
 * with a single click. Right now that is logging out.
 *
 * It is built as a normal component rather than using the browser's built-in
 * window.confirm() so it matches the rest of CampusVoiceBox instead of showing
 * a grey system box, and so the wording can be written properly.
 *
 * How it behaves - Escape, a click on the dark backdrop, the page behind
 * not scrolling - comes from the frame every pop-up shares
 * (PopupFrame.jsx). Unlike the post form it is always centred, even on a
 * phone, because it is one short question.
 *
 * Props:
 * - title        the bold question, e.g. "Are you sure you want to log out?"
 * - message      the smaller line under it explaining what will happen
 * - confirmLabel the text on the button that goes ahead
 * - onConfirm    called when the student presses that button
 * - onCancel     called on Cancel, on Escape, and on a click outside the box
 */
function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}) {
  return (
    <PopupFrame
      onClose={onCancel}
      labelledBy="confirm-title"
      role="alertdialog"
      placement="center"
      className="max-w-sm p-6"
    >
      <h2 id="confirm-title" className="text-lg font-bold text-navy-900">
        {title}
      </h2>
      {message && <p className="mt-2 text-sm text-slate-500">{message}</p>}

      {/*
        THE BUTTONS. Stacked on very small phones, side by side otherwise.

        `flex-1` on both gives them an equal share of the row, so the pair is
        symmetrical rather than sized by whichever label happens to be longer
        - "Stay logged in" is wider than "Yes, log out", and left to itself
        that made the row look lopsided and pushed off to one side.

        Splitting the full width also means the space either side of the pair
        is the dialog's own padding, identical on both edges by construction
        rather than by eye.
      */}
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-center">
        <Button variant="ghost" onClick={onCancel} className="sm:flex-1">
          {cancelLabel}
        </Button>
        <Button variant="primary" onClick={onConfirm} autoFocus className="sm:flex-1">
          {confirmLabel}
        </Button>
      </div>
    </PopupFrame>
  );
}

export default ConfirmDialog;
