import { prisma } from "@spoke/db";
import { Client, Connection } from "@temporalio/client";
import { authEnabled, getSession, writeAudit } from "@/lib/auth";
import { can, REQUIRED_ROLE } from "@/lib/rbac";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;
  if (authEnabled()) {
    const session = await getSession(request);
    if (!session.ok) {
      return Response.json({ error: session.error }, { status: 401 });
    }

    if (!can(session.user.role, "kill_task")) {
      await writeAudit(session.user.email, "KILL_TASK_DENIED", {
        resource: params.id,
        allowed: false,
        detail: { role: session.user.role, reason: "insufficient_permissions" },
      });
      return Response.json(
        { error: "insufficient_permissions", required_role: REQUIRED_ROLE.kill_task },
        { status: 403 },
      );
    }

    // Team scoping: non-admins may only act on their own team's tasks.
    // Cross-team access returns 404 to avoid information disclosure.
    const task = await prisma.task.findUnique({ where: { id: params.id } });
    if (
      task?.team_id &&
      session.user.role !== "admin" &&
      task.team_id !== session.user.team_id
    ) {
      await writeAudit(session.user.email, "KILL_TASK_DENIED", {
        resource: params.id,
        allowed: false,
        detail: { role: session.user.role, reason: "cross_team_access" },
      });
      return Response.json({ error: "not_found" }, { status: 404 });
    }

    await writeAudit(session.user.email, "KILL_TASK", {
      resource: params.id,
      detail: { role: session.user.role, team: session.user.team_id },
    });
  }

  try {
    const connection = await Connection.connect({
      address: process.env.TEMPORAL_ADDRESS ?? "localhost:7233",
      connectTimeout: "2s",
    });
    const client = new Client({ connection });
    const handle = client.workflow.getHandle(`agent-task-${params.id}`);
    await handle.signal("kill");
    connection.close();
  } catch (err) {
    console.error("Failed to signal Temporal workflow:", err);
  }

  await prisma.task.update({
    where: { id: params.id },
    data: { status: "killed" },
  });

  return Response.json({ ok: true });
}
