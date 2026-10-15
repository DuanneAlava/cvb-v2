import { useEffect, useRef } from 'react';

/*
 * PRESS ESCAPE TO CLOSE.
 *
 * Every pop-up here closes on Escape, which is what people expect from any
 * pop-up: the posting form, the "are you sure?" box and the admin panel's
 * dialogs. They all sit in one frame (components/PopupFrame.jsx), which is
 * where this is called, so they all behave the same.
 *
 * ONE LISTENER FOR AS LONG AS THE POP-UP IS OPEN. The listener is added when
 * the pop-up appears and removed when it goes, and in between it is never
 * swapped. Pop-ups are often handed a new close function on every redraw
 * (`onCancel={() => ...}`), and re-adding the listener each time used to
 * lose key presses: when Escape also closed something else first - the
 * profile menu behind the "Log out?" box - React redrew in the middle of
 * the key press, the browser skipped the listener being swapped in, and the
 * box needed a second Escape. Instead the newest close function is kept in
 * a ref, and the one listener always calls that.
 *
 * (The profile menu closes on Escape too, but together with a click
 * anywhere else on the page - see components/ProfileMenu.jsx - so it keeps
 * its own.)
 *
 * WHAT YOU'LL MEET HERE: a "custom hook" - a function whose name starts with
 * `use` and which calls React's own hooks, so a component can share a piece
 * of behaviour in one line: useEscapeKey(onClose). useRef() is a box that
 * keeps a value between redraws without causing one.
 */
export function useEscapeKey(onClose) {
  // The close function from the latest redraw.
  const latestOnClose = useRef(onClose);
  useEffect(() => {
    latestOnClose.current = onClose;
  });

  useEffect(() => {
    function handleKey(event) {
      if (event.key === 'Escape') latestOnClose.current();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);
}
