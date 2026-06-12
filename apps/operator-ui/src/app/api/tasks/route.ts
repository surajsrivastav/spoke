import { prisma } from "@spoke/db";

export const dynamic = "force-dynamic";

// In-memory store for rate limiting
const rateLimitStore: { [key: string]: number } = {};
const RATE_LIMIT_DURATION = 30000; // 30 seconds

export async function GET() {
  const tasks = await prisma.task.findMany({
    orderBy: { created_at: "desc" },
  });
  return Response.json(tasks);
}

export async function POST(request: Request) {
  const { goal, repo_url } = await request.json();
  const ip = (request.headers.get("x-forwarded-for") || request.headers.get("remote-address") || "unknown").split(",")[0];
  const key = `${ip}-${repo_url}`;

  // Check rate limit
  const now = Date.now();
  if (rateLimitStore[key] && (now - rateLimitStore[key] < RATE_LIMIT_DURATION)) {
    return new Response(JSON.stringify({ error: "Too Many Requests" }), { status: 429, headers: { "Content-Type": "application/json" } });
  }

  rateLimitStore[key] = now;

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