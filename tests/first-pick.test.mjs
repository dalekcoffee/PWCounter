import { test } from 'node:test';
import assert from 'node:assert/strict';
import { otherCall, callsFor, outcomeOf, winnerOf, resultLine, clockText } from '../js/first-pick.js';

test('one call gives the other player the other call', () => {
  assert.equal(otherCall('die', 'high'), 'low');
  assert.equal(otherCall('coin', 'tails'), 'heads');
  assert.equal(otherCall('die', 'heads'), null);
  assert.deepEqual(callsFor('die', 1, 'low'), ['high', 'low']);
  assert.deepEqual(callsFor('coin', 0, 'heads'), ['heads', 'tails']);
  assert.equal(callsFor('coin', 2, 'heads'), null);
});
test('a die is low on 1-3 and high on 4-6; a coin is its side', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((n) => outcomeOf('die', n)), ['low', 'low', 'low', 'high', 'high', 'high']);
  assert.equal(outcomeOf('die', 7), null);
  assert.equal(outcomeOf('coin', 'tails'), 'tails');
});
test('whoever called what came up goes first, and there is always one winner', () => {
  for (const seat of [0, 1]) for (const call of ['high', 'low']) for (let n = 1; n <= 6; n++) {
    const calls = callsFor('die', seat, call);
    const w = winnerOf(calls, outcomeOf('die', n));
    assert.ok(w === 0 || w === 1);
    assert.equal(calls[w], outcomeOf('die', n));
  }
  assert.equal(resultLine('die', 5, 1), 'Rolled 5: high. Player 2 goes first.');
  assert.equal(resultLine('coin', 'heads', 0), 'Heads. Player 1 goes first.');
});
test('the turn clock reads m:ss, then h:mm:ss', () => {
  assert.equal(clockText(0), '0:00');
  assert.equal(clockText(9999), '0:09');
  assert.equal(clockText(754000), '12:34');
  assert.equal(clockText(3723000), '1:02:03');
  assert.equal(clockText(-5), '0:00');
});
