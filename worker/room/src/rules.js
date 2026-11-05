// Pure rules of the room relay (no Workers APIs), tested in tests/room-rules.test.mjs.
export const CODE_RE = /^[0-9]{4}$/;
export const MAX_MESSAGE = 4096;
export const MAX_PEERS = 2;
export const SITE_ORIGIN = 'https://pwcounter.dalek.coffee';

export const validCode = (code) => typeof code === 'string' && CODE_RE.test(code);

/** The page's own site, or a loopback page during development. */
export function originAllowed(origin) {
  if (typeof origin !== 'string') return false;
  if (origin === SITE_ORIGIN) return true;
  return /^http:\/\/(127\.0\.0\.1|localhost)(:\d{1,5})?$/.test(origin);
}

/** Messages are strings of at most 4 KB (counted in bytes, not characters). */
export function messageOk(msg) {
  if (typeof msg !== 'string') return false;
  if (msg.length > MAX_MESSAGE) return false;
  return new TextEncoder().encode(msg).length <= MAX_MESSAGE;
}

/** The room code from a request path like /room/0427, else null. */
export function codeFromPath(pathname) {
  const m = /^\/room\/([^/]+)$/.exec(pathname);
  return m && validCode(m[1]) ? m[1] : null;
}
