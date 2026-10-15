import { useState } from 'react';
import { Link } from 'react-router-dom';
import { statusInfo, kindInfo } from '../../data/workflow.js';
import { roleInfo } from '../../data/roles.js';
import { labelForSlug } from '../../data/categories.js';
import { initialsOf } from '../../services/store.js';
import { useApiFile } from '../../hooks/useApiFile.js';

/*
 * The small building blocks the admin panel is assembled from.
 *
 * They deliberately reuse the student site's design tokens - the same navy
 * palette from tailwind.config.js, the same rounded-xl cards, the same border
 * and shadow weights - so the panel reads as the management view of the same
 * website rather than a different product bolted on beside it.
 *
 * Keeping them here, rather than styling each page by hand, is what makes a
 * later change to the look one edit instead of fifteen.
 */

/* ------------------------------------------------------------------ *
 * BADGE
 *
 * One badge component, four flavours. Each flavour looks its colour up from
 * data/workflow.js, so adding a status or a kind there gives it a correctly
 * coloured badge everywhere at once with no further work.
 * ------------------------------------------------------------------ */

export function Badge({ children, className = '' }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  const info = statusInfo(status);
  return <Badge className={info.badgeClass}>{info.label}</Badge>;
}

export function KindBadge({ kind }) {
  const info = kindInfo(kind);
  return <Badge className={info.badgeClass}>{info.label}</Badge>;
}

export function RoleBadge({ role }) {
  const info = roleInfo(role);
  return <Badge className={info.badgeClass}>{info.label}</Badge>;
}

export function CategoryBadge({ category }) {
  return <Badge className="bg-slate-100 text-slate-700">{labelForSlug(category)}</Badge>;
}

export function AccountStatusBadge({ status }) {
  const suspended = status === 'suspended';
  return (
    <Badge className={suspended ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'}>
      {suspended ? 'Suspended' : 'Active'}
    </Badge>
  );
}

/* ------------------------------------------------------------------ *
 * STAT CARD - the numbers along the top of the dashboard
 * ------------------------------------------------------------------ */

export function StatCard({ label, value, hint, tone = 'default', to }) {
  const tones = {
    default: 'text-navy-900',
    good: 'text-emerald-700',
    warn: 'text-amber-700',
    bad: 'text-red-700',
  };

  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-bold tabular-nums ${tones[tone]}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </>
  );

  const shared =
    'block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow';

  // A card that links somewhere gets a hover lift; a plain figure does not,
  // so it never looks clickable when it is not.
  return to ? (
    <Link to={to} className={`${shared} hover:border-navy-200 hover:shadow-md`}>
      {body}
    </Link>
  ) : (
    <div className={shared}>{body}</div>
  );
}

/* ------------------------------------------------------------------ *
 * PANEL - the standard white card everything sits inside
 * ------------------------------------------------------------------ */

