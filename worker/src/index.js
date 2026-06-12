// Cloudflare Worker signaling server with Durable Object for WebSocket matchmaking
export class SignalingRoom {
  constructor(state, env) {
    this.state = state;
    this.clients = new Map(); // id -> { ws, info }
    this.waitingPool = [];
  }

  async fetch(request) {
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.handleSession(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  handleSession(ws) {
    ws.accept();
    let myId = null;

    ws.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'join': {
            const { id, language, country, tags, handle, avatar, chatMode, name, age, gender } = msg.data;
            myId = id;
            this.clients.set(id, {
              ws,
              info: { id, name: name || handle || 'Stranger', handle: handle || 'Stranger', avatar: avatar || '🐻', gender: gender || 'Other', age: age || 18, country, language, tags: tags || [], chatMode, joinedAt: Date.now() }
            });
            this.putInPool(id);
            break;
          }
          case 'skip': {
            if (!myId) return;
            this.handleSkip(myId);
            this.putInPool(myId);
            break;
          }
          case 'offer': case 'answer': case 'candidate': {
            const target = this.clients.get(msg.targetPeerId);
            if (target && target.ws.readyState === 1) {
              target.ws.send(JSON.stringify({ type: msg.type, senderPeerId: myId, data: msg.data }));
            }
            break;
          }
          case 'chat_message': {
            const t = this.clients.get(msg.data.targetPeerId);
            if (t && t.ws.readyState === 1) t.ws.send(JSON.stringify({ type: 'chat_message', data: { senderPeerId: myId, text: msg.data.text } }));
            break;
          }
          case 'typing': {
            const t = this.clients.get(msg.data.targetPeerId);
            if (t && t.ws.readyState === 1) t.ws.send(JSON.stringify({ type: 'typing', data: { senderPeerId: myId, isTyping: msg.data.isTyping } }));
            break;
          }
          case 'game_action': {
            const t = this.clients.get(msg.data.targetPeerId);
            if (t && t.ws.readyState === 1) t.ws.send(JSON.stringify({ type: 'game_action', data: msg.data }));
            break;
          }
        }
      } catch (e) {}
    });

    ws.addEventListener('close', () => {
      if (myId) {
        this.handleSkip(myId);
        this.waitingPool = this.waitingPool.filter(id => id !== myId);
        this.clients.delete(myId);
      }
    });
  }

  handleSkip(myId) {
    // Find partner and notify
    for (const [sid, session] of (this.sessions || new Map()).entries()) {
      if (session.a === myId || session.b === myId) {
        const otherId = session.a === myId ? session.b : session.a;
        const other = this.clients.get(otherId);
        if (other && other.ws.readyState === 1) {
          other.ws.send(JSON.stringify({ type: 'skipped' }));
          this.putInPool(otherId);
        }
        this.sessions.delete(sid);
        return;
      }
    }
  }

  putInPool(id) {
    if (!this.sessions) this.sessions = new Map();
    this.waitingPool = this.waitingPool.filter(x => x !== id);
    if (!this.clients.has(id)) return;
    this.waitingPool.push(id);
    this.tryMatch();
  }

  tryMatch() {
    if (this.waitingPool.length < 2) return;

    for (let i = 0; i < this.waitingPool.length; i++) {
      const aId = this.waitingPool[i];
      const a = this.clients.get(aId);
      if (!a) continue;

      let bestId = null, bestScore = -1;

      for (let j = 0; j < this.waitingPool.length; j++) {
        if (i === j) continue;
        const bId = this.waitingPool[j];
        const b = this.clients.get(bId);
        if (!b) continue;

        // Soft filters: only enforce language when 3+ in pool
        if (this.waitingPool.length > 2 && a.info.language !== b.info.language) continue;
        if (this.waitingPool.length > 2) {
          const cc = a.info.country === 'Worldwide' || b.info.country === 'Worldwide' || a.info.country === b.info.country;
          if (!cc) continue;
        }

        let score = (a.info.tags || []).filter(t => (b.info.tags || []).includes(t)).length * 2;
        const ageDiff = Math.abs((a.info.age || 18) - (b.info.age || 18));
        if (ageDiff <= 2) score += 5;
        else if (ageDiff <= 5) score += 3;
        else if (ageDiff <= 10) score += 1;

        if (score > bestScore) { bestScore = score; bestId = bId; }
      }

      // If no scored match but 2+ people, just match first two
      if (!bestId && this.waitingPool.length >= 2) {
        bestId = this.waitingPool[i === 0 ? 1 : 0];
      }

      if (bestId) {
        this.waitingPool = this.waitingPool.filter(x => x !== aId && x !== bestId);
        if (!this.sessions) this.sessions = new Map();
        this.sessions.set(`${aId}_${bestId}`, { a: aId, b: bestId });

        const clientA = this.clients.get(aId);
        const clientB = this.clients.get(bestId);

        clientA.ws.send(JSON.stringify({
          type: 'matched', data: { role: 'initiator', peerId: bestId, peerInfo: clientB.info }
        }));
        clientB.ws.send(JSON.stringify({
          type: 'matched', data: { role: 'receiver', peerId: aId, peerInfo: clientA.info }
        }));

        this.tryMatch();
        return;
      }
    }
  }
}

export default {
  async fetch(request, env) {
    // CORS headers for cross-origin WebSocket
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        }
      });
    }

    const id = env.SIGNALING.idFromName('global-room');
    const obj = env.SIGNALING.get(id);
    return obj.fetch(request);
  }
};
