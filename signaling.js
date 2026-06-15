import { WebSocketServer, WebSocket } from 'ws';

const PORT = process.env.PORT || 3001;
const wss = new WebSocketServer({ port: PORT });

console.log(`🚀 Airwalk signaling server running on port ${PORT}`);

// Active sockets indexed by unique client ID
// Map of clientID => { socket, info: { id, gender, lookingFor, country, language, tags, joinedAt } }
const clients = new Map();

// Matchmaking queue (list of client IDs)
let waitingPool = [];

// Active call sessions: Map of sessionId => { peerAId, peerBId }
const activeSessions = new Map();

// Helper to remove client from all lists and notify partners
function cleanupClient(clientId) {
  // 1. Remove from waiting pool
  waitingPool = waitingPool.filter(id => id !== clientId);

  // 2. Find and destroy active session
  for (const [sessionId, session] of activeSessions.entries()) {
    if (session.peerAId === clientId || session.peerBId === clientId) {
      const otherPeerId = session.peerAId === clientId ? session.peerBId : session.peerAId;
      
      // Notify other peer
      const otherClient = clients.get(otherPeerId);
      if (otherClient && otherClient.socket.readyState === WebSocket.OPEN) {
        otherClient.socket.send(JSON.stringify({ 
          type: 'disconnected', 
          message: 'Your partner has disconnected.' 
        }));
        
        // Put other peer back into matchmaking pool
        putInWaitingPool(otherPeerId);
      }
      
      activeSessions.delete(sessionId);
      console.log(`💔 Closed session ${sessionId} due to disconnect of ${clientId}`);
      break;
    }
  }

  // 3. Remove client reference
  clients.delete(clientId);
}

function putInWaitingPool(clientId) {
  if (!waitingPool.includes(clientId)) {
    const client = clients.get(clientId);
    if (client) {
      client.info.joinedAt = Date.now();
      waitingPool.push(clientId);
      console.log(`📥 Peer ${clientId} joined the waiting pool. Pool size: ${waitingPool.length}`);
      
      // Perform matchmaking run
      tryMatchmaking();
    }
  }
}

// Evaluate pairing matches for everyone in the pool
function tryMatchmaking() {
  if (waitingPool.length < 2) {
    return; // Not enough peers to match
  }

  // Iterate from the oldest waiting peer
  for (let i = 0; i < waitingPool.length; i++) {
    const peerAId = waitingPool[i];
    const peerA = clients.get(peerAId);
    if (!peerA) continue;

    let bestMatchId = null;
    let highestScore = -1;

    for (let j = 0; j < waitingPool.length; j++) {
      if (i === j) continue;
      const peerBId = waitingPool[j];
      const peerB = clients.get(peerBId);
      if (!peerB) continue;

      // Check Match Filters
      
      // 1. Language must match exactly (soft: skip if only 2 in pool)
      if (waitingPool.length > 2 && peerA.info.language !== peerB.info.language) continue;

      // 2. Country matches (soft filter - only enforced with 3+ in pool)
      if (waitingPool.length > 2) {
        const countryCompat = (peerA.info.country === 'Worldwide' || peerB.info.country === 'Worldwide' || peerA.info.country === peerB.info.country);
        if (!countryCompat) continue;
      }

      // Calculate score: interest tags + age proximity bonus
      const commonTags = peerA.info.tags.filter(t => peerB.info.tags.includes(t));
      let score = commonTags.length * 2;

      // Age proximity bonus: closer age = higher score (max 5 bonus points)
      const ageA = peerA.info.age || 18;
      const ageB = peerB.info.age || 18;
      const ageDiff = Math.abs(ageA - ageB);
      if (ageDiff <= 2) score += 5;
      else if (ageDiff <= 5) score += 3;
      else if (ageDiff <= 10) score += 1;

      if (score > highestScore) {
        highestScore = score;
        bestMatchId = peerBId;
      }
    }

    if (bestMatchId) {
      // Pair Peer A and Peer B
      const peerBId = bestMatchId;
      
      // Remove both from waiting pool
      waitingPool = waitingPool.filter(id => id !== peerAId && id !== peerBId);
      
      // Create Session
      const sessionId = `session_${peerAId}_${peerBId}`;
      activeSessions.set(sessionId, { peerAId, peerBId });

      const clientA = clients.get(peerAId);
      const clientB = clients.get(peerBId);

      console.log(`🔗 Match established: ${peerAId} <==> ${peerBId} (Shared tags: ${highestScore})`);

      // Notify Peer A (Initiator role: will send WebRTC Offer)
      clientA.socket.send(JSON.stringify({
        type: 'matched',
        data: {
          role: 'initiator',
          peerId: peerBId,
          peerInfo: {
            name: clientB.info.name,
            handle: clientB.info.handle,
            avatar: clientB.info.avatar,
            gender: clientB.info.gender,
            age: clientB.info.age,
            country: clientB.info.country,
            language: clientB.info.language,
            tags: clientB.info.tags
          }
        }
      }));

      // Notify Peer B (Receiver role: will await WebRTC Offer)
      clientB.socket.send(JSON.stringify({
        type: 'matched',
        data: {
          role: 'receiver',
          peerId: peerAId,
          peerInfo: {
            name: clientA.info.name,
            handle: clientA.info.handle,
            avatar: clientA.info.avatar,
            gender: clientA.info.gender,
            age: clientA.info.age,
            country: clientA.info.country,
            language: clientA.info.language,
            tags: clientA.info.tags
          }
        }
      }));

      // Break to re-evaluate pool with updated list
      tryMatchmaking();
      break;
    }
  }
}

