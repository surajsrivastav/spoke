import { prisma } from "@spoke/db";
import { getSession, clearSessionCookie, writeAudit } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getSession(request);
  if (session.ok) {
    await prisma.session.delete({ where: { token: session.token } }).catch(() => {});
    await writeAudit(session.user.email, "LOGOUT");
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": clearSessionCookie(),
    },
  });
}
