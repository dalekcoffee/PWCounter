// PW Counter room relay: one Durable Object per 4-digit code forwards messages between two phones.
// It stores nothing. See README.md for deployment.
import { codeFromPath, originAllowed, messageOk, MAX_PEERS } from './rules.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') return new Response('ok');
    if (url.pathname.startsWith('/room/')) {
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
      const code = codeFromPath(url.pathname);
      if (!code) return new Response('Bad room code', { status: 400 });
      if (!originAllowed(request.headers.get('Origin'))) return new Response('Forbidden', { status: 403 });
      return env.ROOM.get(env.ROOM.idFromName(code)).fetch(request);
    }
    return new Response('Not found', { status: 404 });
  },
};

const send = (ws, obj) => { try { ws.send(JSON.stringify(obj)); } catch { /* the other side is gone */ } };

export class Room {
  constructor(ctx) { this.ctx = ctx; }

  async fetch() {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    if (this.ctx.getWebSockets().length >= MAX_PEERS) {
      server.accept();
      server.close(4001, 'Room full');
      return new Response(null, { status: 101, webSocket: client });
    }
    this.ctx.acceptWebSocket(server);
    const others = this.ctx.getWebSockets().filter((w) => w !== server);
    for (const o of others) send(o, { t: 'peer', here: true });
    send(server, { t: 'peer', here: others.length > 0 });
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws, message) {
    if (!messageOk(message)) { ws.close(1009, 'Message too big'); return; }
    for (const o of this.ctx.getWebSockets()) if (o !== ws) { try { o.send(message); } catch { /* gone */ } }
  }

  leave(ws) {
    for (const o of this.ctx.getWebSockets()) if (o !== ws) send(o, { t: 'peer', here: false });
  }
  webSocketClose(ws) { try { ws.close(); } catch { /* already closed */ } this.leave(ws); }
  webSocketError(ws) { this.leave(ws); }
}
