import { test } from 'node:test';
import assert from 'node:assert/strict';
import { otherCall, callsFor, outcomeOf, winnerOf, resultLine, soloResultLine, firstSeat, clockText } from '../js/first-pick.js';

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
test('whoever called what came up wins the toss, and there is always one winner', () => {
  for (const seat of [0, 1]) for (const call of ['high', 'low']) for (let n = 1; n <= 6; n++) {
    const calls = callsFor('die', seat, call);
    const w = winnerOf(calls, outcomeOf('die', n));
    assert.ok(w === 0 || w === 1);
    assert.equal(calls[w], outcomeOf('die', n));
  }
  assert.equal(resultLine('die', 5, 1), 'Rolled 5: high. Player 2 wins.');
  assert.equal(resultLine('coin', 'heads', 0), 'Heads. Player 1 wins.');
});
test('one player: the result names you or your opponent', () => {
  assert.equal(soloResultLine('die', 2, 0), 'Rolled 2: low. You win.');
  assert.equal(soloResultLine('coin', 'tails', 1), 'Tails. Your opponent wins.');
});
test('the toss winner chooses to go first or second', () => {
  assert.equal(firstSeat(0, 'first'), 0);
  assert.equal(firstSeat(0, 'second'), 1);
  assert.equal(firstSeat(1, 'first'), 1);
  assert.equal(firstSeat(1, 'second'), 0);
  assert.equal(firstSeat(2, 'first'), null);
  assert.equal(firstSeat(0, 'last'), null);
});
test('the turn clock reads m:ss, then h:mm:ss', () => {
  assert.equal(clockText(0), '0:00');
  assert.equal(clockText(9999), '0:09');
  assert.equal(clockText(754000), '12:34');
  assert.equal(clockText(3723000), '1:02:03');
  assert.equal(clockText(-5), '0:00');
});
