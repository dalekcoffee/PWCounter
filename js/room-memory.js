// The last room, remembered on this phone (localStorage `pwc.room`) so a game can be rejoined later. Pure rules, no DOM.
// It holds only the code, the role, this phone's id, the other player's name and when it was last used: never any counters.
import { cleanName, RESUME_AFTER_MS } from './state.js';
import { validCode, cleanPeerSeat, cleanShared } from './room-proto.js';

export const ROOM_KEY = 'pwc.room';
export const SID_RE = /^[A-Za-z0-9]{1,32}$/;

/** Anything read back (a JSON string or an object) -> a clean record, or null when it is bad or over 48 hours old. */
export function rememberedRoom(raw, now) {
  let v = raw;
  if (typeof raw === 'string') { try { v = JSON.parse(raw); } catch { return null; } }
  if (!v || typeof v !== 'object' || v.v !== 1) return null;
  if (!validCode(v.code) || (v.role !== 'host' && v.role !== 'guest') || typeof v.sid !== 'string' || !SID_RE.test(v.sid)) return null;
  if (!Number.isFinite(v.at) || v.at <= 0 || now - v.at > RESUME_AFTER_MS) return null;
  return { v: 1, code: v.code, role: v.role, sid: v.sid, peerName: cleanName(v.peerName), at: v.at, peerSeat: cleanPeerSeat(v.peerSeat), shared: cleanShared(v.shared) };
}
export const roomRecord = ({ code, role, sid, peerName, at, peerSeat = null, shared = null }) => ({ v: 1, code, role, sid, peerName: cleanName(peerName), at, peerSeat: cleanPeerSeat(peerSeat), shared: cleanShared(shared) });
export const rejoinLine = (rec) => `Room ${rec.code} with ${rec.peerName || 'your friend'}`;
