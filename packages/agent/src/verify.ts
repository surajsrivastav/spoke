import { executeShell } from './tools.js';

export interface VerificationResult {
  passed: boolean;
  errors: {
    install?: string;
    lint?: string;
    typecheck?: string;
    tests?: string;
  };
}

export async function runVerification(sandboxId: string): Promise<VerificationResult> {
  const errors: VerificationResult['errors'] = {};

  const installResult = await executeShell(sandboxId, 'cd /repo && pnpm install 2>&1');
  if (installResult.exitCode !== 0) {
    return { passed: false, errors: { install: (installResult.stderr || installResult.stdout || 'Dependency installation failed').trim() } };
  }

  const lintResult = await executeShell(sandboxId, 'cd /repo && npm run lint 2>&1');
  if (lintResult.exitCode !== 0 && lintResult.exitCode !== null) {
    errors.lint = (lintResult.stderr || lintResult.stdout || '').trim();
  }

  const typecheckResult = await executeShell(sandboxId, 'cd /repo && pnpm typecheck 2>&1');
  if (typecheckResult.exitCode !== 0 && typecheckResult.exitCode !== null) {
    errors.typecheck = (typecheckResult.stderr || typecheckResult.stdout || '').trim();
  }

  const testResult = await executeShell(sandboxId, 'cd /repo && pnpm test 2>&1');
  if (testResult.exitCode !== 0 && testResult.exitCode !== null) {
    errors.tests = (testResult.stderr || testResult.stdout || '').trim();
  }

  const passed = Object.keys(errors).length === 0;
  return { passed, errors };
}
