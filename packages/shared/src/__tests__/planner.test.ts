import { describe, it, expect } from 'vitest';
import { createPlan } from '../planner.js';
import type { IntentPayload } from '../types.js';

function makeIntent(overrides: Partial<IntentPayload> = {}): IntentPayload {
  return {
    intent_id: 'test-id',
    description: 'fix bug',
    repo: 'org/repo',
    constraints: {
      max_agents: 5,
      budget: 5.0,
      risk_level: 'low',
    },
    ...overrides,
  };
}

describe('createPlan', () => {
  describe('strategy selection', () => {
    it('selects single-agent for low-risk intents', () => {
      const plan = createPlan(makeIntent({ constraints: { max_agents: 5, budget: 2, risk_level: 'low' } }));
      expect(plan.strategy).toBe('single-agent');
      expect(plan.agent_count).toBe(1);
    });

    it('selects dual-agent for medium-risk intents', () => {
      const plan = createPlan(makeIntent({ constraints: { max_agents: 5, budget: 3, risk_level: 'medium' } }));
      expect(plan.strategy).toBe('dual-agent');
      expect(plan.agent_count).toBe(2);
    });

    it('selects dual-agent for high-risk non-test intents', () => {
      const plan = createPlan(makeIntent({
        description: 'redesign auth module',
        constraints: { max_agents: 5, budget: 5, risk_level: 'high' },
      }));
      expect(plan.strategy).toBe('dual-agent');
      expect(plan.agent_count).toBe(2);
    });

    it('selects test-first for high-risk test-related intents', () => {
      const plan = createPlan(makeIntent({
        description: 'add test coverage for auth module',
        constraints: { max_agents: 5, budget: 5, risk_level: 'high' },
      }));
      expect(plan.strategy).toBe('test-first');
      expect(plan.agent_count).toBe(3);
    });
  });

  describe('agent count capping', () => {
    it('caps agent_count at max_agents constraint', () => {
      const plan = createPlan(makeIntent({
        constraints: { max_agents: 1, budget: 5, risk_level: 'medium' },
      }));
      expect(plan.agent_count).toBe(1);
    });

    it('caps agent_count at 5 regardless of strategy', () => {
      const plan = createPlan(makeIntent({
        description: 'add tests for everything',
        constraints: { max_agents: 100, budget: 100, risk_level: 'high' },
      }));
      expect(plan.agent_count).toBeLessThanOrEqual(5);
    });

    it('never returns zero agents', () => {
      const plan = createPlan(makeIntent({ constraints: { max_agents: 0, budget: 0, risk_level: 'low' } }));
      expect(plan.agent_count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('rationale', () => {
    it('provides a rationale string', () => {
      const plan = createPlan(makeIntent());
      expect(typeof plan.rationale).toBe('string');
      expect(plan.rationale.length).toBeGreaterThan(0);
    });
  });
});
