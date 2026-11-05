// PW Counter: the page. Rules live in state.js / calc.js / random.js (pure, tested).
import { APP_VERSION } from './version.js';
import {
  defaultState, cleanState, step, endTurn, toggleNight, resetGame, setSetting, COUNTERS,
  SOUL_MAX, needsFirst, chooseFirst, restSoul, addSoul, toggleSoul, needsResume, cleanName,
} from './state.js';
import * as calc from './calc.js';
import { rollDie, flipCoin } from './random.js';

const KEY = 'pwc.state';
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const stage = $('#stage');

// ---------- storage ----------
function load() {
  try { return cleanState(JSON.parse(localStorage.getItem(KEY))); } catch { return defaultState(); }
}
function save(s) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...s, savedAt: Date.now() })); } catch { /* private mode / full: the game still works this visit */ }
}

let state = load();

function commit(next) {
  if (next === state) return;
  const prev = state;
  state = next;
  save(state);
  render(prev);
}

// ---------- seats ----------
const LABEL = { life: 'Life', mat: 'Material', ing: 'Ingredient', soul: 'Souls' };
const ICONS = {
  life: '<svg viewBox="0 0 64 64" aria-hidden="true"><path class="i-heart" d="M32 56C24 49 7 38 7 22 7 13 13.5 7 21 7c5 0 8.6 2.6 11 6.4C34.4 9.6 38 7 43 7c7.5 0 14 6 14 15 0 16-17 27-25 34Z"/><path class="i-shine" d="M15 21c0-4.5 3-7.5 7-7.5"/></svg>',
  mat: '<svg viewBox="0 0 64 64" aria-hidden="true"><g transform="rotate(-18 32 34)"><rect class="i-log" x="14" y="22" width="42" height="24" rx="12"/><path class="i-grain" d="M24 28h22M28 40h20"/><ellipse class="i-ring" cx="16" cy="34" rx="8" ry="12"/><ellipse class="i-rings" cx="16" cy="34" rx="4.5" ry="7"/><ellipse class="i-core" cx="16" cy="34" rx="1.6" ry="2.6"/></g></svg>',
  soul: '<svg viewBox="0 0 64 64" aria-hidden="true"><path class="i-wisp" d="M33 6c2 9 14 13 16 26 2 12-6 24-17 24S13 48 14 37c1-8 7-11 8-18 4 4 4 9 3 12 5-4 9-13 8-25Z"/><path class="i-wisp-in" d="M32 30c1 5 8 7 8 14 0 5-4 8-8 8s-8-3-8-8c0-4 3-6 4-9 2 2 2 4 2 6 2-3 3-7 2-11Z"/></svg>',
  ing: '<svg viewBox="0 0 64 64" aria-hidden="true"><path class="i-stem" d="M34 20c1-4 3-7 6-9"/><path class="i-leaf" d="M39 15c4-6 11-8 18-6-2 8-9 11-17 9Z"/><path class="i-fruit" d="M31 21c-4-2-9-3-13 0-7 4-9 13-6 21 3 9 10 15 17 15 3 0 4-1 6-1s3 1 6 1c7 0 13-7 15-16 2-9-2-17-9-20-5-2-9 0-12 2-1 0-3-1-4-2Z"/><ellipse class="i-shine2" cx="21" cy="31" rx="4.5" ry="7" transform="rotate(25 21 31)"/></svg>',
};

