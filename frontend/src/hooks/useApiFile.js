import { useEffect, useState } from 'react';
import { fileUrl, loadedFileUrl } from '../services/api.js';

/*
 * A photo or PDF kept on the server - a profile photo, a post's attachment -
 * ready to put in an <img src> or a link.
 *
 * Give it the file's address from the server (`/attachments/12`); it answers
 * `{ url, failed }`. `url` is null while the file is on its way, and stays
 * null if it could not be loaded, when `failed` is true - so a screen can
 * fall back to initials, or a plain file name, instead of a broken picture.
 * No address at all (no photo) answers `{ url: null, failed: false }`.
 *
 * The file is fetched with the signed-in person's token (services/api.js
 * fileUrl), because an <img src> cannot send one - and a pending post's
 * photo is for its author and staff only. A file already fetched is drawn
 * straight away, with no blank moment first.
 *
 * WHAT YOU'LL MEET IN THIS FILE (plain-English notes)
 * - useEffect  Runs after the component is drawn - here, to start fetching -
 *   and again whenever `path` changes. The function it returns runs first
 *   when it re-runs or the component goes away; `current = false` there
 *   stops a slow answer for an OLD address landing after a new one.
 */
export function useApiFile(path) {
  const [loaded, setLoaded] = useState({ path: null, url: null, failed: false });

  useEffect(() => {
    if (!path || loadedFileUrl(path)) return undefined;

    let current = true;
    fileUrl(path).then(
      (url) => current && setLoaded({ path, url, failed: false }),
      () => current && setLoaded({ path, url: null, failed: true })
    );
    return () => {
      current = false;
    };
  }, [path]);

  if (!path) return { url: null, failed: false };
  const ready = loadedFileUrl(path);
  if (ready) return { url: ready, failed: false };
  return loaded.path === path ? loaded : { url: null, failed: false };
}
