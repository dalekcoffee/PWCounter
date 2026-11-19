import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultState, cleanState, setSetting, chooseFirst, endTurn, beginTurn, restSoul, addSoul, toggleSoul,
  needsFirst, resetGame, step, SOUL_MAX,
} from '../js/state.js';

const on = (players = 2) => setSetting(setSetting(defaultState(), 'players', players), 'souls', true);
const souls = (s) => s.seats.map((x) => [x.soul, x.up]);

test('souls are off by default and need no set-up then', () => {
  const s = defaultState();
  assert.equal(s.souls, false);
  assert.equal(needsFirst(s), false);
  assert.deepEqual(souls(s), [[0, 0], [0, 0]]);
});

test('switching souls on asks who goes first', () => {
  assert.equal(needsFirst(on()), true);
});

test('two players: first player gets 2 on turn 1, second starts with 1 (rules 6.2.1.5, 7.4.2.1)', () => {
  const s = chooseFirst(on(), 1); // the top player goes first
  assert.equal(s.first, 1);
  assert.equal(s.active, 1);
  assert.equal(s.turn, 1);
  assert.deepEqual(souls(s), [[1, 1], [2, 2]]);
});

test('ending a turn: the next player stands every soul and gains 2', () => {
  let s = chooseFirst(on(), 0); // bottom first: [2,2] vs [1,1]
  s = restSoul(s, 0, -2); // bottom pays 2
  assert.deepEqual(souls(s), [[2, 0], [1, 1]]);
  s = endTurn(s); // top's turn: 1 + 2 = 3, all standing
  assert.deepEqual([s.active, s.turn], [1, 1]);
  assert.deepEqual(souls(s), [[2, 0], [3, 3]]);
  s = endTurn(s); // bottom again: stands, 2 + 2 = 4; a new round
  assert.deepEqual([s.active, s.turn], [0, 2]);
  assert.deepEqual(souls(s), [[4, 4], [3, 3]]);
});

test('a full round is counted from whoever went first', () => {
  let s = chooseFirst(on(), 1);
  s = endTurn(s);
  assert.deepEqual([s.active, s.turn], [0, 1]);
  s = endTurn(s);
  assert.deepEqual([s.active, s.turn], [1, 2]);
});

test('never more than 10 souls', () => {
  let s = chooseFirst(on(), 0);
  for (let i = 0; i < 20; i++) s = endTurn(s);
  assert.deepEqual(souls(s), [[SOUL_MAX, SOUL_MAX], [SOUL_MAX, SOUL_MAX]]);
  assert.deepEqual(beginTurn(s, 0).seats[0], s.seats[0]);
});

test('one player going first: 2 souls now; each "start my turn" stands them and adds 2', () => {
  let s = chooseFirst(on(1), 0);
  assert.deepEqual(s.seats[0].soul, 2);
  assert.equal(s.turn, 1);
  s = restSoul(s, 0, -1);
  s = endTurn(s);
  assert.deepEqual([s.seats[0].soul, s.seats[0].up, s.turn], [4, 4, 2]);
});

test('one player going second: 1 soul now, 3 when the first turn starts', () => {
  let s = chooseFirst(on(1), 1);
  assert.deepEqual([s.seats[0].soul, s.seats[0].up, s.turn], [1, 1, 0]);
  s = endTurn(s);
  assert.deepEqual([s.seats[0].soul, s.seats[0].up, s.turn], [3, 3, 1]);
});

test('paying and standing souls stay within 0..total', () => {
  let s = chooseFirst(on(), 0);
  s = restSoul(s, 0, -5);
  assert.equal(s.seats[0].up, 0);
  assert.equal(restSoul(s, 0, -1), s);
  s = restSoul(s, 0, 9);
  assert.equal(s.seats[0].up, 2);
});

test('adding souls adds standing ones; removing takes rested ones first; 0..10', () => {
  let s = chooseFirst(on(), 0); // [2,2]
  s = restSoul(s, 0, -1); // 2 souls, 1 standing
  s = addSoul(s, 0, 1);
  assert.deepEqual([s.seats[0].soul, s.seats[0].up], [3, 2]);
  s = addSoul(s, 0, -1);
  assert.deepEqual([s.seats[0].soul, s.seats[0].up], [2, 2]);
  s = addSoul(s, 0, 50);
  assert.equal(s.seats[0].soul, 10);
  s = addSoul(s, 0, -50);
  assert.deepEqual([s.seats[0].soul, s.seats[0].up], [0, 0]);
});

test('cards view: tapping a standing soul rests one, a rested one stands one', () => {
  let s = chooseFirst(on(1), 0);
  s = endTurn(s); // 4 standing
  s = toggleSoul(s, 0, 0);
  assert.equal(s.seats[0].up, 3);
  s = toggleSoul(s, 0, 3); // index 3 is now rested
  assert.equal(s.seats[0].up, 4);
  assert.equal(toggleSoul(s, 0, 7), s, 'an empty slot does nothing');
});

