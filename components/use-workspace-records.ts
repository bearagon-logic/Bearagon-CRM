"use client";
import { useEffect, useState } from "react";

export function useWorkspaceRecords<T>(url: string, key: string) {
  const [records, setRecords] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setRecords([]);
    fetch(url, { cache: "no-store", signal: controller.signal }).then(async response => {
      const body = await response.json() as Record<string, unknown>;
      if (!response.ok || !Array.isArray(body[key])) throw new Error("Records could not be loaded. Retry or open the source page.");
      if (!controller.signal.aborted) setRecords(body[key] as T[]);
    }).catch(error => { if (!controller.signal.aborted) setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [url, key, revision]);
  return { records, loading, error, refresh: () => setRevision(v => v + 1) };
}
