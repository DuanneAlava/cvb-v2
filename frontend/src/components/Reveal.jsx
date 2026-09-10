import { useEffect, useRef, useState } from 'react';

/*
 * Wraps any block of content and fades it in the first time it scrolls
 * into view, using the browser's IntersectionObserver instead of a
 * scroll event listener (cheaper, and does not run on every pixel of
 * scrolling).
 *
 * Once an element has played its fade-in it is left alone - scrolling
 * away and back does not replay the animation, which would be
 * distracting on a long list like the suggestion board.
 *
 * Props:
 * - as        which HTML tag to render as a wrapper (defaults to 'div')
 * - delay     optional extra delay in ms, used to stagger a list of cards
 * - className extra classes for the wrapper, merged with the reveal classes
 */
function Reveal({ children, as: Tag = 'div', delay = 0, className = '' }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          // Only need to catch the moment it appears once, then stop watching.
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      style={visible ? { animationDelay: `${delay}ms` } : { opacity: 0 }}
      className={`${visible ? 'animate-fade-in-up' : ''} ${className}`}
    >
      {children}
    </Tag>
  );
}

export default Reveal;
