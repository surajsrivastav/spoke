import type { IntentPayload, ExecutionPlan, AgentStrategy } from './types.js';

const TEST_RE = /\b(test|tdd|spec|coverage)\b/i;

export function createPlan(intent: IntentPayload): ExecutionPlan {
  const { constraints, description } = intent;
  const { max_agents, risk_level } = constraints;

  let strategy: AgentStrategy;
  let rawAgentCount: number;
  let rationale: string;

  if (risk_level === 'low') {
    strategy = 'single-agent';
    rawAgentCount = 1;
    rationale = 'Simple task — single agent is sufficient';
  } else if (risk_level === 'medium') {
    strategy = 'dual-agent';
    rawAgentCount = 2;
    rationale = 'Medium complexity — dual agents with cross-validation';
  } else {
    const isTestRelated = TEST_RE.test(description);
    if (isTestRelated) {
      strategy = 'test-first';
      rawAgentCount = 3;
      rationale = 'Test-related task — test-first strategy with 3 agents';
    } else {
      strategy = 'dual-agent';
      rawAgentCount = 2;
      rationale = 'Complex task — dual agents for safety';
    }
  }

  const agent_count = Math.min(rawAgentCount, max_agents, 5);

  return { strategy, agent_count, rationale };
}
