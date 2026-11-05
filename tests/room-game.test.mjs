import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultState } from '../js/state.js';
import { startRoomGame, applyShared, sharedOf, sharedDiffers, selfDiffers, leaveRoomState, settleRoom, statusText, handleView, turnText } from '../js/room-game.js';
import { passTurn, makeCode } from '../js/room-proto.js';
import { qrSvg } from '../js/qr.js';
import { createRoom, makeSid } from '../js/room.js';

test('host starts, guest waits', () => {
  const s = defaultState();
  assert.equal(startRoomGame(s, 'host').active, 0);
  assert.equal(startRoomGame({ ...s, active: 0 }, 'guest').active, 1);
});

test('souls: set-up by role without asking, turn arriving stands souls and adds 2', () => {
  const s = { ...defaultState(), souls: true };
  const h = startRoomGame(s, 'host'), g = startRoomGame(s, 'guest');
  assert.equal(h.seats[0].soul, 2); assert.equal(g.seats[0].soul, 1);
  assert.equal(settleRoom(h, 'host'), h);
  const passed = passTurn(h, 'host');
  assert.equal(passed.active, 1);
  const got = applyShared({ ...g, seats: [{ ...g.seats[0], up: 0 }, g.seats[1]] }, { night: false, active: 0, turn: 1 });
  assert.equal(got.seats[0].soul, 3); assert.equal(got.seats[0].up, 3);
});

test('applyShared changes only shared values; same values = same object', () => {
  const s = defaultState();
  assert.equal(applyShared(s, sharedOf(s)), s);
  const n = applyShared(s, { night: true, active: 1, turn: 4 });
  assert.deepEqual(sharedOf(n), { night: true, active: 1, turn: 4 });
  assert.ok(sharedDiffers(sharedOf(s), sharedOf(n)));
  assert.deepEqual(n.seats, s.seats);
  assert.equal(leaveRoomState(n).active, 0);
});

test('selfDiffers sees my seat, name and souls only', () => {
  const s = defaultState();
  assert.ok(!selfDiffers(s, { ...s, night: true, turn: 5 }));
  assert.ok(selfDiffers(s, { ...s, seats: [{ ...s.seats[0], life: 9 }, s.seats[1]] }));
  assert.ok(selfDiffers(s, { ...s, name: 'Ann' }));
});

test('words', () => {
  assert.equal(statusText({ status: 'connected', peer: { name: 'Ann' } }), 'Connected to Ann');
  assert.equal(statusText({ status: 'waiting' }), 'Waiting for your friend…');
  assert.equal(handleView({ status: 'waiting', code: '0427' }).text, 'Waiting for your friend… 0427');
  assert.equal(handleView({ status: 'connected', peer: { name: '', seat: { life: 7 } } }).name, 'Opponent');
  assert.equal(turnText({ turn: 2, active: 1 }), 'Turn 2 · Them');
});

test('qr svg: quiet zone and a path', () => {
  const svg = qrSvg('https://pwcounter.dalek.coffee/#join=0427');
  assert.match(svg, /^<svg [^>]*viewBox="0 0 (\d+) \1"/);
  assert.match(svg, /<path d="M\d+,\d+h/);
  assert.match(svg, /fill="#ffffff"/);
  assert.equal(makeCode(() => {}).length, 4);
  assert.match(makeSid(), /^[a-z0-9]{16}$/);
});

test('host gets a new code on 4002, at most 5 times, then "busy"; guest on 4001 stops', () => {
  const mk = (closeWith) => {
    const made = [];
    let n = 0;
    const room = createRoom({
      makeTransport: (code, h, role, sid) => { made.push({ code, role, sid }); setTimeout(() => h.close(closeWith), 0); return { send() {}, close() {} }; },
      storage: { setItem() {}, removeItem() {}, getItem() { return null; } },
      getSelf: () => ({}), getShared: () => ({}), onShared() {}, newCode: () => `10${n++}0`.slice(0, 4), sid: 'abc',
      setTimer: () => 0,
    });
    return { room, made };
  };
  const a = mk(4002); a.room.host('0001');
  return new Promise((r) => setTimeout(r, 50)).then(() => {
    assert.equal(a.made.length, 6); // first try + 5 new codes
    assert.equal(a.room.state.status, 'busy');
    assert.ok(a.made.every((m) => m.role === 'host' && m.sid === 'abc'));
    assert.equal(new Set(a.made.map((m) => m.code)).size, 6);
    const b = mk(4001); b.room.join('1234');
    return new Promise((r) => setTimeout(r, 30)).then(() => { assert.equal(b.made.length, 1); assert.equal(b.room.state.status, 'full'); });
  });
});
