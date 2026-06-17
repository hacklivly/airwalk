# Implementation Plan: Admin Blog System

## Goal
Add a dynamic blog system with an admin panel for creating/managing posts, backed by a database, with SSR on Cloudflare Pages and SEO-optimized blog rendering.

---

## Phase 1: Enable SSR (Hybrid Mode)

- [ ] Switch Astro output from `static` to `hybrid` in `astro.config.mjs`
- [ ] Add Cloudflare adapter (`@astrojs/cloudflare`)
- [ ] Ensure existing static pages still prerender (add `export const prerender = true` where needed)

---

## Phase 2: Database Setup

- [ ] Create a D1 database on Cloudflare (`airwalk-blog`)
- [ ] Create the `blogs` table:
  ```sql
  CREATE TABLE blogs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      content TEXT NOT NULL,
      description TEXT,
      featured_image TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  ```
- [ ] Bind D1 to the Pages project in `wrangler.toml`

---

## Phase 3: Secure Admin Login

- [ ] Create `src/pages/admin/login.astro` (SSR, `prerender = false`)
- [ ] Store credentials in Cloudflare environment variables (`ADMIN_USERNAME`, `ADMIN_PASSWORD`)
- [ ] On successful login, set an `httpOnly` secure cookie (`admin_session`)
- [ ] Redirect to `/admin/dashboard`

---

## Phase 4: Admin Dashboard (Post Creator)

- [ ] Create `src/pages/admin/dashboard.astro` (SSR, `prerender = false`)
- [ ] Verify `admin_session` cookie — redirect to login if missing
- [ ] Build a form with: Title, Content (textarea), Description, Featured Image URL
- [ ] On submit: auto-generate slug from title, insert into D1
- [ ] Show success/error message

---

## Phase 5: Dynamic Blog Route

- [ ] Create `src/pages/blog/[slug].astro` (SSR, `prerender = false`)
- [ ] Query D1 for the post matching the slug
- [ ] If not found, return 404
- [ ] Render with SEO-optimized layout (Schema.org JSON-LD, proper meta tags)

---

## Phase 6: Core Web Vitals & SEO

- [ ] Use system font stack (no external fonts)
- [ ] Set explicit `width`/`height` on all images (prevent CLS)
- [ ] Preload featured images with `fetchpriority="high"`
- [ ] Add `<link rel="canonical">` to each blog post
- [ ] Add Schema.org `BlogPosting` JSON-LD structured data
- [ ] Only lazy-load images below the fold

---

## Phase 7: Deploy & Test

- [ ] Run `npm run build` to verify hybrid build works
- [ ] Deploy with `npx wrangler pages deploy ./dist --project-name=airwalk`
- [ ] Set env vars (`ADMIN_USERNAME`, `ADMIN_PASSWORD`) in Cloudflare Pages settings
- [ ] Test login at `/admin/login`
- [ ] Create a test post and verify it renders at `/blog/<slug>`
- [ ] Verify existing static pages still work

---

## Tech Decisions

| Choice | Reason |
|--------|--------|
| Cloudflare D1 | Already on CF Pages, free, no external DB needed |
| Hybrid mode | Keep existing pages static/fast, only SSR admin + dynamic blog |
| Cookie auth | Simple, no JS needed, httpOnly for security |
| No external fonts | Zero CLS, instant text rendering |

---

## File Changes Summary

| File | Action |
|------|--------|
| `astro.config.mjs` | Add CF adapter, switch to hybrid |
| `wrangler.toml` | Add D1 binding |
| `src/pages/admin/login.astro` | New — login page |
| `src/pages/admin/dashboard.astro` | New — post creator |
| `src/pages/blog/[slug].astro` | New — dynamic blog renderer |
| `.env` | Local dev credentials (gitignored) |
