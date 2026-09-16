import { execFileSync } from 'node:child_process';
import { executeShell, executeWriteFile, executeGit } from '../tools.js';

vi.mock('node:child_process', () => ({ execFileSync: vi.fn(() => '') }));

describe('host/container command boundary', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes substitutions, backticks and newlines as a single Docker argument', async () => {
    const command = 'echo $(id) `uname` "$HOME"\nprintf done';
    await executeShell('test-sandbox', command);
    expect(execFileSync).toHaveBeenCalledWith('docker',
      ['exec', 'spoke-sbx-test-sandbox', 'sh', '-c', command], expect.any(Object));
    expect(vi.mocked(execFileSync).mock.calls[0][2]).not.toHaveProperty('shell');
  });

  it('treats malicious-looking filenames literally inside the container', async () => {
    await executeWriteFile('test-sandbox', "/repo/it's $(id).txt", 'literal $content');
    const args = vi.mocked(execFileSync).mock.calls[0][1] as string[];
    expect(args.at(-1)).toBe("mkdir -p -- '/repo' && cat > '/repo/it'\\''s $(id).txt'");
    expect(vi.mocked(execFileSync).mock.calls[0][2]).toMatchObject({ input: 'literal $content' });
  });

  it('quotes every git argument, including shell operators without spaces', async () => {
    await executeGit('test-sandbox', ['commit', '-m', '$(id);whoami']);
    expect(execFileSync).toHaveBeenCalledWith('docker',
      ['exec', 'spoke-sbx-test-sandbox', 'sh', '-c', "git 'commit' '-m' '$(id);whoami'"], expect.any(Object));
  });
});
