// PW Counter room relay: one Durable Object per 4-digit code forwards messages between two phones.
// It stores nothing. See README.md for deployment.
import { codeFromPath, originAllowed, messageOk, peerFromQuery, admit, CLOSE_REPLACED } from './rules.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') return new Response('ok');
    if (url.pathname.startsWith('/room/')) {
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
      const code = codeFromPath(url.pathname);
      if (!code) return new Response('Bad room code', { status: 400 });
      if (!originAllowed(request.headers.get('Origin'))) return new Response('Forbidden', { status: 403 });
      if (!peerFromQuery(url.searchParams)) return new Response('Bad role', { status: 400 });
      return env.ROOM.get(env.ROOM.idFromName(code)).fetch(request);
    }
    return new Response('Not found', { status: 404 });
  },
};

const send = (ws, obj) => { try { ws.send(JSON.stringify(obj)); } catch { /* the other side is gone */ } };

export class Room {
  constructor(ctx) { this.ctx = ctx; }

  async fetch(request) {
    const peer = peerFromQuery(new URL(request.url).searchParams);
    if (!peer) return new Response('Bad role', { status: 400 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const open = this.ctx.getWebSockets().filter((w) => !w.deserializeAttachment()?.replaced);
    const verdict = admit(open.map((w) => w.deserializeAttachment() || {}), peer);
    if (!verdict.accept) {
      server.accept();
      server.close(verdict.code, verdict.code === 4002 ? 'Code in use' : 'Room full');
      return new Response(null, { status: 101, webSocket: client });
    }
    if (verdict.replace >= 0) {
      const old = open[verdict.replace];
      old.serializeAttachment({ ...peer, replaced: true });
      try { old.close(CLOSE_REPLACED, 'Replaced'); } catch { /* already closed */ }
    }
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(peer);
    const others = this.ctx.getWebSockets().filter((w) => w !== server && !w.deserializeAttachment()?.replaced);
    for (const o of others) send(o, { t: 'peer', here: true });
    send(server, { t: 'peer', here: others.length > 0 });
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws, message) {
    if (!messageOk(message)) { ws.close(1009, 'Message too big'); return; }
    for (const o of this.ctx.getWebSockets()) if (o !== ws && !o.deserializeAttachment()?.replaced) { try { o.send(message); } catch { /* gone */ } }
  }

  leave(ws) {
    if (ws.deserializeAttachment()?.replaced) return; // its tab came back on a new socket: nobody left
    for (const o of this.ctx.getWebSockets()) if (o !== ws && !o.deserializeAttachment()?.replaced) send(o, { t: 'peer', here: false });
  }
  webSocketClose(ws) { try { ws.close(); } catch { /* already closed */ } this.leave(ws); }
  webSocketError(ws) { this.leave(ws); }
}
