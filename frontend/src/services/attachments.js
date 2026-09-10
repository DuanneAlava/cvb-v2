/*
 * Turning a file the student picked into something the board can save.
 *
 * A post is stored in the browser, and browser storage is small - a few
 * megabytes in total for the whole app. A single photo straight off a phone
 * camera is bigger than that on its own, so photos are shrunk here before they
 * are stored. A 4000px camera picture comes out around 150KB, which is plenty
 * for showing what is broken on campus and small enough that a student can
 * attach several without filling the board's storage.
 */

// How many files one post may carry.
export const MAX_FILES = 3;

// The largest file we will even try to accept, before shrinking.
export const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB

// Files that are not photos cannot be shrunk, so they get a much lower limit.
const MAX_OTHER_BYTES = 400 * 1024; // 400KB

// Photos are scaled down so neither side is longer than this, then saved as a
// JPEG at this quality. Both numbers are a trade between file size and detail.
const MAX_IMAGE_EDGE = 1000;
const JPEG_QUALITY = 0.7;

// A readable file size for error messages, e.g. "3.4MB".
export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
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

  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
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
      type: 'image/jpeg', // it is a JPEG now, whatever it started as
      size: shrunk.length,
      dataUrl: shrunk,
    };
  }

  // EVERYTHING ELSE: a PDF or document cannot be shrunk, so it is only
  // accepted while it is small enough to store as it is.
  if (file.size > MAX_OTHER_BYTES) {
    throw new Error(
      `"${file.name}" is ${formatBytes(file.size)}. Files that are not photos must be under ${formatBytes(
        MAX_OTHER_BYTES
      )} - or attach a screenshot of it instead.`
    );
  }

  return { name: file.name, type: file.type || 'application/octet-stream', size: file.size, dataUrl };
}
