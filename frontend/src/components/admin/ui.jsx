import { Link } from 'react-router-dom';
import { statusInfo, kindInfo } from '../../data/workflow.js';
import { roleInfo } from '../../data/roles.js';
import { labelForSlug } from '../../data/categories.js';

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

export function Panel({ title, description, actions, children, className = '' }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
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
 * AVATAR - initials in a circle, the same one the student navbar uses
 * ------------------------------------------------------------------ */

export function Avatar({ name, size = 'md', className = '' }) {
  const sizes = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-16 w-16 text-xl',
  };

  const initials =
    (name ?? '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? '')
      .join('') || '?';

  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full bg-navy-600 font-bold text-white ${sizes[size]} ${className}`}
    >
      {initials}
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
  ];

  for (const step of steps) {
    if (seconds < step.limit) {
      const count = Math.floor(seconds / step.divisor);
      return `${count} ${step.unit}${count === 1 ? '' : 's'} ago`;
    }
  }

  const years = Math.floor(seconds / 31536000);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}
