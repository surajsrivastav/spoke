import { executeShell } from './tools.js';

export interface VerificationResult {
  passed: boolean;
  errors: {
    lint?: string;
    typecheck?: string;
    tests?: string;
  };
}

export async function runVerification(sandboxId: string): Promise<VerificationResult> {
  const errors: VerificationResult['errors'] = {};

  const lintResult = await executeShell(sandboxId, 'cd /repo && npm run lint');
  if (lintResult.exitCode !== 0) {
    errors.lint = lintResult.stderr || lintResult.stdout;
  }

  const typecheckResult = await executeShell(sandboxId, 'cd /repo && pnpm typecheck');
  if (typecheckResult.exitCode !== 0) {
    errors.typecheck = typecheckResult.stderr || typecheckResult.stdout;
  }

  const testResult = await executeShell(sandboxId, 'cd /repo && pnpm test');
  if (testResult.exitCode !== 0) {
    errors.tests = testResult.stderr || testResult.stdout;
  }

  const passed = Object.keys(errors).length === 0;
  return { passed, errors };
}
