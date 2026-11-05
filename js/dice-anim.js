// Pure maths for the 3D die and coin: which rotation shows a face, and a longer way round to get there. No DOM.
// Die faces: 1 front, 2 right, 3 top, 4 bottom, 5 left, 6 back (opposites add to 7). The cube is turned with rotateX(x) rotateY(y).
export const DIE_SHOW = { 1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180] };
export const COIN_SHOW = { heads: 0, tails: 180 };

/** The next angle that is equivalent to `target` (mod 360) and at least `turns` full turns beyond `cur`. */
export const turnTo = (cur, target, turns) => {
  const base = ((target % 360) + 360) % 360;
  let a = cur - (((cur % 360) + 360) % 360) + base; // same turn as cur, the target angle
  while (a < cur + turns * 360) a += 360;
  return a;
};
/** Die: from the current [x, y] to the rotation that shows `n`, tumbling `turns` times on each axis. */
export function dieTarget(cur, n, turns = [2, 3]) {
  const [tx, ty] = DIE_SHOW[n];
  return [turnTo(cur[0], tx, turns[0]), turnTo(cur[1], ty, turns[1])];
}
/** Coin: rotateX to land on heads (0) or tails (180) after `flips` full turns. */
export const coinTarget = (cur, side, flips = 4) => turnTo(cur, COIN_SHOW[side], flips);
