# Airwalk — Complete Guide

## What is Airwalk?

Airwalk is a **free anonymous chat platform** where strangers can talk via voice or text — no signup, no camera, no personal info required. Think of it like Omegle but better: voice-only calls, games, friends system, and more.

**Live at:** https://airwalk.pages.dev

---

## How the Site Works (Simple Explanation)

1. **User visits the site** → sees the Setup Screen
2. **User picks a mode** (Voice / Text / Group) and clicks "Start Matching"
3. **Browser connects to a WebSocket server** (signaling server on Cloudflare Workers)
4. **Server pairs two users** who are both waiting
5. **For voice chat:** A peer-to-peer audio connection (WebRTC) is created directly between the two browsers — audio goes directly between users, NOT through the server
6. **For text chat:** Messages are relayed through the WebSocket server
7. **When done:** User can skip to the next person, stop, or add the stranger as a friend

```
[User A's Browser] ←—WebSocket—→ [Cloudflare Worker (Signaling)] ←—WebSocket—→ [User B's Browser]
                    ←————————— WebRTC Audio (direct P2P) ———————————→
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Astro (static site generator) |
| Styling | Tailwind CSS v4 |
| Hosting | Cloudflare Pages |
| Signaling Server | Cloudflare Worker (`worker/src/index.js`) |
| Real-time | WebSocket + WebRTC |
| Audio | Browser MediaDevices API + WebAudio |

---

## Every Feature Explained

### 1. Anonymous Identity
- Every user gets a random handle like "CoolFox429" and an animal emoji avatar
- No signup needed — identity is stored in localStorage
- Users can regenerate their handle anytime

### 2. Chat Modes
- **🎙️ Voice** — Real-time voice call using WebRTC (peer-to-peer, no server in between)
- **💬 Text** — Text-only messaging through the WebSocket server
- **👥 Group** — Voice chat with 2-4 people in a room

### 3. Matching & Filters
- **Language filter** — Match with people who speak your language
- **Country filter** — Match by country or worldwide
- **Interest tags** — Add tags like Gaming, Music, Anime to find like-minded people
- **Mood selector** — Set your mood (😊 😎 😴 🧠 🎉) for better matches

### 4. Special Modes
- **🎭 Mystery Mode** — Partner's identity is hidden for 2 minutes, then revealed
- **⚡ Speed Dating** — Only 60 seconds per match, then auto-skips
- **🌙 Night/After Dark** — Auto-activates after 11 PM with dark vibes

### 5. Voice Features
- **Mute/Unmute** — Toggle your microphone on/off
- **Volume slider** — Control partner's volume
- **Voice Effects** — Cycle through: Normal, Pitch Up, Pitch Down, Robot, Echo
- **Equalizer visualization** — Animated bars showing audio activity
- **Partner mute indicator** — See when partner mutes themselves

### 6. Text Chat Features
- **Real-time typing indicator** — Shows "Stranger is typing..."
- **Image sharing** — Send images (max 5MB, converted to base64)
- **GIF search** — Search and send GIFs via Tenor API
- **Message reactions** — Double-click any message to react with emoji (👍❤️😂😮😢)
- **Chat themes** — Toggle between Default, Neon, and Pastel color themes

### 7. Games (Play While Chatting)
| Game | How it Works |
|------|-------------|
| ❌ Tic-Tac-Toe | Classic 3x3, take turns |
| ✊ Rock Paper Scissors | Best of 3 rounds |
| 🔴 Connect Four | Drop pieces, get 4 in a row |
| 🟩 Wordle | Guess a 5-letter word in 6 tries |
| 🎲 Ludo Race | Roll dice, race to position 16 |
| 🔥 Truth or Dare | Random truth questions or dare challenges |
| 🤔 Would You Rather | Pick between two options |
| 🎵 Song Guess | Hum a song, partner guesses |
| 🎨 Quick Draw | Draw on canvas, partner guesses the word |

### 8. Friends System
- **Add friend** — Save a stranger you liked to your friends list
- **Reconnect** — Call a friend directly by their handle
- **Remove friend** — Delete from your list anytime
- Stored in localStorage (browser-only, no account needed)

### 9. Call History
- Every call is saved with handle, avatar, duration, and date
- Can recall (reconnect to) anyone from history
- Last 50 calls stored locally

### 10. Safety Features
- **Block user** — Blocked users won't be matched with you again
- **Report abuse** — Reports and auto-blocks the user
- **Skip (5s cooldown)** — Skip to next person after 5-second cooldown
- **Stop button** — End the session entirely and return to setup
- **Karma system** — Good behavior (adding friends) increases karma; reports decrease it

### 11. Incoming Calls
- When a friend calls you, a modal popup appears with Accept/Reject buttons
- Ringtone plays using WebAudio oscillator
- Auto-rejects after ~22 seconds if no answer

### 12. Reconnection
- If partner disconnects, a 60-second timer starts
- If they come back within 60s, the chat resumes
- Otherwise, auto-finds a new match
- "Recall" button lets you try reconnecting to the last partner

### 13. Silence Breaker
- If nobody types for 30 seconds, a conversation starter appears:
  - "Ask: What's your favorite movie of all time?"
  - "Ask: If you could travel anywhere tomorrow, where?"

### 14. Achievements & Badges
| Badge | Requirement |
|-------|------------|
| 🎉 First Chat | 1 conversation |
| 💬 Social Butterfly | 10 conversations |
| 🗣️ Chatterbox | 50 conversations |
| 👑 Chat King | 100 conversations |
| 🤝 First Friend | 1 friend added |
| 👥 Popular | 10 friends |
| 🎮 Gamer | 5 games played |
| 🏆 Champion | 20 games played |

### 15. Coins & Referral
- Earn 1 coin per minute of active call
- Get 10 coins when joining via a referral link
- Each user gets a unique referral code (e.g., `AW-X7K9M2`)
- Share invite link with referral code embedded

### 16. Online Counter
- Shows estimated online users (dynamic, time-based)
- Higher counts in evening hours (18-23), lower at night (2-7)
- Fluctuates naturally with small random changes

### 17. Comeback Reward
- If you haven't visited for 3+ days, you get a welcome-back message
- "We missed you! Here's a virtual high-five ✋"

### 18. Dark/Light Theme
- Toggle between dark and light mode
- Preference saved in localStorage
- Auto-detects system preference on first visit

---

## File Structure

```
airwalk/
├── src/
│   ├── pages/
│   │   ├── index.astro          — Landing/home page
│   │   ├── chat.astro           — Main chat app (all features above)
│   │   ├── about.astro          — About page
│   │   ├── blog/                — Blog posts (SEO content)
│   │   ├── contact.astro        — Contact page
│   │   ├── privacy.astro        — Privacy policy
│   │   ├── terms.astro          — Terms of service
│   │   └── safety.astro         — Safety guidelines
│   ├── layouts/
│   │   └── Layout.astro         — Base HTML layout
│   ├── styles/
│   │   └── global.css           — Tailwind + custom styles
│   └── components/              — Reusable Astro components
├── worker/
│   └── src/
│       └── index.js             — Cloudflare Worker signaling server
├── signaling.js                 — Local dev signaling server (Node.js)
├── public/                      — Static assets (favicon, images)
├── dist/                        — Build output (deployed to Cloudflare)
├── DEPLOY.md                    — This file
└── package.json                 — Dependencies & scripts
```

---

## How WebRTC Voice Chat Works

1. **User A** clicks "Start Matching" → browser gets microphone permission
2. **User A** connects to WebSocket server and sends `join` with preferences
3. **Server** finds **User B** with compatible preferences → sends `matched` to both
4. **User A** (initiator) creates an RTCPeerConnection and an "offer" (SDP)
5. **Offer** is sent to User B via the WebSocket server
6. **User B** receives offer, creates an "answer" (SDP), sends it back
7. **ICE candidates** are exchanged (network paths to reach each other)
8. **Direct audio stream** flows between browsers (peer-to-peer)
9. **Server is no longer involved** in the audio — only chat messages go through it

---

## Deployment

### 1. Install Dependencies

```sh
npm install
```

### 2. Build the Site

```sh
npm run build
```

### 3. Deploy to Cloudflare Pages

```sh
npx wrangler pages deploy ./dist --project-name=airwalk
```

### 4. Deploy the Signaling Worker

```sh
cd worker
npx wrangler deploy
```

### 5. Local Development

```sh
npm run dev
```

Runs at `localhost:4321`. The local signaling server (`signaling.js`) runs on port 3001:

```sh
node signaling.js
```

---

## Environment

- No environment variables needed for the frontend
- The signaling worker URL is hardcoded in `chat.astro`:
  - Local: `ws://localhost:3001`
  - Production: `wss://airwalk-signal.airwalkhq.workers.dev`
- Tenor GIF API key is embedded in the frontend code

---

## Summary

Airwalk is a fully client-side app with no database and no accounts. Everything is stored in the user's browser (localStorage). The only server component is the WebSocket signaling worker that pairs users and relays text messages. Voice audio flows directly between browsers via WebRTC.
