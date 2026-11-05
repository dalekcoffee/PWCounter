// "Play with a friend": the room sheet, the scanner, the opponent drawer. The rules are pure (room-game.js, room-proto.js, drawer.js).
import { ROOM_URL } from './room-config.js';
import { fakeAllowed, fakeTransport } from './room-fake.js';
import { createRoom, webSocketTransport, readSession, readWatch } from './room.js';
import { rememberedRoom, rejoinLine, ROOM_KEY } from './room-memory.js';
import { applyPick, syncCards } from './room-sync.js';
import { makeCode, validCode, cleanCode, joinLink, watchLink, watchText, codeFromScan, passTurn } from './room-proto.js';
import { displayView, createDeltas, deltaText, AUTO_WATCH_NOTICE } from './room-display.js';
import { startRoomGame, afterRoomReset, leaveRoomState, settleRoom, applyShared, sharedOf, sharedDiffers, selfDiffers, statusText, handleView, turnText, turnWords } from './room-game.js';
import { toggleDrawer, setDrawer, initialDrawer, toStageDy, dragResult, dragProgress, DRAG_MIN } from './drawer.js';
import { setText, setHidden, setProp, setData, setAttr } from './dom-write.js';

const LABEL = { life: 'Life', mat: 'Material', ing: 'Ingredient', soul: 'Souls' };

