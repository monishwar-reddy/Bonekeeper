import { AuditRecord, QuarantineEntry, GroupConfig, CorrectionRecord, ReviewStatus } from './types';

export interface Storage {
  saveAuditRecord(record: AuditRecord): Promise<void>;
  getAuditRecords(groupId: string, limit?: number): Promise<AuditRecord[]>;
  updateAuditReview(id: string, status: ReviewStatus, reviewedBy: string): Promise<void>;

  addToQuarantine(entry: QuarantineEntry): Promise<void>;
  getQuarantine(groupId: string): Promise<QuarantineEntry[]>;
  removeFromQuarantine(id: string): Promise<void>;

  getGroupConfig(groupId: string): Promise<GroupConfig | null>;
  saveGroupConfig(config: GroupConfig): Promise<void>;

  saveCorrection(record: CorrectionRecord): Promise<void>;
  getCorrections(limit?: number): Promise<CorrectionRecord[]>;

  purgeOldRecords(daysOld: number): Promise<void>;
}

export class InMemoryStorage implements Storage {
  private auditRecords: Map<string, AuditRecord[]> = new Map();
  private quarantine: Map<string, QuarantineEntry[]> = new Map();
  private configs: Map<string, GroupConfig> = new Map();
  private corrections: CorrectionRecord[] = [];

  async saveAuditRecord(record: AuditRecord): Promise<void> {
    if (!this.auditRecords.has(record.groupId)) {
      this.auditRecords.set(record.groupId, []);
    }
    this.auditRecords.get(record.groupId)!.push(record);
  }

  async getAuditRecords(groupId: string, limit = 500): Promise<AuditRecord[]> {
    const records = this.auditRecords.get(groupId) || [];
    return records.slice(-limit);
  }

  async updateAuditReview(id: string, status: ReviewStatus, reviewedBy: string): Promise<void> {
    for (const records of this.auditRecords.values()) {
      const r = records.find(r => r.id === id);
      if (r) {
        r.reviewStatus = status;
        r.reviewedBy = reviewedBy;
        r.reviewedAt = new Date();
        return;
      }
    }
  }

  async addToQuarantine(entry: QuarantineEntry): Promise<void> {
    const gid = entry.message.groupId;
    if (!this.quarantine.has(gid)) this.quarantine.set(gid, []);
    this.quarantine.get(gid)!.push(entry);
  }

  async getQuarantine(groupId: string): Promise<QuarantineEntry[]> {
    return this.quarantine.get(groupId) || [];
  }

  async removeFromQuarantine(id: string): Promise<void> {
    for (const [gid, entries] of this.quarantine.entries()) {
      this.quarantine.set(gid, entries.filter(e => e.id !== id));
    }
  }

  async getGroupConfig(groupId: string): Promise<GroupConfig | null> {
    return this.configs.get(groupId) || null;
  }

  async saveGroupConfig(config: GroupConfig): Promise<void> {
    this.configs.set(config.groupId, config);
  }

  async saveCorrection(record: CorrectionRecord): Promise<void> {
    this.corrections.push(record);
    if (this.corrections.length > 100) this.corrections.shift();
  }

  async getCorrections(limit = 10): Promise<CorrectionRecord[]> {
    return this.corrections.slice(-limit);
  }

  async purgeOldRecords(daysOld: number): Promise<void> {
    const cutoff = new Date(Date.now() - daysOld * 86_400_000);
    for (const [gid, records] of this.auditRecords.entries()) {
      this.auditRecords.set(gid, records.filter(r => r.timestamp > cutoff));
    }
  }
}
