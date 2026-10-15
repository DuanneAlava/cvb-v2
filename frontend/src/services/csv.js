import { labelForSlug } from '../data/categories.js';
import { departmentLabel, kindInfo, statusInfo } from '../data/workflow.js';
import { findUser } from './store.js';

/*
 * CSV BUILDING, IN ONE PLACE.
 *
 * Two screens hand submissions out as a file: Reports & Exports takes the
 * whole set, and All Submissions takes whatever the filters currently show.
 * They share this module so the two files have the same shape - a filtered
 * export and a full one should differ in their ROWS, never in their columns,
 * or a spreadsheet built on one breaks when somebody sends the other.
 */

/*
 * Wrap a value for CSV: quote it, and double any quotes inside.
 *
 * FORMULA INJECTION. A spreadsheet treats a cell starting with = + - or @ as
 * a formula and runs it - and a submission's title is typed by anybody. A
 * title like =HYPERLINK("http://...") would turn into a live link, or worse,
 * the moment an administrator opened the export. A leading apostrophe makes
 * the spreadsheet show the text exactly as typed instead of running it.
 */
function csvCell(value) {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(headers, rows) {
  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}

/*
 * A date for a spreadsheet: "2026-10-13 14:05", in this computer's own time
 * zone - the same time the screens show - rather than the server's
 * "2026-10-13T06:05:00.000Z", which is UTC and which a spreadsheet does not
 * read as a date. Written year first, so the column still sorts correctly.
 */
export function csvDate(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  const two = (number) => String(number).padStart(2, '0');
  return (
    `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())} ` +
    `${two(date.getHours())}:${two(date.getMinutes())}`
  );
}

/*
 * Hand a file to the browser to save - a CSV from the export pages, or a
 * person's data download (components/PrivacyData.jsx).
 *
 * A Blob and an object URL rather than a data: URI, because a data: URI of a
 * few thousand rows runs into URL length limits in some browsers. The URL is
 * let go of a moment later rather than straight away - some browsers,
 * Safari among them, are still starting the download when the click returns,
 * and would find nothing there.
 */
export function saveFile(filename, blob) {
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function downloadCsv(filename, csv) {
  // The BOM is what makes Excel open a UTF-8 CSV correctly instead of
  // mangling any accented character in it.
  saveFile(filename, new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }));
}

// Today's date, for the filename.
export function stamp() {
  return csvDate(new Date().toISOString()).slice(0, 10);
}

/*
 * THE SUBMISSION COLUMNS.
 *
 * `includeIdentity` appends the author's name, student number and email. It
 * is off unless a caller deliberately turns it on, and only Reports &
 * Exports offers that - behind a tick box that has to be read first.
 *
 * The quick export on All Submissions never offers it. A spreadsheet gets
 * forwarded, and a student who ticked "post anonymously" did not agree to
 * appear in one; a decision that consequential belongs on the page built to
 * explain it, not on a button beside a search box.
 */
export function submissionHeaders(includeIdentity = false) {
  return [
    'ID', 'Title', 'Message', 'Type', 'Category', 'Status',
    'Department', 'Votes', 'Anonymous', 'Submitted', 'Resolved', 'Resolution',
    ...(includeIdentity ? ['Author', 'Student ID', 'Email'] : []),
  ];
}

export function submissionRow(db, post, includeIdentity = false) {
  const author = findUser(db, post.authorId);

  return [
    post.id,
    post.title,
    post.message,
    kindInfo(post.kind).label,
    labelForSlug(post.category),
    statusInfo(post.status).label,
    post.department ? departmentLabel(post.department) : '',
    post.votes,
    post.anonymous ? 'Yes' : 'No',
    csvDate(post.createdAt),
    csvDate(post.resolvedAt),
    post.resolution,
    ...(includeIdentity
      ? [author?.name ?? 'Deleted account', author?.studentId ?? '', author?.email ?? '']
      : []),
  ];
}
