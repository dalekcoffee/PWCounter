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
export const LIMITS = { life: [0, 99999], mat: [0, 99], ing: [0, 99] }; // rule 3.2.1.1: life has no upper limit
export const COUNTERS = Object.keys(LIMITS);
export const LANDSCAPE = ['off', 'left', 'right'];
// Soul styles: every style is playable (something to read and something to tap); − / + for the total is always there.
//   numbers       the count; tap left to rest one, right to stand one
//   numbersCards  the same, with the cards drawn faintly behind (a visual only, cards are not tappable)
//   cardsTap      cards only; tap a card to rest or stand it
//   cardsSides    cards only; tap left to rest one, right to stand one
export const SOUL_STYLES = ['numbers', 'numbersCards', 'cardsTap', 'cardsSides'];
export const SOUL_STYLE_DEFAULT = 'numbersCards';
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
    players: 1, // a first visit opens in one-player mode
    landscape: 'off',
    flip: true,
    awake: true,
    autoFull: true, // installed app: go full screen on the first tap
    souls: false,
    soulStyle: SOUL_STYLE_DEFAULT, // one of SOUL_STYLES (styles with cards need one player; two players see numbers)
    iconsOnly: false, // experimental: icons without the words Life / Material / Ingredient, bigger
    name: '', // your username (a setting): shown on your board and to a friend in a room
    rooms: false, // experimental, off by default: play with a friend online (not ready)
    savedAt: 0, // when this (the one saved) game was last saved, ms
  };
}

export const NAME_MAX = 24;
/** A username: text only, control characters removed, spaces collapsed, trimmed, at most 24 characters. */
export function cleanName(raw) {
  if (typeof raw !== 'string') return '';
  const t = raw.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, ' ').replace(/\s+/g, ' ').trim();
  return [...t].slice(0, NAME_MAX).join('').trim();
}

/** The soul style (default: numbers on cards); a game saved before 0.1.5 (soulView + soulTap) keeps what it looked like. */
export function cleanSoulStyle(raw) {
  if (SOUL_STYLES.includes(raw?.soulStyle)) return raw.soulStyle;
  if (raw?.soulView === 'cards') return raw.soulTap === 'halves' ? 'cardsSides' : 'cardsTap';
  if (raw?.soulView === 'number') return 'numbers';
  return SOUL_STYLE_DEFAULT;
}

/** What the soul tile shows and how it is tapped. The card-only styles need the one-player layout: with two players
 *  they show as Numbers on cards (the count with the cards faint behind it), Numbers stays Numbers. */
export function soulDisplay(style, onePlayer) {
  const known = SOUL_STYLES.includes(style) ? style : 'numbers';
  const s = onePlayer || known === 'numbers' ? known : 'numbersCards';
  return {
    style: s,
    number: s === 'numbers' || s === 'numbersCards',
    cards: s !== 'numbers',
    tapCards: s === 'cardsTap', // else the left / right halves rest and stand
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
    players: raw.players === 2 ? 2 : 1,
    landscape: LANDSCAPE.includes(raw.landscape) ? raw.landscape : 'off',
    flip: raw.flip !== false,
    awake: raw.awake !== false,
    autoFull: raw.autoFull !== false,
    souls: raw.souls === true,
    soulStyle: cleanSoulStyle(raw),
    iconsOnly: raw.iconsOnly === true,
    name: cleanName(raw.name),
    rooms: raw.rooms === true,
    savedAt: Number.isFinite(raw.savedAt) && raw.savedAt > 0 ? Math.floor(raw.savedAt) : 0,
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

export const RESUME_AFTER_MS = 48 * 60 * 60 * 1000;

/** Is the game still at its starting values? (nothing to resume) */
export function isFreshGame(state) {
  const fresh = (s) => s.life === START_LIFE && s.mat === 0 && s.ing === 0 && s.soul === 0 && s.up === 0;
  return state.seats.every(fresh) && !state.night && state.turn <= 1 && state.first === null;
}

/** Opening the app: ask "continue or new game?" when the one saved game was last played over 48 hours ago. */
export function needsResume(state, now) {
  return state.savedAt > 0 && now - state.savedAt > RESUME_AFTER_MS && !isFreshGame(state);
}

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
