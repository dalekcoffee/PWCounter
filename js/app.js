// PW Counter: the page. Rules live in state.js / calc.js / random.js (pure, tested).
import { APP_VERSION } from './version.js';
import {
  defaultState, cleanState, step, endTurn, toggleNight, resetGame, setSetting, COUNTERS,
  SOUL_MAX, soulDisplay, needsFirst, chooseFirst, restSoul, addSoul, toggleSoul, needsResume, cleanName,
} from './state.js';
import * as calc from './calc.js';
import { rollDie, flipCoin } from './random.js';
import { dieTarget, coinTarget } from './dice-anim.js';
import { initRoom } from './room-ui.js';
import { codeFromHash, watchFromHash } from './room-proto.js';

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

function commit(next, remote = false) {
  next = roomUi.settle(next); // in a room nobody is asked who goes first
  if (next === state) return;
  const prev = state;
  state = next;
  save(state);
  render(prev);
  roomUi.changed(prev, state, remote);
}

// ---------- seats ----------
const LABEL = { life: 'Life', mat: 'Material', ing: 'Ingredient', soul: 'Souls' };
const ICONS = {
  life: '<svg viewBox="4 4 56 56" aria-hidden="true"><path class="i-heart" d="M32 56C24 49 7 38 7 22 7 13 13.5 7 21 7c5 0 8.6 2.6 11 6.4C34.4 9.6 38 7 43 7c7.5 0 14 6 14 15 0 16-17 27-25 34Z"/><path class="i-shine" d="M15 21c0-4.5 3-7.5 7-7.5"/></svg>',
  mat: '<svg viewBox="1 1 62 62" aria-hidden="true"><g transform="rotate(-22 32 32)"><rect class="i-log" x="13" y="16" width="48" height="32" rx="16"/><path class="i-grain" d="M31 23h15M42 32h11M32 41h13"/><ellipse class="i-end" cx="16" cy="32" rx="13" ry="17"/><ellipse class="i-rings" cx="16" cy="32" rx="8" ry="11"/><path class="i-rings" d="M16 28c2.8 0 4.2 2 4.2 4.2s-1.9 4-4.2 4-3-1.4-3-2.8"/></g></svg>',
  soul: '<svg viewBox="4.5 4 54 54" aria-hidden="true"><path class="i-wisp" d="M33 6c2 9 14 13 16 26 2 12-6 24-17 24S13 48 14 37c1-8 7-11 8-18 4 4 4 9 3 12 5-4 9-13 8-25Z"/><path class="i-wisp-in" d="M32 30c1 5 8 7 8 14 0 5-4 8-8 8s-8-3-8-8c0-4 3-6 4-9 2 2 2 4 2 6 2-3 3-7 2-11Z"/></svg>',
  ing: '<svg viewBox="2 2 60 60" aria-hidden="true"><path class="i-leaf" d="M35 18c4-8 13-12 23-10-2.5 9-11 13-21 12Z"/><path class="i-fruit" d="M33 19c-5-4-14-5-20 1-6 6-7 17-3 26 4 9 11 13 18 12 3 0 4-1 6-1s3 1 6 1c8 0 15-8 17-18 2-9-2-17-9-21-5-2-10 0-15 0Z"/><path class="i-stem" d="M33 21c0-4 1-7 3-9"/><rect class="i-shine2" x="15" y="27" width="6" height="13" rx="3" transform="rotate(12 18 33)"/></svg>',
};

// online play: the room sheet, the opponent drawer (js/room-ui.js); declared here, used by commit / render
const roomUi = initRoom({
  $, $$, stage, icons: ICONS, getState: () => state, commit: (n, r) => commit(n, r), render: () => render(state),
  openOverlay: (id) => openOverlay(id), closeOverlay: (q) => closeOverlay(q),
});

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
        <div class="sc-body">
          <div class="sc-row">${Array.from({ length: SOUL_MAX }, (_, i) => `<button type="button" class="sc-card" data-i="${i}"></button>`).join('')}</div>
          <button type="button" class="hit sc-hit minus" data-d="-1" aria-label="Rest a soul (pay)"></button>
          <button type="button" class="hit sc-hit plus" data-d="1" aria-label="Stand a soul again"></button>
          <span class="pm minus sc-pm" aria-hidden="true">−</span>
          <span class="pm plus sc-pm" aria-hidden="true">+</span>
        </div>
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
  showDelta(tileEl, d);
}

