// Who goes first with two players on one screen (pure, tested). Player 1 sits at the bottom (seat 0), Player 2 at the
// top (seat 1). Either a player taps their own big button, or they settle it with a die (high / low) or a coin
// (heads / tails): one player calls, the other gets the other call, and whoever's call comes up goes first.

export const SEAT_NAME = ['Player 1', 'Player 2'];
export const CALLS = { die: ['high', 'low'], coin: ['heads', 'tails'] };
export const CALL_WORD = { high: 'High', low: 'Low', heads: 'Heads', tails: 'Tails' };
export const CALL_HINT = { high: '4, 5 or 6', low: '1, 2 or 3', heads: '', tails: '' };

/** The other call of the same kind, or null. */
export function otherCall(kind, call) {
  const pair = CALLS[kind];
  if (!pair || !pair.includes(call)) return null;
  return pair[0] === call ? pair[1] : pair[0];
}

/** One seat calls; the other seat gets the other call. -> [seat 0's call, seat 1's call] or null. */
export function callsFor(kind, seat, call) {
  const other = otherCall(kind, call);
  if (!other || (seat !== 0 && seat !== 1)) return null;
  return seat === 0 ? [call, other] : [other, call];
}

/** What came up: a die 1-3 is low, 4-6 high; a coin is its side. */
export function outcomeOf(kind, value) {
  if (kind === 'die') return Number.isInteger(value) && value >= 1 && value <= 6 ? (value >= 4 ? 'high' : 'low') : null;
  if (kind === 'coin') return value === 'heads' || value === 'tails' ? value : null;
  return null;
}

/** The seat whose call came up (it goes first), or null. */
export function winnerOf(calls, outcome) {
  if (!calls || !outcome) return null;
  if (calls[0] === outcome) return 0;
  if (calls[1] === outcome) return 1;
  return null;
}

/** The words after the throw, e.g. "Rolled 5: high. Player 2 goes first." */
export function resultLine(kind, value, winner) {
  const what = kind === 'die' ? `Rolled ${value}: ${outcomeOf(kind, value)}.` : `${CALL_WORD[value]}.`;
  return `${what} ${SEAT_NAME[winner]} goes first.`;
}

/** A turn's length as m:ss (h:mm:ss from an hour). */
export function clockText(ms) {
  const t = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
