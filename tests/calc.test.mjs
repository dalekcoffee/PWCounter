import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as c from '../js/calc.js';

const type = (keys) => keys.reduce((t, k) => {
  if (/^\d+$/.test(k)) return c.pressDigit(t, k);
  if (k === '<') return c.backspace(t);
  if (k === '=') return c.equals(t);
  if (/^[+-]\d+$/.test(k) && k.length > 1) return c.shortcut(t, Number(k));
  return c.pressOp(t, k);
}, []);

test('× and ÷ before + and −', () => {
  assert.equal(c.evaluate(type(['2', '+', '3', '×', '4'])), 14);
  assert.equal(c.evaluate(type(['1', '0', '-', '6', '÷', '3', '+', '1'])), 9);
  assert.equal(c.evaluate(type(['8', '÷', '2', '×', '3'])), 12);
});

test('digits, 00, leading zero and backspace', () => {
  assert.deepEqual(type(['0', '0', '5']), ['5']);
  assert.deepEqual(type(['00']), ['0']);
  assert.deepEqual(type(['1', '00']), ['100']);
  assert.deepEqual(type(['1', '2', '<']), ['1']);
  assert.deepEqual(type(['1', '+', '<']), ['1']);
  assert.deepEqual(c.backspace([]), []);
});

test('an operator replaces the one before it; a trailing one is ignored', () => {
  assert.deepEqual(type(['5', '+', '×']), ['5', '×']);
  assert.equal(c.evaluate(type(['5', '+'])), 5);
  assert.deepEqual(type(['+']), ['0', '+']);
  assert.equal(c.evaluate([]), null);
});

test('shortcuts add or take away', () => {
  assert.deepEqual(c.shortcut([], 100), ['100']);
  assert.deepEqual(c.shortcut([], -500), ['0', '-', '500']);
  assert.equal(c.evaluate(type(['+1000', '+300', '-500'])), 800);
  assert.deepEqual(type(['2', '×', '+100']), ['2', '+', '100']);
  assert.equal(c.evaluate(type(['3', '×', '2', '+500'])), 506);
});

test('division by zero is an error, equals collapses the sum', () => {
  assert.ok(Number.isNaN(c.evaluate(type(['4', '÷', '0']))));
  assert.equal(c.formatNumber(NaN), 'Error');
  assert.deepEqual(c.equals(type(['4', '÷', '0'])), ['4', '÷', '0']);
  assert.deepEqual(c.equals(type(['1', '0', '0', '0', '+', '5', '0', '0'])), ['1500']);
  assert.deepEqual(c.equals(type(['3', '-', '1', '0'])), ['0', '-', '7']);
  assert.deepEqual(c.equals(type(['1', '0', '÷', '4'])), ['2.5']);
});

test('formatting', () => {
  assert.equal(c.formatNumber(null), '0');
  assert.equal(c.formatNumber(1500), '1,500');
  assert.equal(c.formatNumber(10 / 3), '3.33');
  assert.equal(c.exprText(['1000', '-', '5']), '1,000 − 5');
});

test('long numbers are capped', () => {
  const t = type(Array(15).fill('9'));
  assert.equal(t[0].length, 9);
});
