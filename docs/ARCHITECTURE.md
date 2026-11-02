# Bonekeeper — Architecture

## Overview

Bonekeeper is a group-chat moderation system built on a single platform-agnostic core engine, deployed to two distinct applications without any changes to the core.

```
                         ┌──────────────────────────────────────────────┐
                         │              @bonekeeper/core                │
                         │                                              │
                         │  ┌─────────────────────────────────────┐    │
                         │  │         ModerationPipeline          │    │
                         │  │  (runs in this exact order)         │    │
                         │  │                                     │    │
                         │  │  1. Protected Senders               │    │
                         │  │     admin / mod / allowlist → ALLOW │    │
                         │  │     (code only, never LLM)          │    │
                         │  │                                     │    │
                         │  │  2. Cheap Rules                     │    │
                         │  │     blocklisted domains, URL        │    │
                         │  │     shorteners, flood, new-member   │    │
                         │  │     links, chain messages           │    │
                         │  │                                     │    │
                         │  │  3. LLM Classifier (Gemini)         │    │
                         │  │     → JSON: category, confidence,   │    │
                         │  │       reason                        │    │
                         │  │     fail open on any error          │    │
                         │  │                                     │    │
                         │  │  4. Decision by Confidence          │    │
                         │  │     strict / balanced / lenient     │    │
                         │  │     → delete / quarantine / allow   │    │
                         │  │                                     │    │
                         │  │  5. Act + Audit Log                 │    │
                         │  │     call adapter, write record      │    │
                         │  │                                     │    │
                         │  │  6. Repeat Offender                 │    │
                         │  │     3 deletions / 24h → warn → mute │    │
                         │  └─────────────────────────────────────┘    │
                         │                                              │
                         │         PlatformAdapter interface            │
                         │  delete | hide | warn | notifyAdmins        │
                         │  capabilities()                              │
                         └──────────────┬───────────────────────────────┘
                                        │
                    ┌───────────────────┴───────────────────┐
                    │                                       │
                    ▼                                       ▼
       ┌────────────────────────┐             ┌────────────────────────┐
       │        APP 1           │             │        APP 2           │
       │   Web Demo (Next.js)   │             │    Telegram Webhook    │
       │                        │             │                        │
       │  SimulatedAdapter      │             │  TelegramAdapter       │
       │  ─────────────────     │             │  ───────────────────   │
       │  7 bots post every     │             │  POST /api/telegram-   │
       │  ~4s via browser tick  │             │  webhook               │
       │                        │             │                        │
       │  /chat  — live chat UI │             │  Normalise Telegram    │
       │  /admin — report +     │             │  update → Message      │
       │          settings      │             │                        │
       │                        │             │  getChatMember to      │
       │  Netlify Blobs         │             │  detect admin role     │
       │  (persistent state)    │             │                        │
       └────────────────────────┘             │  Same audit table,     │
                                              │  platform = "telegram" │
                                              └────────────────────────┘

            core unchanged between both apps — zero modifications
```

## End-to-end request lifecycle

The demo has two entry points, but both produce the same platform-neutral
`Message` object and use the same moderation pipeline:

1. A browser member sends a message to `POST /api/messages`, or Telegram sends
   an update to `POST /api/telegram-webhook`.
2. The route normalises the sender, text, links, role, group, and timestamp.
   The chat message is written first so the UI can show it immediately.
3. `moderateMessage()` loads the current group configuration and invokes the
   pipeline with an adapter and storage implementation.
4. Protected senders are allowed without an LLM call. Cheap deterministic rules
   then catch URL shorteners, suspicious scam domains, new-member links,
   repeated messages, floods, and forwarded chain messages.
5. Messages that pass the cheap rules go to Gemini when configured. The
   classifier receives untrusted message text as data and must return strict
   JSON. Missing keys, rate limits, API errors, or invalid JSON use the local
   keyword fallback and fail open.
6. The decision layer maps category and confidence to allow, quarantine, warn,
   or delete according to strictness. Adapter capabilities and admin-approval
   settings can downgrade a delete to quarantine.
7. The adapter performs the platform action. The dashboard adapter emits events
   instead of calling an external platform; Telegram calls the Telegram API.
8. The dashboard batches the resulting message status, audit record, warning,
   mute, and user updates into one state write. Netlify Blobs is used in
   production; an in-memory store is used locally.
9. The browser polls for changes and merges records by message ID. Deleted
   messages remain visible as a moderation tombstone rather than disappearing,
   making every decision explainable.

## Runtime components

