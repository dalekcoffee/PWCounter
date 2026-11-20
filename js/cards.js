// Card lookup (experimental): card data comes from Palify's free public API (https://palify.org/developers), asked
// once and kept on this device for a day, as Palify asks. Nothing about cards is stored in this repo.
// 0.4.2: Palify sends no CORS header, so a browser cannot read it directly: the list and the art come through the
// owner's resopal-proxy Worker (/api/cards, edge-cached a day; /img/<CODE>?w=, CORS-enabled, landscape cards turned).
// Pure helpers here (tested); the fetch and the sheets are in app.js.

export const CARD_PROXY = 'https://resopal-proxy.dalek.workers.dev';
export const CARD_API = `${CARD_PROXY}/api/cards`;
export const CARD_SITE = 'https://palify.org';
export const CARD_TTL_MS = 24 * 60 * 60 * 1000;
export const CARD_RESULTS = 60;

const str = (v, max = 4000) => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v) => (Number.isFinite(v) ? v : null);
const CODE = /^[A-Z0-9][A-Z0-9-]{2,23}$/;

/** One API record, reduced to what the app shows; null when it has no usable code or name. */
export function cleanApiCard(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const code = str(raw.code, 24).trim().toUpperCase();
  const name = str(raw.name, 120).trim();
  if (!CODE.test(code) || !name) return null;
  return {
    code, name,
    slug: typeof raw.slug === 'string' && /^[a-z0-9-]{1,160}$/.test(raw.slug) ? raw.slug : '',
    type: str(raw.type, 40), subtype: str(raw.subtype, 40), color: str(raw.color, 40), rarity: str(raw.rarity, 20),
    set: str(raw.set, 120), cost: num(raw.cost), power: num(raw.power), strike: num(raw.strike), durability: num(raw.durability),
    effect: str(raw.effect),
  };
}

/** The API answer ({count, cards: [...]} or a bare array) as a list of clean cards. */
export function cardsFromApi(body) {
  const list = Array.isArray(body) ? body : Array.isArray(body?.cards) ? body.cards : [];
  return list.map(cleanApiCard).filter(Boolean);
}

export const fold = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Search the cards: every word must appear in the name, code or effect. Name matches come first
 * (whole name start, then a word start, then anywhere), then code, then effect only.
 */
export function searchCards(cards, query, limit = CARD_RESULTS) {
  const words = fold(query || '').split(' ').filter(Boolean);
  if (!words.length) return [];
  const scored = [];
  for (const c of cards) {
    const name = fold(c.name), code = fold(c.code), effect = fold(c.effect);
    let score = 0, ok = true;
    for (const w of words) {
      if (name.startsWith(w)) score += 6;
      else if (` ${name}`.includes(` ${w}`)) score += 4;
      else if (name.includes(w)) score += 3;
      else if (code.replace(/ /g, '').includes(w.replace(/ /g, '')) || code.includes(w)) score += 2;
      else if (effect.includes(w)) score += 1;
      else { ok = false; break; }
    }
    if (ok) scored.push([score, c]);
  }
  scored.sort((a, b) => b[0] - a[0] || a[1].name.localeCompare(b[1].name) || a[1].code.localeCompare(b[1].code));
  return scored.slice(0, limit).map((x) => x[1]);
}

/** The card's art (Palify's, through the proxy), by printing code; w = 256 for list thumbnails, 1024 to read it. */
export const cardImage = (code, w = 1024) => `${CARD_PROXY}/img/${encodeURIComponent(code)}?w=${w === 256 || w === 512 ? w : 1024}`;
/** The card's page on Palify (for the credit link). */
export const cardPage = (card) => (card.slug ? `${CARD_SITE}/card/${card.slug}` : `${CARD_SITE}/cards`);

export const RECENT_MAX = 12;
const RECENT_CODE = /^[A-Z0-9][A-Z0-9-]{2,23}$/;
/** The recently looked-up cards (printing codes, newest first, no repeats), from anything saved. */
export function cleanRecent(raw) {
  const out = [];
  for (const c of Array.isArray(raw) ? raw : []) {
    const code = typeof c === 'string' ? c.trim().toUpperCase() : '';
    if (RECENT_CODE.test(code) && !out.includes(code)) out.push(code);
    if (out.length >= RECENT_MAX) break;
  }
  return out;
}
/** Put a card at the front of the recent list (moved up if it was already there). */
export const pushRecent = (list, code) => cleanRecent([code, ...(list || []).filter((c) => c !== String(code).toUpperCase())]);

/** Is a saved copy of the card list still fresh enough to use without asking again? */
export const cacheFresh = (saved, now) => !!saved && Array.isArray(saved.cards) && saved.cards.length > 0 && now - saved.at < CARD_TTL_MS;

/** One line under a result: type, cost, power, strike. */
export function cardLine(c) {
  const bits = [c.type, c.subtype].filter(Boolean);
  if (c.cost !== null) bits.push(`Cost ${c.cost}`);
  if (c.power !== null) bits.push(`Power ${c.power}`);
  if (c.durability !== null) bits.push(`Durability ${c.durability}`);
  if (c.strike !== null) bits.push(`Strike ${c.strike}`);
  return bits.join(' · ');
}
