/*
 * Turning a file the student picked into something the board can save.
 *
 * Attachments are sent to the server and kept in its database. A single photo
 * straight off a phone camera can be several megabytes, which is slow to send
 * on a phone connection and wasteful to keep, so photos are shrunk here first.
 * A 4000px camera picture comes out around 150KB, which is plenty for showing
 * what is broken on campus. The server checks every file again - its type,
 * its size and its contents (backend/src/models/files.js) - and holds the
 * same limits as this file; scripts/check-shared-lists.mjs checks the two
 * still agree.
 */

// How many files one post may carry.
export const MAX_FILES = 3;

// The largest file we will even try to accept, before shrinking.
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB

// Files that are not photos cannot be shrunk, so they get a much lower limit.
export const MAX_OTHER_BYTES = 400 * 1024; // 400KB

// What every photo is sent as, whatever it started as: it is redrawn as a
// JPEG before it leaves the device (shrinkImage, prepareProfilePhoto below).
export const PHOTO_SENT_AS = 'image/jpeg';

// The only files that are not photos which may be attached: PDFs, the one
// kind of document every phone and computer can open.
export const OTHER_TYPES = ['application/pdf'];

// Photos are scaled down so neither side is longer than this, then saved as a
// JPEG at this quality. Both numbers are a trade between file size and detail.
const MAX_IMAGE_EDGE = 1000;
const JPEG_QUALITY = 0.7;

// A readable file size for error messages, e.g. "3.4MB" - or "15MB", not
// "15.0MB", when there is nothing after the point.
export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')}MB`;
}

// Read a file off the student's device as a data URL - a long piece of text
// that holds the file's contents and can be stored and shown directly.
function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`"${file.name}" could not be read.`));
    reader.readAsDataURL(file);
  });
}

// Load a data URL into an <img> so its real pixel size can be measured.
function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('That photo could not be opened.'));
    image.src = dataUrl;
  });
}

/*
 * Shrink a photo by drawing it onto a smaller canvas and exporting that.
 * A picture already smaller than the limit is drawn at its own size, so
 * nothing is ever scaled up and blurred.
 */
async function shrinkImage(dataUrl) {
  const image = await loadImage(dataUrl);

  // Work out the scale that brings the longest side down to MAX_IMAGE_EDGE.
  // Math.min with 1 is what stops a small picture being enlarged.
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.width, image.height));

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);

  const context = canvas.getContext('2d');

  // JPEG has no transparency, so anything see-through would come out black.
  // Painting the canvas white first means it comes out white instead.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  return canvas.toDataURL(PHOTO_SENT_AS, JPEG_QUALITY);
}

/*
 * Prepare one chosen file for saving.
 *
 * Returns { name, type, size, dataUrl }, or throws an Error carrying a
 * message written for the student rather than for a developer.
 */
export async function prepareAttachment(file) {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(
      `"${file.name}" is ${formatBytes(file.size)}. Please attach files under ${formatBytes(
        MAX_FILE_BYTES
      )}.`
    );
  }

  const dataUrl = await readAsDataUrl(file);

  // PHOTOS: shrink, then store.
  if (file.type.startsWith('image/')) {
    const shrunk = await shrinkImage(dataUrl);
    return {
      name: file.name,
      type: PHOTO_SENT_AS, // it is a JPEG now, whatever it started as
      size: shrunk.length,
      dataUrl: shrunk,
    };
  }

  // EVERYTHING ELSE must be a PDF (OTHER_TYPES). Anything else could not be
  // viewed by whoever reviews it, and the server would refuse it anyway.
  if (!OTHER_TYPES.includes(file.type)) {
    throw new Error(
      `"${file.name}" is not a photo or a PDF. Only photos and PDF files can be attached.`
    );
  }

  // A PDF cannot be shrunk, so it is only accepted while it is small enough
  // to keep as it is.
  if (file.size > MAX_OTHER_BYTES) {
    throw new Error(
      `"${file.name}" is ${formatBytes(file.size)}. Files that are not photos must be under ${formatBytes(
        MAX_OTHER_BYTES
      )} - or attach a screenshot of it instead.`
    );
  }

  return { name: file.name, type: file.type, size: file.size, dataUrl };
}

/* ------------------------------------------------------------------ *
 * PROFILE PHOTOS
 *
 * The picture a student puts in place of their initials (pages/student/
 * Account.jsx). It is only ever shown inside a circle, so it is cut to a
 * square from the middle of the picture - the part a face is usually in -
 * and shrunk to PROFILE_PHOTO_SIZE pixels a side. The largest circle it
 * fills is 96px, so 320 stays sharp on a high-density phone screen, and the
 * saved JPEG is around 20-40KB however big the original was.
 * ------------------------------------------------------------------ */

// The largest original we will try to open. Bigger than a post attachment's
// limit, because a photo straight off a modern phone camera can be 10MB+ and
// it is shrunk to a few kilobytes anyway.
export const PROFILE_PHOTO_MAX_BYTES = 15 * 1024 * 1024; // 15MB

const PROFILE_PHOTO_SIZE = 320;
const PROFILE_PHOTO_QUALITY = 0.85;

// Said when a picture will not open - most often an iPhone HEIC photo in a
// browser that cannot read them - or opens with no size at all.
const UNREADABLE_PHOTO = 'That photo could not be opened. Please choose a JPG or PNG picture.';

/*
 * Turn the chosen file into a small square JPEG, as a data URL ready to save
 * on the account. Throws an Error carrying a message written for the student.
 */
export async function prepareProfilePhoto(file) {
  // Some phones report no type at all for their own photo format, so only a
  // file that says it is something OTHER than a picture is turned away here;
  // anything else gets the chance to open below.
  if (file.type && !file.type.startsWith('image/')) {
    throw new Error('Please choose a photo - a JPG, PNG or WebP picture.');
  }
  if (file.size > PROFILE_PHOTO_MAX_BYTES) {
    throw new Error(
      `That photo is ${formatBytes(file.size)}. Please choose one under ${formatBytes(
        PROFILE_PHOTO_MAX_BYTES
      )}.`
    );
  }

  let image;
  try {
    image = await loadImage(await readAsDataUrl(file));
  } catch {
    throw new Error(UNREADABLE_PHOTO);
  }

  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (!width || !height) {
    throw new Error(UNREADABLE_PHOTO);
  }

  // The largest square that fits, taken from the middle of the picture.
  const side = Math.min(width, height);
  const sourceX = (width - side) / 2;
  const sourceY = (height - side) / 2;

  // Never enlarge a small picture - it would only come out blurred.
  const size = Math.min(PROFILE_PHOTO_SIZE, side);

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext('2d');
  // White behind anything see-through, as for attachments: JPEG has no
  // transparency and would otherwise turn it black.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, size, size);
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, sourceX, sourceY, side, side, 0, 0, size, size);

  return canvas.toDataURL(PHOTO_SENT_AS, PROFILE_PHOTO_QUALITY);
}
