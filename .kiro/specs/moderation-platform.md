# Bonekeeper moderation platform

## Goal

Provide a reusable moderation core that can power independent applications
without putting platform-specific code in `packages/core`.

## Applications

- Web Demo: `apps/web-demo` -> `packages/dashboard`
- Telegram App: `apps/telegram` -> `packages/dashboard/src/app/api/telegram-webhook`

## Required behavior

- Allow ordinary greetings, questions, and positive conversation.
- Remove member links, scam links, shorteners, floods, and repeat spam.
- Preserve the same browser session when switching between member and admin.
- Keep admin review and audit actions server-authorized.
- Fail open when the classifier or persistence service is unavailable.
