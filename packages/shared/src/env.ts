export const env = {
  // Database
  DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://spoke:spoke_dev@localhost:5432/spoke_dev',

  // Model provider
  MODEL_PROVIDER: (process.env.MODEL_PROVIDER ?? 'openrouter') as 'openrouter' | 'anthropic' | 'litellm' | 'copilot' | 'github-models' | 'ollama',
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ?? '',
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? '',
  COPILOT_TOKEN: process.env.COPILOT_TOKEN ?? process.env.GH_TOKEN ?? '',
  DEFAULT_MODEL: process.env.DEFAULT_MODEL ?? 'anthropic/claude-sonnet-4-20250514',
  LITELLM_BASE_URL: process.env.LITELLM_BASE_URL ?? '',
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/v1',

  // Slack
  SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN ?? '',
  SLACK_SIGNING_SECRET: process.env.SLACK_SIGNING_SECRET ?? '',

  // WhatsApp
  WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN ?? '',
  WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID ?? '',
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? 'spoke_verify_token',

  // GitHub
  GH_TOKEN: process.env.GH_TOKEN ?? '',

  // Temporal
  TEMPORAL_NAMESPACE: process.env.TEMPORAL_NAMESPACE ?? 'default',
  TEMPORAL_ADDRESS: process.env.TEMPORAL_ADDRESS ?? 'localhost:7233',
  TEMPORAL_API_KEY: process.env.TEMPORAL_API_KEY ?? '',

  // Cost cap
  DEFAULT_COST_CAP_USD: Number(process.env.DEFAULT_COST_CAP_USD ?? '5.00'),
};