/** ctx: {$, $$, stage, getState, commit(next, remote), openOverlay, closeOverlay, icons, setRooms(bool)} */
export function initRoom(ctx) {
  const { $, stage, icons } = ctx;
  const fake = fakeAllowed(location);
  const available = !!ROOM_URL || fake;
  const room = createRoom({
    makeTransport: fake ? fakeTransport : webSocketTransport(ROOM_URL || 'https://invalid.invalid'),
    storage: localStorage,
    watchStorage: (() => { try { return sessionStorage; } catch { return null; } })(), // a watched room is remembered for this tab only
    newCode: () => makeCode(),
    getSelf: () => { const s = ctx.getState(); return { name: s.name, seat: s.seats[0], souls: s.souls }; },
    getShared: () => sharedOf(ctx.getState()),
    onShared: (sh) => ctx.commit(applyShared(ctx.getState(), sh), true),
    onApply: (use, theirs) => { ctx.commit(applyPick(ctx.getState(), use, theirs)); toast(use === 'me' ? 'Using your counters' : `Using ${R.peerName || 'your friend'}'s counters`); },
    onChange: () => onRoomChange(),
  });
  const R = room.state;
  let view = 'pick'; // pick | join | watch (the sheet, while not in a room)
  let joinBefore = null; // my game as it was before I joined as a guest (a refused guest gets it back untouched)
  let viewNotice = ''; // one line on the display ("You're watching")
  let notice = '';
  let drawer = initialDrawer();

  const active = () => R.status !== 'idle'; // in a room as a player OR as a viewer
  const playing = () => active() && R.role !== 'watch';
  const watching = () => active() && R.role === 'watch';
  const refresh = () => ctx.render();

  // ---------- starting and leaving ----------
  function begin(role, code) {
    notice = '';
    stopScan();
    joinBefore = role === 'guest' ? ctx.getState() : null;
    ctx.commit(startRoomGame(ctx.getState(), role));
    if (role === 'host') room.host(code); else room.join(code);
    drawer = initialDrawer();
    refresh();
  }
  function host() { begin('host', makeCode()); }
  function join(raw) { const c = cleanCode(raw); if (validCode(c)) begin('guest', c); }
  /** Watch a room read only (a TV link, the sheet, or a refused guest). Needs the relay but not the `rooms` switch. */
  function watch(raw, opts = {}) {
    const c = cleanCode(raw);
    if (!validCode(c)) return;
    if (!available) { hooks.openSheet(); return; } // "isn't set up on this server yet"
    if (playing()) leave();
    stopScan();
    ctx.closeOverlay('force');
    viewNotice = opts.note || '';
    deltas.clear();
    room.watch(c, { sid: opts.sid });
    refresh();
  }
  function leaveWatch() {
    if (!watching()) return;
    room.leave();
    viewNotice = '';
    deltas.clear();
    refresh();
  }
  function leave() {
    if (!active()) return;
    room.leave();
    stopScan();
    drawer = initialDrawer();
    ctx.commit(leaveRoomState(ctx.getState()), true);
    refresh();
  }
  function onRoomChange() {
    if (R.status === 'full' && R.role === 'guest') { // two players are already there: watch instead (the game on this phone stays as it was)
      const code = R.code, before = joinBefore;
      room.leave();
      if (before) ctx.commit(before, true);
      watch(code, { note: AUTO_WATCH_NOTICE });
      return;
    }
    if (R.status === 'full' || R.status === 'busy') { notice = statusText(R); room.leave(); view = R.status === 'busy' ? 'pick' : 'join'; ctx.commit(leaveRoomState(ctx.getState()), true); }
    if (!R.peer && drawer.open) drawer = setDrawer(drawer, false);
    if (R.codeChanged) { R.codeChanged = false; view = 'pick'; notice = `Your old code was taken. Share this new code with ${R.peerName || 'your friend'}.`; ctx.openOverlay('ov-room'); }
    refresh();
  }

  // ---------- hooks for app.js ----------
  const hooks = {
    available, active: playing, playing, watching, join, host, leave, watch, leaveWatch,
    /** next state before it is stored: a room never asks who goes first */
    settle: (s) => (playing() ? settleRoom(s, R.role) : s),
    afterReset: (s) => (playing() ? afterRoomReset(s, R.role) : s),
    endTurn: (s) => passTurn(s, R.role),
    changed(prev, next, remote) {
      if (!playing()) return;
      if (!next.rooms) { leave(); return; }
      if (!remote && sharedDiffers(sharedOf(prev), sharedOf(next))) room.sharedChanged();
      if (selfDiffers(prev, next)) room.selfChanged();
    },
    remembered: () => (available && ctx.getState().rooms ? readSession(localStorage, Date.now()) : null),
    rejoin(rec) { notice = ''; room.rejoin(rec); refresh(); },
    forget() { if (!playing()) { try { localStorage.removeItem(ROOM_KEY); } catch { /* private mode */ } } },
    rejoinLine,
    openSheet() { view = 'pick'; notice = ''; refresh(); ctx.openOverlay('ov-room'); },
    openWatchSheet() { view = 'watch'; notice = ''; refresh(); ctx.openOverlay('ov-room'); $('#watch-code').value = ''; $('#watch-code').focus({ preventScroll: true }); },
    /** A reload keeps watching (this tab only). */
    resumeWatch() { const w = available ? readWatch(window.sessionStorage) : null; if (!w) return false; watch(w.code, { sid: w.sid }); return true; },
    /** Day or night as the players share it, while watching (else null). */
    watchNight: () => (watching() ? displayView(R).night : null),
    paint: paintAll,
    escape() { if (drawer.open) { drawer = setDrawer(drawer, false); paintDrawer(); return true; } return false; },
  };

  // ---------- a one-line banner ----------
  let toastTimer = 0;
  function toast(text) {
    const t = $('#room-toast');
    t.textContent = text; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
  }

  // ---------- "Your counters don't match" ----------
  let syncOpen = false;
  const cardHtml = (card, diff, nameYou, nameThem, souls) => {
    const row = (label, v, key) => `<li${diff.has(key) ? ' class="d"' : ''}><span>${label}</span><b>${v}${diff.has(key) ? ' <i aria-label="differs">●</i>' : ''}</b></li>`;
    const seat = (who, name, s) => `<h4>${name}</h4><ul>${row('Life', s.life, `${who}.life`)}${row('Material', s.mat, `${who}.mat`)}${row('Ingredient', s.ing, `${who}.ing`)}${souls ? row('Souls', `${s.up} of ${s.soul}`, `${who}.soul`) : ''}</ul>`;
    return `<h3>${card.title}</h3>${seat('me', nameYou, card.you)}${seat('them', nameThem, card.them)}<ul class="sh">${row('Time', card.shared.night ? 'Night' : 'Day', 'night')}${row('Turn', `${card.shared.turn}, ${card.shared.active === 0 ? nameYou : nameThem}`, 'turn')}</ul>`;
  };
  function paintSync() {
    const sy = R.sync;
    if (sy && !syncOpen) { syncOpen = true; ctx.openOverlay('ov-sync'); }
    if (!sy && syncOpen) { syncOpen = false; ctx.closeOverlay('force'); if (R.lastPick) R.lastPick = null; }
    if (!sy) return;
    const name = R.peerName || 'your friend';
    const souls = ctx.getState().souls || !!R.peer?.souls;
    const c = syncCards(sy.snap, sy.theirs, name);
    $('#sync-mine').innerHTML = cardHtml(c.mine, c.diff, 'You', name, souls);
    $('#sync-theirs').innerHTML = cardHtml(c.theirs, c.diff, 'You', name, souls);
    setProp($('#sync-use-mine'), 'disabled', sy.waiting);
    setProp($('#sync-use-theirs'), 'disabled', sy.waiting);
    setText($('#sync-use-theirs'), `Use ${name}'s counters`);
    setHidden($('#sync-wait'), !sy.waiting);
  }
  $('#sync-use-mine').addEventListener('click', () => room.choose('me'));
  $('#sync-use-theirs').addEventListener('click', () => room.choose('you'));
  $('#sync-leave').addEventListener('click', () => { syncOpen = false; leave(); ctx.closeOverlay('force'); });

  // ---------- the sheet ----------
  const show = (id, on) => { $(`#${id}`).hidden = !on; };
  // The QR encoder (46 KB) loads the first time a QR code is shown, not with the counter; then everything repaints.
  let qrSvg = null, qrLoad = null;
  function qrReady() {
    if (!qrLoad) qrLoad = import('./qr.js').then((m) => { qrSvg = m.qrSvg; paintAll(); }, () => { qrLoad = null; });
    return !!qrSvg;
  }
  function paintSheet() {
    const live = playing();
    show('rv-off', !available);
    show('rv-pick', available && !live && view === 'pick');
    show('rv-join', available && !live && view === 'join');
    show('rv-watch', available && !live && view === 'watch');
    show('rv-live', available && live);
    setText($('#room-note'), notice);
    setHidden($('#room-note'), !notice);
    if (live) {
      setText($('#rv-code'), R.code);
      setText($('#rv-status'), statusText(R));
      const showQr = R.role === 'host' && R.status !== 'connected';
      setHidden($('#rv-qrwrap'), !showQr);
      if (showQr) {
        if ($('#rv-qr').dataset.code !== R.code && qrReady()) { $('#rv-qr').innerHTML = qrSvg(joinLink(R.code)); $('#rv-qr').dataset.code = R.code; }
      }
      setText($('#rv-watchlink'), watchLink(R.code));
      setHidden($('#rv-qr2'), showQr); // the join code is the one to scan while waiting; the big-screen code follows
      if ($('#rv-qr2').dataset.code !== R.code && qrReady()) { $('#rv-qr2').innerHTML = qrSvg(watchLink(R.code)); $('#rv-qr2').dataset.code = R.code; }
    }
    setHidden($('#btn-scan'), !('BarcodeDetector' in window));
    setHidden($('#scan-hint'), 'BarcodeDetector' in window);
  }
  $('#btn-room-host').addEventListener('click', host);
  $('#btn-room-watch').addEventListener('click', () => { view = 'watch'; notice = ''; paintSheet(); $('#watch-code').value = ''; $('#watch-code').focus({ preventScroll: true }); });
  $('#btn-watch-back').addEventListener('click', () => { view = 'pick'; paintSheet(); });
  $('#watch-code').addEventListener('input', (e) => {
    const c = cleanCode(e.target.value);
    e.target.value = c;
    if (validCode(c)) watch(c);
  });
  $('#btn-copy-watch').addEventListener('click', async (e) => {
    const b = e.currentTarget, link = watchLink(R.code);
    try { await navigator.clipboard.writeText(link); b.textContent = 'Copied'; } catch { b.textContent = 'Copy failed'; }
    setTimeout(() => { b.textContent = 'Copy'; }, 1600);
  });
  $('#btn-room-join').addEventListener('click', () => { view = 'join'; notice = ''; paintSheet(); $('#join-code').value = ''; $('#join-code').focus({ preventScroll: true }); });
  $('#btn-join-back').addEventListener('click', () => { stopScan(); view = 'pick'; paintSheet(); });
  $('#btn-room-leave').addEventListener('click', () => { leave(); ctx.closeOverlay(); });
  $('#join-code').addEventListener('input', (e) => {
    const c = cleanCode(e.target.value);
    e.target.value = c;
    if (validCode(c)) join(c);
  });

  // ---------- the QR scanner (only where BarcodeDetector exists) ----------
  let scan = null;
  function stopScan() {
    if (!scan) return;
    clearInterval(scan.timer);
    scan.stream.getTracks().forEach((t) => t.stop());
    scan = null;
    const v = $('#scan-video'); v.srcObject = null; setHidden(v, true);
    setText($('#btn-scan'), 'Scan QR code');
  }
  $('#btn-scan').addEventListener('click', async () => {
    if (scan) { stopScan(); return; }
    try {
      const det = new BarcodeDetector({ formats: ['qr_code'] });
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      const v = $('#scan-video');
      v.srcObject = stream; setHidden(v, false); await v.play();
      setText($('#btn-scan'), 'Stop scanning');
      scan = { stream, timer: setInterval(async () => {
        try {
          const found = await det.detect(v);
          const c = found.map((f) => codeFromScan(f.rawValue)).find(Boolean);
          if (c) { stopScan(); join(c); }
        } catch { /* a frame that cannot be read */ }
      }, 250) };
    } catch { notice = 'The camera could not be opened. Type the code instead.'; paintSheet(); }
  });

  // ---------- the opponent drawer ----------
  const opp = $('#opp');
  const body = $('#opp-body');
  const handle = $('#opp-handle');
  const tiles = {};
  for (const key of ['life', 'mat', 'ing', 'soul']) {
    const t = document.createElement('div');
    t.className = `tile ro t-${key}`;
    t.innerHTML = `<div class="core"><span class="head"><span class="ico">${icons[key]}</span><span class="lbl">${LABEL[key]}</span></span><span class="num">0</span>${key === 'soul' ? '<span class="of">of <b>0</b></span>' : ''}</div>`;
    body.append(t);
    tiles[key] = t;
  }
  function paintDrawer() {
    const on = playing();
    const mark = $('#room-mark'); // a faint line on the board: how others can watch
    setHidden(mark, !on);
    setText(mark, on ? `Room ${R.code} \u00b7 watch at ${watchText(R.code)}` : '');
    setHidden(opp, !on);
    setData(stage, 'room', on ? 'on' : 'off');
    if (!on) return;
    const hv = handleView(R);
    const peer = R.peer;
    setText($('#opp-name'), hv.here ? hv.name : hv.text);
    setHidden($('#opp-life'), !hv.here);
    setText($('#opp-life b'), hv.here ? String(hv.life) : '');
    const open = drawer.open && !!peer;
    setData(opp, 'open', open ? 'on' : 'off');
    setAttr(handle, 'aria-expanded', String(open));
    setAttr(handle, 'aria-label', hv.here ? `${hv.name}, life ${hv.life}. ${open ? 'Close' : 'Open'} the opponent's counters.` : `${hv.text}. Show the room code.`);
    setData(opp, 'souls', peer?.souls ? 'on' : 'off');
    setHidden(tiles.soul, !peer?.souls);
    if (peer) {
      for (const key of ['life', 'mat', 'ing']) {
        const n = $('.num', tiles[key]); setText(n, String(peer.seat[key])); setData(n, 'len', String(Math.max(2, String(peer.seat[key]).length)));
      }
      setText($('.num', tiles.soul), String(peer.seat.up));
      setText($('.of b', tiles.soul), String(peer.seat.soul));
    }
  }
  let drag = null;
  handle.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    drag = { x: e.clientX, y: e.clientY, was: drawer.open && !!R.peer, moved: false, id: e.pointerId };
    try { handle.setPointerCapture(e.pointerId); } catch { /* not supported */ }
  });
  handle.addEventListener('pointermove', (e) => {
    if (!drag || !R.peer) return;
    const dy = toStageDy(stage.dataset.land, e.clientX - drag.x, e.clientY - drag.y);
    if (!drag.moved && Math.abs(dy) < DRAG_MIN) return;
    drag.moved = true;
    setData(opp, 'drag', 'on');
    opp.style.setProperty('--p', String(dragProgress(drag.was, dy, body.offsetHeight)));
  });
  const endDrag = (e, cancel) => {
    if (!drag) return;
    const d = drag; drag = null;
    opp.removeAttribute('data-drag');
    opp.style.removeProperty('--p');
    if (cancel) { paintDrawer(); return; }
    if (!R.peer) { hooks.openSheet(); return; }
    const r = dragResult(d.was, toStageDy(stage.dataset.land, e.clientX - d.x, e.clientY - d.y));
    drawer = r === null ? toggleDrawer({ open: d.was }) : setDrawer({ open: d.was }, r);
    paintDrawer();
  };
  handle.addEventListener('pointerup', (e) => endDrag(e, false));
  handle.addEventListener('pointercancel', (e) => endDrag(e, true));
  handle.addEventListener('click', (e) => { // keyboard (detail 0); taps are handled above
    if (e.detail !== 0) return;
    if (!R.peer) { hooks.openSheet(); return; }
    drawer = toggleDrawer(drawer); paintDrawer();
  });

  // ---------- the display (watching: read only, nothing upside down, for a TV) ----------
  const deltas = createDeltas();
  const disp = $('#display');
  const sunSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.3M12 19.1v2.3M2.6 12h2.3M19.1 12h2.3M5.4 5.4l1.6 1.6M17 17l1.6 1.6M5.4 18.6 7 17M17 7l1.6-1.6"/></svg>';
  const moonSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/></svg>';
  const panelHtml = (role) => `
    <article class="dp-panel" data-role="${role}" data-state="waiting" data-active="off">
      <header class="dp-ph"><h2 class="dp-name"></h2><span class="dp-their">Their turn</span></header>
      <div class="dp-life"><span class="ico">${icons.life}</span><b class="dp-num" data-k="life">0</b><span class="delta" aria-hidden="true"></span></div>
      <div class="dp-res">
        <div class="dp-r" data-k="mat"><span class="ico">${icons.mat}</span><span class="lbl">Material</span><b class="dp-n">0</b><span class="delta" aria-hidden="true"></span></div>
        <div class="dp-r" data-k="ing"><span class="ico">${icons.ing}</span><span class="lbl">Ingredient</span><b class="dp-n">0</b><span class="delta" aria-hidden="true"></span></div>
      </div>
      <div class="dp-souls" data-k="up"><span class="ico">${icons.soul}</span><span class="lbl">Souls</span><b class="dp-n">0</b><span class="dp-of"></span><span class="delta" aria-hidden="true"></span></div>
      <p class="dp-wait">Waiting for player\u2026</p>
    </article>`;
  disp.innerHTML = `
    <header class="dp-top">
      <span class="dp-chip" id="dp-time" data-time="day"><span class="dp-sun">${sunSvg}</span><span class="dp-moon">${moonSvg}</span><b id="dp-time-w">Day</b></span>
      <span class="dp-turn" id="dp-turn"></span>
      <span class="dp-actions">
        <button type="button" class="dp-btn" id="dp-full">Full screen</button>
        <button type="button" class="dp-btn" id="dp-leave">Leave</button>
      </span>
    </header>
    <p class="dp-line" id="dp-line" role="status"></p>
    <div class="dp-panels">${panelHtml('host')}${panelHtml('guest')}</div>
    <footer class="dp-foot"><p class="dp-mark" id="dp-mark"></p><div class="dp-qr" id="dp-qr"></div></footer>`;
  $('#dp-leave').addEventListener('click', leaveWatch);
  $('#dp-full').addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {}); });
  let deltaTimer = 0;
  function paintDisplay() {
    const on = watching();
    setData(stage, 'display', on ? 'on' : 'off');
    setHidden(disp, !on);
    if (!on) { clearTimeout(deltaTimer); return; }
    const v = displayView(R);
    const now = Date.now();
    setData($('#dp-time'), 'time', v.night ? 'night' : 'day');
    setText($('#dp-time-w'), v.night ? 'Night' : 'Day');
    setText($('#dp-turn'), v.turn === null ? '' : `Turn ${v.turn}`);
    setText($('#dp-line'), [viewNotice, v.line].filter(Boolean).join('\n'));
    setHidden($('#dp-line'), !viewNotice && !v.line);
    setText($('#dp-mark'), `Room ${v.code} \u00b7 watch at ${watchText(v.code)}`);
    const qr = $('#dp-qr');
    if (qr.dataset.code !== v.code && qrReady()) { qr.innerHTML = qrSvg(watchLink(v.code)); qr.dataset.code = v.code; }
    let live = false;
    for (const p of v.players) {
      const el = $(`.dp-panel[data-role="${p.role}"]`, disp);
      setData(el, 'state', p.ready ? 'ready' : 'waiting');
      setData(el, 'active', p.active ? 'on' : 'off');
      setText($('.dp-name', el), p.name);
      setText($('.dp-wait', el), p.here ? 'Connecting\u2026' : 'Waiting for player\u2026');
      setData(el, 'souls', p.souls ? 'on' : 'off');
      const put = (key, value, node) => {
        const n = value === null ? 0 : deltas.note(`${p.role}.${key}`, p.ready ? value : null, now);
        const out = $('.delta', node);
        setText(out, deltaText(n)); out.classList.toggle('neg', n < 0); out.classList.toggle('show', n !== 0);
        if (n !== 0) live = true;
      };
      const life = $('.dp-life', el), num = $('.dp-num', life);
      setText(num, p.ready ? String(p.life) : ''); setData(num, 'len', String(Math.max(2, num.textContent.length)));
      put('life', p.life, life);
      for (const key of ['mat', 'ing']) {
        const node = $(`.dp-r[data-k="${key}"]`, el);
        setText($('.dp-n', node), p.ready ? String(p[key]) : '');
        put(key, p[key], node);
      }
      const sn = $('.dp-souls', el);
      setText($('.dp-n', sn), p.ready ? String(p.up) : '');
      setText($('.dp-of', sn), p.ready ? `/ ${p.soul}` : '');
      put('up', p.souls ? p.up : null, sn);
    }
    clearTimeout(deltaTimer);
    if (live) deltaTimer = setTimeout(paintDisplay, 5100);
  }

  // ---------- the bar ----------
  function paintBar() {
    const s = ctx.getState();
    const on = playing();
    const end = $('#btn-end');
    if (on) {
      setText($('.et-word'), 'End Turn');
      setText($('#turn-label'), turnText(s));
      setProp(end, 'disabled', s.active !== 0);
      setAttr(end, 'aria-label', s.active === 0 ? `End turn. ${turnWords(s)}.` : `Waiting for your friend. ${turnWords(s)}.`);
    } else end.disabled = false;
    setData(stage, 'mine', on && s.active === 0 ? 'on' : 'off');
  }
  function paintAll() { paintSheet(); paintDrawer(); paintBar(); paintSync(); paintDisplay(); }
  hooks.closed = stopScan;
  return hooks;
}
