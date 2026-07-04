const mockFetch = vi.hoisted(() => vi.fn());

vi.mock('../tools.js', () => ({
  executeGit: vi.fn(),
}));

vi.mock('@spoke/shared', () => ({
  env: { GH_TOKEN: 'test-gh-token' },
}));

import { executeGit } from '../tools.js';
import { pushBranch, createPr } from '../github.js';

describe('github', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('pushBranch', () => {
    const repoUrl = 'https://github.com/owner/repo.git';
    const goal = 'Fix the bug!';

    it('creates branch, commits changes, and pushes with taskId', async () => {
      vi.mocked(executeGit)
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })  // config user.name
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })  // config user.email
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })  // checkout -b
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })  // add -A
        .mockResolvedValueOnce({ stdout: 'M file.ts\n', stderr: '', exitCode: 0 })  // status --porcelain (has changes)
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })  // commit
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })  // remote set-url
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }); // push

      const result = await pushBranch('test-sid', repoUrl, goal, 'task-123');

      expect(result).toEqual({ branch: 'spoke/task-123-fix-the-bug' });
      expect(executeGit).toHaveBeenCalledTimes(8);
      expect(executeGit).toHaveBeenNthCalledWith(1, 'test-sid', ['-C', '/repo', 'config', 'user.name', 'Spoke Agent']);
      expect(executeGit).toHaveBeenNthCalledWith(2, 'test-sid', ['-C', '/repo', 'config', 'user.email', 'spoke@agent.dev']);
      expect(executeGit).toHaveBeenNthCalledWith(3, 'test-sid', ['-C', '/repo', 'checkout', '-b', 'spoke/task-123-fix-the-bug']);
      expect(executeGit).toHaveBeenNthCalledWith(4, 'test-sid', ['-C', '/repo', 'add', '-A']);
      expect(executeGit).toHaveBeenNthCalledWith(5, 'test-sid', ['-C', '/repo', 'status', '--porcelain']);
      expect(executeGit).toHaveBeenNthCalledWith(6, 'test-sid', ['-C', '/repo', 'commit', '-m', 'Spoke: Fix the bug!']);
      expect(executeGit).toHaveBeenNthCalledWith(7, 'test-sid', ['-C', '/repo', 'remote', 'set-url', 'origin', repoUrl.replace('https://', `https://test-gh-token@`)]);
      expect(executeGit).toHaveBeenNthCalledWith(8, 'test-sid', ['-C', '/repo', 'push', 'origin', 'spoke/task-123-fix-the-bug']);
    });

    it('creates branch without taskId', async () => {
      vi.mocked(executeGit)
        .mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });

      const result = await pushBranch('test-sid', repoUrl, goal);

      expect(result).toEqual({ branch: 'spoke/fix-the-bug' });
    });

    it('skips commit when there are no changes', async () => {
      vi.mocked(executeGit)
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })  // status --porcelain (empty)
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })  // rev-list --count main..HEAD
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })  // remote set-url
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }); // push

      const result = await pushBranch('test-sid', repoUrl, 'noop');

      expect(executeGit).toHaveBeenCalledTimes(8);  // no commit call
      expect(result).toEqual({ branch: 'spoke/noop' });
    });

    it('throws when push fails', async () => {
      vi.mocked(executeGit)
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })  // config user.name
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })  // config user.email
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })  // checkout -b
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })  // add -A
        .mockResolvedValueOnce({ stdout: 'M file.ts\n', stderr: '', exitCode: 0 })  // status
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })  // commit
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })  // remote set-url
        .mockRejectedValueOnce(new Error('push rejected'));  // push

      await expect(pushBranch('test-sid', repoUrl, goal, 'task-1')).rejects.toThrow('push rejected');
    });

    it('handles unicode characters in goal', async () => {
      vi.mocked(executeGit)
        .mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });

      const result = await pushBranch('test-sid', repoUrl, 'Fix 🐛 bug! ✨');

      expect(result).toEqual({ branch: 'spoke/fix-bug' });
    });

    it('handles goal with leading and trailing special characters', async () => {
      vi.mocked(executeGit)
        .mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });

      const result = await pushBranch('test-sid', repoUrl, '!!urgent!!');

      expect(result).toEqual({ branch: 'spoke/urgent' });
    });

    it('truncates branch name to 50 characters for long goals', async () => {
      vi.mocked(executeGit)
        .mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });

      const goal = 'a'.repeat(100);
      const result = await pushBranch('test-sid', repoUrl, goal);

      expect(result.branch).toBe('spoke/' + 'a'.repeat(50));
    });

    it('handles uppercase letters in goal by lowercasing slug', async () => {
      vi.mocked(executeGit)
        .mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });

      const result = await pushBranch('test-sid', repoUrl, 'FIX THE BUG');

      expect(result).toEqual({ branch: 'spoke/fix-the-bug' });
    });

    it('skips commit when status has only whitespace', async () => {
      vi.mocked(executeGit)
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
        .mockResolvedValueOnce({ stdout: '\n', stderr: '', exitCode: 0 })  // whitespace-only status
        .mockResolvedValueOnce({ stdout: '3', stderr: '', exitCode: 0 })    // rev-list --count main..HEAD
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })     // remote set-url
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });    // push

      const result = await pushBranch('test-sid', repoUrl, 'whitespace check');

      expect(executeGit).toHaveBeenCalledTimes(8);  // no commit call
      expect(result).toEqual({ branch: 'spoke/whitespace-check' });
    });
  });

  describe('createPr', () => {
    const repoUrl = 'https://github.com/owner/my-repo.git';
    const branch = 'spoke/fix-bug';

    it('creates a pull request and returns prUrl and prNumber', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ html_url: 'https://github.com/owner/my-repo/pull/42', number: 42 }),
      });

      const result = await createPr(repoUrl, branch, 'Fix the bug', 'Description of fix');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/my-repo/pulls',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-gh-token',
          }),
          body: expect.stringContaining('"title":"Fix the bug"'),
        }),
      );
      expect(result).toEqual({ prUrl: 'https://github.com/owner/my-repo/pull/42', prNumber: 42 });
    });

    it('uses goal as body when description is not provided', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ html_url: 'https://github.com/owner/my-repo/pull/1', number: 1 }),
      });

      await createPr(repoUrl, branch, 'My goal');

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.title).toBe('My goal');
      expect(callBody.body).toBe('My goal');
    });

    it('parses GitHub URL without .git suffix', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ html_url: 'https://github.com/user/proj/pull/1', number: 1 }),
      });

      const result = await createPr('https://github.com/user/proj', branch, 'goal');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/user/proj/pulls',
        expect.any(Object),
      );
      expect(result.prNumber).toBe(1);
    });

    it('parses SSH-style GitHub URLs', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ html_url: 'https://github.com/user/proj/pull/1', number: 1 }),
      });

      const result = await createPr('git@github.com:user/proj.git', branch, 'goal');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/user/proj/pulls',
        expect.any(Object),
      );
      expect(result.prNumber).toBe(1);
    });

    it('throws on invalid repo URL', async () => {
      await expect(createPr('https://example.com/repo', branch, 'goal')).rejects.toThrow(
        'Invalid GitHub repo URL',
      );
    });

    it('throws when GitHub API returns non-OK status', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 422,
        text: () => Promise.resolve('Validation error'),
      });

      await expect(createPr(repoUrl, branch, 'goal')).rejects.toThrow('GitHub API error (422): Validation error');
    });

    it('sends correct body, headers, and base branch to GitHub API', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ html_url: 'https://github.com/owner/my-repo/pull/42', number: 42 }),
      });

      const result = await createPr(repoUrl, branch, 'Fix the bug', 'Description of fix');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/my-repo/pulls',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer test-gh-token',
            'Content-Type': 'application/json',
            Accept: 'application/vnd.github.v3+json',
          },
          body: JSON.stringify({
            title: 'Fix the bug',
            body: 'Description of fix',
            head: 'spoke/fix-bug',
            base: 'main',
          }),
        },
      );
      expect(result).toEqual({ prUrl: 'https://github.com/owner/my-repo/pull/42', prNumber: 42 });
    });

    it('handles repo URL with dots in owner or name', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ html_url: 'https://github.com/org.team/repo.name/pull/1', number: 1 }),
      });

      const result = await createPr('https://github.com/org.team/repo.name.git', branch, 'goal');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/org.team/repo.name/pulls',
        expect.any(Object),
      );
      expect(result.prNumber).toBe(1);
    });
  });
});
