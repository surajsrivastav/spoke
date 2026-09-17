/** Real Docker check; no model credentials, GitHub pushes, or PR creation. */
import assert from 'node:assert/strict';
import { provisionSandbox, destroySandbox } from '../packages/agent/src/sandbox.js';
import { executeShell, executeWriteFile, executeReadFile } from '../packages/agent/src/tools.js';
import { runVerification } from '../packages/agent/src/verify.js';

async function main() {
  const { sandboxId } = await provisionSandbox();
  try {
    const shell = await executeShell(sandboxId, 'test "$(pwd)" = / && echo container-shell');
    assert.equal(shell.exitCode, 0, shell.stderr);
    assert.equal(shell.stdout, 'container-shell');

    const path = "/repo/it's $(echo should-not-expand).txt";
    assert.equal((await executeWriteFile(sandboxId, path, 'literal content')).exitCode, 0);
    assert.equal((await executeReadFile(sandboxId, path)).stdout, 'literal content');

    const manifest = (test: string) => JSON.stringify({
      name: 'spoke-smoke-fixture', version: '1.0.0', private: true,
      scripts: { lint: 'node -e "process.exit(0)"', typecheck: 'node -e "process.exit(0)"', test },
    });
    await executeWriteFile(sandboxId, '/repo/package.json', manifest('node -e "process.exit(0)"'));
    assert.equal((await runVerification(sandboxId)).passed, true);
    await executeWriteFile(sandboxId, '/repo/package.json', manifest('node -e "process.exit(1)"'));
    const failed = await runVerification(sandboxId);
    assert.equal(failed.passed, false, 'Failing tests must block verification');
    assert.ok(failed.errors.tests);
    console.log('PASS: Docker shell boundary, literal filenames, passing and failing verification');
  } finally {
    await destroySandbox(sandboxId);
  }
}
main().catch((err) => { console.error(err); process.exitCode = 1; });
