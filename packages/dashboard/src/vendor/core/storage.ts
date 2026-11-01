import { AuditRecord, QuarantineEntry, GroupConfig, CorrectionRecord, ReviewStatus } from './types';
export interface Storage {
  saveAuditRecord(r: AuditRecord): Promise<void>;
  getAuditRecords(groupId: string, limit?: number): Promise<AuditRecord[]>;
  updateAuditReview(id: string, status: ReviewStatus, by: string): Promise<void>;
  addToQuarantine(e: QuarantineEntry): Promise<void>;
  getQuarantine(groupId: string): Promise<QuarantineEntry[]>;
  removeFromQuarantine(id: string): Promise<void>;
  getGroupConfig(groupId: string): Promise<GroupConfig | null>;
  saveGroupConfig(c: GroupConfig): Promise<void>;
  saveCorrection(r: CorrectionRecord): Promise<void>;
  getCorrections(limit?: number): Promise<CorrectionRecord[]>;
  purgeOldRecords(daysOld: number): Promise<void>;
}
export class InMemoryStorage implements Storage {
  private ar = new Map<string, AuditRecord[]>();
  private q  = new Map<string, QuarantineEntry[]>();
  private cfg= new Map<string, GroupConfig>();
  private cor: CorrectionRecord[] = [];
  async saveAuditRecord(r: AuditRecord) { const a = this.ar.get(r.groupId)||[]; a.push(r); this.ar.set(r.groupId,a); }
  async getAuditRecords(g: string, limit=500) { return (this.ar.get(g)||[]).slice(-limit); }
  async updateAuditReview(id: string, status: ReviewStatus, by: string) {
    for (const rs of this.ar.values()) { const r=rs.find(x=>x.id===id); if(r){r.reviewStatus=status;r.reviewedBy=by;r.reviewedAt=new Date();return;} }
  }
  async addToQuarantine(e: QuarantineEntry) { const a=this.q.get(e.message.groupId)||[]; a.push(e); this.q.set(e.message.groupId,a); }
  async getQuarantine(g: string) { return this.q.get(g)||[]; }
  async removeFromQuarantine(id: string) { for(const[k,v]of this.q)this.q.set(k,v.filter(e=>e.id!==id)); }
  async getGroupConfig(g: string) { return this.cfg.get(g)||null; }
  async saveGroupConfig(c: GroupConfig) { this.cfg.set(c.groupId,c); }
  async saveCorrection(r: CorrectionRecord) { this.cor.push(r); if(this.cor.length>100)this.cor.shift(); }
  async getCorrections(limit=10) { return this.cor.slice(-limit); }
  async purgeOldRecords(d: number) { const c=new Date(Date.now()-d*86400000); for(const[k,v]of this.ar)this.ar.set(k,v.filter(r=>r.timestamp>c)); }
}
