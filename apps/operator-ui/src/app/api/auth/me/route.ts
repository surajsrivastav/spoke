import { getSession, authEnabled } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!authEnabled()) {
    return Response.json({ auth_enabled: false, user: null });
  }

  const session = await getSession(request);
  if (!session.ok) {
    return Response.json({ error: session.error }, { status: 401 });
  }

  return Response.json({ auth_enabled: true, user: session.user });
}
