// Pure rules for playing in a room: how the shared game state and my seat map onto the game state. No DOM, no network.
import { needsFirst } from './state.js';
import { roomSetup, roomActiveAfterReset, myTurnStarts } from './room-proto.js';

/** What the two phones share: day/night, whose turn (0 me | 1 the other phone), the turn number. */
export const sharedOf = (s) => ({ night: s.night, active: s.active, turn: s.turn });
export const sharedDiffers = (a, b) => a.night !== b.night || a.active !== b.active || a.turn !== b.turn;

/** What the other phone is told about me. */
export const selfOf = (s) => ({ name: s.name, seat: s.seats[0], souls: s.souls });
export function selfDiffers(a, b) {
  const x = a.seats[0], y = b.seats[0];
  return a.name !== b.name || a.souls !== b.souls || x.life !== y.life || x.mat !== y.mat || x.ing !== y.ing || x.soul !== y.soul || x.up !== y.up;
}

/** Entering a room: the host starts (turn 1), the guest waits; the shared values then follow the host. */
export function startRoomGame(state, role) {
  return { ...roomSetup({ ...state, turn: 1 }, role), active: roomActiveAfterReset(role) };
}
/** After a new game in a room (the host starts). */
export const afterRoomReset = (state, role) => ({ ...roomSetup({ ...state, active: roomActiveAfterReset(role) }, role) });
/** Leaving: the game is mine again. */
export const leaveRoomState = (state) => (state.active === 0 ? state : { ...state, active: 0 });

/** A room never asks "who goes first": the set-up follows the roles. */
export const settleRoom = (state, role) => (needsFirst(state) ? roomSetup(state, role) : state);

/** The other phone's day/night / turn arrives. When the turn comes to me, my souls stand and 2 come (if tracked). */
export function applyShared(state, sh) {
  if (state.night === sh.night && state.active === sh.active && state.turn === sh.turn) return state;
  let next = { ...state, night: sh.night, active: sh.active, turn: sh.turn };
  if (state.active === 1 && sh.active === 0) next = myTurnStarts(next);
  return next;
}

export const STATUS_TEXT = {
  connecting: 'Connecting…',
  waiting: 'Waiting for your friend…',
  connected: 'Connected',
  reconnecting: 'Reconnecting…',
  full: 'That game already has two players.',
  busy: "Couldn't get a free code, try again.",
};
/** One line for the status: "Connected to NAME" once the friend's hello is in. */
export function statusText(room) {
  if (room.status === 'connected') return room.peer ? `Connected to ${room.peer.name || 'your friend'}` : 'Connected';
  return STATUS_TEXT[room.status] || '';
}

/** What the opponent drawer's handle shows. */
export function handleView(room) {
  const here = room.status === 'connected' && !!room.peer;
  if (here) return { here: true, name: room.peer.name || 'Opponent', life: room.peer.seat.life, text: '' };
  const w = room.status === 'reconnecting' ? 'Reconnecting…' : `Waiting for ${room.peerName || 'your friend'}…`;
  return { here: false, name: '', life: null, text: `${w} ${room.code}` };
}

/** Turn words for the bar. */
export const turnText = (state) => `Turn ${state.turn} · ${state.active === 0 ? 'You' : 'Them'}`;
export const turnWords = (state) => `Turn ${state.turn}, ${state.active === 0 ? 'your turn' : "your friend's turn"}`;
