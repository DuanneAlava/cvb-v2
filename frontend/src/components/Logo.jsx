/*
 * The CampusVoiceBox wordmark: a megaphone icon in a rounded square,
 * followed by the app name. Used in the navbar and on both auth pages.
 */
function Logo({ tone = 'light' }) {
  // 'light' is for dark backgrounds (the navy navbar), 'dark' is for white cards.
  const textColor = tone === 'light' ? 'text-white' : 'text-navy-900';
  const boxColor = tone === 'light' ? 'bg-white/15' : 'bg-navy-600';

  return (
    <span className={`flex items-center gap-2 font-bold tracking-tight ${textColor}`}>
      {/* The rounded square holding the megaphone icon. */}
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${boxColor}`}>
        {/* A megaphone drawn as SVG so it stays sharp at any screen size. */}
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-white">
          <path d="M3 10.5v3a1.5 1.5 0 0 0 1.5 1.5H6l3.2 3.7a1 1 0 0 0 1.8-.7V5.5a1 1 0 0 0-1.8-.7L6 8.5H4.5A1.5 1.5 0 0 0 3 10.5Z" />
          <path d="M14.5 9a1 1 0 0 1 1.4 0 4.3 4.3 0 0 1 0 6 1 1 0 1 1-1.4-1.4 2.3 2.3 0 0 0 0-3.2 1 1 0 0 1 0-1.4Z" />
          <path d="M17.3 6.2a1 1 0 0 1 1.4 0 8.2 8.2 0 0 1 0 11.6 1 1 0 0 1-1.4-1.4 6.2 6.2 0 0 0 0-8.8 1 1 0 0 1 0-1.4Z" />
        </svg>
      </span>
      CampusVoiceBox
    </span>
  );
}

export default Logo;
