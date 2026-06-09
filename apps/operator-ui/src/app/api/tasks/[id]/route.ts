import { prisma } from "@harness/db";

export async function GET(
  _request: Request,
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

  return Response.json(task);
}
