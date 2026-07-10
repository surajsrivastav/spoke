import { prisma } from "@spoke/db";
import { authEnabled, getSession, writeAudit } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const task = await prisma.task.findUnique({
    where: { id: params.id },
    include: {
      task_runs: {
        orderBy: { attempt: "asc" },
        include: { provenances: { orderBy: { created_at: "asc" } } },
      },
    },
  });

  if (!task) {
    return new Response("Not found", { status: 404 });
  }

  if (authEnabled()) {
    const session = await getSession(request);
    if (!session.ok) {
      return Response.json({ error: session.error }, { status: 401 });
    }
    // Cross-team access returns 404 to avoid information disclosure.
    if (
      task.team_id &&
      session.user.role !== "admin" &&
      task.team_id !== session.user.team_id
    ) {
      await writeAudit(session.user.email, "VIEW_TASK_DENIED", {
        resource: params.id,
        allowed: false,
        detail: { role: session.user.role, reason: "cross_team_access" },
      });
      return new Response("Not found", { status: 404 });
    }
  }

  return Response.json(task);
}