// Bot/Mock Partner simulator for local testing when no other real client is online
setInterval(() => {
  const now = Date.now();
  for (const clientId of waitingPool) {
    const client = clients.get(clientId);
    if (!client) continue;

    // If waiting for more than 7 seconds, match with a virtual bot
    if (now - client.info.joinedAt > 7000) {
      // Create Bot metadata
      const botId = `bot_${Math.random().toString(36).substr(2, 9)}`;
      const botGenders = ['Male', 'Female'];
      const botGender = botGenders[Math.floor(Math.random() * botGenders.length)];
      const botCountries = ['United States', 'United Kingdom', 'Germany', 'Japan', 'France', 'Canada'];
      const botCountry = client.info.country === 'Worldwide' ? botCountries[Math.floor(Math.random() * botCountries.length)] : client.info.country;
      const botTags = [...client.info.tags, 'Chatting', 'Tech', 'Music', 'Humor'].slice(0, 3);
      const botNames = ['Alex', 'Jordan', 'Sam', 'Riley', 'Morgan', 'Casey', 'Maya', 'Leo'];
      const botName = botNames[Math.floor(Math.random() * botNames.length)];
      const botAge = Math.max(13, (client.info.age || 18) + Math.floor(Math.random() * 7) - 3);
      const botAvatars = ['🐻','🦊','🐼','🦁','🐯','🦄','🐺','🦉'];
      const botAvatar = botAvatars[Math.floor(Math.random() * botAvatars.length)];

      console.log(`🤖 Matching lonely peer ${clientId} with simulated Bot: ${botId}`);

      // Remove peer from waiting pool
      waitingPool = waitingPool.filter(id => id !== clientId);

      // Create session
      const sessionId = `session_${clientId}_${botId}`;
      activeSessions.set(sessionId, { peerAId: clientId, peerBId: botId });

      // Notify client (always make them initiator so they think they are calling a real WebRTC target, 
      // but client-side logic will intercept signal payloads for bot_ identifiers and feed simulated voice/data)
      client.socket.send(JSON.stringify({
        type: 'matched',
        data: {
          role: 'initiator',
          peerId: botId,
          isBot: true,
          peerInfo: {
            name: botName,
            handle: botName,
            avatar: botAvatar,
            gender: botGender,
            age: botAge,
            country: botCountry,
            language: client.info.language,
            tags: botTags
          }
        }
      }));
      
      break;
    }
  }
}, 3000);

