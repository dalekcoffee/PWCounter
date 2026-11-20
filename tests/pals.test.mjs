import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultState, cleanState, endTurn, resetGame, isFreshGame, setSetting } from '../js/state.js';
import { PAL_SLOTS, palStep, palCard, palClear, clearDamage, cleanPals, cleanCard, palNum, palTotals, palReset, cleanPalAll, ALL, palEmpty } from '../js/pals.js';

const on = () => setSetting(defaultState(), 'palTrack', true);

test('five empty Pal slots per player, off by default', () => {
  const s = defaultState();
  assert.equal(s.palTrack, false);
  assert.equal(s.cardLookup, false);
  assert.equal(s.pals.length, 2);
  for (const row of s.pals) assert.equal(row.length, PAL_SLOTS);
  assert.deepEqual(s.pals[0][0], { atk: 0, dmg: 0, str: 0, bp: 0, bs: 0, card: null });
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
  assert.deepEqual(palClear(s, 0, 1).pals[0][1], { atk: 0, dmg: 0, str: 0, bp: 0, bs: 0, card: null });
  assert.deepEqual(resetGame(s).pals, defaultState().pals);
  assert.equal(resetGame(s).palTrack, true); // a setting survives a reset
});

test('bad saved Pal data falls back to empty slots', () => {
  const p = cleanPals([[{ atk: -5, dmg: 1e9, str: 3.5, card: 'x' }], 'nope']);
  assert.deepEqual(p[0][0], { atk: 0, dmg: 0, str: 0, bp: 0, bs: 0, card: null });
  assert.equal(p[1].length, PAL_SLOTS);
  assert.equal(cleanCard({ code: 'AB01-002', name: '' }).name, 'AB01-002');
  assert.equal(cleanState({ v: 1 }).pals.length, 2); // an older save without pals
});

