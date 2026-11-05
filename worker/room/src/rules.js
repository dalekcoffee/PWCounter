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

export const ROLES = ['host', 'guest', 'watch'];
export const PLAYER_ROLES = ['host', 'guest'];
export const isPlayer = (role) => PLAYER_ROLES.includes(role);
export const SID_RE = /^[A-Za-z0-9]{1,32}$/;
export const MAX_WATCHERS = 8; // viewers (read only) never take one of the two player places
export const CLOSE_FULL = 4001; // a second guest
export const CLOSE_CODE_IN_USE = 4002; // a second host: pick another code
export const CLOSE_REPLACED = 4000; // the same tab came back: the old socket goes
export const CLOSE_VIEWERS = 4003; // a 9th viewer

/** `?role=host|guest|watch[&sid=...]` -> {role, sid} (sid '' when absent), or null when invalid. */
export function peerFromQuery(params) {
  const role = params.get('role');
  if (!ROLES.includes(role)) return null;
  const sid = params.get('sid') ?? '';
  if (sid !== '' && !SID_RE.test(sid)) return null;
  return { role, sid };
}

/**
 * Who may join? `existing` = [{role, sid}] of the open sockets, `incoming` = {role, sid}.
 * -> {accept: true, replace: index | -1} or {accept: false, code}.
 * The same tab (same non-empty sid and role) replaces its own stale socket instead of being refused.
 * Watchers never count toward the two player places; at most MAX_WATCHERS of them.
 */
export function admit(existing, incoming) {
  if (incoming.sid) {
    const i = existing.findIndex((e) => e.sid === incoming.sid && e.role === incoming.role);
    if (i >= 0) return { accept: true, replace: i };
  }
  if (incoming.role === 'watch') {
    return existing.filter((e) => e.role === 'watch').length >= MAX_WATCHERS ? { accept: false, code: CLOSE_VIEWERS } : { accept: true, replace: -1 };
  }
  const players = existing.filter((e) => isPlayer(e.role));
  if (incoming.role === 'host' && players.some((e) => e.role === 'host')) return { accept: false, code: CLOSE_CODE_IN_USE };
  if (incoming.role === 'guest' && players.some((e) => e.role === 'guest')) return { accept: false, code: CLOSE_FULL };
  if (players.length >= MAX_PEERS) return { accept: false, code: CLOSE_FULL };
  return { accept: true, replace: -1 };
}

/**
 * Where does a message go? `sockets` = [{role}] of the open sockets, `from` = index of the sender.
 * A player's message reaches every other socket (the other player and all viewers); a viewer's is dropped.
 */
export function routeTargets(sockets, from) {
  if (!isPlayer(sockets[from]?.role)) return [];
  return sockets.map((_, i) => i).filter((i) => i !== from);
}

/**
 * Notices when `incoming` has joined `others` (the other open sockets, as [{role}]).
 * -> {toOthers: [{index, msg}], toSelf: [msg]}.
 * Players hear only about the other PLAYER ({t:'peer', here}); viewers hear about each player with its role.
 * A new viewer makes every player resend its state ({t:'watcher'}) and is told who is here.
 */
export function joinNotices(others, incoming) {
  const toOthers = [], toSelf = [];
  if (incoming === 'watch') {
    others.forEach((o, index) => { if (isPlayer(o.role)) { toOthers.push({ index, msg: { t: 'watcher' } }); toSelf.push({ t: 'peer', role: o.role, here: true }); } });
    return { toOthers, toSelf };
  }
  others.forEach((o, index) => {
    if (o.role === 'watch') toOthers.push({ index, msg: { t: 'peer', role: incoming, here: true } });
    else toOthers.push({ index, msg: { t: 'peer', here: true } });
  });
  toSelf.push({ t: 'peer', here: others.some((o) => isPlayer(o.role)) });
  return { toOthers, toSelf };
}

/** Notices when `leaving` (a role) has gone: [{index, msg}] for the `others` that remain. A viewer leaving tells nobody. */
export function leaveNotices(others, leaving) {
  if (!isPlayer(leaving)) return [];
  return others.map((o, index) => ({ index, msg: o.role === 'watch' ? { t: 'peer', role: leaving, here: false } : { t: 'peer', here: false } }));
}
