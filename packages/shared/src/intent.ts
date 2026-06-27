import type { IntentPayload, RiskLevel, IntentConstraints } from './types.js';

const SIMPLE_RE = /\b(fix|bug|typo|rename|update|patch|correct|adjust|minor|revert)\b/i;
const COMPLEX_RE = /\b(test|tests|tdd|spec|coverage|architecture|redesign|migrate|migration)\b/i;
const MEDIUM_RE = /\b(implement|add|feature|build|create|support|integrate|refactor|extend)\b/i;

function classifyRisk(goal: string): RiskLevel {
  if (COMPLEX_RE.test(goal)) return 'high';
  if (MEDIUM_RE.test(goal)) return 'medium';
  if (SIMPLE_RE.test(goal)) return 'low';
  return 'medium';
}

function extractRepoName(repoUrl: string): string {
  const parts = repoUrl.replace(/\.git$/, '').split('/');
  return parts.slice(-2).join('/') || 'unknown';
}

export function parseIntent(
  intentId: string,
  rawGoal: string,
  repoUrl: string,
  overrides?: Partial<IntentConstraints>,
): IntentPayload {
  const risk = classifyRisk(rawGoal);

  const defaultMaxAgents = risk === 'high' ? 3 : risk === 'medium' ? 2 : 1;
  const defaultBudget = risk === 'high' ? 5.0 : risk === 'medium' ? 3.0 : 2.0;

  return {
    intent_id: intentId,
    description: rawGoal.trim(),
    repo: extractRepoName(repoUrl),
    constraints: {
      max_agents: overrides?.max_agents ?? defaultMaxAgents,
      budget: overrides?.budget ?? defaultBudget,
      risk_level: overrides?.risk_level ?? risk,
    },
  };
}