| Component | Responsibility | Failure behavior |
|---|---|---|
| Next.js route handlers | Authentication, input validation, polling, webhook ingress | Return an explicit HTTP error for invalid input |
| `@bonekeeper/core` | Protected senders, cheap rules, classification, decision, adapter execution | Pipeline errors fail open and preserve the message |
| Simulated adapter | Demonstration actions and bot events | Records the action for the UI |
| Telegram adapter | Telegram message normalisation and API actions | Uses declared capabilities and quarantine fallback |
| Store | Messages, audit, users, configuration, corrections | Local memory fallback; production errors are logged |
| Admin report | Review, restore, correction examples, configuration | Every correction is retained for later classifier context |
| Netlify | Next.js server functions, static assets, production hosting | Atomic deploy; failed deploys do not replace the live version |

## State and consistency rules

- Message IDs are the merge key for polling and optimistic UI updates.
- A message is inserted with `ok` status, then changed to `deleted`, `held`, or
  `restored`; this preserves the original text for audit and review.
- `_batchWrite()` performs one read and one write for a moderation result so a
  status update cannot race an audit or warning update.
- Audit records are append-only until an admin review changes their review
  fields. Restoring a message does not erase the original moderation decision.
- Corrections are examples, not direct model instructions. They are bounded to
  the latest ten records before being added to a classifier prompt.

## Deployment

The repository is a Turborepo monorepo. Netlify selects
`@bonekeeper/dashboard` with the monorepo filter, runs the root
`npm run build`, and publishes `packages/dashboard/.next`. The
`@netlify/plugin-nextjs` plugin packages the server-rendered app and API
functions. The root `netlify.toml` deliberately uses repository-relative paths
so the generated server handler and `_next/static` assets are uploaded from
the same build root.

---

## Data flow for a single message

```
Browser/Telegram
      │
      │  POST /api/messages  (web)
      │  POST /api/telegram-webhook  (telegram)
      ▼
 API Route
      │  buildHumanMessage() / normaliseMessage()
      │  → core Message object
      │
      ├─► addChatMessage()  [store → Netlify Blobs]
      │
      └─► moderateMessage()
              │
              ├─► getGroupConfig()          [Blobs read]
              │
              ├─► ModerationPipeline.moderate()
              │       │
              │       ├── isProtectedSender()     ← code, no LLM
              │       ├── checkCheapRules()        ← code, no LLM
              │       ├── LLMClassifier.classify() ← Gemini API
              │       │       └── fail open → keywordClassify()
              │       └── makeDecision()
              │
              ├─► SimulatedAdapter / TelegramAdapter
              │       └── emits: delete | warn | mute events
              │
              └─► _batchWrite()            [ONE Blobs write]
                      ├── messageStatusUpdate (deleted/held/ok)
                      ├── auditRecord
                      ├── userUpsert (warning count)
                      └── warningChip / muteChip message
```

---

## Storage (Netlify Blobs)

All app state lives in a single JSON blob (`bonekeeper / state`).  
Schema:

```
AppState {
  messages:    ChatMessage[]     ← max 500, seeded with 2 welcome messages
  audit:       AuditRecord[]     ← all moderation actions across both platforms
  corrections: CorrectionRecord[] ← admin overrides fed back to the classifier
  users:       Record<id, UserRecord>
  config:      GroupConfig        ← strictness, allowlist, toggles
  lastTickAt:  number             ← bot debounce timestamp
  lastHumanMessage?: string       ← so bots can reply to the human
}
```

Local dev uses an in-memory fallback (`_mem`). No SQLite or external DB needed.

---

## Moderation thresholds

| Mode     | Delete    | Quarantine  |
|----------|-----------|-------------|
| Strict   | ≥ 0.80    | ≥ 0.50      |
| Balanced | ≥ 0.90    | ≥ 0.65      |
| Lenient  | ≥ 0.95    | ≥ 0.80      |

Scam/phishing use a lower delete threshold (−0.10) in every mode.  
Off-topic and unnecessary are never auto-deleted in Lenient mode.

---

## Security

- Session: HMAC-SHA256 signed cookie (`SESSION_SECRET`). Admin PIN checked server-side (`ADMIN_PIN`).
- All `/api/admin/*` routes return 403 without a valid signed admin cookie.
- Gemini API key lives only in the serverless function (`GEMINI_API_KEY`). Never sent to the browser.
- Prompt injection defence: message text is wrapped in `"""` delimiters and the prompt explicitly says to treat it as untrusted content.
- Rate limits: `/api/messages` 5 req / 10s per IP, `/api/bot-tick` 4 req / 10s per IP, `/api/auth` 10 req / min per IP.

---

## Adding a new platform

See `docs/ADAPTER.md`. Summary:
1. Copy `templates/adapter-template/index.ts`
2. Implement `normaliseMessage()` and the 4 adapter methods
3. Wire to a webhook/event listener and call `pipeline.moderate()`
4. Zero changes to `packages/core`
