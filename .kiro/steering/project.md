---
inclusion: always
---

# Bonekeeper — Project Steering

## Stack
- TypeScript, Node.js 20, npm workspaces
- Next.js 14 (App Router) for the dashboard
- Netlify (serverless functions + Netlify Blobs for storage)
- Gemini 2.5 Flash for classification and bot persona messages
- Vitest for unit tests

## Monorepo layout
- `packages/core` — platform-agnostic moderation engine. NEVER add platform code here.
- `packages/adapter-simulated` — 7-bot simulated chat adapter
- `packages/dashboard` — Next.js app with vendored core at `src/vendor/`
- `templates/adapter-template` — stub for new adapters
- `docs/` — developer guides

## Key constraints
- All workspace package imports in the dashboard MUST use `@/vendor/core/` or `@/vendor/adapter-simulated/` paths, NOT `@bonekeeper/core` — Netlify's bundler cannot resolve workspace symlinks at runtime.
- Fail open everywhere: any error in the moderation pipeline must leave the message alone.
- Never store secrets in files. All env vars (GEMINI_API_KEY, ADMIN_PIN, SESSION_SECRET, TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET) live in Netlify env only.
- Admin cookie is signed HttpOnly. The display cookie `bk_role_display` is readable client-side for the nav only.

## Deploy command
```
netlify deploy --prod --skip-functions-cache --filter @bonekeeper/dashboard
```