test('choosing who goes first starts a fresh game (0.3.12); a reset asks again', () => {
  let s = step(step(on(), 0, 'life', -10), 1, 'mat', 2);
  s = { ...s, night: true, turn: 6 };
  s = chooseFirst(s, 0);
  assert.equal(s.seats[0].life, 10);
  assert.equal(s.seats[1].mat, 0);
  assert.equal(s.night, false);
  assert.equal(s.turn, 1);
  assert.deepEqual(souls(s), [[2, 2], [1, 1]]); // souls dealt as usual
  const plain = chooseFirst({ ...step(setSetting(defaultState(), 'players', 2), 1, 'life', -10) }, 1);
  assert.deepEqual(plain.seats.map((x) => x.life), [10, 10]); // without souls too
  s = resetGame(s);
  assert.equal(needsFirst(s), true);
  assert.deepEqual(souls(s), [[0, 0], [0, 0]]);
});

test('without souls, end turn changes no souls', () => {
  const s = endTurn(defaultState());
  assert.deepEqual(souls(s), [[0, 0], [0, 0]]);
});

test('changing the number of players asks who goes first again', () => {
  const s = setSetting(chooseFirst(on(), 0), 'players', 1);
  assert.equal(needsFirst(s), true);
});

test('cleanState keeps souls within limits', () => {
  const s = cleanState({ v: 1, seats: [{ soul: 12, up: 3 }, { soul: 4, up: 9 }], souls: true, soulStyle: 'cardsTap', first: 1, turn: 0 });
  assert.deepEqual(souls(s), [[0, 0], [4, 0]]);
  assert.equal(s.souls, true);
  assert.equal(s.soulStyle, 'cardsTap');
  assert.equal(cleanState({ v: 1, soulStyle: 'x' }).soulStyle, 'numbersCards');
  assert.equal(s.first, 1);
  assert.equal(cleanState({ v: 1, first: 3 }).soulStyle, 'numbersCards');
  assert.equal(cleanState({ v: 1, first: 3 }).first, null);
});

import { soulDisplay, cleanSoulStyle, SOUL_STYLES } from '../js/state.js';

test('every soul style is playable: something to read and something to tap', () => {
  for (const style of SOUL_STYLES) {
    const d = soulDisplay(style, true);
    assert.ok(d.number || d.cards, `${style} shows something`);
    assert.ok(d.tapCards ? d.cards : true, `${style} taps cards only when cards show`);
  }
  assert.deepEqual(soulDisplay('numbers', true), { style: 'numbers', number: true, cards: false, tapCards: false });
  assert.deepEqual(soulDisplay('numbersCards', true), { style: 'numbersCards', number: true, cards: true, tapCards: false });
  assert.deepEqual(soulDisplay('cardsTap', true), { style: 'cardsTap', number: false, cards: true, tapCards: true });
  assert.deepEqual(soulDisplay('cardsSides', true), { style: 'cardsSides', number: false, cards: true, tapCards: false });
});

test('two players (no room for cards) and unknown styles fall back to numbers', () => {
  assert.equal(soulDisplay('cardsTap', false).style, 'numbersCards');
  assert.equal(soulDisplay('numbersCards', false).style, 'numbersCards');
  assert.equal(soulDisplay('numbers', false).style, 'numbers');
  assert.equal(soulDisplay('nope', true).style, 'numbers');
});

test('a game saved before soul styles keeps its look', () => {
  assert.equal(cleanSoulStyle({ soulView: 'number' }), 'numbers');
  assert.equal(cleanSoulStyle({ soulView: 'cards', soulTap: 'card' }), 'cardsTap');
  assert.equal(cleanSoulStyle({ soulView: 'cards', soulTap: 'halves' }), 'cardsSides');
  assert.equal(cleanSoulStyle({}), 'numbersCards');
  assert.equal(cleanSoulStyle({ soulStyle: 'numbers' }), 'numbers'); // a chosen style is kept
});

test('two players settle who goes first even without souls (0.3.5); one player only with souls', () => {
  const two = setSetting(defaultState(), 'players', 2);
  assert.equal(two.souls, false);
  assert.equal(needsFirst(two), true);
  assert.equal(needsFirst(defaultState()), false);
  const s = chooseFirst(two, 1);
  assert.equal(s.first, 1);
  assert.equal(s.active, 1);
  assert.equal(s.turn, 1);
  assert.deepEqual(s.seats.map((x) => [x.soul, x.up]), [[0, 0], [0, 0]]); // no souls dealt
  assert.equal(needsFirst(s), false);
  assert.equal(needsFirst(resetGame(s)), true); // a reset asks again
});

test('a two-player game under way, saved before 0.3.5 without a first player, is not asked again on opening', () => {
  const old = { v: 1, players: 2, souls: false, first: null, active: 1, turn: 4, seats: [{ life: 0, mat: 2, ing: 1 }, { life: 6, mat: 0, ing: 0 }] };
  const s = cleanState(old);
  assert.equal(s.first, 1);
  assert.equal(needsFirst(s), false);
  assert.equal(s.seats[0].life, 0); // the game is kept as it was
  const atStart = cleanState({ ...old, turn: 1, seats: [{ life: 10 }, { life: 10 }] });
  assert.equal(needsFirst(atStart), true); // a game at its start is still asked
  assert.equal(needsFirst(cleanState({ ...old, souls: true })), true); // with souls the set-up still needs asking
});
