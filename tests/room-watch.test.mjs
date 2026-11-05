import { test } from 'node:test';
import assert from 'node:assert/strict';
import { helloMsg, sharedMsg, parseMessage, watchFromHash, watchLink, watchText, acceptWatchShared, activeRoleOf, codeFromHash } from '../js/room-proto.js';
import { displayView, createDeltas, deltaText } from '../js/room-display.js';
import { createRoom, readWatch, WATCH_KEY } from '../js/room.js';

const seat = (o = {}) => ({ life: 10, mat: 0, ing: 0, soul: 0, up: 0, ...o });
const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };

test('hello and shared carry the sender role; bad roles are refused', () => {
  const h = parseMessage(helloMsg({ name: 'Ann', seat: seat(), souls: false, role: 'host' }));
  assert.equal(h.role, 'host');
  assert.equal(parseMessage(helloMsg({ name: 'Ann', seat: seat(), souls: false })).role, null, 'an older sender has no role');
  assert.equal(parseMessage('{"t":"hello","v":1,"role":"watch","name":"x","seat":{"life":10,"mat":0,"ing":0,"soul":0,"up":0},"souls":false}'), null);
  const s = parseMessage(sharedMsg({ night: true, active: 0, turn: 3, rev: 2, role: 'guest' }));
  assert.equal(s.from, 'guest'); assert.equal(s.senderActive, true); assert.equal(s.active, 1, 'a player still reads it from its own side');
  assert.equal(parseMessage('{"t":"shared","role":"admin","night":false,"active":"me","turn":1,"rev":1}'), null);
});

test('peer notices: players get {here}, viewers get a role; the watcher notice', () => {
  assert.deepEqual(parseMessage('{"t":"peer","here":true}'), { t: 'peer', here: true });
  assert.deepEqual(parseMessage('{"t":"peer","role":"guest","here":false}'), { t: 'peer', role: 'guest', here: false });
  assert.equal(parseMessage('{"t":"peer","role":"watch","here":true}'), null);
  assert.equal(parseMessage('{"t":"peer","role":"host"}'), null);
  assert.deepEqual(parseMessage('{"t":"watcher"}'), { t: 'watcher' });
});

test('watch links and hashes', () => {
  assert.equal(watchLink('0427'), 'https://pwcounter.dalek.coffee/#watch=0427');
  assert.equal(watchText('0427'), 'pwcounter.dalek.coffee/#watch=0427');
  assert.equal(watchFromHash('#watch=0427'), '0427');
  assert.equal(watchFromHash('#watch'), '');
  for (const bad of ['#watch=042', '#watch=04271', '#join=0427', '#watch=abcd', '', null, '#watchx']) assert.equal(watchFromHash(bad), null, String(bad));
  assert.equal(codeFromHash('#watch=0427'), null, 'a watch link is not a join link');
});

test('a viewer decides by the highest rev, the host wins a tie; whose turn as a role', () => {
  assert.ok(acceptWatchShared(1, 2, 'guest')); assert.ok(!acceptWatchShared(2, 1, 'host'));
  assert.ok(acceptWatchShared(2, 2, 'host')); assert.ok(!acceptWatchShared(2, 2, 'guest'));
  assert.equal(activeRoleOf('host', true), 'host'); assert.equal(activeRoleOf('host', false), 'guest');
  assert.equal(activeRoleOf('guest', true), 'guest'); assert.equal(activeRoleOf('guest', false), 'host');
  assert.equal(activeRoleOf(null, true), null);
});

function viewer(extra = {}) {
  const sent = [], made = [];
  const storage = mem(), watchStorage = mem();
  const room = createRoom({
    makeTransport: (code, h, role, sid) => { const t = { code, h, role, sid, send: (x) => sent.push(x), close() {} }; made.push(t); setTimeout(() => h.open(), 0); return t; },
    storage, watchStorage, getSelf: () => ({ name: 'Me', seat: seat(), souls: false }), getShared: () => ({ night: false, active: 0, turn: 1 }), onShared() { throw new Error('a viewer never changes a game'); },
    setTimer: () => 0, ...extra,
  });
  return { room, sent, made, storage, watchStorage };
}
const tick = () => new Promise((r) => setTimeout(r, 5));

