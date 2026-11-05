// "Play with a friend": the room sheet, the scanner, the opponent drawer. The rules are pure (room-game.js, room-proto.js, drawer.js).
import { ROOM_URL } from './room-config.js';
import { fakeAllowed, fakeTransport } from './room-fake.js';
import { createRoom, webSocketTransport, readSession } from './room.js';
import { makeCode, validCode, cleanCode, joinLink, codeFromScan, passTurn } from './room-proto.js';
import { startRoomGame, afterRoomReset, leaveRoomState, settleRoom, applyShared, sharedOf, sharedDiffers, selfDiffers, statusText, handleView, turnText } from './room-game.js';
import { toggleDrawer, setDrawer, initialDrawer, toStageDy, dragResult, dragProgress, DRAG_MIN } from './drawer.js';
import { qrSvg } from './qr.js';

const LABEL = { life: 'Life', mat: 'Material', ing: 'Ingredient', soul: 'Souls' };

/** ctx: {$, $$, stage, getState, commit(next, remote), openOverlay, closeOverlay, icons, setRooms(bool)} */
export function initRoom(ctx) {
  const { $, stage, icons } = ctx;
  const fake = fakeAllowed(location);
  const available = !!ROOM_URL || fake;
  const room = createRoom({
    makeTransport: fake ? fakeTransport : webSocketTransport(ROOM_URL || 'https://invalid.invalid'),
    storage: sessionStorage,
    newCode: () => makeCode(),
    getSelf: () => { const s = ctx.getState(); return { name: s.name, seat: s.seats[0], souls: s.souls }; },
    getShared: () => sharedOf(ctx.getState()),
    onShared: (sh) => ctx.commit(applyShared(ctx.getState(), sh), true),
    onChange: () => onRoomChange(),
  });
  const R = room.state;
  let view = 'pick'; // pick | join (the sheet, while not in a room)
  let notice = '';
  let drawer = initialDrawer();

  const active = () => R.status !== 'idle';
  const refresh = () => ctx.render();

  // ---------- starting and leaving ----------
  function begin(role, code) {
    notice = '';
    stopScan();
    ctx.commit(startRoomGame(ctx.getState(), role));
    if (role === 'host') room.host(code); else room.join(code);
    drawer = initialDrawer();
    refresh();
  }
  function host() { begin('host', makeCode()); }
  function join(raw) { const c = cleanCode(raw); if (validCode(c)) begin('guest', c); }
  function leave() {
    if (!active()) return;
    room.leave();
    stopScan();
    drawer = initialDrawer();
    ctx.commit(leaveRoomState(ctx.getState()), true);
    refresh();
  }
  function onRoomChange() {
    if (R.status === 'full' || R.status === 'busy') { notice = statusText(R); room.leave(); view = R.status === 'busy' ? 'pick' : 'join'; ctx.commit(leaveRoomState(ctx.getState()), true); }
    if (!R.peer && drawer.open) drawer = setDrawer(drawer, false);
    refresh();
  }

  // ---------- hooks for app.js ----------
  const hooks = {
    available, active, join, host, leave,
    /** next state before it is stored: a room never asks who goes first */
    settle: (s) => (active() ? settleRoom(s, R.role) : s),
    afterReset: (s) => (active() ? afterRoomReset(s, R.role) : s),
    endTurn: (s) => passTurn(s, R.role),
    changed(prev, next, remote) {
      if (!active()) return;
      if (!next.rooms) { leave(); return; }
      if (!remote && sharedDiffers(sharedOf(prev), sharedOf(next))) room.sharedChanged();
      if (selfDiffers(prev, next)) room.selfChanged();
    },
    resume() { // a reload in the middle of a room
      const ses = readSession(sessionStorage);
      if (ses && available && ctx.getState().rooms) { ses.role === 'host' ? room.host(ses.code) : room.join(ses.code); }
    },
    openSheet() { view = 'pick'; notice = ''; refresh(); ctx.openOverlay('ov-room'); },
    paint: paintAll,
    escape() { if (drawer.open) { drawer = setDrawer(drawer, false); paintDrawer(); return true; } return false; },
  };

  // ---------- the sheet ----------
  const show = (id, on) => { $(`#${id}`).hidden = !on; };
  function paintSheet() {
    const live = active();
    show('rv-off', !available);
    show('rv-pick', available && !live && view === 'pick');
    show('rv-join', available && !live && view === 'join');
    show('rv-live', available && live);
    $('#room-note').textContent = notice;
    $('#room-note').hidden = !notice;
    if (live) {
      $('#rv-code').textContent = R.code;
      $('#rv-status').textContent = statusText(R);
      const showQr = R.role === 'host' && R.status !== 'connected';
      $('#rv-qrwrap').hidden = !showQr;
      if (showQr) {
        const svg = qrSvg(joinLink(R.code));
        if ($('#rv-qr').dataset.code !== R.code) { $('#rv-qr').innerHTML = svg; $('#rv-qr').dataset.code = R.code; }
      }
    }
    $('#btn-scan').hidden = !('BarcodeDetector' in window);
    $('#scan-hint').hidden = 'BarcodeDetector' in window;
  }
  $('#btn-room-host').addEventListener('click', host);
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
    const v = $('#scan-video'); v.srcObject = null; v.hidden = true;
    $('#btn-scan').textContent = 'Scan QR code';
  }
  $('#btn-scan').addEventListener('click', async () => {
    if (scan) { stopScan(); return; }
    try {
      const det = new BarcodeDetector({ formats: ['qr_code'] });
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      const v = $('#scan-video');
      v.srcObject = stream; v.hidden = false; await v.play();
      $('#btn-scan').textContent = 'Stop scanning';
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
    const on = active();
    opp.hidden = !on;
    stage.dataset.room = on ? 'on' : 'off';
    if (!on) return;
    const hv = handleView(R);
    const peer = R.peer;
    $('#opp-name').textContent = hv.here ? hv.name : hv.text;
    $('#opp-life').hidden = !hv.here;
    $('#opp-life b').textContent = hv.here ? String(hv.life) : '';
    const open = drawer.open && !!peer;
    opp.dataset.open = open ? 'on' : 'off';
    handle.setAttribute('aria-expanded', String(open));
    handle.setAttribute('aria-label', hv.here ? `${hv.name}, life ${hv.life}. ${open ? 'Close' : 'Open'} the opponent's counters.` : `${hv.text}. Show the room code.`);
    opp.dataset.souls = peer?.souls ? 'on' : 'off';
    tiles.soul.hidden = !peer?.souls;
    if (peer) {
      for (const key of ['life', 'mat', 'ing']) {
        const n = $('.num', tiles[key]); n.textContent = String(peer.seat[key]); n.dataset.len = String(Math.max(2, String(peer.seat[key]).length));
      }
      $('.num', tiles.soul).textContent = String(peer.seat.up);
      $('.of b', tiles.soul).textContent = String(peer.seat.soul);
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
    opp.dataset.drag = 'on';
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

  // ---------- the bar ----------
  function paintBar() {
    const s = ctx.getState();
    const on = active();
    const end = $('#btn-end');
    if (on) {
      $('.et-word').textContent = 'End Turn';
      $('#turn-label').textContent = turnText(s);
      end.disabled = s.active !== 0;
      end.setAttribute('aria-label', s.active === 0 ? `End turn. ${turnText(s)}.` : `Waiting for your friend. ${turnText(s)}.`);
    } else end.disabled = false;
    stage.dataset.mine = on && s.active === 0 ? 'on' : 'off';
  }
  function paintAll() { paintSheet(); paintDrawer(); paintBar(); }
  hooks.closed = stopScan;
  return hooks;
}
