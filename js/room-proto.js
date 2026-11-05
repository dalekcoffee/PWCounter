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

export function helloMsg({ name, seat, souls }) {
  return JSON.stringify({ t: 'hello', v: 1, name: cleanName(name), seat: { life: seat.life, mat: seat.mat, ing: seat.ing, soul: seat.soul, up: seat.up }, souls: souls === true });
}
/** `active` is 0 (me) | 1 (you / the other phone), from the SENDER's side of the table. */
export function sharedMsg({ night, active, turn, rev }) {
  return JSON.stringify({ t: 'shared', night: night === true, active: active === 1 ? 'you' : 'me', turn, rev });
}

/** Validate anything received. Unknown or invalid = null. Shared messages are translated to OUR point of view. */
export function parseMessage(text) {
  if (typeof text !== 'string' || text.length > 4096) return null;
  let m;
  try { m = JSON.parse(text); } catch { return null; }
  if (!m || typeof m !== 'object' || Array.isArray(m)) return null;
  if (m.t === 'peer') return typeof m.here === 'boolean' ? { t: 'peer', here: m.here } : null;
  if (m.t === 'hello') {
    if (m.v !== 1) return null;
    const seat = cleanPeerSeat(m.seat);
    if (!seat || typeof m.souls !== 'boolean') return null;
    return { t: 'hello', name: cleanName(m.name), seat, souls: m.souls };
  }
  if (m.t === 'shared') {
    if (typeof m.night !== 'boolean' || (m.active !== 'me' && m.active !== 'you')) return null;
    if (!int(m.turn, 0, 9999) || !int(m.rev, 0, 1e9)) return null;
    // the sender's "me" is the other phone, i.e. 1 here
    return { t: 'shared', night: m.night, active: m.active === 'me' ? 1 : 0, turn: m.turn, rev: m.rev };
  }
  return null;
}

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
  if (!state.souls || state.first !== null) return state;
  const s = { ...state, turn: 1 };
  if (role === 'host') return { ...beginTurn({ ...s, first: 0 }, 0), active: 0 };
  return { ...s, first: 1, active: 1, seats: s.seats.map((x, i) => (i === 0 ? { ...x, soul: 1, up: 1 } : { ...x, soul: 0, up: 0 })) };
}
/** A new game inside a room: the host starts. */
export const roomActiveAfterReset = (role) => (role === 'host' ? 0 : 1);
