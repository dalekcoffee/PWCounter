import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rememberedRoom, roomRecord, rejoinLine } from '../js/room-memory.js';
import { compareCheck, applyPick, syncCards } from '../js/room-sync.js';
import { checkMsg, pickMsg, parseMessage } from '../js/room-proto.js';
import { defaultState } from '../js/state.js';

const H = 3600e3;
const seat = (o = {}) => ({ life: 10, mat: 0, ing: 0, soul: 0, up: 0, ...o });
const rec = (at) => ({ v: 1, code: '0427', role: 'host', sid: 'abc123', peerName: 'Bob', at, peerSeat: seat(), shared: { night: false, active: 'me', turn: 1 } });

test('remembered room: 47 h kept, 49 h dropped, junk dropped, only known fields', () => {
  const now = 1e12;
  assert.equal(rememberedRoom(JSON.stringify(rec(now - 47 * H)), now).code, '0427');
  assert.equal(rememberedRoom(rec(now - 49 * H), now), null);
  for (const bad of [null, 'x', '{', 42, { ...rec(now), code: '12' }, { ...rec(now), role: 'admin' }, { ...rec(now), sid: 'a-b' }, { ...rec(now), v: 2 }, { ...rec(now), at: 'now' }]) assert.equal(rememberedRoom(bad, now), null);
  const r = rememberedRoom({ ...rec(now), evil: 1, peerName: '  Bob\u0000  ', peerSeat: { life: -4 } }, now);
  assert.deepEqual(Object.keys(r).sort(), ['at', 'code', 'peerName', 'peerSeat', 'role', 'shared', 'sid', 'v']);
  assert.equal(r.peerName, 'Bob'); assert.equal(r.peerSeat, null);
  assert.equal(rejoinLine(r), 'Room 0427 with Bob');
  assert.equal(rejoinLine({ code: '1', peerName: '' }), 'Room 1 with your friend');
  assert.deepEqual(roomRecord(rec(5)).peerSeat, seat());
});

const snap = (o = {}) => ({ mine: seat(), peerSeat: seat(), shared: { night: false, active: 0, turn: 1 }, ...o });
const theirs = (o = {}) => ({ mine: seat(), yours: seat(), shared: { night: false, active: 0, turn: 1 }, ...o });

test('compare: equal, own seat, opponent, shared, null snapshot', () => {
  assert.deepEqual(compareCheck(snap(), theirs()), []);
  assert.deepEqual(compareCheck(snap({ mine: seat({ life: 12 }) }), theirs()).map((d) => d.key), ['me.life']);
  assert.deepEqual(compareCheck(snap(), theirs({ mine: seat({ mat: 2 }) }), { peerName: 'Bob' }).map((d) => d.label), ['Bob\'s Material']);
  assert.deepEqual(compareCheck(snap(), theirs({ shared: { night: true, active: 1, turn: 3 } })).map((d) => d.key), ['night', 'active', 'turn']);
  assert.deepEqual(compareCheck(snap({ peerSeat: null }), theirs({ mine: seat({ life: 1 }) })), []);
  assert.deepEqual(compareCheck(snap(), theirs({ yours: null, })), []);
  assert.deepEqual(compareCheck(snap({ mine: seat({ life: 1 }) }), theirs({ yours: null })), []);
});

test('cards and picks', () => {
  const s = snap({ mine: seat({ life: 12 }) }), t = theirs({ yours: seat({ life: 9 }) });
  const c = syncCards(s, t, 'Bob');
  assert.ok(c.diff.has('me.life')); assert.equal(c.theirs.you.life, 9); assert.equal(c.mine.you.life, 12);
  const st = defaultState();
  assert.equal(applyPick(st, 'me', t), st);
  const n = applyPick(st, 'you', { ...t, shared: { night: true, active: 1, turn: 4 } });
  assert.equal(n.seats[0].life, 9); assert.equal(n.night, true); assert.equal(n.active, 1); assert.equal(n.turn, 4);
  assert.equal(applyPick(st, 'you', theirs({ yours: null })).seats[0].life, 10);
});

test('check and pick messages are validated and turned to the receiver\'s side', () => {
  const m = parseMessage(checkMsg({ mine: seat({ life: 7 }), yours: null, shared: { night: true, active: 0, turn: 2 } }));
  assert.equal(m.t, 'check'); assert.equal(m.yours, null); assert.equal(m.shared.active, 1); assert.equal(m.mine.life, 7);
  assert.equal(parseMessage('{"t":"check","v":1,"mine":{"life":-1},"yours":null,"shared":{"night":true,"active":"me","turn":1}}'), null);
  assert.equal(parseMessage(pickMsg({ use: 'me', rev: 3 })).use, 'you');
  assert.equal(parseMessage(pickMsg({ use: 'you', rev: 3 })).use, 'me');
  assert.equal(parseMessage('{"t":"pick","use":"x","rev":1}'), null);
});
