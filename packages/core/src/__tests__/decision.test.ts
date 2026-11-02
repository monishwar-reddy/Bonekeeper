import { describe, expect, it } from 'vitest';
import { makeDecision } from '../decision';

describe('makeDecision', () => {
  it('always allows a fine classification, including confidence 1', () => {
    const result = makeDecision(
      { category: 'fine', confidence: 1, reason: 'Short benign greeting' },
      'strict'
    );
    expect(result.type).toBe('allow');
  });

  it('deletes a high-confidence scam in balanced mode', () => {
    const result = makeDecision(
      { category: 'scam', confidence: 0.9, reason: 'Suspicious link' },
      'balanced'
    );
    expect(result.type).toBe('delete');
  });
});
