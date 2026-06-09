import { describe, it, expect, vi, afterEach } from 'vitest';

describe('env', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns default DATABASE_URL when env var is not set', async () => {
    vi.resetModules();
    const { env } = await import('../env.js');
    expect(env.DATABASE_URL).toBe('postgresql://spoke:spoke_dev@localhost:5432/spoke_dev');
  });

  it('reads DATABASE_URL from process.env when set', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://custom:custom@host:5432/db');
    vi.resetModules();
    const { env } = await import('../env.js');
    expect(env.DATABASE_URL).toBe('postgresql://custom:custom@host:5432/db');
  });

  it('reads ANTHROPIC_API_KEY from process.env when set', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test-key');
    vi.resetModules();
    const { env } = await import('../env.js');
    expect(env.ANTHROPIC_API_KEY).toBe('sk-ant-test-key');
  });

  it('defaults ANTHROPIC_API_KEY to empty string when not set', async () => {
    vi.resetModules();
    const { env } = await import('../env.js');
    expect(env.ANTHROPIC_API_KEY).toBe('');
  });

  it('reads GH_TOKEN from process.env when set', async () => {
    vi.stubEnv('GH_TOKEN', 'ghp_test123token');
    vi.resetModules();
    const { env } = await import('../env.js');
    expect(env.GH_TOKEN).toBe('ghp_test123token');
  });

  it('defaults GH_TOKEN to empty string when not set', async () => {
    vi.resetModules();
    const { env } = await import('../env.js');
    expect(env.GH_TOKEN).toBe('');
  });

  it('reads SLACK_BOT_TOKEN from process.env when set', async () => {
    vi.stubEnv('SLACK_BOT_TOKEN', 'xoxb-test-token');
    vi.resetModules();
    const { env } = await import('../env.js');
    expect(env.SLACK_BOT_TOKEN).toBe('xoxb-test-token');
  });

  it('reads WHATSAPP_ACCESS_TOKEN from process.env when set', async () => {
    vi.stubEnv('WHATSAPP_ACCESS_TOKEN', 'wa-test-token');
    vi.resetModules();
    const { env } = await import('../env.js');
    expect(env.WHATSAPP_ACCESS_TOKEN).toBe('wa-test-token');
  });

  it('reads OPENROUTER_API_KEY from process.env when set', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'or-test-key');
    vi.resetModules();
    const { env } = await import('../env.js');
    expect(env.OPENROUTER_API_KEY).toBe('or-test-key');
  });

  it('reads DEFAULT_MODEL from process.env when set', async () => {
    vi.stubEnv('DEFAULT_MODEL', 'anthropic/claude-sonnet-4-20250514');
    vi.resetModules();
    const { env } = await import('../env.js');
    expect(env.DEFAULT_MODEL).toBe('anthropic/claude-sonnet-4-20250514');
  });

  it('defaults DEFAULT_MODEL when not set', async () => {
    vi.resetModules();
    const { env } = await import('../env.js');
    expect(env.DEFAULT_MODEL).toBe('anthropic/claude-sonnet-4-20250514');
  });

  it('reads MODEL_PROVIDER from process.env when set', async () => {
    vi.stubEnv('MODEL_PROVIDER', 'anthropic');
    vi.resetModules();
    const { env } = await import('../env.js');
    expect(env.MODEL_PROVIDER).toBe('anthropic');
  });

  it('defaults MODEL_PROVIDER to openrouter', async () => {
    vi.resetModules();
    const { env } = await import('../env.js');
    expect(env.MODEL_PROVIDER).toBe('openrouter');
  });

  it('reads TEMPORAL_NAMESPACE from process.env when set', async () => {
    vi.stubEnv('TEMPORAL_NAMESPACE', 'my-namespace');
    vi.resetModules();
    const { env } = await import('../env.js');
    expect(env.TEMPORAL_NAMESPACE).toBe('my-namespace');
  });

  it('defaults TEMPORAL_ADDRESS to localhost:7233', async () => {
    vi.resetModules();
    const { env } = await import('../env.js');
    expect(env.TEMPORAL_ADDRESS).toBe('localhost:7233');
  });

  it('reads DEFAULT_COST_CAP_USD from process.env as a number', async () => {
    vi.stubEnv('DEFAULT_COST_CAP_USD', '10.00');
    vi.resetModules();
    const { env } = await import('../env.js');
    expect(env.DEFAULT_COST_CAP_USD).toBe(10);
  });

  it('defaults DEFAULT_COST_CAP_USD to 5', async () => {
    vi.resetModules();
    const { env } = await import('../env.js');
    expect(env.DEFAULT_COST_CAP_USD).toBe(5);
  });

  it('defaults SLACK_BOT_TOKEN to empty string when not set', async () => {
    vi.resetModules();
    const { env } = await import('../env.js');
    expect(env.SLACK_BOT_TOKEN).toBe('');
  });

  it('defaults SLACK_SIGNING_SECRET to empty string when not set', async () => {
    vi.resetModules();
    const { env } = await import('../env.js');
    expect(env.SLACK_SIGNING_SECRET).toBe('');
  });

  it('reads SLACK_SIGNING_SECRET from process.env when set', async () => {
    vi.stubEnv('SLACK_SIGNING_SECRET', 'secret-123');
    vi.resetModules();
    const { env } = await import('../env.js');
    expect(env.SLACK_SIGNING_SECRET).toBe('secret-123');
  });

  it('defaults WHATSAPP_ACCESS_TOKEN to empty string when not set', async () => {
    vi.resetModules();
    const { env } = await import('../env.js');
    expect(env.WHATSAPP_ACCESS_TOKEN).toBe('');
  });

  it('defaults WHATSAPP_PHONE_NUMBER_ID to empty string when not set', async () => {
    vi.resetModules();
    const { env } = await import('../env.js');
    expect(env.WHATSAPP_PHONE_NUMBER_ID).toBe('');
  });

  it('reads WHATSAPP_PHONE_NUMBER_ID from process.env when set', async () => {
    vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', '123456789');
    vi.resetModules();
    const { env } = await import('../env.js');
    expect(env.WHATSAPP_PHONE_NUMBER_ID).toBe('123456789');
  });

  it('reads WHATSAPP_WEBHOOK_VERIFY_TOKEN from process.env when set', async () => {
    vi.stubEnv('WHATSAPP_WEBHOOK_VERIFY_TOKEN', 'custom_verify');
    vi.resetModules();
    const { env } = await import('../env.js');
    expect(env.WHATSAPP_WEBHOOK_VERIFY_TOKEN).toBe('custom_verify');
  });

  it('defaults WHATSAPP_WEBHOOK_VERIFY_TOKEN to spoke_verify_token', async () => {
    vi.resetModules();
    const { env } = await import('../env.js');
    expect(env.WHATSAPP_WEBHOOK_VERIFY_TOKEN).toBe('spoke_verify_token');
  });

  it('defaults OPENROUTER_API_KEY to empty string when not set', async () => {
    vi.resetModules();
    const { env } = await import('../env.js');
    expect(env.OPENROUTER_API_KEY).toBe('');
  });

  it('defaults TEMPORAL_NAMESPACE to default when not set', async () => {
    vi.resetModules();
    const { env } = await import('../env.js');
    expect(env.TEMPORAL_NAMESPACE).toBe('default');
  });

  it('defaults TEMPORAL_API_KEY to empty string when not set', async () => {
    vi.resetModules();
    const { env } = await import('../env.js');
    expect(env.TEMPORAL_API_KEY).toBe('');
  });

  it('reads TEMPORAL_API_KEY from process.env when set', async () => {
    vi.stubEnv('TEMPORAL_API_KEY', 'temporal-key');
    vi.resetModules();
    const { env } = await import('../env.js');
    expect(env.TEMPORAL_API_KEY).toBe('temporal-key');
  });
});
