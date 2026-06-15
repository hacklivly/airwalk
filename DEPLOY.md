# Deployment Guide

## Prerequisites

- Node.js installed
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) authenticated (`npx wrangler login`)

## Build

```sh
npm install
npm run build
```

This outputs the static site to `./dist/`.

## Deploy to Cloudflare Pages

```sh
npx wrangler pages deploy ./dist --project-name=airwalk
```

Live at: https://airwalk.pages.dev

## Deploy Worker (Signaling Server)

```sh
cd worker
npx wrangler deploy
```

## Notes

- The Astro site builds as static output — no server runtime needed.
- Cloudflare Pages serves the `./dist/` folder directly.
- The signaling WebSocket server runs as a separate Cloudflare Worker at `airwalk-signal.airwalkhq.workers.dev`.
