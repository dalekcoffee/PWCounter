import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollDie, flipCoin } from '../js/random.js';

test('a die lands on 1..6 and covers every face', () => {
  const seen = new Set();
  for (let i = 0; i < 2000; i++) {
    const n = rollDie(6);
    assert.ok(Number.isInteger(n) && n >= 1 && n <= 6);
    seen.add(n);
  }
  assert.equal(seen.size, 6);
});

test('values over the fair limit are re-drawn (no modulo bias)', () => {
  const draws = [0xffffffff, 7]; // the first is above floor(2^32/6)*6 and must be skipped
  assert.equal(rollDie(6, () => draws.shift()), 2);
});

test('coin', () => {
  assert.equal(flipCoin(() => 0), 'heads');
  assert.equal(flipCoin(() => 1), 'tails');
  const seen = new Set(Array.from({ length: 200 }, () => flipCoin()));
  assert.deepEqual([...seen].sort(), ['heads', 'tails']);
});
