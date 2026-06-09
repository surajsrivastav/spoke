import { prisma } from "@harness/db";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  await prisma.task.update({
    where: { id: params.id },
    data: { status: "killed" },
  });

  return Response.json({ ok: true });
}
