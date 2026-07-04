import { executeGit } from './tools.js';
import { env } from '@spoke/shared';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

export async function pushBranch(
  sandboxId: string,
  repoUrl: string,
  goal: string,
  taskId?: string,
): Promise<{ branch: string }> {
  const branchSuffix = slugify(goal);
  const branch = taskId ? `spoke/${taskId}-${branchSuffix}` : `spoke/${branchSuffix}`;

  await executeGit(sandboxId, ['-C', '/repo', 'config', 'user.name', 'Spoke Agent']);
  await executeGit(sandboxId, ['-C', '/repo', 'config', 'user.email', 'spoke@agent.dev']);
  await executeGit(sandboxId, ['-C', '/repo', 'checkout', '-b', branch]);
  await executeGit(sandboxId, ['-C', '/repo', 'add', '-A']);

  const status = await executeGit(sandboxId, ['-C', '/repo', 'status', '--porcelain']);
  if (status.stdout.trim()) {
    await executeGit(sandboxId, ['-C', '/repo', 'commit', '-m', `Spoke: ${goal}`]);
  } else {
    const ahead = await executeGit(sandboxId, ['-C', '/repo', 'rev-list', '--count', 'main..HEAD']);
    if (ahead.stdout.trim() === '0') {
      throw new Error('No changes detected — agent did not modify any files');
    }
  }

  const fullUrl = normalizeRepoUrl(repoUrl);
  const remote = fullUrl.replace('https://', `https://${env.GH_TOKEN}@`);
  await executeGit(sandboxId, ['-C', '/repo', 'remote', 'set-url', 'origin', remote]);
  await executeGit(sandboxId, ['-C', '/repo', 'push', 'origin', branch]);

  return { branch };
}

function normalizeRepoUrl(repoUrl: string): string {
  if (repoUrl.startsWith('http://') || repoUrl.startsWith('https://') || repoUrl.startsWith('git@')) {
    return repoUrl;
  }
  const parts = repoUrl.split('/');
  if (parts.length === 2) {
    return `https://github.com/${parts[0]}/${parts[1]}.git`;
  }
  return repoUrl;
}

export async function createPr(
  repoUrl: string,
  branch: string,
  goal: string,
  description?: string,
): Promise<{ prUrl: string; prNumber: number }> {
  const fullUrl = normalizeRepoUrl(repoUrl);
  const match = fullUrl.match(/github\.com[\/:]([\w.-]+)\/([\w.-]+)(\.git)?$/);
  if (!match) {
    throw new Error(`Invalid GitHub repo URL: ${repoUrl}`);
  }

  const owner = match[1];
  const repo = match[2].replace('.git', '');

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GH_TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github.v3+json',
    },
    body: JSON.stringify({
      title: goal,
      body: description ?? goal,
      head: branch,
      base: 'main',
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`GitHub API error (${response.status}): ${errBody}`);
  }

  const data = await response.json() as { html_url: string; number: number };
  return { prUrl: data.html_url, prNumber: data.number };
}
