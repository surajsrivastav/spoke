import { execFileSync } from 'node:child_process';
import { containerName } from './sandbox.js';

export interface ToolResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function truncate(s: string, max = 200): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + `... (${s.length - max} more bytes)`;
}

export async function executeShell(sandboxId: string, command: string): Promise<ToolResult> {
  const name = containerName(sandboxId);
  const t0 = Date.now();

  console.log(`[sandbox:exec] shell: sandboxId=${sandboxId} cmd=${truncate(command, 100)}`);

  try {
    const output = execFileSync(
      'docker', ['exec', name, 'sh', '-c', command],
      { timeout: 120_000, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 },
    );
    const elapsed = Date.now() - t0;
    console.log(`[sandbox:exec] ok: sandboxId=${sandboxId} exitCode=0 durationMs=${elapsed} stdout=${truncate(output.trim(), 80)}`);
    return { stdout: output.trim(), stderr: '', exitCode: 0 };
  } catch (err: any) {
    const elapsed = Date.now() - t0;
    const exitCode = err.status ?? 1;
    const stderrStr = (err.stderr?.toString()?.trim() ?? err.message ?? '');
    console.error(`[sandbox:exec] fail: sandboxId=${sandboxId} exitCode=${exitCode} durationMs=${elapsed} stderr=${truncate(stderrStr, 120)}`);
    return {
      stdout: (err.stdout?.toString()?.trim() ?? ''),
      stderr: stderrStr,
      exitCode,
    };
  }
}

export async function executeReadFile(sandboxId: string, path: string): Promise<ToolResult> {
  const t0 = Date.now();
  console.log(`[sandbox:exec] read_file: sandboxId=${sandboxId} path=${path}`);

  const result = await executeShell(sandboxId, `cat -- ${shellQuote(path)}`);

  if (result.exitCode === 0) {
    const maxLen = 3000;
    if (result.stdout.length > maxLen) {
      const head = result.stdout.slice(0, Math.floor(maxLen / 2));
      const tail = result.stdout.slice(-Math.floor(maxLen / 2));
      result.stdout = `${head}\n\n... [truncated ${result.stdout.length - maxLen} bytes] ...\n\n${tail}`;
    }
    console.log(`[sandbox:exec] read_file ok: sandboxId=${sandboxId} path=${path} size=${result.stdout.length} durationMs=${Date.now() - t0}`);
  } else {
    console.error(`[sandbox:exec] read_file fail: sandboxId=${sandboxId} path=${path} durationMs=${Date.now() - t0}`);
  }
  return result;
}

export async function executeWriteFile(sandboxId: string, path: string, content: string): Promise<ToolResult> {
  const name = containerName(sandboxId);
  const t0 = Date.now();

  console.log(`[sandbox:exec] write_file: sandboxId=${sandboxId} path=${path} size=${content.length}`);

  try {
    const dir = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '';
    const mkdirCmd = dir ? `mkdir -p -- ${shellQuote(dir)} && ` : '';
    execFileSync(
      'docker', ['exec', '-i', name, 'sh', '-c', `${mkdirCmd}cat > ${shellQuote(path)}`],
      { input: content, timeout: 30_000, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 },
    );
    console.log(`[sandbox:exec] write_file ok: sandboxId=${sandboxId} path=${path} size=${content.length} durationMs=${Date.now() - t0}`);
    return { stdout: `File written to ${path}`, stderr: '', exitCode: 0 };
  } catch (err: any) {
    const elapsed = Date.now() - t0;
    const stderrStr = (err.stderr?.toString()?.trim() ?? err.message ?? '');
    console.error(`[sandbox:exec] write_file fail: sandboxId=${sandboxId} path=${path} durationMs=${elapsed} error=${truncate(stderrStr, 120)}`);
    return {
      stdout: (err.stdout?.toString()?.trim() ?? ''),
      stderr: stderrStr,
      exitCode: err.status ?? 1,
    };
  }
}

export async function executeGit(sandboxId: string, args: string[]): Promise<ToolResult> {
  const cmd = `git ${args.map(shellQuote).join(' ')}`;
  console.log(`[sandbox:exec] git: sandboxId=${sandboxId} args=${truncate(cmd, 120)}`);
  return executeShell(sandboxId, cmd);
}

export type ToolFunction = (sandboxId: string, input: Record<string, unknown>) => Promise<ToolResult>;

// Quote arguments for the container's shell. Docker itself is always invoked
// with an argv array, never a host shell that could expand agent-supplied text.
function shellQuote(value: string): string {
  return "'" + value.replace(/'/g, "'\\''") + "'";
}

export const toolHandlers: Record<string, ToolFunction> = {
  shell: (sandboxId, input) => executeShell(sandboxId, input.command as string),
  read_file: (sandboxId, input) => executeReadFile(sandboxId, input.path as string),
  write_file: (sandboxId, input) => executeWriteFile(sandboxId, input.path as string, input.content as string),
  git: (sandboxId, input) => executeGit(sandboxId, input.args as string[]),
};
