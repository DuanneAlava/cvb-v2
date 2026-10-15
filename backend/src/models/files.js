/*
 * FILES KEPT IN THE DATABASE - post attachments and profile photos.
 *
 * The browser sends a file as a "data URL": its type and its bytes written
 * out as text, e.g. "data:image/jpeg;base64,/9j/4AAQ...". Photos are shrunk
 * in the browser first (frontend/src/services/attachments.js), so what
 * arrives is small. Nothing about it is trusted, though: the type must be
 * one of a short list, the size must be within its limit, and the first few
 * bytes must really be that kind of file - a script renamed "photo.jpg" is
 * refused, not stored.
 */

/*
 * The kinds of file accepted, each with the "magic number" its contents
 * start with - the bytes every real file of that kind begins with.
 */
const FILE_TYPES = {
  'image/jpeg': (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  'image/png': (bytes) => bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/gif': (bytes) => bytes.subarray(0, 4).toString('latin1') === 'GIF8',
  'image/webp': (bytes) =>
    bytes.subarray(0, 4).toString('latin1') === 'RIFF' && bytes.subarray(8, 12).toString('latin1') === 'WEBP',
  'application/pdf': (bytes) => bytes.subarray(0, 5).toString('latin1') === '%PDF-',
};

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// The limits, after decoding. The browser keeps well inside them: a shrunk
// photo is a few hundred kilobytes, and it refuses other files over 400KB.
const MAX_ATTACHMENTS = 3;
const MAX_PHOTO_BYTES = 1024 * 1024; // 1MB
const MAX_OTHER_BYTES = 400 * 1024; // 400KB, as in the browser
const MAX_PROFILE_PHOTO_BYTES = 300 * 1024; // the browser's is 320px square, ~40KB

/*
 * Turn a data URL into { type, data } - or { error } when it is not one of
 * `allowedTypes`, is bigger than `maxBytes` for that type, or its contents
 * are not what it claims to be.
 */
function readDataUrl(dataUrl, allowedTypes, maxBytesFor) {
  const match = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]*={0,2})$/.exec(String(dataUrl ?? ''));
  if (!match || !allowedTypes.includes(match[1])) return { error: 'unsupported' };

  const type = match[1];
  const data = Buffer.from(match[2], 'base64');
  if (data.length === 0) return { error: 'unsupported' };
  if (data.length > maxBytesFor(type)) return { error: 'too-large' };
  if (!FILE_TYPES[type](data)) return { error: 'unsupported' };

  return { type, data };
}

/*
 * The attachments sent with a new post: a list of up to three
 * { name, dataUrl }. Answers { files } ready to store, or { error } with a
 * message for the student. No list at all is no attachments.
 */
function readAttachments(list) {
  if (list === undefined || list === null) return { files: [] };
  if (!Array.isArray(list)) return { error: 'The attachments could not be read.' };
  if (list.length > MAX_ATTACHMENTS) {
    return { error: `You can attach up to ${MAX_ATTACHMENTS} files to one post.` };
  }

  const files = [];
  for (const item of list) {
    const name = String(item?.name ?? '').trim().slice(0, 255) || 'attachment';
    const file = readDataUrl(item?.dataUrl, Object.keys(FILE_TYPES), (type) =>
      PHOTO_TYPES.includes(type) ? MAX_PHOTO_BYTES : MAX_OTHER_BYTES
    );

    if (file.error === 'too-large') return { error: `"${name}" is too large to attach.` };
    if (file.error) return { error: `"${name}" is not a photo or a PDF. Only photos and PDF files can be attached.` };
    files.push({ name, type: file.type, data: file.data });
  }

  return { files };
}

/*
 * A profile photo: '' (or nothing) removes it. Answers { photo } - null to
 * remove, or { type, data } - or { error }.
 */
function readProfilePhoto(dataUrl) {
  if (!dataUrl) return { photo: null };

  const file = readDataUrl(dataUrl, PHOTO_TYPES, () => MAX_PROFILE_PHOTO_BYTES);
  if (file.error === 'too-large') return { error: 'That photo is too large. Please choose a smaller one.' };
  if (file.error) return { error: 'Please choose a photo - a JPG, PNG or WebP picture.' };
  return { photo: file };
}

/*
 * Send a stored file back. `nosniff` makes the browser believe the type
 * given rather than guess from the contents, and the file name is encoded so
 * an odd character in it cannot break the header. The contents of a stored
 * file never change - an edited photo gets a new address - so the browser
 * may keep it for a day; `private` stops a shared cache keeping a copy.
 */
function sendFile(res, { name, type, data }) {
  res.set({
    'Content-Type': type,
    'Content-Length': data.length,
    'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(name)}`,
    'Cache-Control': 'private, max-age=86400',
  });
  res.end(data);
}

module.exports = {
  readAttachments,
  readProfilePhoto,
  sendFile,
  // For scripts/check-shared-lists.mjs, which checks the browser's copy of
  // these rules (frontend/src/services/attachments.js) still matches.
  FILE_TYPES,
  PHOTO_TYPES,
  MAX_ATTACHMENTS,
  MAX_OTHER_BYTES,
};