// `id` makes the panel something a link can jump to, e.g. #notifications.
export function Panel({ id, title, description, actions, children, className = '' }) {
  return (
    <section id={id} className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="text-base font-bold text-navy-900">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * PAGE HEADING
 * ------------------------------------------------------------------ */

export function PageHeader({ title, description, children }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-navy-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * EMPTY STATE - shown instead of a blank area when a filter matches nothing
 * ------------------------------------------------------------------ */

export function EmptyState({ title, message, children }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <p className="font-semibold text-navy-900">{title}</p>
      {message && <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{message}</p>}
      {children && <div className="mt-4 flex justify-center gap-2">{children}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * NOTICE - a message box: red when something went wrong, green when it worked
 *
 * One component for every such box on the student site, the log-in pages and
 * the admin panel, so they all look alike. A message that appears because of
 * something the person just did is read out by screen readers the moment it
 * appears - role="alert" for an error, role="status" for a confirmation. A
 * box that is simply part of the page (the suspended-account banner, a
 * rejection reason under a post) passes `announce={false}`, so it is not read
 * out as news every time the page draws.
 * ------------------------------------------------------------------ */

const NOTICE_TONES = {
  error: { role: 'alert', colours: 'bg-red-50 text-red-700' },
  success: { role: 'status', colours: 'bg-emerald-50 text-emerald-800' },
};

export function Notice({ tone = 'error', announce = true, className = '', children }) {
  const { role, colours } = NOTICE_TONES[tone];
  return (
    <p
      role={announce ? role : undefined}
      className={`rounded-lg px-3 py-2 text-sm ${colours} ${className}`}
    >
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------ *
 * FORM FIELDS
 *
 * Wrappers that keep every label, input and select in the panel identical,
 * and matching the ones on the student site's forms.
 * ------------------------------------------------------------------ */

// `min-h-[44px]` is the touch-target floor - see the note in components/Button.jsx.
const CONTROL =
  'min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-navy-900 ' +
  'focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600 ' +
  'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400';

export function Field({ label, htmlFor, hint, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-navy-900">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function TextInput({ className = '', ...props }) {
  return <input className={`${CONTROL} ${className}`} {...props} />;
}

export function TextArea({ className = '', ...props }) {
  return <textarea className={`${CONTROL} ${className}`} {...props} />;
}

export function Select({ options, className = '', ...props }) {
  return (
    <select className={`${CONTROL} ${className}`} {...props}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/* ------------------------------------------------------------------ *
 * DEFINITION LIST - the label/value pairs on a profile or a submission
 * ------------------------------------------------------------------ */

export function DetailList({ items }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {items
        .filter((item) => item)
        .map((item) => (
          <div key={item.label} className="min-w-0">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {item.label}
            </dt>
            <dd className="mt-0.5 break-words text-sm text-navy-900">{item.value || '—'}</dd>
          </div>
        ))}
    </dl>
  );
}

/* ------------------------------------------------------------------ *
 * AVATAR - the person's profile photo in a circle, or their initials
 *
 * One component for every circle that stands for an account: the student
 * navbar, the profile menu, the account page and the admin panel's lists.
 *
 * `photo` is the address of the picture a student uploaded on their account
 * page, as the server sends it on the account ('' for none). The picture is
 * fetched with the signed-in person's token (hooks/useApiFile.js) - only the
 * account itself and staff may see it. With no photo, while it is on its
 * way, or if it fails to load, the circle shows the initials, so a broken
 * picture never leaves an empty hole. The initials come from initialsOf in
 * services/store.js - the one place "Juan Dela Cruz" becomes "JD".
 *
 * `tone="glass"` is the see-through circle that sits on the navy navbar;
 * the default is the solid navy circle used on white.
 *
 * It is decoration: the name is always written beside it or carried by the
 * button it sits in, so it is hidden from screen readers.
 * ------------------------------------------------------------------ */

export function Avatar({ name, photo, size = 'md', tone = 'solid', className = '' }) {
  const sizes = {
    sm: 'h-8 w-8 text-xs',
    nav: 'h-9 w-9 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-16 w-16 text-xl',
    xl: 'h-24 w-24 text-3xl',
  };
  const tones = {
    solid: 'bg-navy-600',
    glass: 'bg-white/20',
  };

  const { url } = useApiFile(photo || null);

  // The picture that last failed to draw, if any. Remembering WHICH one
  // failed means a newly uploaded photo is tried again rather than skipped.
  const [failedUrl, setFailedUrl] = useState(null);

  if (url && url !== failedUrl) {
    return (
      <img
        src={url}
        alt=""
        aria-hidden="true"
        onError={() => setFailedUrl(url)}
        className={`shrink-0 rounded-full object-cover ${tones[tone]} ${sizes[size]} ${className}`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full font-bold text-white ${tones[tone]} ${sizes[size]} ${className}`}
    >
      {initialsOf(name ?? '')}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * DATES
 *
 * One place that decides how a date is printed, so the whole panel agrees.
 * ------------------------------------------------------------------ */

export function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// A policy version is the date its text last changed, '2026-10-14', printed
// like any other date. Read as local midnight, so it never shows the day before.
export function formatVersionDate(version) {
  return formatDate(`${version}T00:00:00`);
}

export function formatDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// "3 days ago" reads faster than a date when the question is "is this stale?".
export function timeAgo(iso) {
  if (!iso) return 'never';

  const seconds = Math.floor((Date.now() - Date.parse(iso)) / 1000);
  if (seconds < 60) return 'just now';

  const steps = [
    { limit: 3600, divisor: 60, unit: 'minute' },
    { limit: 86400, divisor: 3600, unit: 'hour' },
    { limit: 2592000, divisor: 86400, unit: 'day' },
    { limit: 31536000, divisor: 2592000, unit: 'month' },
    { limit: Infinity, divisor: 31536000, unit: 'year' },
  ];

  // The first step the age fits under - "year" takes everything older.
  const step = steps.find((candidate) => seconds < candidate.limit);
  return `${plural(Math.floor(seconds / step.divisor), step.unit)} ago`;
}

/* ------------------------------------------------------------------ *
 * COUNTS AND SEARCHING
 * ------------------------------------------------------------------ */

// "1 row", "3 rows" - a count with its word, singular or plural, so no page
// writes "1 rows". Pass the plural when it is not just an added "s":
// plural(2, 'entry', 'entries').
export function plural(count, singular, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/*
 * THE SEARCH BOX'S MATCH, for every list that has one - the board, Users,
 * All Submissions, Activity Logs: does any of these values contain what was
 * typed, ignoring capitals? Empty values are skipped, and an empty search
 * matches everything.
 */
export function matchesSearch(values, query) {
  const search = query.trim().toLowerCase();
  if (!search) return true;
  return values.filter(Boolean).join(' ').toLowerCase().includes(search);
}
