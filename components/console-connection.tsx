"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
type Connection = { state: string; message: string; fetchedAt?: string; clients: { id: string; name: string }[]; mappings: { accountId: string; name: string; consoleClientId: string | null }[] };
export function ConsoleConnection({ accountId, onLinked }: { accountId?: string; onLinked?: () => void }) {
  const [data, setData] = useState<Connection | null>(null);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    try {
      const response = await fetch("/api/platform/connection", { cache: "no-store" });
      const result = await response.json() as Connection & { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to check Console.");
      setData(result);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Unable to check Console."); }
    finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, []);
  async function link(id: string) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/platform/connection", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ accountId: id, consoleClientId: choices[id] }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error);
      setMessage("Workspace linked and verified.");
      await load(); onLinked?.();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Unable to save link."); }
    finally { setBusy(false); }
  }
  return <article className="service-panel">
    <div className="service-panel-heading"><div><h2>Console connection</h2><p>{data?.message || "Checking Console connection…"}</p></div><button type="button" onClick={load} disabled={busy}>{busy ? "Checking…" : "Check connection"}</button></div>
    {data && <p><span className={`service-badge ${data.state === "connected" ? "active" : "proposed"}`}>{data.state.replaceAll("_", " ")}</span>{data.fetchedAt && <span> Checked {new Date(data.fetchedAt).toLocaleString()}</span>}</p>}
    {data?.mappings.filter(m => !accountId || m.accountId === accountId).map(m => <div className="console-mapping" key={m.accountId}>
      <Link href={`/clients/${m.accountId}?tab=automations`}>{m.name}</Link>
      {m.consoleClientId ? <span>Workspace: {data.clients.find(c => c.id === m.consoleClientId)?.name || m.consoleClientId}</span> : <><select aria-label={`Console workspace for ${m.name}`} value={choices[m.accountId] || ""} onChange={e => setChoices({ ...choices, [m.accountId]: e.target.value })} disabled={busy || data.state !== "connected"}><option value="">Choose Console workspace</option>{data.clients.filter(c => !data.mappings.some(other => other.consoleClientId === c.id)).map(c => <option key={c.id} value={c.id}>{c.name} ({c.id})</option>)}</select><button type="button" disabled={busy || !choices[m.accountId]} onClick={() => link(m.accountId)}>Link workspace</button></>}
    </div>)}
    <p role="status">{message}</p>
  </article>;
}
