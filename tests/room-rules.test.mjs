import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validCode, originAllowed, messageOk, codeFromPath, MAX_MESSAGE, peerFromQuery, admit } from '../worker/room/src/rules.js';

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
  for (const s of ['', 'role=admin', 'role=Host', 'role=host&sid=a-b', 'role=host&sid=' + 'a'.repeat(33)]) assert.equal(q(s), null, s);
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
