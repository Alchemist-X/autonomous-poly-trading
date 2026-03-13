export async function callOrchestrator(path: string) {
  const baseUrl = process.env.ORCHESTRATOR_INTERNAL_URL;
  const token = process.env.ORCHESTRATOR_INTERNAL_TOKEN;

  if (!baseUrl || !token) {
    return {
      ok: false,
      error: "Missing ORCHESTRATOR_INTERNAL_URL or ORCHESTRATOR_INTERNAL_TOKEN"
    };
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    return {
      ok: false,
      error: await response.text()
    };
  }

  return response.json();
}

