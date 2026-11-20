import test from 'node:test';
import assert from 'node:assert/strict';
import { clickPitch, CLICK_MS, CLICK_UP_HZ, CLICK_DOWN_HZ, click, unlockClicks } from '../js/click.js';
import { defaultState, cleanState } from '../js/state.js';

test('clicks: add and take away sound different, and short', () => {
  assert.equal(clickPitch(1), CLICK_UP_HZ);
  assert.equal(clickPitch(-500), CLICK_DOWN_HZ);
  assert.ok(CLICK_UP_HZ > CLICK_DOWN_HZ);
  assert.ok(CLICK_MS >= 40 && CLICK_MS <= 80);
});
test('clicks: harmless without Web Audio (node)', () => {
  unlockClicks();
  click(1);
});
test('clicks: on by default, a saved off stays off', () => {
  assert.equal(defaultState().clicks, true);
  assert.equal(cleanState({ v: 1 }).clicks, true);
  assert.equal(cleanState({ v: 1, clicks: false }).clicks, false);
});
