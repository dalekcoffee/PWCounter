import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardsFromApi, cleanApiCard, searchCards, cardImage, cardPage, cacheFresh, cardLine, CARD_TTL_MS, pushRecent, cleanRecent, RECENT_MAX } from '../js/cards.js';
import { defaultState, cleanState, resetGame } from '../js/state.js';

// made-up cards (no real card text)
const API = { count: 4, cards: [
  { slug: 'zz01-001-fluffball', code: 'ZZ01-001', name: 'Fluffball', type: 'Pal', color: 'Green', cost: 1, power: 300, strike: 1, durability: null, effect: 'When played, draw a card.' },
  { slug: 'zz01-002-ember-fox', code: 'ZZ01-002', name: 'Ember Fox', type: 'Pal', color: 'Red', cost: 3, power: 1200, strike: 1, durability: null, effect: 'Gets +500 power while attacking.' },
  { slug: 'zz01-003-big-fluff', code: 'ZZ01-003', name: 'Big Fluff', type: 'Pal', cost: 5, power: 2000, strike: 2, effect: 'Taunt.' },
  { code: 'ZZ01-004', name: 'Camp Fire', type: 'Structure', cost: 2, power: null, durability: 3, effect: 'Your Fluffball gets +100 power.' },
  { code: 'not ok', name: 'Broken' },
  { code: 'ZZ01-005' },
] };

test('API records are cleaned; broken ones are dropped; a bare array works too', () => {
  const cards = cardsFromApi(API);
  assert.equal(cards.length, 4);
  assert.equal(cards[3].slug, '');
  assert.equal(cards[3].durability, 3);
  assert.equal(cardsFromApi(API.cards).length, 4);
  assert.deepEqual(cardsFromApi(null), []);
  assert.equal(cleanApiCard({ code: 'zz01-009', name: 'X' }).code, 'ZZ01-009');
});

test('search: every word must match; names first, then code, then effect', () => {
  const cards = cardsFromApi(API);
  assert.deepEqual(searchCards(cards, 'fluff').map((c) => c.code), ['ZZ01-001', 'ZZ01-003', 'ZZ01-004']);
  assert.deepEqual(searchCards(cards, 'ember').map((c) => c.name), ['Ember Fox']);
  assert.deepEqual(searchCards(cards, 'zz01-002').map((c) => c.name), ['Ember Fox']);
  assert.deepEqual(searchCards(cards, 'fox attacking').map((c) => c.name), ['Ember Fox']);
  assert.deepEqual(searchCards(cards, '   '), []);
  assert.deepEqual(searchCards(cards, 'nothing here'), []);
  assert.equal(searchCards(cards, 'a', 2).length, 2);
});

test('links, image, cache and the result line', () => {
  const [a, , , d] = cardsFromApi(API);
  assert.equal(cardImage('ZZ01-001'), 'https://resopal-proxy.dalek.workers.dev/img/ZZ01-001?w=1024');
  assert.equal(cardImage('ZZ01-001', 256), 'https://resopal-proxy.dalek.workers.dev/img/ZZ01-001?w=256');
  assert.equal(cardImage('ZZ01-001', 77), 'https://resopal-proxy.dalek.workers.dev/img/ZZ01-001?w=1024');
  assert.equal(cardPage(a), 'https://palify.org/card/zz01-001-fluffball');
  assert.equal(cardPage(d), 'https://palify.org/cards');
  assert.equal(cacheFresh({ at: 1000, cards: [a] }, 1000 + CARD_TTL_MS - 1), true);
  assert.equal(cacheFresh({ at: 1000, cards: [a] }, 1000 + CARD_TTL_MS), false);
  assert.equal(cacheFresh({ at: 1000, cards: [] }, 1001), false);
  assert.equal(cardLine(a), 'Pal · Cost 1 · Power 300 · Strike 1');
  assert.equal(cardLine(d), 'Structure · Cost 2 · Durability 3');
});

test('recently looked-up cards: newest first, no repeats, capped, cleared by a new game', () => {
  let r = pushRecent([], 'zz01-001');
  r = pushRecent(r, 'ZZ01-002');
  r = pushRecent(r, 'ZZ01-001');
  assert.deepEqual(r, ['ZZ01-001', 'ZZ01-002']);
  for (let i = 0; i < 20; i++) r = pushRecent(r, `ZZ02-${String(i).padStart(3, '0')}`);
  assert.equal(r.length, RECENT_MAX);
  assert.equal(r[0], 'ZZ02-019');
  assert.deepEqual(cleanRecent(['bad code!', 7, 'ZZ01-003', 'zz01-003']), ['ZZ01-003']);
  assert.deepEqual(defaultState().recentCards, []);
  const s = cleanState({ ...defaultState(), recentCards: ['ZZ01-004'] });
  assert.deepEqual(s.recentCards, ['ZZ01-004']);
  assert.deepEqual(resetGame(s).recentCards, []);
});