function tile(key) {
  const el = document.createElement('div');
  el.className = `tile t-${key}`;
  el.dataset.key = key;
  el.innerHTML = `
    <button type="button" class="hit minus" data-d="-1" aria-label="${LABEL[key]} minus one"></button>
    <button type="button" class="hit plus" data-d="1" aria-label="${LABEL[key]} plus one"></button>
    <span class="pm minus" aria-hidden="true">−</span>
    <div class="core">
      <span class="head"><span class="ico">${ICONS[key]}</span><span class="lbl">${LABEL[key]}</span></span>
      <span class="num" aria-live="polite">0</span>
    </div>
    <span class="pm plus" aria-hidden="true">+</span>
    <span class="delta" aria-hidden="true"></span>${key === 'life' ? '<span class="whose" aria-hidden="true"></span>' : ''}`;
  if (key === 'soul') {
    $('.hit.minus', el).setAttribute('aria-label', 'Rest a soul (pay)');
    $('.hit.plus', el).setAttribute('aria-label', 'Stand a soul again');
    el.insertAdjacentHTML('beforeend', `
      <div class="soul-adj" role="group" aria-label="Souls in your soul area">
        <button type="button" data-add="-1" aria-label="Remove a soul">−</button>
        <span class="of">of <b class="total">0</b></span>
        <button type="button" data-add="1" aria-label="Add a soul">+</button>
      </div>
      <div class="soul-cards" role="group" aria-label="Soul cards: tap one to rest or stand it">
        <div class="sc-head"><span class="ico">${ICONS.soul}</span><span class="lbl">Souls</span><span class="sc-count"></span></div>
        <div class="sc-row">${Array.from({ length: SOUL_MAX }, (_, i) => `<button type="button" class="sc-card" data-i="${i}"></button>`).join('')}</div>
      </div>`);
  }
  return el;
}

for (const seatEl of $$('.seat')) {
  const res = document.createElement('div');
  res.className = 'res';
  res.append(tile('mat'), tile('ing'));
  const inner = document.createElement('div');
  inner.className = 'seat-in';
  inner.append(tile('life'), res, tile('soul'));
  seatEl.append(inner);
}

// ---------- tapping, with hold to repeat ----------
const deltas = new WeakMap(); // tile -> {sum, timer}

function bump(seat, key, d, tileEl) {
  const next = key === 'soul' ? restSoul(state, seat, d) : step(state, seat, key, d);
  if (next === state) return;
  commit(next);
  try { navigator.vibrate?.(6); } catch { /* not allowed */ }
  const info = deltas.get(tileEl) || { sum: 0, timer: 0 };
  info.sum += d;
  clearTimeout(info.timer);
  const out = $('.delta', tileEl);
  out.textContent = info.sum > 0 ? `+${info.sum}` : info.sum < 0 ? `−${-info.sum}` : '';
  out.classList.toggle('neg', info.sum < 0);
  out.classList.add('show');
  info.timer = setTimeout(() => { info.sum = 0; out.classList.remove('show'); }, 1400);
  deltas.set(tileEl, info);
}

let hold = null;
function stopHold() {
  if (!hold) return;
  clearTimeout(hold.t);
  clearInterval(hold.i);
  hold = null;
}

stage.addEventListener('pointerdown', (e) => {
  const hit = e.target.closest('.hit');
  if (!hit || e.button > 0) return;
  const tileEl = hit.closest('.tile');
  const seat = Number(hit.closest('.seat').dataset.seat);
  const key = tileEl.dataset.key;
  const d = Number(hit.dataset.d);
  e.preventDefault();
  stopHold();
  bump(seat, key, d, tileEl);
  hold = { t: setTimeout(() => { hold.i = setInterval(() => bump(seat, key, d, tileEl), 110); }, 450) };
});
for (const ev of ['pointerup', 'pointercancel', 'pointerleave', 'blur']) window.addEventListener(ev, stopHold);
stage.addEventListener('contextmenu', (e) => { if (e.target.closest('.hit')) e.preventDefault(); });
// keyboard activation (detail 0); pointer taps are handled above
stage.addEventListener('click', (e) => {
  const hit = e.target.closest('.hit');
  if (!hit || e.detail !== 0) return;
  bump(Number(hit.closest('.seat').dataset.seat), hit.closest('.tile').dataset.key, Number(hit.dataset.d), hit.closest('.tile'));
});