/** The "+2" / "−3" badge on a tile: taps within 5 s add up, then it fades. */
function showDelta(tileEl, d) {
  if (!d) return;
  const info = deltas.get(tileEl) || { sum: 0, timer: 0 };
  info.sum += d;
  clearTimeout(info.timer);
  const out = $('.delta', tileEl);
  out.textContent = info.sum > 0 ? `+${info.sum}` : info.sum < 0 ? `−${-info.sum}` : '';
  out.classList.toggle('neg', info.sum < 0);
  out.classList.add('show');
  info.timer = setTimeout(() => { info.sum = 0; out.classList.remove('show'); }, 5000);
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
let lastNight = null;
function render(prev) {
  const s = state;
  const night = roomUi.watching() ? roomUi.watchNight() : s.night; // watching: the sky follows the game on the table
  stage.dataset.time = night ? 'night' : 'day';
  const inRoom = roomUi.active(); // in a room your seat is the one-player layout, whatever the players setting says
  const players = inRoom ? 1 : s.players;
  stage.dataset.players = String(players);
  stage.dataset.land = s.landscape;
  stage.dataset.flip = players === 2 && s.flip ? 'on' : 'off';
  stage.dataset.souls = s.souls ? 'on' : 'off';
  stage.dataset.icons = s.iconsOnly ? 'only' : 'words';
  $('#btn-room').hidden = !s.rooms || (s.players === 2 && !inRoom); // online play replaces the shared-phone view, so it is offered from one player
  const sd = soulDisplay(s.soulStyle, players === 1);
  stage.dataset.soulview = s.souls && sd.cards && !sd.number ? 'cards' : 'number'; // the cards ARE the tile
  stage.dataset.soulbg = s.souls && sd.cards && sd.number ? 'on' : 'off'; // the cards are a faint background behind the count
  stage.dataset.soultap = sd.cards && !sd.number && !sd.tapCards ? 'halves' : 'card';
  $('[data-seat="1"]').hidden = players === 1;
  for (const seatEl of $$('.seat')) {
    const i = Number(seatEl.dataset.seat);
    const seat = s.seats[i];
    seatEl.classList.toggle('active', (players === 2 || inRoom) && s.active === i);
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
  const oneSouls = players === 1 && s.souls && !inRoom;
  const setup = needsFirst(s) && !inRoom; // souls on, who goes first not chosen yet
  $('.et-word').textContent = setup ? 'Start game' : oneSouls ? 'Start turn' : 'End Turn';
  $('#btn-end').classList.toggle('long', setup);
  $('#turn-label').textContent = setup ? 'Who goes first?' : oneSouls && s.turn === 0 ? 'Going second' : `Turn ${s.turn}`;
  $('#btn-end').setAttribute('aria-label', setup ? 'Start game: choose who goes first.' : oneSouls ? 'Start my turn: my souls stand and I get 2 more.' : s.players === 2 ? `End turn. Turn ${s.turn}, ${s.active === 0 ? 'your' : "the opponent's"} turn.` : `End turn. Turn ${s.turn}.`);
  const tb = $('#btn-time');
  tb.setAttribute('aria-pressed', String(s.night));
  tb.setAttribute('aria-label', s.night ? 'It is night. Tap to make it day.' : 'It is day. Tap to make it night.');
  $('.dn-word', tb).textContent = s.night ? 'Night' : 'Day';
  if (lastNight !== null && lastNight !== night) {
    stage.classList.remove('flash');
    void stage.offsetWidth; // restart the animation
    stage.classList.add('flash');
  }
  lastNight = night;
  paintSettings();
  roomUi.paint();
  if (!prev || prev.awake !== s.awake) syncWake();
}

// ---------- bar ----------
$('#btn-time').addEventListener('click', () => commit(toggleNight(state)));
$('#btn-end').addEventListener('click', () => {
  if (roomUi.active()) { commit(roomUi.endTurn(state)); return; }
  if (needsFirst(state)) { openOverlay('ov-first'); return; }
  commit(endTurn(state));
});

// souls: total +/- and the cards view
stage.addEventListener('click', (e) => {
  const add = e.target.closest('[data-add]');
  const card = stage.dataset.soulview === 'cards' && stage.dataset.soultap === 'card' ? e.target.closest('.sc-card') : null;
  if (!add && !card) return;
  const seat = Number(e.target.closest('.seat').dataset.seat);
  const before = state.seats[seat].up;
  if (add) commit(addSoul(state, seat, Number(add.dataset.add)));
  else commit(toggleSoul(state, seat, Number(card.dataset.i)));
  try { navigator.vibrate?.(6); } catch { /* not allowed */ }
  showDelta(e.target.closest('.t-soul'), state.seats[seat].up - before);
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
// Installed app: the manifest asks for full screen, but an installed copy can keep an older manifest
// (or the phone may open it as a window), so the app also goes full screen itself on the first tap.
// Browsers only allow that from a tap. iPhone has no full screen API for pages: it shows no browser bars instead.
const installed = matchMedia('(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)').matches || navigator.standalone === true;
const goFull = () => document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {});
fullBtn.hidden = !document.fullscreenEnabled || (installed && state.autoFull && !!document.fullscreenElement);
document.addEventListener('fullscreenchange', () => {
  fullBtn.hidden = !document.fullscreenEnabled || (installed && state.autoFull && !!document.fullscreenElement);
});
fullBtn.addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else goFull();
});
// every tap while not full screen tries again (leaving the app or the system back gesture ends full screen)
document.addEventListener('pointerup', () => {
  if (installed && state.autoFull && document.fullscreenEnabled && !document.fullscreenElement) goFull();
}, true);

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
  if (openId === 'ov-sync' && quiet !== 'force' && quiet !== true) return; // the counters must be agreed on (or the room left)
  $(`#${openId}`).hidden = true;
  if (openId === 'ov-room') roomUi.closed();
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
  if (e.key === 'Escape' && !openId && roomUi.escape()) { e.preventDefault(); return; }
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
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
// Rounded die: six faces with rounded corners, plus a slightly smaller solid core whose edges fill the
// rounded corners, so a turning die shows a solid body instead of square faces with see-through corners.
function buildDie(el) {
  for (let n = 1; n <= 6; n++) {
    const c = document.createElement('div');
    c.className = `die-core c${n}`;
    el.append(c);
  }
  for (let n = 1; n <= 6; n++) {
    const f = document.createElement('div');
    f.className = `die-f f${n}`;
    f.innerHTML = PIPS[n].map((p) => `<i style="grid-area:p${p}"></i>`).join('');
    el.append(f);
  }
}
const COIN_HTML = `
  <div class="coin-edge"></div>
  <div class="coin-f heads"><svg viewBox="0 0 64 64" aria-hidden="true"><circle class="c-rim" cx="32" cy="32" r="29"/><circle class="c-sun" cx="32" cy="22" r="6"/><path class="c-rays" d="M32 8v4M32 32v4M16 22h4M44 22h4M21 11l3 3M43 11l-3 3M21 33l3-3M43 33l-3-3"/><text x="32" y="55" text-anchor="middle" class="c-letter">H</text></svg></div>
  <div class="coin-f tails"><svg viewBox="0 0 64 64" aria-hidden="true"><circle class="c-rim" cx="32" cy="32" r="29"/><path class="c-moon" d="M38 9a14 14 0 1 0 0 26 11 11 0 1 1 0-26Z"/><circle class="c-star" cx="46" cy="30" r="1.6"/><text x="32" y="55" text-anchor="middle" class="c-letter">T</text></svg></div>`;
$$('[data-die]').forEach(buildDie);
$$('[data-coin]').forEach((el) => { el.innerHTML = COIN_HTML; });
const die = $('#die');
const coin = $('#coin');
$('.dice .die').style.transform = 'rotateX(-20deg) rotateY(25deg)';
$('.dice .coin').style.transform = 'rotateX(0deg)';

let dieAt = [-20, 25], coinAt = 0, busy = false, kind = 'die';
const setDie = (a, ms) => { die.style.transition = ms ? `transform ${ms}ms cubic-bezier(.15,.7,.2,1)` : 'none'; die.style.transform = `rotateX(${a[0]}deg) rotateY(${a[1]}deg)`; };
const setCoin = (a, ms) => { coin.style.transition = ms ? `transform ${ms}ms cubic-bezier(.3,.6,.3,1)` : 'none'; coin.style.transform = `rotateX(${a}deg)`; };
setDie(dieAt, 0);
setCoin(coinAt, 0);
function play(scene, ms, start, words) {
  if (busy) return; // taps during a roll are ignored
  busy = true;
  const out = $('#throw-out');
  const again = $('#btn-again');
  out.classList.remove('show');
  out.textContent = '\u00a0';
  again.disabled = true;
  const done = () => {
    out.textContent = words; out.classList.add('show');
    busy = false; again.disabled = false;
    $('#ov-throw').classList.remove('going');
  };
  if (reduceMotion()) { start(0); done(); return; }
  void scene.offsetWidth;
  $('#ov-throw').classList.add('going');
  start(ms);
  setTimeout(done, ms + 40);
}
function rollNow() {
  const n = rollDie(6); // the result is decided here; the die only shows it
  dieAt = dieTarget(dieAt, n);
  play($('#die-scene'), 1300, (ms) => setDie(dieAt, ms), `Rolled a ${n}`);
}
function flipNow() {
  const c = flipCoin();
  coinAt = coinTarget(coinAt, c, 6);
  play($('#coin-scene'), 1500, (ms) => setCoin(coinAt, ms), c === 'heads' ? 'Heads' : 'Tails');
}
function throwBig(k) {
  kind = k;
  const ov = $('#ov-throw');
  ov.dataset.kind = k;
  $('#btn-again').textContent = k === 'die' ? 'Roll again' : 'Flip again';
  openOverlay('ov-throw'); // replaces the chooser sheet
  (k === 'die' ? rollNow : flipNow)();
}
$('#btn-roll').addEventListener('click', () => throwBig('die'));
$('#btn-coin').addEventListener('click', () => throwBig('coin'));
$('#btn-again').addEventListener('click', () => (kind === 'die' ? rollNow : flipNow)());
// a tap on the big die / coin throws again too
$('.throw-stage').addEventListener('click', () => { if (!busy) (kind === 'die' ? rollNow : flipNow)(); });

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
  $('#set-autofull').checked = state.autoFull;
  $('#set-souls').checked = state.souls;
  $('#set-icons').checked = state.iconsOnly;
  $('#set-rooms').checked = state.rooms;
  if (document.activeElement !== $('#set-name')) $('#set-name').value = state.name;
  $('#row-flip').hidden = state.players === 1;
  $('#row-soulstyle').hidden = !state.souls;
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
$('#set-autofull').addEventListener('change', (e) => commit(setSetting(state, 'autoFull', e.target.checked)));
$('#set-awake').addEventListener('change', (e) => commit(setSetting(state, 'awake', e.target.checked)));
$('#set-icons').addEventListener('change', (e) => commit(setSetting(state, 'iconsOnly', e.target.checked)));
$('#set-rooms').addEventListener('change', (e) => { commit(setSetting(state, 'rooms', e.target.checked)); if (!e.target.checked) roomUi.forget(); });
$('#set-name').addEventListener('input', (e) => commit(setSetting(state, 'name', e.target.value)));
$('#set-name').addEventListener('change', (e) => { e.target.value = cleanName(e.target.value); });
$('#btn-room').addEventListener('click', () => roomUi.openSheet());
$('#set-souls').addEventListener('change', (e) => {
  const next = setSetting(state, 'souls', e.target.checked);
  if (needsFirst(next)) askFirst = true;
  commit(next);
});
$('#btn-reset').addEventListener('click', () => openOverlay('ov-confirm'));
$('#btn-reset-yes').addEventListener('click', () => {
  roomUi.forget();
  commit(roomUi.afterReset(resetGame(state)));
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

// ---------- #join=DDDD (from a QR code or a link) ----------
let pendingJoin = codeFromHash(location.hash);
let pendingWatch = watchFromHash(location.hash); // '0427' | '' (a bare #watch: ask for the code) | null
if (pendingJoin || pendingWatch !== null) history.replaceState(null, '', location.pathname + location.search);
function runPendingWatch() { // watching needs no experimental switch: a TV just opens the link
  const code = pendingWatch;
  pendingWatch = null;
  if (code === null) return;
  if (code) roomUi.watch(code); else roomUi.openWatchSheet();
}
function runPendingJoin() {
  if (pendingWatch !== null) { runPendingWatch(); return; }
  const code = pendingJoin;
  pendingJoin = null;
  if (!code) return;
  if (state.rooms) { openOverlay('ov-room'); roomUi.join(code); return; }
  $('#join-ask-code').textContent = code;
  $('#btn-join-on').onclick = () => { commit(setSetting(state, 'rooms', true)); openOverlay('ov-room'); roomUi.join(code); };
  openOverlay('ov-joinask');
}
addEventListener('hashchange', () => {
  const c = codeFromHash(location.hash);
  const w = watchFromHash(location.hash);
  if (!c && w === null) return;
  history.replaceState(null, '', location.pathname + location.search);
  if (w !== null) { pendingWatch = w; runPendingWatch(); return; }
  pendingJoin = c;
  if (openId !== 'ov-resume') runPendingJoin();
});

// ---------- rejoin a remembered room (< 48 hours old) ----------
function openRejoin() {
  const rec = roomUi.remembered();
  if (!rec) return false;
  if (performance.getEntriesByType?.('navigation')?.[0]?.type === 'reload') { roomUi.rejoin(rec); return false; } // a plain reload goes straight back
  $('#rejoin-line').textContent = roomUi.rejoinLine(rec);
  $('#btn-rejoin').onclick = () => { closeOverlay(true); roomUi.rejoin(rec); maybeAskFirst(); };
  $('#btn-rejoin-no').onclick = () => { roomUi.forget(); closeOverlay(); };
  openOverlay('ov-rejoin');
  return true;
}

render(null);
if (pendingWatch !== null) {
  runPendingWatch(); // a watch link never asks about the saved game
} else if (needsResume(state, Date.now())) {
  const days = Math.floor((Date.now() - state.savedAt) / 86400000);
  $('#resume-when').textContent = `Last played ${days >= 2 ? `${days} days` : '2 days'} ago.`;
  openOverlay('ov-resume');
} else if (pendingJoin) {
  runPendingJoin();
} else if (roomUi.resumeWatch()) {
  /* a reload while watching keeps watching (this tab only) */
} else if (!openRejoin()) {
  maybeAskFirst();
}
$('#btn-resume').addEventListener('click', () => { commit({ ...state }); save(state); closeOverlay(true); if (pendingJoin) runPendingJoin(); else maybeAskFirst(); });
$('#btn-new').addEventListener('click', () => {
  roomUi.forget();
  commit(resetGame(state));
  askFirst = needsFirst(state);
  closeOverlay(true);
  if (pendingJoin) runPendingJoin(); else maybeAskFirst();
});
