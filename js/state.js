// Pure game state: no DOM, no storage. Every function returns a NEW object.
// Seat 0 = you (bottom), seat 1 = the opponent (top, shown only with 2 players).
//
// Souls follow the official Comprehensive Rules (v1.01, 2026-11-02), tracked as numbers (13.2):
//   6.1.2.1  at most 10 souls each
//   6.2.1.5  the player going second starts with 1 soul in the soul area
//   7.2.1    at the start of your turn every soul stands again
//   7.4.2.1  the soul phase adds 2 souls (also on the first player's first turn)
//   10.4.3   paying souls = turning standing souls to rested

export const START_LIFE = 10;
export const LIMITS = { life: [0, 999], mat: [0, 99], ing: [0, 99] };
export const COUNTERS = Object.keys(LIMITS);
export const LANDSCAPE = ['off', 'left', 'right'];
export const SOUL_VIEWS = ['number', 'cards'];
export const SOUL_MAX = 10;
export const SOUL_GAIN = 2;
export const SECOND_START = 1;

// soul = souls in the soul area, up = how many of them are standing (0..soul)
export const freshSeat = () => ({ life: START_LIFE, mat: 0, ing: 0, soul: 0, up: 0 });

export function defaultState() {
  return {
    v: 1,
    // the game
    seats: [freshSeat(), freshSeat()],
    night: false,
    turn: 1,
    active: 0,
    first: null, // souls only: who went first (seat 0 | 1, one player: 0 = I went first, 1 = I went second); null = not chosen yet
    // settings (kept by a reset)
    players: 2,
    landscape: 'off',
    flip: true,
    awake: true,
    souls: false, // experimental
    soulView: 'number', // experimental, one player only: 'number' | 'cards'
    iconsOnly: false, // experimental: icons without the words Life / Material / Ingredient, bigger
  };
}

const int = (n, lo, hi, dflt) => (Number.isInteger(n) && n >= lo && n <= hi ? n : dflt);

function cleanSeat(raw) {
  const s = freshSeat();
  if (!raw || typeof raw !== 'object') return s;
  for (const k of COUNTERS) s[k] = int(raw[k], LIMITS[k][0], LIMITS[k][1], s[k]);
  s.soul = int(raw.soul, 0, SOUL_MAX, 0);
  s.up = int(raw.up, 0, s.soul, 0);
  return s;
}

/** Anything read from storage goes through here: unknown or bad fields fall back to the defaults. */
export function cleanState(raw) {
  const d = defaultState();
  if (!raw || typeof raw !== 'object' || raw.v !== 1) return d;
  const seats = Array.isArray(raw.seats) ? raw.seats : [];
  return {
    v: 1,
    seats: [cleanSeat(seats[0]), cleanSeat(seats[1])],
    night: raw.night === true,
    turn: int(raw.turn, 0, 9999, 1),
    active: raw.active === 1 ? 1 : 0,
    first: raw.first === 0 || raw.first === 1 ? raw.first : null,
    players: raw.players === 1 ? 1 : 2,
    landscape: LANDSCAPE.includes(raw.landscape) ? raw.landscape : 'off',
    flip: raw.flip !== false,
    awake: raw.awake !== false,
    souls: raw.souls === true,
    soulView: SOUL_VIEWS.includes(raw.soulView) ? raw.soulView : 'number',
    iconsOnly: raw.iconsOnly === true,
  };
}

const clamp = (n, [lo, hi]) => Math.min(hi, Math.max(lo, n));
const withSeat = (state, seat, patch) => ({ ...state, seats: state.seats.map((s, i) => (i === seat ? { ...s, ...patch } : s)) });

/** Change one counter by delta, clamped to its limits. */
export function step(state, seat, key, delta) {
  if (!LIMITS[key] || (seat !== 0 && seat !== 1)) return state;
  const cur = state.seats[seat][key];
  const next = clamp(cur + delta, LIMITS[key]);
  if (next === cur) return state;
  return withSeat(state, seat, { [key]: next });
}