// ---------- render ----------
function render(prev) {
  const s = state;
  stage.dataset.time = s.night ? 'night' : 'day';
  stage.dataset.players = String(s.players);
  stage.dataset.land = s.landscape;
  stage.dataset.flip = s.players === 2 && s.flip ? 'on' : 'off';
  stage.dataset.souls = s.souls ? 'on' : 'off';
  stage.dataset.icons = s.iconsOnly ? 'only' : 'words';
  $('#btn-room').hidden = !s.rooms || s.players === 2; // online play replaces the shared-phone view, so it is offered from one player
  stage.dataset.soulview = s.souls && s.players === 1 && s.soulView === 'cards' ? 'cards' : 'number';
  $('[data-seat="1"]').hidden = s.players === 1;
  for (const seatEl of $$('.seat')) {
    const i = Number(seatEl.dataset.seat);
    const seat = s.seats[i];
    seatEl.classList.toggle('active', s.players === 2 && s.active === i);
    for (const key of COUNTERS) {
      const n = $(`.t-${key} .num`, seatEl);
      n.textContent = String(seat[key]);
      n.dataset.len = String(Math.max(2, String(seat[key]).length));
    }
    const whose = $('.whose', seatEl);
    whose.textContent = i === 1 ? 'Opponent' : (s.name || 'Username not set · ⚙ Settings');
    whose.classList.toggle('unset', i === 0 && !s.name);
    const st = $('.t-soul', seatEl);
    st.hidden = !s.souls;
    $('.num', st).textContent = String(seat.up);
    $('.total', st).textContent = String(seat.soul);
    $('.sc-count', st).textContent = `${seat.up} standing · ${seat.soul} of ${SOUL_MAX}`;
    $$('.sc-card', st).forEach((c, n) => {
      c.dataset.state = n < seat.up ? 'up' : n < seat.soul ? 'rest' : 'empty';
      c.setAttribute('aria-label', n < seat.up ? `Soul ${n + 1}: standing. Tap to rest it.` : n < seat.soul ? `Soul ${n + 1}: rested. Tap to stand it.` : `Empty soul slot ${n + 1}`);
      c.disabled = n >= seat.soul;
    });
  }
  const oneSouls = s.players === 1 && s.souls;
  $('.et-word').textContent = oneSouls ? 'Start turn' : 'End Turn';
  $('#turn-label').textContent = oneSouls && s.turn === 0 ? 'Going second' : `Turn ${s.turn}`;
  $('#btn-end').setAttribute('aria-label', oneSouls ? 'Start my turn: my souls stand and I get 2 more.' : s.players === 2 ? `End turn. Turn ${s.turn}, ${s.active === 0 ? 'your' : "the opponent's"} turn.` : `End turn. Turn ${s.turn}.`);
  const tb = $('#btn-time');
  tb.setAttribute('aria-pressed', String(s.night));
  tb.setAttribute('aria-label', s.night ? 'It is night. Tap to make it day.' : 'It is day. Tap to make it night.');
  $('.dn-word', tb).textContent = s.night ? 'Night' : 'Day';
  if (prev && prev.night !== s.night) {
    stage.classList.remove('flash');
    void stage.offsetWidth; // restart the animation
    stage.classList.add('flash');
  }
  paintSettings();
  if (!prev || prev.awake !== s.awake) syncWake();
}

// ---------- bar ----------
$('#btn-time').addEventListener('click', () => commit(toggleNight(state)));
$('#btn-end').addEventListener('click', () => {
  if (needsFirst(state)) { openOverlay('ov-first'); return; }
  commit(endTurn(state));
});

// souls: total +/- and the cards view
stage.addEventListener('click', (e) => {
  const add = e.target.closest('[data-add]');
  const card = e.target.closest('.sc-card');
  if (!add && !card) return;
  const seat = Number(e.target.closest('.seat').dataset.seat);
  if (add) commit(addSoul(state, seat, Number(add.dataset.add)));
  else commit(toggleSoul(state, seat, Number(card.dataset.i)));
  try { navigator.vibrate?.(6); } catch { /* not allowed */ }
});

