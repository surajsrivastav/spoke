const mockExecSync = vi.hoisted(() => vi.fn());
vi.mock('node:child_process', () => ({ execSync: mockExecSync }));
vi.mock('node:crypto', () => ({ randomUUID: () => 'mock-uuid' }));

import { provisionSandbox, destroySandbox, containerName } from '../sandbox.js';

describe('sandbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('provisionSandbox', () => {
    it('creates a Docker container and returns sandboxId', async () => {
      mockExecSync
        .mockReturnValueOnce(Buffer.from(''))  // docker run -d
        .mockReturnValueOnce(Buffer.from('')); // docker exec apk add

      const result = await provisionSandbox();

      expect(mockExecSync).toHaveBeenCalledTimes(2);
      expect(mockExecSync).toHaveBeenNthCalledWith(1,
        expect.stringContaining('docker run -d --name spoke-sbx-mock-uuid'),
        expect.objectContaining({ timeout: 30_000 }),
      );
      expect(mockExecSync).toHaveBeenNthCalledWith(2,
        expect.stringContaining('docker exec spoke-sbx-mock-uuid sh -c "apk add --no-cache git openssh'),
        expect.objectContaining({ timeout: 120_000 }),
      );
      expect(result).toEqual({ sandboxId: 'mock-uuid' });
    });

    it('throws when provisioning fails', async () => {
      mockExecSync.mockImplementationOnce(() => { throw new Error('Docker error'); });

      await expect(provisionSandbox()).rejects.toThrow('Docker error');
    });

    it('throws when docker exec fails after container starts', async () => {
      mockExecSync
        .mockReturnValueOnce(Buffer.from(''))
        .mockImplementationOnce(() => { throw new Error('apk failed'); });

      await expect(provisionSandbox()).rejects.toThrow('apk failed');
      expect(mockExecSync).toHaveBeenLastCalledWith('docker rm -f spoke-sbx-mock-uuid', expect.any(Object));
    });
  });

  describe('destroySandbox', () => {
    it('rejects IDs containing shell syntax before invoking Docker', async () => {
      await expect(destroySandbox('bad;id')).rejects.toThrow('Invalid sandbox ID');
      expect(mockExecSync).not.toHaveBeenCalled();
      expect(() => containerName('$(id)')).toThrow('Invalid sandbox ID');
    });
    it('removes the Docker container', async () => {
      mockExecSync.mockReturnValueOnce(Buffer.from(''));

      await destroySandbox('mock-uuid');

      expect(mockExecSync).toHaveBeenCalledWith(
        'docker rm -f spoke-sbx-mock-uuid',
        expect.objectContaining({ timeout: 30_000 }),
      );
    });

    it('throws when container removal fails', async () => {
      mockExecSync.mockImplementationOnce(() => { throw new Error('rm failed'); });

      await expect(destroySandbox('mock-uuid')).rejects.toThrow('rm failed');
    });
  });
});
