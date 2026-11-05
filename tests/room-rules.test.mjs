import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validCode, originAllowed, messageOk, codeFromPath, MAX_MESSAGE, peerFromQuery, admit, routeTargets, joinNotices, leaveNotices, MAX_WATCHERS } from '../worker/room/src/rules.js';

test('room code is exactly 4 digits', () => {
  for (const c of ['0000', '0427', '9999']) assert.ok(validCode(c), c);
  for (const c of ['', '123', '12345', 'ABCD', '12a4', ' 123', '١٢٣٤', null, 1234, '1234\n']) assert.ok(!validCode(c), String(c));
});

test('origin: the site or loopback only', () => {
  for (const o of ['https://pwcounter.dalek.coffee', 'http://127.0.0.1:5174', 'http://localhost', 'http://localhost:8080']) assert.ok(originAllowed(o), o);
  for (const o of ['http://pwcounter.dalek.coffee', 'https://evil.example', 'https://pwcounter.dalek.coffee.evil.com', 'http://127.0.0.1.evil.com', 'http://localhost:abc', '', null, undefined]) assert.ok(!originAllowed(o), String(o));
});

test('messages: strings up to 4 KB', () => {
  assert.ok(messageOk('x'.repeat(MAX_MESSAGE)));
  assert.ok(!messageOk('x'.repeat(MAX_MESSAGE + 1)));
  assert.ok(!messageOk('é'.repeat(MAX_MESSAGE / 2 + 1)), 'counted in bytes');
  assert.ok(!messageOk(new ArrayBuffer(4)));
});

test('path to code', () => {
  assert.equal(codeFromPath('/room/0427'), '0427');
  assert.equal(codeFromPath('/room/04271'), null);
  assert.equal(codeFromPath('/room/'), null);
  assert.equal(codeFromPath('/other'), null);
});

test('role and sid in the query', () => {
  const q = (s) => peerFromQuery(new URLSearchParams(s));
  assert.deepEqual(q('role=host'), { role: 'host', sid: '' });
  assert.deepEqual(q('role=guest&sid=abc123'), { role: 'guest', sid: 'abc123' });
  for (const s of ['', 'role=admin', 'role=watcher', 'role=Host', 'role=host&sid=a-b', 'role=host&sid=' + 'a'.repeat(33)]) assert.equal(q(s), null, s);
});

test('admit: second host 4002, second guest 4001, same tab replaces itself', () => {
  const h = { role: 'host', sid: 'H1' }, g = { role: 'guest', sid: 'G1' };
  assert.deepEqual(admit([], h), { accept: true, replace: -1 });
  assert.deepEqual(admit([h], g), { accept: true, replace: -1 });
  assert.deepEqual(admit([h], { role: 'host', sid: 'H2' }), { accept: false, code: 4002 });
  assert.deepEqual(admit([h, g], { role: 'guest', sid: 'G2' }), { accept: false, code: 4001 });
  assert.deepEqual(admit([h, g], { role: 'host', sid: 'H1' }), { accept: true, replace: 0 });
  assert.deepEqual(admit([h, g], { role: 'guest', sid: 'G1' }), { accept: true, replace: 1 });
  assert.deepEqual(admit([h], { role: 'host', sid: '' }), { accept: false, code: 4002 });
});

test('watch role in the query', () => {
  const q = (s) => peerFromQuery(new URLSearchParams(s));
  assert.deepEqual(q('role=watch'), { role: 'watch', sid: '' });
  assert.deepEqual(q('role=watch&sid=tv1'), { role: 'watch', sid: 'tv1' });
});

test('admit: watchers never take a player place, at most 8, same sid replaces', () => {
  const h = { role: 'host', sid: 'H1' }, g = { role: 'guest', sid: 'G1' };
  const w = (i) => ({ role: 'watch', sid: `W${i}` });
  assert.deepEqual(admit([h, g], w(1)), { accept: true, replace: -1 });
  assert.deepEqual(admit([w(1), w(2)], { role: 'host', sid: 'H1' }), { accept: true, replace: -1 }, 'viewers leave both places free');
  assert.deepEqual(admit([w(1), w(2), g], { role: 'host', sid: '' }), { accept: true, replace: -1 });
  assert.deepEqual(admit([h, w(1), w(2)], { role: 'guest', sid: 'G1' }), { accept: true, replace: -1 });
  assert.deepEqual(admit([h, g, w(1)], { role: 'guest', sid: 'G2' }), { accept: false, code: 4001 });
  const eight = Array.from({ length: MAX_WATCHERS }, (_, i) => w(i));
  assert.equal(MAX_WATCHERS, 8);
  assert.deepEqual(admit([h, g, ...eight.slice(0, 7)], w(9)), { accept: true, replace: -1 });
  assert.deepEqual(admit([h, g, ...eight], w(9)), { accept: false, code: 4003 });
  assert.deepEqual(admit([h, g, ...eight], w(3)), { accept: true, replace: 5 }, 'a viewer coming back replaces its own socket');
  assert.deepEqual(admit([...eight], { role: 'guest', sid: 'x' }), { accept: true, replace: -1 }, 'a full room of viewers still lets players in');
});

test('routing: players reach everyone else, viewers reach nobody', () => {
  const s = [{ role: 'host' }, { role: 'guest' }, { role: 'watch' }, { role: 'watch' }];
  assert.deepEqual(routeTargets(s, 0), [1, 2, 3]);
  assert.deepEqual(routeTargets(s, 1), [0, 2, 3]);
  assert.deepEqual(routeTargets(s, 2), []);
  assert.deepEqual(routeTargets(s, 3), []);
  assert.deepEqual(routeTargets(s, 9), []);
  assert.deepEqual(routeTargets([{ role: 'host' }], 0), []);
});

test('notices: players hear only about the other player, viewers about each player with its role', () => {
  const others = [{ role: 'host' }, { role: 'watch' }];
  assert.deepEqual(joinNotices(others, 'guest'), { toOthers: [{ index: 0, msg: { t: 'peer', here: true } }, { index: 1, msg: { t: 'peer', role: 'guest', here: true } }], toSelf: [{ t: 'peer', here: true }] });
  // a viewer joining: not "here" for the players; they resend their state; it learns who is present
  const w = joinNotices([{ role: 'host' }, { role: 'guest' }, { role: 'watch' }], 'watch');
  assert.deepEqual(w.toOthers, [{ index: 0, msg: { t: 'watcher' } }, { index: 1, msg: { t: 'watcher' } }]);
  assert.deepEqual(w.toSelf, [{ t: 'peer', role: 'host', here: true }, { t: 'peer', role: 'guest', here: true }]);
  assert.deepEqual(joinNotices([{ role: 'watch' }], 'host').toSelf, [{ t: 'peer', here: false }], 'a viewer is not "here" for a player');
  assert.deepEqual(joinNotices([], 'watch'), { toOthers: [], toSelf: [] });
  assert.deepEqual(leaveNotices([{ role: 'guest' }, { role: 'watch' }], 'host'), [{ index: 0, msg: { t: 'peer', here: false } }, { index: 1, msg: { t: 'peer', role: 'host', here: false } }]);
  assert.deepEqual(leaveNotices([{ role: 'guest' }], 'watch'), []);
});
