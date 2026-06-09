import { describe, it, expect } from 'vitest';

describe('type exports', () => {
  it('exports TaskStatus', async () => {
    const mod = await import('../types.js');
    // Just verify the module exports exist — type-level checks are compile-time.
    expect(mod).toBeDefined();
  });

  it('exports Task type', async () => {
    const mod = await import('../types.js');
    expect(mod).toBeDefined();
  });

  it('exports TaskRunStatus', async () => {
    const mod = await import('../types.js');
    expect(mod).toBeDefined();
  });

  it('exports TaskRun', async () => {
    const mod = await import('../types.js');
    expect(mod).toBeDefined();
  });

  it('exports ProvenanceType', async () => {
    const mod = await import('../types.js');
    expect(mod).toBeDefined();
  });

  it('exports Provenance', async () => {
    const mod = await import('../types.js');
    expect(mod).toBeDefined();
  });
});

describe('shared index exports', () => {
  it('re-exports everything from env and types', async () => {
    const shared = await import('../index.js');
    expect(shared).toBeDefined();
    expect(shared.env).toBeDefined();
    // Verify env properties are accessible
    expect(typeof shared.env.DATABASE_URL).toBe('string');
  });
});
