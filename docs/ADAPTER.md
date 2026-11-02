# Adding a New Platform Adapter

Bonekeeper's core is platform-agnostic. Adding a new platform takes ~50 lines.

## Steps

### 1. Copy the template
```
cp templates/adapter-template/index.ts packages/adapter-yourplatform/src/index.ts
```

### 2. Implement `normaliseMessage`
Map your platform's event object to the core `Message` type:
```ts
{
  id, platform, groupId,
  sender: { id, name, role, joinedAt },
  text, links, isForwarded, timestamp
}
```
Role mapping: `creator` / `administrator` → `'admin'`, everyone else → `'member'`.

### 3. Implement `YourPlatformAdapter`
Four methods: `delete`, `hide`, `warn`, `notifyAdmins`.  
If a capability is unsupported, set `canHide: false` etc. in `capabilities()` — the core pipeline will automatically downgrade the action (e.g. hide → flag for admin review).

### 4. Wire up the webhook / event listener
```ts
import { ModerationPipeline, LLMClassifier, InMemoryStorage } from '@bonekeeper/core';
import { normaliseMessage, YourPlatformAdapter } from './index';

const pipeline = new ModerationPipeline(new LLMClassifier(GEMINI_KEY), new InMemoryStorage());

onEvent(async (event) => {
  const msg     = normaliseMessage(event);
  if (!msg) return;
  const adapter = new YourPlatformAdapter(msg.groupId);
  await pipeline.moderate(msg, config, adapter);
});
```

### 5. Log to the same audit table
Pass your store's `addAuditRecord` call after `pipeline.moderate()` — the admin report shows all platforms in one view with a platform tag.

## What you never touch
`packages/core` — zero changes required. The core only depends on the `PlatformAdapter` interface.