test('a viewer reads both players and the shared game, and never sends', async () => {
  const v = viewer();
  v.room.watch('0427');
  await tick();
  const t = v.made[0];
  assert.equal(t.role, 'watch'); assert.match(t.sid, /^[a-z0-9]{16}$/);
  const say = (o) => t.h.message(typeof o === 'string' ? o : JSON.stringify(o));
  say({ t: 'peer', role: 'host', here: true });
  assert.equal(v.room.state.status, 'connected');
  say(helloMsg({ name: 'Ann', seat: seat({ life: 7 }), souls: false, role: 'host' }));
  say(helloMsg({ name: 'Bob', seat: seat({ life: 4, soul: 3, up: 2 }), souls: true, role: 'guest' }));
  say(sharedMsg({ night: true, active: 0, turn: 3, rev: 5, role: 'guest' })); // the guest says it is its own turn
  const d = displayView(v.room.state);
  assert.deepEqual(d.players.map((p) => [p.name, p.life, p.active, p.souls, p.up, p.soul]), [['Ann', 7, false, false, 0, 0], ['Bob', 4, true, true, 2, 3]]);
  assert.equal(d.night, true); assert.equal(d.turn, 3);
  // an older revision does not win
  say(sharedMsg({ night: false, active: 0, turn: 1, rev: 4, role: 'host' }));
  assert.equal(displayView(v.room.state).turn, 3);
  // every path that would send is silent, even a viewer that is asked to
  v.room.selfChanged(); v.room.sharedChanged(); say({ t: 'watcher' });
  say('{"t":"check","v":1}');
  assert.deepEqual(v.sent, []);
  // a player leaving empties that panel
  say({ t: 'peer', role: 'host', here: false });
  assert.equal(displayView(v.room.state).players[0].here, false);
  assert.equal(displayView(v.room.state).players[0].name, 'Player 1');
});

test('watching is remembered for this tab only and never touches a remembered game', async () => {
  const v = viewer();
  v.storage.setItem('pwc.room', '{"keep":"me"}');
  v.room.watch('0427');
  await tick();
  assert.deepEqual(readWatch(v.watchStorage), { code: '0427', sid: v.made[0].sid });
  assert.equal(v.storage.getItem('pwc.room'), '{"keep":"me"}');
  const sid = v.made[0].sid;
  v.room.leave();
  assert.equal(v.watchStorage.getItem(WATCH_KEY), null);
  assert.equal(v.storage.getItem('pwc.room'), '{"keep":"me"}', 'leaving a watch keeps the remembered game');
  v.room.watch('0427', { sid }); // a reload resumes its own viewer socket
  assert.equal(v.made[1].sid, sid);
  assert.equal(readWatch({ getItem: () => 'junk' }), null);
  assert.equal(readWatch({ getItem: () => { throw new Error('x'); } }), null);
});

test('a viewer refused with 4003 stops and says why; players resend their state when a viewer joins', async () => {
  const v = viewer();
  v.room.watch('0427'); await tick();
  v.made[0].h.close(4003);
  assert.equal(v.room.state.status, 'viewers');
  // a player that hears {"t":"watcher"} sends hello and shared again
  const p = viewer();
  p.room.join('0427'); await tick();
  p.made[0].h.message('{"t":"peer","here":true}');
  const before = p.sent.length;
  p.made[0].h.message('{"t":"watcher"}');
  const tail = p.sent.slice(before).map((x) => JSON.parse(x));
  assert.deepEqual(tail.map((m) => m.t), ['hello', 'shared']);
  assert.equal(tail[0].role, 'guest'); assert.equal(tail[1].role, 'guest');
});

test('display view: waiting states and lines', () => {
  const base = { code: '0427', status: 'waiting', here: { host: false, guest: false }, seats: { host: null, guest: null }, wshared: null };
  const d = displayView(base);
  assert.equal(d.line, 'Waiting for players… Room 0427'); assert.equal(d.turn, null);
  assert.deepEqual(d.players.map((p) => [p.name, p.here, p.ready]), [['Player 1', false, false], ['Player 2', false, false]]);
  assert.equal(displayView({ ...base, status: 'reconnecting' }).line, 'Reconnecting…');
  assert.match(displayView({ ...base, status: 'viewers' }).line, /Too many viewers/);
  const one = displayView({ ...base, status: 'connected', here: { host: true, guest: false } });
  assert.equal(one.line, ''); assert.equal(one.players[0].here, true); assert.equal(one.players[0].ready, false, 'no hello yet');
});

test('delta badges add up for 5 seconds, a first value is only a baseline', () => {
  const d = createDeltas(5000);
  assert.equal(d.note('a', 10, 0), 0);
  assert.equal(d.note('a', 12, 100), 2);
  assert.equal(d.note('a', 9, 2000), -1, '+2 then -3 within 5 s');
  assert.equal(d.note('a', 9, 4000), -1);
  assert.equal(d.note('a', 9, 7100), 0, 'faded');
  assert.equal(d.note('a', 8, 8000), -1, 'a later change starts again');
  d.note('b', 1, 0); d.forget('b'); assert.equal(d.note('b', 5, 10), 0);
  assert.equal(d.note('a', null, 9000), 0);
  assert.equal(deltaText(2), '+2'); assert.equal(deltaText(-3), '−3'); assert.equal(deltaText(0), '');
});
