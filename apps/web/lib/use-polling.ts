"use client";

import { useEffect, useState } from "react";

export function usePollingJson<T>(url: string, initialData: T, intervalMs = 5000) {
  const [data, setData] = useState(initialData);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const response = await fetch(url, {
          cache: "no-store"
        });
        if (!response.ok) {
          throw new Error(await response.text());
        }
        const nextData = (await response.json()) as T;
        if (!cancelled) {
          setData(nextData);
          setError(null);
        }
      } catch (pollError) {
        if (!cancelled) {
          setError(pollError instanceof Error ? pollError.message : String(pollError));
        }
      }
    };

    const intervalId = window.setInterval(poll, intervalMs);
    void poll();

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [intervalMs, url]);

  return { data, error };
}

