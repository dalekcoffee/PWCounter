// Pal trackers (experimental): per player, five Pal slots in table order (left to right), each with an attack boost,
// damage and extra strike, and optionally the card it is (from card lookup). Pure: every function returns a NEW state.
// Damage is removed at the end of every turn; boosts and strike stay until changed.

export const PAL_SLOTS = 5;
export const PAL_KEYS = ['atk', 'dmg', 'str'];
export const PAL_LIMITS = { atk: [0, 99900], dmg: [0, 99900], str: [0, 99] };
export const PAL_STEPS = [100, 200, 500, 1000]; // the quick buttons for attack boost and damage

export const freshPal = () => ({ atk: 0, dmg: 0, str: 0, card: null });
export const freshPals = () => [0, 1].map(() => Array.from({ length: PAL_SLOTS }, freshPal));

const int = (n, [lo, hi]) => (Number.isInteger(n) && n >= lo && n <= hi ? n : 0);
const CODE = /^[A-Z0-9][A-Z0-9-]{2,23}$/;

/** A card picked for a slot: its printing code and name only (the text is looked up again when shown). */
export function cleanCard(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const code = typeof raw.code === 'string' ? raw.code.trim().toUpperCase() : '';
  if (!CODE.test(code)) return null;
  const name = typeof raw.name === 'string' ? [...raw.name.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim()].slice(0, 60).join('') : '';
  return { code, name: name || code };
}

function cleanPal(raw) {
  const p = freshPal();
  if (!raw || typeof raw !== 'object') return p;
  for (const k of PAL_KEYS) p[k] = int(raw[k], PAL_LIMITS[k]);
  p.card = cleanCard(raw.card);
  return p;
}

/** Anything read from storage: two players, five slots each, bad values back to 0. */
export function cleanPals(raw) {
  const seats = Array.isArray(raw) ? raw : [];
  return [0, 1].map((i) => {
    const slots = Array.isArray(seats[i]) ? seats[i] : [];
    return Array.from({ length: PAL_SLOTS }, (_, n) => cleanPal(slots[n]));
  });
}

const okSlot = (seat, i) => (seat === 0 || seat === 1) && Number.isInteger(i) && i >= 0 && i < PAL_SLOTS;
const withPal = (state, seat, i, patch) => ({
  ...state,
  pals: state.pals.map((row, s) => (s === seat ? row.map((p, n) => (n === i ? { ...p, ...patch } : p)) : row)),
});

/** Change attack boost, damage or strike of one slot by delta, clamped (never below 0). */
export function palStep(state, seat, i, key, delta) {
  if (!okSlot(seat, i) || !PAL_LIMITS[key] || !Number.isFinite(delta)) return state;
  const cur = state.pals[seat][i][key];
  const [lo, hi] = PAL_LIMITS[key];
  const next = Math.min(hi, Math.max(lo, cur + delta));
  return next === cur ? state : withPal(state, seat, i, { [key]: next });
}

/** Which card sits in this slot (null clears it). */
export function palCard(state, seat, i, card) {
  if (!okSlot(seat, i)) return state;
  return withPal(state, seat, i, { card: card === null ? null : cleanCard(card) });
}

/** The Pal left play: its slot is empty again (numbers and card). */
export function palClear(state, seat, i) {
  if (!okSlot(seat, i)) return state;
  return withPal(state, seat, i, freshPal());
}

/** End of a turn: every Pal's damage is removed. */
export function clearDamage(state) {
  if (!state.pals.some((row) => row.some((p) => p.dmg))) return state;
  return { ...state, pals: state.pals.map((row) => row.map((p) => (p.dmg ? { ...p, dmg: 0 } : p))) };
}

export const palEmpty = (p) => !p.atk && !p.dmg && !p.str && !p.card;

/** 1800 -> "1,800", for the tiles. */
export const palNum = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
