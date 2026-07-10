import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { prisma } from '@spoke/db';
import { GET as ssoLogin } from '../app/api/auth/sso/login/route';
import { GET as ssoCallback } from '../app/api/auth/sso/callback/route';
import { GET as me } from '../app/api/auth/me/route';

vi.mock('@spoke/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    session: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

const SSO_ENV = {
  AUTH_ENABLED: 'true',
  SSO_ISSUER: 'https://idp.example.com',
  SSO_CLIENT_ID: 'spoke-client',
  SSO_CLIENT_SECRET: 'secret',
  SSO_REDIRECT_URI: 'http://localhost:3000/api/auth/sso/callback',
  SSO_PROVIDER: 'google',
  SSO_ALLOWED_DOMAINS: 'ford.com',
  SSO_DEFAULT_ROLE: 'operator',
};

describe('F-06: SSO Login — Acceptance Criteria', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(process.env, SSO_ENV);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);
    vi.mocked(prisma.session.create).mockResolvedValue({} as never);
  });

  afterEach(() => {
    for (const key of Object.keys(SSO_ENV)) delete process.env[key];
    vi.unstubAllGlobals();
  });

  describe('✅ Happy path — operator signs in via SSO', () => {
    it('login redirects to the identity provider authorize endpoint', async () => {
      const res = await ssoLogin();
      expect(res.status).toBe(302);
      const location = res.headers.get('location')!;
      expect(location).toContain('https://idp.example.com/authorize');
      expect(location).toContain('client_id=spoke-client');
      expect(location).toContain('response_type=code');
    });

    it('callback exchanges the code, matches the domain, creates a session and redirects to the dashboard', async () => {
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'at-123' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ email: 'operator@ford.com', name: 'Op Erator' }) }));

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'u1', email: 'operator@ford.com', name: 'Op Erator', role: 'operator', team_id: null,
      } as never);
      vi.mocked(prisma.user.update).mockResolvedValue({
        id: 'u1', email: 'operator@ford.com', name: 'Op Erator', role: 'operator', team_id: null,
      } as never);

      const res = await ssoCallback(new Request('http://localhost:3000/api/auth/sso/callback?code=auth-code-1'));

      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBe('http://localhost:3000/');
      expect(res.headers.get('set-cookie')).toContain('spoke_session=');
      expect(prisma.session.create).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ actor: 'operator@ford.com', action: 'LOGIN_SUCCESS' }) }),
      );
    });
  });

  describe('❌ Sad path — SSO provider is down', () => {
    it('redirects back to login with a provider error and creates no session', async () => {
      const res = await ssoCallback(
        new Request('http://localhost:3000/api/auth/sso/callback?error=temporarily_unavailable'),
      );

      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toContain('error=provider_unavailable');
      expect(prisma.session.create).not.toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'LOGIN_FAILED', allowed: false }) }),
      );
    });

    it('handles token exchange failure as provider_unavailable', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502 }));

      const res = await ssoCallback(new Request('http://localhost:3000/api/auth/sso/callback?code=c1'));

      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toContain('error=provider_unavailable');
      expect(prisma.session.create).not.toHaveBeenCalled();
    });
  });

  describe('❌ Sad path — user is not in the authorised organisation', () => {
    it('denies personal accounts whose domain is not configured', async () => {
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'at-123' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ email: 'personal@gmail.com' }) }));

      const res = await ssoCallback(new Request('http://localhost:3000/api/auth/sso/callback?code=c1'));

      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toContain('error=unauthorized_domain');
      expect(res.headers.get('location')).toContain('personal%40gmail.com');
      expect(prisma.session.create).not.toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ actor: 'personal@gmail.com', action: 'LOGIN_DENIED', allowed: false }) }),
      );
    });
  });

  describe('❌ Sad path — session token expires mid-session', () => {
    it('returns 401 session_expired for an expired session', async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        token: 'tok-1',
        role: 'operator',
        expires_at: new Date(Date.now() - 1000),
        user: { id: 'u1', email: 'operator@ford.com', name: null, role: 'operator', team_id: null },
      } as never);
      vi.mocked(prisma.session.delete).mockResolvedValue({} as never);

      const res = await me(new Request('http://localhost:3000/api/auth/me', {
        headers: { cookie: 'spoke_session=tok-1' },
      }));

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: 'session_expired' });
      expect(prisma.session.delete).toHaveBeenCalledWith({ where: { token: 'tok-1' } });
    });
  });

  describe('⚠️ Edge case — JIT provisioning on first-ever login', () => {
    it('creates the user with the default operator role and audits USER_PROVISIONED', async () => {
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'at-123' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ email: 'alice@ford.com', name: 'Alice' }) }));

      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockImplementation((async (args: { data: Record<string, unknown> }) => args.data) as never);

      const res = await ssoCallback(new Request('http://localhost:3000/api/auth/sso/callback?code=c1'));

      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toContain('welcome=1');
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'alice@ford.com', role: 'operator', provider: 'google' }),
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ actor: 'alice@ford.com', action: 'USER_PROVISIONED' }) }),
      );
    });
  });

  describe('⚠️ Edge case — provider switch preserves the account', () => {
    it('matches an existing user by email and does not create a duplicate', async () => {
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'at-123' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ email: 'operator@ford.com', name: 'Op' }) }));

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'u1', email: 'operator@ford.com', name: 'Op', role: 'admin', team_id: null, provider: 'okta',
      } as never);
      vi.mocked(prisma.user.update).mockResolvedValue({
        id: 'u1', email: 'operator@ford.com', name: 'Op', role: 'admin', team_id: null, provider: 'google',
      } as never);

      const res = await ssoCallback(new Request('http://localhost:3000/api/auth/sso/callback?code=c1'));

      expect(res.status).toBe(302);
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: 'operator@ford.com' },
          data: expect.objectContaining({ provider: 'google' }),
        }),
      );
    });
  });
});
