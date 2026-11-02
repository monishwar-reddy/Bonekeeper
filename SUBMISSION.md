# Bonekeeper — Hackathon Submission Checklist

## Skeleton Crew Category

| Item | Status |
|---|---|
| Repo URL | (add your GitHub URL here) |
| Live URL | https://sentinelmod.netlify.app |
| Category | Skeleton Crew (one core, two apps) |
| Demo video | (link to recording) |
| License | MIT |

## Skeleton Crew proof

- **Core** (`packages/core`) — zero platform-specific code. Runs the full 6-step moderation pipeline, Gemini classifier, decision engine, repeat-offender tracker.
- **App 1** — Web demo at `/chat`. Browser-driven simulated chat with 7 bots (3 positive, 4 negative). Admin report at `/admin`.
- **App 2** — Telegram bot via `POST /api/telegram-webhook`. Same core pipeline, different adapter. `git diff packages/core` between both apps is empty.

## Architecture diagram

See README.md.

## Demo video script (2–3 min)

1. **(0:00)** Open https://sentinelmod.netlify.app — welcome screen, explain the two roles
2. **(0:20)** Join as Member → chat loads, bots start posting every ~4 seconds
3. **(0:40)** SpamBot Sam posts a promo link → Bonekeeper deletes it, warning chip appears
4. **(1:00)** Switch to Admin in the composer, post the same spam → message is untouched (admin bypass)
5. **(1:20)** Open /admin (PIN: 1234) → see the report table, deleted messages, confidence bars
6. **(1:40)** Click "✅ OK" (Mark as OK) on a false positive → "Restored by admin" appears in /chat within 2s poll
7. **(2:00)** Show the learning card: "Agent learned from N corrections"
8. **(2:20)** Show the Settings tab — strictness, allowlist, Séance mode, pause bots
9. **(2:40)** (Optional) Show Telegram bot receiving and moderating a message in a test group

## Safety checklist

- [ ] No secrets in files or commits (`GEMINI_API_KEY`, `ADMIN_PIN`, `SESSION_SECRET` all in Netlify env)
- [ ] Admin PIN checked server-side with signed HttpOnly cookie
- [ ] All `/api/admin/*` routes return 403 without valid admin cookie
- [ ] Fail open: LLM errors leave the message alone
- [ ] Rate limits on `/api/messages`, `/api/bot-tick`, `/api/auth`
- [ ] Prompt injection defence: LLM treats message text as untrusted content only
- [ ] Auto-purge: logs older than 30 days can be cleared via reset
