import { prisma } from "@spoke/db";
import { createSession, sessionCookie, ssoConfig, writeAudit } from "@/lib/auth";
import { randomUUID } from "node:crypto";

export const dynamic = "force-dynamic";

function loginRedirect(origin: string, error: string, extra: Record<string, string> = {}): Response {
  const params = new URLSearchParams({ error, ...extra });
  return Response.redirect(`${origin}/sso?${params.toString()}`, 302);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const config = ssoConfig();

  // Provider returned an error (outage, user cancelled, etc.)
  const providerError = url.searchParams.get("error");
  if (providerError) {
    await writeAudit("unknown", "LOGIN_FAILED", {
      allowed: false,
      detail: { provider: config.provider, error: "provider_unavailable", provider_error: providerError },
    });
    return loginRedirect(origin, "provider_unavailable");
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return loginRedirect(origin, "missing_code");
  }

  // Exchange the authorisation code for tokens
  let accessToken: string;
  try {
    const tokenRes = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
      }),
    });
    if (!tokenRes.ok) throw new Error(`token endpoint returned ${tokenRes.status}`);
    const tokens = await tokenRes.json();
    accessToken = tokens.access_token;
    if (!accessToken) throw new Error("no access_token in token response");
  } catch (err) {
    await writeAudit("unknown", "LOGIN_FAILED", {
      allowed: false,
      detail: { provider: config.provider, error: "token_exchange_failed", message: (err as Error).message },
    });
    return loginRedirect(origin, "provider_unavailable");
  }

  // Fetch the user's identity
  let email: string;
  let name: string | null;
  try {
    const userinfoRes = await fetch(config.userinfoUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!userinfoRes.ok) throw new Error(`userinfo endpoint returned ${userinfoRes.status}`);
    const userinfo = await userinfoRes.json();
    email = (userinfo.email ?? "").toLowerCase();
    name = userinfo.name ?? null;
    if (!email) throw new Error("no email in userinfo response");
  } catch (err) {
    await writeAudit("unknown", "LOGIN_FAILED", {
      allowed: false,
      detail: { provider: config.provider, error: "userinfo_failed", message: (err as Error).message },
    });
    return loginRedirect(origin, "provider_unavailable");
  }

  // Match the email domain against the authorised organisation
  const domain = email.split("@")[1] ?? "";
  if (config.allowedDomains.length > 0 && !config.allowedDomains.includes(domain)) {
    await writeAudit(email, "LOGIN_DENIED", {
      allowed: false,
      detail: { provider: config.provider, error: "unauthorized_domain", domain },
    });
    return loginRedirect(origin, "unauthorized_domain", { email });
  }

  // JIT provisioning: create the user on first login, preserve on later logins
  let user = await prisma.user.findUnique({ where: { email } });
  const isNewUser = !user;
  if (!user) {
    user = await prisma.user.create({
      data: {
        id: randomUUID(),
        email,
        name,
        role: config.defaultRole,
        provider: config.provider,
      },
    });
  } else {
    user = await prisma.user.update({
      where: { email },
      data: { last_login_at: new Date(), provider: config.provider, ...(name ? { name } : {}) },
    });
  }

  const { token, expiresAt } = await createSession(user.id, user.role);

  await writeAudit(email, isNewUser ? "USER_PROVISIONED" : "LOGIN_SUCCESS", {
    detail: { provider: config.provider, role: user.role, jit: isNewUser },
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location: `${origin}/${isNewUser ? "?welcome=1" : ""}`,
      "Set-Cookie": sessionCookie(token, expiresAt),
    },
  });
}
