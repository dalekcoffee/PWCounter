// A fake room transport for testing several pages of one browser with a BroadcastChannel (no relay needed).
// Only used with ?fakeRoom=1 on 127.0.0.1 / localhost (see app.js). It models the relay: a page first asks who is in the room,
// admits itself with the relay's own `admit` rule, then announces itself; notices and routing use the relay's `joinNotices`
// and `routeTargets`, so a viewer is never "here" for a player and a viewer's messages go nowhere.
import { admit, isPlayer, routeTargets, joinNotices } from '../worker/room/src/rules.js';

export const fakeAllowed = (loc) => /(^|[?&])fakeRoom=1(&|$)/.test(loc.search) && (loc.hostname === '127.0.0.1' || loc.hostname === 'localhost');

export function fakeTransport(code, h, role = 'guest', sid = '') {
  const id = Math.random().toString(36).slice(2);
  const me = { id, role, sid };
  const ch = new BroadcastChannel(`pwc-fake-room-${code}`);
  const members = new Map(); // id -> {role, sid} of the other pages
  let joined = false, closed = false;
  const others = () => [...members.values()];
  const deliver = (msg) => { if (!closed) h.message(JSON.stringify(msg)); };
  ch.onmessage = (e) => {
    const m = e.data;
    if (closed || !m || m.id === id) return;
    if (m.x === 'probe') { if (joined) ch.postMessage({ x: 'here', id, to: m.id, role, sid }); }
    else if (m.x === 'here' && m.to === id) members.set(m.id, { role: m.role, sid: m.sid });
    else if (m.x === 'join' && joined) {
      for (const [k, v] of members) if (v.role === m.role && m.sid && v.sid === m.sid) members.delete(k); // its stale page is replaced
      members.set(m.id, { role: m.role, sid: m.sid });
      // what the relay would tell me about the newcomer
      if (isPlayer(role)) deliver(m.role === 'watch' ? { t: 'watcher' } : { t: 'peer', here: true });
      else if (isPlayer(m.role)) deliver({ t: 'peer', role: m.role, here: true });
    } else if (m.x === 'leave' && joined) {
      const old = members.get(m.id);
      members.delete(m.id);
      if (old && isPlayer(old.role)) deliver(role === 'watch' ? { t: 'peer', role: old.role, here: false } : { t: 'peer', here: false });
    } else if (m.x === 'msg' && joined && isPlayer(m.role)) deliver(JSON.parse(m.data)); // a viewer's message is never forwarded
  };
  ch.postMessage({ x: 'probe', id });
  setTimeout(() => { // the answers are in: is there room for me?
    if (closed) return;
    const list = others();
    const verdict = admit(list, me);
    if (!verdict.accept) { closed = true; ch.close(); h.close(verdict.code); return; }
    if (verdict.replace >= 0) for (const [k, v] of members) if (v === list[verdict.replace]) members.delete(k);
    joined = true;
    h.open();
    for (const msg of joinNotices(others(), role).toSelf) deliver(msg);
    ch.postMessage({ x: 'join', id, role, sid });
  }, 60);
  return {
    send: (s) => { if (joined && routeTargets([me, ...others()], 0).length) ch.postMessage({ x: 'msg', id, role, data: s }); },
    close: () => { if (closed) return; closed = true; if (joined) ch.postMessage({ x: 'leave', id }); ch.close(); },
  };
}
