import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { emailStatus, processNotifications, sendTestEmail } from "@/lib/evidence.functions";
import { Card, Empty, PageHeader, btn, errMsg } from "@/components/app/ui-bits";

export const Route = createFileRoute("/_authenticated/admin/email")({
  head: () => ({ meta: [{ title: "Email delivery — Reimora" }, { name: "description", content: "Delivery status of every Reimora email, with retries and a test send." }] }),
  component: EmailDelivery,
});

const STATUS: Record<string, { label: string; cls: string }> = {
  queued: { label: "Queued", cls: "bg-muted text-muted-foreground" },
  processing: { label: "Sending", cls: "bg-muted text-foreground" },
  sent: { label: "Accepted by Gmail", cls: "bg-accent text-primary" },
  failed: { label: "Failed — will retry", cls: "bg-warning/20 text-foreground" },
  permanently_failed: { label: "Failed", cls: "bg-destructive/15 text-destructive" },
};

const EVENTS: Record<string, string> = {
  welcome: "Welcome", access_request: "New access request", access_received: "Request acknowledgement",
  access_approved: "Access approved", access_rejected: "Access rejected", submitted: "Claim summary",
  claim_to_review: "Claim to review", claim_new: "New claim (admin)", claim_unassigned: "Unassigned claim (admin)",
};

function EmailDelivery() {
  const qc = useQueryClient();
  const status = useServerFn(emailStatus);
  const process = useServerFn(processNotifications);
  const test = useServerFn(sendTestEmail);
  const [st, setSt] = useState("all");
  const [ev, setEv] = useState("all");
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const { data: cfg } = useQuery({ queryKey: ["email-status"], queryFn: () => status() });
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["email-log"],
    queryFn: async () => (await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(300)).data ?? [],
  });
  const { data: refs } = useQuery({
    queryKey: ["email-refs"],
    queryFn: async () => {
      const [c, a] = await Promise.all([supabase.from("claims").select("id, ref"), supabase.from("access_requests").select("id, ref")]);
      return new Map([...(c.data ?? []), ...(a.data ?? [])].map((r) => [r.id, r.ref as string]));
    },
  });

  const list = rows.filter((r) => (st === "all" || r.status === st) && (ev === "all" || r.kind === ev));
  const counts = rows.reduce<Record<string, number>>((m, r) => ({ ...m, [r.status]: (m[r.status] ?? 0) + 1 }), {});
  const refresh = () => qc.invalidateQueries({ queryKey: ["email-log"] });

  async function run(key: string, fn: () => Promise<void>) {
    if (busy) return;
    setBusy(key);
    try { await fn(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); refresh(); }
  }
  const deliverNow = () => run("deliver", async () => {
    const r = await process();
    if (!r.configured) toast.warning("Gmail isn't linked — nothing was sent.");
    else toast.success(`${r.sent} accepted by Gmail${r.failed ? `, ${r.failed} failed` : ""}`);
  });
  const sendTest = () => run("test", async () => {
    const r = await test();
    if (r.ok) toast.success(`Gmail accepted the test email to ${r.to}. Check that inbox (and spam) to confirm arrival.`);
    else toast.error(`Test failed: ${r.error}`);
  });
  const retry = (id: string) => run(id, async () => {
    const { error } = await supabase.rpc("admin_retry_notification", { _id: id });
    if (error) throw error;
    await process();
    toast.success("Retried");
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Email delivery" sub="Every email Reimora queues, and what Gmail said about it. In-app notifications work even when email fails." />

      <Card className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center">
        <div className="text-sm">
          <p className="font-semibold text-primary">Sender: {cfg?.provider ?? "…"}</p>
          <p className="mt-1 text-muted-foreground">
            {cfg == null ? "Checking configuration…" : cfg.configured
              ? "Connected. Emails go out from the linked Gmail address. “Accepted by Gmail” means Gmail took the message — it can't confirm the recipient's inbox, so spam filtering is still possible."
              : "Not connected. Emails stay queued until a Gmail account is linked to this project."}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Queued emails send right after each action, and a background job retries failures every 10 minutes (up to 5 attempts).</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={sendTest} disabled={!!busy} className={btn.ghost}>{busy === "test" ? "Sending…" : "Send test email to me"}</button>
          <button onClick={deliverNow} disabled={!!busy} className={btn.primary}>{busy === "deliver" ? "Sending…" : "Send due emails now"}</button>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        <select aria-label="Filter by status" className="rounded-xl border border-border bg-card px-3 py-2 text-sm" value={st} onChange={(e) => setSt(e.target.value)}>
          <option value="all">All statuses ({rows.length})</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label} ({counts[k] ?? 0})</option>)}
        </select>
        <select aria-label="Filter by event" className="rounded-xl border border-border bg-card px-3 py-2 text-sm" value={ev} onChange={(e) => setEv(e.target.value)}>
          <option value="all">All events</option>
          {Object.entries(EVENTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {isLoading ? <div className="skeleton h-40" /> : list.length === 0 ? <Empty title="No emails match" body="Change the filters, or wait for the next access request or claim." /> : (
        <Card className="divide-y divide-border">
          {list.map((n) => {
            const s = STATUS[n.status] ?? { label: n.status, cls: "bg-muted" };
            const ref = (n.claim_id && refs?.get(n.claim_id)) || (n.access_request_id && refs?.get(n.access_request_id)) || null;
            return (
              <div key={n.id} className="p-4 text-sm">
                <button className="flex w-full flex-wrap items-center gap-2 text-left" onClick={() => setOpen(open === n.id ? null : n.id)} aria-expanded={open === n.id}>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.cls}`}>{s.label}</span>
                  <span className="rounded bg-muted px-1.5 py-px text-[10px] font-bold uppercase text-muted-foreground">{EVENTS[n.kind] ?? n.kind}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{n.subject}</span>
                  <span className="text-xs text-muted-foreground">{n.recipient_email}</span>
                </button>
                <p className="mt-1 text-xs tabular text-muted-foreground">
                  {ref && <>{ref} · </>}attempts {n.attempts}
                  {n.last_attempt_at && <> · last {new Date(n.last_attempt_at).toLocaleString("en-IN")}</>}
                  {n.next_retry_at && n.status === "failed" && <> · next retry {new Date(n.next_retry_at).toLocaleTimeString("en-IN")}</>}
                </p>
                {n.last_error && <p className="mt-1 text-xs text-destructive">{n.last_error}</p>}
                {open === n.id && (
                  <div className="mt-3 rounded-xl border border-border bg-muted/40 p-3 text-xs">
                    <p className="whitespace-pre-line">{n.body}</p>
                    <p className="mt-2 text-muted-foreground">Created {new Date(n.created_at).toLocaleString("en-IN")}{n.sent_at && ` · accepted ${new Date(n.sent_at).toLocaleString("en-IN")}`}{n.provider_message_id && ` · Gmail ID ${n.provider_message_id}`}</p>
                    <div className="mt-2 flex gap-3">
                      {n.claim_id && <Link to="/claims/$id" params={{ id: n.claim_id }} className="font-semibold text-primary">Open claim</Link>}
                      {n.access_request_id && <Link to="/admin/requests" search={{ id: n.access_request_id }} className="font-semibold text-primary">Open request</Link>}
                    </div>
                  </div>
                )}
                {(n.status === "failed" || n.status === "permanently_failed") && (
                  <button onClick={() => retry(n.id)} disabled={!!busy} className={`${btn.ghost} mt-2`}>{busy === n.id ? "Retrying…" : "Retry now"}</button>
                )}
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
