import { getPublicRunDetail } from "@autopoly/db";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await getPublicRunDetail(id);
  if (!run) {
    return new Response("Not found", { status: 404 });
  }
  return Response.json(run);
}

