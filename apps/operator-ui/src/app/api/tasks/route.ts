import { prisma } from "@spoke/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const tasks = await prisma.task.findMany({
    orderBy: { created_at: "desc" },
  });
  return Response.json(tasks);
}

export async function POST(request: Request) {
  const { goal, repo_url } = await request.json();
  if (!goal || !repo_url) {
    return new Response("goal and repo_url are required", { status: 400 });
  }

  const task = await prisma.task.create({
    data: {
      id: crypto.randomUUID(),
      goal,
      repo_url,
      branch_target: `spoke/${Date.now().toString(36)}`,
      status: "pending",
      created_by: "demo",
    },
  });

  return Response.json(task, { status: 201 });
}
