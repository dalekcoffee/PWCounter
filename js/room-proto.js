// Pure parts of "play with a friend": room codes, the wire messages, turn rules. No DOM, no network.
import { cleanName, LIMITS, SOUL_MAX, beginTurn } from './state.js';

export const CODE_LEN = 4;
export const MAX_MSG = 1024; // our own messages stay well under the relay's 4 KB

export const validCode = (c) => typeof c === 'string' && /^[0-9]{4}$/.test(c);
/** What a person typed or scanned, reduced to digits and cut to 4. */
export const cleanCode = (raw) => String(raw ?? '').replace(/[^0-9]/g, '').slice(0, CODE_LEN);

/** A fresh 4-digit code (leading zeros kept). `getRandomValues` is injectable; rejection sampling keeps it uniform. */
export function makeCode(getRandomValues = (a) => crypto.getRandomValues(a)) {
  const limit = Math.floor(0x100000000 / 10000) * 10000;
  const buf = new Uint32Array(1);
  for (let i = 0; i < 64; i++) {
    getRandomValues(buf);
    if (buf[0] < limit) return String(buf[0] % 10000).padStart(CODE_LEN, '0');
  }
  return String(buf[0] % 10000).padStart(CODE_LEN, '0');
}

export const joinLink = (code, origin = 'https://pwcounter.dalek.coffee') => `${origin}/#join=${code}`;
/** `#join=0427` -> '0427', else null. */
export function codeFromHash(hash) {
  const m = /^#join=([0-9]{4})$/.exec(String(hash ?? ''));
  return m ? m[1] : null;
}
export const watchLink = (code, origin = 'https://pwcounter.dalek.coffee') => `${origin}/#watch=${code}`;
/** The short form shown on the board: no scheme. */
export const watchText = (code, host = 'pwcounter.dalek.coffee') => `${host}/#watch=${code}`;
/** `#watch=0427` -> '0427'; a bare `#watch` -> '' (open the sheet, no code yet); anything else -> null. */
export function watchFromHash(hash) {
  const m = /^#watch(?:=([0-9]{4}))?$/.exec(String(hash ?? ''));
  return m ? (m[1] ?? '') : null;
}
/** The text of a scanned QR code (a join link or bare digits) -> a code or null. */
export function codeFromScan(text) {
  const s = String(text ?? '');
  const m = /join=([0-9]{4})(?![0-9])/.exec(s) || /^\s*([0-9]{4})\s*$/.exec(s);
  return m ? m[1] : null;
}

// ---------- messages ----------
const int = (n, lo, hi) => Number.isInteger(n) && n >= lo && n <= hi;

export function cleanPeerSeat(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const seat = {};
  for (const k of Object.keys(LIMITS)) { if (!int(raw[k], LIMITS[k][0], LIMITS[k][1])) return null; seat[k] = raw[k]; }
  if (!int(raw.soul, 0, SOUL_MAX) || !int(raw.up, 0, raw.soul)) return null;
  seat.soul = raw.soul; seat.up = raw.up;
  return seat;
}

export const PLAYER_ROLES = ['host', 'guest'];
const cleanRole = (r) => (PLAYER_ROLES.includes(r) ? r : null);
export function helloMsg({ name, seat, souls, role }) {
  return JSON.stringify({ t: 'hello', v: 1, role: cleanRole(role), name: cleanName(name), seat: { life: seat.life, mat: seat.mat, ing: seat.ing, soul: seat.soul, up: seat.up }, souls: souls === true });
}
/** `active` is 0 (me) | 1 (you / the other phone), from the SENDER's side of the table. */
export function sharedMsg({ night, active, turn, rev, role }) {
  return JSON.stringify({ t: 'shared', role: cleanRole(role), night: night === true, active: active === 1 ? 'you' : 'me', turn, rev });
}

const cleanShared = (sh) => (sh && typeof sh === 'object' && typeof sh.night === 'boolean' && (sh.active === 'me' || sh.active === 'you') && int(sh.turn, 0, 9999)
  ? { night: sh.night, active: sh.active, turn: sh.turn } : null);
export { cleanShared };
/** After a rejoin: what I have of both seats and of the shared game. `mine`/`yours` are seats (`yours` = what I last saw of the other phone, or null); shared.active is 0 (me) | 1. */
export function checkMsg({ mine, yours, shared }) {
  return JSON.stringify({ t: 'check', v: 1, mine: { life: mine.life, mat: mine.mat, ing: mine.ing, soul: mine.soul, up: mine.up }, yours: yours ? { life: yours.life, mat: yours.mat, ing: yours.ing, soul: yours.soul, up: yours.up } : null, shared: { night: shared.night === true, active: shared.active === 1 ? 'you' : 'me', turn: shared.turn } });
}
/** `use` is 'me' | 'you' from the SENDER's side. */
export const pickMsg = ({ use, rev }) => JSON.stringify({ t: 'pick', v: 1, use: use === 'you' ? 'you' : 'me', rev });

