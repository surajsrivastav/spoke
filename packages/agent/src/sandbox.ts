import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

export function containerName(sandboxId: string): string {
  if (!/^[a-zA-Z0-9-]+$/.test(sandboxId)) throw new Error('Invalid sandbox ID');
  return `spoke-sbx-${sandboxId}`;
}

export async function provisionSandbox(): Promise<{ sandboxId: string }> {
  const sandboxId = randomUUID();
  const name = containerName(sandboxId);

  console.log(`[sandbox] provision: sandboxId=${sandboxId} container=${name} image=node:22.23.2-alpine`);

  const t0 = Date.now();
  try {
    execSync(
      `docker run -d --name ${name} node:22.23.2-alpine sh -c "tail -f /dev/null"`,
      { timeout: 30_000, stdio: 'pipe' },
    );
    execSync(
      `docker exec ${name} sh -c "apk add --no-cache git openssh && npm i -g pnpm@10.33.0 && mkdir -p /home/user /repo"`,
      { timeout: 120_000, stdio: 'pipe' },
    );
    console.log(`[sandbox] provisioned: sandboxId=${sandboxId} container=${name} durationMs=${Date.now() - t0}`);
  } catch (err) {
    console.error(`[sandbox] provision failed: sandboxId=${sandboxId} container=${name} durationMs=${Date.now() - t0} error=${(err as Error).message}`);
    // Provisioning may fail after docker run succeeds; avoid orphan containers.
    try { execSync(`docker rm -f ${name}`, { timeout: 30_000, stdio: 'pipe' }); } catch { /* preserve original error */ }
    throw err;
  }

  return { sandboxId };
}

export async function destroySandbox(sandboxId: string): Promise<void> {
  const name = containerName(sandboxId);
  console.log(`[sandbox] destroy: sandboxId=${sandboxId} container=${name}`);

  const t0 = Date.now();
  try {
    execSync(`docker rm -f ${name}`, { timeout: 30_000, stdio: 'pipe' });
    console.log(`[sandbox] destroyed: sandboxId=${sandboxId} container=${name} durationMs=${Date.now() - t0}`);
  } catch (err) {
    console.error(`[sandbox] destroy failed: sandboxId=${sandboxId} container=${name} durationMs=${Date.now() - t0} error=${(err as Error).message}`);
    throw err;
  }
}
