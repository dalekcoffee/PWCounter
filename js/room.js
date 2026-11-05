// The room connection: one WebSocket (or a fake transport in a test) to the relay, hello / shared messages, reconnecting.
// The opponent's data lives in memory only. No DOM here.
import { helloMsg, sharedMsg, checkMsg, pickMsg, parseMessage, acceptShared } from './room-proto.js';
import { compareCheck, applyPick } from './room-sync.js';

export const BACKOFF = [1000, 2000, 5000, 10000];
export const backoffFor = (attempt) => BACKOFF[Math.min(attempt, BACKOFF.length - 1)];
export const HELLO_GAP = 150;

/** A per-tab id so a phone that reconnects replaces its own stale socket. */
export const makeSid = (getRandomValues = (a) => crypto.getRandomValues(a)) => {
  const a = new Uint8Array(16); getRandomValues(a);
  return [...a].map((b) => (b % 36).toString(36)).join('');
};
export const HOST_TRIES = 5;

/** The real transport: a WebSocket to `<ROOM_URL>/room/<CODE>`. */
export function webSocketTransport(baseUrl) {
  // (code, handlers, role, sid): the relay wants to know who showed the code (host) and who typed it (guest)
  const base = baseUrl.replace(/\/+$/, '').replace(/^http/, 'ws');
  return (code, h, role = 'guest', sid = '') => {
    let ws;
    try { ws = new WebSocket(`${base}/room/${code}?role=${role}${sid ? `&sid=${sid}` : ''}`); } catch { setTimeout(() => h.close(0), 0); return { send() {}, close() {} }; }
    ws.onopen = () => h.open();
    ws.onmessage = (e) => { if (typeof e.data === 'string') h.message(e.data); };
    ws.onclose = (e) => h.close(e.code);
    ws.onerror = () => {};
    return { send: (s) => { if (ws.readyState === 1) ws.send(s); }, close: () => { try { ws.close(1000); } catch { /* already closed */ } } };
  };
}

import { rememberedRoom, roomRecord, ROOM_KEY } from './room-memory.js';
export const readSession = (storage, now = Date.now()) => { try { return rememberedRoom(storage.getItem(ROOM_KEY), now); } catch { return null; } };
const writeSession = (storage, v) => { try { v ? storage.setItem(ROOM_KEY, JSON.stringify(roomRecord(v))) : storage.removeItem(ROOM_KEY); } catch { /* private mode */ } };
export const REMEMBER_GAP = 30000;

/**
 * deps: makeTransport(code, handlers) -> {send, close}; storage (sessionStorage-like); getSelf() -> {name, seat, souls};
 * getShared() -> {night, active (0 me | 1 other), turn}; onShared(values) when the other phone's change wins; onChange() when status / peer change.
 * setTimer / clearTimer / now are injectable for tests.
 */
