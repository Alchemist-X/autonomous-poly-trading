import { isAdminAuthenticated } from "../../../../lib/auth";
import { callOrchestrator } from "../../../../lib/internal-api";

export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json(await callOrchestrator("/admin/resume"));
}

