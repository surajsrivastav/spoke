import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/agent/vitest.config.ts',
  'packages/provenance/vitest.config.ts',
  'packages/shared/vitest.config.ts',
  'apps/orchestrator/vitest.config.ts',
  'apps/slack-edge/vitest.config.ts',
  'apps/whatsapp-edge/vitest.config.ts',
  'apps/operator-ui/vitest.config.ts',
]);
