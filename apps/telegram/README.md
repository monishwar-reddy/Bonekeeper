# Bonekeeper Telegram App

This is application 2 in the Skeleton Crew submission: the Telegram
moderation application using the same platform-agnostic moderation core.

The webhook implementation is
[`packages/dashboard/src/app/api/telegram-webhook`](../../packages/dashboard/src/app/api/telegram-webhook),
and the standalone adapter is in
[`packages/adapter-telegram`](../../packages/adapter-telegram).

Configure `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, and
`GEMINI_API_KEY` in the deployment environment. Never commit these values.
