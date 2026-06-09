import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

export function containerName(sandboxId: string): string {
  return `harness-sbx-${sandboxId}`;
}

export async function provisionSandbox(): Promise<{ sandboxId: string }> {
  const sandboxId = randomUUID();
  const name = containerName(sandboxId);

  console.log(`[sandbox] provision: sandboxId=${sandboxId} container=${name} image=node:20-alpine`);

  const t0 = Date.now();
  try {
    execSync(
      `docker run -d --name ${name} node:20-alpine sh -c "tail -f /dev/null"`,
      { timeout: 30_000, stdio: 'pipe' },
    );
    execSync(
      `docker exec ${name} sh -c "apk add --no-cache git openssh && npm i -g pnpm && mkdir -p /home/user /repo"`,
      { timeout: 120_000, stdio: 'pipe' },
    );
    console.log(`[sandbox] provisioned: sandboxId=${sandboxId} container=${name} durationMs=${Date.now() - t0}`);
  } catch (err) {
    console.error(`[sandbox] provision failed: sandboxId=${sandboxId} container=${name} durationMs=${Date.now() - t0} error=${(err as Error).message}`);
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