// WebSocket event handlers
wss.on('connection', (socket) => {
  let myClientId = null;

  socket.on('message', (messageStr) => {
    try {
      const message = JSON.parse(messageStr);
      
      switch (message.type) {
        case 'join': {
          const { id, gender, country, language, tags, name, age, handle, avatar, chatMode, reconnectTarget } = message.data;
          myClientId = id;

          // Save socket and parameters
          clients.set(id, {
            socket,
            info: {
              id,
              name: name || handle || 'Stranger',
              handle: handle || 'Stranger',
              avatar: avatar || '🐻',
              gender: gender || 'Other',
              age: age || 18,
              country,
              language,
              tags: tags || [],
              chatMode: chatMode || 'voice',
              joinedAt: Date.now()
            }
          });

          console.log(`👤 Peer ${id} registered. Name: ${name}, Age: ${age}, Language: ${language}`);
          if (reconnectTarget) {
            console.log(`👤 Peer ${id} registered with reconnect target: ${reconnectTarget}. Holding matchmaking.`);
          } else {
            putInWaitingPool(id);
          }
          break;
        }

        case 'reconnect': {
          const { targetHandle } = message.data;
          if (!myClientId) return;

          console.log(`🔄 Client ${myClientId} requested recall/reconnect to handle: ${targetHandle}`);

          // Find the target client B
          let targetClientId = null;
          let targetClient = null;
          for (const [id, client] of clients.entries()) {
            if (id !== myClientId && (client.info.handle === targetHandle || client.info.name === targetHandle)) {
              targetClientId = id;
              targetClient = client;
              break;
            }
          }

          const myClient = clients.get(myClientId);

          if (targetClient && waitingPool.includes(targetClientId)) {
            // Target is online and waiting! Pair them immediately.
            console.log(`🎯 Target peer ${targetHandle} (${targetClientId}) is available in waiting pool. Pairing!`);
            
            // Remove both from waiting pool
            waitingPool = waitingPool.filter(id => id !== myClientId && id !== targetClientId);

            // Create Session
            const sessionId = `session_${myClientId}_${targetClientId}`;
            activeSessions.set(sessionId, { peerAId: myClientId, peerBId: targetClientId });

            // Send matched to initiator (A)
            if (myClient && myClient.socket.readyState === WebSocket.OPEN) {
              myClient.socket.send(JSON.stringify({
                type: 'matched',
                data: {
                  role: 'initiator',
                  peerId: targetClientId,
                  peerInfo: {
                    name: targetClient.info.name,
                    handle: targetClient.info.handle,
                    avatar: targetClient.info.avatar,
                    gender: targetClient.info.gender,
                    age: targetClient.info.age,
                    country: targetClient.info.country,
                    language: targetClient.info.language,
                    tags: targetClient.info.tags
                  }
                }
              }));
            }

            // Send matched to receiver (B)
            if (targetClient && targetClient.socket.readyState === WebSocket.OPEN) {
              targetClient.socket.send(JSON.stringify({
                type: 'matched',
                data: {
                  role: 'receiver',
                  peerId: myClientId,
                  peerInfo: {
                    name: myClient.info.name,
                    handle: myClient.info.handle,
                    avatar: myClient.info.avatar,
                    gender: myClient.info.gender,
                    age: myClient.info.age,
                    country: myClient.info.country,
                    language: myClient.info.language,
                    tags: myClient.info.tags
                  }
                }
              }));
            }

          } else {
            // Target is not available
            console.log(`❌ Target peer ${targetHandle} is not available (offline or busy).`);
            socket.send(JSON.stringify({
              type: 'chat_message',
              data: {
                senderPeerId: 'system',
                text: `[SYSTEM] Could not connect: ${targetHandle} is offline or busy.`
              }
            }));
            
            // Put client in waiting pool so they start normal matching
            putInWaitingPool(myClientId);
          }
          break;
        }

        case 'skip': {
          if (!myClientId) return;

          // Find active session
          for (const [sessionId, session] of activeSessions.entries()) {
            if (session.peerAId === myClientId || session.peerBId === myClientId) {
              const otherPeerId = session.peerAId === myClientId ? session.peerBId : session.peerAId;
              
              // Notify other peer
              const otherClient = clients.get(otherPeerId);
              if (otherClient && otherClient.socket.readyState === WebSocket.OPEN) {
                otherClient.socket.send(JSON.stringify({ type: 'skipped' }));
                
                // Put them back in matchmaking pool
                putInWaitingPool(otherPeerId);
              }
              
              activeSessions.delete(sessionId);
              console.log(`⏭️ Session ${sessionId} skipped by client ${myClientId}`);
              break;
            }
          }

          // Put skipper back in matchmaking pool
          putInWaitingPool(myClientId);
          break;
        }

        // WebRTC Signaling relays: offer, answer, ice-candidate
        case 'offer':
        case 'answer':
        case 'candidate': {
          const { targetPeerId, data } = message;
          if (!targetPeerId) return;

          // If target is bot, bot logic handles responses locally on client-side
          if (targetPeerId.startsWith('bot_')) return;

          const targetClient = clients.get(targetPeerId);
          if (targetClient && targetClient.socket.readyState === WebSocket.OPEN) {
            targetClient.socket.send(JSON.stringify({
              type: message.type,
              senderPeerId: myClientId,
              data: data
            }));
          }
          break;
        }

        // Text chat relay
        case 'chat_message': {
          const { targetPeerId, text } = message.data;
          if (!targetPeerId) return;

          // If target is bot, client will handle bot replies client-side
          if (targetPeerId.startsWith('bot_')) return;

          const targetClient = clients.get(targetPeerId);
          if (targetClient && targetClient.socket.readyState === WebSocket.OPEN) {
            targetClient.socket.send(JSON.stringify({
              type: 'chat_message',
              data: {
                senderPeerId: myClientId,
                text: text
              }
            }));
          }
          break;
        }

        case 'typing': {
          const { targetPeerId, isTyping } = message.data;
          if (!targetPeerId) return;
          if (targetPeerId.startsWith('bot_')) return;

          const targetClient = clients.get(targetPeerId);
          if (targetClient && targetClient.socket.readyState === WebSocket.OPEN) {
            targetClient.socket.send(JSON.stringify({
              type: 'typing',
              data: {
                senderPeerId: myClientId,
                isTyping: isTyping
              }
            }));
          }
          break;
        }

        case 'game_action': {
          const { targetPeerId, gameType, action, payload } = message.data;
          if (!targetPeerId) return;
          if (targetPeerId.startsWith('bot_')) return;

          const targetClient = clients.get(targetPeerId);
          if (targetClient && targetClient.socket.readyState === WebSocket.OPEN) {
            targetClient.socket.send(JSON.stringify({
              type: 'game_action',
              data: {
                senderPeerId: myClientId,
                gameType,
                action,
                payload
              }
            }));
          }
          break;
        }
      }
    } catch (err) {
      console.error('Error processing socket message:', err);
    }
  });

  socket.on('close', () => {
    if (myClientId) {
      console.log(`🔌 Socket connection closed for client ${myClientId}`);
      cleanupClient(myClientId);
    }
  });

  socket.on('error', (err) => {
    console.error(`Socket error for client ${myClientId}:`, err);
    if (myClientId) {
      cleanupClient(myClientId);
    }
  });
});