// who goes first (souls only)
let askFirst = needsFirst(state);
function paintFirst() {
  const two = state.players === 2;
  $('#first-a').textContent = two ? 'Bottom player goes first' : 'I go first';
  $('#first-b').textContent = two ? 'Top player goes first' : 'I go second';
  $('#first-sub').textContent = two
    ? 'The player going second starts with 1 soul. The player going first gets 2 souls now.'
    : 'Going first: 2 souls now. Going second: 1 soul now, and 2 more when you start your first turn.';
  $('#first-out').textContent = '\u00a0';
}
function maybeAskFirst() {
  if (askFirst && needsFirst(state) && !openId) { askFirst = false; paintFirst(); openOverlay('ov-first'); }
}
$('#ov-first').addEventListener('click', (e) => {
  const b = e.target.closest('[data-first]');
  if (!b) return;
  let seat = b.dataset.first;
  if (seat === 'random') {
    seat = flipCoin() === 'heads' ? 0 : 1;
    const two = state.players === 2;
    $('#first-out').textContent = two ? (seat === 0 ? 'Bottom player goes first' : 'Top player goes first') : (seat === 0 ? 'You go first' : 'You go second');
    $$('#ov-first button').forEach((x) => { x.disabled = true; });
    setTimeout(() => {
      $$('#ov-first button').forEach((x) => { x.disabled = false; });
      commit(chooseFirst(state, seat));
      closeOverlay();
    }, 1100);
    return;
  }
  commit(chooseFirst(state, Number(seat)));
  closeOverlay();
});

const fullBtn = $('#btn-full');
const standalone = matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone === true;
fullBtn.hidden = !document.fullscreenEnabled || standalone;
fullBtn.addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => {});
});

// ---------- overlays ----------
let openId = null;
let lastFocus = null;
function openOverlay(id) {
  if (openId) closeOverlay(true);
  if (id === 'ov-first') paintFirst();
  lastFocus = document.activeElement;
  const ov = $(`#${id}`);
  ov.hidden = false;
  openId = id;
  ($('[data-close]', ov) || ov.querySelector('button'))?.focus({ preventScroll: true });
}
function closeOverlay(quiet) {
  if (!openId) return;
  $(`#${openId}`).hidden = true;
  openId = null;
  if (!quiet) lastFocus?.focus?.({ preventScroll: true });
  if (!quiet) maybeAskFirst();
}
for (const ov of $$('.overlay')) {
  ov.addEventListener('click', (e) => {
    if (e.target === ov || e.target.closest('[data-close]')) closeOverlay();
  });
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && openId) { e.preventDefault(); closeOverlay(); return; }
  if (openId === 'ov-calc') calcKey(e);
});

// ---------- calculator ----------
let tokens = [];
function paintCalc() {
  const v = calc.evaluate(tokens);
  $('#calc-val').textContent = calc.formatNumber(v);
  $('#calc-val').classList.toggle('err', v !== null && !Number.isFinite(v));
  $('#calc-expr').textContent = tokens.length > 1 ? calc.exprText(tokens) : ' ';
}
function calcDo(fn) { tokens = fn(tokens); paintCalc(); }
$('#btn-calc').addEventListener('click', () => { openOverlay('ov-calc'); paintCalc(); });
$('#ov-calc').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.d) calcDo((t) => calc.pressDigit(t, b.dataset.d));
  else if (b.dataset.op) calcDo((t) => calc.pressOp(t, b.dataset.op));
  else if (b.dataset.quick) calcDo((t) => calc.shortcut(t, Number(b.dataset.quick)));
  else if (b.dataset.k === 'clear') calcDo(() => []);
  else if (b.dataset.k === 'back') calcDo(calc.backspace);
  else if (b.dataset.k === 'eq') calcDo(calc.equals);
});
function calcKey(e) {
  const k = e.key;
  let fn = null;
  if (/^\d$/.test(k)) fn = (t) => calc.pressDigit(t, k);
  else if (k === '+' || k === '-') fn = (t) => calc.pressOp(t, k);
  else if (k === '*' || k === 'x') fn = (t) => calc.pressOp(t, '×');
  else if (k === '/') fn = (t) => calc.pressOp(t, '÷');
  else if (k === 'Backspace') fn = calc.backspace;
  else if (k === 'Enter' || k === '=') fn = calc.equals;
  else if (k === 'Delete' || k.toLowerCase() === 'c') fn = () => [];
  if (!fn) return;
  e.preventDefault();
  calcDo(fn);
}

// ---------- dice & coin ----------
$('#btn-dice').addEventListener('click', () => openOverlay('ov-dice'));
function spin(el, final, words) {
  el.classList.remove('spin');
  void el.offsetWidth;
  el.classList.add('spin');
  setTimeout(() => {
    el.textContent = final;
    $('#dice-out').textContent = words;
  }, 380);
}
$('#btn-roll').addEventListener('click', () => {
  const n = rollDie(6);
  spin($('#die-face'), String(n), `Rolled a ${n}`);
});
$('#btn-coin').addEventListener('click', () => {
  const c = flipCoin();
  spin($('#coin-face'), c === 'heads' ? 'H' : 'T', c === 'heads' ? 'Heads' : 'Tails');
});

