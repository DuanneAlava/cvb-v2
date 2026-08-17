/*
 * The strip at the very bottom of every page.
 * The two lines sit on top of each other on phones and side by side on wider screens.
 */
function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:px-6">
        {/* new Date().getFullYear() keeps the year correct without anyone editing it. */}
        <p>&copy; {new Date().getFullYear()} CampusVoiceBox</p>
        <p>Your campus, your voice.</p>
      </div>
    </footer>
  );
}

export default Footer;
