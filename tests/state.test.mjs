import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultState, cleanState, step, endTurn, toggleNight, resetGame, setSetting, START_LIFE } from '../js/state.js';

test('a new game: 10 life, no resources, day, turn 1, two players', () => {
  const s = defaultState();
  assert.equal(START_LIFE, 10);
  assert.deepEqual(s.seats, [{ life: 10, mat: 0, ing: 0, soul: 0, up: 0 }, { life: 10, mat: 0, ing: 0, soul: 0, up: 0 }]);
  assert.equal(s.night, false);
  assert.equal(s.turn, 1);
  assert.equal(s.players, 2);
  assert.equal(s.landscape, 'off');
});

test('step changes one counter and clamps at its limits', () => {
  let s = defaultState();
  s = step(s, 0, 'life', -3);
  assert.equal(s.seats[0].life, 7);
  assert.equal(s.seats[1].life, 10);
  const same = step(s, 0, 'mat', -1);
  assert.equal(same, s, 'no change returns the same object');
  s = step(s, 1, 'ing', 200);
  assert.equal(s.seats[1].ing, 99);
  s = step(s, 0, 'life', -50);
  assert.equal(s.seats[0].life, 0);
  assert.equal(step(s, 2, 'life', 1), s);
  assert.equal(step(s, 0, 'bogus', 1), s);
});

test('step never mutates its input', () => {
  const s = defaultState();
  const frozen = JSON.stringify(s);
  step(s, 0, 'life', 1);
  assert.equal(JSON.stringify(s), frozen);
});

test('end turn: two players pass play, a full round counts one turn', () => {
  let s = defaultState();
  s = endTurn(s);
  assert.deepEqual([s.active, s.turn], [1, 1]);
  s = endTurn(s);
  assert.deepEqual([s.active, s.turn], [0, 2]);
  let one = setSetting(defaultState(), 'players', 1);
  one = endTurn(endTurn(one));
  assert.deepEqual([one.active, one.turn], [0, 3]);
});

test('day/night is one shared state and a reset brings back day', () => {
  let s = toggleNight(defaultState());
  assert.equal(s.night, true);
  s = step(s, 0, 'life', -4);
  s = setSetting(s, 'landscape', 'left');
  s = resetGame(endTurn(s));
  assert.equal(s.night, false);
  assert.equal(s.seats[0].life, 10);
  assert.deepEqual([s.turn, s.active], [1, 0]);
  assert.equal(s.landscape, 'left', 'settings survive a reset');
});

test('cleanState repairs anything read from storage', () => {
  assert.deepEqual(cleanState(null), defaultState());
  assert.deepEqual(cleanState({ v: 2 }), defaultState());
  const s = cleanState({ v: 1, seats: [{ life: 'x', mat: 3, ing: -1 }], night: 'yes', turn: -1, active: 5, players: 7, landscape: 'up', flip: false, awake: false });
  assert.deepEqual(s.seats, [{ life: 10, mat: 3, ing: 0, soul: 0, up: 0 }, { life: 10, mat: 0, ing: 0, soul: 0, up: 0 }]);
  assert.equal(s.night, false);
  assert.equal(s.turn, 1);
  assert.equal(s.active, 0);
  assert.equal(s.players, 2);
  assert.equal(s.landscape, 'off');
  assert.equal(s.flip, false);
  assert.equal(s.awake, false);
});

test('going to one player makes seat 0 active', () => {
  const s = setSetting(endTurn(defaultState()), 'players', 1);
  assert.equal(s.players, 1);
  assert.equal(s.active, 0);
});
