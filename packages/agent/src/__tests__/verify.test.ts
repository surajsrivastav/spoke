vi.mock('../tools.js', () => ({
  executeShell: vi.fn(),
}));

import { executeShell } from '../tools.js';
import { runVerification } from '../verify.js';

describe('runVerification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns passed when lint, typecheck, and tests all pass', async () => {
    vi.mocked(executeShell).mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });

    const result = await runVerification('test-sid');

    expect(result).toEqual({ passed: true, errors: {} });
    expect(executeShell).toHaveBeenCalledTimes(3);
    expect(executeShell).toHaveBeenNthCalledWith(1, 'test-sid', 'cd /repo && npm run lint');
    expect(executeShell).toHaveBeenNthCalledWith(2, 'test-sid', 'cd /repo && pnpm typecheck');
    expect(executeShell).toHaveBeenNthCalledWith(3, 'test-sid', 'cd /repo && pnpm test');
  });

  it('collects lint errors when lint fails', async () => {
    vi.mocked(executeShell)
      .mockResolvedValueOnce({ stdout: 'lint error', stderr: '', exitCode: 1 })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });

    const result = await runVerification('test-sid');

    expect(result).toEqual({ passed: false, errors: { lint: 'lint error' } });
    expect(executeShell).toHaveBeenCalledTimes(3);
  });

  it('collects typecheck errors when typecheck fails', async () => {
    vi.mocked(executeShell)
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: 'TS error', exitCode: 1 })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });

    const result = await runVerification('test-sid');

    expect(result).toEqual({ passed: false, errors: { typecheck: 'TS error' } });
  });

  it('collects test errors when tests fail', async () => {
    vi.mocked(executeShell)
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: 'test failure', exitCode: 1 });

    const result = await runVerification('test-sid');

    expect(result).toEqual({ passed: false, errors: { tests: 'test failure' } });
  });

  it('collects all errors when all three fail (non-short-circuiting)', async () => {
    vi.mocked(executeShell)
      .mockResolvedValueOnce({ stdout: '', stderr: 'lint fail', exitCode: 1 })
      .mockResolvedValueOnce({ stdout: '', stderr: 'typecheck fail', exitCode: 1 })
      .mockResolvedValueOnce({ stdout: '', stderr: 'test fail', exitCode: 1 });

    const result = await runVerification('test-sid');

    expect(result).toEqual({
      passed: false,
      errors: { lint: 'lint fail', typecheck: 'typecheck fail', tests: 'test fail' },
    });
    expect(executeShell).toHaveBeenCalledTimes(3);
  });

  it('uses stdout when stderr is empty for error details', async () => {
    vi.mocked(executeShell)
      .mockResolvedValueOnce({ stdout: 'lint warning', stderr: '', exitCode: 1 })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });

    const result = await runVerification('test-sid');

    expect(result).toEqual({ passed: false, errors: { lint: 'lint warning' } });
  });

  it('uses stdout fallback for typecheck when stderr is empty', async () => {
    vi.mocked(executeShell)
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: 'TS type mismatch', stderr: '', exitCode: 1 })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });

    const result = await runVerification('test-sid');

    expect(result).toEqual({ passed: false, errors: { typecheck: 'TS type mismatch' } });
  });

  it('uses stdout fallback for test errors when stderr is empty', async () => {
    vi.mocked(executeShell)
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: 'test assertions failed', stderr: '', exitCode: 1 });

    const result = await runVerification('test-sid');

    expect(result).toEqual({ passed: false, errors: { tests: 'test assertions failed' } });
  });
});