export function createRoom(deps) {
  const { makeTransport, storage, getSelf, getShared, onShared, onChange = () => {} } = deps;
  let sid = deps.sid || readSession(storage, now0())?.sid || makeSid();
  const newCode = deps.newCode || (() => '');
  const setTimer = deps.setTimer || ((f, ms) => setTimeout(f, ms));
  const clearTimer = deps.clearTimer || ((t) => clearTimeout(t));
  const now = deps.now || (() => Date.now());
  function now0() { return now(); }

  const room = { status: 'idle', code: '', role: null, peer: null, peerHere: false, rev: 0, peerName: '', rejoined: false, codeChanged: false, hold: false, snapPeer: null, theirs: null, sync: null, lastPick: null };
  let lastRemember = 0, checkSent = false;
  const remember = () => { // small and cheap: the code, role, phone id, the other player's name, and the last seats / shared game seen
    if (room.status === 'idle') return;
    lastRemember = now();
    const sh = getShared();
    writeSession(storage, { code: room.code, role: room.role, sid, peerName: room.peerName, at: now(), peerSeat: room.peer?.seat ?? room.snapPeer, shared: { night: sh.night, active: sh.active === 1 ? 'you' : 'me', turn: sh.turn } });
  };
  let codeTries = 0, transport = null, open = false, attempt = 0, retryTimer = null, lastHello = -Infinity, helloTimer = null, gen = 0;

  const emit = () => { try { onChange(); } catch { /* the page's problem */ } };
  const send = (text) => { if (open && transport) transport.send(text); };

  function sendHelloNow() {
    helloTimer = null;
    lastHello = now();
    send(helloMsg(getSelf()));
  }
  function sendShared() { if (!room.hold) send(sharedMsg({ ...getShared(), rev: room.rev })); }
  const snapshot = () => ({ mine: getSelf().seat, peerSeat: room.peer?.seat ?? room.snapPeer, shared: getShared() });
  function sendCheck() {
    if (checkSent) return;
    checkSent = true;
    const s = snapshot();
    send(checkMsg({ mine: s.mine, yours: s.peerSeat, shared: s.shared }));
  }
  /** Both checks are in: equal = carry on, else the sheet asks. */
  function compare() {
    if (!room.theirs) return;
    const diffs = compareCheck(snapshot(), room.theirs, { peerName: room.peerName || 'your friend' });
    if (diffs.length === 0) { room.hold = false; room.theirs = null; room.sync = null; checkSent = false; return; }
    room.sync = { diffs, snap: snapshot(), theirs: room.theirs, waiting: false };
  }
  function finish(use) {
    const theirs = room.theirs;
    room.hold = false; room.theirs = null; room.sync = null; checkSent = false;
    room.lastPick = use;
    deps.onApply?.(use, theirs);
    emit();
  }

  function connect() {
    const my = ++gen;
    room.status = attempt === 0 && !room.peerHere ? 'connecting' : 'reconnecting';
    emit();
    transport = makeTransport(room.code, {
      open() {
        if (my !== gen) return;
        open = true; attempt = 0; remember();
        room.status = 'waiting';
        emit();
      },
      message(text) { if (my === gen) receive(text); },
      close(code) {
        if (my !== gen) return;
        open = false; transport = null;
        room.peerHere = false; if (room.peer) room.snapPeer = room.peer.seat; room.peer = null; room.sync = null; room.theirs = null; checkSent = false;
        if (code === 4002 && room.role === 'host') {
          // another host drew the same code: take a new one, quietly
          if (++codeTries > HOST_TRIES) { room.status = 'busy'; writeSession(storage, null); emit(); return; }
          room.code = newCode(); if (room.rejoined) room.codeChanged = true; remember();
          emit(); connect(); return;
        }
        if (code === 4001) { room.status = 'full'; writeSession(storage, null); emit(); return; }
        room.status = 'reconnecting';
        emit();
        retryTimer = setTimer(() => { retryTimer = null; connect(); }, backoffFor(attempt++));
      },
    }, room.role, sid);
  }

  function receive(text) {
    const m = parseMessage(text);
    if (!m) return;
    remember();
    if (m.t === 'peer') {
      room.peerHere = m.here;
      if (m.here) {
        room.status = 'connected';
        sendHelloNow(); sendShared();
        if (room.hold) sendCheck();
      } else {
        if (room.peer) room.snapPeer = room.peer.seat;
        room.peer = null; room.sync = null; room.theirs = null; checkSent = false;
        room.status = 'waiting';
      }
      emit();
    } else if (m.t === 'hello') {
      room.peer = { name: m.name, seat: m.seat, souls: m.souls };
      if (m.name) room.peerName = m.name;
      remember();
      if (!room.peerHere) { room.peerHere = true; room.status = 'connected'; }
      emit();
    } else if (m.t === 'shared') {
      if (room.hold || !acceptShared(room.rev, m.rev, room.role)) return;
      room.rev = m.rev;
      onShared({ night: m.night, active: m.active, turn: m.turn });
      remember();
      emit();
    } else if (m.t === 'check') {
      // the other phone came back and compared: I hold my shared game until we have agreed
      room.theirs = m;
      room.hold = true;
      sendCheck();
      compare();
      emit();
    } else if (m.t === 'pick') {
      if (!room.sync && !room.hold) return;
      if (room.role === 'host') { if (room.theirs) { send(pickMsg({ use: m.use, rev: room.rev })); finish(m.use); } } // the host decides: first pick in wins
      else if (room.theirs) finish(m.use);
    }
  }

  function start(code, role, opts = {}) {
    leave(true);
    if (opts.sid) sid = opts.sid;
    room.code = code; room.role = role; room.rev = 0; attempt = 0; codeTries = 0;
    room.peerName = opts.peerName || ''; room.rejoined = !!opts.rejoin; room.codeChanged = false;
    room.snapPeer = opts.peerSeat || null; room.hold = !!opts.rejoin; room.theirs = null; room.sync = null; checkSent = false;
    remember();
    connect();
  }

  function leave(quiet) {
    gen++;
    if (retryTimer) { clearTimer(retryTimer); retryTimer = null; }
    if (helloTimer) { clearTimer(helloTimer); helloTimer = null; }
    const t = transport; transport = null; open = false;
    try { t?.close(); } catch { /* closing */ }
    const was = room.status !== 'idle';
    Object.assign(room, { status: 'idle', code: '', role: null, peer: null, peerHere: false, rev: 0, peerName: '', rejoined: false, codeChanged: false, hold: false, snapPeer: null, theirs: null, sync: null, lastPick: null });
    checkSent = false;
    writeSession(storage, null);
    if (!quiet && was) emit();
  }

  return {
    state: room,
    host: (code) => start(code, 'host'),
    join: (code) => start(code, 'guest'),
    /** Back into the remembered room, same code, role and phone id. */
    rejoin: (rec) => start(rec.code, rec.role, { sid: rec.sid, peerName: rec.peerName, peerSeat: rec.peerSeat, rejoin: true }),
    /** The person chose on the sync sheet. The host decides at once; the guest asks the host and waits for its answer. */
    choose(use) {
      if (!room.sync || room.sync.waiting) return;
      if (room.role === 'host') { send(pickMsg({ use, rev: room.rev })); finish(use); }
      else { room.sync = { ...room.sync, waiting: true }; send(pickMsg({ use, rev: room.rev })); emit(); }
    },
    get sid() { return sid; },
    leave: () => leave(false),
    /** My seat changed: send hello, at most one per HELLO_GAP, the last value always goes. */
    selfChanged() {
      if (!room.peerHere || !open || helloTimer) return;
      const wait = lastHello + HELLO_GAP - now();
      if (wait <= 0) sendHelloNow(); else helloTimer = setTimer(sendHelloNow, wait);
    },
    /** Day/night or the turn changed here: a new revision goes out. */
    sharedChanged() { room.rev += 1; remember(); if (room.peerHere) sendShared(); },
    get active() { return room.status !== 'idle'; },
  };
}
