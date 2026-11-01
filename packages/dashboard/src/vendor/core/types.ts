export type UserRole = 'owner' | 'admin' | 'moderator' | 'member';
export type BotKind = 'positive' | 'negative';
export type MessageStatus = 'ok' | 'deleted' | 'held' | 'restored';
export type ReviewStatus = 'pending' | 'confirmed' | 'restored';

export interface Sender {
  id: string; name: string; role: UserRole; joinedAt: Date;
  isBot?: boolean; botKind?: BotKind; warnings?: number; mutedUntil?: Date | null;
}
export interface Message {
  id: string; platform: string; groupId: string; sender: Sender;
  text: string; links: string[]; isForwarded: boolean; timestamp: Date; status?: MessageStatus;
}
export interface ModerationAction {
  type: 'allow' | 'delete' | 'quarantine' | 'warn';
  reason: string; category?: ModerationCategory; confidence?: number;
}
export type ModerationCategory = 'spam' | 'scam' | 'off_topic' | 'unnecessary' | 'fine';
export interface ClassificationResult { category: ModerationCategory; confidence: number; reason: string; }
export type StrictnessLevel = 'strict' | 'balanced' | 'lenient';
export interface GroupConfig {
  groupId: string; description: string; strictness: StrictnessLevel;
  allowlist: { users: string[]; domains: string[]; phrases?: string[] };
  deleteLinksFromNonAdmins: boolean; requireAdminApproval: boolean;
  dryRun: boolean; enableRepeatOffenderAction: boolean; pauseBots?: boolean;
}
export interface AdapterCapabilities { canDelete: boolean; canHide: boolean; canWarn: boolean; canMute: boolean; canKick: boolean; }
export interface PlatformAdapter {
  delete(messageId: string): Promise<void>;
  hide(messageId: string): Promise<void>;
  warn(userId: string, reason: string): Promise<void>;
  notifyAdmins(text: string): Promise<void>;
  capabilities(): AdapterCapabilities;
}
export interface AuditRecord {
  id: string; messageId: string; groupId: string; platform: string;
  senderId: string; senderName: string; messageText: string;
  category: ModerationCategory; confidence: number; reason: string; action: string;
  reviewStatus?: ReviewStatus; reviewedBy?: string; reviewedAt?: Date; timestamp: Date;
}
export interface QuarantineEntry {
  id: string; message: Message; category: ModerationCategory; confidence: number; reason: string; timestamp: Date;
}
export interface CorrectionRecord {
  id: string; text: string; wrongCategory: ModerationCategory; correctCategory: ModerationCategory; createdAt: Date;
}
