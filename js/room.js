// The room connection: one WebSocket (or a fake transport in a test) to the relay, hello / shared messages, reconnecting.
// The opponent's data lives in memory only. No DOM here.
import { helloMsg, sharedMsg, parseMessage, acceptShared, validCode } from './room-proto.js';

export const BACKOFF = [1000, 2000, 5000, 10000];
export const backoffFor = (attempt) => BACKOFF[Math.min(attempt, BACKOFF.length - 1)];
export const HELLO_GAP = 150;
const SESSION_KEY = 'pwc.room';

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

export function readSession(storage) {
  try {
    const v = JSON.parse(storage.getItem(SESSION_KEY));
    return v && validCode(v.code) && (v.role === 'host' || v.role === 'guest') ? { code: v.code, role: v.role } : null;
  } catch { return null; }
}
const writeSession = (storage, v) => { try { v ? storage.setItem(SESSION_KEY, JSON.stringify(v)) : storage.removeItem(SESSION_KEY); } catch { /* private mode */ } };

/**
 * deps: makeTransport(code, handlers) -> {send, close}; storage (sessionStorage-like); getSelf() -> {name, seat, souls};
 * getShared() -> {night, active (0 me | 1 other), turn}; onShared(values) when the other phone's change wins; onChange() when status / peer change.
 * setTimer / clearTimer / now are injectable for tests.
 */
export function createRoom(deps) {
  const { makeTransport, storage, getSelf, getShared, onShared, onChange = () => {} } = deps;
  const sid = deps.sid || makeSid();
  const newCode = deps.newCode || (() => '');
  const setTimer = deps.setTimer || ((f, ms) => setTimeout(f, ms));
  const clearTimer = deps.clearTimer || ((t) => clearTimeout(t));
  const now = deps.now || (() => Date.now());

  const room = { status: 'idle', code: '', role: null, peer: null, peerHere: false, rev: 0 };
  let codeTries = 0, transport = null, open = false, attempt = 0, retryTimer = null, lastHello = -Infinity, helloTimer = null, gen = 0;

  const emit = () => { try { onChange(); } catch { /* the page's problem */ } };
  const send = (text) => { if (open && transport) transport.send(text); };

  function sendHelloNow() {
    helloTimer = null;
    lastHello = now();
    send(helloMsg(getSelf()));
  }
  function sendShared() { send(sharedMsg({ ...getShared(), rev: room.rev })); }

  function connect() {
    const my = ++gen;
    room.status = attempt === 0 && !room.peerHere ? 'connecting' : 'reconnecting';
    emit();
    transport = makeTransport(room.code, {
      open() {
        if (my !== gen) return;
        open = true; attempt = 0;
        room.status = 'waiting';
        emit();
      },
      message(text) { if (my === gen) receive(text); },
      close(code) {
        if (my !== gen) return;
        open = false; transport = null;
        room.peerHere = false; room.peer = null;
        if (code === 4002 && room.role === 'host') {
          // another host drew the same code: take a new one, quietly
          if (++codeTries > HOST_TRIES) { room.status = 'busy'; writeSession(storage, null); emit(); return; }
          room.code = newCode(); writeSession(storage, { code: room.code, role: 'host' });
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
    if (m.t === 'peer') {
      room.peerHere = m.here;
      if (m.here) {
        room.status = 'connected';
        sendHelloNow(); sendShared();
      } else {
        room.peer = null;
        room.status = 'waiting';
      }
      emit();
    } else if (m.t === 'hello') {
      room.peer = { name: m.name, seat: m.seat, souls: m.souls };
      if (!room.peerHere) { room.peerHere = true; room.status = 'connected'; }
      emit();
    } else if (m.t === 'shared') {
      if (!acceptShared(room.rev, m.rev, room.role)) return;
      room.rev = m.rev;
      onShared({ night: m.night, active: m.active, turn: m.turn });
      emit();
    }
  }

  function start(code, role) {
    leave(true);
    room.code = code; room.role = role; room.rev = 0; attempt = 0; codeTries = 0;
    writeSession(storage, { code, role });
    connect();
  }

  function leave(quiet) {
    gen++;
    if (retryTimer) { clearTimer(retryTimer); retryTimer = null; }
    if (helloTimer) { clearTimer(helloTimer); helloTimer = null; }
    const t = transport; transport = null; open = false;
    try { t?.close(); } catch { /* closing */ }
    const was = room.status !== 'idle';
    Object.assign(room, { status: 'idle', code: '', role: null, peer: null, peerHere: false, rev: 0 });
    writeSession(storage, null);
    if (!quiet && was) emit();
  }

  return {
    state: room,
    host: (code) => start(code, 'host'),
    join: (code) => start(code, 'guest'),
    leave: () => leave(false),
    /** My seat changed: send hello, at most one per HELLO_GAP, the last value always goes. */
    selfChanged() {
      if (!room.peerHere || !open || helloTimer) return;
      const wait = lastHello + HELLO_GAP - now();
      if (wait <= 0) sendHelloNow(); else helloTimer = setTimer(sendHelloNow, wait);
    },
    /** Day/night or the turn changed here: a new revision goes out. */
    sharedChanged() { room.rev += 1; if (room.peerHere) sendShared(); },
    get active() { return room.status !== 'idle'; },
  };
}
