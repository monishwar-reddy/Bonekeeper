import { Message, ModerationAction, PlatformAdapter, AuditRecord, QuarantineEntry, GroupConfig } from './types';
import { isProtectedSender } from './protected-senders';
import { checkCheapRules } from './cheap-rules';
import { LLMClassifier } from './classifier';
import { makeDecision } from './decision';
import { trackDeletion, shouldWarnRepeatOffender } from './repeat-offender';
import { Storage } from './storage';
import { v4 as uuidv4 } from 'uuid';

export class ModerationPipeline {
  constructor(private classifier: LLMClassifier, private storage: Storage) {}

  async moderate(msg: Message, cfg: GroupConfig, adapter: PlatformAdapter): Promise<ModerationAction> {
    try {
      if (isProtectedSender(msg, cfg)) return { type: 'allow', reason: 'Protected sender' };
      const cheap = checkCheapRules(msg, cfg);
      if (cheap.isSpam) {
        const a: ModerationAction = { type: 'delete', reason: cheap.reason!, category: 'spam', confidence: 0.95 };
        await this.exec(msg, a, cfg, adapter); return a;
      }
      const cls = await this.classifier.classify(msg, cfg);
      const dec = makeDecision(cls, cfg.strictness);
      await this.exec(msg, dec, cfg, adapter);
      return dec;
    } catch { return { type: 'allow', reason: 'Pipeline error — fail open' }; }
  }

  private async exec(msg: Message, action: ModerationAction, cfg: GroupConfig, adapter: PlatformAdapter) {
    if (cfg.dryRun) { await this.log(msg, action, 'dry_run'); return; }
    const caps = adapter.capabilities();
    if (action.type === 'delete') {
      if (cfg.requireAdminApproval) { await this.quarantine(msg, action); }
      else if (caps.canDelete) {
        await adapter.delete(msg.id); await this.log(msg, action, 'deleted');
        trackDeletion(msg);
        if (cfg.enableRepeatOffenderAction && shouldWarnRepeatOffender(msg) && caps.canWarn)
          await adapter.warn(msg.sender.id, 'Multiple violations');
      } else { await this.quarantine(msg, action); }
    } else if (action.type === 'quarantine') { await this.quarantine(msg, action); }
    else if (action.type === 'warn' && caps.canWarn) { await adapter.warn(msg.sender.id, action.reason); await this.log(msg, action, 'warned'); }
  }

  private async quarantine(msg: Message, action: ModerationAction) {
    const e: QuarantineEntry = { id: uuidv4(), message: msg, category: action.category!, confidence: action.confidence!, reason: action.reason, timestamp: new Date() };
    await this.storage.addToQuarantine(e); await this.log(msg, action, 'quarantined');
  }

  private async log(msg: Message, action: ModerationAction, taken: string) {
    const r: AuditRecord = { id: uuidv4(), messageId: msg.id, groupId: msg.groupId, platform: msg.platform, senderId: msg.sender.id, senderName: msg.sender.name, messageText: msg.text, category: action.category||'fine', confidence: action.confidence||0, reason: action.reason, action: taken, timestamp: new Date() };
    await this.storage.saveAuditRecord(r);
  }
}
