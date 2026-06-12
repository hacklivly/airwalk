export class SignalingRoom {
  constructor(state, env) {
    this.state = state;
    this.clients = new Map();
    this.waitingPool = [];
    this.sessions = new Map();
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('WebSocket required', { status: 426 });
    }
    const pair = new WebSocketPair();
    this.handleSession(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  handleSession(ws) {
    ws.accept();
    let myId = null;

    ws.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'join': {
            myId = msg.data.id;
            this.clients.set(myId, { ws, info: { ...msg.data, joinedAt: Date.now() } });
            this.addToPool(myId);
            break;
          }
          case 'skip': {
            if (myId) { this.endSession(myId); this.addToPool(myId); }
            break;
          }
          case 'report': {
            if (myId) { this.endSession(myId); this.addToPool(myId); }
            break;
          }
          case 'offer': case 'answer': case 'candidate': {
            const t = this.clients.get(msg.targetPeerId);
            if (t?.ws.readyState === 1) t.ws.send(JSON.stringify({ type: msg.type, senderPeerId: myId, data: msg.data }));
            break;
          }
          case 'chat_message': {
            const t = this.clients.get(msg.data.targetPeerId);
            if (t?.ws.readyState === 1) t.ws.send(JSON.stringify({ type: 'chat_message', data: { senderPeerId: myId, text: msg.data.text } }));
            break;
          }
          case 'typing': {
            const t = this.clients.get(msg.data.targetPeerId);
            if (t?.ws.readyState === 1) t.ws.send(JSON.stringify({ type: 'typing', data: { isTyping: msg.data.isTyping } }));
            break;
          }
          case 'mute_status': {
            const t = this.clients.get(msg.data.targetPeerId);
            if (t?.ws.readyState === 1) t.ws.send(JSON.stringify({ type: 'mute_status', data: { isMuted: msg.data.isMuted } }));
            break;
          }
          case 'game_action': {
            const t = this.clients.get(msg.data.targetPeerId);
            if (t?.ws.readyState === 1) t.ws.send(JSON.stringify({ type: 'game_action', data: msg.data }));
            break;
          }
          case 'reconnect': {
            const targetHandle = msg.data.targetHandle;
            for (const [cid, client] of this.clients.entries()) {
              if (client.info.handle === targetHandle && cid !== myId && this.waitingPool.includes(cid)) {
                this.matchPair(myId, cid);
                return;
              }
            }
            this.addToPool(myId);
            break;
          }
        }
      } catch (e) {}
    });

    ws.addEventListener('close', () => {
      if (myId) {
        this.endSession(myId);
        this.waitingPool = this.waitingPool.filter(x => x !== myId);
        this.clients.delete(myId);
      }
    });
  }

  addToPool(id) {
    this.waitingPool = this.waitingPool.filter(x => x !== id);
    if (!this.clients.has(id)) return;
    this.waitingPool.push(id);
    // Immediately try to match
    this.tryMatch();
  }

  tryMatch() {
    // Simple: if 2+ people waiting, match the first two immediately
    while (this.waitingPool.length >= 2) {
      const aId = this.waitingPool.shift();
      const bId = this.waitingPool.shift();
      // Verify both still connected
      if (!this.clients.has(aId)) { if (bId) this.waitingPool.unshift(bId); continue; }
      if (!this.clients.has(bId)) { this.waitingPool.unshift(aId); continue; }
      this.matchPair(aId, bId);
    }
  }

  matchPair(aId, bId) {
    this.waitingPool = this.waitingPool.filter(x => x !== aId && x !== bId);
    this.sessions.set(`${aId}_${bId}`, { a: aId, b: bId });

    const a = this.clients.get(aId);
    const b = this.clients.get(bId);

    if (a?.ws.readyState === 1) {
      a.ws.send(JSON.stringify({ type: 'matched', data: { role: 'initiator', peerId: bId, peerInfo: b.info } }));
    }
    if (b?.ws.readyState === 1) {
      b.ws.send(JSON.stringify({ type: 'matched', data: { role: 'receiver', peerId: aId, peerInfo: a.info } }));
    }
  }

  endSession(myId) {
    for (const [sid, session] of this.sessions.entries()) {
      if (session.a === myId || session.b === myId) {
        const otherId = session.a === myId ? session.b : session.a;
        const other = this.clients.get(otherId);
        if (other?.ws.readyState === 1) {
          other.ws.send(JSON.stringify({ type: 'disconnected' }));
          this.addToPool(otherId);
        }
        this.sessions.delete(sid);
        return;
      }
    }
  }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': '*' } });
    }
    const id = env.SIGNALING.idFromName('global-room');
    return env.SIGNALING.get(id).fetch(request);
  }
};
