import { Link } from 'react-router-dom';
import { ORGANIZATION, POLICY_PAGES } from '../data/policies.js';
import BackButton from './BackButton.jsx';
import { formatVersionDate } from './admin/ui.jsx';

/*
 * THE FRAME EVERY POLICY PAGE SHARES - the Privacy Policy, the Terms &
 * Conditions and the Cookie Policy (pages/legal/). Each page supplies its
 * title, version and sections; this draws them the same way: the heading
 * with the version and dates, a list of contents that jumps to each
 * section, readable text, and links to the other two policies.
 *
 * TWO KINDS OF MARKER, BOTH HIGHLIGHTED
 * - <ToConfirm fact="dpoEmail" />  a fact only the school can supply. The
 *   facts live in data/policies.js (ORGANIZATION); once one is filled in
 *   there, the real text appears here instead of the highlight.
 * - <ForReview>…</ForReview>  a legal judgement the draft does not make by
 *   itself, for the school's lawyer or Data Protection Officer.
 * While any fact is unconfirmed, a note at the top of every policy says the
 * text is a draft - nothing here claims to be finished legal advice.
 *
 * The sections are plain JSX. The text styles - paragraph spacing, bullet
 * lists, links - are set once on the container with Tailwind's `[&_p]:`
 * selectors, so the pages themselves are just headings and sentences.
 */

const UNCONFIRMED = Object.values(ORGANIZATION).some((fact) => fact.value === null);

// A fact from data/policies.js, or a highlighted note saying it is still needed.
export function ToConfirm({ fact }) {
  const entry = ORGANIZATION[fact];
  if (entry.value) return entry.value;
  return (
    <mark className="rounded bg-amber-100 px-1 font-medium text-amber-900">
      [To be confirmed: {entry.describe}]
    </mark>
  );
}

// A legal question the draft leaves to a professional.
export function ForReview({ children }) {
  return (
    <mark className="rounded bg-sky-100 px-1 text-sky-900">[For legal review: {children}]</mark>
  );
}

/*
 * A table that scrolls sideways inside its own box on a narrow phone,
 * instead of making the whole page scroll.
 */
export function PolicyTable({ head, rows }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
        <thead className="bg-slate-50">
          <tr>
            {head.map((cell) => (
              <th key={cell} scope="col" className="px-3 py-2 font-semibold text-navy-900">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-slate-200 align-top">
              {row.map((cell, column) => (
                <td key={column} className={`px-3 py-2 text-slate-700 ${column === 0 ? 'font-medium' : ''}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/*
 * Props:
 * - title     "Privacy Policy"
 * - version   the version from data/policies.js
 * - summary   one or two sentences under the title, in plain words
 * - sections  [{ id, title, content }] - `id` is the address of the
 *             section (/privacy-policy#your-rights), so a section can be
 *             linked to directly
 */
function PolicyPage({ title, version, summary, sections }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <BackButton className="mb-3" />

      <h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">{title}</h1>
      <p className="mt-2 text-sm text-slate-500">
        {/* When the policy takes effect is the school's decision - a fact
            still to be confirmed. */}
        Version {version} · Last updated {formatVersionDate(version)} · Takes effect:{' '}
        <ToConfirm fact="effectiveDate" />
      </p>
      <p className="mt-4 text-base leading-relaxed text-slate-700">{summary}</p>

      {UNCONFIRMED && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <strong>This is a draft.</strong> It describes how CampusVoiceBox actually works, but the
          school has not yet confirmed the details marked “To be confirmed”, and the parts marked
          “For legal review” are waiting for a lawyer or the Data Protection Officer. Until then it
          is not a final legal document.
        </div>
      )}

      {/* THE CONTENTS - each entry jumps to its section. */}
      <nav aria-label={`${title} contents`} className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Contents</h2>
        <ol className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
          {sections.map((section, index) => (
            <li key={section.id}>
              <a href={`#${section.id}`} className="inline-flex min-h-[32px] items-center text-navy-700 hover:underline">
                {index + 1}. {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-6 space-y-8 text-[15px] leading-relaxed text-slate-700 [&_a]:font-semibold [&_a]:text-navy-700 [&_a]:underline [&_li]:mt-1 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
        {sections.map((section, index) => (
          <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="scroll-mt-24">
            <h2 id={`${section.id}-title`} className="text-xl font-bold text-navy-900">
              {index + 1}. {section.title}
            </h2>
            {section.content}
          </section>
        ))}
      </div>

      <nav aria-label="Other policies" className="mt-10 border-t border-slate-200 pt-4 text-sm">
        <p className="text-slate-500">Also read:</p>
        <ul className="mt-1 flex flex-wrap gap-x-4">
          {POLICY_PAGES.filter((policy) => policy.label !== title).map((policy) => (
            <li key={policy.to}>
              <Link to={policy.to} className="inline-flex min-h-[44px] items-center font-semibold text-navy-700 hover:underline">
                {policy.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

export default PolicyPage;
