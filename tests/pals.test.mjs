import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultState, cleanState, endTurn, resetGame, isFreshGame, setSetting } from '../js/state.js';
import { PAL_SLOTS, palStep, palCard, palClear, clearDamage, cleanPals, cleanCard, palNum, palTotals } from '../js/pals.js';

const on = () => setSetting(defaultState(), 'palTrack', true);

test('five empty Pal slots per player, off by default', () => {
  const s = defaultState();
  assert.equal(s.palTrack, false);
  assert.equal(s.cardLookup, false);
  assert.equal(s.pals.length, 2);
  for (const row of s.pals) assert.equal(row.length, PAL_SLOTS);
  assert.deepEqual(s.pals[0][0], { atk: 0, dmg: 0, str: 0, card: null });
});

test('steps add up, never go below 0 and stop at the limits', () => {
  let s = on();
  s = palStep(s, 0, 2, 'atk', 1000);
  s = palStep(s, 0, 2, 'atk', 500);
  s = palStep(s, 0, 2, 'atk', 200);
  s = palStep(s, 0, 2, 'atk', 100);
  assert.equal(s.pals[0][2].atk, 1800);
  assert.equal(palStep(s, 0, 2, 'dmg', -100), s); // already 0: unchanged object
  s = palStep(s, 1, 4, 'str', 150);
  assert.equal(s.pals[1][4].str, 99);
  assert.equal(palStep(s, 0, 5, 'atk', 100), s); // no sixth slot
  assert.equal(palStep(s, 2, 0, 'atk', 100), s);
  assert.equal(palStep(s, 0, 0, 'life', 100), s);
});

test('end of turn removes damage (boosts and strike stay), only when Pal trackers are on', () => {
  let s = on();
  s = palStep(palStep(palStep(s, 0, 0, 'dmg', 3500), 0, 0, 'atk', 800), 1, 1, 'dmg', 200);
  s = palStep(s, 0, 0, 'str', 2);
  const next = endTurn(s);
  assert.equal(next.pals[0][0].dmg, 0);
  assert.equal(next.pals[1][1].dmg, 0);
  assert.equal(next.pals[0][0].atk, 800);
  assert.equal(next.pals[0][0].str, 2);
  const off = { ...s, palTrack: false };
  assert.equal(endTurn(off).pals[0][0].dmg, 3500);
  const fresh = defaultState();
  assert.equal(clearDamage(fresh), fresh); // nothing to remove: the same object
});

test('a card in a slot, clearing a slot, reset and saving', () => {
  let s = palCard(on(), 0, 1, { code: 'zz01-001', name: '  Test   Pal ' });
  assert.deepEqual(s.pals[0][1].card, { code: 'ZZ01-001', name: 'Test Pal', power: null, strike: null });
  assert.equal(palCard(s, 0, 1, { code: 'bad code!', name: 'x' }).pals[0][1].card, null);
  s = palStep(s, 0, 1, 'atk', 300);
  assert.equal(isFreshGame(s), false);
  const back = cleanState(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(back.pals, s.pals);
  assert.equal(back.palTrack, true);
  assert.deepEqual(palClear(s, 0, 1).pals[0][1], { atk: 0, dmg: 0, str: 0, card: null });
  assert.deepEqual(resetGame(s).pals, defaultState().pals);
  assert.equal(resetGame(s).palTrack, true); // a setting survives a reset
});

test('bad saved Pal data falls back to empty slots', () => {
  const p = cleanPals([[{ atk: -5, dmg: 1e9, str: 3.5, card: 'x' }], 'nope']);
  assert.deepEqual(p[0][0], { atk: 0, dmg: 0, str: 0, card: null });
  assert.equal(p[1].length, PAL_SLOTS);
  assert.equal(cleanCard({ code: 'AB01-002', name: '' }).name, 'AB01-002');
  assert.equal(cleanState({ v: 1 }).pals.length, 2); // an older save without pals
});

test('a card with printed power and strike: the slot shows base + boost', () => {
  let s = palCard(on(), 1, 0, { code: 'ZZ01-002', name: 'Made-up Fox', power: 1200, strike: 1 });
  assert.deepEqual(s.pals[1][0].card, { code: 'ZZ01-002', name: 'Made-up Fox', power: 1200, strike: 1 });
  assert.deepEqual(palTotals(s.pals[1][0]), { power: 1200, strike: 1, atk: 1200, str: 1 });
  s = palStep(palStep(s, 1, 0, 'atk', 800), 1, 0, 'str', 1);
  assert.deepEqual(palTotals(s.pals[1][0]), { power: 1200, strike: 1, atk: 2000, str: 2 });
  assert.deepEqual(palTotals({ atk: 500, dmg: 0, str: 0, card: null }), { power: null, strike: null, atk: 500, str: 0 });
  assert.deepEqual(cleanCard({ code: 'ZZ01-004', name: 'Made-up Camp', power: null, strike: -1 }), { code: 'ZZ01-004', name: 'Made-up Camp', power: null, strike: null });
  assert.equal(cleanCard({ code: 'ZZ01-004', name: 'x', power: 1e9 }).power, null);
  const back = cleanState(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(back.pals[1][0], s.pals[1][0]); // kept through a save
});

test('numbers with thousands separators', () => {
  assert.equal(palNum(1800), '1,800');
  assert.equal(palNum(500), '500');
  assert.equal(palNum(12000), '12,000');
});
