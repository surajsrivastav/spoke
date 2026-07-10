import { prisma } from "@spoke/db";
import { randomUUID } from "node:crypto";

export const SESSION_COOKIE = "spoke_session";

export function authEnabled(): boolean {
  return process.env.AUTH_ENABLED === "true";
}

export function ssoConfig() {
  const issuer = (process.env.SSO_ISSUER ?? "").replace(/\/$/, "");
  return {
    issuer,
    clientId: process.env.SSO_CLIENT_ID ?? "",
    clientSecret: process.env.SSO_CLIENT_SECRET ?? "",
    redirectUri: process.env.SSO_REDIRECT_URI ?? "http://localhost:3000/api/auth/sso/callback",
    authorizeUrl: process.env.SSO_AUTHORIZE_URL || `${issuer}/authorize`,
    tokenUrl: process.env.SSO_TOKEN_URL || `${issuer}/token`,
    userinfoUrl: process.env.SSO_USERINFO_URL || `${issuer}/userinfo`,
    provider: process.env.SSO_PROVIDER ?? "oidc",
    allowedDomains: (process.env.SSO_ALLOWED_DOMAINS ?? "")
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean),
    defaultRole: process.env.SSO_DEFAULT_ROLE ?? "operator",
    sessionTtlHours: Number(process.env.SESSION_TTL_HOURS ?? "8"),
  };
}

export async function writeAudit(
  actor: string,
  action: string,
  options: { resource?: string; allowed?: boolean; detail?: Record<string, unknown> } = {},
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        id: randomUUID(),
        actor,
        action,
        resource: options.resource,
        allowed: options.allowed ?? true,
        detail: options.detail as never,
      },
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}

export interface AuthedUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  team_id: string | null;
}

export type SessionResult =
  | { ok: true; user: AuthedUser; token: string }
  | { ok: false; error: "session_expired" | "unauthenticated" };

function extractToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7);

  const cookieHeader = request.headers.get("cookie") ?? "";
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return rest.join("=");
  }
  return null;
}

/**
 * Resolve the session for a request. A session is invalid when it is
 * expired or when the user's role has changed since login (forcing
 * re-authentication per F-08).
 */
export async function getSession(request: Request): Promise<SessionResult> {
  const token = extractToken(request);
  if (!token) return { ok: false, error: "unauthenticated" };

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session) return { ok: false, error: "session_expired" };

  if (session.expires_at.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { token } }).catch(() => {});
    return { ok: false, error: "session_expired" };
  }

  if (session.user.role !== session.role) {
    await prisma.session.delete({ where: { token } }).catch(() => {});
    return { ok: false, error: "session_expired" };
  }

  return {
    ok: true,
    token,
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
      team_id: session.user.team_id,
    },
  };
}

export async function createSession(userId: string, role: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + ssoConfig().sessionTtlHours * 60 * 60 * 1000);
  await prisma.session.create({
    data: { token, user_id: userId, role, expires_at: expiresAt },
  });
  return { token, expiresAt };
}

export function sessionCookie(token: string, expiresAt: Date): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Expires=${expiresAt.toUTCString()}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
