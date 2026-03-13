import { notFound } from "next/navigation";
import { getPublicRunDetail } from "@autopoly/db";
import { RunDetail } from "../../../components/run-detail";

export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await getPublicRunDetail(id);

  if (!run) {
    notFound();
  }

  return <RunDetail runId={id} initialData={run} />;
}