// ---------- settings ----------
$('#app-ver').textContent = `Version ${APP_VERSION}`;
$('#credits-ver').textContent = `PW Counter ${APP_VERSION}`;
$('#btn-set').addEventListener('click', () => openOverlay('ov-set'));
function paintSettings() {
  for (const seg of $$('.seg')) {
    const cur = String(state[seg.dataset.setting]);
    for (const b of $$('button', seg)) b.setAttribute('aria-pressed', String(b.dataset.v === cur));
  }
  $('#set-flip').checked = state.flip;
  $('#set-awake').checked = state.awake;
  $('#set-souls').checked = state.souls;
  $('#set-icons').checked = state.iconsOnly;
  $('#set-rooms').checked = state.rooms;
  if (document.activeElement !== $('#set-name')) $('#set-name').value = state.name;
  $('#row-flip').hidden = state.players === 1;
  $('#row-soulview').hidden = !state.souls;
  $('#soulview-note').hidden = !(state.souls && state.players === 2 && state.soulView === 'cards');
}
for (const seg of $$('.seg')) {
  seg.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const key = seg.dataset.setting;
    const next = setSetting(state, key, key === 'players' ? Number(b.dataset.v) : b.dataset.v);
    if (needsFirst(next) && !needsFirst(state)) askFirst = true;
    commit(next);
  });
}
$('#set-flip').addEventListener('change', (e) => commit(setSetting(state, 'flip', e.target.checked)));
$('#set-awake').addEventListener('change', (e) => commit(setSetting(state, 'awake', e.target.checked)));
$('#set-icons').addEventListener('change', (e) => commit(setSetting(state, 'iconsOnly', e.target.checked)));
$('#set-rooms').addEventListener('change', (e) => commit(setSetting(state, 'rooms', e.target.checked)));
$('#set-name').addEventListener('input', (e) => commit(setSetting(state, 'name', e.target.value)));
$('#set-name').addEventListener('change', (e) => { e.target.value = cleanName(e.target.value); });
$('#btn-room').addEventListener('click', () => openOverlay('ov-room'));
$('#set-souls').addEventListener('change', (e) => {
  const next = setSetting(state, 'souls', e.target.checked);
  if (needsFirst(next)) askFirst = true;
  commit(next);
});
$('#btn-reset').addEventListener('click', () => openOverlay('ov-confirm'));
$('#btn-reset-yes').addEventListener('click', () => {
  commit(resetGame(state));
  askFirst = needsFirst(state);
  closeOverlay();
});

// ---------- keep the screen on ----------
let lock = null;
async function syncWake() {
  if (!('wakeLock' in navigator)) return;
  try {
    if (state.awake && document.visibilityState === 'visible') {
      if (!lock) {
        lock = await navigator.wakeLock.request('screen');
        lock.addEventListener('release', () => { lock = null; });
      }
    } else if (lock) {
      await lock.release();
      lock = null;
    }
  } catch { lock = null; /* low battery or not allowed: the screen just sleeps */ }
}
document.addEventListener('visibilitychange', syncWake);

// another tab or window of the app changed the game
window.addEventListener('storage', (e) => {
  if (e.key !== KEY) return;
  const prev = state;
  state = load();
  render(prev);
});

// ---------- offline ----------
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

render(null);
if (needsResume(state, Date.now())) {
  const days = Math.floor((Date.now() - state.savedAt) / 86400000);
  $('#resume-when').textContent = `Last played ${days >= 2 ? `${days} days` : '2 days'} ago.`;
  openOverlay('ov-resume');
} else {
  maybeAskFirst();
}
$('#btn-resume').addEventListener('click', () => { commit({ ...state }); save(state); closeOverlay(); });
$('#btn-new').addEventListener('click', () => {
  commit(resetGame(state));
  askFirst = needsFirst(state);
  closeOverlay();
});
