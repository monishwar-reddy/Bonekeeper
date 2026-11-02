import { ClassificationResult, ModerationAction, StrictnessLevel, ModerationCategory } from './types';
export function makeDecision(c: ClassificationResult, s: StrictnessLevel): ModerationAction {
  if (c.category === 'fine') return { type: 'allow', reason: c.reason };
  const hi = c.category === 'scam';
  let del: number, q: number;
  if (s === 'strict')   { del = hi ? 0.70 : 0.80; q = 0.50; }
  else if (s === 'lenient') { del = hi ? 0.85 : 0.95; q = 0.80; }
  else                  { del = hi ? 0.80 : 0.90; q = 0.65; }
  if (s === 'lenient' && (c.category === 'off_topic' || c.category === 'unnecessary')) {
    return c.confidence >= q ? { type: 'quarantine', reason: c.reason, category: c.category, confidence: c.confidence } : { type: 'allow', reason: 'Below threshold' };
  }
  if (c.confidence >= del) return { type: 'delete', reason: c.reason, category: c.category, confidence: c.confidence };
  if (c.confidence >= q)   return { type: 'quarantine', reason: c.reason, category: c.category, confidence: c.confidence };
  return { type: 'allow', reason: 'Below threshold' };
}
