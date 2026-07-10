import { ssoConfig } from "@/lib/auth";
import { randomUUID } from "node:crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = ssoConfig();

  if (!config.clientId || (!config.issuer && !process.env.SSO_AUTHORIZE_URL)) {
    return Response.json(
      { error: "sso_not_configured", message: "Set SSO_ISSUER and SSO_CLIENT_ID to enable SSO." },
      { status: 501 },
    );
  }

  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: "openid email profile",
    state: randomUUID(),
  });

  return Response.redirect(`${config.authorizeUrl}?${params.toString()}`, 302);
}