test('a card with printed power and strike: the slot shows base + boost', () => {
  let s = palCard(on(), 1, 0, { code: 'ZZ01-002', name: 'Made-up Fox', power: 1200, strike: 1 });
  assert.deepEqual(s.pals[1][0].card, { code: 'ZZ01-002', name: 'Made-up Fox', power: 1200, strike: 1 });
  assert.deepEqual(palTotals(s.pals[1][0]), { power: 1200, strike: 1, boost: 0, extra: 0, src: 'card', atk: 1200, dmg: 0, str: 1 });
  s = palStep(palStep(s, 1, 0, 'atk', 800), 1, 0, 'str', 1);
  assert.deepEqual(palTotals(s.pals[1][0]), { power: 1200, strike: 1, boost: 800, extra: 1, src: 'card', atk: 2000, dmg: 0, str: 2 });
  assert.deepEqual(palTotals({ atk: 500, dmg: 0, str: 0, card: null }), { power: null, strike: null, boost: 500, extra: 0, src: null, atk: 500, dmg: 0, str: 0 });
  assert.deepEqual(cleanCard({ code: 'ZZ01-004', name: 'Made-up Camp', power: null, strike: -1 }), { code: 'ZZ01-004', name: 'Made-up Camp', power: null, strike: null });
  assert.equal(cleanCard({ code: 'ZZ01-004', name: 'x', power: 1e9 }).power, null);
  const back = cleanState(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(back.pals[1][0], s.pals[1][0]); // kept through a save
});

test('quick resets: one counter or all three, the card stays', () => {
  let s = palCard(on(), 0, 2, { code: 'ZZ01-003', name: 'Made-up Fluff', power: 2000, strike: 2 });
  s = palStep(palStep(palStep(s, 0, 2, 'atk', 1500), 0, 2, 'dmg', 700), 0, 2, 'str', 1);
  const a = palReset(s, 0, 2, 'atk');
  assert.deepEqual([a.pals[0][2].atk, a.pals[0][2].dmg, a.pals[0][2].str], [0, 700, 1]);
  const all = palReset(s, 0, 2, 'all');
  assert.deepEqual(all.pals[0][2], { atk: 0, dmg: 0, str: 0, bp: 0, bs: 0, card: s.pals[0][2].card });
  assert.equal(palReset(all, 0, 2, 'all'), all); // nothing to reset: the same object
  assert.equal(palReset(s, 0, 2, 'nope'), s);
  assert.equal(palReset(s, 2, 0, 'atk'), s);
});

test('All Pals layer: added on top of every Pal, its own resets, damage clears at end of turn', () => {
  let s = palCard(on(), 0, 0, { code: 'ZZ01-002', name: 'Made-up Fox', power: 1200, strike: 1 });
  s = palStep(s, 0, 0, 'atk', 300);
  s = palStep(palStep(palStep(s, 0, ALL, 'atk', 500), 0, ALL, 'dmg', 200), 0, ALL, 'str', 1);
  assert.deepEqual(s.palAll[0], { atk: 500, dmg: 200, str: 0 + 1 });
  assert.deepEqual(s.palAll[1], { atk: 0, dmg: 0, str: 0 }); // the other player is untouched
  assert.equal(s.pals[0][0].atk, 300); // the Pal's own boost is separate
  const t = palTotals(s.pals[0][0], s.palAll[0]);
  assert.deepEqual(t, { power: 1200, strike: 1, boost: 800, extra: 1, src: 'card', atk: 2000, dmg: 200, str: 2 });
  assert.deepEqual(palTotals(s.pals[0][3], s.palAll[0]).atk, 500); // a slot without a card: the boosts alone
  assert.equal(palCard(s, 0, ALL, { code: 'ZZ01-001', name: 'x' }), s); // the layer has no card
  assert.equal(palClear(s, 0, ALL), s);
  assert.deepEqual(palReset(s, 0, ALL, 'atk').palAll[0], { atk: 0, dmg: 200, str: 1 });
  assert.deepEqual(palReset(s, 0, ALL, 'all').palAll[0], { atk: 0, dmg: 0, str: 0 });
  assert.equal(palReset(s, 0, ALL, 'all').pals[0][0].atk, 300); // resetting the layer keeps each Pal's own values
  assert.deepEqual(clearDamage(s).palAll[0], { atk: 500, dmg: 0, str: 1 });
  assert.equal(isFreshGame(s), false);
  assert.deepEqual(resetGame(s).palAll, [{ atk: 0, dmg: 0, str: 0 }, { atk: 0, dmg: 0, str: 0 }]);
  assert.deepEqual(cleanState(JSON.parse(JSON.stringify(s))).palAll, s.palAll);
  assert.deepEqual(cleanPalAll([{ atk: -1, dmg: 'x', str: 1e9 }]), [{ atk: 0, dmg: 0, str: 0 }, { atk: 0, dmg: 0, str: 0 }]);
});

test('a base power and strike set by hand (no card)', () => {
  let s = palStep(palStep(on(), 0, 1, 'bp', 2000), 0, 1, 'bs', 4);
  s = palStep(s, 0, 1, 'bp', 100);
  assert.deepEqual([s.pals[0][1].bp, s.pals[0][1].bs], [2100, 4]);
  s = palStep(palStep(s, 0, 1, 'atk', 500), 0, 1, 'str', 1);
  assert.deepEqual(palTotals(s.pals[0][1], s.palAll[0]), { power: 2100, strike: 4, boost: 500, extra: 1, src: 'base', atk: 2600, dmg: 0, str: 5 });
  assert.equal(palStep(s, 0, 1, 'bp', -99999).pals[0][1].bp, 0); // never below 0
  assert.equal(palStep(s, 0, 1, 'bs', 200).pals[0][1].bs, 99);
  assert.equal(palStep(s, 0, ALL, 'bp', 100), s); // the All Pals layer has no base
  assert.equal(palEmpty(palStep(on(), 0, 2, 'bs', 1).pals[0][2]), false);
  // Reset all keeps the base; 'base' clears it; Left play clears everything
  assert.deepEqual([palReset(s, 0, 1, 'all').pals[0][1].bp, palReset(s, 0, 1, 'all').pals[0][1].atk], [2100, 0]);
  assert.deepEqual([palReset(s, 0, 1, 'base').pals[0][1].bp, palReset(s, 0, 1, 'base').pals[0][1].bs, palReset(s, 0, 1, 'base').pals[0][1].atk], [0, 0, 500]);
  // a card with printed numbers replaces the hand-set base
  const c = palCard(s, 0, 1, { code: 'ZZ01-002', name: 'Made-up Fox', power: 1200, strike: 1 });
  assert.deepEqual([c.pals[0][1].bp, palTotals(c.pals[0][1]).power, palTotals(c.pals[0][1]).src], [0, 1200, 'card']);
  assert.deepEqual(cleanState(JSON.parse(JSON.stringify(s))).pals[0][1], s.pals[0][1]); // kept through a save
});

test('numbers with thousands separators', () => {
  assert.equal(palNum(1800), '1,800');
  assert.equal(palNum(500), '500');
  assert.equal(palNum(12000), '12,000');
});