/** The start of a seat's turn: every soul stands (7.2.1), then the soul phase adds 2, never above 10 (7.4.2). */
export function beginTurn(state, seat) {
  const s = state.seats[seat];
  const soul = Math.min(SOUL_MAX, s.soul + SOUL_GAIN);
  return withSeat(state, seat, { soul, up: soul });
}

/** Does the game still need to know who goes first? (only while souls are tracked) */
export const needsFirst = (state) => state.souls && state.first === null;

/**
 * Who goes first. Two players: `seat` is the seat going first (0 bottom, 1 top).
 * One player: `seat` 0 = I go first, 1 = I go second.
 * The second player starts with 1 soul (6.2.1.5); the first player's first turn begins at once.
 * One player going second: 1 soul now, the first turn begins with "Start my turn".
 */
export function chooseFirst(state, seat) {
  if (seat !== 0 && seat !== 1) return state;
  // only the souls and the turn start over: life and resources stay (souls can be switched on mid-game)
  let s = { ...state, first: seat, seats: state.seats.map((x) => ({ ...x, soul: 0, up: 0 })) };
  if (s.players === 1) {
    if (seat === 0) return { ...beginTurn(s, 0), turn: 1, active: 0 };
    return { ...withSeat(s, 0, { soul: SECOND_START, up: SECOND_START }), turn: 0, active: 0 };
  }
  s = withSeat(s, 1 - seat, { soul: SECOND_START, up: SECOND_START });
  return { ...beginTurn(s, seat), active: seat, turn: 1 };
}

/**
 * One player: the next of your turns begins (with souls: they stand and 2 more come).
 * Two players: play passes; a full round (back to whoever went first) counts one turn.
 */
export function endTurn(state) {
  if (state.players === 1) {
    const next = { ...state, active: 0, turn: Math.min(9999, state.turn + 1) };
    return state.souls ? beginTurn(next, 0) : next;
  }
  const active = state.active === 0 ? 1 : 0;
  const first = state.souls && state.first !== null ? state.first : 0;
  const turn = active === first ? Math.min(9999, state.turn + 1) : state.turn;
  const next = { ...state, active, turn };
  return state.souls ? beginTurn(next, active) : next;
}

/** Rest (d < 0, paying) or stand (d > 0) souls. */
export function restSoul(state, seat, d) {
  if (seat !== 0 && seat !== 1) return state;
  const s = state.seats[seat];
  const up = clamp(s.up + d, [0, s.soul]);
  return up === s.up ? state : withSeat(state, seat, { up });
}

/** Add (standing) or remove souls; removing takes rested ones first. */
export function addSoul(state, seat, d) {
  if (seat !== 0 && seat !== 1) return state;
  const s = state.seats[seat];
  const soul = clamp(s.soul + d, [0, SOUL_MAX]);
  if (soul === s.soul) return state;
  const up = d > 0 ? s.up + (soul - s.soul) : Math.min(s.up, soul);
  return withSeat(state, seat, { soul, up });
}

/** Cards view: tap soul number i (0-based): a standing one rests, a rested one stands. */
export function toggleSoul(state, seat, i) {
  const s = state.seats[seat];
  if (!s || !Number.isInteger(i) || i < 0 || i >= s.soul) return state;
  // standing souls are drawn first, so index < up is a standing one
  return restSoul(state, seat, i < s.up ? -1 : 1);
}

export const toggleNight = (state) => ({ ...state, night: !state.night });

/** A new game: every counter back to its start, day, turn 1, who goes first asked again. Settings are kept. */
export function resetGame(state) {
  return { ...state, seats: [freshSeat(), freshSeat()], night: false, turn: 1, active: 0, first: null };
}

/** Change a setting, cleaned. Changing players or switching souls on starts the soul set-up again. */
export function setSetting(state, key, value) {
  let next = cleanState({ ...state, [key]: value });
  if (key === 'players' && next.players !== state.players) next = { ...next, active: 0, first: null };
  if (key === 'souls' && next.souls && !state.souls) next = { ...next, first: null };
  return next;
}
