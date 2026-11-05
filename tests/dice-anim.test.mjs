import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dieTarget, coinTarget, turnTo, DIE_SHOW } from '../js/dice-anim.js';

const norm = (a) => ((a % 360) + 360) % 360;
test('every roll lands on its face and turns forward', () => {
  let cur = [0, 0];
  for (const n of [4, 4, 1, 6, 2, 3, 5, 6, 1]) {
    const t = dieTarget(cur, n);
    assert.equal(norm(t[0]), norm(DIE_SHOW[n][0]));
    assert.equal(norm(t[1]), norm(DIE_SHOW[n][1]));
    assert.ok(t[0] >= cur[0] + 720 && t[1] >= cur[1] + 1080);
    cur = t;
  }
});
test('coin lands heads or tails after at least 4 turns', () => {
  let c = 0;
  for (const side of ['heads', 'tails', 'tails', 'heads']) {
    const t = coinTarget(c, side);
    assert.equal(norm(t), side === 'heads' ? 0 : 180);
    assert.ok(t >= c + 1440);
    c = t;
  }
  assert.equal(turnTo(-30, 0, 1), 360);
});
