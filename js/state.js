// Pure game state: no DOM, no storage. Every function returns a NEW object.
// Seat 0 = you (bottom), seat 1 = the opponent (top, shown only with 2 players).

export const START_LIFE = 10;
export const LIMITS = { life: [0, 999], mat: [0, 99], ing: [0, 99] };
export const COUNTERS = Object.keys(LIMITS);
export const LANDSCAPE = ['off', 'left', 'right'];

export const freshSeat = () => ({ life: START_LIFE, mat: 0, ing: 0 });

export function defaultState() {
  return {
    v: 1,
    // the game
    seats: [freshSeat(), freshSeat()],
    night: false,
    turn: 1,
    active: 0,
    // settings (kept by a reset)
    players: 2,
    landscape: 'off',
    flip: true,
    awake: true,
  };
}

const int = (n, lo, hi, dflt) => (Number.isInteger(n) && n >= lo && n <= hi ? n : dflt);

function cleanSeat(raw) {
  const s = freshSeat();
  if (!raw || typeof raw !== 'object') return s;
  for (const k of COUNTERS) s[k] = int(raw[k], LIMITS[k][0], LIMITS[k][1], s[k]);
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
    turn: int(raw.turn, 1, 9999, 1),
    active: raw.active === 1 ? 1 : 0,
    players: raw.players === 1 ? 1 : 2,
    landscape: LANDSCAPE.includes(raw.landscape) ? raw.landscape : 'off',
    flip: raw.flip !== false,
    awake: raw.awake !== false,
  };
}

const clamp = (n, [lo, hi]) => Math.min(hi, Math.max(lo, n));

/** Change one counter by delta, clamped to its limits. */
export function step(state, seat, key, delta) {
  if (!LIMITS[key] || (seat !== 0 && seat !== 1)) return state;
  const cur = state.seats[seat][key];
  const next = clamp(cur + delta, LIMITS[key]);
  if (next === cur) return state;
  const seats = state.seats.map((s, i) => (i === seat ? { ...s, [key]: next } : s));
  return { ...state, seats };
}

/** One player: the turn count goes up. Two: play passes; a full round (back to seat 0) counts one turn. */
export function endTurn(state) {
  if (state.players === 1) return { ...state, active: 0, turn: Math.min(9999, state.turn + 1) };
  const active = state.active === 0 ? 1 : 0;
  const turn = active === 0 ? Math.min(9999, state.turn + 1) : state.turn;
  return { ...state, active, turn };
}

export const toggleNight = (state) => ({ ...state, night: !state.night });

/** A new game: every counter back to its start, day, turn 1. Settings are kept. */
export function resetGame(state) {
  return { ...state, seats: [freshSeat(), freshSeat()], night: false, turn: 1, active: 0 };
}

/** Change a setting, cleaned. */
export function setSetting(state, key, value) {
  const next = cleanState({ ...state, [key]: value });
  if (key === 'players' && next.players === 1) next.active = 0;
  return next;
}
