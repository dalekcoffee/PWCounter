// Life: its colour and the end of the game (pure, tested).
import { START_LIFE } from './state.js';

const RED = [255, 92, 92];
const GREEN = [91, 227, 125];
const BASE = { day: [255, 246, 226], night: [232, 236, 250] }; // the board's number colour (--num)
const FULL_GREEN = START_LIFE * 2; // 20 and up: fully green

/**
 * The colour of a life number: the board's usual (near white) colour at 10, turning red toward 0 and green toward 20
 * (and staying green above it). -> 'rgb(r, g, b)'
 */
export function lifeTone(life, night = false) {
  const base = night ? BASE.night : BASE.day;
  const n = Number.isFinite(life) ? life : START_LIFE;
  const [to, k] = n < START_LIFE
    ? [RED, Math.min(1, (START_LIFE - Math.max(0, n)) / START_LIFE)]
    : [GREEN, Math.min(1, (n - START_LIFE) / (FULL_GREEN - START_LIFE))];
  const c = base.map((b, i) => Math.round(b + (to[i] - b) * k));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/** The seats whose life just reached 0 (it was above 0 before). */
export function justLost(prev, next, players) {
  const out = [];
  for (let i = 0; i < (players === 2 ? 2 : 1); i++) {
    if (prev.seats[i].life > 0 && next.seats[i].life === 0) out.push(i);
  }
  return out;
}

/** What each side reads when a seat's life reaches 0: two players, the other side wins; one player, you lose. */
export const overWords = (seat, loser) => (seat === loser ? 'You lose' : 'You win');
