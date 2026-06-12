import { prisma } from "@spoke/db";
import { Client, Connection } from "@temporalio/client";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const connection = await Connection.connect({
      address: process.env.TEMPORAL_ADDRESS ?? "localhost:7233",
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
