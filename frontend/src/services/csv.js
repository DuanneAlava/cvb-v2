import { labelForSlug } from '../data/categories.js';
import { departmentLabel, kindInfo, statusInfo } from '../data/workflow.js';
import { findUser, voteCount } from './store.js';

/*
 * CSV BUILDING, IN ONE PLACE.
 *
 * Two screens hand submissions out as a file: Reports & Exports takes the
 * whole set, and All Submissions takes whatever the filters currently show.
 * They share this module so the two files have the same shape - a filtered
 * export and a full one should differ in their ROWS, never in their columns,
 * or a spreadsheet built on one breaks when somebody sends the other.
 */

// Wrap a value for CSV: quote it, and double any quotes inside.
function csvCell(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(headers, rows) {
  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}

/*
 * Hand the file to the browser.
 *
 * A Blob and an object URL rather than a data: URI, because a data: URI of a
 * few thousand rows runs into URL length limits in some browsers. The URL is
 * revoked afterwards so the blob is not held in memory for the session.
 */
export function downloadCsv(filename, csv) {
  // The BOM is what makes Excel open a UTF-8 CSV correctly instead of
  // mangling any accented character in it.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

// Today's date, for the filename.
export function stamp() {
  return new Date().toISOString().slice(0, 10);
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
    voteCount(db, post.id),
    post.anonymous ? 'Yes' : 'No',
    post.createdAt,
    post.resolvedAt ?? '',
    post.resolution ?? '',
    ...(includeIdentity
      ? [author?.name ?? 'Deleted account', author?.studentId ?? '', author?.email ?? '']
      : []),
  ];
}
