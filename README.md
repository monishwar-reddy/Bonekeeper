# Bonekeeper

Bonekeeper is a professional Halloween-themed moderation lab for live
communities. It combines deterministic spam protection, an optional Gemini
classifier, a simulated group chat, an admin review portal, and a Telegram
webhook behind one platform-agnostic moderation core.

**Live demo:** https://sentinelmod.netlify.app
**Repository:** https://github.com/monishwar-reddy/Bonekeeper

## What it demonstrates

- Reliable removal of scam links, URL shorteners, suspicious domains, floods,
  chain messages, and member links.
- Normal conversation such as greetings, questions, and positive messages is
  allowed.
- Seven simulated bots produce a realistic mix of helpful and hostile traffic.
- Member and admin roles share the same browser session and chat history.
- Admins can inspect moderation decisions, review messages, restore false
  positives, manage settings, and pause bot activity.
- A Telegram webhook uses the same moderation pipeline through a separate
  adapter.
- Persistent demo state uses Netlify Blobs when deployed, with a local fallback
  for development.

## Architecture

The monorepo is organized around a reusable core:

```text
packages/
├── core/                 Platform-agnostic moderation pipeline
├── adapter-simulated/    Seven-bot web demo adapter
├── adapter-telegram/     Telegram integration adapter
├── adapter-discord/      Discord adapter foundation
└── dashboard/            Next.js web app, API routes, and admin portal
```

Every message follows the same flow:

1. Protected senders and allowlisted domains bypass moderation.
2. Cheap rules catch high-confidence patterns immediately.
3. The classifier evaluates messages that need semantic analysis.
4. The decision engine applies the configured strictness policy.
5. The adapter performs the action and an audit record is written.
6. Repeat-offender tracking can warn or mute persistent offenders.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full data flow,
persistence model, API routes, and deployment details.

## Local development

### Requirements

- Node.js 20+
- npm 9+

### Install

```bash
npm install
```

Copy the example environment file if you want to configure the local app:

```bash
copy .env.example .env.local
```

PowerShell users can use the equivalent:

```powershell
Copy-Item .env.example .env.local
```

Environment values are optional for the deterministic demo. Configure
`GEMINI_API_KEY` to enable Gemini classification and `ADMIN_PIN` to change the
demo admin PIN. Never commit `.env` or `.env.local`.

### Run the dashboard

```bash
npm run dev --workspace @bonekeeper/dashboard
```

Open [http://localhost:3000](http://localhost:3000).

The default demo admin PIN is `1234` when `ADMIN_PIN` is not configured.

## Useful commands

```bash
# Run all tests
npm test

# Build every workspace
npm run build

# Start the production dashboard after building
npm run start --workspace @bonekeeper/dashboard

# Run the dashboard test suite only
npm test --workspace @bonekeeper/dashboard
```

## Environment variables

Use local `.env` files or Netlify environment settings. The repository
contains examples only; real values must stay outside Git.

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Enables Gemini-backed message classification |
| `ADMIN_PIN` | Server-side PIN for admin access; defaults to `1234` in the demo |
| `SESSION_SECRET` | Optional local session configuration value |
| `TELEGRAM_BOT_TOKEN` | Telegram adapter credentials when integrating Telegram |
| `DISCORD_BOT_TOKEN` | Discord adapter credentials when integrating Discord |

## Deploying to Netlify

The root [`netlify.toml`](netlify.toml) configures the Next.js plugin,
Turbo build, dashboard publish output, and Node.js 20.

For a linked site:

```bash
npx netlify deploy --prod --site <site-id> --filter @bonekeeper/dashboard
```

Set secrets in Netlify’s environment-variable settings rather than in
`netlify.toml` or source files.

## Security and privacy

- Secrets, private keys, local deployment state, dependencies, and build
  output are excluded by [`.gitignore`](.gitignore).
- Admin authorization is checked server-side.
- Admin API routes reject unauthenticated requests.
- LLM failures fail open so normal messages are not silently deleted.
- Message text is treated as untrusted content during classification.
- Use a strong production `ADMIN_PIN` and platform-specific bot tokens.

## Project documentation

- [Architecture](docs/ARCHITECTURE.md
- [MIT License](LICENSE)
