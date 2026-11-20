// Pal trackers (experimental): per player, five Pal slots in table order (left to right), each with an attack boost,
// damage and extra strike, and optionally the card it is (from card lookup; 0.4.2: with its printed power and strike, so
// the slot shows base + boost). Pure: every function returns a NEW state.
// Damage is removed at the end of every turn; boosts and strike stay until changed.

export const PAL_SLOTS = 5;
export const PAL_KEYS = ['atk', 'dmg', 'str'];
export const PAL_LIMITS = { atk: [0, 99900], dmg: [0, 99900], str: [0, 99] };
export const PAL_STEPS = [100, 200, 500, 1000]; // the quick buttons for attack boost and damage

export const freshPal = () => ({ atk: 0, dmg: 0, str: 0, card: null });
export const freshPals = () => [0, 1].map(() => Array.from({ length: PAL_SLOTS }, freshPal));
/** 0.4.6: the "All Pals" layer per player (attack boost, damage, strike added to every Pal; no card). */
export const freshAll = () => ({ atk: 0, dmg: 0, str: 0 });
export const freshPalAll = () => [freshAll(), freshAll()];
export const ALL = 'all'; // the slot index of the All Pals layer

const int = (n, [lo, hi]) => (Number.isInteger(n) && n >= lo && n <= hi ? n : 0);
const CODE = /^[A-Z0-9][A-Z0-9-]{2,23}$/;

/** A card picked for a slot: printing code, name and its printed power / strike (null when unknown); the text is looked up again when shown. */
export function cleanCard(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const code = typeof raw.code === 'string' ? raw.code.trim().toUpperCase() : '';
  if (!CODE.test(code)) return null;
  const name = typeof raw.name === 'string' ? [...raw.name.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim()].slice(0, 60).join('') : '';
  const base = (v, [lo, hi]) => (Number.isInteger(v) && v >= lo && v <= hi ? v : null);
  return { code, name: name || code, power: base(raw.power, PAL_LIMITS.atk), strike: base(raw.strike, PAL_LIMITS.str) };
}

/**
 * What a slot's counters show. all = the player's All Pals layer (added on top of the Pal's own values).
 * With a card's printed power / strike: printed + own + all; without: own + all boost alone (power / strike null).
 */
export function palTotals(p, all = freshAll()) {
  const power = p.card && p.card.power !== null && p.card.power !== undefined ? p.card.power : null;
  const strike = p.card && p.card.strike !== null && p.card.strike !== undefined ? p.card.strike : null;
  const boost = p.atk + all.atk, extra = p.str + all.str;
  return {
    power, strike, boost, extra,
    atk: power === null ? boost : power + boost,
    dmg: p.dmg + all.dmg,
    str: strike === null ? extra : strike + extra,
  };
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

/** Saved All Pals layers: two players, bad values back to 0. */
export function cleanPalAll(raw) {
  const seats = Array.isArray(raw) ? raw : [];
  return [0, 1].map((i) => {
    const a = freshAll(), r = seats[i];
    if (r && typeof r === 'object') for (const k of PAL_KEYS) a[k] = int(r[k], PAL_LIMITS[k]);
    return a;
  });
}

const okSeat = (seat) => seat === 0 || seat === 1;
const okCardSlot = (seat, i) => okSeat(seat) && Number.isInteger(i) && i >= 0 && i < PAL_SLOTS;
const okSlot = (seat, i) => okCardSlot(seat, i) || (okSeat(seat) && i === ALL);
/** One slot's values, or the player's All Pals layer for i = 'all'. */
export const palAt = (state, seat, i) => (i === ALL ? state.palAll[seat] : state.pals[seat][i]);
const withPal = (state, seat, i, patch) => (i === ALL
  ? { ...state, palAll: state.palAll.map((a, s) => (s === seat ? { ...a, ...patch } : a)) }
  : { ...state, pals: state.pals.map((row, s) => (s === seat ? row.map((p, n) => (n === i ? { ...p, ...patch } : p)) : row)) });

/** Change attack boost, damage or strike of one slot (or the All Pals layer, i = 'all') by delta, clamped (never below 0). */
export function palStep(state, seat, i, key, delta) {
  if (!okSlot(seat, i) || !PAL_LIMITS[key] || !Number.isFinite(delta)) return state;
  const cur = palAt(state, seat, i)[key];
  const [lo, hi] = PAL_LIMITS[key];
  const next = Math.min(hi, Math.max(lo, cur + delta));
  return next === cur ? state : withPal(state, seat, i, { [key]: next });
}

/** Which card sits in this slot (null clears it). */
export function palCard(state, seat, i, card) {
  if (!okCardSlot(seat, i)) return state;
  return withPal(state, seat, i, { card: card === null ? null : cleanCard(card) });
}

/** Quick reset: one counter back to 0 ('atk' boost, 'dmg', 'str' extra), or 'all' three; the card stays. */
export function palReset(state, seat, i, key) {
  if (!okSlot(seat, i)) return state;
  const keys = key === 'all' ? PAL_KEYS : PAL_KEYS.includes(key) ? [key] : [];
  const p = palAt(state, seat, i);
  if (!keys.some((k) => p[k])) return state;
  return withPal(state, seat, i, Object.fromEntries(keys.map((k) => [k, 0])));
}

/** The Pal left play: its slot is empty again (numbers and card). */
export function palClear(state, seat, i) {
  if (!okCardSlot(seat, i)) return state;
  return withPal(state, seat, i, freshPal());
}

/** End of a turn: every Pal's damage is removed (the All Pals layer's damage too). */
export function clearDamage(state) {
  const all = state.palAll || freshPalAll();
  if (!state.pals.some((row) => row.some((p) => p.dmg)) && !all.some((a) => a.dmg)) return state;
  return {
    ...state,
    pals: state.pals.map((row) => row.map((p) => (p.dmg ? { ...p, dmg: 0 } : p))),
    palAll: all.map((a) => (a.dmg ? { ...a, dmg: 0 } : a)),
  };
}

export const palEmpty = (p) => !p.atk && !p.dmg && !p.str && !p.card;

/** 1800 -> "1,800", for the tiles. */
export const palNum = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