/** Validate anything received. Unknown or invalid = null. Shared messages are translated to OUR point of view. */
export function parseMessage(text) {
  if (typeof text !== 'string' || text.length > 4096) return null;
  let m;
  try { m = JSON.parse(text); } catch { return null; }
  if (!m || typeof m !== 'object' || Array.isArray(m)) return null;
  if (m.t === 'watcher') return { t: 'watcher' }; // a viewer joined: players resend their state
  if (m.t === 'peer') {
    if (typeof m.here !== 'boolean') return null;
    if (m.role === undefined) return { t: 'peer', here: m.here };
    return cleanRole(m.role) ? { t: 'peer', role: m.role, here: m.here } : null; // a viewer is told which player came or went
  }
  if (m.t === 'hello') {
    if (m.v !== 1) return null;
    if (m.role !== undefined && m.role !== null && !cleanRole(m.role)) return null;
    const seat = cleanPeerSeat(m.seat);
    if (!seat || typeof m.souls !== 'boolean') return null;
    return { t: 'hello', role: cleanRole(m.role), name: cleanName(m.name), seat, souls: m.souls };
  }
  if (m.t === 'shared') {
    if (typeof m.night !== 'boolean' || (m.active !== 'me' && m.active !== 'you')) return null;
    if (!int(m.turn, 0, 9999) || !int(m.rev, 0, 1e9)) return null;
    if (m.role !== undefined && m.role !== null && !cleanRole(m.role)) return null;
    // the sender's "me" is the other phone, i.e. 1 here (a viewer reads `from` + `senderActive` instead)
    return { t: 'shared', from: cleanRole(m.role), senderActive: m.active === 'me', night: m.night, active: m.active === 'me' ? 1 : 0, turn: m.turn, rev: m.rev };
  }
  if (m.t === 'check') {
    const mine = cleanPeerSeat(m.mine);
    const yours = m.yours === null ? null : cleanPeerSeat(m.yours);
    const sh = cleanShared(m.shared);
    if (!mine || !sh || (m.yours !== null && !yours)) return null;
    return { t: 'check', mine, yours, shared: { night: sh.night, active: sh.active === 'me' ? 1 : 0, turn: sh.turn } };
  }
  if (m.t === 'pick') {
    if ((m.use !== 'me' && m.use !== 'you') || !int(m.rev, 0, 1e9)) return null;
    return { t: 'pick', use: m.use === 'me' ? 'you' : 'me', rev: m.rev };
  }
  return null;
}

/** A viewer's rule: the highest rev wins; on an equal rev the host's word counts. */
export const acceptWatchShared = (localRev, incomingRev, from) => incomingRev > localRev || (incomingRev === localRev && from === 'host');
/** Which player's turn is it, as a role? `from` is the sender's role, `senderActive` whether the sender said it was its own turn. */
export const activeRoleOf = (from, senderActive) => (from === 'host' ? (senderActive ? 'host' : 'guest') : from === 'guest' ? (senderActive ? 'guest' : 'host') : null);

/** Last writer wins by rev; on an equal rev the room creator (host) wins. `role` is OUR role; the sender is the other one. */
export function acceptShared(localRev, incomingRev, role) {
  return incomingRev > localRev || (incomingRev === localRev && role === 'guest');
}

// ---------- the game in a room ----------
/** I end my turn: the other phone is active. A round (back to the host) counts one turn. */
export function passTurn(state, role) {
  if (state.active !== 0) return state;
  const turn = role === 'guest' ? Math.min(9999, state.turn + 1) : state.turn;
  return { ...state, active: 1, turn };
}
/** The other phone passed the turn to me: with souls my souls stand and 2 more come. */
export function myTurnStarts(state) {
  return state.souls ? beginTurn(state, 0) : state;
}
/** Room mode asks nobody who goes first: the host does. Souls: the second player starts with 1 soul (6.2.1.5). */
export function roomSetup(state, role) {
  if (state.first !== null) return state;
  if (!state.souls) return { ...state, first: role === 'host' ? 0 : 1 }; // no souls to deal, but who goes first is known
  const s = { ...state, turn: 1 };
  if (role === 'host') return { ...beginTurn({ ...s, first: 0 }, 0), active: 0 };
  return { ...s, first: 1, active: 1, seats: s.seats.map((x, i) => (i === 0 ? { ...x, soul: 1, up: 1 } : { ...x, soul: 0, up: 0 })) };
}
/** A new game inside a room: the host starts. */
export const roomActiveAfterReset = (role) => (role === 'host' ? 0 : 1);
