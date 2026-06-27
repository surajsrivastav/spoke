import { describe, it, expect } from 'vitest';
import { parseIntent } from '../intent.js';

describe('parseIntent', () => {
  const REPO = 'https://github.com/org/auth-service';
  const ID = 'intent-001';

  describe('risk classification', () => {
    it('classifies bug-fix goals as low risk', () => {
      const result = parseIntent(ID, 'fix login timeout bug', REPO);
      expect(result.constraints.risk_level).toBe('low');
      expect(result.constraints.max_agents).toBe(1);
    });

    it('classifies feature goals as medium risk', () => {
      const result = parseIntent(ID, 'implement OAuth2 login', REPO);
      expect(result.constraints.risk_level).toBe('medium');
      expect(result.constraints.max_agents).toBe(2);
    });

    it('classifies test-related goals as high risk', () => {
      const result = parseIntent(ID, 'add test coverage for auth module', REPO);
      expect(result.constraints.risk_level).toBe('high');
      expect(result.constraints.max_agents).toBe(3);
    });

    it('classifies migration goals as high risk', () => {
      const result = parseIntent(ID, 'migrate database schema to v2', REPO);
      expect(result.constraints.risk_level).toBe('high');
    });

    it('defaults to medium for ambiguous goals', () => {
      const result = parseIntent(ID, 'update the dashboard', REPO);
      expect(result.constraints.risk_level).toBe('low');
    });
  });

  describe('intent payload structure', () => {
    it('returns correct intent_id', () => {
      const result = parseIntent('my-id', 'fix bug', REPO);
      expect(result.intent_id).toBe('my-id');
    });

    it('trims whitespace from description', () => {
      const result = parseIntent(ID, '  fix the bug  ', REPO);
      expect(result.description).toBe('fix the bug');
    });

    it('extracts repo name from URL', () => {
      const result = parseIntent(ID, 'fix bug', 'https://github.com/myorg/my-repo');
      expect(result.repo).toBe('myorg/my-repo');
    });

    it('strips .git suffix from repo URL', () => {
      const result = parseIntent(ID, 'fix bug', 'https://github.com/myorg/my-repo.git');
      expect(result.repo).toBe('myorg/my-repo');
    });

    it('assigns budget proportional to risk', () => {
      const low = parseIntent(ID, 'fix typo', REPO);
      const med = parseIntent(ID, 'implement feature', REPO);
      const high = parseIntent(ID, 'add tests', REPO);
      expect(low.constraints.budget).toBeLessThan(med.constraints.budget);
      expect(med.constraints.budget).toBeLessThan(high.constraints.budget);
    });
  });

  describe('overrides', () => {
    it('respects max_agents override', () => {
      const result = parseIntent(ID, 'implement feature', REPO, { max_agents: 1 });
      expect(result.constraints.max_agents).toBe(1);
    });

    it('respects risk_level override', () => {
      const result = parseIntent(ID, 'fix bug', REPO, { risk_level: 'high' });
      expect(result.constraints.risk_level).toBe('high');
    });

    it('respects budget override', () => {
      const result = parseIntent(ID, 'fix bug', REPO, { budget: 10 });
      expect(result.constraints.budget).toBe(10);
    });
  });
});
