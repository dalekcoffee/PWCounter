// PW Counter room relay: one Durable Object per 4-digit code forwards messages between two phones.
// It stores nothing. See README.md for deployment.
import { codeFromPath, originAllowed, messageOk, peerFromQuery, admit, routeTargets, joinNotices, leaveNotices, CLOSE_REPLACED, CLOSE_CODE_IN_USE, CLOSE_VIEWERS } from './rules.js';

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
      server.close(verdict.code, verdict.code === CLOSE_CODE_IN_USE ? 'Code in use' : verdict.code === CLOSE_VIEWERS ? 'Too many viewers' : 'Room full');
      return new Response(null, { status: 101, webSocket: client });
    }
    if (verdict.replace >= 0) {
      const old = open[verdict.replace];
      old.serializeAttachment({ ...peer, replaced: true });
      try { old.close(CLOSE_REPLACED, 'Replaced'); } catch { /* already closed */ }
    }
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(peer);
    const others = this.live().filter((w) => w !== server);
    const plan = joinNotices(others.map((w) => w.deserializeAttachment() || {}), peer.role);
    for (const { index, msg } of plan.toOthers) send(others[index], msg);
    for (const msg of plan.toSelf) send(server, msg);
    return new Response(null, { status: 101, webSocket: client });
  }

  live() { return this.ctx.getWebSockets().filter((w) => !w.deserializeAttachment()?.replaced); }

  webSocketMessage(ws, message) {
    if (!messageOk(message)) { ws.close(1009, 'Message too big'); return; }
    const all = this.live();
    // a viewer's message is dropped (read only is enforced here); a player's goes to everyone else
    for (const i of routeTargets(all.map((w) => w.deserializeAttachment() || {}), all.indexOf(ws))) { try { all[i].send(message); } catch { /* gone */ } }
  }

  leave(ws) {
    const att = ws.deserializeAttachment();
    if (att?.replaced) return; // its tab came back on a new socket: nobody left
    const others = this.live().filter((o) => o !== ws);
    for (const { index, msg } of leaveNotices(others.map((o) => o.deserializeAttachment() || {}), att?.role)) send(others[index], msg);
  }
  webSocketClose(ws) { try { ws.close(); } catch { /* already closed */ } this.leave(ws); }
  webSocketError(ws) { this.leave(ws); }
}
