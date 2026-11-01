import { Message, ModerationAction, PlatformAdapter, AuditRecord, QuarantineEntry, GroupConfig } from './types';
import { isProtectedSender } from './protected-senders';
import { checkCheapRules } from './cheap-rules';
import { LLMClassifier } from './classifier';
import { makeDecision } from './decision';
import { trackDeletion, shouldWarnRepeatOffender } from './repeat-offender';
import { Storage } from './storage';
import { v4 as uuidv4 } from 'uuid';

export class ModerationPipeline {
  constructor(
    private classifier: LLMClassifier,
    private storage: Storage
  ) {}

  async moderate(
    message: Message,
    config: GroupConfig,
    adapter: PlatformAdapter
  ): Promise<ModerationAction> {
    try {
      // Step 1: Protected senders
      if (isProtectedSender(message, config)) {
        return { type: 'allow', reason: 'Protected sender (admin/moderator/allowlist)' };
      }

      // Step 2: Cheap rules
      const cheapResult = checkCheapRules(message, config);
      if (cheapResult.isSpam) {
        const action: ModerationAction = {
          type: 'delete',
          reason: cheapResult.reason!,
          category: 'spam',
          confidence: 0.95
        };

        await this.executeAction(message, action, config, adapter);
        return action;
      }

      // Step 3: LLM classification
      const classification = await this.classifier.classify(message, config);

      // Step 4: Decision by confidence
      const decision = makeDecision(classification, config.strictness);

      // Step 5: Execute action
      await this.executeAction(message, decision, config, adapter);

      return decision;
    } catch (error) {
      console.error('Pipeline error:', error);
      // Fail open
      return { type: 'allow', reason: 'Pipeline error, fail open' };
    }
  }

  private async executeAction(
    message: Message,
    action: ModerationAction,
    config: GroupConfig,
    adapter: PlatformAdapter
  ): Promise<void> {
    // Dry-run mode: log only
    if (config.dryRun) {
      console.log(`[DRY RUN] Would ${action.type} message ${message.id}: ${action.reason}`);
      await this.logAction(message, action, 'dry_run');
      return;
    }

    const capabilities = adapter.capabilities();

    switch (action.type) {
      case 'delete':
        if (config.requireAdminApproval) {
          // Downgrade to quarantine
          await this.quarantineMessage(message, action);
        } else if (capabilities.canDelete) {
          await adapter.delete(message.id);
          await this.logAction(message, action, 'deleted');
          
          // Track for repeat offenders
          trackDeletion(message);
          
          // Check repeat offender
          if (config.enableRepeatOffenderAction && shouldWarnRepeatOffender(message)) {
            if (capabilities.canWarn) {
              await adapter.warn(message.sender.id, 'Multiple violations detected');
            }
          }
        } else {
          // Platform doesn't support delete, quarantine instead
          await this.quarantineMessage(message, action);
        }
        break;

      case 'quarantine':
        await this.quarantineMessage(message, action);
        break;

      case 'warn':
        if (capabilities.canWarn) {
          await adapter.warn(message.sender.id, action.reason);
          await this.logAction(message, action, 'warned');
        }
        break;

      case 'allow':
        // No action needed
        break;
    }
  }

  private async quarantineMessage(message: Message, action: ModerationAction): Promise<void> {
    const entry: QuarantineEntry = {
      id: uuidv4(),
      message,
      category: action.category!,
      confidence: action.confidence!,
      reason: action.reason,
      timestamp: new Date()
    };

    await this.storage.addToQuarantine(entry);
    await this.logAction(message, action, 'quarantined');
  }

  private async logAction(message: Message, action: ModerationAction, actionTaken: string): Promise<void> {
    const record: AuditRecord = {
      id: uuidv4(),
      messageId: message.id,
      groupId: message.groupId,
      platform: message.platform,
      senderId: message.sender.id,
      senderName: message.sender.name,
      messageText: message.text,
      category: action.category || 'fine',
      confidence: action.confidence || 0,
      reason: action.reason,
      action: actionTaken,
      timestamp: new Date()
    };

    await this.storage.saveAuditRecord(record);
  }
}
