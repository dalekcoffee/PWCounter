import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lifeTone, justLost, overWords } from '../js/life.js';

const rgb = (s) => s.match(/\d+/g).map(Number);

test('life 10 keeps the board colour, 0 is red, 20 and up are green', () => {
  assert.equal(lifeTone(10), 'rgb(255, 246, 226)');
  assert.equal(lifeTone(10, true), 'rgb(232, 236, 250)');
  assert.equal(lifeTone(0), 'rgb(255, 92, 92)');
  assert.equal(lifeTone(20), 'rgb(91, 227, 125)');
  assert.equal(lifeTone(99), lifeTone(20));
  assert.equal(lifeTone(-3), lifeTone(0));
});
test('the colour moves step by step: redder toward 0, greener toward 20', () => {
  for (let n = 1; n <= 10; n++) assert.ok(rgb(lifeTone(n - 1))[1] < rgb(lifeTone(n))[1], `green falls toward 0 at ${n}`);
  for (let n = 11; n <= 20; n++) assert.ok(rgb(lifeTone(n))[0] < rgb(lifeTone(n - 1))[0], `red falls toward 20 at ${n}`);
  const five = rgb(lifeTone(5));
  assert.ok(five[0] > five[1] && five[0] > five[2]); // halfway: clearly reddish
});
test('game over when a life reaches 0, once', () => {
  const s = (a, b) => ({ seats: [{ life: a }, { life: b }] });
  assert.deepEqual(justLost(s(1, 5), s(0, 5), 2), [0]);
  assert.deepEqual(justLost(s(3, 2), s(3, 0), 2), [1]);
  assert.deepEqual(justLost(s(0, 5), s(0, 5), 2), []); // already 0
  assert.deepEqual(justLost(s(5, 1), s(5, 0), 1), []); // one player: the top seat is not in play
  assert.deepEqual(justLost(s(1, 9), s(0, 9), 1), [0]);
  assert.equal(overWords(0, 0), 'You lose');
  assert.equal(overWords(1, 0), 'You win');
});
