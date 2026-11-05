// A fake room transport for testing two pages of one browser with a BroadcastChannel (no relay needed).
// Only used with ?fakeRoom=1 on 127.0.0.1 / localhost (see app.js).
export const fakeAllowed = (loc) => /(^|[?&])fakeRoom=1(&|$)/.test(loc.search) && (loc.hostname === '127.0.0.1' || loc.hostname === 'localhost');

export function fakeTransport(code, h) {
  const id = Math.random().toString(36).slice(2);
  const ch = new BroadcastChannel(`pwc-fake-room-${code}`);
  const peers = new Set();
  const peerMsg = () => h.message(JSON.stringify({ t: 'peer', here: peers.size > 0 }));
  ch.onmessage = (e) => {
    const m = e.data;
    if (!m || m.id === id) return;
    if (m.x === 'join') { peers.add(m.id); ch.postMessage({ x: 'here', id, to: m.id }); peerMsg(); }
    else if (m.x === 'here' && m.to === id) { peers.add(m.id); peerMsg(); }
    else if (m.x === 'leave') { peers.delete(m.id); peerMsg(); }
    else if (m.x === 'msg') h.message(m.data);
  };
  setTimeout(() => { h.open(); peerMsg(); ch.postMessage({ x: 'join', id }); }, 30);
  return {
    send: (s) => ch.postMessage({ x: 'msg', id, data: s }),
    close: () => { ch.postMessage({ x: 'leave', id }); ch.close(); },
  };
}
