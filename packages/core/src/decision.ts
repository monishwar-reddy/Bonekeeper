import { ClassificationResult, ModerationAction, StrictnessLevel, ModerationCategory } from './types';

interface Thresholds {
  deleteThreshold: number;
  quarantineThreshold: number;
}

export function makeDecision(
  classification: ClassificationResult,
  strictness: StrictnessLevel
): ModerationAction {
  if (classification.category === 'fine') {
    return { type: 'allow', reason: classification.reason };
  }
  const thresholds = getThresholds(strictness, classification.category);

  // Special handling for off_topic and unnecessary in lenient mode
  if (strictness === 'lenient' && (classification.category === 'off_topic' || classification.category === 'unnecessary')) {
    if (classification.confidence >= thresholds.quarantineThreshold) {
      return {
        type: 'quarantine',
        reason: classification.reason,
        category: classification.category,
        confidence: classification.confidence
      };
    }
    return {
      type: 'allow',
      reason: 'Below quarantine threshold in lenient mode'
    };
  }

  // Normal decision logic
  if (classification.confidence >= thresholds.deleteThreshold) {
    return {
      type: 'delete',
      reason: classification.reason,
      category: classification.category,
      confidence: classification.confidence
    };
  }

  if (classification.confidence >= thresholds.quarantineThreshold) {
    return {
      type: 'quarantine',
      reason: classification.reason,
      category: classification.category,
      confidence: classification.confidence
    };
  }

  return {
    type: 'allow',
    reason: 'Below action threshold'
  };
}

function getThresholds(strictness: StrictnessLevel, category: ModerationCategory): Thresholds {
  // Scam and phishing use lower thresholds
  const isHighRisk = category === 'scam';

  switch (strictness) {
    case 'strict':
      return {
        deleteThreshold: isHighRisk ? 0.70 : 0.80,
        quarantineThreshold: 0.50
      };
    case 'balanced':
      return {
        deleteThreshold: isHighRisk ? 0.80 : 0.90,
        quarantineThreshold: 0.65
      };
    case 'lenient':
      return {
        deleteThreshold: isHighRisk ? 0.85 : 0.95,
        quarantineThreshold: 0.80
      };
  }
}
