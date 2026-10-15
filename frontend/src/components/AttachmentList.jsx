import { useApiFile } from '../hooks/useApiFile.js';

/*
 * THE PHOTOS AND PDFS ON A SUBMISSION - on a card on the board
 * (components/SuggestionCard.jsx) and in the review dialog
 * (components/admin/SubmissionReview.jsx), drawn the same way in both.
 *
 * A photo is a small square thumbnail; anything else is its file name with a
 * document icon. Either one opens the whole file in a new tab - a photo at
 * full size, a PDF in the browser's own viewer.
 *
 * Each file is fetched from the server on its own (hooks/useApiFile.js), so
 * the board does not wait for every photo before showing any post. Until a
 * photo arrives its square is a plain grey placeholder of the same size, so
 * nothing jumps about when it lands.
 *
 * Props:
 * - files  the post's `attachments`: { id, name, type, url } each
 * - size   'sm' (the board's cards) or 'md' (the review dialog)
 */

const SQUARE = {
  sm: 'h-20 w-20',
  md: 'h-24 w-24',
};

function DocumentIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
      className="h-4 w-4 shrink-0 text-slate-400"
    >
      <path
        d="M14 3v5h5M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Attachment({ file, size }) {
  const { url } = useApiFile(file.url);
  const isPhoto = file.type?.startsWith('image/');

  const content = isPhoto ? (
    // `object-cover` fills the square without stretching the picture.
    url ? (
      <img
        src={url}
        alt={file.name}
        className={`${SQUARE[size]} rounded-lg border border-slate-200 object-cover`}
      />
    ) : (
      <span className={`block ${SQUARE[size]} rounded-lg border border-slate-200 bg-slate-100`} />
    )
  ) : (
    // Anything that is not a photo is listed by name, because there is
    // nothing useful to show as a preview.
    <span className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-600">
      <DocumentIcon />
      <span className="max-w-[10rem] truncate">{file.name}</span>
    </span>
  );

  // Not a link until the file has arrived - there is nothing to open yet.
  if (!url) return content;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open ${file.name} in a new tab`}
      className="block rounded-lg transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-navy-600"
    >
      {content}
    </a>
  );
}

function AttachmentList({ files, size = 'sm', className = '' }) {
  if (!files?.length) return null;

  return (
    <ul className={`flex flex-wrap gap-2 ${className}`}>
      {files.map((file) => (
        <li key={file.id}>
          <Attachment file={file} size={size} />
        </li>
      ))}
    </ul>
  );
}

export default AttachmentList;
