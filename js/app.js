// PW Counter: the page. Rules live in state.js / calc.js / random.js (pure, tested).
import { APP_VERSION } from './version.js';
import {
  defaultState, cleanState, step, endTurn, toggleNight, resetGame, setSetting, COUNTERS,
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
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode / full: the game still works this visit */ }
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
const LABEL = { life: 'Life', mat: 'Material', ing: 'Ingredient' };
const ICONS = {
  life: '<svg viewBox="0 0 64 64" aria-hidden="true"><path class="i-heart" d="M32 56C24 49 7 38 7 22 7 13 13.5 7 21 7c5 0 8.6 2.6 11 6.4C34.4 9.6 38 7 43 7c7.5 0 14 6 14 15 0 16-17 27-25 34Z"/><path class="i-shine" d="M15 21c0-4.5 3-7.5 7-7.5"/></svg>',
  mat: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect class="i-log" x="10" y="22" width="40" height="22" rx="11"/><ellipse class="i-ring" cx="47" cy="33" rx="7" ry="11"/><ellipse class="i-core" cx="47" cy="33" rx="3" ry="5"/><path class="i-grain" d="M17 29h18M20 37h14"/></svg>',
  ing: '<svg viewBox="0 0 64 64" aria-hidden="true"><path class="i-leaf" d="M33 19c3-8 11-12 21-11-2 10-9 14-19 13Z"/><path class="i-stem" d="M31 24c0-5 1-8 3-11"/><circle class="i-fruit" cx="31" cy="39" r="17"/><ellipse class="i-shine2" cx="24" cy="32" rx="4.5" ry="3" transform="rotate(-30 24 32)"/></svg>',
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
      <span class="ico">${ICONS[key]}</span>
      <span class="lbl">${LABEL[key]}</span>
      <span class="num" aria-live="polite">0</span>
    </div>
    <span class="pm plus" aria-hidden="true">+</span>
    <span class="delta" aria-hidden="true"></span>${key === 'life' ? '<span class="when" aria-hidden="true"></span>' : ''}`;
  return el;
}

for (const seatEl of $$('.seat')) {
  const res = document.createElement('div');
  res.className = 'res';
  res.append(tile('mat'), tile('ing'));
  const inner = document.createElement('div');
  inner.className = 'seat-in';
  inner.append(res, tile('life'));
  seatEl.append(inner);
}

// ---------- tapping, with hold to repeat ----------
const deltas = new WeakMap(); // tile -> {sum, timer}

function bump(seat, key, d, tileEl) {
  const next = step(state, seat, key, d);
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
  $('[data-seat="1"]').hidden = s.players === 1;
  for (const seatEl of $$('.seat')) {
    const i = Number(seatEl.dataset.seat);
    seatEl.classList.toggle('active', s.players === 2 && s.active === i);
    for (const key of COUNTERS) $(`.t-${key} .num`, seatEl).textContent = String(s.seats[i][key]);
  }
  $('#turn-label').textContent = `Turn ${s.turn}`;
  $('#btn-end').setAttribute('aria-label', s.players === 2 ? `End turn. Turn ${s.turn}, ${s.active === 0 ? 'your' : "the opponent's"} turn.` : `End turn. Turn ${s.turn}.`);
  for (const w of $$('.when')) w.textContent = s.night ? '☾ Night' : '☀ Day';
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
$('#btn-end').addEventListener('click', () => commit(endTurn(state)));

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
$('#btn-set').addEventListener('click', () => openOverlay('ov-set'));
function paintSettings() {
  for (const seg of $$('.seg')) {
    const cur = String(state[seg.dataset.setting]);
    for (const b of $$('button', seg)) b.setAttribute('aria-pressed', String(b.dataset.v === cur));
  }
  $('#set-flip').checked = state.flip;
  $('#set-awake').checked = state.awake;
  $('#row-flip').hidden = state.players === 1;
}
for (const seg of $$('.seg')) {
  seg.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const key = seg.dataset.setting;
    commit(setSetting(state, key, key === 'players' ? Number(b.dataset.v) : b.dataset.v));
  });
}
$('#set-flip').addEventListener('change', (e) => commit(setSetting(state, 'flip', e.target.checked)));
$('#set-awake').addEventListener('change', (e) => commit(setSetting(state, 'awake', e.target.checked)));
$('#btn-reset').addEventListener('click', () => openOverlay('ov-confirm'));
$('#btn-reset-yes').addEventListener('click', () => {
  commit(resetGame(state));
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
