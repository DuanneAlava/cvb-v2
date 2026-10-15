import PolicyLinks from './PolicyLinks.jsx';

/*
 * The strip at the very bottom of every page of the student site.
 * The two lines sit on top of each other on phones and side by side on wider
 * screens; the policy links and Cookie settings sit underneath, so they can
 * be reached from every page (components/PolicyLinks.jsx).
 */
function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="flex flex-col items-center justify-between gap-2 text-sm text-slate-500 sm:flex-row">
          {/* new Date().getFullYear() keeps the year correct without anyone editing it. */}
          <p>&copy; {new Date().getFullYear()} CampusVoiceBox</p>
          <p>Your campus, your voice.</p>
        </div>
        <PolicyLinks className="mt-3" />
      </div>
    </footer>
  );
}

export default Footer;
