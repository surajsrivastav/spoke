import { prisma } from "@spoke/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  let lastTasks = undefined as unknown as unknown[];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const tasks = await prisma.task.findMany({ orderBy: { created_at: "desc" } });
      send({ type: "init", tasks });
      lastTasks = tasks;

      const interval = setInterval(async () => {
        try {
          const tasks = await prisma.task.findMany({ orderBy: { created_at: "desc" } });
          const updates = tasks.filter((t) => {
            const prev = lastTasks.find(
              (lt: any) => lt.id === t.id,
            ) as (typeof tasks)[number] | undefined;
            return !prev || prev.updated_at.getTime() !== t.updated_at.getTime();
          });
          if (updates.length > 0) {
            send({ type: "update", tasks: updates });
          }
          lastTasks = tasks;
        } catch {
          // poll error, skip
        }
      }, 2000);

      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
