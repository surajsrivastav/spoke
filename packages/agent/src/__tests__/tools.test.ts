const mockExecSync = vi.hoisted(() => vi.fn());
vi.mock('node:child_process', () => ({ execSync: mockExecSync }));
vi.mock('../sandbox.js', () => ({ containerName: (id: string) => `spoke-sbx-${id}` }));

import { executeShell, executeReadFile, executeWriteFile, executeGit, toolHandlers } from '../tools.js';

describe('tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('executeShell', () => {
    it('runs a command via docker exec and returns ToolResult', async () => {
      mockExecSync.mockReturnValueOnce('hello');

      const result = await executeShell('test-sid', 'echo hello');

      expect(mockExecSync).toHaveBeenCalledWith(
        'docker exec spoke-sbx-test-sid sh -c "echo hello"',
        expect.objectContaining({ encoding: 'utf-8' }),
      );
      expect(result).toEqual({ stdout: 'hello', stderr: '', exitCode: 0 });
    });

    it('captures stderr and exitCode on failure', async () => {
      const err = new Error('command failed') as any;
      err.status = 1;
      err.stderr = 'bad command';
      err.stdout = '';
      mockExecSync.mockImplementationOnce(() => { throw err; });

      const result = await executeShell('test-sid', 'bad');

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('bad command');
    });

    it('handles error with stdout-only and no stderr', async () => {
      const err = new Error('warnings') as any;
      err.status = 0;
      err.stderr = '';
      err.stdout = 'warning output';
      mockExecSync.mockImplementationOnce(() => { throw err; });

      const result = await executeShell('test-sid', 'cmd');

      expect(result.stdout).toBe('warning output');
      expect(result.exitCode).toBe(0);
    });

    it('handles error without status property', async () => {
      mockExecSync.mockImplementationOnce(() => { throw new Error('crash'); });

      const result = await executeShell('test-sid', 'cmd');

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('crash');
    });

    it('handles error with null message falling through to empty string', async () => {
      mockExecSync.mockImplementationOnce(() => { throw { status: 1 } as any; });

      const result = await executeShell('test-sid', 'cmd');

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBe('');
    });

    it('truncates very long commands in logs (hits truncate else-branch)', async () => {
      mockExecSync.mockReturnValueOnce('ok');
      const longCmd = 'echo ' + 'a'.repeat(200);

      const result = await executeShell('test-sid', longCmd);

      expect(result).toEqual({ stdout: 'ok', stderr: '', exitCode: 0 });
    });

    it('handles Buffer stdout and stderr from execSync error', async () => {
      const err = new Error('buffer error') as any;
      err.status = 2;
      err.stdout = Buffer.from('out');
      err.stderr = Buffer.from('err msg');
      mockExecSync.mockImplementationOnce(() => { throw err; });

      const result = await executeShell('test-sid', 'cmd');

      expect(result.stdout).toBe('out');
      expect(result.stderr).toBe('err msg');
      expect(result.exitCode).toBe(2);
    });
  });

  describe('executeReadFile', () => {
    it('reads a file via cat and returns content', async () => {
      mockExecSync.mockReturnValueOnce('file contents');

      const result = await executeReadFile('test-sid', '/path/to/file.txt');

      expect(mockExecSync).toHaveBeenCalledWith(
        'docker exec spoke-sbx-test-sid sh -c "cat /path/to/file.txt"',
        expect.any(Object),
      );
      expect(result).toEqual({ stdout: 'file contents', stderr: '', exitCode: 0 });
    });

    it('returns ToolResult with exitCode on read failure', async () => {
      const err = new Error('not found') as any;
      err.status = 1;
      err.stderr = 'No such file';
      err.stdout = '';
      mockExecSync.mockImplementationOnce(() => { throw err; });

      const result = await executeReadFile('test-sid', '/missing');

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('No such file');
    });
  });

  describe('executeWriteFile', () => {
    it('writes content via docker exec stdin', async () => {
      mockExecSync.mockReturnValueOnce('');

      const result = await executeWriteFile('test-sid', '/path/to/file.txt', 'new content');

      expect(mockExecSync).toHaveBeenCalledWith(
        'docker exec -i spoke-sbx-test-sid sh -c "mkdir -p \"/path/to\" && cat > \"/path/to/file.txt\""',
        expect.objectContaining({ input: 'new content' }),
      );
      expect(result).toEqual({ stdout: 'File written to /path/to/file.txt', stderr: '', exitCode: 0 });
    });

    it('works for root-level paths without mkdir', async () => {
      mockExecSync.mockReturnValueOnce('');

      const result = await executeWriteFile('test-sid', '/file.txt', 'data');

      expect(mockExecSync).toHaveBeenCalledWith(
        'docker exec -i spoke-sbx-test-sid sh -c "cat > \"/file.txt\""',
        expect.objectContaining({ input: 'data' }),
      );
    });

    it('captures error when docker write fails', async () => {
      const err = new Error('disk full') as any;
      err.status = 1;
      err.stderr = 'No space left';
      err.stdout = '';
      mockExecSync.mockImplementationOnce(() => { throw err; });

      const result = await executeWriteFile('test-sid', '/file.txt', 'data');

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('No space left');
    });

    it('writes to filename with no directory separator', async () => {
      mockExecSync.mockReturnValueOnce('');

      const result = await executeWriteFile('test-sid', 'file.txt', 'data');

      expect(mockExecSync).toHaveBeenCalledWith(
        'docker exec -i spoke-sbx-test-sid sh -c "cat > \"file.txt\""',
        expect.objectContaining({ input: 'data' }),
      );
      expect(result).toEqual({ stdout: 'File written to file.txt', stderr: '', exitCode: 0 });
    });

    it('handles write error with no error properties (hits all ?? fallbacks)', async () => {
      mockExecSync.mockImplementationOnce(() => { throw {} as any; });

      const result = await executeWriteFile('test-sid', '/file.txt', 'data');

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBe('');
    });
  });

  describe('executeGit', () => {
    it('runs a git command via docker exec', async () => {
      mockExecSync.mockReturnValueOnce('On branch main');

      const result = await executeGit('test-sid', ['status']);

      expect(mockExecSync).toHaveBeenCalledWith(
        'docker exec spoke-sbx-test-sid sh -c "git status"',
        expect.any(Object),
      );
      expect(result).toEqual({ stdout: 'On branch main', stderr: '', exitCode: 0 });
    });

    it('joins multiple args into the git command', async () => {
      mockExecSync.mockReturnValueOnce('');

      await executeGit('test-sid', ['commit', '-m', 'my message']);

      expect(mockExecSync).toHaveBeenCalledWith(
        'docker exec spoke-sbx-test-sid sh -c "git commit -m \\"my message\\""',
        expect.any(Object),
      );
    });

    it('captures error when git command fails', async () => {
      const err = new Error('git error') as any;
      err.status = 128;
      err.stderr = 'fatal: not a git repository';
      err.stdout = '';
      mockExecSync.mockImplementationOnce(() => { throw err; });

      const result = await executeGit('test-sid', ['status']);

      expect(result.exitCode).toBe(128);
      expect(result.stderr).toContain('not a git repository');
    });
  });

  describe('toolHandlers', () => {
    it('shell handler calls executeShell with command from input', async () => {
      mockExecSync.mockReturnValueOnce('hello world');

      const result = await toolHandlers.shell('test-sid', { command: 'echo hello' });

      expect(result).toEqual({ stdout: 'hello world', stderr: '', exitCode: 0 });
    });

    it('read_file handler calls executeReadFile with path from input', async () => {
      mockExecSync.mockReturnValueOnce('file content');

      const result = await toolHandlers.read_file('test-sid', { path: '/some/file.txt' });

      expect(result).toEqual({ stdout: 'file content', stderr: '', exitCode: 0 });
    });

    it('write_file handler calls executeWriteFile with path and content from input', async () => {
      mockExecSync.mockReturnValueOnce('');

      const result = await toolHandlers.write_file('test-sid', { path: '/out.txt', content: 'data' });

      expect(result).toEqual({ stdout: 'File written to /out.txt', stderr: '', exitCode: 0 });
    });

    it('git handler calls executeGit with args from input', async () => {
      mockExecSync.mockReturnValueOnce('ok');

      const result = await toolHandlers.git('test-sid', { args: ['diff'] });

      expect(result).toEqual({ stdout: 'ok', stderr: '', exitCode: 0 });
    });

  });
});
