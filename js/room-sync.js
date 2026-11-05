// After a rejoin the two phones compare what they have. Pure: which numbers differ, and what a choice does. No DOM.
export const SEAT_FIELDS = ['life', 'mat', 'ing', 'soul', 'up'];

/**
 * mine = my snapshot {mine: seat, peerSeat: seat | null, shared: {night, active 0|1, turn}};
 * theirs = their check, as parse gives it: {mine, yours, shared (active in MY view)}.
 * -> the list of differences, each {key, label}; empty = nothing to ask. A null remembered side is ignored.
 */
export function compareCheck(mine, theirs, { peerName = 'your friend', souls = true } = {}) {
  const out = [];
  const seatDiff = (a, b, who) => {
    for (const f of SEAT_FIELDS) {
      if ((f === 'soul' || f === 'up') && !souls) continue;
      if (a[f] !== b[f]) out.push({ key: `${who}.${f}`, label: `${who === 'me' ? 'Your' : `${peerName}'s`} ${FIELD_WORD[f]}` });
    }
  };
  if (mine.peerSeat) seatDiff(mine.peerSeat, theirs.mine, 'them'); // (a) what I last saw of them vs what they have now
  if (theirs.yours) seatDiff(mine.mine, theirs.yours, 'me'); // (b) what I have vs what they last saw of me
  if (mine.shared.night !== theirs.shared.night) out.push({ key: 'night', label: 'Day or night' });
  if (mine.shared.active !== theirs.shared.active) out.push({ key: 'active', label: 'Whose turn' });
  if (mine.shared.turn !== theirs.shared.turn) out.push({ key: 'turn', label: 'Turn number' });
  return out;
}
const FIELD_WORD = { life: 'Life', mat: 'Material', ing: 'Ingredient', soul: 'Souls', up: 'Souls standing' };

/**
 * The two cards of the "Your counters don't match" sheet, both from my point of view.
 * Each card: {title, you: seat, them: seat, shared}; `diff` = a Set of keys (same keys as compareCheck) that differ.
 */
export function syncCards(mine, theirs, peerName) {
  const seat = (s) => s || null;
  return {
    mine: { title: 'Your phone', you: mine.mine, them: seat(mine.peerSeat) || theirs.mine, shared: mine.shared },
    theirs: { title: `${peerName || 'Your friend'}'s phone`, you: seat(theirs.yours) || mine.mine, them: theirs.mine, shared: theirs.shared },
    diff: new Set(compareCheck(mine, theirs, { souls: true }).map((d) => d.key)),
  };
}

/**
 * Apply a choice to my state. use 'me' = my phone's counters win (nothing of mine changes);
 * use 'you' = the other phone's counters win: my seat becomes what THEY last saw of me, and the shared game follows them.
 */
export function applyPick(state, use, theirs) {
  if (use !== 'you') return state;
  const seat = theirs.yours ? { ...state.seats[0], ...theirs.yours } : state.seats[0];
  return { ...state, seats: [seat, state.seats[1]], night: theirs.shared.night, active: theirs.shared.active, turn: theirs.shared.turn };
}
